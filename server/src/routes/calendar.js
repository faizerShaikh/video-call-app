import express from 'express';
import { authenticate, requireApproved } from '../middleware/auth.js';
import {
  disconnectCalendar,
  getCalendarStatus,
  googleCallback,
  outlookCallback,
  scheduleMeeting,
  startGoogle,
  startOutlook,
} from '../controllers/calendarController.js';

const router = express.Router();

router.get('/google/callback', googleCallback);
router.get('/outlook/callback', outlookCallback);

router.use(authenticate, requireApproved);
router.get('/status', getCalendarStatus);
router.get('/google/start', startGoogle);
router.get('/outlook/start', startOutlook);
router.post('/:provider/disconnect', disconnectCalendar);
router.post('/schedule', scheduleMeeting);

export default router;