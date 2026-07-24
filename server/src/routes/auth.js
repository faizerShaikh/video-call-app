import express from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, getMe, logout } from '../controllers/authController.js';
import {
  forgotPassword,
  resendOtp,
  verifyOtp,
  resetPassword,
} from '../controllers/passwordResetController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many password reset attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes
router.post('/register', authLimiter, register);
router.post('/login', login);
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/resend-otp', passwordResetLimiter, resendOtp);
router.post('/verify-otp', passwordResetLimiter, verifyOtp);
router.post('/reset-password', passwordResetLimiter, resetPassword);

// Protected routes
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

export default router;
