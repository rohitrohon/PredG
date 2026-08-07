const mongoose = require('mongoose');

const SingleMatchPredictionSchema = new mongoose.Schema({
  matchId: { type: mongoose.Schema.Types.ObjectId, required: true },
  result: { type: String, enum: ['Home', 'Away', 'Draw'], required: true },
  homeScore: { type: Number, required: true },
  awayScore: { type: Number, required: true },
  safeBet: { type: String, enum: ['Home', 'Away'], required: true },
  firstGoal: { type: String, enum: ['Home', 'Away', 'No goal'], required: true },
  possession: { type: String, enum: ['Home', 'Away', 'Equal'], required: true },
  wildPredictionCategory: { type: String, enum: ['None', 'Yellow Cards', 'Offsides', 'Corners', 'Total Shots'], default: 'None' },
  wildPredictionValue: { type: Number, default: 0 }
});

const PredictionSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  matchweekId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Matchweek',
    required: true
  },
  isSubmitted: {
    type: Boolean,
    default: false
  },
  isAutofilled: {
    type: Boolean,
    default: false
  },
  predictions: [SingleMatchPredictionSchema],
  captainMatchId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  gamble: {
    active: { type: Boolean, default: false },
    points: { type: Number, default: 0 },
    matchId: { type: mongoose.Schema.Types.ObjectId, default: null }
  },
  marketPowerUps: [{
    matchId: { type: mongoose.Schema.Types.ObjectId, required: true },
    type: { type: String, enum: ['Double', 'Triple', 'Shield'], required: true }
  }],
  totalPointsScored: { type: Number, default: 0 },
  battlePointsScored: { type: Number, default: 0 }
}, { timestamps: true });

// Ensure unique predictions per user per matchweek in a group
PredictionSchema.index({ groupId: 1, userId: 1, matchweekId: 1 }, { unique: true });

module.exports = mongoose.model('Prediction', PredictionSchema);
