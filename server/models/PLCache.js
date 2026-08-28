const mongoose = require('mongoose');

const PLCacheSchema = new mongoose.Schema({
  dataType: {
    type: String,
    enum: ['standings', 'fixtures'],
    required: true
  },
  matchweekNumber: {
    type: Number,
    default: null
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  lastRefreshedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Compound index for fast lookup and uniqueness per data type / matchweek
PLCacheSchema.index({ dataType: 1, matchweekNumber: 1 }, { unique: true });

module.exports = mongoose.model('PLCache', PLCacheSchema);
