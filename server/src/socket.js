// Room management
const rooms = new Map();

// Import Meeting model and guest token utilities
import Meeting from './models/Meeting.js';
import User from './models/User.js';
import { verifyGuestToken } from './utils/guestToken.js';

// Export function to get active rooms
export function getActiveRooms() {
  const activeRooms = [];
  rooms.forEach((participants, roomId) => {
    if (participants.size > 0) {
      activeRooms.push({
        roomId,
        participantCount: participants.size,
        participants: Array.from(participants),
      });
    }
  });
  return activeRooms.sort((a, b) => b.participantCount - a.participantCount); // Sort by participant count
}

export function setupSocket(io) {
  // Log all connection attempts
  io.engine.on('connection_error', (err) => {
    console.error('❌ Socket.io connection error:', err);
    console.error('Error details:', {
      message: err.message,
      type: err.type,
      description: err.description,
      context: err.context,
      req: err.req ? {
        headers: err.req.headers,
        url: err.req.url,
        method: err.req.method,
        origin: err.req.headers.origin,
      } : null,
    });
  });

  // Log polling requests
  io.engine.on('request', (req, res) => {
    if (req.url?.includes('socket.io')) {
      console.log('📡 Socket.io request:', {
        method: req.method,
        url: req.url,
        origin: req.headers.origin,
        transport: req._query?.transport || 'unknown',
      });
    }
  });

  // Log transport upgrades
  io.engine.on('upgrade', (req, socket, head) => {
    console.log('⬆️  Transport upgrade attempt:', req.headers.origin || 'no origin');
  });

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.id}`);
    console.log(`📡 Transport: ${socket.conn.transport.name}`);
    console.log(`🌐 Remote address: ${socket.handshake.address}`);
    console.log(`🔗 Origin: ${socket.handshake.headers.origin}`);

    // Normalize room ID (trim and lowercase)
    const normalizeRoomId = (id) => {
      if (!id) return null;
      return String(id).trim().toLowerCase();
    };

    // Join a room
    socket.on('join-room', async ({ roomId, userId, guestName, meetingId, guestToken }) => {
      // Normalize room ID to ensure consistency
      const normalizedRoomId = normalizeRoomId(roomId);
      
      if (!normalizedRoomId) {
        console.error('❌ Invalid room ID:', roomId);
        socket.emit('join-room-error', { message: 'Invalid room ID' });
        return;
      }

      let meeting = null;
      let participantType = 'registered';
      let displayName = userId || 'Unknown';
      let userName = null; // Will store the actual user name for registered users

      // If meetingId is provided, validate and track in Meeting model
      if (meetingId) {
        try {
          meeting = await Meeting.findOne({ meetingId });

          if (!meeting) {
            socket.emit('join-room-error', { message: 'Meeting not found' });
            return;
          }

          // Check if expired
          if (meeting.isExpired() && meeting.status === 'active') {
            await meeting.markExpired();
            socket.emit('join-room-error', { message: 'This meeting has expired' });
            return;
          }

          // Check if meeting can be joined
          if (!meeting.canJoin()) {
            socket.emit('join-room-error', { 
              message: 'This meeting is no longer available',
              status: meeting.status 
            });
            return;
          }

          // Validate guest token if guest
          if (guestToken) {
            try {
              const decoded = verifyGuestToken(guestToken);
              if (decoded.meetingId !== meetingId) {
                socket.emit('join-room-error', { message: 'Invalid guest token for this meeting' });
                return;
              }
              participantType = 'guest';
              displayName = decoded.guestName || guestName || 'Guest';
              socket.guestInfo = decoded;
              socket.isGuest = true;
            } catch (error) {
              socket.emit('join-room-error', { message: 'Invalid or expired guest token' });
              return;
            }
          } else if (userId) {
            // Registered user joining - fetch user name
            participantType = 'registered';
            socket.userId = userId;
            socket.isGuest = false;
            try {
              const user = await User.findById(userId);
              if (user && user.name) {
                displayName = user.name;
                userName = user.name;
              }
            } catch (error) {
              console.error('Error fetching user name:', error);
              // Fallback to userId if name fetch fails
              displayName = userId;
            }
          } else {
            socket.emit('join-room-error', { message: 'Authentication required' });
            return;
          }

          // Store meeting info on socket
          socket.meetingId = meetingId;
          socket.participantType = participantType;

          // Add participant to Meeting model
          const ipAddress = socket.handshake.address;
          if (participantType === 'registered') {
            await meeting.addRegisteredParticipant(userId, socket.id);
            console.log(`👤 Registered user ${userId} (${socket.id}) joining meeting "${meetingId}"`);
          } else {
            await meeting.addGuestParticipant(displayName, socket.id, ipAddress);
            console.log(`👤 Guest "${displayName}" (${socket.id}) joining meeting "${meetingId}"`);
          }
        } catch (error) {
          console.error('Error tracking participant in meeting:', error);
          socket.emit('join-room-error', { message: 'Failed to join meeting' });
          return;
        }
      } else if (guestToken) {
        // Guest joining regular room (not a meeting)
        try {
          // Try to verify token (might be a simple token for non-meeting rooms)
          try {
            const decoded = verifyGuestToken(guestToken);
            participantType = 'guest';
            displayName = decoded.guestName || guestName || 'Guest';
            socket.guestInfo = decoded;
            socket.isGuest = true;
          } catch (error) {
            // If token verification fails, it might be a simple token for regular rooms
            // Allow it if guestName is provided
            if (guestName) {
              participantType = 'guest';
              displayName = guestName;
              socket.isGuest = true;
              socket.guestInfo = { guestName };
            } else {
              socket.emit('join-room-error', { message: 'Guest name required' });
              return;
            }
          }
          console.log(`👤 Guest "${displayName}" (${socket.id}) joining room "${normalizedRoomId}"`);
        } catch (error) {
          socket.emit('join-room-error', { message: 'Invalid guest token' });
          return;
        }
      } else if (userId) {
        // Regular room join (not via meeting link) - registered user
        participantType = 'registered';
        socket.userId = userId;
        socket.isGuest = false;
        try {
          const user = await User.findById(userId);
          if (user && user.name) {
            displayName = user.name;
            userName = user.name;
          }
        } catch (error) {
          console.error('Error fetching user name:', error);
          displayName = userId;
        }
        console.log(`👤 User ${displayName} (${userId}) (${socket.id}) joining room "${normalizedRoomId}"`);
      } else {
        socket.emit('join-room-error', { message: 'User ID or guest name required' });
        return;
      }
      
      // Leave any previous rooms this socket might be in
      const previousRooms = Array.from(socket.rooms);
      previousRooms.forEach(prevRoom => {
        if (prevRoom !== socket.id && rooms.has(prevRoom)) {
          socket.leave(prevRoom);
          rooms.get(prevRoom).delete(socket.id);
          console.log(`🔄 Left previous room: ${prevRoom}`);
        }
      });
      
      // Join the new room
      socket.join(normalizedRoomId);
      
      // Track room participants (in-memory for WebRTC)
      if (!rooms.has(normalizedRoomId)) {
        rooms.set(normalizedRoomId, new Set());
        console.log(`🆕 Created new room: ${normalizedRoomId}`);
      }
      rooms.get(normalizedRoomId).add(socket.id);

      // Get list of other participants in the room
      const otherParticipants = Array.from(rooms.get(normalizedRoomId))
        .filter(id => id !== socket.id);

      // Notify others in the room
      socket.to(normalizedRoomId).emit('user-joined', { 
        userId: participantType === 'registered' ? userId : null,
        userName: participantType === 'registered' ? (userName || displayName) : null,
        guestName: participantType === 'guest' ? displayName : null,
        socketId: socket.id,
        participantType
      });

      // Send current room participants count and room info
      const participantCount = rooms.get(normalizedRoomId).size;
      io.to(normalizedRoomId).emit('room-update', { 
        participantCount,
        roomId: normalizedRoomId,
        otherParticipants,
        meetingId: meetingId || null
      });

      // Confirm join to the client
      socket.emit('room-joined', { 
        roomId: normalizedRoomId,
        participantCount,
        otherParticipants,
        meetingId: meetingId || null
      });

      console.log(`📊 Room "${normalizedRoomId}" now has ${participantCount} participant(s)`);
      if (otherParticipants.length > 0) {
        console.log(`👥 Other participants: ${otherParticipants.join(', ')}`);
      }
    });

    // Handle WebRTC offer
    socket.on('offer', ({ offer, roomId, targetId }) => {
      // Normalize room ID
      const normalizedRoomId = normalizeRoomId(roomId);
      
      if (!normalizedRoomId) {
        console.error(`❌ Invalid room ID in offer: ${roomId}`);
        return;
      }
      
      // Check if socket is in the room
      const socketRooms = Array.from(socket.rooms);
      if (!socketRooms.includes(normalizedRoomId)) {
        console.error(`❌ Socket ${socket.id} not in room ${normalizedRoomId}. Current rooms: ${socketRooms.join(', ')}`);
        return;
      }
      
      // Get other participants in the room
      const otherParticipants = rooms.has(normalizedRoomId) 
        ? Array.from(rooms.get(normalizedRoomId)).filter(id => id !== socket.id)
        : [];
      
      if (targetId) {
        // Prevent sending offer to self
        if (targetId === socket.id) {
          console.error(`❌ Cannot send offer to self: ${socket.id} tried to send offer to ${targetId}`);
          return;
        }
        
        // Check if target is in the room
        if (!rooms.has(normalizedRoomId) || !rooms.get(normalizedRoomId).has(targetId)) {
          console.error(`❌ Target ${targetId} is not in room ${normalizedRoomId}`);
          return;
        }
        
        // Send to specific target
        console.log(`📤 Offer from ${socket.id} to ${targetId} in room ${normalizedRoomId}`);
        socket.to(targetId).emit('offer', { offer, from: socket.id });
      } else {
        // Broadcast to all others in the room
        console.log(`📤 Offer from ${socket.id} to all in room ${normalizedRoomId}`);
        console.log(`👥 Other participants in room: ${otherParticipants.join(', ') || 'none'}`);
        if (otherParticipants.length === 0) {
          console.warn(`⚠️  No other participants in room ${normalizedRoomId} to send offer to`);
        }
        socket.to(normalizedRoomId).emit('offer', { offer, from: socket.id });
      }
    });

    // Handle WebRTC answer
    socket.on('answer', ({ answer, roomId, targetId }) => {
      // Normalize room ID
      const normalizedRoomId = normalizeRoomId(roomId);
      
      if (!normalizedRoomId) {
        console.error(`❌ Invalid room ID in answer: ${roomId}`);
        return;
      }
      
      if (targetId) {
        // Prevent sending answer to self
        if (targetId === socket.id) {
          console.error(`❌ Cannot send answer to self: ${socket.id} tried to send answer to ${targetId}`);
          return;
        }
        
        // Check if target is in the room
        if (!rooms.has(normalizedRoomId) || !rooms.get(normalizedRoomId).has(targetId)) {
          console.error(`❌ Target ${targetId} is not in room ${normalizedRoomId}`);
          return;
        }
        
        // Send to specific target
        console.log(`📥 Answer from ${socket.id} to ${targetId} in room ${normalizedRoomId}`);
        socket.to(targetId).emit('answer', { answer, from: socket.id });
      } else {
        // Broadcast to all others in the room
        console.log(`📥 Answer from ${socket.id} to all in room ${normalizedRoomId}`);
        socket.to(normalizedRoomId).emit('answer', { answer, from: socket.id });
      }
    });

    // Handle ICE candidates
    socket.on('ice-candidate', ({ candidate, roomId, targetId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      
      if (!normalizedRoomId) {
        console.error(`❌ Invalid room ID in ice-candidate: ${roomId}`);
        return;
      }
      
      if (targetId) {
        // Prevent sending ICE candidate to self
        if (targetId === socket.id) {
          console.error(`❌ Cannot send ICE candidate to self: ${socket.id} tried to send to ${targetId}`);
          return;
        }
        
        // Check if target is in the room
        if (!rooms.has(normalizedRoomId) || !rooms.get(normalizedRoomId).has(targetId)) {
          console.error(`❌ Target ${targetId} is not in room ${normalizedRoomId}`);
          return;
        }
        
        // Send to specific target
        socket.to(targetId).emit('ice-candidate', { candidate, from: socket.id });
      } else {
        // Broadcast to all others in the room
        socket.to(normalizedRoomId).emit('ice-candidate', { candidate, from: socket.id });
      }
    });

    // Handle media state changes (video/audio on/off)
    socket.on('media-state', ({ roomId, videoEnabled, audioEnabled }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      if (!normalizedRoomId) {
        console.error(`❌ Invalid room ID in media-state: ${roomId}`);
        return;
      }
      
      // Check if socket is in the room
      const socketRooms = Array.from(socket.rooms);
      if (!socketRooms.includes(normalizedRoomId)) {
        console.error(`❌ Socket ${socket.id} not in room ${normalizedRoomId}. Current rooms: ${socketRooms.join(', ')}`);
        return;
      }
      
      // Get other participants in the room
      const otherParticipants = rooms.has(normalizedRoomId) 
        ? Array.from(rooms.get(normalizedRoomId)).filter(id => id !== socket.id)
        : [];
      
      console.log(`📹 Media state from ${socket.id} in room ${normalizedRoomId}: video=${videoEnabled}, audio=${audioEnabled}`);
      console.log(`👥 Broadcasting to ${otherParticipants.length} other participant(s): ${otherParticipants.join(', ') || 'none'}`);
      
      // Broadcast to all others in the room
      socket.to(normalizedRoomId).emit('media-state', {
        videoEnabled,
        audioEnabled,
        from: socket.id,
      });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`❌ User disconnected: ${socket.id}`);

      // Remove from Meeting model if this was a meeting participant
      if (socket.meetingId) {
        try {
          const meeting = await Meeting.findOne({ meetingId: socket.meetingId });
          if (meeting) {
            await meeting.removeParticipant(socket.id);
            console.log(`🗑️  Removed ${socket.participantType || 'participant'} from meeting ${socket.meetingId}`);
          }
        } catch (error) {
          console.error('Error removing participant from meeting:', error);
        }
      }

      // Remove from all rooms (in-memory tracking)
      rooms.forEach((participants, roomId) => {
        if (participants.has(socket.id)) {
          participants.delete(socket.id);
          
          // Notify others in the room
          socket.to(roomId).emit('user-left', { socketId: socket.id });
          
          const participantCount = participants.size;
          // Get list of remaining participants for the room-update event
          const remainingParticipants = Array.from(participants);
          io.to(roomId).emit('room-update', { 
            participantCount,
            roomId,
            otherParticipants: remainingParticipants 
          });

          // Clean up empty rooms
          if (participants.size === 0) {
            rooms.delete(roomId);
            console.log(`🗑️  Room ${roomId} deleted (empty)`);
          } else {
            console.log(`📊 Room ${roomId} now has ${participantCount} participant(s)`);
          }
        }
      });
    });

      // Handle room info request
      socket.on('get-room-info', ({ roomId: requestedRoomId }) => {
        const requestedNormalizedRoomId = normalizeRoomId(requestedRoomId);
        if (rooms.has(requestedNormalizedRoomId)) {
          const participants = rooms.get(requestedNormalizedRoomId);
          const otherParticipants = Array.from(participants).filter(id => id !== socket.id);
          socket.emit('room-update', {
            participantCount: participants.size,
            roomId: requestedNormalizedRoomId,
            otherParticipants
          });
        }
      });

      // Handle active rooms request
      socket.on('get-active-rooms', () => {
        const activeRooms = getActiveRooms();
        socket.emit('active-rooms', activeRooms);
      });

        // Leave room explicitly
        socket.on('leave-room', async ({ roomId }) => {
          const normalizedRoomId = normalizeRoomId(roomId);
          console.log(`👋 User ${socket.id} leaving room ${normalizedRoomId}`);
          
          // Remove from Meeting model if this was a meeting participant
          if (socket.meetingId) {
            try {
              const meeting = await Meeting.findOne({ meetingId: socket.meetingId });
              if (meeting) {
                await meeting.removeParticipant(socket.id);
                console.log(`🗑️  Removed ${socket.participantType || 'participant'} from meeting ${socket.meetingId}`);
              }
            } catch (error) {
              console.error('Error removing participant from meeting:', error);
            }
          }
          
          socket.leave(normalizedRoomId);
          
          if (rooms.has(normalizedRoomId)) {
            rooms.get(normalizedRoomId).delete(socket.id);
            socket.to(normalizedRoomId).emit('user-left', { socketId: socket.id });
            
            const participantCount = rooms.get(normalizedRoomId).size;
            // Get list of remaining participants for the room-update event
            const remainingParticipants = Array.from(rooms.get(normalizedRoomId));
            io.to(normalizedRoomId).emit('room-update', { 
              participantCount,
              roomId: normalizedRoomId,
              otherParticipants: remainingParticipants 
            });

            if (rooms.get(normalizedRoomId).size === 0) {
              rooms.delete(normalizedRoomId);
            }
          }
        });
  });
}

