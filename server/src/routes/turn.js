import express from 'express';
import crypto from 'crypto';

const router = express.Router();

router.get('/turn-credentials', (req, res) => {
  try {
    const turnSecret = process.env.TURN_SECRET_KEY;

    if (!turnSecret) {
      return res.status(500).json({
        message: 'TURN secret is not configured',
      });
    }

    // Credential validity window: 24 hours
    const unixTimeStamp = Math.floor(Date.now() / 1000) + 24 * 3600;
    const username = `${unixTimeStamp}:synchro_user`;

    const password = crypto
      .createHmac('sha1', turnSecret)
      .update(username)
      .digest('base64');

    return res.json({
      username,
      password,
      ttl: 24 * 3600,
    });
  } catch (error) {
    console.error('Error generating TURN credentials:', error);
    return res.status(500).json({
      message: 'Failed to generate TURN credentials',
    });
  }
});

export default router;
