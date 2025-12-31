// Room management
const rooms = new Map();

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
    socket.on('join-room', ({ roomId, userId }) => {
      // Normalize room ID to ensure consistency
      const normalizedRoomId = normalizeRoomId(roomId);
      
      if (!normalizedRoomId) {
        console.error('❌ Invalid room ID:', roomId);
        socket.emit('join-room-error', { message: 'Invalid room ID' });
        return;
      }

      console.log(`👤 User ${userId} (${socket.id}) joining room "${normalizedRoomId}"`);
      
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
      
      // Track room participants
      if (!rooms.has(normalizedRoomId)) {
        rooms.set(normalizedRoomId, new Set());
        console.log(`🆕 Created new room: ${normalizedRoomId}`);
      }
      rooms.get(normalizedRoomId).add(socket.id);

      // Get list of other participants in the room
      const otherParticipants = Array.from(rooms.get(normalizedRoomId))
        .filter(id => id !== socket.id);

      // Notify others in the room
      socket.to(normalizedRoomId).emit('user-joined', { userId, socketId: socket.id });

      // Send current room participants count and room info
      const participantCount = rooms.get(normalizedRoomId).size;
      io.to(normalizedRoomId).emit('room-update', { 
        participantCount,
        roomId: normalizedRoomId,
        otherParticipants 
      });

      // Confirm join to the client
      socket.emit('room-joined', { 
        roomId: normalizedRoomId,
        participantCount,
        otherParticipants 
      });

      console.log(`📊 Room "${normalizedRoomId}" now has ${participantCount} participant(s)`);
      if (otherParticipants.length > 0) {
        console.log(`👥 Other participants: ${otherParticipants.join(', ')}`);
      }
    });

    // Handle WebRTC offer
    socket.on('offer', ({ offer, roomId, targetId }) => {
      if (targetId) {
        // Send to specific target
        console.log(`📤 Offer from ${socket.id} to ${targetId} in room ${roomId}`);
        socket.to(targetId).emit('offer', { offer, from: socket.id });
      } else {
        // Broadcast to all others in the room
        console.log(`📤 Offer from ${socket.id} to all in room ${roomId}`);
        socket.to(roomId).emit('offer', { offer, from: socket.id });
      }
    });

    // Handle WebRTC answer
    socket.on('answer', ({ answer, roomId, targetId }) => {
      if (targetId) {
        // Send to specific target
        console.log(`📥 Answer from ${socket.id} to ${targetId} in room ${roomId}`);
        socket.to(targetId).emit('answer', { answer, from: socket.id });
      } else {
        // Broadcast to all others in the room
        console.log(`📥 Answer from ${socket.id} to all in room ${roomId}`);
        socket.to(roomId).emit('answer', { answer, from: socket.id });
      }
    });

    // Handle ICE candidates
    socket.on('ice-candidate', ({ candidate, roomId, targetId }) => {
      if (targetId) {
        // Send to specific target
        socket.to(targetId).emit('ice-candidate', { candidate, from: socket.id });
      } else {
        // Broadcast to all others in the room
        socket.to(roomId).emit('ice-candidate', { candidate, from: socket.id });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.id}`);

      // Remove from all rooms
      rooms.forEach((participants, roomId) => {
        if (participants.has(socket.id)) {
          participants.delete(socket.id);
          
          // Notify others in the room
          socket.to(roomId).emit('user-left', { socketId: socket.id });
          
          const participantCount = participants.size;
          io.to(roomId).emit('room-update', { participantCount });

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

    // Leave room explicitly
    socket.on('leave-room', ({ roomId }) => {
      console.log(`👋 User ${socket.id} leaving room ${roomId}`);
      
      socket.leave(roomId);
      
      if (rooms.has(roomId)) {
        rooms.get(roomId).delete(socket.id);
        socket.to(roomId).emit('user-left', { socketId: socket.id });
        
        const participantCount = rooms.get(roomId).size;
        io.to(roomId).emit('room-update', { participantCount });

        if (rooms.get(roomId).size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
}

