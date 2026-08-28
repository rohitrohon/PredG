const express = require('express');
const router = express.Router();
const Prediction = require('../models/Prediction');
const Matchweek = require('../models/Matchweek');
const GroupStanding = require('../models/GroupStanding');
const Group = require('../models/Group');
const { auth } = require('../middleware/auth');
const { generateIntelligentDefaultPrediction } = require('../utils/autofillHelper');

function getMatchweekDeadlines(matchweek) {
  const d1 = matchweek.matches && matchweek.matches[0] && matchweek.matches[0].kickoffTime 
    ? new Date(matchweek.matches[0].kickoffTime) 
    : new Date(matchweek.deadline);

  const d2 = matchweek.matches && matchweek.matches[3] && matchweek.matches[3].kickoffTime 
    ? new Date(matchweek.matches[3].kickoffTime) 
    : d1;

  return { d1, d2 };
}

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

    const { d1, d2 } = getMatchweekDeadlines(matchweek);
    const now = new Date();

    let prediction = await Prediction.findOne({
      groupId,
      userId: req.user.id,
      matchweekId: req.params.matchweekId
    });

    if (!prediction) {
      if (now > d1) {
        // Automatically generate intelligent default predictions for player who missed Deadline 1
        const defaultData = await generateIntelligentDefaultPrediction(groupId, matchweek, req.user.id);
        prediction = new Prediction(defaultData);
        await prediction.save();
      } else {
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
    } else if (now > d1 && !prediction.isSubmitted) {
      // If user had an unsubmitted draft when Deadline 1 passed, replace with intelligent defaults
      const defaultData = await generateIntelligentDefaultPrediction(groupId, matchweek, req.user.id);
      prediction.predictions = defaultData.predictions;
      prediction.captainMatchId = defaultData.captainMatchId;
      prediction.isSubmitted = true;
      prediction.isAutofilled = true;
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

    const { d1, d2 } = getMatchweekDeadlines(matchweek);
    const now = new Date();

    if (now > d2) {
      return res.status(400).json({ message: 'Deadline 2 has passed. Predictions are permanently locked for this matchweek.' });
    }

    const isSecondChanceWindow = now > d1 && now <= d2;

    let predictionDoc = await Prediction.findOne({
      groupId,
      userId: req.user.id,
      matchweekId: req.params.matchweekId
    });

    if (isSecondChanceWindow) {
      if (!predictionDoc || !predictionDoc.isAutofilled) {
        return res.status(400).json({ message: 'Deadline 1 has passed. Only players with default predictions can edit games 4 & 5 during the second chance deadline.' });
      }

      // Validate that matches 1, 2, and 3 (index 0, 1, 2) were NOT changed
      for (let i = 0; i < Math.min(3, matchweek.matches.length); i++) {
        const origPred = predictionDoc.predictions[i];
        const newPred = predictions[i];
        if (
          !newPred ||
          newPred.result !== origPred.result ||
          newPred.homeScore !== origPred.homeScore ||
          newPred.awayScore !== origPred.awayScore ||
          newPred.safeBet !== origPred.safeBet ||
          newPred.firstGoal !== origPred.firstGoal ||
          newPred.possession !== origPred.possession
        ) {
          return res.status(400).json({ message: 'Games 1, 2, and 3 are locked. You can only edit Games 4 and 5 during the second chance deadline.' });
        }
      }

      // Validate Captain: Must be match 4 or match 5
      const allowedMatchIds = [
        matchweek.matches[3] ? matchweek.matches[3]._id.toString() : null,
        matchweek.matches[4] ? matchweek.matches[4]._id.toString() : null
      ].filter(Boolean);

      if (!captainMatchId || !allowedMatchIds.includes(captainMatchId.toString())) {
        return res.status(400).json({ message: 'During Second Chance Deadline, Captain can only be selected for Game 4 or Game 5.' });
      }

      // Validate Gamble: Must target match 4 or match 5
      if (gamble && gamble.active && gamble.matchId) {
        if (!allowedMatchIds.includes(gamble.matchId.toString())) {
          return res.status(400).json({ message: 'Gamble can only be applied to Game 4 or Game 5 during Second Chance Deadline.' });
        }
      }

      // Validate PowerUps: Must target match 4 or match 5
      if (marketPowerUps && marketPowerUps.length > 0) {
        const invalidChip = marketPowerUps.find(pu => !allowedMatchIds.includes(pu.matchId.toString()));
        if (invalidChip) {
          return res.status(400).json({ message: 'Power-up chips can only be applied to Game 4 or Game 5 during Second Chance Deadline.' });
        }
      }
    }

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
