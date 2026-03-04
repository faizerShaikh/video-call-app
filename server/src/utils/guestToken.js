import jwt from 'jsonwebtoken';

const GUEST_TOKEN_SECRET = process.env.GUEST_TOKEN_SECRET || process.env.JWT_SECRET || 'change-this-secret-in-production';
const GUEST_TOKEN_EXPIRES_IN = process.env.GUEST_TOKEN_EXPIRES_IN || '2h';

/**
 * Generate a guest token for joining meetings
 * @param {string} meetingId - The meeting ID
 * @param {string} guestName - The guest's name
 * @returns {string} JWT token
 */
export const generateGuestToken = (meetingId, guestName) => {
  return jwt.sign(
    {
      meetingId,
      guestName,
      type: 'guest'
    },
    GUEST_TOKEN_SECRET,
    { expiresIn: GUEST_TOKEN_EXPIRES_IN }
  );
};

/**
 * Verify a guest token
 * @param {string} token - The guest token
 * @returns {object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
export const verifyGuestToken = (token) => {
  try {
    const decoded = jwt.verify(token, GUEST_TOKEN_SECRET);
    
    if (decoded.type !== 'guest') {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Guest token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid guest token');
    }
    throw error;
  }
};

/**
 * Decode guest token without verification (for debugging)
 * @param {string} token - The guest token
 * @returns {object|null} Decoded token payload or null
 */
export const decodeGuestToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};
