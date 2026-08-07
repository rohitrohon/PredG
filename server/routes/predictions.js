const express = require('express');
const router = express.Router();
const Prediction = require('../models/Prediction');
const Matchweek = require('../models/Matchweek');
const GroupStanding = require('../models/GroupStanding');
const Group = require('../models/Group');
const { auth } = require('../middleware/auth');

function isDeadlinePassed(deadline) {
  return new Date() > new Date(deadline);
}

// @route   GET api/predictions/my/:matchweekId
// @desc    Get current user's predictions for a matchweek in a group
// @access  Private
router.get('/my/:matchweekId', auth, async (req, res) => {
  const { groupId } = req.query;

  try {
    if (!groupId) {
      return res.status(400).json({ message: 'groupId query parameter is required.' });
    }

    const matchweek = await Matchweek.findById(req.params.matchweekId);
    if (!matchweek) {
      return res.status(404).json({ message: 'Matchweek not found.' });
    }

    // Verify membership
    const group = await Group.findById(groupId);
    if (!group || !group.members.some(id => id.toString() === req.user.id)) {
      return res.status(403).json({ message: 'Access denied. You are not a member of this group.' });
    }

    let prediction = await Prediction.findOne({
      groupId,
      userId: req.user.id,
      matchweekId: req.params.matchweekId
    });

    if (!prediction) {
      if (isDeadlinePassed(matchweek.deadline)) {
        return res.status(400).json({ message: 'Submission deadline has passed. Cannot create new prediction.' });
      }

      const predictionsTemplate = matchweek.matches.map((m) => ({
        matchId: m._id,
        result: 'Home',
        homeScore: 0,
        awayScore: 0,
        safeBet: 'Home',
        firstGoal: 'Home',
        possession: 'Home',
        wildPredictionCategory: 'None',
        wildPredictionValue: 0
      }));

      prediction = new Prediction({
        groupId,
        userId: req.user.id,
        matchweekId: req.params.matchweekId,
        isSubmitted: false,
        predictions: predictionsTemplate,
        captainMatchId: matchweek.matches[0] ? matchweek.matches[0]._id : null
      });

      await prediction.save();
    }

    res.json(prediction);
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving predictions.', error: error.message });
  }
});

// @route   POST api/predictions/submit/:matchweekId
// @desc    Submit / Save prediction draft for a group
// @access  Private
router.post('/submit/:matchweekId', auth, async (req, res) => {
  const { groupId, predictions, captainMatchId, gamble, marketPowerUps, isFinalSubmission } = req.body;

  try {
    if (!groupId) {
      return res.status(400).json({ message: 'groupId is required.' });
    }

    const matchweek = await Matchweek.findById(req.params.matchweekId);
    if (!matchweek) {
      return res.status(404).json({ message: 'Matchweek not found.' });
    }

    const group = await Group.findById(groupId);
    if (!group || !group.members.some(id => id.toString() === req.user.id)) {
      return res.status(403).json({ message: 'Access denied. You are not a member of this group.' });
    }

    if (isDeadlinePassed(matchweek.deadline)) {
      return res.status(400).json({ message: 'Submission deadline has passed. Predictions are locked.' });
    }

    let predictionDoc = await Prediction.findOne({
      groupId,
      userId: req.user.id,
      matchweekId: req.params.matchweekId
    });

    if (!predictionDoc) {
      predictionDoc = new Prediction({
        groupId,
        userId: req.user.id,
        matchweekId: req.params.matchweekId
      });
    }

    // Calculate net cost differences of powerups (refunding old, charging new)
    const calculatePowerUpCost = (powerUpsList) => {
      let cost = 0;
      if (!powerUpsList) return 0;
      powerUpsList.forEach((pu) => {
        if (pu.type === 'Double') cost += 5;
        if (pu.type === 'Triple') cost += 10;
        if (pu.type === 'Shield') cost += 15;
      });
      return cost;
    };

    const oldCost = calculatePowerUpCost(predictionDoc.marketPowerUps);
    const newCost = calculatePowerUpCost(marketPowerUps);
    const netCost = newCost - oldCost;

    const standing = await GroupStanding.findOne({ groupId, userId: req.user.id });
    if (!standing) {
      return res.status(400).json({ message: 'Group standing not found for this user.' });
    }

    if (standing.battlePoints < netCost) {
      return res.status(400).json({
        message: `Insufficient Battle Points. Net cost: ${netCost} BP, Available: ${standing.battlePoints} BP.`
      });
    }

    // Validate predictions counts & details
    if (!predictions || predictions.length !== matchweek.matches.length) {
      return res.status(400).json({ message: `You must provide predictions for all ${matchweek.matches.length} matches.` });
    }

    if (!captainMatchId) {
      return res.status(400).json({ message: 'You must select a Captain match.' });
    }

    // Validate Gamble limits
    if (gamble && gamble.active) {
      if (!gamble.matchId) {
        return res.status(400).json({ message: 'Please select a match to gamble on.' });
      }
      if (gamble.points <= 0) {
        return res.status(400).json({ message: 'Gamble points must be greater than 0.' });
      }

      let maxAllowedGamble = Math.floor(standing.totalPoints * 0.10);
      if (maxAllowedGamble < 10) {
        maxAllowedGamble = Math.max(0, maxAllowedGamble);
      }

      const totalGroupUsers = group.members.length;
      if (standing.rank !== null) {
        if (standing.rank <= 5) {
          maxAllowedGamble = Math.min(maxAllowedGamble, 500);
        } else {
          const bottomThreshold = totalGroupUsers - 5;
          if (standing.rank > bottomThreshold) {
            maxAllowedGamble = Math.min(maxAllowedGamble, 1000);
          }
        }
      }

      if (gamble.points > maxAllowedGamble) {
        return res.status(400).json({
          message: `Gamble points exceed your allowed limit. Your max gamble limit in this group is ${maxAllowedGamble} points.`
        });
      }
    }

    // Apply updates
    predictionDoc.predictions = predictions;
    predictionDoc.captainMatchId = captainMatchId;
    predictionDoc.gamble = gamble;
    predictionDoc.marketPowerUps = marketPowerUps || [];
    predictionDoc.isSubmitted = true;

    // Deduct net Battle Points cost
    standing.battlePoints -= netCost;
    await standing.save();

    await predictionDoc.save();
    res.json({ message: 'Predictions submitted/updated successfully!', prediction: predictionDoc });
  } catch (error) {
    res.status(500).json({ message: 'Server error saving predictions.', error: error.message });
  }
});

// @route   GET api/predictions/matchweek/:matchweekId
// @desc    Get all predictions for a matchweek (hides answers if deadline not passed)
// @access  Private
router.get('/matchweek/:matchweekId', auth, async (req, res) => {
  const { groupId } = req.query;

  try {
    if (!groupId) {
      return res.status(400).json({ message: 'groupId query parameter is required.' });
    }

    const matchweek = await Matchweek.findById(req.params.matchweekId);
    if (!matchweek) {
      return res.status(404).json({ message: 'Matchweek not found.' });
    }

    const group = await Group.findById(groupId);
    const adminIdStr = group?.adminId?._id ? group.adminId._id.toString() : group?.adminId?.toString();
    const isMemberOrAdmin = group && (group.members.some(id => id.toString() === req.user.id) || adminIdStr === req.user.id || req.user.role === 'admin');
    if (!group || !isMemberOrAdmin) {
      return res.status(403).json({ message: 'Access denied. You are not a member or admin of this group.' });
    }

    const predictions = await Prediction.find({ groupId, matchweekId: req.params.matchweekId })
      .populate('userId', 'username');

    const deadlinePassed = isDeadlinePassed(matchweek.deadline);

    if (!deadlinePassed) {
      const safePredictions = predictions.map((p) => {
        return {
          _id: p._id,
          userId: p.userId,
          matchweekId: p.matchweekId,
          isSubmitted: p.isSubmitted,
          isAutofilled: p.isAutofilled,
          predictions: [],
          captainMatchId: null,
          gamble: { active: p.gamble ? p.gamble.active : false },
          marketPowerUps: []
        };
      });
      return res.json({ deadlinePassed: false, predictions: safePredictions });
    }

    res.json({ deadlinePassed: true, predictions });
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving predictions.', error: error.message });
  }
});

module.exports = router;
