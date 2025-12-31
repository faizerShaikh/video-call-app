import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createPeerConnection,
  addStreamToPeerConnection,
  createOffer,
  createAnswer,
  setRemoteDescription,
  addIceCandidate,
  stopStream,
  getUserMedia,
} from '@/utils/webrtc';

export function useWebRTC(socket, roomId, localUserId) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [error, setError] = useState(null);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  // Initialize local stream
  const initializeLocalStream = useCallback(async () => {
    try {
      const stream = await getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setError(null);
      return stream;
    } catch (err) {
      console.error('Error initializing local stream:', err);
      setError(err.message || 'Failed to access camera/microphone');
      throw err;
    }
  }, []);

  // Create peer connection
  const createPeerConnectionInstance = useCallback(() => {
    const pc = createPeerConnection();

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('📹 Received remote track');
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
        setRemoteStream(event.streams[0]);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      setConnectionState(pc.connectionState);
    };

    // Handle ICE candidate
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', {
          candidate: event.candidate,
          roomId,
          targetId: null, // Will be set by server
        });
      }
    };

    // Handle ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        setError('Connection failed. Please try again.');
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [socket, roomId]);

  // Start call (create offer)
  const startCall = useCallback(async () => {
    try {
      if (!socket || !roomId) {
        throw new Error('Socket or room ID not available');
      }

      // Don't create multiple peer connections
      if (peerConnectionRef.current) {
        console.log('Peer connection already exists');
        return;
      }

      // Initialize local stream if not already done
      if (!localStreamRef.current) {
        await initializeLocalStream();
      }

      // Create peer connection
      const pc = createPeerConnectionInstance();

      // Add local stream to peer connection
      if (localStreamRef.current) {
        addStreamToPeerConnection(pc, localStreamRef.current);
      }

      // Create and send offer
      const offer = await createOffer(pc);
      socket.emit('offer', {
        offer,
        roomId,
        targetId: null, // Server will handle routing
      });

      setConnectionState('connecting');
    } catch (err) {
      console.error('Error starting call:', err);
      setError(err.message || 'Failed to start call');
    }
  }, [socket, roomId, initializeLocalStream, createPeerConnectionInstance]);

  // Handle incoming offer
  const handleOffer = useCallback(async (offer, from) => {
    try {
      // If we already have a peer connection, don't create a new one
      if (peerConnectionRef.current) {
        console.log('Already have peer connection, ignoring offer');
        return;
      }

      if (!localStreamRef.current) {
        await initializeLocalStream();
      }

      const pc = createPeerConnectionInstance();

      if (localStreamRef.current) {
        addStreamToPeerConnection(pc, localStreamRef.current);
      }

      const answer = await createAnswer(pc, offer);
      socket.emit('answer', {
        answer,
        roomId,
        targetId: from,
      });

      setConnectionState('connecting');
    } catch (err) {
      console.error('Error handling offer:', err);
      setError(err.message || 'Failed to handle offer');
    }
  }, [socket, roomId, initializeLocalStream, createPeerConnectionInstance]);

  // Handle incoming answer
  const handleAnswer = useCallback(async (answer) => {
    try {
      if (peerConnectionRef.current) {
        await setRemoteDescription(peerConnectionRef.current, answer);
      }
    } catch (err) {
      console.error('Error handling answer:', err);
      setError(err.message || 'Failed to handle answer');
    }
  }, []);

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (candidate) => {
    try {
      if (peerConnectionRef.current) {
        await addIceCandidate(peerConnectionRef.current, candidate);
      }
    } catch (err) {
      console.error('Error handling ICE candidate:', err);
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, []);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, []);

  // End call
  const endCall = useCallback(() => {
    // Stop local stream
    if (localStreamRef.current) {
      stopStream(localStreamRef.current);
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clear remote stream
    remoteStreamRef.current = null;
    setRemoteStream(null);
    setConnectionState('disconnected');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  return {
    localStream,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    connectionState,
    error,
    startCall,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    toggleVideo,
    toggleAudio,
    endCall,
    initializeLocalStream,
  };
}

