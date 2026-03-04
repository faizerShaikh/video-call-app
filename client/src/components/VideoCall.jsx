import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSocket } from "@/hooks/useSocket";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { VideoPlayer } from "./VideoPlayer";
import { Controls } from "./Controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isGetUserMediaSupported, isSecureContext } from "@/utils/webrtc";
import { LuCopy, LuShare2, LuClock, LuTrash2 } from "react-icons/lu";
import { toast } from "sonner";
import { meetingAPI } from "@/services/api";

const meetingSchema = z.object({
  title: z
    .string()
    .max(100, "Title must be less than 100 characters")
    .optional(),
});

export function VideoCall() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");
  const [localUserId] = useState(
    () => `user-${Math.random().toString(36).substr(2, 9)}`,
  );
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [error, setError] = useState(null);
  const [showCreateMeeting, setShowCreateMeeting] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [createMeetingLoading, setCreateMeetingLoading] = useState(false);
  const [showGuestNameForm, setShowGuestNameForm] = useState(false);
  const [guestNameInput, setGuestNameInput] = useState("");
  const [guestNameLoading, setGuestNameLoading] = useState(false);
  // Track participant names: Map<socketId, {name: string, type: 'registered' | 'guest', userId?: string}>
  const [participantNames, setParticipantNames] = useState(new Map());

  // Meeting creation form
  const {
    register: registerMeeting,
    handleSubmit: handleSubmitMeeting,
    formState: { errors: meetingErrors },
    reset: resetMeeting,
  } = useForm({
    resolver: zodResolver(meetingSchema),
  });

  // Guest mode detection - check localStorage for user authentication
  // If user is logged in (has token/user in localStorage), they're not a guest
  // Otherwise, if they have guestToken, they're a guest
  const meetingId = searchParams.get("meetingId");
  
  const { user, logout, isAdmin } = useAuth();
  
  // Check localStorage for authentication
  const userToken = localStorage.getItem("token");
  const userData = localStorage.getItem("user");
  const isAuthenticatedUser = !!(userToken && userData);
  
  // Get guest token and name from localStorage
  const guestToken = localStorage.getItem("guestToken");
  const guestName = localStorage.getItem("guestName");
  
  // Guest mode: not authenticated AND has guest token
  const isGuestMode = !isAuthenticatedUser && !!guestToken;

  const {
    socket,
    isConnected,
    error: socketError,
  } = useSocket(guestToken, meetingId, user?._id || null);
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
      setError("Please enter a room ID");
      return;
    }

    if (!socket || !isConnected) {
      setError("Not connected to server. Please wait...");
      return;
    }

    try {
      setError(null);

      // Update roomId state with normalized version
      setRoomId(normalizedRoomId);

      // Initialize local stream
      await initializeLocalStream();

      // Join room via socket with normalized room ID
      console.log("🚪 Joining room:", normalizedRoomId);

      // Prepare join-room payload based on guest or registered user
      const joinPayload = {
        roomId: normalizedRoomId,
      };

      // Check if guest mode (has guestToken but no user token)
      const hasGuestToken = !!localStorage.getItem("guestToken");
      const hasUserToken = !!localStorage.getItem("token");
      
      if (hasGuestToken && !hasUserToken) {
        // Guest user joining (meeting or regular room)
        const storedGuestName = localStorage.getItem("guestName");
        const storedGuestToken = localStorage.getItem("guestToken");
        joinPayload.guestName = storedGuestName;
        joinPayload.guestToken = storedGuestToken;
        if (meetingId) {
          joinPayload.meetingId = meetingId;
        }
        console.log("👤 Joining as guest:", storedGuestName);
      } else if (user || hasUserToken) {
        // Registered user joining
        joinPayload.userId = user._id;
        if (meetingId) {
          joinPayload.meetingId = meetingId;
        }
        console.log("👤 Joining as registered user:", user.name);
      } else {
        // Fallback to localUserId for backward compatibility
        joinPayload.userId = localUserId;
        console.log("👤 Joining with local user ID:", localUserId);
      }

      socket.emit("join-room", joinPayload);
      setHasJoinedRoom(true);

      // Don't start call here - wait for room-joined event which tells us
      // if there are other participants. The room-joined handler will decide
      // whether to create an offer or wait for one.
    } catch (err) {
      console.error("Error joining room:", err);
      setError(err.message || "Failed to join room");
    }
  };

  // Leave room
  const handleLeaveRoom = () => {
    if (socket && roomId) {
      const leavePayload = { roomId };
      if (meetingId) {
        leavePayload.meetingId = meetingId;
      }
      socket.emit("leave-room", leavePayload);
    }
    endCall();
    setHasJoinedRoom(false);
    setRoomId("");
    setParticipantCount(0);
    setError(null);

    // Clean up guest data if in guest mode
    if (isGuestMode) {
      localStorage.removeItem("guestToken");
      localStorage.removeItem("guestName");
      localStorage.removeItem("guestMeetingId");
    }

    // Clear query parameters from URL
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete("roomid");
    newSearchParams.delete("meetingId");
    newSearchParams.delete("guest");
    setSearchParams(newSearchParams, { replace: true });
  };

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    // Track if we've received an offer to avoid creating duplicate offers
    const offerReceivedRef = { current: false };
    const offerTimeoutRef = { current: null };
    // Track pending offers to avoid duplicate offers to same participant
    const pendingOffersRef = { current: new Set() };

    // Handle incoming offer
    socket.on("offer", ({ offer, from }) => {
      console.log("📥 Received offer from:", from);
      offerReceivedRef.current = true;
      
      // Remove from pending offers since we received an offer from them
      pendingOffersRef.current.delete(from);
      
      // Cancel any pending offer creation
      if (offerTimeoutRef.current) {
        clearTimeout(offerTimeoutRef.current);
        offerTimeoutRef.current = null;
        console.log(
          "❌ Cancelled pending offer creation - received offer instead",
        );
      }
      handleOffer(offer, from);
    });

    // Handle incoming answer
    socket.on("answer", ({ answer, from }) => {
      console.log("📥 Received answer from:", from);
      console.log("📥 Answer details:", {
        type: answer?.type,
        sdp: answer?.sdp?.substring(0, 100) + "...",
      });
      handleAnswer(answer, from);
    });

    // Handle ICE candidate
    socket.on("ice-candidate", ({ candidate, from }) => {
      console.log("🧊 Received ICE candidate from:", from);
      handleIceCandidate(candidate, from);
    });

    // Handle media state changes (remote video/audio on/off)
    socket.on("media-state", ({ videoEnabled, audioEnabled, from }) => {
      console.log("📹 Media state update received from:", from);
      console.log(
        "📹 Video enabled:",
        videoEnabled,
        "Audio enabled:",
        audioEnabled,
      );

      if (videoEnabled !== undefined || audioEnabled !== undefined) {
        updateRemoteMediaState(
          from,
          videoEnabled !== undefined ? videoEnabled : true,
          audioEnabled !== undefined ? audioEnabled : true,
        );
      }
    });

    // Handle user joined
    socket.on("user-joined", ({ userId, userName, guestName, socketId, participantType }) => {
      console.log("👤 User joined:", { userId, userName, guestName, socketId, participantType });

      // Skip if this is our own join event
      if (socketId === socket.id) {
        console.log(`ℹ️ Ignoring own user-joined event: ${socketId}`);
        return;
      }

      // Store participant name information
      setParticipantNames(prev => {
        const newMap = new Map(prev);
        if (participantType === 'guest' && guestName) {
          newMap.set(socketId, { name: guestName, type: 'guest' });
          console.log(`📝 Stored guest name for ${socketId}: ${guestName}`);
        } else if (participantType === 'registered') {
          // Use userName if provided, otherwise fallback to userId
          const name = userName || userId || 'Unknown User';
          newMap.set(socketId, { name, type: 'registered', userId });
          console.log(`📝 Stored registered user name for ${socketId}: ${name}`);
        }
        return newMap;
      });

      // If we're already in a call and another user joins, create a peer connection with them
      if (hasJoinedRoom) {
        console.log(
          `🔄 Another user joined (${socketId}), type: ${participantType || (guestName ? 'guest' : 'registered')}, creating peer connection...`,
        );
        console.log(`🔄 Current socket ID: ${socket.id}, New participant: ${socketId}`);
        
        // Wait a bit for the new user to set up their event handlers
        setTimeout(() => {
          // Only create connection if we don't already have one with this participant
          const peerConnections = getPeerConnections();
          
          // Check if we're already creating an offer to this participant
          if (pendingOffersRef.current.has(socketId)) {
            console.log(`⏳ Already creating offer to ${socketId}, skipping...`);
            return;
          }
          
          if (!peerConnections.has(socketId)) {
            console.log(
              `📞 Creating peer connection with new participant ${socketId}...`,
            );
            pendingOffersRef.current.add(socketId);
            startCallWithParticipant(socketId)
              .then(() => {
                // Remove from pending after a delay to allow offer to be sent
                setTimeout(() => {
                  pendingOffersRef.current.delete(socketId);
                }, 2000);
              })
              .catch((err) => {
                console.error(
                  `❌ Failed to create connection with ${socketId}:`,
                  err,
                );
                pendingOffersRef.current.delete(socketId);
              });
          } else {
            const pc = peerConnections.get(socketId);
            console.log(`⚠️ Already have peer connection with ${socketId}:`, {
              connectionState: pc.connectionState,
              iceConnectionState: pc.iceConnectionState,
              hasLocalDescription: !!pc.localDescription,
              hasRemoteDescription: !!pc.remoteDescription,
            });
            
            // If connection exists but isn't working, try to re-establish
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
              console.log(`🔄 Re-establishing connection with ${socketId}...`);
              if (!pendingOffersRef.current.has(socketId)) {
                pendingOffersRef.current.add(socketId);
                startCallWithParticipant(socketId)
                  .then(() => {
                    setTimeout(() => {
                      pendingOffersRef.current.delete(socketId);
                    }, 2000);
                  })
                  .catch((err) => {
                    console.error(`❌ Failed to re-establish connection with ${socketId}:`, err);
                    pendingOffersRef.current.delete(socketId);
                  });
              }
            }
          }
        }, 1500); // Increased delay to ensure both sides are ready
      }
    });

    // Handle user left
    socket.on("user-left", ({ socketId }) => {
      console.log("👋 User left:", socketId);
      // Remove participant name from tracking
      setParticipantNames(prev => {
        const newMap = new Map(prev);
        newMap.delete(socketId);
        return newMap;
      });
    });

    // Handle room update
    socket.on(
      "room-update",
      ({ participantCount, roomId, otherParticipants }) => {
        console.log("📊 Room update:", {
          participantCount,
          roomId,
          otherParticipants,
        });
        setParticipantCount(participantCount);

        // Ensure we have peer connections with all participants (safety net)
        if (
          hasJoinedRoom &&
          otherParticipants &&
          otherParticipants.length > 0
        ) {
          console.log("🔍 Verifying peer connections with all participants...");
          console.log("📋 Other participants:", otherParticipants);
          console.log(
            "📋 Current peer connections:",
            Array.from(getPeerConnections().keys()),
          );
          console.log("📋 Socket ID:", socket.id);

          // Use a longer delay to avoid interfering with initial connection setup
          setTimeout(() => {
            const peerConnections = getPeerConnections();
            // Filter out our own socket ID and participants we already have connections with
            const missingConnections = otherParticipants.filter(
              (participantId) =>
                participantId !== socket.id && // Don't connect to self
                !peerConnections.has(participantId), // Don't create duplicate connections
            );

            if (missingConnections.length > 0) {
              console.log(
                `⚠️ Missing ${missingConnections.length} peer connection(s):`,
                missingConnections,
              );
              // Create missing connections sequentially
              (async () => {
                for (const participantId of missingConnections) {
                  // Check if we're already creating an offer to this participant
                  if (pendingOffersRef.current.has(participantId)) {
                    console.log(`⏳ Already creating offer to ${participantId}, skipping...`);
                    continue;
                  }
                  
                  console.log(
                    `📞 Creating missing connection with ${participantId}...`,
                  );
                  pendingOffersRef.current.add(participantId);
                  try {
                    await startCallWithParticipant(participantId);
                    // Small delay between connections
                    await new Promise((resolve) => setTimeout(resolve, 400));
                    // Remove from pending after offer is sent
                    setTimeout(() => {
                      pendingOffersRef.current.delete(participantId);
                    }, 2000);
                  } catch (err) {
                    console.error(
                      `❌ Failed to create connection with ${participantId}:`,
                      err,
                    );
                    pendingOffersRef.current.delete(participantId);
                  }
                }
              })();
            } else {
              console.log("✅ All peer connections exist");

              // Even if connections exist, verify they're working and have tracks
              otherParticipants.forEach((participantId) => {
                const pc = peerConnections.get(participantId);
                if (pc) {
                  const receivers = pc.getReceivers();
                  const tracks = receivers.map((r) => r.track).filter(Boolean);
                  const videoTracks = tracks.filter(
                    (t) => t.kind === "video" && t.readyState === "live",
                  );

                  console.log(`📊 Participant ${participantId}:`, {
                    connectionState: pc.connectionState,
                    iceConnectionState: pc.iceConnectionState,
                    receivers: receivers.length,
                    tracks: tracks.length,
                    videoTracks: videoTracks.length,
                  });

                  // If connection is established but no video tracks, try to fix it
                  if (
                    (pc.connectionState === "connected" ||
                      pc.iceConnectionState === "connected") &&
                    videoTracks.length === 0
                  ) {
                    console.warn(
                      `⚠️ Participant ${participantId} has connection but no video tracks, will be fixed by verification`,
                    );
                  }
                }
              });
            }
          }, 2000); // Reduced delay for faster recovery
        }
      },
    );

    // Handle room joined confirmation
    socket.on(
      "room-joined",
      ({ roomId, participantCount, otherParticipants }) => {
        console.log("✅ Room joined successfully:", {
          roomId,
          participantCount,
          otherParticipants,
          socketId: socket.id,
          isGuest: isGuestMode,
        });
        setParticipantCount(participantCount);

        // Reset offer received flag
        offerReceivedRef.current = false;

        // Clear any existing timeout
        if (offerTimeoutRef.current) {
          clearTimeout(offerTimeoutRef.current);
          offerTimeoutRef.current = null;
        }

        // If there are other participants, create peer connections with all of them
        if (
          participantCount > 1 &&
          otherParticipants &&
          otherParticipants.length > 0
        ) {
          console.log(
            "👥 Other participants already in room:",
            otherParticipants,
          );
          console.log("👥 Creating peer connections with all participants...");

          // Wait a bit to ensure all participants are ready, then create connections
          offerTimeoutRef.current = setTimeout(() => {
            // Create peer connections with all existing participants
            // Use sequential creation to avoid race conditions
            (async () => {
              for (const participantId of otherParticipants) {
                // Skip if trying to connect to self
                if (participantId === socket.id) {
                  console.warn(
                    `⚠️ Skipping self in otherParticipants: ${participantId}`,
                  );
                  continue;
                }

                const peerConnections = getPeerConnections();
                
                // Check if we're already creating an offer to this participant
                if (pendingOffersRef.current.has(participantId)) {
                  console.log(`⏳ Already creating offer to ${participantId}, skipping...`);
                  continue;
                }
                
                if (!peerConnections.has(participantId)) {
                  console.log(
                    `📞 Creating connection with ${participantId}...`,
                  );
                  pendingOffersRef.current.add(participantId);
                  try {
                    await startCallWithParticipant(participantId);
                    // Small delay between connections to avoid overwhelming the system
                    await new Promise((resolve) => setTimeout(resolve, 200));
                    // Remove from pending after offer is sent
                    setTimeout(() => {
                      pendingOffersRef.current.delete(participantId);
                    }, 2000);
                  } catch (err) {
                    console.error(`❌ Failed to create connection with ${participantId}:`, err);
                    pendingOffersRef.current.delete(participantId);
                  }
                } else {
                  console.log(
                    `⚠️ Already have connection with ${participantId}, skipping`,
                  );
                }
              }
            })();
            offerTimeoutRef.current = null;
          }, 1500); // Increased delay to ensure both sides are ready
        } else {
          // We're the first one - wait for others to join
          // The offer will be sent when another user joins (via user-joined event)
          console.log(
            "👤 First participant, waiting for another participant to join...",
          );
          console.log(
            "💡 Will create peer connections when other users join the room",
          );
        }
      },
    );

    // Cleanup on unmount
    return () => {
      // Clear any pending timeouts
      if (offerTimeoutRef.current) {
        clearTimeout(offerTimeoutRef.current);
        offerTimeoutRef.current = null;
      }
      // Clear pending offers tracking
      pendingOffersRef.current.clear();

      // Remove all event listeners
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("room-update");
      socket.off("room-joined");
      socket.off("join-room-error");
      socket.off("media-state");
    };

    // Handle room join error
    socket.on("join-room-error", ({ message }) => {
      console.error("❌ Room join error:", message);
      setError(`Failed to join room: ${message}`);
      setHasJoinedRoom(false);
    });

    // Periodic check for missing connections (especially important for 5+ participants)
    const periodicCheckInterval = setInterval(() => {
      if (hasJoinedRoom && participantCount > 1 && socket) {
        // Request room update to get current participant list
        socket.emit("get-room-info", { roomId });
      }
    }, 5000); // Check every 5 seconds

    return () => {
      clearInterval(periodicCheckInterval);
    };
  }, [
    socket,
    hasJoinedRoom,
    participantCount,
    roomId,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    startCallWithParticipant,
    getPeerConnections,
  ]);

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

  // Fetch user's meetings
  useEffect(() => {
    if (user) {
      fetchMeetings();
    }
  }, [user]);

  // Countdown timer for created meeting
  useEffect(() => {
    if (!createdMeeting) return;

    const interval = setInterval(() => {
      const now = new Date();
      const expiresAt = new Date(createdMeeting.expiresAt);
      const diff = expiresAt - now;

      if (diff <= 0) {
        setTimeRemaining(null);
        setCreatedMeeting(null);
        fetchMeetings();
        clearInterval(interval);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining({
        hours,
        minutes,
        seconds,
        total: diff,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [createdMeeting]);

  const fetchMeetings = async () => {
    try {
      const response = await meetingAPI.getUserMeetings({ status: "active" });
      if (response.data.success) {
        setMeetings(response.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching meetings:", error);
    }
  };

  const onCreateMeeting = async (data) => {
    setCreateMeetingLoading(true);
    try {
      const response = await meetingAPI.createMeeting(data);
      if (response.data.success) {
        const meeting = response.data.data;
        setCreatedMeeting(meeting);
        toast.success("Meeting created successfully!");
        resetMeeting();
        fetchMeetings();
        // Auto-set room ID and switch to join view
        setRoomId(meeting.roomId);
        setShowCreateMeeting(false);
      } else {
        toast.error(response.data.error || "Failed to create meeting");
      }
    } catch (error) {
      console.error("Error creating meeting:", error);
      toast.error(error.response?.data?.error || "Failed to create meeting");
    } finally {
      setCreateMeetingLoading(false);
    }
  };

  const handleEndMeeting = async (meetingIdToEnd) => {
    if (!confirm("Are you sure you want to end this meeting?")) return;

    try {
      const response = await meetingAPI.endMeeting(meetingIdToEnd);
      if (response.data.success) {
        toast.success("Meeting ended successfully");
        if (createdMeeting?.meetingId === meetingIdToEnd) {
          setCreatedMeeting(null);
          setTimeRemaining(null);
        }
        fetchMeetings();
      } else {
        toast.error(response.data.error || "Failed to end meeting");
      }
    } catch (error) {
      console.error("Error ending meeting:", error);
      toast.error(error.response?.data?.error || "Failed to end meeting");
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const shareMeetingLink = async (link) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join my meeting",
          text: `Join my meeting: ${createdMeeting?.title || "Video Call"}`,
          url: link,
        });
      } else {
        copyToClipboard(link);
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        copyToClipboard(link);
      }
    }
  };

  const formatTimeRemaining = () => {
    if (!timeRemaining) return "Expired";
    const { hours, minutes, seconds } = timeRemaining;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  // Check if guest needs to enter name
  useEffect(() => {
    const urlMeetingId = searchParams.get("meetingId");
    const urlRoomId = searchParams.get("roomid");
    
    // Check localStorage for authentication
    const hasUserToken = !!localStorage.getItem("token");
    const hasUserData = !!localStorage.getItem("user");
    const isLoggedIn = hasUserToken && hasUserData;
    const hasGuestToken = !!localStorage.getItem("guestToken");
    
    // Show form if: roomid exists (meeting or regular room), no guest token, user not logged in
    if (
      urlRoomId && 
      !hasGuestToken && 
      !showGuestNameForm && 
      !hasJoinedRoom &&
      !isLoggedIn
    ) {
      console.log("Showing guest name form for room:", urlRoomId);
      setShowGuestNameForm(true);
    }
  }, [searchParams, showGuestNameForm, hasJoinedRoom]);

  // Handle guest name submission
  const handleGuestNameSubmit = async (e) => {
    e.preventDefault();
    
    if (!guestNameInput.trim() || guestNameInput.trim().length < 2) {
      toast.error("Please enter a valid name (at least 2 characters)");
      return;
    }

    if (guestNameInput.trim().length > 50) {
      toast.error("Name must be less than 50 characters");
      return;
    }

    const nameRegex = /^[a-zA-Z0-9\s\-_.,!?]+$/;
    if (!nameRegex.test(guestNameInput.trim())) {
      toast.error("Name contains invalid characters");
      return;
    }

    setGuestNameLoading(true);
    try {
      const urlMeetingId = searchParams.get("meetingId");
      const urlRoomId = searchParams.get("roomid");
      
      // If it's a meeting link, validate with backend
      if (urlMeetingId) {
        const response = await meetingAPI.joinAsGuest(urlMeetingId, guestNameInput.trim());
        if (response.data.success) {
          const { token } = response.data.data;
          localStorage.setItem("guestToken", token);
          localStorage.setItem("guestName", guestNameInput.trim());
          localStorage.setItem("guestMeetingId", urlMeetingId);
          
          toast.success("Welcome, " + guestNameInput.trim() + "!");
          setShowGuestNameForm(false);
          
          // Refresh to reload guest token and reinitialize socket
          window.location.reload();
          return;
        } else {
          toast.error(response.data.error || "Failed to join as guest");
          setGuestNameLoading(false);
          return;
        }
      } else if (urlRoomId) {
        // Regular room (not a meeting) - just store guest name locally
        localStorage.setItem("guestToken", "guest-" + Date.now()); // Simple token for non-meeting rooms
        localStorage.setItem("guestName", guestNameInput.trim());
        
        toast.success("Welcome, " + guestNameInput.trim() + "!");
        setShowGuestNameForm(false);
        
        // Refresh to reload guest token and reinitialize socket
        window.location.reload();
        return;
      } else {
        toast.error("Room ID not found");
        setGuestNameLoading(false);
        return;
      }
    } catch (error) {
      console.error("Error joining as guest:", error);
      const errorMessage =
        error.response?.data?.error ||
        (error.response?.status === 410
          ? "This meeting has expired"
          : "Failed to join as guest");
      toast.error(errorMessage);
      
      if (error.response?.status === 410) {
        setTimeout(() => {
          navigate("/", { replace: true });
        }, 2000);
      }
    } finally {
      setGuestNameLoading(false);
    }
  };

  // Check for roomid query parameter and auto-join
  useEffect(() => {
    const roomIdParam = searchParams.get("roomid");
    const urlMeetingId = searchParams.get("meetingId");
    
    // Don't auto-join if guest name form should be shown
    if (showGuestNameForm) {
      return;
    }
    
    if (roomIdParam && !hasJoinedRoom && socket && isConnected) {
      // Check localStorage
      const hasUserToken = !!localStorage.getItem("token");
      const hasUserData = !!localStorage.getItem("user");
      const isLoggedIn = hasUserToken && hasUserData;
      const hasGuestToken = !!localStorage.getItem("guestToken");
      
      // If not logged in and no guest token, show name form (for both meeting and regular rooms)
      if (!hasGuestToken && !isLoggedIn) {
        console.log("Auto-join blocked - need guest name");
        setShowGuestNameForm(true);
        return;
      }

      // For registered users joining via meeting link, ensure they're authenticated
      if (urlMeetingId && !hasGuestToken && !isLoggedIn && !user) {
        const currentPath = `/call?roomid=${roomIdParam}&meetingId=${urlMeetingId}`;
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
        return;
      }

      const normalizedRoomId = normalizeRoomId(roomIdParam);
      setRoomId(normalizedRoomId);
      setTimeout(() => {
        handleJoinRoom(normalizedRoomId);
      }, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchParams,
    socket,
    isConnected,
    hasJoinedRoom,
    meetingId,
    user,
    showGuestNameForm,
  ]);

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
          title: "Join my video call",
          text: `Join my video call room: ${roomId}`,
          url: shareLink,
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareLink);
        toast.success("Room link copied to clipboard!");
      }
    } catch (error) {
      // User cancelled share or error occurred, fallback to clipboard
      if (error.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(shareLink);
          toast.success("Room link copied to clipboard!");
        } catch (clipboardError) {
          toast.error("Failed to copy link");
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

  if (!hasJoinedRoom) {
    // Show guest name form if needed
    const urlRoomId = searchParams.get("roomid");
    const urlMeetingId = searchParams.get("meetingId");
    const hasUserToken = !!localStorage.getItem("token");
    const hasUserData = !!localStorage.getItem("user");
    const isLoggedIn = hasUserToken && hasUserData;
    const hasGuestToken = !!localStorage.getItem("guestToken");
    
    // Show form if: roomid exists (meeting or regular room), no guest token, user not logged in
    const shouldShowGuestForm = 
      urlRoomId && 
      !hasGuestToken && 
      !isLoggedIn;
    
    // Always show form if flag is set OR conditions are met
    if (showGuestNameForm || shouldShowGuestForm) {
      console.log("Rendering guest name form:", { showGuestNameForm, shouldShowGuestForm, urlRoomId });
      return (
        <div className="min-h-screen bg-background flex flex-col">
          <Header />
          <div className="flex-1 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Enter Your Name</CardTitle>
                <CardDescription>
                  Please enter your name to join the video call
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGuestNameSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="guestName">Your Name</Label>
                    <Input
                      id="guestName"
                      placeholder="Enter your name"
                      value={guestNameInput}
                      onChange={(e) => setGuestNameInput(e.target.value)}
                      disabled={guestNameLoading}
                      autoFocus
                      minLength={2}
                      maxLength={50}
                    />
                    <p className="text-xs text-muted-foreground">
                      Name must be 2-50 characters
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={guestNameLoading || !guestNameInput.trim()}
                    className="w-full"
                    size="lg"
                  >
                    {guestNameLoading ? "Joining..." : "Join Meeting"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl space-y-4">
            {/* Tabs for Join/Create */}
            {user && (
              <div className="flex gap-2 mb-4">
                <Button
                  variant={!showCreateMeeting ? "default" : "outline"}
                  onClick={() => setShowCreateMeeting(false)}
                  className="flex-1"
                >
                  Join Room
                </Button>
                <Button
                  variant={showCreateMeeting ? "default" : "outline"}
                  onClick={() => setShowCreateMeeting(true)}
                  className="flex-1"
                >
                  Create Meeting
                </Button>
              </div>
            )}

            {/* Create Meeting Section */}
            {showCreateMeeting && user && (
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle>Create Meeting</CardTitle>
                  <CardDescription>
                    Create a shareable meeting link that expires in 1 hour
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form
                    onSubmit={handleSubmitMeeting(onCreateMeeting)}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="meetingTitle">
                        Meeting Title (Optional)
                      </Label>
                      <Input
                        id="meetingTitle"
                        placeholder="e.g., Team Standup, Client Call"
                        {...registerMeeting("title")}
                      />
                      {meetingErrors.title && (
                        <p className="text-sm text-destructive">
                          {meetingErrors.title.message}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={createMeetingLoading}
                      className="w-full"
                    >
                      {createMeetingLoading ? "Creating..." : "Create Meeting"}
                    </Button>
                  </form>

                  {/* Created Meeting Display */}
                  {createdMeeting && (
                    <div className="mt-4 p-4 border border-primary rounded-lg space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <LuClock className="w-4 h-4" />
                        <span>Expires in {formatTimeRemaining()}</span>
                      </div>
                      {createdMeeting.title && (
                        <div>
                          <Label className="text-sm font-semibold">Title</Label>
                          <p className="text-sm text-muted-foreground">
                            {createdMeeting.title}
                          </p>
                        </div>
                      )}
                      <div>
                        <Label className="text-sm font-semibold">
                          Meeting Link
                        </Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            value={createdMeeting.shareableLink}
                            readOnly
                            className="font-mono text-sm"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              copyToClipboard(createdMeeting.shareableLink)
                            }
                            title="Copy link"
                          >
                            <LuCopy className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              shareMeetingLink(createdMeeting.shareableLink)
                            }
                            title="Share link"
                          >
                            <LuShare2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          onClick={() => {
                            setRoomId(createdMeeting.roomId);
                            setShowCreateMeeting(false);
                            handleJoinRoom(createdMeeting.roomId);
                          }}
                          className="flex-1"
                        >
                          Join Meeting
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() =>
                            handleEndMeeting(createdMeeting.meetingId)
                          }
                        >
                          <LuTrash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Active Meetings List */}
                  {meetings.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <Label className="text-sm font-semibold">
                        Active Meetings
                      </Label>
                      {meetings.map((meeting) => (
                        <div
                          key={meeting._id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="font-semibold text-sm">
                              {meeting.title || "Untitled Meeting"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {meeting.participantCount || 0} participants
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setRoomId(meeting.roomId);
                                setShowCreateMeeting(false);
                                handleJoinRoom(meeting.roomId);
                              }}
                            >
                              Join
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() =>
                                handleEndMeeting(meeting.meetingId)
                              }
                            >
                              <LuTrash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Join Room Section */}
            {!showCreateMeeting && (
              <Card className="w-full">
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
                      <p className="font-semibold mb-1">
                        ⚠️ Secure Context Required
                      </p>
                      <p className="text-xs">
                        WebRTC requires HTTPS or localhost. You're accessing via
                        HTTP from a network IP. For best results, access via{" "}
                        <code className="bg-yellow-500/20 px-1 rounded">
                          localhost:5173
                        </code>{" "}
                        or set up HTTPS.
                      </p>
                    </div>
                  )}

                  {!browserSupport.getUserMedia && (
                    <div className="p-3 bg-red-500/10 text-red-600 text-sm rounded-md border border-red-500/20">
                      <p className="font-semibold mb-1">
                        ❌ Browser Not Supported
                      </p>
                      <p className="text-xs">
                        Your browser doesn't support getUserMedia. Please use
                        Chrome, Firefox, or Edge.
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
                        onKeyPress={(e) =>
                          e.key === "Enter" && handleJoinRoom()
                        }
                        onBlur={(e) => {
                          // Normalize on blur to show user the actual room ID
                          const normalized = normalizeRoomId(e.target.value);
                          if (normalized && normalized !== e.target.value) {
                            setRoomId(normalized);
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        onClick={generateRoomId}
                        title="Generate random room ID"
                      >
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
                      <summary className="cursor-pointer hover:text-foreground">
                        Debug Info
                      </summary>
                      <div className="mt-2 space-y-1 p-2 bg-muted rounded">
                        <p>
                          Socket URL:{" "}
                          {socket?.io?.uri ||
                            window.location.hostname + ":3001"}
                        </p>
                        <p>
                          Connection Status:{" "}
                          {isConnected ? "✅ Connected" : "❌ Disconnected"}
                        </p>
                        <p>Socket ID: {socket?.id || "N/A"}</p>
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
                    {isConnected ? "Join Room" : "Connecting..."}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header hideNavigation={hasJoinedRoom} />
      <div className="flex-1 p-4">
        <div className="container mx-auto max-w-7xl h-[calc(100vh-4rem-1px)] flex flex-col gap-4">
          {/* Room Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl flex justify-start items-center gap-1 font-bold">
                Room: {roomId}
                <div
                  className="cursor-pointer ml-2 hover:bg-gray-200 rounded-full p-2 transition-all duration-300"
                  onClick={() => {
                    navigator.clipboard.writeText(roomId);
                    toast.success("Room ID copied to clipboard");
                  }}
                >
                  <LuCopy className="w-4 h-4 text-muted-foreground hover:text-gray-900" />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShareRoom}
                  className="ml-2 flex items-center gap-2"
                  title="Share room link"
                >
                  <LuShare2 className="w-4 h-4" />
                  Share
                </Button>
              </h1>
              <p className="text-sm text-muted-foreground">
                {participantCount} participant
                {participantCount !== 1 ? "s" : ""} in room
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleLeaveRoom}>
                Leave Room
              </Button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
              {error}
            </div>
          )}

          {/* Video Grid - Dynamic based on participant count */}
          {(() => {
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
              })),
            ];

            // Sort participants to ensure consistent ordering (local first, then by ID)
            allParticipants.sort((a, b) => {
              if (a.isLocal) return -1;
              if (b.isLocal) return 1;
              return a.id.localeCompare(b.id);
            });

            // Use actual participant count (at least 1 for local user)
            const totalParticipants = Math.max(participantCount, allParticipants.length);

            // Calculate optimal grid layout based on participant count
            const calculateGridLayout = (count) => {
              // Ensure count is at least 1
              const actualCount = Math.max(count, 1);
              
              if (actualCount === 1) {
                return { rows: 1, cols: 1, layout: [[1]] };
              } else if (actualCount === 2) {
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
              // If no participants, show waiting message
              if (allParticipants.length === 0) {
                return (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p>Initializing camera...</p>
                    </div>
                  </div>
                );
              }

              const rows = [];
              let participantIndex = 0;
              const numRows = gridConfig.rows;
              const gapSize = 16; // gap-4 = 1rem = 16px

              for (
                let rowIndex = 0;
                rowIndex < gridConfig.layout.length;
                rowIndex++
              ) {
                const itemsInRow = gridConfig.layout[rowIndex][0];
                const rowParticipants = allParticipants.slice(
                  participantIndex,
                  participantIndex + itemsInRow,
                );
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
                      maxWidth: needsCentering
                        ? `${(itemsInRow / gridConfig.cols) * 100}%`
                        : "100%",
                      margin: needsCentering ? "0 auto" : "0",
                      height: rowHeight,
                      minHeight: rowHeight,
                    }}
                  >
                    {rowParticipants.map((participant) => {
                      const mediaState = participant.isLocal
                        ? {
                            videoEnabled: isVideoEnabled,
                            audioEnabled: isAudioEnabled,
                          }
                        : remoteMediaStates.get(participant.id) || {
                            videoEnabled: true,
                            audioEnabled: true,
                          };
                      const connectionState = participant.isLocal
                        ? "connected"
                        : connectionStates.get(participant.id) ||
                          "disconnected";

                      return (
                        <div
                          key={participant.id}
                          className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden"
                        >
                          {participant.stream ? (
                            <VideoPlayer
                              stream={participant.stream}
                              isLocal={participant.isLocal}
                              isVideoEnabled={mediaState.videoEnabled}
                              isAudioEnabled={mediaState.audioEnabled}
                              className="h-full w-full"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg">
                              <div className="text-center text-white">
                                <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-sm">
                                  {participant.isLocal
                                    ? "Initializing camera..."
                                    : "Waiting for video..."}
                                </p>
                              </div>
                            </div>
                          )}
                          {participant.isLocal && (
                            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-10">
                              {isGuestMode
                                ? guestName || "Guest"
                                : user?.name || "You"}
                              {isGuestMode && (
                                <span className="ml-1 text-[10px] opacity-75">
                                  (Guest)
                                </span>
                              )}
                            </div>
                          )}
                          {!participant.isLocal && (
                            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-10">
                              {connectionState === "connected" ? "✓" : "⏳"}{" "}
                              {(() => {
                                const participantInfo = participantNames.get(participant.id);
                                if (participantInfo) {
                                  return participantInfo.name + (participantInfo.type === 'guest' ? ' (Guest)' : '');
                                }
                                // Fallback to socket ID if name not available yet
                                return participant.id.substring(0, 8);
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Placeholder for missing participants in this row */}
                    {rowParticipants.length < itemsInRow &&
                      Array.from({
                        length: itemsInRow - rowParticipants.length,
                      }).map((_, i) => (
                        <div
                          key={`placeholder-${rowIndex}-${i}`}
                          className="w-full h-full bg-gray-900 rounded-lg flex items-center justify-center"
                        >
                          <p className="text-muted-foreground text-sm">
                            Waiting...
                          </p>
                        </div>
                      ))}
                  </div>,
                );
              }

              return rows;
            };

            const renderedRows = renderGridRows();
            
            // Debug logging
            console.log("Video grid render:", {
              participantCount,
              allParticipantsLength: allParticipants.length,
              allParticipants: allParticipants.map(p => ({ id: p.id, isLocal: p.isLocal, hasStream: !!p.stream })),
              gridConfig,
              renderedRowsLength: Array.isArray(renderedRows) ? renderedRows.length : 'not array'
            });
            
            return (
              <div
                className="flex-1 flex flex-col gap-4"
                style={{ height: "100%", overflow: "hidden", minHeight: "400px" }}
              >
                {renderedRows && Array.isArray(renderedRows) && renderedRows.length > 0 ? (
                  renderedRows
                ) : allParticipants.length > 0 ? (
                  // Fallback: render participants directly if grid failed
                  <div className="grid gap-4 w-full h-full" style={{ gridTemplateColumns: '1fr' }}>
                    {allParticipants.map((participant) => {
                      const mediaState = participant.isLocal
                        ? { videoEnabled: isVideoEnabled, audioEnabled: isAudioEnabled }
                        : remoteMediaStates.get(participant.id) || { videoEnabled: true, audioEnabled: true };
                      
                      return (
                        <div key={participant.id} className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
                          {participant.stream ? (
                            <VideoPlayer
                              stream={participant.stream}
                              isLocal={participant.isLocal}
                              isVideoEnabled={mediaState.videoEnabled}
                              isAudioEnabled={mediaState.audioEnabled}
                              className="h-full w-full"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg">
                              <div className="text-center text-white">
                                <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-sm">
                                  {participant.isLocal ? "Initializing camera..." : "Waiting for video..."}
                                </p>
                              </div>
                            </div>
                          )}
                          {participant.isLocal && (
                            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-10">
                              {isGuestMode && guestName ? guestName : user?.name || "You"}
                              {isGuestMode && guestName && (
                                <span className="ml-1 text-[10px] opacity-75">(Guest)</span>
                              )}
                            </div>
                          )}
                          {!participant.isLocal && (
                            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-10">
                              {(() => {
                                const participantInfo = participantNames.get(participant.id);
                                const connectionState = connectionStates.get(participant.id) || "connecting";
                                const statusIcon = connectionState === "connected" ? "✓" : "⏳";
                                if (participantInfo) {
                                  return `${statusIcon} ${participantInfo.name}${participantInfo.type === 'guest' ? ' (Guest)' : ''}`;
                                }
                                // Fallback to socket ID if name not available yet
                                return `${statusIcon} ${participant.id.substring(0, 8)}`;
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p>Initializing camera...</p>
                    </div>
                  </div>
                )}

                {/* Show message if we're waiting for more participants */}
                {participantCount > allParticipants.length && (
                  <div className="text-center text-muted-foreground text-sm py-2 flex-shrink-0">
                    Waiting for {participantCount - allParticipants.length} more
                    participant(s)...
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
            connectionState={
              Array.from(connectionStates.values()).some(
                (state) => state === "connected",
              )
                ? "connected"
                : Array.from(connectionStates.values()).some(
                      (state) => state === "connecting",
                    )
                  ? "connecting"
                  : "disconnected"
            }
            participantCount={participantCount}
          />
        </div>
      </div>
    </div>
  );
}
