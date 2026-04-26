// Room management
const rooms = new Map();
const participantMeta = new Map(); // socketId -> { name }

const isDev = process.env.NODE_ENV !== 'production';
const log = (...args) => isDev && console.log(...args);
const logErr = (...args) => console.error(...args);

// Remove socket from room and clean empty rooms; returns true if participant was removed
function removeSocketFromRoom(io, roomId, socketId) {
  if (!rooms.has(roomId)) return false;
  const participants = rooms.get(roomId);
  if (!participants.has(socketId)) return false;
  participants.delete(socketId);
  if (participants.size === 0) {
    rooms.delete(roomId);
    log(`🗑️  Room ${roomId} deleted (empty)`);
  }
  return true;
}

// Ensure room only contains sockets that are still connected (fixes ghost participants)
function pruneRoom(io, roomId) {
  if (!rooms.has(roomId)) return;
  const participants = rooms.get(roomId);
  const toRemove = [];
  participants.forEach((socketId) => {
    if (!io.sockets.sockets.has(socketId)) toRemove.push(socketId);
  });
  toRemove.forEach((socketId) => {
    participants.delete(socketId);
    participantMeta.delete(socketId);
    log(`🧹 Pruned ghost participant ${socketId} from room ${roomId}`);
  });
  if (participants.size === 0) rooms.delete(roomId);
}

function buildParticipantDetails(roomId, excludeSocketId = null) {
  if (!rooms.has(roomId)) return [];
  return Array.from(rooms.get(roomId))
    .filter((socketId) => socketId !== excludeSocketId)
    .map((socketId) => ({
      socketId,
      name: participantMeta.get(socketId)?.name || `User-${socketId.substring(0, 6)}`,
    }));
}

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
  // Periodic cleanup: remove ghost participants (disconnected sockets still in rooms)
  const CLEANUP_INTERVAL_MS = 60000; // 1 minute
  setInterval(() => {
    rooms.forEach((_, roomId) => pruneRoom(io, roomId));
  }, CLEANUP_INTERVAL_MS);

  // Log all connection attempts
  io.engine.on('connection_error', (err) => {
    logErr('❌ Socket.io connection error:', err.message, err.type);
  });

  io.on('connection', (socket) => {
    log(`✅ User connected: ${socket.id}`);

    // Normalize room ID (trim and lowercase)
    const normalizeRoomId = (id) => {
      if (!id) return null;
      return String(id).trim().toLowerCase();
    };

    // Join a room
    socket.on('join-room', ({ roomId, userId, userName }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      if (!normalizedRoomId) {
        socket.emit('join-room-error', { message: 'Invalid room ID' });
        return;
      }

      log(`👤 User ${userId} (${socket.id}) joining room "${normalizedRoomId}"`);
      participantMeta.set(socket.id, {
        name: (userName && String(userName).trim()) || String(userId || '').trim() || `User-${socket.id.substring(0, 6)}`,
      });

      // Prune ghost participants before we join (ensures room state is accurate)
      pruneRoom(io, normalizedRoomId);

      // Leave any previous rooms this socket might be in
      const previousRooms = Array.from(socket.rooms);
      previousRooms.forEach(prevRoom => {
        if (prevRoom !== socket.id && rooms.has(prevRoom)) {
          socket.leave(prevRoom);
          removeSocketFromRoom(io, prevRoom, socket.id);
        }
      });

      socket.join(normalizedRoomId);
      if (!rooms.has(normalizedRoomId)) {
        rooms.set(normalizedRoomId, new Set());
      }
      rooms.get(normalizedRoomId).add(socket.id);

      const otherParticipants = Array.from(rooms.get(normalizedRoomId))
        .filter(id => id !== socket.id && io.sockets.sockets.has(id));
      const otherParticipantDetails = buildParticipantDetails(normalizedRoomId, socket.id)
        .filter((p) => io.sockets.sockets.has(p.socketId));

      socket.to(normalizedRoomId).emit('user-joined', {
        userId,
        userName: participantMeta.get(socket.id)?.name,
        socketId: socket.id,
      });

      const participantCount = rooms.get(normalizedRoomId).size;
      io.to(normalizedRoomId).emit('room-update', {
        participantCount,
        roomId: normalizedRoomId,
        otherParticipants,
        participantDetails: buildParticipantDetails(normalizedRoomId),
      });

      socket.emit('room-joined', {
        roomId: normalizedRoomId,
        participantCount,
        otherParticipants,
        participantDetails: otherParticipantDetails,
      });

      log(`📊 Room "${normalizedRoomId}" now has ${participantCount} participant(s)`);
    });

    // Handle WebRTC offer
    socket.on('offer', ({ offer, roomId, targetId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      if (!normalizedRoomId || !Array.from(socket.rooms).includes(normalizedRoomId)) return;

      if (targetId) {
        if (targetId === socket.id) return;
        if (!io.sockets.sockets.has(targetId)) {
          removeSocketFromRoom(io, normalizedRoomId, targetId);
          return;
        }
        if (!rooms.has(normalizedRoomId) || !rooms.get(normalizedRoomId).has(targetId)) return;
        log(`📤 Offer ${socket.id} → ${targetId}`);
        socket.to(targetId).emit('offer', { offer, from: socket.id });
      } else {
        const roomParticipants = rooms.get(normalizedRoomId);
        if (!roomParticipants) return;
        const live = Array.from(roomParticipants).filter(id => id !== socket.id && io.sockets.sockets.has(id));
        live.forEach((id) => socket.to(id).emit('offer', { offer, from: socket.id }));
      }
    });

    // Handle WebRTC answer
    socket.on('answer', ({ answer, roomId, targetId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      if (!normalizedRoomId) return;
      if (targetId) {
        if (targetId === socket.id) return;
        if (!io.sockets.sockets.has(targetId)) {
          removeSocketFromRoom(io, normalizedRoomId, targetId);
          return;
        }
        if (!rooms.has(normalizedRoomId) || !rooms.get(normalizedRoomId).has(targetId)) return;
        socket.to(targetId).emit('answer', { answer, from: socket.id });
      } else {
        const roomParticipants = rooms.get(normalizedRoomId);
        if (!roomParticipants) return;
        Array.from(roomParticipants)
          .filter(id => id !== socket.id && io.sockets.sockets.has(id))
          .forEach((id) => socket.to(id).emit('answer', { answer, from: socket.id }));
      }
    });

    // Handle ICE candidates
    socket.on('ice-candidate', ({ candidate, roomId, targetId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      if (!normalizedRoomId) return;
      if (targetId) {
        if (targetId === socket.id) return;
        if (!io.sockets.sockets.has(targetId)) {
          removeSocketFromRoom(io, normalizedRoomId, targetId);
          return;
        }
        if (!rooms.has(normalizedRoomId) || !rooms.get(normalizedRoomId).has(targetId)) return;
        socket.to(targetId).emit('ice-candidate', { candidate, from: socket.id });
      } else {
        const roomParticipants = rooms.get(normalizedRoomId);
        if (!roomParticipants) return;
        Array.from(roomParticipants)
          .filter(id => id !== socket.id && io.sockets.sockets.has(id))
          .forEach((id) => socket.to(id).emit('ice-candidate', { candidate, from: socket.id }));
      }
    });

    // Handle media state changes (video/audio on/off)
    socket.on('media-state', ({ roomId, videoEnabled, audioEnabled }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      if (!normalizedRoomId || !Array.from(socket.rooms).includes(normalizedRoomId)) return;
      socket.to(normalizedRoomId).emit('media-state', {
        videoEnabled,
        audioEnabled,
        from: socket.id,
      });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      log(`❌ User disconnected: ${socket.id} (${reason})`);
      const roomIds = Array.from(socket.rooms).filter((r) => r !== socket.id);
      roomIds.forEach((roomId) => {
        if (!removeSocketFromRoom(io, roomId, socket.id)) return;
        const participants = rooms.get(roomId);
        const participantCount = participants ? participants.size : 0;
        const remainingParticipants = participants ? Array.from(participants) : [];
        io.to(roomId).emit('user-left', { socketId: socket.id });
        io.to(roomId).emit('room-update', {
          participantCount,
          roomId,
          otherParticipants: remainingParticipants,
          participantDetails: buildParticipantDetails(roomId),
        });
      });
      participantMeta.delete(socket.id);
    });

    socket.on('get-room-info', ({ roomId: requestedRoomId }) => {
      const requestedNormalizedRoomId = normalizeRoomId(requestedRoomId);
      pruneRoom(io, requestedNormalizedRoomId);
      if (rooms.has(requestedNormalizedRoomId)) {
        const participants = rooms.get(requestedNormalizedRoomId);
        const otherParticipants = Array.from(participants).filter(
          (id) => id !== socket.id && io.sockets.sockets.has(id)
        );
        socket.emit('room-update', {
          participantCount: participants.size,
          roomId: requestedNormalizedRoomId,
          otherParticipants,
          participantDetails: buildParticipantDetails(requestedNormalizedRoomId),
        });
      }
    });

    socket.on('get-active-rooms', () => {
      socket.emit('active-rooms', getActiveRooms());
    });

    socket.on('leave-room', ({ roomId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      log(`👋 User ${socket.id} leaving room ${normalizedRoomId}`);
      socket.leave(normalizedRoomId);
      if (removeSocketFromRoom(io, normalizedRoomId, socket.id)) {
        const participants = rooms.get(normalizedRoomId);
        const participantCount = participants ? participants.size : 0;
        const remainingParticipants = participants ? Array.from(participants) : [];
        io.to(normalizedRoomId).emit('user-left', { socketId: socket.id });
        io.to(normalizedRoomId).emit('room-update', {
          participantCount,
          roomId: normalizedRoomId,
          otherParticipants: remainingParticipants,
          participantDetails: buildParticipantDetails(normalizedRoomId),
        });
      }
      participantMeta.delete(socket.id);
    });
  });
}

