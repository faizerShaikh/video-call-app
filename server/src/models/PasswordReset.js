import mongoose from 'mongoose';

const passwordResetSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  otpHash: {
    type: String,
    default: null,
  },
  otpExpiresAt: {
    type: Date,
    default: null,
  },
  otpUsed: {
    type: Boolean,
    default: false,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  resetTokenHash: {
    type: String,
    default: null,
  },
  resetTokenExpiresAt: {
    type: Date,
    default: null,
  },
  resetTokenUsed: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

passwordResetSchema.index({ email: 1, createdAt: -1 });

const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);

export default PasswordReset;
