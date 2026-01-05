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
  const iceCandidateQueueRef = useRef([]); // Queue for ICE candidates received before remote description is set

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
      console.log('📹 Received remote track', event);
      console.log('📹 Track streams:', event.streams);
      console.log('📹 Track:', event.track);
      
      // Handle both event.streams and event.track
      if (event.streams && event.streams.length > 0) {
        const stream = event.streams[0];
        console.log('✅ Setting remote stream from event.streams[0]');
        remoteStreamRef.current = stream;
        setRemoteStream(stream);
      } else if (event.track) {
        // Fallback: create a stream from the track
        console.log('✅ Creating stream from track');
        const stream = new MediaStream([event.track]);
        remoteStreamRef.current = stream;
        setRemoteStream(stream);
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

  // Process queued ICE candidates
  const processIceCandidateQueue = useCallback(async () => {
    if (!peerConnectionRef.current || iceCandidateQueueRef.current.length === 0) {
      return;
    }

    const pc = peerConnectionRef.current;
    
    // Check if remote description is set
    if (!pc.remoteDescription) {
      console.log('⏳ Remote description not set yet, keeping candidates in queue');
      return;
    }

    console.log(`📦 Processing ${iceCandidateQueueRef.current.length} queued ICE candidates`);
    
    // Process all queued candidates
    while (iceCandidateQueueRef.current.length > 0) {
      const candidate = iceCandidateQueueRef.current.shift();
      try {
        if (candidate && pc.remoteDescription) {
          await addIceCandidate(pc, candidate);
          console.log('✅ Added queued ICE candidate');
        }
      } catch (err) {
        console.error('Error adding queued ICE candidate:', err);
        // Don't throw, just log - some candidates might be invalid
      }
    }
  }, []);

  // Start call (create offer)
  const startCall = useCallback(async () => {
    try {
      if (!socket || !roomId) {
        throw new Error('Socket or room ID not available');
      }

      // Don't create multiple peer connections
      if (peerConnectionRef.current) {
        console.log('⚠️ Peer connection already exists, skipping startCall');
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
        console.log('✅ Added local stream to peer connection');
      }

      // Create and send offer
      console.log('📤 Creating and sending offer...');
      const offer = await createOffer(pc);
      socket.emit('offer', {
        offer,
        roomId,
        targetId: null, // Server will handle routing
      });
      console.log('✅ Offer sent');

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
        console.log('⚠️ Already have peer connection, ignoring offer');
        return;
      }

      console.log('📥 Handling incoming offer from:', from);

      if (!localStreamRef.current) {
        await initializeLocalStream();
      }

      const pc = createPeerConnectionInstance();
      console.log('✅ Created peer connection for offer');

      if (localStreamRef.current) {
        addStreamToPeerConnection(pc, localStreamRef.current);
        console.log('✅ Added local stream to peer connection');
      }

      // createAnswer will set the remote description, so we don't need to do it here
      // But we need to process queued candidates after createAnswer sets it
      console.log('📤 Creating answer...');
      const answer = await createAnswer(pc, offer);
      console.log('✅ Answer created, remote description set');
      
      // Process any queued ICE candidates now that remote description is set
      await processIceCandidateQueue();
      
      console.log('📤 Sending answer to:', from);
      socket.emit('answer', {
        answer,
        roomId,
        targetId: from,
      });
      console.log('✅ Answer sent');

      setConnectionState('connecting');
    } catch (err) {
      console.error('Error handling offer:', err);
      setError(err.message || 'Failed to handle offer');
    }
  }, [socket, roomId, initializeLocalStream, createPeerConnectionInstance, processIceCandidateQueue]);

  // Handle incoming answer
  const handleAnswer = useCallback(async (answer) => {
    try {
      if (peerConnectionRef.current) {
        await setRemoteDescription(peerConnectionRef.current, answer);
        console.log('✅ Remote description set, processing queued ICE candidates');
        // Process any queued ICE candidates now that remote description is set
        await processIceCandidateQueue();
      }
    } catch (err) {
      console.error('Error handling answer:', err);
      setError(err.message || 'Failed to handle answer');
    }
  }, [processIceCandidateQueue]);

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (candidate) => {
    try {
      if (!peerConnectionRef.current) {
        console.log('⏳ No peer connection yet, queueing ICE candidate');
        iceCandidateQueueRef.current.push(candidate);
        return;
      }

      const pc = peerConnectionRef.current;

      // Check if remote description is set
      if (!pc.remoteDescription) {
        console.log('⏳ Remote description not set yet, queueing ICE candidate');
        iceCandidateQueueRef.current.push(candidate);
        return;
      }

      // Remote description is set, add the candidate immediately
      console.log('✅ Adding ICE candidate (remote description is set)');
      await addIceCandidate(pc, candidate);
    } catch (err) {
      // If adding fails, queue it for later (might be a timing issue)
      if (err.name === 'InvalidStateError' || err.message?.includes('remote description')) {
        console.log('⏳ Queueing ICE candidate due to state error');
        iceCandidateQueueRef.current.push(candidate);
      } else {
        console.error('Error handling ICE candidate:', err);
        // Don't queue invalid candidates
      }
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
    
    // Clear ICE candidate queue
    iceCandidateQueueRef.current = [];
    
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

