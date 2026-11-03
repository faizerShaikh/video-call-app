import crypto from 'crypto';

export class CalendarError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const providerLabel = (provider) => (provider === 'google' ? 'Google Calendar' : 'Microsoft Outlook');

export function apiBase(req) {
  if (process.env.API_PUBLIC_URL) {
    return process.env.API_PUBLIC_URL.replace(/\/$/, '');
  }
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}`;
}

export function frontendBase() {
  const raw = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';
  return raw.split(',')[0].trim().replace(/\/$/, '');
}

export function googleConfig(req) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new CalendarError(
      'Google Calendar is not configured on the server. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      503
    );
  }
  return {
    clientId,
    clientSecret,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${apiBase(req)}/api/calendar/google/callback`,
  };
}

export function outlookConfig(req) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new CalendarError(
      'Outlook is not configured on the server. Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.',
      503
    );
  }
  const tenant = process.env.MICROSOFT_TENANT || 'common';
  return {
    clientId,
    clientSecret,
    tenant,
    redirectUri: process.env.MICROSOFT_REDIRECT_URI || `${apiBase(req)}/api/calendar/outlook/callback`,
  };
}

async function readProviderResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || data.error_description || (typeof data.error === 'string' ? data.error : '') || 'The calendar provider rejected the request';
    throw new CalendarError(message, 502);
  }
  return data;
}

async function postForm(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  return readProviderResponse(response);
}

function expiryFrom(expiresIn) {
  const seconds = Number(expiresIn) || 3600;
  return new Date(Date.now() + seconds * 1000);
}

export function googleAuthUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email https://www.googleapis.com/auth/calendar',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function createPkcePair() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

export function outlookAuthUrl({ clientId, redirectUri, tenant, state, codeChallenge }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    response_mode: 'query',
    scope: 'offline_access User.Read Calendars.ReadWrite',
    prompt: 'select_account',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeGoogleCode({ code, clientId, clientSecret, redirectUri }) {
  const token = await postForm('https://oauth2.googleapis.com/token', {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = await readProviderResponse(profileResponse);
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || null,
    expiresAt: expiryFrom(token.expires_in),
    email: profile.email || null,
  };
}

export async function exchangeOutlookCode({ code, clientId, clientSecret, redirectUri, tenant, codeVerifier }) {
  const token = await postForm(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    scope: 'offline_access User.Read Calendars.ReadWrite',
    code_verifier: codeVerifier,
  });
  const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = await readProviderResponse(profileResponse);
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || null,
    expiresAt: expiryFrom(token.expires_in),
    email: profile.mail || profile.userPrincipalName || null,
  };
}

async function refreshGoogle(refreshToken) {
  const { clientId, clientSecret } = googleConfig({ get: () => '' });
  const token = await postForm('https://oauth2.googleapis.com/token', {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || refreshToken,
    expiresAt: expiryFrom(token.expires_in),
  };
}

async function refreshOutlook(refreshToken) {
  const { clientId, clientSecret, tenant } = outlookConfig({ get: () => '' });
  const token = await postForm(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: 'offline_access User.Read Calendars.ReadWrite',
  });
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || refreshToken,
    expiresAt: expiryFrom(token.expires_in),
  };
}

export async function ensureAccessToken(account, provider) {
  if (!account?.accessToken) {
    throw new CalendarError(`Connect ${providerLabel(provider)} before scheduling.`, 400);
  }
  if (!account.expiresAt || new Date(account.expiresAt).getTime() > Date.now() + 60_000) {
    return { accessToken: account.accessToken, account };
  }
  if (!account.refreshToken) {
    throw new CalendarError(`Reconnect ${providerLabel(provider)}.`, 401);
  }
  try {
    const refreshed = provider === 'google'
      ? await refreshGoogle(account.refreshToken)
      : await refreshOutlook(account.refreshToken);
    return {
      accessToken: refreshed.accessToken,
      account: { ...account, ...refreshed },
    };
  } catch {
    throw new CalendarError(`Reconnect ${providerLabel(provider)}.`, 401);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function createGoogleEvent({ accessToken, title, startLocal, endLocal, timeZone, meetingUrl, addLink, attendees }) {
  const event = {
    summary: title,
    start: { dateTime: startLocal, timeZone },
    end: { dateTime: endLocal, timeZone },
  };
  if (addLink && meetingUrl) {
    event.description = `Join the Synchro meeting:\n${meetingUrl}\n\nThe host approves who joins.`;
    event.location = meetingUrl;
  }
  if (attendees.length) {
    event.attendees = attendees.map((email) => ({ email }));
  }
  const query = attendees.length ? '?sendUpdates=all' : '';
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events${query}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });
  return readProviderResponse(response);
}

export async function createOutlookEvent({ accessToken, title, startLocal, endLocal, timeZone, meetingUrl, addLink, attendees }) {
  const event = {
    subject: title,
    start: { dateTime: startLocal, timeZone },
    end: { dateTime: endLocal, timeZone },
  };
  if (addLink && meetingUrl) {
    const safeUrl = escapeHtml(meetingUrl);
    event.body = {
      contentType: 'HTML',
      content: `<p>Join the Synchro meeting:</p><p><a href="${safeUrl}">${safeUrl}</a></p><p>The host approves who joins.</p>`,
    };
    event.location = { displayName: 'Synchro meeting' };
  }
  if (attendees.length) {
    event.attendees = attendees.map((email) => ({
      emailAddress: { address: email },
      type: 'required',
    }));
  }
  const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });
  return readProviderResponse(response);
}
