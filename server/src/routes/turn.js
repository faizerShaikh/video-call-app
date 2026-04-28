import express from 'express';
import crypto from 'crypto';

const router = express.Router();

const DEFAULT_METERED_URL = 'https://global.relay.metered.ca/api/v1/turn/credentials';

function getTurnProvider() {
  return (process.env.TURN_PROVIDER || 'selfhosted').toLowerCase();
}

async function getMeteredIceServers() {
  const apiKey = process.env.METERED_API_KEY;
  const meteredUrl = process.env.METERED_TURN_CREDENTIALS_URL || DEFAULT_METERED_URL;

  if (!apiKey) {
    throw new Error('METERED_API_KEY is not configured');
  }

  const separator = meteredUrl.includes('?') ? '&' : '?';
  const endpoint = `${meteredUrl}${separator}apiKey=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, { method: 'GET' });

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
      const iceServers = await getMeteredIceServers();
      return res.json({
        provider,
        iceServers,
      });
    }

    const credentials = getSelfHostedCredentials();
    return res.json({
      provider: 'selfhosted',
      ...credentials,
    });
  } catch (error) {
    console.error('Error generating TURN credentials:', error);
    return res.status(500).json({
      message: error.message || 'Failed to generate TURN credentials',
    });
  }
});

export default router;
