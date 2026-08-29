const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const SIGNUP_CODE = process.env.SIGNUP_CODE || 'PREDG_SECRET';

// @route   POST api/auth/signup
// @desc    Register a new user
// @access  Public
router.post('/signup', async (req, res) => {
  const { name, username, email, password, signupCode } = req.body;

  try {
    // Basic validations
    if (!name || !username || !email || !password || !signupCode) {
      return res.status(400).json({ message: 'Please enter all fields.' });
    }

    // Verify registration code
    if (signupCode !== SIGNUP_CODE) {
      return res.status(400).json({ message: 'Invalid signup registration code.' });
    }

    // Check if user already exists
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      return res.status(400).json({ message: 'Username or email already exists.' });
    }

    // Create user
    user = new User({
      name,
      username,
      email,
      password,
      role: 'player' // default role is player
    });

    // Check if this is the first user; make them admin if so
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      user.role = 'admin';
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'supersecretjwtkeyforpredictiongame30',
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        totalPoints: user.totalPoints,
        battlePoints: user.battlePoints,
        rank: user.rank,
        usernameChangeCount: user.usernameChangeCount || 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during signup.', error: error.message });
  }
});

// @route   POST api/auth/login
// @desc    Login user & get token
// @access  Public
router.post('/login', async (req, res) => {
  const { emailOrUsername, password } = req.body;

  try {
    if (!emailOrUsername || !password) {
      return res.status(400).json({ message: 'Please enter all fields.' });
    }

    const query = emailOrUsername.trim();
    const escapedQuery = query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

    // Find by email or username (case-insensitive for both)
    const user = await User.findOne({
      $or: [
        { email: query.toLowerCase() },
        { username: new RegExp('^' + escapedQuery + '$', 'i') }
      ]
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'supersecretjwtkeyforpredictiongame30',
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        totalPoints: user.totalPoints,
        battlePoints: user.battlePoints,
        rank: user.rank,
        usernameChangeCount: user.usernameChangeCount || 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login.', error: error.message });
  }
});

// @route   PUT api/auth/username
// @desc    Update username (Max 2 changes allowed per user)
// @access  Private
router.put('/username', auth, async (req, res) => {
  const { newUsername } = req.body;

  try {
    if (!newUsername || !newUsername.trim()) {
      return res.status(400).json({ message: 'Please enter a valid username.' });
    }

    const cleanUsername = newUsername.trim();

    if (cleanUsername.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters long.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.username === cleanUsername) {
      return res.status(400).json({ message: 'New username must be different from current username.' });
    }

    const currentCount = user.usernameChangeCount || 0;
    if (currentCount >= 2) {
      return res.status(400).json({ message: 'You have reached the maximum limit of 2 username changes.' });
    }

    // Check if new username is already taken (case-insensitive)
    const existing = await User.findOne({
      username: new RegExp('^' + cleanUsername.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i'),
      _id: { $ne: user._id }
    });

    if (existing) {
      return res.status(400).json({ message: 'Username is already taken by another player.' });
    }

    user.username = cleanUsername;
    user.usernameChangeCount = currentCount + 1;
    await user.save();

    res.json({
      message: 'Username updated successfully!',
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        totalPoints: user.totalPoints,
        battlePoints: user.battlePoints,
        rank: user.rank,
        usernameChangeCount: user.usernameChangeCount
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error updating username.', error: error.message });
  }
});

// @route   POST api/auth/reset-password
// @desc    Reset password using Name & Email verification
// @access  Public
router.post('/reset-password', async (req, res) => {
  const { name, email, newPassword } = req.body;

  try {
    if (!name || !email || !newPassword) {
      return res.status(400).json({ message: 'Please provide Name, Email, and New Password.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const escapedName = trimmedName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

    // Find user matching both email and name (case-insensitive for name)
    const user = await User.findOne({
      email: trimmedEmail,
      name: new RegExp('^' + escapedName + '$', 'i')
    });

    if (!user) {
      return res.status(400).json({ message: 'No account found matching this Name and Email combination.' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password successfully reset! You can now log in with your new password.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during password reset.', error: error.message });
  }
});

// @route   GET api/auth/me
// @desc    Get current user data
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving profile.', error: error.message });
  }
});

// @route   GET api/auth/users
// @desc    Get all users (for standings leaderboard)
// @access  Private
router.get('/users', auth, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ totalPoints: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving leaderboard.', error: error.message });
  }
});

module.exports = router;
