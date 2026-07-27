// Room management
const rooms = new Map(); // roomId -> Set<socketId>
const participantMeta = new Map(); // socketId -> { name, email, userId }
const roomScreenShare = new Map(); // roomId -> { sharerSocketId, startedAt }
const roomHosts = new Map(); // roomId -> hostSocketId
const roomHostMeta = new Map(); // roomId -> { isPro }
const pendingJoins = new Map(); // roomId -> Map<socketId, { userId, userName, userEmail, requestedAt }>

const NON_PRO_PARTICIPANT_LIMIT = 3;

const isDev = process.env.NODE_ENV !== 'production';
const log = (...args) => isDev && console.log(...args);
const logErr = (...args) => console.error(...args);

function getPendingMap(roomId) {
  if (!pendingJoins.has(roomId)) {
    pendingJoins.set(roomId, new Map());
  }
  return pendingJoins.get(roomId);
}

function clearPendingForRoom(roomId) {
  pendingJoins.delete(roomId);
}

function serializePendingRequests(roomId) {
  const pending = pendingJoins.get(roomId);
  if (!pending) return [];
  return Array.from(pending.entries()).map(([requesterSocketId, data]) => ({
    requesterSocketId,
    userId: data.userId,
    userName: data.userName,
    userEmail: data.userEmail,
    requestedAt: data.requestedAt,
  }));
}

function notifyHostPendingList(io, roomId) {
  const hostSocketId = roomHosts.get(roomId);
  if (!hostSocketId) return;
  const hostSocket = io.sockets.sockets.get(hostSocketId);
  if (!hostSocket) return;
  hostSocket.emit('pending-join-requests', {
    roomId,
    requests: serializePendingRequests(roomId),
  });
}

function rejectAllPending(io, roomId, reason, message) {
  const pending = pendingJoins.get(roomId);
  if (!pending) return;
  pending.forEach((_, requesterSocketId) => {
    const sock = io.sockets.sockets.get(requesterSocketId);
    if (sock) {
      sock.emit('join-request-cancelled', {
        roomId,
        reason,
        message,
      });
    }
  });
  clearPendingForRoom(roomId);
}

function removePendingRequester(io, roomId, requesterSocketId, notifyHost = true) {
  const pending = pendingJoins.get(roomId);
  if (!pending || !pending.has(requesterSocketId)) return false;
  pending.delete(requesterSocketId);
  if (pending.size === 0) pendingJoins.delete(roomId);
  if (notifyHost) {
    const hostSocketId = roomHosts.get(roomId);
    if (hostSocketId) {
      const hostSocket = io.sockets.sockets.get(hostSocketId);
      hostSocket?.emit('join-request:resolved', {
        roomId,
        requesterSocketId,
        status: 'cancelled',
      });
      notifyHostPendingList(io, roomId);
    }
  }
  return true;
}

function isRoomFull(roomId) {
  const meta = roomHostMeta.get(roomId);
  if (meta?.isPro) return false;
  const participants = rooms.get(roomId);
  if (!participants) return false;
  return participants.size >= NON_PRO_PARTICIPANT_LIMIT;
}

function findPendingRoomForSocket(socketId) {
  for (const [roomId, pending] of pendingJoins.entries()) {
    if (pending.has(socketId)) return roomId;
  }
  return null;
}

// Remove socket from room and clean empty rooms; returns true if participant was removed
function removeSocketFromRoom(io, roomId, socketId) {
  if (!rooms.has(roomId)) return false;
  const participants = rooms.get(roomId);
  if (!participants.has(socketId)) return false;
  participants.delete(socketId);
  if (participants.size === 0) {
    rooms.delete(roomId);
    roomHosts.delete(roomId);
    roomHostMeta.delete(roomId);
    rejectAllPending(
      io,
      roomId,
      'meeting-ended',
      'The meeting has ended. Please try joining again later.'
    );
    roomScreenShare.delete(roomId);
    log(`🗑️  Room ${roomId} deleted (empty)`);
  }
  return true;
}

function promoteNewHost(io, roomId) {
  const participants = rooms.get(roomId);
  if (!participants || participants.size === 0) {
    roomHosts.delete(roomId);
    return null;
  }

  const nextHostId = Array.from(participants).find((id) => io.sockets.sockets.has(id));
  if (!nextHostId) {
    roomHosts.delete(roomId);
    return null;
  }

  roomHosts.set(roomId, nextHostId);
  io.to(roomId).emit('host-changed', {
    roomId,
    hostSocketId: nextHostId,
  });
  notifyHostPendingList(io, roomId);
  log(`👑 New host for room ${roomId}: ${nextHostId}`);
  return nextHostId;
}

function handleParticipantLeave(io, roomId, socketId, reason = 'leave') {
  const wasHost = roomHosts.get(roomId) === socketId;
  if (!removeSocketFromRoom(io, roomId, socketId)) return;

  const participants = rooms.get(roomId);
  const participantCount = participants ? participants.size : 0;
  const remainingParticipants = participants ? Array.from(participants) : [];

  io.to(roomId).emit('user-left', { socketId });
  io.to(roomId).emit('room-update', {
    participantCount,
    roomId,
    otherParticipants: remainingParticipants,
    participantDetails: buildParticipantDetails(roomId),
    activeScreenShare: getScreenShareState(roomId),
    hostSocketId: roomHosts.get(roomId) || null,
  });

  const activeShare = roomScreenShare.get(roomId);
  if (activeShare && activeShare.sharerSocketId === socketId) {
    stopRoomScreenShare(io, roomId, reason === 'disconnect' ? 'disconnect' : 'leave-room');
  }

  if (wasHost && participantCount > 0) {
    promoteNewHost(io, roomId);
  } else if (wasHost && participantCount === 0) {
    // removeSocketFromRoom already cleared pending when room emptied
  }
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

  // Prune ghost pending requesters
  const pending = pendingJoins.get(roomId);
  if (pending) {
    Array.from(pending.keys()).forEach((socketId) => {
      if (!io.sockets.sockets.has(socketId)) {
        pending.delete(socketId);
      }
    });
    if (pending.size === 0) pendingJoins.delete(roomId);
  }

  if (participants.size === 0) {
    rooms.delete(roomId);
    roomHosts.delete(roomId);
    roomHostMeta.delete(roomId);
    rejectAllPending(
      io,
      roomId,
      'meeting-ended',
      'The meeting has ended. Please try joining again later.'
    );
  } else if (roomHosts.get(roomId) && !participants.has(roomHosts.get(roomId))) {
    promoteNewHost(io, roomId);
  }

  const activeShare = roomScreenShare.get(roomId);
  if (activeShare && !io.sockets.sockets.has(activeShare.sharerSocketId)) {
    roomScreenShare.delete(roomId);
  }
}

function buildParticipantDetails(roomId, excludeSocketId = null) {
  if (!rooms.has(roomId)) return [];
  return Array.from(rooms.get(roomId))
    .filter((socketId) => socketId !== excludeSocketId)
    .map((socketId) => ({
      socketId,
      name: participantMeta.get(socketId)?.name || `User-${socketId.substring(0, 6)}`,
      email: participantMeta.get(socketId)?.email || null,
    }));
}

function getScreenShareState(roomId) {
  const activeShare = roomScreenShare.get(roomId);
  if (!activeShare) return null;
  return {
    sharerSocketId: activeShare.sharerSocketId,
    startedAt: activeShare.startedAt,
  };
}

function stopRoomScreenShare(io, roomId, reason = 'manual') {
  const activeShare = roomScreenShare.get(roomId);
  if (!activeShare) return;
  roomScreenShare.delete(roomId);
  io.to(roomId).emit('screen-share:stopped', {
    roomId,
    sharerSocketId: activeShare.sharerSocketId,
    stoppedAt: Date.now(),
    reason,
  });
}

function admitParticipant(io, socket, normalizedRoomId, { userId, userName, userEmail }, { isHost = false } = {}) {
  participantMeta.set(socket.id, {
    name: (userName && String(userName).trim()) || String(userId || '').trim() || `User-${socket.id.substring(0, 6)}`,
    email: userEmail ? String(userEmail).trim().toLowerCase() : null,
    userId: userId || null,
  });

  // Leave any previous admitted rooms
  const previousRooms = Array.from(socket.rooms);
  previousRooms.forEach((prevRoom) => {
    if (prevRoom !== socket.id && rooms.has(prevRoom)) {
      socket.leave(prevRoom);
      handleParticipantLeave(io, prevRoom, socket.id, 'switch-room');
    }
  });

  socket.join(normalizedRoomId);
  if (!rooms.has(normalizedRoomId)) {
    rooms.set(normalizedRoomId, new Set());
  }
  rooms.get(normalizedRoomId).add(socket.id);

  if (isHost || !roomHosts.has(normalizedRoomId)) {
    roomHosts.set(normalizedRoomId, socket.id);
    isHost = true;
  }

  const otherParticipants = Array.from(rooms.get(normalizedRoomId))
    .filter((id) => id !== socket.id && io.sockets.sockets.has(id));
  const otherParticipantDetails = buildParticipantDetails(normalizedRoomId, socket.id)
    .filter((p) => io.sockets.sockets.has(p.socketId));

  socket.to(normalizedRoomId).emit('user-joined', {
    userId,
    userName: participantMeta.get(socket.id)?.name,
    userEmail: participantMeta.get(socket.id)?.email,
    socketId: socket.id,
  });

  const participantCount = rooms.get(normalizedRoomId).size;
  io.to(normalizedRoomId).emit('room-update', {
    participantCount,
    roomId: normalizedRoomId,
    otherParticipants,
    participantDetails: buildParticipantDetails(normalizedRoomId),
    activeScreenShare: getScreenShareState(normalizedRoomId),
    hostSocketId: roomHosts.get(normalizedRoomId) || null,
  });

  const hostMeta = roomHostMeta.get(normalizedRoomId);
  socket.emit('room-joined', {
    roomId: normalizedRoomId,
    participantCount,
    otherParticipants,
    participantDetails: otherParticipantDetails,
    activeScreenShare: getScreenShareState(normalizedRoomId),
    isHost,
    hostSocketId: roomHosts.get(normalizedRoomId) || null,
    isProMeeting: !!hostMeta?.isPro,
    participantLimit: hostMeta?.isPro ? null : NON_PRO_PARTICIPANT_LIMIT,
  });

  log(`📊 Room "${normalizedRoomId}" now has ${participantCount} participant(s); host=${roomHosts.get(normalizedRoomId)}`);
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
        hostSocketId: roomHosts.get(roomId) || null,
        pendingCount: pendingJoins.get(roomId)?.size || 0,
      });
    }
  });
  return activeRooms.sort((a, b) => b.participantCount - a.participantCount);
}

export function setupSocket(io) {
  const CLEANUP_INTERVAL_MS = 60000;
  setInterval(() => {
    rooms.forEach((_, roomId) => pruneRoom(io, roomId));
  }, CLEANUP_INTERVAL_MS);

  io.engine.on('connection_error', (err) => {
    logErr('❌ Socket.io connection error:', err.message, err.type);
  });

  io.on('connection', (socket) => {
    log(`✅ User connected: ${socket.id}`);

    const normalizeRoomId = (id) => {
      if (!id) return null;
      return String(id).trim().toLowerCase();
    };

    // Join a room (first participant becomes host; others wait for approval)
    socket.on('join-room', ({ roomId, userId, userName, userEmail, isPro }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      if (!normalizedRoomId) {
        socket.emit('join-room-error', { message: 'Invalid room ID' });
        return;
      }

      log(`👤 User ${userId} (${socket.id}) requesting join for room "${normalizedRoomId}"`);
      pruneRoom(io, normalizedRoomId);

      // Cancel any other pending request from this socket
      const existingPendingRoom = findPendingRoomForSocket(socket.id);
      if (existingPendingRoom && existingPendingRoom !== normalizedRoomId) {
        removePendingRequester(io, existingPendingRoom, socket.id, true);
      }

      const participants = rooms.get(normalizedRoomId);
      const hasLiveParticipants = participants &&
        Array.from(participants).some((id) => io.sockets.sockets.has(id));

      // Empty / new room → become host and join immediately
      if (!hasLiveParticipants) {
        removePendingRequester(io, normalizedRoomId, socket.id, false);
        clearPendingForRoom(normalizedRoomId);
        roomHostMeta.set(normalizedRoomId, { isPro: !!isPro });
        admitParticipant(
          io,
          socket,
          normalizedRoomId,
          { userId, userName, userEmail },
          { isHost: true }
        );
        return;
      }

      // Already admitted in this room (reconnect) → re-admit / refresh state
      if (participants.has(socket.id)) {
        admitParticipant(
          io,
          socket,
          normalizedRoomId,
          { userId, userName, userEmail },
          { isHost: roomHosts.get(normalizedRoomId) === socket.id }
        );
        return;
      }

      // Ensure host is valid
      let hostSocketId = roomHosts.get(normalizedRoomId);
      if (!hostSocketId || !participants.has(hostSocketId) || !io.sockets.sockets.has(hostSocketId)) {
        hostSocketId = promoteNewHost(io, normalizedRoomId);
      }

      if (!hostSocketId) {
        roomHostMeta.set(normalizedRoomId, { isPro: !!isPro });
        admitParticipant(
          io,
          socket,
          normalizedRoomId,
          { userId, userName, userEmail },
          { isHost: true }
        );
        return;
      }

      const pending = getPendingMap(normalizedRoomId);

      // Prevent duplicate pending requests from same socket
      if (pending.has(socket.id)) {
        socket.emit('join-request-pending', {
          roomId: normalizedRoomId,
          message: 'Waiting for host approval',
        });
        notifyHostPendingList(io, normalizedRoomId);
        return;
      }

      // Prevent duplicate pending requests from same userId (replace old socket if any)
      if (userId) {
        for (const [reqSocketId, data] of pending.entries()) {
          if (data.userId && String(data.userId) === String(userId) && reqSocketId !== socket.id) {
            pending.delete(reqSocketId);
            const oldSock = io.sockets.sockets.get(reqSocketId);
            oldSock?.emit('join-request-cancelled', {
              roomId: normalizedRoomId,
              reason: 'replaced',
              message: 'A newer join request replaced this one.',
            });
          }
        }
      }

      const request = {
        userId: userId || null,
        userName: (userName && String(userName).trim()) || `User-${socket.id.substring(0, 6)}`,
        userEmail: userEmail ? String(userEmail).trim().toLowerCase() : null,
        requestedAt: Date.now(),
      };
      pending.set(socket.id, request);
      participantMeta.set(socket.id, {
        name: request.userName,
        email: request.userEmail,
        userId: request.userId,
      });

      socket.emit('join-request-pending', {
        roomId: normalizedRoomId,
        message: 'Waiting for host approval',
      });

      const hostSocket = io.sockets.sockets.get(hostSocketId);
      const payload = {
        roomId: normalizedRoomId,
        requesterSocketId: socket.id,
        userId: request.userId,
        userName: request.userName,
        userEmail: request.userEmail,
        requestedAt: request.requestedAt,
      };
      hostSocket?.emit('join-request', payload);
      notifyHostPendingList(io, normalizedRoomId);

      log(`⏳ Join request pending for ${socket.id} in room ${normalizedRoomId}`);
    });

    socket.on('join-request:approve', ({ roomId, requesterSocketId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      if (!normalizedRoomId || !requesterSocketId) return;

      if (roomHosts.get(normalizedRoomId) !== socket.id) {
        socket.emit('join-request:error', {
          message: 'Only the meeting host can approve join requests',
        });
        return;
      }

      const pending = pendingJoins.get(normalizedRoomId);
      const request = pending?.get(requesterSocketId);
      if (!request) {
        socket.emit('join-request:error', {
          message: 'Join request not found or already resolved',
        });
        notifyHostPendingList(io, normalizedRoomId);
        return;
      }

      const requesterSocket = io.sockets.sockets.get(requesterSocketId);
      if (!requesterSocket) {
        pending.delete(requesterSocketId);
        if (pending.size === 0) pendingJoins.delete(normalizedRoomId);
        socket.emit('join-request:error', {
          message: 'Requester is no longer connected',
        });
        notifyHostPendingList(io, normalizedRoomId);
        return;
      }

      if (isRoomFull(normalizedRoomId)) {
        socket.emit('join-request:error', {
          message: 'Participant limit reached (max 3 for non-Pro meetings). Cannot admit more users.',
        });
        return;
      }

      pending.delete(requesterSocketId);
      if (pending.size === 0) pendingJoins.delete(normalizedRoomId);

      socket.emit('join-request:resolved', {
        roomId: normalizedRoomId,
        requesterSocketId,
        status: 'approved',
      });
      notifyHostPendingList(io, normalizedRoomId);

      requesterSocket.emit('join-request-approved', {
        roomId: normalizedRoomId,
        message: 'Your request was approved',
      });

      admitParticipant(
        io,
        requesterSocket,
        normalizedRoomId,
        {
          userId: request.userId,
          userName: request.userName,
          userEmail: request.userEmail,
        },
        { isHost: false }
      );
    });

    socket.on('join-request:reject', ({ roomId, requesterSocketId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      if (!normalizedRoomId || !requesterSocketId) return;

      if (roomHosts.get(normalizedRoomId) !== socket.id) {
        socket.emit('join-request:error', {
          message: 'Only the meeting host can reject join requests',
        });
        return;
      }

      const pending = pendingJoins.get(normalizedRoomId);
      if (!pending || !pending.has(requesterSocketId)) {
        socket.emit('join-request:error', {
          message: 'Join request not found or already resolved',
        });
        notifyHostPendingList(io, normalizedRoomId);
        return;
      }

      pending.delete(requesterSocketId);
      if (pending.size === 0) pendingJoins.delete(normalizedRoomId);

      const requesterSocket = io.sockets.sockets.get(requesterSocketId);
      requesterSocket?.emit('join-request-rejected', {
        roomId: normalizedRoomId,
        message: 'Your request to join the meeting was denied by the host.',
      });

      socket.emit('join-request:resolved', {
        roomId: normalizedRoomId,
        requesterSocketId,
        status: 'rejected',
      });
      notifyHostPendingList(io, normalizedRoomId);
    });

    socket.on('join-request:cancel', ({ roomId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      if (!normalizedRoomId) return;
      const removed = removePendingRequester(io, normalizedRoomId, socket.id, true);
      if (removed) {
        socket.emit('join-request-cancelled', {
          roomId: normalizedRoomId,
          reason: 'cancelled',
          message: 'You cancelled your join request.',
        });
      }
    });

    // Handle WebRTC offer
    socket.on('offer', ({ offer, roomId, targetId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      if (!normalizedRoomId || !Array.from(socket.rooms).includes(normalizedRoomId)) return;
      if (!rooms.has(normalizedRoomId) || !rooms.get(normalizedRoomId).has(socket.id)) return;

      if (targetId) {
        if (targetId === socket.id) return;
        if (!io.sockets.sockets.has(targetId)) {
          removeSocketFromRoom(io, normalizedRoomId, targetId);
          return;
        }
        if (!rooms.get(normalizedRoomId).has(targetId)) return;
        log(`📤 Offer ${socket.id} → ${targetId}`);
        socket.to(targetId).emit('offer', { offer, from: socket.id });
      } else {
        const roomParticipants = rooms.get(normalizedRoomId);
        if (!roomParticipants) return;
        const live = Array.from(roomParticipants).filter((id) => id !== socket.id && io.sockets.sockets.has(id));
        live.forEach((id) => socket.to(id).emit('offer', { offer, from: socket.id }));
      }
    });

    // Handle WebRTC answer
    socket.on('answer', ({ answer, roomId, targetId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      if (!normalizedRoomId) return;
      if (!rooms.has(normalizedRoomId) || !rooms.get(normalizedRoomId).has(socket.id)) return;
      if (targetId) {
        if (targetId === socket.id) return;
        if (!io.sockets.sockets.has(targetId)) {
          removeSocketFromRoom(io, normalizedRoomId, targetId);
          return;
        }
        if (!rooms.get(normalizedRoomId).has(targetId)) return;
        socket.to(targetId).emit('answer', { answer, from: socket.id });
      } else {
        const roomParticipants = rooms.get(normalizedRoomId);
        if (!roomParticipants) return;
        Array.from(roomParticipants)
          .filter((id) => id !== socket.id && io.sockets.sockets.has(id))
          .forEach((id) => socket.to(id).emit('answer', { answer, from: socket.id }));
      }
    });

    // Handle ICE candidates
    socket.on('ice-candidate', ({ candidate, roomId, targetId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      if (!normalizedRoomId) return;
      if (!rooms.has(normalizedRoomId) || !rooms.get(normalizedRoomId).has(socket.id)) return;
      if (targetId) {
        if (targetId === socket.id) return;
        if (!io.sockets.sockets.has(targetId)) {
          removeSocketFromRoom(io, normalizedRoomId, targetId);
          return;
        }
        if (!rooms.get(normalizedRoomId).has(targetId)) return;
        socket.to(targetId).emit('ice-candidate', { candidate, from: socket.id });
      } else {
        const roomParticipants = rooms.get(normalizedRoomId);
        if (!roomParticipants) return;
        Array.from(roomParticipants)
          .filter((id) => id !== socket.id && io.sockets.sockets.has(id))
          .forEach((id) => socket.to(id).emit('ice-candidate', { candidate, from: socket.id }));
      }
    });

    socket.on('media-state', ({ roomId, videoEnabled, audioEnabled }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      if (!normalizedRoomId || !Array.from(socket.rooms).includes(normalizedRoomId)) return;
      if (!rooms.has(normalizedRoomId) || !rooms.get(normalizedRoomId).has(socket.id)) return;
      socket.to(normalizedRoomId).emit('media-state', {
        videoEnabled,
        audioEnabled,
        from: socket.id,
      });
    });

    socket.on('screen-share:start-request', ({ roomId, isPro }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      if (!normalizedRoomId || !rooms.has(normalizedRoomId)) {
        socket.emit('screen-share:start-rejected', {
          roomId: normalizedRoomId,
          reason: 'invalid-room',
        });
        return;
      }

      const participants = rooms.get(normalizedRoomId);
      if (!participants.has(socket.id)) {
        socket.emit('screen-share:start-rejected', {
          roomId: normalizedRoomId,
          reason: 'not-in-room',
        });
        return;
      }

      if (!isPro) {
        socket.emit('screen-share:start-rejected', {
          roomId: normalizedRoomId,
          reason: 'pro-required',
        });
        return;
      }

      const existing = roomScreenShare.get(normalizedRoomId);
      if (existing && existing.sharerSocketId !== socket.id) {
        socket.emit('screen-share:start-rejected', {
          roomId: normalizedRoomId,
          reason: 'already-active',
          activeSharerSocketId: existing.sharerSocketId,
        });
        return;
      }

      const startedAt = Date.now();
      roomScreenShare.set(normalizedRoomId, { sharerSocketId: socket.id, startedAt });

      socket.emit('screen-share:start-accepted', {
        roomId: normalizedRoomId,
        sharerSocketId: socket.id,
        startedAt,
      });

      io.to(normalizedRoomId).emit('screen-share:started', {
        roomId: normalizedRoomId,
        sharerSocketId: socket.id,
        startedAt,
      });
    });

    socket.on('screen-share:stop', ({ roomId, reason = 'manual' }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      if (!normalizedRoomId) return;
      const activeShare = roomScreenShare.get(normalizedRoomId);
      if (!activeShare) return;
      if (activeShare.sharerSocketId !== socket.id) return;
      stopRoomScreenShare(io, normalizedRoomId, reason);
    });

    socket.on('disconnect', (reason) => {
      log(`❌ User disconnected: ${socket.id} (${reason})`);

      const pendingRoomId = findPendingRoomForSocket(socket.id);
      if (pendingRoomId) {
        removePendingRequester(io, pendingRoomId, socket.id, true);
      }

      const roomIds = Array.from(socket.rooms).filter((r) => r !== socket.id);
      roomIds.forEach((roomId) => {
        handleParticipantLeave(io, roomId, socket.id, 'disconnect');
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
          activeScreenShare: getScreenShareState(requestedNormalizedRoomId),
          hostSocketId: roomHosts.get(requestedNormalizedRoomId) || null,
        });
      }
    });

    socket.on('get-active-rooms', () => {
      socket.emit('active-rooms', getActiveRooms());
    });

    socket.on('leave-room', ({ roomId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      log(`👋 User ${socket.id} leaving room ${normalizedRoomId}`);

      // Cancel pending request if waiting
      removePendingRequester(io, normalizedRoomId, socket.id, true);

      socket.leave(normalizedRoomId);
      handleParticipantLeave(io, normalizedRoomId, socket.id, 'leave');
      participantMeta.delete(socket.id);
    });
  });
}
