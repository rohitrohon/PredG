const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  homeTeam: { type: String, required: true },
  awayTeam: { type: String, required: true },
  kickoffTime: { type: Date, required: true },
  actualResults: {
    homeScore: { type: Number, default: null },
    awayScore: { type: Number, default: null },
    result: { type: String, enum: ['Home', 'Away', 'Draw', null], default: null },
    firstGoal: { type: String, enum: ['Home', 'Away', 'No goal', null], default: null },
    possession: { type: String, enum: ['Home', 'Away', 'Equal', null], default: null },
    yellowCards: { type: Number, default: null },
    offsides: { type: Number, default: null },
    corners: { type: Number, default: null },
    shots: { type: Number, default: null },
    wildPredictionCorrectUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  wildPredictionDetails: { type: String, default: 'Optional Wild Prediction' }
});

const MatchweekSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  matchweekNumber: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'completed'],
    default: 'draft'
  },
  deadline: {
    type: Date,
    required: true
  },
  battleMatchId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  matches: [MatchSchema]
}, { timestamps: true });

// Ensure unique matchweek number within a group
MatchweekSchema.index({ groupId: 1, matchweekNumber: 1 }, { unique: true });

module.exports = mongoose.model('Matchweek', MatchweekSchema);
