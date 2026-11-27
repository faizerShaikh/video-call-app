/**
 * Central place for user-facing error text.
 *
 * Rule: the real error is always logged to the console (for debugging),
 * but the user only ever sees a short, friendly, actionable message.
 */

export const FRIENDLY = {
  generic: 'Something went wrong. Please try again.',
  network: "We couldn't reach the server. Please check your internet connection and try again.",
  timeout: 'The request is taking too long. Please try again.',
  server: 'Something went wrong on our side. Please try again in a moment.',
  unauthorized: 'Your session has expired. Please sign in again.',
  forbidden: "You don't have permission to do that.",
  notFound: "We couldn't find what you were looking for.",
  conflict: 'This already exists. Please check your details and try again.',
  invalid: 'Some of the details look incorrect. Please check them and try again.',
  tooManyRequests: 'Too many attempts. Please wait a moment and try again.',

  connectServer: "We're having trouble connecting. Please check your internet connection.",
  reconnectFailed: "We couldn't reconnect. Please refresh the page and try again.",
  peerConnecting: "We're having trouble connecting with another participant. Trying again…",
  peerFailed:
    "We couldn't connect with another participant. Please check your internet connection and try again.",
  peerTimeout: 'Connecting to another participant is taking longer than usual. Please wait or rejoin the meeting.',
  startCall: "We couldn't connect you to the other participant. Please try again.",
  joinRoom: "We couldn't join the meeting. Please try again.",
  screenShare: "We couldn't start screen sharing. Please try again.",
  copy: "We couldn't copy the link. Please copy it manually.",
};

// Text that is useful for developers but should never be shown to users.
const TECHNICAL_PATTERNS = [
  /\b(TypeError|ReferenceError|SyntaxError|RangeError|MongoError|MongoServerError|MongooseError|CastError|AxiosError)\b/i,
  /\bE(CONN\w*|NOTFOUND|TIMEDOUT|11000|AI_AGAIN)\b/,
  /\bObjectId\b/i,
  /\bduplicate key\b/i,
  /\bstack\b/i,
  /\bundefined\b|\bnull\b|\bNaN\b/,
  /\bat\s+\S+\s*\(/,
  /\.(js|jsx|ts|tsx):\d+/,
  /status code \d{3}/i,
  /Request failed/i,
  /Network Error/i,
  /\bxhr\b|\bCORS\b|\bSMTP\b|\bjwt\b|JsonWebToken/i,
  /cannot read|is not a function|is not defined|unexpected token/i,
  /\bMetered\b|credentials request/i,
  /\bTURN\b/,
  /\bapiKey\b|\bpassword hash\b/i,
];

const MAX_SAFE_LENGTH = 160;

export function logError(context, error) {
  // Full detail goes to the console only.
  console.error(`❌ ${context}:`, error);
}

export function isTechnicalMessage(message) {
  if (typeof message !== 'string') return true;
  const text = message.trim();
  if (!text) return true;
  if (text.length > MAX_SAFE_LENGTH) return true;
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(text));
}

function messageForStatus(status) {
  if (status === 401) return FRIENDLY.unauthorized;
  if (status === 403) return FRIENDLY.forbidden;
  if (status === 404) return FRIENDLY.notFound;
  if (status === 409) return FRIENDLY.conflict;
  if (status === 429) return FRIENDLY.tooManyRequests;
  if (status === 400 || status === 422) return FRIENDLY.invalid;
  if (status >= 500) return FRIENDLY.server;
  return null;
}

/**
 * Turn any caught error (axios / socket / browser) into a friendly message.
 * - Always logs the real error.
 * - For 4xx responses, keeps the server text only when it is already user-safe
 *   (e.g. "Invalid email or password"). 5xx / technical text is replaced.
 */
export function getFriendlyError(error, fallback = FRIENDLY.generic, context = 'Request failed') {
  logError(context, error);

  // No response at all → offline / server down / CORS
  if (error && !error.response && (error.request || error.code === 'ERR_NETWORK' || error.message === 'Network Error')) {
    return error.code === 'ECONNABORTED' ? FRIENDLY.timeout : FRIENDLY.network;
  }
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
    return FRIENDLY.timeout;
  }

  const status = error?.response?.status;
  const serverMessage = error?.response?.data?.error || error?.response?.data?.message;

  if (status && status < 500 && !isTechnicalMessage(serverMessage)) {
    return serverMessage.trim();
  }

  if (status >= 500) {
    return fallback && fallback !== FRIENDLY.generic ? fallback : FRIENDLY.server;
  }

  if (status) {
    return messageForStatus(status) || fallback;
  }

  return fallback;
}

const MEDIA_ERROR_NAMES = new Set([
  'NotAllowedError',
  'PermissionDeniedError',
  'SecurityError',
  'NotFoundError',
  'DevicesNotFoundError',
  'OverconstrainedError',
  'NotReadableError',
  'TrackStartError',
  'AbortError',
  'NotSupportedError',
]);

export function isMediaError(error) {
  return MEDIA_ERROR_NAMES.has(error?.name);
}

/**
 * Camera / microphone (getUserMedia) errors.
 */
export function getMediaErrorMessage(error) {
  const name = error?.name;

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return 'Camera or microphone access was blocked. Please allow access in your browser and try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return "We couldn't find a camera or microphone. Please connect one and try again.";
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return 'Your camera or microphone is being used by another app. Please close it and try again.';
  }
  if (name === 'NotSupportedError') {
    return 'This browser or connection does not support video calls. Please use a recent browser over a secure (https) connection.';
  }

  return "We couldn't access your camera or microphone. Please check your device and try again.";
}

/**
 * Message safe to show for a server-sent (socket) text such as join errors.
 * Socket texts are authored by us, but fall back if they look technical.
 */
export function getSafeServerMessage(message, fallback = FRIENDLY.generic) {
  return isTechnicalMessage(message) ? fallback : message.trim();
}
