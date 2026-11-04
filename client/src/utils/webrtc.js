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

/**
 * Prefer same-origin `/api/...` in production (nginx proxies it).
 * Avoids a bad/missing VITE_API_URL baking localhost into the client and
 * silently falling back to STUN-only (no relay across networks).
 */
function getApiBaseUrl() {
  const fromEnv = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  if (typeof window === 'undefined') {
    return fromEnv || 'http://localhost:3001';
  }

  const { hostname, port, origin } = window.location;
  const isViteDev = hostname === 'localhost' || hostname === '127.0.0.1';
  if (isViteDev && (port === '5173' || port === '5174')) {
    return fromEnv || 'http://localhost:3001';
  }

  // Production / same-host deploy: always hit this origin so nginx can proxy /api
  if (!isViteDev) {
    return origin;
  }

  return fromEnv || origin;
}

async function fetchTurnCredentials() {
  const base = getApiBaseUrl();
  const url = `${base}/api/turn-credentials`;
  console.log('🧊 Fetching TURN credentials from:', url);

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
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

/** Ensure RTCIceServer.urls is always an array; put TLS/TCP TURN first for strict NATs. */
function normalizeAndPrioritizeIceServers(servers) {
  const normalized = (servers || [])
    .map((server) => {
      if (!server?.urls) return null;
      const urls = (Array.isArray(server.urls) ? server.urls : [server.urls]).filter(Boolean);
      if (!urls.length) return null;
      return {
        ...server,
        urls,
        username: server.username,
        credential: server.credential ?? server.password,
      };
    })
    .filter(Boolean);

  const score = (url) => {
    const u = String(url).toLowerCase();
    if (u.startsWith('turns:') && u.includes('transport=tcp')) return 0;
    if (u.startsWith('turns:')) return 1;
    if (u.startsWith('turn:') && u.includes('transport=tcp')) return 2;
    if (u.startsWith('turn:')) return 3;
    return 4; // stun
  };

  return [...normalized].sort((a, b) => score(a.urls[0]) - score(b.urls[0]));
}

function summarizeIceServers(servers) {
  let stun = 0;
  let turn = 0;
  const urls = [];

  for (const server of servers || []) {
    const list = Array.isArray(server.urls) ? server.urls : [server.urls];
    for (const url of list.filter(Boolean)) {
      urls.push(url);
      if (String(url).startsWith('turn')) turn += 1;
      else stun += 1;
    }
  }

  return { stun, turn, urls };
}

let iceServersFetchedAt = 0;
const ICE_SERVERS_TTL_MS = 5 * 60 * 1000;

export async function getIceServers({ forceRefresh = false } = {}) {
  const cacheValid =
    iceServerPromise &&
    !forceRefresh &&
    Date.now() - iceServersFetchedAt < ICE_SERVERS_TTL_MS;

  if (cacheValid) {
    return iceServerPromise;
  }

  iceServerPromise = (async () => {
    try {
      const payload = await fetchTurnCredentials();
      const providerIceServers = normalizeIceServersFromProvider(payload);

      if (providerIceServers && providerIceServers.length > 0) {
        cachedIceServers = normalizeAndPrioritizeIceServers(providerIceServers);
        console.log(`🧊 ICE servers from provider (${payload?.provider || 'unknown'}):`, summarizeIceServers(cachedIceServers));
      } else {
        const turnServer = buildSelfHostedTurnIceServer(payload);
        cachedIceServers = normalizeAndPrioritizeIceServers(
          turnServer ? [STUN_SERVERS[0], turnServer] : [...STUN_SERVERS]
        );
        if (turnServer) {
          console.log('🧊 ICE servers from self-hosted TURN + STUN:', summarizeIceServers(cachedIceServers));
        } else {
          console.warn(
            '⚠️ No TURN URLs available (missing provider iceServers and VITE_TURN_URL). Cross-network calls will stay in ICE checking.'
          );
        }
      }
    } catch (error) {
      console.error('Failed to fetch TURN credentials, using STUN fallback:', error);
      cachedIceServers = [...STUN_SERVERS];
    }

    iceServersFetchedAt = Date.now();
    const summary = summarizeIceServers(cachedIceServers);
    if (summary.turn === 0) {
      console.warn('⚠️ ICE config has 0 TURN/relay servers — only STUN. Different networks usually cannot connect.');
    }

    return cachedIceServers;
  })();

  return iceServerPromise;
}

export async function getRTCConfig() {
  const iceServers = await getIceServers({ forceRefresh: false });
  return {
    iceServers,
    iceCandidatePoolSize: 0,
    bundlePolicy: 'max-bundle',
    iceTransportPolicy: 'all',
  };
}

/**
 * Prove whether Metered/TURN can actually allocate a relay from this browser/network.
 * Credentials can return 200 while ALLOCATE still fails → zero relay candidates.
 */
export async function probeTurnRelay(timeoutMs = 8000) {
  const iceServers = await getIceServers({ forceRefresh: true });
  const summary = summarizeIceServers(iceServers);

  if (summary.turn === 0) {
    console.warn('🧪 TURN probe skipped — no TURN servers in ICE config', summary);
    return { ok: false, reason: 'no-turn-servers', summary };
  }

  return new Promise((resolve) => {
    let settled = false;
    let gotRelay = false;
    const pc = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: 'relay',
      iceCandidatePoolSize: 0,
    });

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        pc.close();
      } catch {
        /* ignore */
      }
      if (result.ok) {
        console.log('🧪 TURN probe OK — relay candidate allocated', summary);
      } else {
        console.error(
          '🧪 TURN probe FAILED — browser could not allocate a relay. Cross-network video will fail.',
          result
        );
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({ ok: gotRelay, reason: gotRelay ? 'ok' : 'timeout', summary });
    }, timeoutMs);

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        finish({ ok: gotRelay, reason: gotRelay ? 'ok' : 'gathering-complete-no-relay', summary });
        return;
      }
      const type =
        event.candidate.type ||
        (event.candidate.candidate && event.candidate.candidate.split(' ')[7]) ||
        '';
      if (type === 'relay') {
        gotRelay = true;
        finish({ ok: true, reason: 'relay', summary });
      }
    };

    pc.createDataChannel('turn-probe');
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch((error) => finish({ ok: false, reason: error.message, summary }));
  });
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
export async function createOffer(peerConnection, options = {}) {
  try {
    const offer = await peerConnection.createOffer(options);
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

