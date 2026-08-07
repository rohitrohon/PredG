const mongoose = require('mongoose');

const CategoryResultSchema = new mongoose.Schema({
  category: { type: String, required: true },
  player1Val: { type: mongoose.Schema.Types.Mixed },
  player2Val: { type: mongoose.Schema.Types.Mixed },
  player1Pts: { type: Number, default: 0 },
  player2Pts: { type: Number, default: 0 },
  winner: { type: String, enum: ['Player1', 'Player2', 'Draw'], required: true }
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
  player1Wins: { type: Number, default: 0 },
  player2Wins: { type: Number, default: 0 },
  player1Points: { type: Number, default: 0 }, // Battle points awarded (0, 1, 3, or 5)
  player2Points: { type: Number, default: 0 }, // Battle points awarded (0, 1, 3, or 5)
  outcome: { type: String, enum: ['Player1', 'Player2', 'Draw'], default: 'Draw' },
  details: [CategoryResultSchema]
}, { timestamps: true });

module.exports = mongoose.model('Battle', BattleSchema);
