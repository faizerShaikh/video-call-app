import mongoose from 'mongoose';

const meetingLinkSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  waitingRoom: {
    type: Boolean,
    default: true,
  },
  passcodeEnabled: {
    type: Boolean,
    default: false,
  },
  passcode: {
    type: String,
    default: '',
    select: false,
  },
  expires: {
    type: String,
    enum: ['never', 'in 24 hours', 'in 7 days'],
    default: 'never',
  },
  expiresAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

const MeetingLink = mongoose.model('MeetingLink', meetingLinkSchema);

export default MeetingLink;
