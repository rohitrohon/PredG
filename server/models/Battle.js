const mongoose = require('mongoose');

const CategoryResultSchema = new mongoose.Schema({
  category: { type: String, required: true },
  player1Val: { type: mongoose.Schema.Types.Mixed },
  player2Val: { type: mongoose.Schema.Types.Mixed },
  player3Val: { type: mongoose.Schema.Types.Mixed, default: null },
  player1Pts: { type: Number, default: 0 },
  player2Pts: { type: Number, default: 0 },
  player3Pts: { type: Number, default: 0 },
  winner: { type: String, required: true }
});

const BattleSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  matchweekId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Matchweek',
    required: true
  },
  isTriad: {
    type: Boolean,
    default: false
  },
  player1Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  player2Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  player3Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  player1Wins: { type: Number, default: 0 },
  player2Wins: { type: Number, default: 0 },
  player3Wins: { type: Number, default: 0 },
  player1Points: { type: Number, default: 0 }, // Battle points awarded (0, 1, 3, or 5)
  player2Points: { type: Number, default: 0 }, // Battle points awarded (0, 1, 3, or 5)
  player3Points: { type: Number, default: 0 }, // Battle points awarded (0, 1, 3, or 5)
  outcome: { type: String, default: 'Draw' },
  details: [CategoryResultSchema]
}, { timestamps: true });

module.exports = mongoose.model('Battle', BattleSchema);
