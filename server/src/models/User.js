import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  isAdmin: {
    type: Boolean,
    default: false,
    index: true
  },
  isPro: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended'],
    default: 'pending',
    index: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  rejectedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null,
    maxlength: [500, 'Rejection reason cannot exceed 500 characters']
  },
  suspendedAt: {
    type: Date,
    default: null
  },
  suspensionReason: {
    type: String,
    default: null,
    maxlength: [500, 'Suspension reason cannot exceed 500 characters']
  },
  profilePicture: {
    type: String,
    default: null
  },
  lastLoginAt: {
    type: Date,
    default: null
  },
  // Password reset OTP fields (stored on user directly)
  otpHash: {
    type: String,
    default: null,
    select: false
  },
  otpExpiresAt: {
    type: Date,
    default: null,
    select: false
  },
  otpUsed: {
    type: Boolean,
    default: false,
    select: false
  },
  otpAttempts: {
    type: Number,
    default: 0,
    select: false
  },
  resetTokenHash: {
    type: String,
    default: null,
    select: false
  },
  resetTokenExpiresAt: {
    type: Date,
    default: null,
    select: false
  },
  resetTokenUsed: {
    type: Boolean,
    default: false,
    select: false
  },
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.otpHash;
      delete ret.otpExpiresAt;
      delete ret.otpUsed;
      delete ret.otpAttempts;
      delete ret.resetTokenHash;
      delete ret.resetTokenExpiresAt;
      delete ret.resetTokenUsed;
      return ret;
    }
  }
});

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ status: 1 });
userSchema.index({ isAdmin: 1 });
userSchema.index({ createdAt: -1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if user can login
userSchema.methods.canLogin = function() {
  return this.status === 'approved';
};

// Clear OTP/reset fields
userSchema.methods.clearResetFields = function() {
  this.otpHash = null;
  this.otpExpiresAt = null;
  this.otpUsed = false;
  this.otpAttempts = 0;
  this.resetTokenHash = null;
  this.resetTokenExpiresAt = null;
  this.resetTokenUsed = false;
};

// Static method to find user by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

const User = mongoose.model('User', userSchema);

export default User;
