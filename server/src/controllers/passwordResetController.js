import crypto from 'crypto';
import User from '../models/User.js';
import { sendOtpEmail } from '../utils/email.js';
import { validateEmail, validatePasswordStrength } from '../utils/validation.js';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const GENERIC_SEND_MESSAGE = 'If an account exists with this email, a verification code has been sent.';

const OTP_FIELDS = '+otpHash +otpExpiresAt +otpUsed +otpAttempts +resetTokenHash +resetTokenExpiresAt +resetTokenUsed';

const hashValue = (value) =>
  crypto.createHash('sha256').update(String(value)).digest('hex');

const generateOtp = () =>
  String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');

const generateResetToken = () => crypto.randomBytes(32).toString('hex');

const createAndSendOtp = async (user) => {
  const otp = generateOtp();

  user.otpHash = hashValue(otp);
  user.otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
  user.otpUsed = false;
  user.otpAttempts = 0;
  user.resetTokenHash = null;
  user.resetTokenExpiresAt = null;
  user.resetTokenUsed = false;
  await user.save();

  await sendOtpEmail({
    to: user.email,
    otp,
    name: user.name,
  });
};

// POST /api/auth/forgot-password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'A valid email address is required',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findByEmail(normalizedEmail).select(OTP_FIELDS);

    if (!user) {
      return res.json({
        success: true,
        message: GENERIC_SEND_MESSAGE,
      });
    }

    try {
      await createAndSendOtp(user);
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      return res.status(500).json({
        success: false,
        error: 'Failed to send verification code. Please try again later.',
      });
    }

    return res.json({
      success: true,
      message: GENERIC_SEND_MESSAGE,
      expiresInMinutes: 10,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process password reset request',
    });
  }
};

// POST /api/auth/resend-otp
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'A valid email address is required',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findByEmail(normalizedEmail).select(OTP_FIELDS);

    if (!user) {
      return res.json({
        success: true,
        message: GENERIC_SEND_MESSAGE,
      });
    }

    try {
      await createAndSendOtp(user);
    } catch (emailError) {
      console.error('Failed to resend OTP email:', emailError);
      return res.status(500).json({
        success: false,
        error: 'Failed to resend verification code. Please try again later.',
      });
    }

    return res.json({
      success: true,
      message: GENERIC_SEND_MESSAGE,
      expiresInMinutes: 10,
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to resend verification code',
    });
  }
};

// POST /api/auth/verify-otp
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'A valid email address is required',
      });
    }

    if (!otp || !/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({
        success: false,
        error: 'A valid 6-digit verification code is required',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findByEmail(normalizedEmail).select(OTP_FIELDS);

    if (!user || !user.otpHash) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification code',
      });
    }

    if (user.otpUsed) {
      return res.status(400).json({
        success: false,
        error: 'This verification code has already been used',
      });
    }

    if (!user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please request a new one.',
      });
    }

    if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        error: 'Too many invalid attempts. Please request a new verification code.',
      });
    }

    const isMatch = user.otpHash === hashValue(otp);
    if (!isMatch) {
      user.otpAttempts += 1;
      await user.save();

      const remaining = MAX_OTP_ATTEMPTS - user.otpAttempts;
      return res.status(400).json({
        success: false,
        error: remaining > 0
          ? `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Too many invalid attempts. Please request a new verification code.',
      });
    }

    const resetToken = generateResetToken();

    user.otpUsed = true;
    user.otpHash = null;
    user.resetTokenHash = hashValue(resetToken);
    user.resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
    user.resetTokenUsed = false;
    await user.save();

    return res.json({
      success: true,
      message: 'Verification successful',
      resetToken,
      expiresInMinutes: 15,
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify code',
    });
  }
};

// POST /api/auth/reset-password
export const resetPassword = async (req, res) => {
  try {
    const { email, resetToken, password } = req.body;

    if (!email || !validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'A valid email address is required',
      });
    }

    if (!resetToken) {
      return res.status(400).json({
        success: false,
        error: 'Reset token is required',
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'New password is required',
      });
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        error: passwordValidation.message,
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findByEmail(normalizedEmail).select('+password ' + OTP_FIELDS);

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Unable to reset password. Please request a new verification code.',
      });
    }

    if (!user.resetTokenHash) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset session. Please verify your email again.',
      });
    }

    if (user.resetTokenUsed) {
      return res.status(400).json({
        success: false,
        error: 'This reset session has already been used',
      });
    }

    if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        error: 'Reset session has expired. Please request a new verification code.',
      });
    }

    if (user.resetTokenHash !== hashValue(resetToken)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset session. Please verify your email again.',
      });
    }

    user.password = password;
    user.clearResetFields();
    await user.save();

    return res.json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset password',
    });
  }
};
