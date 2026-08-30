const express = require('express');
const router = express.Router();
const Battle = require('../models/Battle');
const Group = require('../models/Group');
const Matchweek = require('../models/Matchweek');
const Prediction = require('../models/Prediction');
const GroupStanding = require('../models/GroupStanding');
const { scoreMatchweek } = require('../utils/scoringEngine');
const { auth } = require('../middleware/auth');

const AVERAGE_PLAYER_ID = '600000000000000000000000';

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

            // Update Prediction documents with battle points scored
            if (bRes.player1Id && bRes.player1Id.toString() !== AVERAGE_PLAYER_ID) {
              await Prediction.findOneAndUpdate(
                { groupId, userId: bRes.player1Id, matchweekId },
                { battlePointsScored: bRes.player1Points }
              );
            }
            if (bRes.player2Id && bRes.player2Id.toString() !== AVERAGE_PLAYER_ID) {
              await Prediction.findOneAndUpdate(
                { groupId, userId: bRes.player2Id, matchweekId },
                { battlePointsScored: bRes.player2Points }
              );
            }
            if (bRes.isTriad && bRes.player3Id && bRes.player3Id.toString() !== AVERAGE_PLAYER_ID) {
              await Prediction.findOneAndUpdate(
                { groupId, userId: bRes.player3Id, matchweekId },
                { battlePointsScored: bRes.player3Points }
              );
            }
          }

          // Sync GroupStandings for battlePoints
          const standings = await GroupStanding.find({ groupId });
          for (const std of standings) {
            if (!std.userId || std.userId.toString() === AVERAGE_PLAYER_ID) continue;

            const uIdStr = std.userId.toString();
            // Calculate total Battle Points directly from all battles in this group
            const userBattles = await Battle.find({
              groupId,
              $or: [{ player1Id: std.userId }, { player2Id: std.userId }, { player3Id: std.userId }]
            });

            let sumBattlePoints = 0;
            userBattles.forEach(b => {
              if (b.player1Id && b.player1Id.toString() === uIdStr) sumBattlePoints += (b.player1Points || 0);
              if (b.player2Id && b.player2Id.toString() === uIdStr) sumBattlePoints += (b.player2Points || 0);
              if (b.isTriad && b.player3Id && b.player3Id.toString() === uIdStr) sumBattlePoints += (b.player3Points || 0);
            });

            std.battlePoints = sumBattlePoints;
            await std.save();
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
