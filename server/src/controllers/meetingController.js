import Meeting from '../models/Meeting.js';
import User from '../models/User.js';
import { generateGuestToken } from '../utils/guestToken.js';

const MEETING_EXPIRY_HOURS = parseInt(process.env.MEETING_EXPIRY_HOURS) || 1;

// Create a new meeting
export const createMeeting = async (req, res) => {
  try {
    const { title } = req.body;
    const userId = req.user._id;

    // Generate unique meeting ID
    let meetingId;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      meetingId = Meeting.generateMeetingId();
      const existing = await Meeting.findOne({ meetingId });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate unique meeting ID. Please try again.'
      });
    }

    // Generate room ID (can be same as meetingId or different)
    const roomId = `room-${meetingId}`;

    // Calculate expiry time (1 hour from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + MEETING_EXPIRY_HOURS);

    // Create meeting
    const meeting = new Meeting({
      meetingId,
      roomId,
      createdBy: userId,
      title: title?.trim() || null,
      expiresAt,
      guestAccessEnabled: true,
      status: 'active'
    });

    await meeting.save();

    // Generate shareable link
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const shareableLink = `${baseUrl}/join/${meetingId}`;

    res.status(201).json({
      success: true,
      data: {
        meetingId: meeting.meetingId,
        roomId: meeting.roomId,
        shareableLink,
        expiresAt: meeting.expiresAt,
        expiresIn: MEETING_EXPIRY_HOURS * 3600, // seconds
        title: meeting.title
      }
    });
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create meeting'
    });
  }
};

// Get meeting details (public endpoint)
export const getMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const meeting = await Meeting.findOne({ meetingId })
      .populate('createdBy', 'name email')
      .select('-registeredParticipants.socketId -guestParticipants.socketId');

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found'
      });
    }

    // Check if expired
    if (meeting.isExpired() && meeting.status === 'active') {
      await meeting.markExpired();
    }

    const isExpired = meeting.isExpired();
    const canJoin = meeting.canJoin();

    res.json({
      success: true,
      data: {
        meetingId: meeting.meetingId,
        roomId: meeting.roomId,
        title: meeting.title,
        expiresAt: meeting.expiresAt,
        isExpired,
        canJoin,
        participantCount: meeting.participantCount,
        createdBy: {
          name: meeting.createdBy?.name || 'Unknown',
          email: meeting.createdBy?.email || ''
        }
      }
    });
  } catch (error) {
    console.error('Error getting meeting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get meeting details'
    });
  }
};

// Validate and join as guest
export const validateGuestJoin = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { guestName } = req.body;

    // Validate guest name
    if (!guestName || typeof guestName !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Guest name is required'
      });
    }

    const trimmedName = guestName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Guest name must be between 2 and 50 characters'
      });
    }

    // Validate name contains only allowed characters (alphanumeric, spaces, basic punctuation)
    const nameRegex = /^[a-zA-Z0-9\s\-_.,!?]+$/;
    if (!nameRegex.test(trimmedName)) {
      return res.status(400).json({
        success: false,
        error: 'Guest name contains invalid characters'
      });
    }

    // Get meeting
    const meeting = await Meeting.findOne({ meetingId })
      .populate('createdBy', 'name email');

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found'
      });
    }

    // Check if expired
    if (meeting.isExpired() && meeting.status === 'active') {
      await meeting.markExpired();
      return res.status(410).json({
        success: false,
        error: 'This meeting has expired',
        expired: true
      });
    }

    // Check if meeting can be joined
    if (!meeting.canJoin()) {
      return res.status(403).json({
        success: false,
        error: 'This meeting is no longer available for joining',
        status: meeting.status
      });
    }

    // Check guest access
    if (!meeting.guestAccessEnabled) {
      return res.status(403).json({
        success: false,
        error: 'Guest access is not enabled for this meeting'
      });
    }

    // Generate guest token
    const guestToken = generateGuestToken(meetingId, trimmedName);

    res.json({
      success: true,
      data: {
        meetingId: meeting.meetingId,
        roomId: meeting.roomId,
        guestName: trimmedName,
        token: guestToken
      }
    });
  } catch (error) {
    console.error('Error validating guest join:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate guest join'
    });
  }
};

// Get user's meetings
export const getUserMeetings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status } = req.query; // 'active', 'expired', 'ended', or 'all'

    const query = { createdBy: userId };

    if (status && status !== 'all') {
      query.status = status;
    }

    const meetings = await Meeting.find(query)
      .select('-registeredParticipants.socketId -guestParticipants.socketId')
      .sort({ createdAt: -1 })
      .limit(50);

    // Check and update expired meetings
    const now = new Date();
    for (const meeting of meetings) {
      if (meeting.status === 'active' && meeting.expiresAt < now) {
        await meeting.markExpired();
        meeting.status = 'expired';
      }
    }

    res.json({
      success: true,
      data: meetings
    });
  } catch (error) {
    console.error('Error getting user meetings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get meetings'
    });
  }
};

// Get meeting participants (only for meeting creator)
export const getMeetingParticipants = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user._id;

    const meeting = await Meeting.findOne({ meetingId })
      .populate('registeredParticipants.userId', 'name email')
      .select('-registeredParticipants.socketId -guestParticipants.socketId');

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found'
      });
    }

    // Check if user is the creator
    if (meeting.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Only the meeting creator can view participants'
      });
    }

    // Format participants
    const registeredParticipants = meeting.registeredParticipants
      .filter(p => !p.leftAt)
      .map(p => ({
        userId: p.userId._id,
        name: p.userId.name,
        email: p.userId.email,
        joinedAt: p.joinedAt
      }));

    const guestParticipants = meeting.guestParticipants
      .filter(p => !p.leftAt)
      .map(p => ({
        name: p.name,
        joinedAt: p.joinedAt
      }));

    res.json({
      success: true,
      data: {
        meetingId: meeting.meetingId,
        participantCount: meeting.participantCount,
        registeredParticipants,
        guestParticipants
      }
    });
  } catch (error) {
    console.error('Error getting meeting participants:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get meeting participants'
    });
  }
};

// End meeting early
export const endMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user._id;

    const meeting = await Meeting.findOne({ meetingId });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found'
      });
    }

    // Check if user is the creator
    if (meeting.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Only the meeting creator can end the meeting'
      });
    }

    await meeting.endMeeting();

    res.json({
      success: true,
      message: 'Meeting ended successfully'
    });
  } catch (error) {
    console.error('Error ending meeting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end meeting'
    });
  }
};
