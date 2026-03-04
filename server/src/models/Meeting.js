import mongoose from 'mongoose';
import crypto from 'crypto';

const registeredParticipantSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  socketId: {
    type: String,
    required: true
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  leftAt: {
    type: Date,
    default: null
  }
}, { _id: false });

const guestParticipantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: [2, 'Guest name must be at least 2 characters'],
    maxlength: [50, 'Guest name cannot exceed 50 characters']
  },
  socketId: {
    type: String,
    required: true
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  leftAt: {
    type: Date,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  }
}, { _id: false });

const meetingSchema = new mongoose.Schema({
  meetingId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  roomId: {
    type: String,
    required: true,
    index: true,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Meeting title cannot exceed 100 characters'],
    default: null
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  guestAccessEnabled: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'ended'],
    default: 'active',
    index: true
  },
  registeredParticipants: {
    type: [registeredParticipantSchema],
    default: []
  },
  guestParticipants: {
    type: [guestParticipantSchema],
    default: []
  },
  participantCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      // Don't expose socketIds in API responses
      if (ret.registeredParticipants) {
        ret.registeredParticipants = ret.registeredParticipants.map(p => ({
          userId: p.userId,
          joinedAt: p.joinedAt,
          leftAt: p.leftAt
        }));
      }
      if (ret.guestParticipants) {
        ret.guestParticipants = ret.guestParticipants.map(p => ({
          name: p.name,
          joinedAt: p.joinedAt,
          leftAt: p.leftAt
        }));
      }
      return ret;
    }
  }
});

// Indexes
meetingSchema.index({ meetingId: 1 }, { unique: true });
meetingSchema.index({ roomId: 1 });
meetingSchema.index({ expiresAt: 1 }); // TTL will be handled manually
meetingSchema.index({ createdBy: 1 });
meetingSchema.index({ status: 1 });
meetingSchema.index({ 'registeredParticipants.userId': 1 });
meetingSchema.index({ 'registeredParticipants.socketId': 1 });
meetingSchema.index({ 'guestParticipants.socketId': 1 });

// Generate unique meeting ID
meetingSchema.statics.generateMeetingId = function() {
  return crypto.randomBytes(6).toString('base64url').substring(0, 10);
};

// Check if meeting is expired
meetingSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt || this.status === 'expired';
};

// Check if meeting can be joined
meetingSchema.methods.canJoin = function() {
  return this.status === 'active' && !this.isExpired() && this.guestAccessEnabled;
};

// Add registered participant
meetingSchema.methods.addRegisteredParticipant = function(userId, socketId) {
  // Check if already exists
  const existing = this.registeredParticipants.find(
    p => p.userId.toString() === userId.toString() && !p.leftAt
  );
  
  if (existing) {
    // Update socketId if reconnecting
    existing.socketId = socketId;
    existing.joinedAt = new Date();
    existing.leftAt = null;
  } else {
    this.registeredParticipants.push({
      userId,
      socketId,
      joinedAt: new Date()
    });
  }
  
  this.updateParticipantCount();
  return this.save();
};

// Add guest participant
meetingSchema.methods.addGuestParticipant = function(name, socketId, ipAddress = null) {
  this.guestParticipants.push({
    name: name.trim(),
    socketId,
    joinedAt: new Date(),
    ipAddress
  });
  
  this.updateParticipantCount();
  return this.save();
};

// Remove participant by socketId (works for both types)
meetingSchema.methods.removeParticipant = function(socketId) {
  let removed = false;
  
  // Remove from registered participants
  const regIndex = this.registeredParticipants.findIndex(
    p => p.socketId === socketId && !p.leftAt
  );
  if (regIndex !== -1) {
    this.registeredParticipants[regIndex].leftAt = new Date();
    removed = true;
  }
  
  // Remove from guest participants
  const guestIndex = this.guestParticipants.findIndex(
    p => p.socketId === socketId && !p.leftAt
  );
  if (guestIndex !== -1) {
    this.guestParticipants[guestIndex].leftAt = new Date();
    removed = true;
  }
  
  if (removed) {
    this.updateParticipantCount();
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Update participant count
meetingSchema.methods.updateParticipantCount = function() {
  const activeRegistered = this.registeredParticipants.filter(p => !p.leftAt).length;
  const activeGuests = this.guestParticipants.filter(p => !p.leftAt).length;
  this.participantCount = activeRegistered + activeGuests;
};

// Get all active participants
meetingSchema.methods.getAllParticipants = function() {
  const registered = this.registeredParticipants
    .filter(p => !p.leftAt)
    .map(p => ({ ...p.toObject(), type: 'registered' }));
  
  const guests = this.guestParticipants
    .filter(p => !p.leftAt)
    .map(p => ({ ...p.toObject(), type: 'guest' }));
  
  return [...registered, ...guests];
};

// Mark meeting as expired
meetingSchema.methods.markExpired = function() {
  this.status = 'expired';
  return this.save();
};

// End meeting
meetingSchema.methods.endMeeting = function() {
  this.status = 'ended';
  return this.save();
};

// Pre-save hook to update participant count
meetingSchema.pre('save', function(next) {
  this.updateParticipantCount();
  next();
});

const Meeting = mongoose.model('Meeting', meetingSchema);

export default Meeting;
