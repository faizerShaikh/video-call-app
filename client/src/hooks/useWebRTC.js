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

// Import these functions directly for use in callbacks
import { 
  createAnswer as createAnswerUtil, 
  setRemoteDescription as setRemoteDescriptionUtil,
  createOffer as createOfferUtil
} from '@/utils/webrtc';

export function useWebRTC(socket, roomId, localUserId) {
  const [localStream, setLocalStream] = useState(null);
  // Multiple remote streams: Map<socketId, MediaStream>
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  // Multiple remote media states: Map<socketId, {videoEnabled, audioEnabled}>
  const [remoteMediaStates, setRemoteMediaStates] = useState(new Map());
  const [connectionStates, setConnectionStates] = useState(new Map()); // Map<socketId, connectionState>
  const [error, setError] = useState(null);

  // Multiple peer connections: Map<socketId, RTCPeerConnection>
  const peerConnectionsRef = useRef(new Map());
  const localStreamRef = useRef(null);
  // Multiple ICE candidate queues: Map<socketId, RTCIceCandidate[]>
  const iceCandidateQueuesRef = useRef(new Map());
  // Track connection start times and reconnection attempts: Map<socketId, {startTime, attempts}>
  const connectionAttemptsRef = useRef(new Map());
  // Connection timeouts: Map<socketId, timeoutId>
  const connectionTimeoutsRef = useRef(new Map());

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

  // Create peer connection for a specific participant
  const createPeerConnectionInstance = useCallback((participantId) => {
    const pc = createPeerConnection();

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log(`📹 Received remote track from ${participantId}`, {
        trackId: event.track?.id?.substring(0, 8),
        trackKind: event.track?.kind,
        trackEnabled: event.track?.enabled,
        trackReadyState: event.track?.readyState,
        streams: event.streams?.length || 0,
      });
      
      // Always use event.track directly - it's the most reliable source
      if (!event.track) {
        console.warn(`⚠️ No track in ontrack event from ${participantId}`);
        return;
      }
      
      // Wait a bit for track to be ready
      const track = event.track;
      
      // Update remote streams map - always create a new stream object to trigger React re-render
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        const existingStream = newMap.get(participantId);
        
        if (existingStream) {
          // Get all existing tracks
          const existingTracks = existingStream.getTracks();
          
          // Check if this track already exists
          const trackExists = existingTracks.some(t => t.id === track.id);
          
          if (!trackExists) {
            console.log(`➕ Adding ${track.kind} track to remote stream for ${participantId}`);
            // Create a new stream with all existing tracks plus the new track
            const allTracks = [...existingTracks, track];
            const updatedStream = new MediaStream(allTracks);
            console.log(`🔄 Updated stream for ${participantId} with ${allTracks.length} track(s):`, 
              allTracks.map(t => `${t.kind}(${t.id.substring(0, 8)})`).join(', '));
            newMap.set(participantId, updatedStream);
          } else {
            // Track exists, but create a new stream object anyway to ensure React detects the change
            // This helps when tracks are updated (e.g., enabled/disabled)
            const allTracks = existingStream.getTracks();
            const updatedStream = new MediaStream(allTracks);
            console.log(`🔄 Refreshed stream for ${participantId} (track already exists, refreshing stream object)`);
            newMap.set(participantId, updatedStream);
          }
        } else {
          // Create new stream entry from the track
          const newStream = new MediaStream([track]);
          console.log(`🆕 Created new stream for ${participantId} with ${track.kind} track`);
          newMap.set(participantId, newStream);
        }
        return newMap;
      });
      
      // Also listen for track state changes
      const handleTrackEnded = () => {
        console.log(`⚠️ Track ${track.id.substring(0, 8)} ended for ${participantId}`);
        // Refresh stream when track ends
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          const existingStream = newMap.get(participantId);
          if (existingStream) {
            const remainingTracks = existingStream.getTracks().filter(t => t.id !== track.id);
            if (remainingTracks.length > 0) {
              newMap.set(participantId, new MediaStream(remainingTracks));
            } else {
              newMap.delete(participantId);
            }
          }
          return newMap;
        });
      };
      
      const handleTrackMute = () => {
        console.log(`🔇 Track ${track.id.substring(0, 8)} muted for ${participantId}`);
      };
      
      const handleTrackUnmute = () => {
        console.log(`🔊 Track ${track.id.substring(0, 8)} unmuted for ${participantId}`);
      };
      
      track.addEventListener('ended', handleTrackEnded);
      track.addEventListener('mute', handleTrackMute);
      track.addEventListener('unmute', handleTrackUnmute);
      
      // Cleanup listeners when component unmounts (handled by peer connection cleanup)
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`🔗 Connection state changed for ${participantId}:`, state);
      
      setConnectionStates(prev => {
        const newMap = new Map(prev);
        newMap.set(participantId, state);
        return newMap;
      });
      
      // Clear any existing timeout for this participant
      const existingTimeout = connectionTimeoutsRef.current.get(participantId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        connectionTimeoutsRef.current.delete(participantId);
      }
      
      if (state === 'connected') {
        console.log(`✅ WebRTC connection established with ${participantId}!`);
        setError(null);
        
        // Clear connection attempt tracking
        connectionAttemptsRef.current.delete(participantId);
        
        // Check if we have tracks and ensure they're in the stream
        const receivers = pc.getReceivers();
        console.log(`📊 Receivers for ${participantId}:`, receivers.length);
        
        // Get all tracks from receivers
        const receiverTracks = receivers.map(r => r.track).filter(Boolean);
        const liveTracks = receiverTracks.filter(t => t.readyState === 'live');
        
        if (liveTracks.length > 0) {
          liveTracks.forEach((track, index) => {
            console.log(`  Receiver ${index}: ${track.kind} - ${track.id.substring(0, 8)} - enabled: ${track.enabled} - readyState: ${track.readyState}`);
          });
          
          // Always create/update stream with all receiver tracks
          setRemoteStreams(prev => {
            const newMap = new Map(prev);
            const existingStream = newMap.get(participantId);
            const existingTracks = existingStream?.getTracks() || [];
            
            // Combine all tracks, removing duplicates by ID
            const allTracks = [
              ...existingTracks.filter(et => !liveTracks.some(rt => rt.id === et.id)),
              ...liveTracks
            ];
            
            // Always create a new stream object to trigger React re-render
            const updatedStream = new MediaStream(allTracks);
            console.log(`🔄 Updated stream for ${participantId} with ${allTracks.length} track(s):`, 
              allTracks.map(t => `${t.kind}(${t.id.substring(0, 8)})`).join(', '));
            newMap.set(participantId, updatedStream);
            return newMap;
          });
        } else {
          console.warn(`⚠️ No live receiver tracks found for ${participantId} even though connection is established`);
          console.warn(`   Total receivers: ${receivers.length}, Total tracks: ${receiverTracks.length}`);
          
          // Try checking multiple times with increasing delays - tracks might arrive later
          [500, 1000, 2000, 3000].forEach((delay, index) => {
            setTimeout(() => {
              const delayedReceivers = pc.getReceivers();
              const delayedTracks = delayedReceivers.map(r => r.track).filter(Boolean);
              const liveDelayedTracks = delayedTracks.filter(t => t.readyState === 'live');
              
              if (liveDelayedTracks.length > 0) {
                console.log(`✅ Found ${liveDelayedTracks.length} delayed track(s) for ${participantId} after ${delay}ms`);
                setRemoteStreams(prev => {
                  const newMap = new Map(prev);
                  const existingStream = newMap.get(participantId);
                  const existingTracks = existingStream?.getTracks() || [];
                  
                  // Combine all tracks
                  const allTracks = [
                    ...existingTracks.filter(et => !liveDelayedTracks.some(rt => rt.id === et.id)),
                    ...liveDelayedTracks
                  ];
                  
                  const updatedStream = new MediaStream(allTracks);
                  console.log(`🔄 Updated stream for ${participantId} with delayed tracks:`, 
                    allTracks.map(t => `${t.kind}(${t.id.substring(0, 8)})`).join(', '));
                  newMap.set(participantId, updatedStream);
                  return newMap;
                });
              } else if (index === 3) {
                // Last attempt failed, try renegotiation
                console.warn(`⚠️ Still no tracks after ${delay}ms, attempting renegotiation with ${participantId}...`);
                if (pc.localDescription && pc.remoteDescription) {
                  createOffer(pc).then(newOffer => {
                    socket.emit('offer', {
                      offer: newOffer,
                      roomId,
                      targetId: participantId,
                    });
                    console.log(`📤 Renegotiation offer sent to ${participantId}`);
                  }).catch(err => {
                    console.error(`❌ Failed to create renegotiation offer for ${participantId}:`, err);
                  });
                }
              }
            }, delay);
          });
        }
      } else if (state === 'connecting') {
        console.log(`🔄 Connecting to ${participantId}...`);
        
        // Track connection start time
        const attemptInfo = connectionAttemptsRef.current.get(participantId) || { startTime: Date.now(), attempts: 0 };
        if (!connectionAttemptsRef.current.has(participantId)) {
          connectionAttemptsRef.current.set(participantId, attemptInfo);
        }
        
        // Set timeout for connection (30 seconds)
        const timeoutId = setTimeout(() => {
          if (pc.connectionState === 'connecting' || pc.connectionState === 'checking') {
            console.error(`⏱️ Connection to ${participantId} timed out after 30 seconds`);
            setError(`Connection timeout with ${participantId}. The connection is taking too long.`);
            
            // Close and clean up
            pc.close();
            peerConnectionsRef.current.delete(participantId);
            connectionAttemptsRef.current.delete(participantId);
            connectionTimeoutsRef.current.delete(participantId);
            
            // Don't auto-retry - let user manually retry or wait for better network conditions
            console.log(`ℹ️ Connection to ${participantId} closed due to timeout. User can retry manually.`);
          }
        }, 30000); // 30 second timeout
        
        connectionTimeoutsRef.current.set(participantId, timeoutId);
        
        // If stuck in connecting for too long, try to renegotiate (after 10 seconds)
        setTimeout(() => {
          if (pc.connectionState === 'connecting' && pc.localDescription && pc.remoteDescription) {
            console.log(`⚠️ Connection to ${participantId} stuck in 'connecting' state, attempting renegotiation...`);
            createOffer(pc).then(newOffer => {
              socket.emit('offer', {
                offer: newOffer,
                roomId,
                targetId: participantId,
              });
              console.log(`📤 Renegotiation offer sent to ${participantId}`);
            }).catch(err => {
              console.error(`❌ Failed to create renegotiation offer for ${participantId}:`, err);
            });
          }
        }, 10000); // Try renegotiation after 10 seconds
      } else if (state === 'failed') {
        console.error(`❌ WebRTC connection failed with ${participantId}`);
        
        // Get attempt info
        const attemptInfo = connectionAttemptsRef.current.get(participantId) || { startTime: Date.now(), attempts: 0 };
        attemptInfo.attempts += 1;
        connectionAttemptsRef.current.set(participantId, attemptInfo);
        
        // Limit reconnection attempts (max 3 attempts)
        if (attemptInfo.attempts > 3) {
          console.error(`❌ Max reconnection attempts (3) reached for ${participantId}. Stopping auto-retry.`);
          setError(`Connection failed with ${participantId} after multiple attempts. Please check your network connection and try again.`);
          
          // Clean up
          pc.close();
          peerConnectionsRef.current.delete(participantId);
          connectionAttemptsRef.current.delete(participantId);
          connectionTimeoutsRef.current.delete(participantId);
          
          return; // Don't retry anymore
        }
        
        setError(`Connection failed with ${participantId}. Retrying... (${attemptInfo.attempts}/3)`);
        
        // Try to reconnect (with exponential backoff)
        if (socket && roomId) {
          const retryDelay = Math.min(2000 * attemptInfo.attempts, 10000); // 2s, 4s, 6s, max 10s
          setTimeout(() => {
            console.log(`🔄 Attempting to reconnect with ${participantId} (attempt ${attemptInfo.attempts})...`);
            pc.close();
            peerConnectionsRef.current.delete(participantId);
            startCallWithParticipant(participantId).catch(err => {
              console.error(`❌ Failed to reconnect with ${participantId}:`, err);
            });
          }, retryDelay);
        }
      } else if (state === 'disconnected') {
        console.log(`🔌 Connection disconnected with ${participantId}`);
        // Don't set error for disconnected - it might reconnect
      } else if (state === 'closed') {
        console.log(`🔒 Connection closed with ${participantId}`);
        // Clean up
        connectionAttemptsRef.current.delete(participantId);
        connectionTimeoutsRef.current.delete(participantId);
      }
    };
    
    // Also monitor ICE connection state
    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      console.log(`🧊 ICE connection state for ${participantId}:`, iceState);
      
      if (iceState === 'connected' || iceState === 'completed') {
        console.log(`✅ ICE connection established with ${participantId}`);
        
        // When ICE connection is established, check for tracks after a short delay
        setTimeout(() => {
          const receivers = pc.getReceivers();
          const receiverTracks = receivers.map(r => r.track).filter(Boolean);
          const liveTracks = receiverTracks.filter(t => t.readyState === 'live');
          const videoTracks = liveTracks.filter(t => t.kind === 'video');
          
          console.log(`📹 ICE connected for ${participantId}: ${liveTracks.length} live tracks (${videoTracks.length} video)`);
          
          if (liveTracks.length > 0) {
            setRemoteStreams(prev => {
              const newMap = new Map(prev);
              const existingStream = newMap.get(participantId);
              const existingTracks = existingStream?.getTracks() || [];
              
              // Always create new stream with all live tracks
              const allTracks = [
                ...existingTracks.filter(et => !liveTracks.some(rt => rt.id === et.id) && et.readyState === 'live'),
                ...liveTracks
              ];
              
              const updatedStream = new MediaStream(allTracks);
              console.log(`🔄 ICE: Updated stream for ${participantId} with ${allTracks.length} live track(s)`);
              newMap.set(participantId, updatedStream);
              return newMap;
            });
          }
        }, 500); // Small delay to ensure tracks are ready
      } else if (iceState === 'failed') {
        console.error(`❌ ICE connection failed with ${participantId}`);
        console.error(`   Connection state: ${pc.connectionState}`);
        console.error(`   Local description:`, pc.localDescription?.type);
        console.error(`   Remote description:`, pc.remoteDescription?.type);
        
        // Try to restart ICE (async operation)
        console.log(`🔄 Attempting ICE restart for ${participantId}...`);
        if (pc.localDescription && pc.remoteDescription) {
          createOfferUtil(pc).then(newOffer => {
            socket.emit('offer', {
              offer: newOffer,
              roomId,
              targetId: participantId,
            });
            console.log(`📤 ICE restart offer sent to ${participantId}`);
          }).catch(err => {
            console.error(`❌ Failed to restart ICE for ${participantId}:`, err);
          });
        }
      } else if (iceState === 'checking') {
        // If stuck in checking for too long, log warning
        const checkingStartTime = pc.iceCheckingStartTime || Date.now();
        pc.iceCheckingStartTime = checkingStartTime;
        const elapsed = Date.now() - checkingStartTime;
        
        if (elapsed > 10000) { // 10 seconds
          console.warn(`⚠️ ICE checking taking too long for ${participantId} (${elapsed}ms)`);
          console.warn(`   This might indicate NAT/firewall issues`);
          console.warn(`   Consider using TURN servers for better connectivity`);
        }
        
        // Set timeout for ICE checking (25 seconds - slightly less than connection timeout)
        if (!pc.iceCheckingTimeout) {
          pc.iceCheckingTimeout = setTimeout(() => {
            if (pc.iceConnectionState === 'checking') {
              console.error(`⏱️ ICE checking timed out for ${participantId} after 25 seconds`);
              // The connection timeout will handle cleanup
            }
          }, 25000);
        }
      } else if (iceState === 'connected' || iceState === 'completed') {
        // Clear ICE checking timeout if it exists
        if (pc.iceCheckingTimeout) {
          clearTimeout(pc.iceCheckingTimeout);
          pc.iceCheckingTimeout = null;
        }
      } else if (iceState === 'failed') {
        // Clear ICE checking timeout if it exists
        if (pc.iceCheckingTimeout) {
          clearTimeout(pc.iceCheckingTimeout);
          pc.iceCheckingTimeout = null;
        }
      }
    };
    
    // Monitor ICE gathering state
    pc.onicegatheringstatechange = () => {
      console.log(`🧊 ICE gathering state for ${participantId}:`, pc.iceGatheringState);
      if (pc.iceGatheringState === 'complete') {
        console.log(`✅ ICE gathering complete for ${participantId}`);
        // Log candidate types gathered
        const stats = pc.getStats();
        stats.then(result => {
          result.forEach(report => {
            if (report.type === 'local-candidate' || report.type === 'remote-candidate') {
              console.log(`   Candidate: ${report.candidateType} - ${report.ip}:${report.port} - ${report.protocol}`);
            }
          });
        });
      }
    };

    // Handle ICE candidate
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        console.log(`🧊 Sending ICE candidate to ${participantId}`);
        socket.emit('ice-candidate', {
          candidate: event.candidate,
          roomId,
          targetId: participantId, // Send to specific participant
        });
      } else if (!event.candidate) {
        console.log(`✅ All ICE candidates gathered for ${participantId}`);
      }
    };

    // Store peer connection
    peerConnectionsRef.current.set(participantId, pc);
    return pc;
  }, [socket, roomId]);

  // Process queued ICE candidates for a specific participant
  const processIceCandidateQueue = useCallback(async (participantId) => {
    const pc = peerConnectionsRef.current.get(participantId);
    const queue = iceCandidateQueuesRef.current.get(participantId) || [];
    
    if (!pc || queue.length === 0) {
      return;
    }
    
    // Check if remote description is set
    if (!pc.remoteDescription) {
      console.log(`⏳ Remote description not set yet for ${participantId}, keeping candidates in queue`);
      return;
    }

    console.log(`📦 Processing ${queue.length} queued ICE candidates for ${participantId}`);
    
    // Process all queued candidates
    const newQueue = [...queue];
    iceCandidateQueuesRef.current.set(participantId, []);
    
    for (const candidate of newQueue) {
      try {
        if (candidate && pc.remoteDescription) {
          await addIceCandidate(pc, candidate);
          console.log(`✅ Added queued ICE candidate for ${participantId}`);
        }
      } catch (err) {
        console.error(`Error adding queued ICE candidate for ${participantId}:`, err);
        // Don't throw, just log - some candidates might be invalid
      }
    }
  }, []);

  // Start call with a specific participant (create offer)
  const startCallWithParticipant = useCallback(async (participantId) => {
    try {
      if (!socket || !roomId) {
        throw new Error('Socket or room ID not available');
      }

      // Don't create duplicate peer connection for same participant
      if (peerConnectionsRef.current.has(participantId)) {
        console.log(`⚠️ Peer connection already exists for ${participantId}, skipping`);
        return;
      }

      // Initialize local stream if not already done
      if (!localStreamRef.current) {
        await initializeLocalStream();
      }

      // Create peer connection for this participant
      const pc = createPeerConnectionInstance(participantId);

      // Add local stream to peer connection
      if (localStreamRef.current) {
        addStreamToPeerConnection(pc, localStreamRef.current);
        console.log(`✅ Added local stream to peer connection for ${participantId}`);
      }

      // Create and send offer
      console.log(`📤 Creating and sending offer to ${participantId}...`);
      console.log('📤 Room ID:', roomId);
      const offer = await createOffer(pc);
      console.log('📤 Offer created, type:', offer.type);
      socket.emit('offer', {
        offer,
        roomId,
        targetId: participantId, // Send to specific participant
      });
      console.log(`✅ Offer sent to ${participantId} in room:`, roomId);

      // Update connection state
      setConnectionStates(prev => {
        const newMap = new Map(prev);
        newMap.set(participantId, 'connecting');
        return newMap;
      });
    } catch (err) {
      console.error(`Error starting call with ${participantId}:`, err);
      setError(err.message || `Failed to start call with ${participantId}`);
    }
  }, [socket, roomId, initializeLocalStream, createPeerConnectionInstance]);

  // Start call with all existing participants
  const startCall = useCallback(async (participantIds = []) => {
    if (!socket || !roomId) {
      throw new Error('Socket or room ID not available');
    }

    // Initialize local stream if not already done
    if (!localStreamRef.current) {
      await initializeLocalStream();
    }

    // Send initial media state
    if (socket && roomId && localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      socket.emit('media-state', {
        roomId,
        videoEnabled: videoTrack?.enabled ?? true,
        audioEnabled: audioTrack?.enabled ?? true,
      });
    }

    // Create peer connections and send offers to all participants
    for (const participantId of participantIds) {
      await startCallWithParticipant(participantId);
    }
  }, [socket, roomId, startCallWithParticipant]);

  // Handle incoming offer
  const handleOffer = useCallback(async (offer, from) => {
    try {
      console.log(`📥 Handling incoming offer from: ${from}`);
      
      // Check if we already have a peer connection with this participant
      let pc = peerConnectionsRef.current.get(from);
      
      if (pc) {
        // We already have a peer connection
        if (pc.localDescription && pc.localDescription.type === 'offer') {
          // We already sent an offer to this participant
          // This is a "simultaneous offer" scenario - we should handle it by
          // setting the remote description and creating an answer
          // This will replace our local offer with an answer
          console.log(`🔄 Simultaneous offer detected with ${from}. Setting remote description and creating answer...`);
          
          try {
            // Set the remote description (their offer)
            await setRemoteDescriptionUtil(pc, offer);
            console.log(`✅ Set remote description from ${from}'s offer`);
            
            // Create answer (this will replace our local offer)
            const answer = await createAnswerUtil(pc, offer);
            console.log(`✅ Created answer to ${from}'s offer`);
            
            // Send the answer
            socket.emit('answer', {
              answer,
              roomId,
              targetId: from,
            });
            console.log(`✅ Answer sent to ${from}`);
            
            // Process queued ICE candidates
            await processIceCandidateQueue(from);
            
            return; // Done handling simultaneous offer
          } catch (err) {
            console.error(`❌ Error handling simultaneous offer from ${from}:`, err);
            // If this fails, we might need to recreate the connection
            // But for now, just log the error
            return;
          }
        } else if (pc.remoteDescription) {
          // We already have a remote description, ignore duplicate offer
          console.log(`⚠️ Already have remote description from ${from}, ignoring duplicate offer`);
          return;
        } else {
          // We have a peer connection but no descriptions yet - use it
          console.log(`✅ Reusing existing peer connection with ${from}`);
        }
      } else {
        // No peer connection exists, create one
        if (!localStreamRef.current) {
          await initializeLocalStream();
        }

        // Create peer connection for this participant
        pc = createPeerConnectionInstance(from);
        console.log(`✅ Created new peer connection for offer from ${from}`);

        if (localStreamRef.current) {
          addStreamToPeerConnection(pc, localStreamRef.current);
          console.log(`✅ Added local stream to peer connection for ${from}`);
        }
      }

      // createAnswer will set the remote description
      console.log(`📤 Creating answer to offer from: ${from}`);
      console.log('📤 Offer details:', {
        type: offer?.type,
        sdp: offer?.sdp?.substring(0, 100) + '...',
      });
      
      const answer = await createAnswerUtil(pc, offer);
      console.log(`✅ Answer created for ${from}, remote description set`);
      console.log('📤 Answer details:', {
        type: answer?.type,
        sdp: answer?.sdp?.substring(0, 100) + '...',
      });
      
      // Process any queued ICE candidates now that remote description is set
      await processIceCandidateQueue(from);
      
      console.log(`📤 Sending answer to: ${from}`);
      console.log('📤 Room ID:', roomId);
      socket.emit('answer', {
        answer,
        roomId,
        targetId: from,
      });
      console.log(`✅ Answer sent to ${from} in room:`, roomId);

      // Send initial media state
      if (socket && roomId && localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        socket.emit('media-state', {
          roomId,
          videoEnabled: videoTrack?.enabled ?? true,
          audioEnabled: audioTrack?.enabled ?? true,
        });
      }

      // Update connection state
      setConnectionStates(prev => {
        const newMap = new Map(prev);
        newMap.set(from, 'connecting');
        return newMap;
      });
    } catch (err) {
      console.error(`Error handling offer from ${from}:`, err);
      setError(err.message || `Failed to handle offer from ${from}`);
    }
  }, [socket, roomId, initializeLocalStream, createPeerConnectionInstance, processIceCandidateQueue]);

  // Handle incoming answer
  const handleAnswer = useCallback(async (answer, from) => {
    try {
      const pc = peerConnectionsRef.current.get(from);
      if (!pc) {
        console.log(`⚠️ No peer connection yet for ${from}, cannot handle answer`);
        return;
      }
      
      // Check the signaling state - we can only set an answer when we have a local offer
      const signalingState = pc.signalingState;
      console.log(`📥 Received answer from ${from}, current signaling state: ${signalingState}`);
      
      // Only process answer if we're in the correct state
      if (signalingState !== 'have-local-offer') {
        if (pc.remoteDescription) {
          // Check if it's the same answer (same SDP)
          const existingSDP = pc.remoteDescription.sdp;
          const newSDP = answer.sdp;
          
          if (existingSDP === newSDP) {
            console.log(`⚠️ Duplicate answer received from ${from} (same SDP), ignoring`);
            return;
          } else {
            console.log(`⚠️ Answer received in wrong state (${signalingState}), already have remote description. Ignoring.`);
            return;
          }
        } else {
          console.log(`⚠️ Answer received in wrong state (${signalingState}), no local offer. Ignoring.`);
          return;
        }
      }
      
      // Check if we already have a remote description (shouldn't happen in have-local-offer, but check anyway)
      if (pc.remoteDescription) {
        const existingSDP = pc.remoteDescription.sdp;
        const newSDP = answer.sdp;
        
        if (existingSDP === newSDP) {
          console.log(`⚠️ Duplicate answer received from ${from} (same SDP), ignoring`);
          return;
        } else {
          console.log(`⚠️ Already have remote description, but different SDP. This shouldn't happen in have-local-offer state.`);
          // Don't try to update - this would cause InvalidStateError
          return;
        }
      }

      console.log(`📥 Setting remote description from answer from ${from}...`);
      console.log(`📥 Answer SDP (first 200 chars):`, answer.sdp?.substring(0, 200));
      
      // Check if answer has public IPs
      const hasPublicIP = answer.sdp && !answer.sdp.includes('127.0.0.1') && !answer.sdp.includes('0.0.0.0');
      if (!hasPublicIP) {
        console.warn(`⚠️ Answer SDP contains localhost IP - NAT traversal might fail`);
      }
      
      await setRemoteDescription(pc, answer);
      console.log(`✅ Remote description set for ${from}, processing queued ICE candidates`);
      
      // Process any queued ICE candidates now that remote description is set
      await processIceCandidateQueue(from);
    } catch (err) {
      console.error(`Error handling answer from ${from}:`, err);
      // Don't set error state for InvalidStateError - it's usually a duplicate/late answer
      if (err.name !== 'InvalidStateError') {
        setError(err.message || `Failed to handle answer from ${from}`);
      } else {
        console.log(`ℹ️ InvalidStateError when handling answer (likely duplicate/late answer), ignoring`);
      }
    }
  }, [processIceCandidateQueue]);

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (candidate, from) => {
    try {
      const pc = peerConnectionsRef.current.get(from);
      if (!pc) {
        console.log(`⏳ No peer connection yet for ${from}, queueing ICE candidate`);
        const queue = iceCandidateQueuesRef.current.get(from) || [];
        queue.push(candidate);
        iceCandidateQueuesRef.current.set(from, queue);
        return;
      }

      // Check if remote description is set
      if (!pc.remoteDescription) {
        console.log(`⏳ Remote description not set yet for ${from}, queueing ICE candidate`);
        const queue = iceCandidateQueuesRef.current.get(from) || [];
        queue.push(candidate);
        iceCandidateQueuesRef.current.set(from, queue);
        return;
      }

      // Remote description is set, add the candidate immediately
      console.log(`✅ Adding ICE candidate for ${from} (remote description is set)`);
      await addIceCandidate(pc, candidate);
    } catch (err) {
      // If adding fails, queue it for later (might be a timing issue)
      if (err.name === 'InvalidStateError' || err.message?.includes('remote description')) {
        console.log(`⏳ Queueing ICE candidate for ${from} due to state error`);
        const queue = iceCandidateQueuesRef.current.get(from) || [];
        queue.push(candidate);
        iceCandidateQueuesRef.current.set(from, queue);
      } else {
        console.error(`Error handling ICE candidate from ${from}:`, err);
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
        const newVideoState = videoTrack.enabled;
        setIsVideoEnabled(newVideoState);
        
        // Notify other participants
        if (socket && roomId) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          const audioState = audioTrack?.enabled ?? true;
          console.log('📤 Sending media-state: video=', newVideoState, 'audio=', audioState);
          console.log('📤 Room ID:', roomId);
          console.log('📤 Socket ID:', socket.id);
          socket.emit('media-state', {
            roomId,
            videoEnabled: newVideoState,
            audioEnabled: audioState,
          });
          console.log('✅ Media-state event emitted');
        } else {
          console.warn('⚠️ Cannot send media-state: socket or roomId not available');
          console.warn('⚠️ Socket:', socket ? 'exists' : 'null', 'RoomId:', roomId || 'empty');
        }
      }
    }
  }, [socket, roomId]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newAudioState = audioTrack.enabled;
        setIsAudioEnabled(newAudioState);
        
        // Notify other participants
        if (socket && roomId) {
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          const videoState = videoTrack?.enabled ?? true;
          console.log('📤 Sending media-state: video=', videoState, 'audio=', newAudioState);
          console.log('📤 Room ID:', roomId);
          console.log('📤 Socket ID:', socket.id);
          socket.emit('media-state', {
            roomId,
            videoEnabled: videoState,
            audioEnabled: newAudioState,
          });
          console.log('✅ Media-state event emitted');
        } else {
          console.warn('⚠️ Cannot send media-state: socket or roomId not available');
          console.warn('⚠️ Socket:', socket ? 'exists' : 'null', 'RoomId:', roomId || 'empty');
        }
      }
    }
  }, [socket, roomId]);

  // Remove a specific participant
  const removeParticipant = useCallback((participantId) => {
    // Close peer connection
    const pc = peerConnectionsRef.current.get(participantId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(participantId);
      console.log(`✅ Closed peer connection for ${participantId}`);
    }

    // Remove remote stream
    setRemoteStreams(prev => {
      const newMap = new Map(prev);
      newMap.delete(participantId);
      return newMap;
    });

    // Remove media state
    setRemoteMediaStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(participantId);
      return newMap;
    });

    // Remove connection state
    setConnectionStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(participantId);
      return newMap;
    });

    // Clear ICE candidate queue
    iceCandidateQueuesRef.current.delete(participantId);
  }, []);

  // End call (close all connections)
  const endCall = useCallback(() => {
    // Stop local stream
    if (localStreamRef.current) {
      stopStream(localStreamRef.current);
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc, participantId) => {
      pc.close();
      console.log(`✅ Closed peer connection for ${participantId}`);
    });
    peerConnectionsRef.current.clear();

    // Clear all remote streams
    setRemoteStreams(new Map());
    
    // Clear all media states
    setRemoteMediaStates(new Map());
    
    // Clear all connection states
    setConnectionStates(new Map());
    
    // Clear all ICE candidate queues
    iceCandidateQueuesRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  // Resend offer to a specific participant (useful when another user joins)
  const resendOffer = useCallback(async (participantId) => {
    try {
      const pc = peerConnectionsRef.current.get(participantId);
      if (!pc || !socket || !roomId) {
        // If no peer connection exists, create one and send offer
        if (!pc && participantId) {
          console.log(`📤 No peer connection for ${participantId}, creating new one...`);
          await startCallWithParticipant(participantId);
          return;
        }
        return;
      }

      if (pc.localDescription && pc.localDescription.type === 'offer') {
        console.log(`📤 Resending existing offer to ${participantId}...`);
        socket.emit('offer', {
          offer: pc.localDescription,
          roomId,
          targetId: participantId,
        });
      } else {
        // Create new offer
        console.log(`📤 Creating and sending new offer to ${participantId}...`);
        const offer = await createOffer(pc);
        socket.emit('offer', {
          offer,
          roomId,
          targetId: participantId,
        });
      }
    } catch (err) {
      console.error(`Error resending offer to ${participantId}:`, err);
    }
  }, [socket, roomId, startCallWithParticipant]);

  // Update remote media state for a specific participant
  const updateRemoteMediaState = useCallback((participantId, videoEnabled, audioEnabled) => {
    setRemoteMediaStates(prev => {
      const newMap = new Map(prev);
      newMap.set(participantId, { videoEnabled, audioEnabled });
      return newMap;
    });
  }, []);

  // Get peer connections ref (for external access)
  const getPeerConnections = useCallback(() => {
    return peerConnectionsRef.current;
  }, []);

  // Verify and fix missing video tracks for all connected peers
  const verifyAndFixStreams = useCallback(() => {
    console.log('🔍 Verifying all peer connections and streams...');
    const peerConnections = peerConnectionsRef.current;
    
    peerConnections.forEach((pc, participantId) => {
      const connectionState = pc.connectionState;
      const iceState = pc.iceConnectionState;
      
      if (connectionState === 'connected' || iceState === 'connected' || iceState === 'completed') {
        const receivers = pc.getReceivers();
        const receiverTracks = receivers.map(r => r.track).filter(Boolean);
        const liveTracks = receiverTracks.filter(t => t.readyState === 'live');
        const videoTracks = liveTracks.filter(t => t.kind === 'video');
        const audioTracks = liveTracks.filter(t => t.kind === 'audio');
        
        console.log(`📊 Checking ${participantId}: ${liveTracks.length} live tracks (${videoTracks.length} video, ${audioTracks.length} audio)`);
        
        // Always update stream if we have live tracks
        if (liveTracks.length > 0) {
          setRemoteStreams(prev => {
            const newMap = new Map(prev);
            const existingStream = newMap.get(participantId);
            const existingTracks = existingStream?.getTracks() || [];
            const existingLiveTracks = existingTracks.filter(t => t.readyState === 'live');
            const existingVideoTracks = existingLiveTracks.filter(t => t.kind === 'video');
            
            // Check if we need to update
            const missingTracks = liveTracks.filter(rt => !existingTracks.some(et => et.id === rt.id));
            
            if (missingTracks.length > 0 || existingVideoTracks.length === 0 && videoTracks.length > 0) {
              console.log(`⚠️ Stream issue detected for ${participantId}:`, {
                hasStream: !!existingStream,
                existingTracks: existingTracks.length,
                existingLiveTracks: existingLiveTracks.length,
                existingVideoTracks: existingVideoTracks.length,
                receiverTracks: receiverTracks.length,
                liveTracks: liveTracks.length,
                receiverVideoTracks: videoTracks.length,
                missingTracks: missingTracks.length,
              });
              
              // Combine all tracks, prioritizing live receiver tracks
              const allTracks = [
                ...existingTracks.filter(et => !liveTracks.some(rt => rt.id === et.id) && et.readyState === 'live'),
                ...liveTracks
              ];
              
              const updatedStream = new MediaStream(allTracks);
              console.log(`🔧 Fixed stream for ${participantId} with ${allTracks.length} track(s):`, 
                allTracks.map(t => `${t.kind}(${t.id.substring(0, 8)})`).join(', '));
              newMap.set(participantId, updatedStream);
            }
            
            return newMap;
          });
        } else if (connectionState === 'connected' || iceState === 'connected' || iceState === 'completed') {
          // Connection established but no live tracks
          console.warn(`⚠️ No live tracks for ${participantId} despite connection being established`);
          console.warn(`   Connection: ${connectionState}, ICE: ${iceState}`);
          console.warn(`   Receivers: ${receivers.length}, Total tracks: ${receiverTracks.length}`);
        }
      } else if (connectionState === 'failed' || iceState === 'failed') {
        console.error(`❌ Connection failed with ${participantId}: connection=${connectionState}, ice=${iceState}`);
      }
    });
  }, [socket, roomId, startCallWithParticipant, createOffer]);

  // Periodic verification of streams - more frequent for better recovery
  useEffect(() => {
    if (!socket || !roomId) return;
    
    // Run verification every 2 seconds for faster recovery
    const verificationInterval = setInterval(() => {
      verifyAndFixStreams();
    }, 2000);
    
    return () => {
      clearInterval(verificationInterval);
    };
  }, [socket, roomId, verifyAndFixStreams]);
  
  // Also verify when connection states change
  useEffect(() => {
    verifyAndFixStreams();
  }, [connectionStates, verifyAndFixStreams]);

  return {
    localStream,
    remoteStreams, // Map<socketId, MediaStream>
    isVideoEnabled,
    isAudioEnabled,
    remoteMediaStates, // Map<socketId, {videoEnabled, audioEnabled}>
    connectionStates, // Map<socketId, connectionState>
    error,
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
    getPeerConnections, // Expose for checking existing connections
  };
}

