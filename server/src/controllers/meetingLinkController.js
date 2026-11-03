import MeetingLink from '../models/MeetingLink.js';
import { verifyToken } from '../utils/jwt.js';
import User from '../models/User.js';

const EXPIRY_CHOICES = new Set(['never', 'in 24 hours', 'in 7 days']);

function normalizeRoomId(roomId) {
  return String(roomId || '').trim().toLowerCase();
}

function expiresAtFor(choice) {
  if (choice === 'in 24 hours') return new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (choice === 'in 7 days') return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return null;
}

function makePasscode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function present(link) {
  return {
    roomId: link.roomId,
    waitingRoom: link.waitingRoom !== false,
    passcodeEnabled: Boolean(link.passcodeEnabled),
    passcode: link.passcodeEnabled ? link.passcode || '' : '',
    expires: link.expires || 'never',
  };
}

export const optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  try {
    const decoded = verifyToken(header.slice(7));
    req.user = await User.findById(decoded.userId).select('-password');
  } catch {
    req.user = null;
  }
  next();
};

export const saveMeetingLink = async (req, res) => {
  try {
    const roomId = normalizeRoomId(req.params.roomId);
    if (!roomId || roomId.length > 40) {
      return res.status(400).json({ error: 'Invalid meeting link' });
    }

    const waitingRoom = req.body.waitingRoom !== false;
    const passcodeEnabled = Boolean(req.body.passcodeEnabled);
    const expires = EXPIRY_CHOICES.has(req.body.expires) ? req.body.expires : 'never';
    const requestedPasscode = String(req.body.passcode || '').trim();

    let link = await MeetingLink.findOne({ roomId }).select('+passcode');
    if (link && String(link.createdBy) !== String(req.user._id)) {
      return res.status(409).json({ error: 'This meeting link already exists' });
    }

    if (!link) {
      link = new MeetingLink({ roomId, createdBy: req.user._id });
    }

    link.waitingRoom = waitingRoom;
    link.passcodeEnabled = passcodeEnabled;
    if (passcodeEnabled) {
      link.passcode = requestedPasscode || link.passcode || makePasscode();
    } else {
      link.passcode = '';
    }
    if (link.expires !== expires || !link.expires) {
      link.expires = expires;
      link.expiresAt = expiresAtFor(expires);
    }

    await link.save();
    return res.json(present(link));
  } catch (error) {
    return res.status(500).json({ error: 'Could not save meeting settings' });
  }
};

export const getMeetingAccess = async (req, res) => {
  try {
    const roomId = normalizeRoomId(req.params.roomId);
    const link = await MeetingLink.findOne({ roomId });
    if (!link) {
      return res.json({ expired: false, passcodeRequired: false, waitingRoom: true });
    }
    const isOwner = req.user && String(link.createdBy) === String(req.user._id);
    const expired = Boolean(link.expiresAt && link.expiresAt.getTime() <= Date.now());
    return res.json({
      expired,
      passcodeRequired: Boolean(link.passcodeEnabled) && !isOwner && !expired,
      waitingRoom: link.waitingRoom !== false,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Could not check this meeting link' });
  }
};
