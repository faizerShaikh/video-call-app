import { useState, useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useWebRTC } from '@/hooks/useWebRTC';
import { VideoPlayer } from './VideoPlayer';
import { Controls } from './Controls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { isGetUserMediaSupported, isSecureContext } from '@/utils/webrtc';
import { LuCopy } from 'react-icons/lu';
import { toast } from 'sonner';

export function VideoCall() {
  const [roomId, setRoomId] = useState('');
  const [localUserId] = useState(() => `user-${Math.random().toString(36).substr(2, 9)}`);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [error, setError] = useState(null);
  const [activeRooms, setActiveRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  const { socket, isConnected, error: socketError } = useSocket();
  const {
    localStream,
    remoteStreams, // Map<socketId, MediaStream>
    isVideoEnabled,
    isAudioEnabled,
    remoteMediaStates, // Map<socketId, {videoEnabled, audioEnabled}>
    connectionStates, // Map<socketId, connectionState>
    error: webrtcError,
    startCall,
    startCallWithParticipant,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    toggleVideo,
    toggleAudio,
    endCall,
    removeParticipant,
    initializeLocalStream,
    resendOffer,
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
      console.log('🚪 Joining room:', normalizedRoomId);
      socket.emit('join-room', { roomId: normalizedRoomId, userId: localUserId });
      setHasJoinedRoom(true);

      // Don't start call here - wait for room-joined event which tells us
      // if there are other participants. The room-joined handler will decide
      // whether to create an offer or wait for one.
    } catch (err) {
      console.error('Error joining room:', err);
      setError(err.message || 'Failed to join room');
    }
  };

  // Leave room
  const handleLeaveRoom = () => {
    if (socket && roomId) {
      socket.emit('leave-room', { roomId });
    }
    endCall();
    setHasJoinedRoom(false);
    setRoomId('');
    setParticipantCount(0);
    setError(null);
  };

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;
    
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

    // Handle user joined
    socket.on('user-joined', ({ userId, socketId }) => {
      console.log('👤 User joined:', userId, socketId);
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
    });

    // Handle room update
    socket.on('room-update', ({ participantCount, roomId, otherParticipants }) => {
      console.log('📊 Room update:', { participantCount, roomId, otherParticipants });
      setParticipantCount(participantCount);
      
      // Ensure we have peer connections with all participants (safety net)
      if (hasJoinedRoom && otherParticipants && otherParticipants.length > 0) {
        console.log('🔍 Verifying peer connections with all participants...');
        console.log('📋 Other participants:', otherParticipants);
        console.log('📋 Current peer connections:', Array.from(getPeerConnections().keys()));
        
        // Use a longer delay to avoid interfering with initial connection setup
        setTimeout(() => {
          const peerConnections = getPeerConnections();
          const missingConnections = otherParticipants.filter(
            (participantId) => !peerConnections.has(participantId)
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
    socket.on('room-joined', ({ roomId, participantCount, otherParticipants }) => {
      console.log('✅ Room joined successfully:', { roomId, participantCount, otherParticipants });
      setParticipantCount(participantCount);
      
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

    // Cleanup on unmount
    return () => {
      // Clear any pending timeouts
      if (offerTimeoutRef.current) {
        clearTimeout(offerTimeoutRef.current);
        offerTimeoutRef.current = null;
      }
      
      // Remove all event listeners
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('room-update');
      socket.off('room-joined');
      socket.off('join-room-error');
      socket.off('media-state');
    };

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
      clearInterval(periodicCheckInterval);
    };
  }, [socket, hasJoinedRoom, participantCount, roomId, handleOffer, handleAnswer, handleIceCandidate, startCallWithParticipant, getPeerConnections]);

  // Display errors
  useEffect(() => {
    if (socketError) {
      setError(`Connection error: ${socketError}`);
    } else if (webrtcError) {
      setError(`WebRTC error: ${webrtcError}`);
    }
  }, [socketError, webrtcError]);

  // Generate random room ID
  const generateRoomId = () => {
    const id = Math.random().toString(36).substr(2, 9);
    setRoomId(id);
  };

  // Fetch active rooms
  const fetchActiveRooms = async () => {
    if (!socket || !isConnected) return;
    
    setLoadingRooms(true);
    try {
      // Request active rooms via socket
      socket.emit('get-active-rooms');
    } catch (err) {
      console.error('Error fetching active rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  // Get server URL for API calls
  const getServerUrl = () => {
    if (import.meta.env.VITE_SOCKET_URL) {
      return import.meta.env.VITE_SOCKET_URL;
    }
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    return `${protocol}//${hostname}:3001`;
  };

  // Fetch active rooms on mount and when socket connects
  useEffect(() => {
    if (socket && isConnected && !hasJoinedRoom) {
      fetchActiveRooms();
      // Also set up listener for active rooms response
      socket.on('active-rooms', (rooms) => {
        console.log('📋 Active rooms received:', rooms);
        setActiveRooms(rooms);
      });

      // Refresh active rooms periodically
      const interval = setInterval(() => {
        if (!hasJoinedRoom) {
          fetchActiveRooms();
        }
      }, 5000); // Refresh every 5 seconds

      return () => {
        socket.off('active-rooms');
        clearInterval(interval);
      };
    }
  }, [socket, isConnected, hasJoinedRoom]);

  // Join room from active rooms list
  const joinActiveRoom = (roomIdToJoin) => {
    setRoomId(roomIdToJoin);
    // Small delay to ensure state is updated
    setTimeout(() => {
      handleJoinRoom(roomIdToJoin);
    }, 100);
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

  if (!hasJoinedRoom) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
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

            {/* Active Rooms */}
            {isConnected && activeRooms.length > 0 && (
              <div className="space-y-2">
                <Label>Active Rooms</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {activeRooms.map((room) => (
                    <button
                      key={room.roomId}
                      onClick={() => joinActiveRoom(room.roomId)}
                      className="w-full p-3 text-left bg-muted hover:bg-muted/80 rounded-md border border-border transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">Room: {room.roomId}</p>
                          <p className="text-xs text-muted-foreground">
                            {room.participantCount} participant{room.participantCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" className="ml-2">
                          Join →
                        </Button>
                      </div>
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchActiveRooms}
                  disabled={loadingRooms}
                  className="w-full"
                >
                  {loadingRooms ? 'Refreshing...' : '🔄 Refresh'}
                </Button>
              </div>
            )}

            {isConnected && activeRooms.length === 0 && (
              <div className="p-3 bg-muted/50 text-muted-foreground text-sm rounded-md text-center">
                No active rooms. Create a new room to start!
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
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-7xl h-[calc(100vh-2rem)] flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl flex justify-start items-center  gap-1 font-bold">Room: {roomId}
              <div className="cursor-pointer ml-2 hover:bg-gray-200 rounded-full p-2 transition-all duration-300" onClick={() => {
                navigator.clipboard.writeText(roomId);
                toast.success('Room ID copied to clipboard');
              }}>
                <LuCopy className="w-4 h-4 text-muted-foreground hover:text-gray-900" />
              </div>
            </h1>
            <p className="text-sm text-muted-foreground">
              {participantCount} participant{participantCount !== 1 ? 's' : ''} in room
            </p>
          </div>
          <Button variant="outline" onClick={handleLeaveRoom}>
            Leave Room
          </Button>
        </div>

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
            { id: localUserId, stream: localStream, isLocal: true },
            ...Array.from(allKnownParticipantIds).map((id) => ({
              id,
              stream: remoteStreams.get(id) || null, // null if no stream yet
              isLocal: false,
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
            const rows = [];
            let participantIndex = 0;
            const numRows = gridConfig.rows;
            const gapSize = 16; // gap-4 = 1rem = 16px
            
            for (let rowIndex = 0; rowIndex < gridConfig.layout.length; rowIndex++) {
              const itemsInRow = gridConfig.layout[rowIndex][0];
              const rowParticipants = allParticipants.slice(participantIndex, participantIndex + itemsInRow);
              participantIndex += itemsInRow;
              
              // Calculate if this row needs centering (for rows with fewer items)
              const needsCentering = itemsInRow < gridConfig.cols;
              
              // Calculate height per row: (100% - gaps) / number of rows
              const totalGapHeight = (numRows - 1) * gapSize;
              const rowHeight = `calc((100% - ${totalGapHeight}px) / ${numRows})`;
              
              rows.push(
                <div
                  key={rowIndex}
                  className="grid gap-4 w-full"
                  style={{
                    gridTemplateColumns: `repeat(${itemsInRow}, 1fr)`,
                    maxWidth: needsCentering ? `${(itemsInRow / gridConfig.cols) * 100}%` : '100%',
                    margin: needsCentering ? '0 auto' : '0',
                    height: rowHeight,
                    minHeight: rowHeight,
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
                      <div key={participant.id} className="relative w-full h-full">
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
                            {connectionState === 'connected' ? '✓' : '⏳'} {participant.id.substring(0, 8)}
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
                        className="w-full h-full bg-gray-900 rounded-lg flex items-center justify-center"
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
          
          return (
            <div 
              className="flex-1 flex flex-col gap-4"
              style={{ height: '100%', overflow: 'hidden' }}
            >
              {renderGridRows()}
              
              {/* Show message if we're waiting for more participants */}
              {participantCount > allParticipants.length && (
                <div className="text-center text-muted-foreground text-sm py-2 flex-shrink-0">
                  Waiting for {participantCount - allParticipants.length} more participant(s)...
                </div>
              )}
            </div>
          );
        })()}

        {/* Controls */}
        <Controls
          isVideoEnabled={isVideoEnabled}
          isAudioEnabled={isAudioEnabled}
          onToggleVideo={toggleVideo}
          onToggleAudio={toggleAudio}
          onEndCall={handleLeaveRoom}
          connectionState={Array.from(connectionStates.values()).some(state => state === 'connected') ? 'connected' : Array.from(connectionStates.values()).some(state => state === 'connecting') ? 'connecting' : 'disconnected'}
          participantCount={participantCount}
        />
      </div>
    </div>
  );
}

