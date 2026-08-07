const mongoose = require('mongoose');

const GroupStandingSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
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
}, { timestamps: true });

// A user can have only one standing per group
GroupStandingSchema.index({ groupId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('GroupStanding', GroupStandingSchema);
