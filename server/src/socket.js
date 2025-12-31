// Room management
const rooms = new Map();

export function setupSocket(io) {
  // Log connection attempts
  io.engine.on('connection_error', (err) => {
    console.error('❌ Socket.io connection error:', err);
    console.error('Error details:', {
      message: err.message,
      type: err.type,
      req: err.req?.headers,
    });
  });

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.id}`);
    console.log(`📡 Transport: ${socket.conn.transport.name}`);
    console.log(`🌐 Remote address: ${socket.handshake.address}`);
    console.log(`🔗 Origin: ${socket.handshake.headers.origin}`);

    // Join a room
    socket.on('join-room', ({ roomId, userId }) => {
      console.log(`👤 User ${userId} joining room ${roomId}`);
      
      socket.join(roomId);
      
      // Track room participants
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }
      rooms.get(roomId).add(socket.id);

      // Notify others in the room
      socket.to(roomId).emit('user-joined', { userId, socketId: socket.id });

      // Send current room participants count
      const participantCount = rooms.get(roomId).size;
      io.to(roomId).emit('room-update', { participantCount });

      console.log(`📊 Room ${roomId} now has ${participantCount} participant(s)`);
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

