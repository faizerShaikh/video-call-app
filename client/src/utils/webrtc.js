const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const FORCE_TURN_RELAY = String(import.meta.env.VITE_FORCE_TURN_RELAY || '').toLowerCase() === 'true';

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.stunprotocol.org:3478' },
];

let cachedIceServers = [...STUN_SERVERS];
let iceServerPromise = null;

async function fetchTurnCredentials() {
  const response = await fetch(`${API_BASE_URL}/api/turn-credentials`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`TURN credential request failed with status ${response.status}`);
  }

  return response.json();
}

function buildSelfHostedTurnIceServer(credentials) {
  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnsUrl = import.meta.env.VITE_TURNS_URL;

  const urls = [turnUrl, turnsUrl].filter(Boolean);
  if (!urls.length) {
    return null;
  }

  return {
    urls,
    username: credentials.username,
    credential: credentials.password,
  };
}

function normalizeIceServersFromProvider(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.iceServers)) {
    return payload.iceServers;
  }
  return null;
}

export async function getIceServers() {
  if (iceServerPromise) {
    return iceServerPromise;
  }

  iceServerPromise = (async () => {
    try {
      const payload = await fetchTurnCredentials();
      const providerIceServers = normalizeIceServersFromProvider(payload);

      if (providerIceServers && providerIceServers.length > 0) {
        cachedIceServers = providerIceServers;
      } else {
        const turnServer = buildSelfHostedTurnIceServer(payload);
        cachedIceServers = turnServer ? [STUN_SERVERS[0], turnServer] : [...STUN_SERVERS];
      }
    } catch (error) {
      console.error('Failed to fetch TURN credentials, using STUN fallback:', error);
      cachedIceServers = [...STUN_SERVERS];
    }

    return cachedIceServers;
  })();

  return iceServerPromise;
}

export async function getRTCConfig() {
  const iceServers = await getIceServers();
  const rtcConfig = {
    iceServers,
    iceCandidatePoolSize: 16,
    bundlePolicy: 'max-bundle',
  };

  if (FORCE_TURN_RELAY) {
    rtcConfig.iceTransportPolicy = 'relay';
  }

  return rtcConfig;
}

/**
 * Check if getUserMedia is available
 */
export function isGetUserMediaSupported() {
  return !!(
    navigator.mediaDevices?.getUserMedia ||
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia
  );
}

/**
 * Check if we're in a secure context (required for WebRTC)
 */
export function isSecureContext() {
  return window.isSecureContext || 
         window.location.protocol === 'https:' || 
         window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1';
}

/**
 * Get user media (camera and microphone)
 */
export async function getUserMedia(constraints = { video: true, audio: true }) {
  // Check if we're in a secure context
  if (!isSecureContext()) {
    const error = new Error(
      'WebRTC requires a secure context (HTTPS). ' +
      'Please access the app via HTTPS or use localhost. ' +
      'For local network access, consider using a reverse proxy or accessing via localhost.'
    );
    error.name = 'NotSupportedError';
    throw error;
  }

  // Check if getUserMedia is available
  if (!isGetUserMediaSupported()) {
    const error = new Error(
      'getUserMedia is not supported in this browser. ' +
      'Please use a modern browser like Chrome, Firefox, or Edge.'
    );
    error.name = 'NotSupportedError';
    throw error;
  }

  try {
    // Try modern API first
    if (navigator.mediaDevices?.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return stream;
    }
    
    // Fallback for older browsers (though they likely won't work with WebRTC anyway)
    const getUserMedia = 
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia ||
      navigator.msGetUserMedia;

    if (getUserMedia) {
      return new Promise((resolve, reject) => {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    }

    throw new Error('getUserMedia is not available');
  } catch (error) {
    console.error('Error getting user media:', error);

    // Don't mutate error.message — it's read-only in Edge and some Chromium builds
    let message = error?.message || 'Failed to access camera/microphone';
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      message = 'Camera/microphone access denied. Please allow permissions and try again.';
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      message = 'No camera/microphone found. Please connect a device and try again.';
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      message = 'Camera/microphone is already in use by another application.';
    }

    const friendlyError = new Error(message);
    friendlyError.name = error.name || 'MediaError';
    throw friendlyError;
  }
}

/**
 * Stop all tracks in a stream
 */
export function stopStream(stream) {
  if (stream) {
    stream.getTracks().forEach(track => {
      track.stop();
    });
  }
}

/**
 * Create a new RTCPeerConnection
 */
export async function createPeerConnection() {
  const rtcConfig = await getRTCConfig();
  return new RTCPeerConnection(rtcConfig);
}

/**
 * Add stream tracks to peer connection
 */
export function addStreamToPeerConnection(peerConnection, stream) {
  if (!stream || !peerConnection) return;

  stream.getTracks().forEach(track => {
    peerConnection.addTrack(track, stream);
  });
}

/**
 * Create and set local description (offer)
 */
export async function createOffer(peerConnection) {
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    return offer;
  } catch (error) {
    console.error('Error creating offer:', error);
    throw error;
  }
}

/**
 * Create and set local description (answer)
 */
export async function createAnswer(peerConnection, offer) {
  try {
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    return answer;
  } catch (error) {
    console.error('Error creating answer:', error);
    throw error;
  }
}

/**
 * Set remote description
 */
export async function setRemoteDescription(peerConnection, description) {
  try {
    await peerConnection.setRemoteDescription(description);
  } catch (error) {
    console.error('Error setting remote description:', error);
    throw error;
  }
}

/**
 * Add ICE candidate
 */
export async function addIceCandidate(peerConnection, candidate) {
  try {
    if (candidate) {
      await peerConnection.addIceCandidate(candidate);
    }
  } catch (error) {
    console.error('Error adding ICE candidate:', error);
    throw error;
  }
}

