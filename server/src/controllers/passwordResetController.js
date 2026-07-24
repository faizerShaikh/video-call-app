import crypto from 'crypto';
import User from '../models/User.js';
import PasswordReset from '../models/PasswordReset.js';
import { sendOtpEmail } from '../utils/email.js';
import { validateEmail, validatePasswordStrength } from '../utils/validation.js';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const MAX_OTP_ATTEMPTS = 5;
const GENERIC_SEND_MESSAGE = 'If an account exists with this email, a verification code has been sent.';

const hashValue = (value) =>
  crypto.createHash('sha256').update(String(value)).digest('hex');

const generateOtp = () =>
  String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');

const generateResetToken = () => crypto.randomBytes(32).toString('hex');

const findActiveReset = async (email) => {
  return PasswordReset.findOne({ email }).sort({ createdAt: -1 });
};

const createAndSendOtp = async (user) => {
  const otp = generateOtp();
  const email = user.email.toLowerCase();

  await PasswordReset.deleteMany({ email });

  await PasswordReset.create({
    email,
    otpHash: hashValue(otp),
    otpExpiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    otpUsed: false,
    attempts: 0,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    resetTokenUsed: false,
  });

  await sendOtpEmail({
    to: email,
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
    const user = await User.findByEmail(normalizedEmail);

    // Do not reveal whether the email exists
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
    const user = await User.findByEmail(normalizedEmail);

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
    const resetRecord = await findActiveReset(normalizedEmail);

    if (!resetRecord || !resetRecord.otpHash) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification code',
      });
    }

    if (resetRecord.otpUsed) {
      return res.status(400).json({
        success: false,
        error: 'This verification code has already been used',
      });
    }

    if (!resetRecord.otpExpiresAt || resetRecord.otpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please request a new one.',
      });
    }

    if (resetRecord.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        error: 'Too many invalid attempts. Please request a new verification code.',
      });
    }

    const isMatch = resetRecord.otpHash === hashValue(otp);
    if (!isMatch) {
      resetRecord.attempts += 1;
      await resetRecord.save();

      const remaining = MAX_OTP_ATTEMPTS - resetRecord.attempts;
      return res.status(400).json({
        success: false,
        error: remaining > 0
          ? `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Too many invalid attempts. Please request a new verification code.',
      });
    }

    const resetToken = generateResetToken();

    resetRecord.otpUsed = true;
    resetRecord.otpHash = null;
    resetRecord.resetTokenHash = hashValue(resetToken);
    resetRecord.resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
    resetRecord.resetTokenUsed = false;
    await resetRecord.save();

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
    const user = await User.findByEmail(normalizedEmail).select('+password');

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Unable to reset password. Please request a new verification code.',
      });
    }

    const resetRecord = await findActiveReset(normalizedEmail);

    if (!resetRecord || !resetRecord.resetTokenHash) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset session. Please verify your email again.',
      });
    }

    if (resetRecord.resetTokenUsed) {
      return res.status(400).json({
        success: false,
        error: 'This reset session has already been used',
      });
    }

    if (
      !resetRecord.resetTokenExpiresAt ||
      resetRecord.resetTokenExpiresAt.getTime() < Date.now()
    ) {
      return res.status(400).json({
        success: false,
        error: 'Reset session has expired. Please request a new verification code.',
      });
    }

    if (resetRecord.resetTokenHash !== hashValue(resetToken)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset session. Please verify your email again.',
      });
    }

    user.password = password;
    await user.save();

    resetRecord.resetTokenUsed = true;
    resetRecord.resetTokenHash = null;
    resetRecord.otpHash = null;
    resetRecord.otpUsed = true;
    await resetRecord.save();

    // Invalidate any other outstanding reset records for this email
    await PasswordReset.deleteMany({
      email: normalizedEmail,
      _id: { $ne: resetRecord._id },
    });

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
