import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  createMeeting,
  getMeeting,
  validateGuestJoin,
  getUserMeetings,
  getMeetingParticipants,
  endMeeting
} from '../controllers/meetingController.js';
import { authenticate } from '../middleware/auth.js';
import { requireApproved } from '../middleware/auth.js';

const router = express.Router();

// Rate limiting for guest join (more restrictive)
const guestJoinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 guest join attempts per windowMs
  message: 'Too many guest join attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for authenticated users joining their own meetings
    return !!req.user;
  }
});

// Rate limiting for meeting creation
const createMeetingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each user to 10 meetings per hour
  message: 'Too many meeting creation attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID for authenticated users, IP for others
    return req.user ? req.user._id.toString() : req.ip;
  }
});

// Public routes
router.get('/:meetingId', getMeeting); // Get meeting details (public)
router.post('/:meetingId/join', guestJoinLimiter, validateGuestJoin); // Guest join validation

// Protected routes (authenticated users only)
router.post('/', authenticate, requireApproved, createMeetingLimiter, createMeeting);
router.get('/', authenticate, requireApproved, getUserMeetings);
router.get('/:meetingId/participants', authenticate, requireApproved, getMeetingParticipants);
router.delete('/:meetingId', authenticate, requireApproved, endMeeting);

export default router;
