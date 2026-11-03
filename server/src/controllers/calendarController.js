import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import {
  CalendarError,
  createGoogleEvent,
  createOutlookEvent,
  ensureAccessToken,
  exchangeGoogleCode,
  exchangeOutlookCode,
  frontendBase,
  googleAuthUrl,
  googleConfig,
  createPkcePair,
  outlookAuthUrl,
  outlookConfig,
} from '../services/calendar.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

const providerLabel = (provider) => (provider === 'google' ? 'Google Calendar' : 'Microsoft Outlook');

function signState(userId, provider, extra = {}) {
  return jwt.sign(
    { purpose: 'calendar-connect', userId: String(userId), provider, ...extra },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function readState(token, provider) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.purpose !== 'calendar-connect' || decoded.provider !== provider || !decoded.userId) {
      throw new Error('invalid');
    }
    return decoded;
  } catch {
    throw new CalendarError('The calendar connection expired. Try connecting again.', 400);
  }
}

function redirectFrontend(res, params) {
  const url = new URL('/call', frontendBase());
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, String(value).slice(0, 180));
  });
  return res.redirect(url.toString());
}

function sendError(res, error) {
  const status = error.status || 500;
  return res.status(status).json({
    error: error.message || 'Calendar request failed',
  });
}

function accountStatus(account) {
  return {
    connected: Boolean(account?.accessToken),
    email: account?.email || null,
  };
}

function serializeUpcoming(meetings = []) {
  const now = Date.now();
  return meetings
    .filter((meeting) => meeting.endsAt && new Date(meeting.endsAt).getTime() > now)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    .slice(0, 8)
    .map((meeting) => ({
      id: String(meeting._id),
      title: meeting.title,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      roomId: meeting.roomId,
      meetingUrl: meeting.meetingUrl,
      providers: meeting.providers || [],
    }));
}

async function loadCalendarUser(userId) {
  return User.findById(userId).select('+googleCalendar +outlookCalendar +scheduledMeetings');
}

export const getCalendarStatus = async (req, res) => {
  try {
    const user = await loadCalendarUser(req.user._id);
    return res.json({
      google: accountStatus(user?.googleCalendar),
      outlook: accountStatus(user?.outlookCalendar),
      upcoming: serializeUpcoming(user?.scheduledMeetings),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const startGoogle = async (req, res) => {
  try {
    const config = googleConfig(req);
    const url = googleAuthUrl({
      ...config,
      state: signState(req.user._id, 'google'),
    });
    return res.json({ url });
  } catch (error) {
    return sendError(res, error);
  }
};

export const startOutlook = async (req, res) => {
  try {
    const config = outlookConfig(req);
    const { codeVerifier, codeChallenge } = createPkcePair();
    const url = outlookAuthUrl({
      ...config,
      codeChallenge,
      state: signState(req.user._id, 'outlook', { codeVerifier }),
    });
    return res.json({ url });
  } catch (error) {
    return sendError(res, error);
  }
};

async function finishConnection(res, provider, account) {
  return redirectFrontend(res, { calendar: provider, connected: '1' });
}

export const googleCallback = async (req, res) => {
  try {
    if (req.query.error) {
      const detail = String(req.query.error_description || req.query.error || 'Google connection was cancelled');
      console.error('Google connect failed:', req.query.error, detail);
      return redirectFrontend(res, { calendar: 'google', connected: '0', reason: detail });
    }
    const decoded = readState(req.query.state, 'google');
    const config = googleConfig(req);
    const account = await exchangeGoogleCode({
      code: req.query.code,
      ...config,
    });
    const existing = await loadCalendarUser(decoded.userId);
    if (!existing) {
      return redirectFrontend(res, { calendar: 'google', connected: '0', reason: 'Account was not found' });
    }
    await User.updateOne(
      { _id: existing._id },
      {
        $set: {
          googleCalendar: {
            ...account,
            refreshToken: account.refreshToken || existing.googleCalendar?.refreshToken || null,
          },
        },
      }
    );
    return finishConnection(res, 'google', account);
  } catch (error) {
    return redirectFrontend(res, {
      calendar: 'google',
      connected: '0',
      reason: error.message || 'Could not connect Google Calendar',
    });
  }
};

export const outlookCallback = async (req, res) => {
  try {
    if (req.query.error) {
      const detail = String(req.query.error_description || req.query.error || 'Outlook connection was cancelled');
      console.error('Outlook connect failed:', req.query.error, detail);
      return redirectFrontend(res, { calendar: 'outlook', connected: '0', reason: detail });
    }
    const decoded = readState(req.query.state, 'outlook');
    const config = outlookConfig(req);
    const account = await exchangeOutlookCode({
      code: req.query.code,
      codeVerifier: decoded.codeVerifier,
      ...config,
    });
    const existing = await loadCalendarUser(decoded.userId);
    if (!existing) {
      return redirectFrontend(res, { calendar: 'outlook', connected: '0', reason: 'Account was not found' });
    }
    await User.updateOne(
      { _id: existing._id },
      {
        $set: {
          outlookCalendar: {
            ...account,
            refreshToken: account.refreshToken || existing.outlookCalendar?.refreshToken || null,
          },
        },
      }
    );
    return finishConnection(res, 'outlook');
  } catch (error) {
    return redirectFrontend(res, {
      calendar: 'outlook',
      connected: '0',
      reason: error.message || 'Could not connect Outlook',
    });
  }
};

export const disconnectCalendar = async (req, res) => {
  try {
    const provider = req.params.provider;
    if (provider !== 'google' && provider !== 'outlook') {
      throw new CalendarError('Unknown calendar');
    }
    const field = provider === 'google' ? 'googleCalendar' : 'outlookCalendar';
    await User.updateOne({ _id: req.user._id }, { $unset: { [field]: 1 } });
    const user = await loadCalendarUser(req.user._id);
    return res.json({
      google: accountStatus(user?.googleCalendar),
      outlook: accountStatus(user?.outlookCalendar),
      upcoming: serializeUpcoming(user?.scheduledMeetings),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

function parseInvites(value) {
  if (!value) return [];
  const emails = String(value)
    .split(/[,;\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(emails)];
  if (unique.length > 20) {
    throw new CalendarError('Invite up to 20 people at a time');
  }
  const invalid = unique.find((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  if (invalid) {
    throw new CalendarError(`Invalid email: ${invalid}`);
  }
  return unique;
}

function makeRoomId() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const part = () => Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${part()}-${part()}-${part()}`;
}

export const scheduleMeeting = async (req, res) => {
  try {
    const title = String(req.body.title || '').trim().slice(0, 120);
    const startLocal = String(req.body.startLocal || '');
    const endLocal = String(req.body.endLocal || '');
    const timeZone = String(req.body.timeZone || 'UTC');
    const startsAt = new Date(req.body.startsAt);
    const endsAt = new Date(req.body.endsAt);
    const providers = Array.isArray(req.body.providers) ? req.body.providers : [];
    const addLink = req.body.addLink !== false;
    const invites = parseInvites(req.body.invites);
    const roomId = String(req.body.roomId || '').trim().toLowerCase() || makeRoomId();
    const meetingUrl = String(req.body.meetingUrl || '').trim();

    if (!title) throw new CalendarError('Enter a meeting title');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(startLocal) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(endLocal)) {
      throw new CalendarError('Enter a valid date and time');
    }
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      throw new CalendarError('Enter a valid date and time');
    }
    if (startsAt.getTime() < Date.now() - 60_000) {
      throw new CalendarError('Choose a start time in the future');
    }
    const selected = [...new Set(providers)].filter((provider) => provider === 'google' || provider === 'outlook');
    if (!selected.length) throw new CalendarError('Choose Outlook, Google, or both');

    const user = await loadCalendarUser(req.user._id);
    if (!user) throw new CalendarError('Account was not found', 404);

    const missing = selected.filter((provider) => {
      const account = provider === 'google' ? user.googleCalendar : user.outlookCalendar;
      return !account?.accessToken;
    });
    if (missing.length) {
      const names = missing.map(providerLabel).join(' and ');
      throw new CalendarError(`Connect ${names} before scheduling.`);
    }

    const successes = [];
    const failures = [];
    const tokenUpdates = {};

    for (const provider of selected) {
      const current = provider === 'google' ? user.googleCalendar : user.outlookCalendar;
      try {
        const { accessToken, account } = await ensureAccessToken(current.toObject?.() || current, provider);
        const attendees = invites.filter((email) => email !== (account.email || '').toLowerCase());
        if (provider === 'google') {
          await createGoogleEvent({
            accessToken, title, startLocal, endLocal, timeZone, meetingUrl, addLink, attendees,
          });
          tokenUpdates.googleCalendar = account;
        } else {
          await createOutlookEvent({
            accessToken, title, startLocal, endLocal, timeZone, meetingUrl, addLink, attendees,
          });
          tokenUpdates.outlookCalendar = account;
        }
        successes.push(provider);
      } catch (error) {
        failures.push(error.message || `Could not add the meeting to ${providerLabel(provider)}`);
      }
    }

    if (!successes.length) {
      throw new CalendarError(failures[0] || 'Could not schedule the meeting', 502);
    }

    const meeting = {
      title,
      startsAt,
      endsAt,
      roomId,
      meetingUrl,
      invitees: invites,
      providers: successes,
    };
    const update = {
      $push: { scheduledMeetings: { $each: [meeting], $slice: -30 } },
    };
    if (Object.keys(tokenUpdates).length) {
      update.$set = tokenUpdates;
    }
    await User.updateOne({ _id: user._id }, update);
    const refreshed = await loadCalendarUser(user._id);
    const names = successes.map(providerLabel);
    const sent = invites.length ? 'Invites sent from' : 'Meeting added to';
    const message = failures.length
      ? `${sent} ${names.join(' and ')}. ${failures[0]}`
      : `${sent} ${names.join(' and ')}`;

    return res.json({
      message,
      upcoming: serializeUpcoming(refreshed?.scheduledMeetings),
    });
  } catch (error) {
    return sendError(res, error);
  }
};
