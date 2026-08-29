const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    default: '',
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['player', 'admin'],
    default: 'player',
  },
  totalPoints: {
    type: Number,
    default: 0,
  },
  battlePoints: {
    type: Number,
    default: 0,
  },
  rank: {
    type: Number,
    default: null,
  },
  usernameChangeCount: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
