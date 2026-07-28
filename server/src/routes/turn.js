import express from 'express';
import crypto from 'crypto';

const router = express.Router();

const DEFAULT_METERED_URL = 'https://global.relay.metered.ca/api/v1/turn/credentials';

function getTurnProvider() {
  return (process.env.TURN_PROVIDER || 'selfhosted').toLowerCase();
}

function hasSelfHostedTurnConfig() {
  return Boolean(process.env.TURN_SECRET_KEY);
}

async function getMeteredIceServers() {
  const apiKey = process.env.METERED_API_KEY;
  const meteredUrl = process.env.METERED_TURN_CREDENTIALS_URL || DEFAULT_METERED_URL;
  const timeoutMs = Number(process.env.METERED_FETCH_TIMEOUT_MS || 15000);

  if (!apiKey) {
    throw new Error('METERED_API_KEY is not configured');
  }

  const separator = meteredUrl.includes('?') ? '&' : '?';
  const endpoint = `${meteredUrl}${separator}apiKey=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Metered credentials request timed out after ${timeoutMs}ms`);
    }
    throw new Error(`Metered credentials request failed: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Metered credentials request failed with status ${response.status}`);
  }

  const iceServers = await response.json();
  if (!Array.isArray(iceServers)) {
    throw new Error('Invalid Metered credentials response');
  }

  return iceServers;
}

function getSelfHostedCredentials() {
  const turnSecret = process.env.TURN_SECRET_KEY;

  if (!turnSecret) {
    throw new Error('TURN_SECRET_KEY is not configured');
  }

  const ttlSeconds = Number(process.env.TURN_TTL_SECONDS || 24 * 3600);
  const userLabel = process.env.TURN_USERNAME_LABEL || 'synchro_user';
  const unixTimeStamp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = `${unixTimeStamp}:${userLabel}`;
  const password = crypto
    .createHmac('sha1', turnSecret)
    .update(username)
    .digest('base64');

  return { username, password, ttl: ttlSeconds };
}

router.get('/turn-credentials', async (req, res) => {
  try {
    const provider = getTurnProvider();

    if (provider === 'metered') {
      try {
        const iceServers = await getMeteredIceServers();
        return res.json({
          provider,
          iceServers,
        });
      } catch (error) {
        console.error('Metered TURN fetch failed:', error.message);

        if (hasSelfHostedTurnConfig()) {
          const credentials = getSelfHostedCredentials();
          return res.json({
            provider: 'selfhosted-fallback',
            fallbackReason: error.message,
            ...credentials,
          });
        }

        throw error;
      }
    }

    const credentials = getSelfHostedCredentials();
    return res.json({
      provider: 'selfhosted',
      ...credentials,
    });
  } catch (error) {
    console.error('Error generating TURN credentials:', error);
    return res.status(502).json({
      message: error.message || 'Failed to generate TURN credentials',
    });
  }
});

export default router;
