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

export function VideoCall() {
  const [roomId, setRoomId] = useState('');
  const [localUserId] = useState(() => `user-${Math.random().toString(36).substr(2, 9)}`);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [error, setError] = useState(null);

  const { socket, isConnected, error: socketError } = useSocket();
  const {
    localStream,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    connectionState,
    error: webrtcError,
    startCall,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    toggleVideo,
    toggleAudio,
    endCall,
    initializeLocalStream,
  } = useWebRTC(socket, roomId, localUserId);

  // Normalize room ID (trim and lowercase for consistency)
  const normalizeRoomId = (id) => {
    return id.trim().toLowerCase();
  };

  // Join room
  const handleJoinRoom = async () => {
    const normalizedRoomId = normalizeRoomId(roomId);
    
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

      // Start call after a delay to ensure room join is processed
      // Also wait a bit longer to see if there are other participants
      setTimeout(() => {
        console.log('📞 Starting call in room:', normalizedRoomId);
        startCall();
      }, 1000);
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

    // Handle incoming offer
    socket.on('offer', ({ offer, from }) => {
      console.log('📥 Received offer from:', from);
      handleOffer(offer, from);
    });

    // Handle incoming answer
    socket.on('answer', ({ answer }) => {
      console.log('📥 Received answer');
      handleAnswer(answer);
    });

    // Handle ICE candidate
    socket.on('ice-candidate', ({ candidate, from }) => {
      console.log('🧊 Received ICE candidate from:', from);
      handleIceCandidate(candidate);
    });

    // Handle user joined
    socket.on('user-joined', ({ userId, socketId }) => {
      console.log('👤 User joined:', userId, socketId);
      // If we're already in a call and another user joins, we might need to restart
      // But only if we don't have a remote stream yet and connection is not established
      if (hasJoinedRoom && !remoteStream && connectionState !== 'connected') {
        console.log('🔄 Another user joined, but no remote stream yet. Starting call...');
        setTimeout(() => {
          startCall();
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
    });

    // Handle room joined confirmation
    socket.on('room-joined', ({ roomId, participantCount, otherParticipants }) => {
      console.log('✅ Room joined successfully:', { roomId, participantCount, otherParticipants });
      setParticipantCount(participantCount);
    });

    // Handle room join error
    socket.on('join-room-error', ({ message }) => {
      console.error('❌ Room join error:', message);
      setError(`Failed to join room: ${message}`);
      setHasJoinedRoom(false);
    });

    return () => {
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('room-update');
      socket.off('room-joined');
      socket.off('join-room-error');
    };
  }, [socket, handleOffer, handleAnswer, handleIceCandidate]);

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
            <h1 className="text-2xl font-bold">Room: {roomId}</h1>
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

        {/* Video Grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Local Video */}
          <div className="relative">
            <VideoPlayer
              stream={localStream}
              isLocal
              className="h-full min-h-[300px]"
            />
            {!localStream && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg">
                <div className="text-center text-white">
                  <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-sm">Initializing camera...</p>
                </div>
              </div>
            )}
          </div>

          {/* Remote Video */}
          <div className="relative">
            <VideoPlayer
              stream={remoteStream}
              isLocal={false}
              muted={false}
              className="h-full min-h-[300px]"
            />
            {!remoteStream && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg">
                <div className="text-center text-white">
                  <p className="text-sm">Waiting for other participant...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <Controls
          isVideoEnabled={isVideoEnabled}
          isAudioEnabled={isAudioEnabled}
          onToggleVideo={toggleVideo}
          onToggleAudio={toggleAudio}
          onEndCall={handleLeaveRoom}
          connectionState={connectionState}
        />
      </div>
    </div>
  );
}

