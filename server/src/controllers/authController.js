import User from '../models/User.js';
import { generateToken } from '../utils/jwt.js';
import { validatePasswordStrength, validateEmail, validatePhone } from '../utils/validation.js';

// Register new user
export const register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Validate phone format
    if (!validatePhone(phone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format'
      });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        error: passwordValidation.message
      });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered'
      });
    }

    // Create new user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password,
      status: 'pending'
    });

    await user.save();

    // Return user without password
    const userResponse = user.toJSON();

    res.status(201).json({
      success: true,
      message: 'Registration successful. Awaiting admin approval.',
      user: {
        id: userResponse._id,
        email: userResponse.email,
        name: userResponse.name,
        status: userResponse.status
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Registration failed'
    });
  }
};

// Login user
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Find user with password (using select('+password'))
    const user = await User.findByEmail(email).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check user status
    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        error: 'Account pending approval',
        status: 'pending'
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        success: false,
        error: 'Account has been rejected',
        status: 'rejected',
        rejectionReason: user.rejectionReason
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'Account has been suspended',
        status: 'suspended',
        suspensionReason: user.suspensionReason
      });
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Return user without password
    const userResponse = user.toJSON();

    res.json({
      success: true,
      token,
      user: {
        id: userResponse._id,
        name: userResponse.name,
        email: userResponse.email,
        phone: userResponse.phone,
        isAdmin: userResponse.isAdmin,
        status: userResponse.status,
        createdAt: userResponse.createdAt
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Login failed'
    });
  }
};

// Get current user
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get user'
    });
  }
};

// Logout (client-side token removal, but we can invalidate if using sessions)
export const logout = async (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
};
