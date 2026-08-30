const express = require('express');
const router = express.Router();
const Battle = require('../models/Battle');
const Group = require('../models/Group');
const Matchweek = require('../models/Matchweek');
const Prediction = require('../models/Prediction');
const { scoreMatchweek } = require('../utils/scoringEngine');
const { auth } = require('../middleware/auth');

// @route   GET api/battle/:matchweekId
// @desc    Get all battles for a specific matchweek in a group (auto-calculates/syncs if results present)
// @access  Private
router.get('/:matchweekId', auth, async (req, res) => {
  const { groupId } = req.query;

  try {
    if (!groupId) {
      return res.status(400).json({ message: 'groupId query parameter is required.' });
    }

    // Verify user is a member or admin of the group
    const group = await Group.findById(groupId);
    const adminIdStr = group?.adminId?._id ? group.adminId._id.toString() : group?.adminId?.toString();
    const isMemberOrAdmin = group && (group.members.some(id => id.toString() === req.user.id) || adminIdStr === req.user.id || req.user.role === 'admin');
    if (!group || !isMemberOrAdmin) {
      return res.status(403).json({ message: 'Access denied. You are not a member or admin of this group.' });
    }

    const matchweekId = req.params.matchweekId;
    const matchweekDoc = await Matchweek.findById(matchweekId);

    if (matchweekDoc && matchweekDoc.battleMatchId) {
      const battleMatch = matchweekDoc.matches.find(m => m._id.toString() === matchweekDoc.battleMatchId.toString());
      if (battleMatch && battleMatch.actualResults && (battleMatch.actualResults.result || (battleMatch.actualResults.homeScore !== undefined && battleMatch.actualResults.homeScore !== null))) {
        const predictionsList = await Prediction.find({ groupId, matchweekId });
        const existingBattles = await Battle.find({ groupId, matchweekId });

        if (existingBattles.length > 0) {
          const { battleResults } = scoreMatchweek(matchweekDoc, predictionsList, existingBattles);
          for (const bRes of battleResults) {
            const bUpdate = {
              player1Wins: bRes.player1Wins,
              player2Wins: bRes.player2Wins,
              player1Points: bRes.player1Points,
              player2Points: bRes.player2Points,
              outcome: bRes.outcome,
              details: bRes.details
            };
            if (bRes.isTriad) {
              bUpdate.player3Wins = bRes.player3Wins;
              bUpdate.player3Points = bRes.player3Points;
            }
            await Battle.findByIdAndUpdate(bRes.battleId, bUpdate);
          }
        }
      }
    }

    const battles = await Battle.find({ groupId, matchweekId })
      .populate('player1Id', 'username name email')
      .populate('player2Id', 'username name email')
      .populate('player3Id', 'username name email');
      
    res.json(battles);
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving battles.', error: error.message });
  }
});

module.exports = router;
