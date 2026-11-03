import express from 'express';
import { authenticate, requireApproved } from '../middleware/auth.js';
import { getMeetingAccess, optionalAuth, saveMeetingLink } from '../controllers/meetingLinkController.js';

const router = express.Router();

router.get('/:roomId/access', optionalAuth, getMeetingAccess);
router.put('/:roomId', authenticate, requireApproved, saveMeetingLink);

export default router;