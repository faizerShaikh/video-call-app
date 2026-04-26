import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSocket } from '@/hooks/useSocket';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useAuth } from '@/context/AuthContext';
import { Header } from '@/components/Header';
import { VideoPlayer } from './VideoPlayer';
import { Controls } from './Controls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isGetUserMediaSupported, isSecureContext } from '@/utils/webrtc';
import { LuCopy } from 'react-icons/lu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function VideoCall() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [roomId, setRoomId] = useState('');
  const [localUserId] = useState(() => `user-${Math.random().toString(36).substr(2, 9)}`);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [participantNames, setParticipantNames] = useState(new Map());
  const [activeSharerId, setActiveSharerId] = useState(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [error, setError] = useState(null);
  const currentRoomIdRef = useRef(null);
  const wasScreenSharingRef = useRef(false);

  const { user } = useAuth();
  const { socket, isConnected, error: socketError } = useSocket();
  const {
    localStream,
    remoteStreams, // Map<socketId, MediaStream>
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    remoteMediaStates, // Map<socketId, {videoEnabled, audioEnabled}>
    connectionStates, // Map<socketId, connectionState>
    error: webrtcError,
    startCallWithParticipant,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    toggleVideo,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
    endCall,
    initializeLocalStream,
    updateRemoteMediaState,
    getPeerConnections, // Get peer connections map
  } = useWebRTC(socket, roomId, localUserId);

  // Normalize room ID (trim and lowercase for consistency)
  const normalizeRoomId = (id) => {
    return id.trim().toLowerCase();
  };

  // Join room
  const handleJoinRoom = async (roomIdToJoin) => {
    const normalizedRoomId = normalizeRoomId(roomId || roomIdToJoin);
    
    if (!normalizedRoomId) {
      setError('Please enter a room ID');
      return;
    }

    if (!socket || !isConnected) {
      setError('Not connected to server. Please wait...');
      return;
    }

    try {
      setError(null);
      
      // Update roomId state with normalized version
      setRoomId(normalizedRoomId);
      
      // Initialize local stream
      await initializeLocalStream();

      // Join room via socket with normalized room ID
      currentRoomIdRef.current = normalizedRoomId;
      socket.emit('join-room', {
        roomId: normalizedRoomId,
        userId: user?._id || localUserId,
        userName: user?.name || 'Guest',
      });
      setHasJoinedRoom(true);

      // Don't start call here - wait for room-joined event which tells us
      // if there are other participants. The room-joined handler will decide
      // whether to create an offer or wait for one.
    } catch (err) {
      console.error('Error joining room:', err);
      setError(err.message || 'Failed to join room');
    }
  };

  const handleToggleScreenShare = async () => {
    if (!socket || !roomId) return;

    if (isScreenSharing) {
      socket.emit('screen-share:stop', { roomId, reason: 'manual' });
      stopScreenShare('manual');
      setActiveSharerId(null);
      return;
    }

    if (activeSharerId && activeSharerId !== socket.id) {
      toast.error('Someone is already sharing their screen');
      return;
    }

    socket.emit('screen-share:start-request', { roomId });
  };

  // Leave room
  const handleLeaveRoom = () => {
    currentRoomIdRef.current = null;
    if (socket && roomId) {
      socket.emit('leave-room', { roomId });
    }
    endCall();
    setHasJoinedRoom(false);
    setRoomId('');
    setParticipantCount(0);
    setError(null);
    
    // Clear roomid query parameter from URL
    if (searchParams.get('roomid')) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('roomid');
      setSearchParams(newSearchParams, { replace: true });
    }
  };

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    // Re-join room on reconnect (socket.id changes after disconnect; server forgets us)
    const onConnect = () => {
      const roomToRejoin = currentRoomIdRef.current;
      if (!roomToRejoin) return;
      endCall();
      setRoomId(roomToRejoin);
      setHasJoinedRoom(true);
      socket.emit('join-room', {
        roomId: roomToRejoin,
        userId: user?._id || localUserId,
        userName: user?.name || 'Guest',
      });
      setError(null);
    };
    socket.on('connect', onConnect);

    // Track if we've received an offer to avoid creating duplicate offers
    const offerReceivedRef = { current: false };
    const offerTimeoutRef = { current: null };

    // Handle incoming offer
    socket.on('offer', ({ offer, from }) => {
      console.log('📥 Received offer from:', from);
      offerReceivedRef.current = true;
      // Cancel any pending offer creation
      if (offerTimeoutRef.current) {
        clearTimeout(offerTimeoutRef.current);
        offerTimeoutRef.current = null;
        console.log('❌ Cancelled pending offer creation - received offer instead');
      }
      handleOffer(offer, from);
    });

    // Handle incoming answer
    socket.on('answer', ({ answer, from }) => {
      console.log('📥 Received answer from:', from);
      console.log('📥 Answer details:', {
        type: answer?.type,
        sdp: answer?.sdp?.substring(0, 100) + '...',
      });
      handleAnswer(answer, from);
    });

    // Handle ICE candidate
    socket.on('ice-candidate', ({ candidate, from }) => {
      console.log('🧊 Received ICE candidate from:', from);
      handleIceCandidate(candidate, from);
    });

    // Handle media state changes (remote video/audio on/off)
    socket.on('media-state', ({ videoEnabled, audioEnabled, from }) => {
      console.log('📹 Media state update received from:', from);
      console.log('📹 Video enabled:', videoEnabled, 'Audio enabled:', audioEnabled);
      
      if (videoEnabled !== undefined || audioEnabled !== undefined) {
        updateRemoteMediaState(
          from,
          videoEnabled !== undefined ? videoEnabled : true,
          audioEnabled !== undefined ? audioEnabled : true
        );
      }
    });

    socket.on('screen-share:start-accepted', async ({ sharerSocketId }) => {
      if (sharerSocketId !== socket.id) return;
      const started = await startScreenShare();
      if (!started) {
        socket.emit('screen-share:stop', { roomId, reason: 'start-failed' });
        return;
      }
      setActiveSharerId(socket.id);
      toast.success('Screen sharing started');
    });

    socket.on('screen-share:start-rejected', ({ reason }) => {
      if (reason === 'already-active') {
        toast.error('Someone is already sharing their screen');
      } else {
        toast.error('Unable to start screen sharing');
      }
    });

    socket.on('screen-share:started', ({ sharerSocketId }) => {
      setActiveSharerId(sharerSocketId);
    });

    socket.on('screen-share:stopped', ({ sharerSocketId }) => {
      if (sharerSocketId === socket.id && isScreenSharing) {
        stopScreenShare('server-stopped');
      }
      setActiveSharerId(null);
    });

    // Handle user joined
    socket.on('user-joined', ({ userId, userName, socketId }) => {
      console.log('👤 User joined:', userId, userName, socketId);
      
      // Skip if this is our own join event
      if (socketId === socket.id) {
        console.log(`ℹ️ Ignoring own user-joined event: ${socketId}`);
        return;
      }

      setParticipantNames((prev) => {
        const next = new Map(prev);
        next.set(socketId, userName || userId || `User-${socketId.substring(0, 6)}`);
        return next;
      });
      
      // If we're already in a call and another user joins, create a peer connection with them
      if (hasJoinedRoom) {
        console.log(`🔄 Another user joined (${socketId}), creating peer connection...`);
        // Wait a bit for the new user to set up their event handlers
        setTimeout(() => {
          // Only create connection if we don't already have one with this participant
          const peerConnections = getPeerConnections();
          if (!peerConnections.has(socketId)) {
            console.log(`📞 Creating peer connection with new participant ${socketId}...`);
            startCallWithParticipant(socketId).catch(err => {
              console.error(`❌ Failed to create connection with ${socketId}:`, err);
            });
          } else {
            const pc = peerConnections.get(socketId);
            console.log(`⚠️ Already have peer connection with ${socketId}:`, {
              connectionState: pc.connectionState,
              iceConnectionState: pc.iceConnectionState,
              hasLocalDescription: !!pc.localDescription,
              hasRemoteDescription: !!pc.remoteDescription,
            });
          }
        }, 1000);
      }
    });

    // Handle user left
    socket.on('user-left', ({ socketId }) => {
      console.log('👋 User left:', socketId);
      setParticipantNames((prev) => {
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    });

    // Handle room update
    socket.on('room-update', ({ participantCount, roomId, otherParticipants, participantDetails, activeScreenShare }) => {
      console.log('📊 Room update:', { participantCount, roomId, otherParticipants, participantDetails });
      setParticipantCount(participantCount);
      setActiveSharerId(activeScreenShare?.sharerSocketId || null);
      if (participantDetails && participantDetails.length) {
        setParticipantNames((prev) => {
          const next = new Map(prev);
          participantDetails.forEach((p) => {
            if (p?.socketId && p?.name) next.set(p.socketId, p.name);
          });
          return next;
        });
      }
      
      // Ensure we have peer connections with all participants (safety net)
      if (hasJoinedRoom && otherParticipants && otherParticipants.length > 0) {
        console.log('🔍 Verifying peer connections with all participants...');
        console.log('📋 Other participants:', otherParticipants);
        console.log('📋 Current peer connections:', Array.from(getPeerConnections().keys()));
        
        // Use a longer delay to avoid interfering with initial connection setup
        setTimeout(() => {
          const peerConnections = getPeerConnections();
          // Filter out our own socket ID and participants we already have connections with
          const missingConnections = otherParticipants.filter(
            (participantId) => 
              participantId !== socket.id && // Don't connect to self
              !peerConnections.has(participantId) // Don't create duplicate connections
          );
          
          if (missingConnections.length > 0) {
            console.log(`⚠️ Missing ${missingConnections.length} peer connection(s):`, missingConnections);
            // Create missing connections sequentially
            (async () => {
              for (const participantId of missingConnections) {
                console.log(`📞 Creating missing connection with ${participantId}...`);
                try {
                  await startCallWithParticipant(participantId);
                  // Small delay between connections
                  await new Promise(resolve => setTimeout(resolve, 400));
                } catch (err) {
                  console.error(`❌ Failed to create connection with ${participantId}:`, err);
                }
              }
            })();
          } else {
            console.log('✅ All peer connections exist');
            
            // Even if connections exist, verify they're working and have tracks
            otherParticipants.forEach((participantId) => {
              const pc = peerConnections.get(participantId);
              if (pc) {
                const receivers = pc.getReceivers();
                const tracks = receivers.map(r => r.track).filter(Boolean);
                const videoTracks = tracks.filter(t => t.kind === 'video' && t.readyState === 'live');
                
                console.log(`📊 Participant ${participantId}:`, {
                  connectionState: pc.connectionState,
                  iceConnectionState: pc.iceConnectionState,
                  receivers: receivers.length,
                  tracks: tracks.length,
                  videoTracks: videoTracks.length,
                });
                
                // If connection is established but no video tracks, try to fix it
                if ((pc.connectionState === 'connected' || pc.iceConnectionState === 'connected') && videoTracks.length === 0) {
                  console.warn(`⚠️ Participant ${participantId} has connection but no video tracks, will be fixed by verification`);
                }
              }
            });
          }
        }, 2000); // Reduced delay for faster recovery
      }
    });

    // Handle room joined confirmation
    socket.on('room-joined', ({ roomId, participantCount, otherParticipants, participantDetails, activeScreenShare }) => {
      console.log('✅ Room joined successfully:', { roomId, participantCount, otherParticipants, participantDetails });
      setParticipantCount(participantCount);
      setActiveSharerId(activeScreenShare?.sharerSocketId || null);
      if (participantDetails && participantDetails.length) {
        setParticipantNames((prev) => {
          const next = new Map(prev);
          participantDetails.forEach((p) => {
            if (p?.socketId && p?.name) next.set(p.socketId, p.name);
          });
          return next;
        });
      }
      
      // Reset offer received flag
      offerReceivedRef.current = false;
      
      // Clear any existing timeout
      if (offerTimeoutRef.current) {
        clearTimeout(offerTimeoutRef.current);
        offerTimeoutRef.current = null;
      }
      
      // If there are other participants, create peer connections with all of them
      if (participantCount > 1 && otherParticipants && otherParticipants.length > 0) {
        console.log('👥 Other participants already in room:', otherParticipants);
        console.log('👥 Creating peer connections with all participants...');
        
        // Wait a bit to ensure all participants are ready, then create connections
        offerTimeoutRef.current = setTimeout(() => {
          // Create peer connections with all existing participants
          // Use sequential creation to avoid race conditions
          (async () => {
            for (const participantId of otherParticipants) {
              // Skip if trying to connect to self
              if (participantId === socket.id) {
                console.warn(`⚠️ Skipping self in otherParticipants: ${participantId}`);
                continue;
              }
              
              const peerConnections = getPeerConnections();
              if (!peerConnections.has(participantId)) {
                console.log(`📞 Creating connection with ${participantId}...`);
                await startCallWithParticipant(participantId);
                // Small delay between connections to avoid overwhelming the system
                await new Promise(resolve => setTimeout(resolve, 200));
              } else {
                console.log(`⚠️ Already have connection with ${participantId}, skipping`);
              }
            }
          })();
          offerTimeoutRef.current = null;
        }, 1000);
      } else {
        // We're the first one - wait for others to join
        // The offer will be sent when another user joins (via user-joined event)
        console.log('👤 First participant, waiting for another participant to join...');
        console.log('💡 Will create peer connections when other users join the room');
      }
    });

    // Handle room join error
    socket.on('join-room-error', ({ message }) => {
      console.error('❌ Room join error:', message);
      setError(`Failed to join room: ${message}`);
      setHasJoinedRoom(false);
    });

    // Periodic check for missing connections (especially important for 5+ participants)
    const periodicCheckInterval = setInterval(() => {
      if (hasJoinedRoom && participantCount > 1 && socket) {
        // Request room update to get current participant list
        socket.emit('get-room-info', { roomId });
      }
    }, 5000); // Check every 5 seconds

    return () => {
      socket.off('connect', onConnect);
      if (offerTimeoutRef.current) {
        clearTimeout(offerTimeoutRef.current);
        offerTimeoutRef.current = null;
      }
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('room-update');
      socket.off('room-joined');
      socket.off('join-room-error');
      socket.off('media-state');
      socket.off('screen-share:start-accepted');
      socket.off('screen-share:start-rejected');
      socket.off('screen-share:started');
      socket.off('screen-share:stopped');
      clearInterval(periodicCheckInterval);
    };
  }, [socket, hasJoinedRoom, participantCount, roomId, handleOffer, handleAnswer, handleIceCandidate, startCallWithParticipant, getPeerConnections, startScreenShare, stopScreenShare, isScreenSharing, user?._id, user?.name, localUserId, endCall, updateRemoteMediaState]);

  // Display errors
  useEffect(() => {
    if (socketError) {
      setError(`Connection error: ${socketError}`);
    } else if (webrtcError) {
      setError(`WebRTC error: ${webrtcError}`);
    }
  }, [socketError, webrtcError]);

  // Keep server lock in sync when local sharing ends unexpectedly (e.g., browser stop share button)
  useEffect(() => {
    if (!socket || !roomId) {
      wasScreenSharingRef.current = isScreenSharing;
      return;
    }

    const wasScreenSharing = wasScreenSharingRef.current;
    const didStopScreenShare = wasScreenSharing && !isScreenSharing;

    if (activeSharerId === socket.id && didStopScreenShare) {
      socket.emit('screen-share:stop', { roomId, reason: 'track-ended' });
      setActiveSharerId(null);
    }
    wasScreenSharingRef.current = isScreenSharing;
  }, [socket, roomId, activeSharerId, isScreenSharing]);

  // Generate random room ID
  const generateRoomId = () => {
    const id = Math.random().toString(36).substr(2, 9);
    setRoomId(id);
  };

  // Check for roomid query parameter and auto-join
  useEffect(() => {
    const roomIdParam = searchParams.get('roomid');
    if (roomIdParam && !hasJoinedRoom && socket && isConnected) {
      const normalizedRoomId = normalizeRoomId(roomIdParam);
      setRoomId(normalizedRoomId);
      // Small delay to ensure state is updated
      setTimeout(() => {
        handleJoinRoom(normalizedRoomId);
      }, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, socket, isConnected, hasJoinedRoom]);

  // Generate shareable link
  const getShareableLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/call?roomid=${roomId}`;
  };

  // Share room link
  const handleShareRoom = async () => {
    const shareLink = getShareableLink();
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join my video call',
          text: `Join my video call room: ${roomId}`,
          url: shareLink,
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareLink);
        toast.success('Room link copied to clipboard!');
      }
    } catch (error) {
      // User cancelled share or error occurred, fallback to clipboard
      if (error.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(shareLink);
          toast.success('Room link copied to clipboard!');
        } catch (clipboardError) {
          toast.error('Failed to copy link');
        }
      }
    }
  };

  // Check browser support
  const [browserSupport, setBrowserSupport] = useState({
    getUserMedia: isGetUserMediaSupported(),
    secureContext: isSecureContext(),
  });

  useEffect(() => {
    setBrowserSupport({
      getUserMedia: isGetUserMediaSupported(),
      secureContext: isSecureContext(),
    });
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleViewport = (event) => setIsMobileView(event.matches);
    setIsMobileView(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleViewport);
    return () => mediaQuery.removeEventListener('change', handleViewport);
  }, []);

  if (!hasJoinedRoom) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Join Video Call</CardTitle>
            <CardDescription>
              Enter a room ID to join or create a new room
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Browser support warnings */}
            {!browserSupport.secureContext && (
              <div className="p-3 bg-yellow-500/10 text-yellow-600 text-sm rounded-md border border-yellow-500/20">
                <p className="font-semibold mb-1">⚠️ Secure Context Required</p>
                <p className="text-xs">
                  WebRTC requires HTTPS or localhost. You're accessing via HTTP from a network IP.
                  For best results, access via <code className="bg-yellow-500/20 px-1 rounded">localhost:5173</code> or set up HTTPS.
                </p>
              </div>
            )}

            {!browserSupport.getUserMedia && (
              <div className="p-3 bg-red-500/10 text-red-600 text-sm rounded-md border border-red-500/20">
                <p className="font-semibold mb-1">❌ Browser Not Supported</p>
                <p className="text-xs">
                  Your browser doesn't support getUserMedia. Please use Chrome, Firefox, or Edge.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="roomId">Room ID</Label>
              <div className="flex gap-2">
                <Input
                  id="roomId"
                  placeholder="Enter room ID (e.g., 1, room1)"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
                  onBlur={(e) => {
                    // Normalize on blur to show user the actual room ID
                    const normalized = normalizeRoomId(e.target.value);
                    if (normalized && normalized !== e.target.value) {
                      setRoomId(normalized);
                    }
                  }}
                />
                <Button variant="outline" onClick={generateRoomId} title="Generate random room ID">
                  🎲
                </Button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                {error}
              </div>
            )}

            {socketError && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                <p className="font-semibold">Connection Error:</p>
                <p className="text-xs mt-1">{socketError}</p>
                <p className="text-xs mt-2 text-muted-foreground">
                  Make sure the server is running on port 3001
                </p>
              </div>
            )}

            {!isConnected && !socketError && (
              <div className="p-3 bg-yellow-500/10 text-yellow-600 text-sm rounded-md flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                Connecting to server...
              </div>
            )}

            {isConnected && (
              <div className="p-3 bg-green-500/10 text-green-600 text-sm rounded-md flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Connected to server
              </div>
            )}

            {/* Debug info */}
            {import.meta.env.DEV && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">Debug Info</summary>
                <div className="mt-2 space-y-1 p-2 bg-muted rounded">
                  <p>Socket URL: {socket?.io?.uri || window.location.hostname + ':3001'}</p>
                  <p>Connection Status: {isConnected ? '✅ Connected' : '❌ Disconnected'}</p>
                  <p>Socket ID: {socket?.id || 'N/A'}</p>
                  {socket?.io?.engine && (
                    <p>Transport: {socket.io.engine.transport.name}</p>
                  )}
                </div>
              </details>
            )}

            <Button
              onClick={handleJoinRoom}
              disabled={!isConnected || !roomId.trim()}
              className="w-full"
              size="lg"
            >
              {isConnected ? 'Join Room' : 'Connecting...'}
            </Button>
          </CardContent>
        </Card>
        </div>
      </div>
    );
  }

  const showMainHeader = !(hasJoinedRoom && isMobileView);
  const videoAreaHeight = showMainHeader ? 'calc(100vh - 9.5rem)' : 'calc(100vh - 7rem)';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {showMainHeader && <Header hideNavigation={hasJoinedRoom} />}
      <div className={cn(
            'w-full border-b rounded-lg bg-card p-3',
            isMobileView ? 'flex flex-col gap-3' : 'grid grid-cols-[1fr_auto] items-center gap-3'
          )}>
            <div className="min-w-0">
              <div className="text-lg md:text-xl flex items-center gap-2 font-bold truncate">
                <span className="truncate">Room: {roomId}</span>
                <button
                  className="cursor-pointer hover:bg-gray-200 rounded-full p-2 transition-all duration-300 shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(roomId);
                    toast.success('Room ID copied to clipboard');
                  }}
                  title="Copy room ID"
                >
                  <LuCopy className="w-4 h-4 text-muted-foreground hover:text-gray-900" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                {participantCount} participant{participantCount !== 1 ? 's' : ''} in room
              </p>
            </div>

            <div className="w-full md:w-auto">
              <Controls
                isVideoEnabled={isVideoEnabled}
                isAudioEnabled={isAudioEnabled}
                isScreenSharing={isScreenSharing}
                canShareScreen={!activeSharerId || activeSharerId === socket?.id}
                screenShareMessage={activeSharerId && activeSharerId !== socket?.id ? 'Someone else is sharing' : undefined}
                onToggleVideo={toggleVideo}
                onToggleAudio={toggleAudio}
                onToggleScreenShare={handleToggleScreenShare}
                onShareRoom={handleShareRoom}
                onLeaveRoom={handleLeaveRoom}
                connectionState={Array.from(connectionStates.values()).some(state => state === 'connected') ? 'connected' : Array.from(connectionStates.values()).some(state => state === 'connecting') ? 'connecting' : 'disconnected'}
                isMobileView={isMobileView}
              />
            </div>
          </div>
      <div className="flex-1 p-4">
        
        <div className="mx-auto px-5 flex flex-col gap-3" style={{ height: videoAreaHeight }}>
          {/* Sub Top Bar */}
          

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
            {error}
          </div>
        )}

        {/* Video Grid - Dynamic based on participant count */}
        {(() => {
          const totalParticipants = participantCount;
          
          // Get all known participant IDs from connection states and remote streams
          const allKnownParticipantIds = new Set([
            ...Array.from(connectionStates.keys()),
            ...Array.from(remoteStreams.keys()),
          ]);
          
          // Create participants array - include local + all known remote participants
          // This ensures we show all participants even if they don't have streams yet
          const allParticipants = [
            { id: socket?.id || localUserId, stream: localStream, isLocal: true, displayName: 'You' },
            ...Array.from(allKnownParticipantIds).map((id) => ({
              id,
              stream: remoteStreams.get(id) || null, // null if no stream yet
              isLocal: false,
              displayName: participantNames.get(id) || `User-${id.substring(0, 6)}`,
            }))
          ];
          
          // Sort participants to ensure consistent ordering (local first, then by ID)
          allParticipants.sort((a, b) => {
            if (a.isLocal) return -1;
            if (b.isLocal) return 1;
            return a.id.localeCompare(b.id);
          });

          // Calculate optimal grid layout based on participant count
          const calculateGridLayout = (count) => {
            if (count === 1) {
              return { rows: 1, cols: 1, layout: [[1]] };
            } else if (count === 2) {
              return { rows: 1, cols: 2, layout: [[2]] };
            } else if (count === 3) {
              return { rows: 1, cols: 3, layout: [[3]] };
            } else if (count === 4) {
              return { rows: 2, cols: 2, layout: [[2], [2]] };
            } else if (count === 5) {
              return { rows: 2, cols: 3, layout: [[3], [2]] }; // 3 in first row, 2 centered in second
            } else if (count === 6) {
              return { rows: 2, cols: 3, layout: [[3], [3]] }; // 3:3
            } else if (count === 7) {
              return { rows: 2, cols: 4, layout: [[4], [3]] }; // 4:3
            } else if (count === 8) {
              return { rows: 2, cols: 4, layout: [[4], [4]] }; // 4:4
            } else if (count === 9) {
              return { rows: 3, cols: 3, layout: [[3], [3], [3]] }; // 3:3:3
            } else {
              // For 10+ participants, calculate optimal layout
              // Try to make it as square as possible
              const sqrt = Math.sqrt(count);
              const cols = Math.ceil(sqrt);
              const rows = Math.ceil(count / cols);
              
              // Distribute participants across rows
              const layout = [];
              let remaining = count;
              for (let i = 0; i < rows; i++) {
                const itemsInRow = Math.min(cols, remaining);
                layout.push([itemsInRow]);
                remaining -= itemsInRow;
              }
              
              return { rows, cols, layout };
            }
          };

          const gridConfig = calculateGridLayout(totalParticipants);
          
          // Render participants in grid rows
          const renderGridRows = () => {
            if (isMobileView) {
              return [
                <div
                  key="mobile-grid"
                  className="grid gap-4 w-full"
                  style={{ gridTemplateColumns: '1fr' }}
                >
                  {allParticipants.map((participant) => {
                    const mediaState = participant.isLocal
                      ? { videoEnabled: isVideoEnabled, audioEnabled: isAudioEnabled }
                      : remoteMediaStates.get(participant.id) || { videoEnabled: true, audioEnabled: true };
                    const connectionState = participant.isLocal
                      ? 'connected'
                      : connectionStates.get(participant.id) || 'disconnected';

                    return (
                      <div key={participant.id} className="relative w-full aspect-video rounded-lg overflow-hidden">
                        <VideoPlayer
                          stream={participant.stream}
                          isLocal={participant.isLocal}
                          isVideoEnabled={mediaState.videoEnabled}
                          isAudioEnabled={mediaState.audioEnabled}
                          className="h-full w-full"
                        />
                        {!participant.stream && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg">
                            <div className="text-center text-white">
                              <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                              <p className="text-sm">
                                {participant.isLocal ? 'Initializing camera...' : 'Waiting for video...'}
                              </p>
                            </div>
                          </div>
                        )}
                        {participant.isLocal && (
                          <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-10">
                            You
                          </div>
                        )}
                        {!participant.isLocal && (
                          <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-10">
                            {connectionState === 'connected' ? '✓' : '⏳'} {participantNames.get(participant.id) || `User-${participant.id.substring(0, 6)}`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>,
              ];
            }

            const rows = [];
            let participantIndex = 0;
            
            for (let rowIndex = 0; rowIndex < gridConfig.layout.length; rowIndex++) {
              const itemsInRow = gridConfig.layout[rowIndex][0];
              const rowParticipants = allParticipants.slice(participantIndex, participantIndex + itemsInRow);
              participantIndex += itemsInRow;
              
              rows.push(
                <div
                  key={rowIndex}
                  className="grid gap-4 w-full"
                  style={{
                    gridTemplateColumns: `repeat(${itemsInRow}, 1fr)`,
                    maxWidth: '100%',
                    margin: '0',
                  }}
                >
                  {rowParticipants.map((participant) => {
                    const mediaState = participant.isLocal
                      ? { videoEnabled: isVideoEnabled, audioEnabled: isAudioEnabled }
                      : remoteMediaStates.get(participant.id) || { videoEnabled: true, audioEnabled: true };
                    const connectionState = participant.isLocal
                      ? 'connected'
                      : connectionStates.get(participant.id) || 'disconnected';
                    
                    return (
                      <div key={participant.id} className="relative w-full aspect-video rounded-lg overflow-hidden">
                        <VideoPlayer
                          stream={participant.stream}
                          isLocal={participant.isLocal}
                          isVideoEnabled={mediaState.videoEnabled}
                          isAudioEnabled={mediaState.audioEnabled}
                          className="h-full w-full"
                        />
                        {!participant.stream && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg">
                            <div className="text-center text-white">
                              <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                              <p className="text-sm">
                                {participant.isLocal ? 'Initializing camera...' : 'Waiting for video...'}
                              </p>
                            </div>
                          </div>
                        )}
                        {participant.isLocal && (
                          <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-10">
                            You
                          </div>
                        )}
                        {!participant.isLocal && (
                          <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-10">
                            {connectionState === 'connected' ? '✓' : '⏳'} {participantNames.get(participant.id) || `User-${participant.id.substring(0, 6)}`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Placeholder for missing participants in this row */}
                  {rowParticipants.length < itemsInRow && (
                    Array.from({ length: itemsInRow - rowParticipants.length }).map((_, i) => (
                      <div
                        key={`placeholder-${rowIndex}-${i}`}
                        className="w-full aspect-video bg-gray-900 rounded-lg flex items-center justify-center"
                      >
                        <p className="text-muted-foreground text-sm">Waiting...</p>
                      </div>
                    ))
                  )}
                </div>
              );
            }
            
            return rows;
          };
          
          const sharerParticipant = activeSharerId
            ? allParticipants.find((participant) => participant.id === activeSharerId)
            : null;
          const shouldShowShareStage = !!sharerParticipant;

          return (
            <div 
              className="flex-1 flex flex-col justify-center gap-4 min-h-0"
              style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}
            >
              {shouldShowShareStage ? (
                <div className={`flex h-full gap-4 ${isMobileView ? 'flex-col' : 'flex-row'}`}>
                  <div className="flex-1 flex items-start justify-center">
                    <div className="relative w-full max-h-full aspect-video rounded-lg border-2 border-primary overflow-hidden bg-black">
                      <VideoPlayer
                        stream={sharerParticipant.stream}
                        isLocal={sharerParticipant.isLocal}
                        isVideoEnabled={sharerParticipant.isLocal ? isVideoEnabled : (remoteMediaStates.get(sharerParticipant.id)?.videoEnabled ?? true)}
                        isAudioEnabled={sharerParticipant.isLocal ? isAudioEnabled : (remoteMediaStates.get(sharerParticipant.id)?.audioEnabled ?? true)}
                        className="h-full w-full"
                      />
                      <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded z-10">
                        {sharerParticipant.isLocal ? 'You (Presenting)' : `${sharerParticipant.displayName} (Presenting)`}
                      </div>
                    </div>
                  </div>
                  <div className={`${isMobileView ? 'w-full overflow-x-auto flex-row' : 'w-[200px] h-full overflow-y-auto flex-col'} shrink-0 flex gap-3`}>
                    {allParticipants.map((participant) => {
                      const mediaState = participant.isLocal
                        ? { videoEnabled: isVideoEnabled, audioEnabled: isAudioEnabled }
                        : remoteMediaStates.get(participant.id) || { videoEnabled: true, audioEnabled: true };
                      const isPresenter = participant.id === sharerParticipant.id;
                      return (
                        <div
                          key={`thumb-${participant.id}`}
                          className={`relative ${isMobileView ? 'w-[160px] shrink-0' : 'w-[200px]'} aspect-video rounded-lg overflow-hidden border ${
                            isPresenter ? 'border-primary' : 'border-gray-400'
                          }`}
                        >
                          <VideoPlayer
                            stream={participant.stream}
                            isLocal={participant.isLocal}
                            isVideoEnabled={mediaState.videoEnabled}
                            isAudioEnabled={mediaState.audioEnabled}
                            className="h-full w-full"
                          />
                          <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-10">
                            {participant.displayName}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                renderGridRows()
              )}
              
              {/* Show message if we're waiting for more participants */}
              {participantCount > allParticipants.length && (
                <div className="text-center text-muted-foreground text-sm py-2 flex-shrink-0">
                  Waiting for {participantCount - allParticipants.length} more participant(s)...
                </div>
              )}
            </div>
          );
        })()}

        </div>
      </div>
    </div>
  );
}
