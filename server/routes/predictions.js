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

    // Validate wild prediction category counts: max 2 matches per wild category
    const catCounts = {};
    for (const p of predictions) {
      const cat = p.wildPredictionCategory;
      if (cat && cat !== 'None') {
        catCounts[cat] = (catCounts[cat] || 0) + 1;
        if (catCounts[cat] > 2) {
          return res.status(400).json({ message: `You can select "${cat}" as the wild category for a maximum of 2 matches per matchweek.` });
        }
      }
    }

    // Sanitize numeric fields & set per-match isAutofilled status
    const sanitizedPredictions = predictions.map((p, idx) => {
      let matchAutofilled = false;
      if (isSecondChanceWindow) {
        if (idx < 3) {
          matchAutofilled = true; // Games 1-3 are ALWAYS autofilled if user missed 1st deadline
        } else {
          matchAutofilled = false; // Games 4 & 5 submitted by user during 2nd chance deadline
        }
      } else {
        matchAutofilled = false; // Submitted by user before 1st deadline
      }

      return {
        ...p,
        homeScore: Math.abs(Number(p.homeScore) || 0),
        awayScore: Math.abs(Number(p.awayScore) || 0),
        wildPredictionValue: Math.abs(Number(p.wildPredictionValue) || 0),
        isAutofilled: matchAutofilled
      };
    });

    let sanitizedGamble = gamble;
    if (sanitizedGamble && sanitizedGamble.active) {
      sanitizedGamble.points = Math.abs(Number(sanitizedGamble.points) || 0);
    }

    // Apply updates
    predictionDoc.predictions = sanitizedPredictions;
    predictionDoc.captainMatchId = captainMatchId;
    predictionDoc.gamble = sanitizedGamble;
    predictionDoc.marketPowerUps = marketPowerUps || [];
    predictionDoc.isSubmitted = true;
    predictionDoc.isAutofilled = sanitizedPredictions.some(p => p.isAutofilled);

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

    const { checkAndSyncActiveMatchweeks } = require('../utils/autoResultFetcher');

    const { d1, d2 } = getMatchweekDeadlines(matchweek);
    const now = new Date();
    const deadlinePassed = now > d1;
    const secondDeadlinePassed = now > d2;

    // Trigger live match API sync asynchronously in background if deadline 1 has passed
    if (deadlinePassed) {
      checkAndSyncActiveMatchweeks().catch(e => console.error('Live sync error:', e));
    }

    let predictions = await Prediction.find({ groupId, matchweekId: req.params.matchweekId })
      .populate('userId', 'username');

    // IF DEADLINE 1 HAS PASSED: Ensure EVERY member of group.members has a submitted prediction (autofill if missing or unsubmitted)
    if (deadlinePassed && group.members && group.members.length > 0) {
      const submittedUserIds = new Set(
        predictions
          .filter(p => p.isSubmitted)
          .map(p => (p.userId?._id ? p.userId._id.toString() : p.userId?.toString()))
      );

      let needsReFetch = false;
      for (const memberId of group.members) {
        const mIdStr = memberId.toString();
        if (!submittedUserIds.has(mIdStr)) {
          try {
            let predDoc = await Prediction.findOne({
              groupId,
              matchweekId: req.params.matchweekId,
              userId: memberId
            });

            const defaultData = await generateIntelligentDefaultPrediction(groupId, matchweek, memberId);

            if (!predDoc) {
              predDoc = new Prediction(defaultData);
              await predDoc.save();
            } else if (!predDoc.isSubmitted) {
              predDoc.predictions = defaultData.predictions;
              predDoc.captainMatchId = defaultData.captainMatchId;
              predDoc.gamble = defaultData.gamble;
              predDoc.marketPowerUps = defaultData.marketPowerUps;
              predDoc.isSubmitted = true;
              predDoc.isAutofilled = true;
              await predDoc.save();
            }
            needsReFetch = true;
          } catch (err) {
            console.error(`Error auto-generating default predictions for member ${mIdStr}:`, err);
          }
        }
      }

      if (needsReFetch) {
        predictions = await Prediction.find({ groupId, matchweekId: req.params.matchweekId })
          .populate('userId', 'username');
      }
    }

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
      return res.json({ deadlinePassed: false, secondDeadlinePassed: false, predictions: safePredictions });
    }

    // Helper to test single match default prediction pattern
    const isSingleMatchDefaultPattern = (mP) => {
      if (!mP) return false;
      const isDefaultScore = (mP.homeScore === 3 && mP.awayScore === 0) || (mP.homeScore === 0 && mP.awayScore === 3) || (mP.homeScore === 1 && mP.awayScore === 0);
      const isDefaultSafe = mP.safeBet === 'Home';
      const isDefaultWild = !mP.wildPredictionCategory || mP.wildPredictionCategory === 'None';
      return isDefaultScore && isDefaultSafe && isDefaultWild;
    };

    // Helper to test if prediction doc was autofilled due to missing Deadline 1
    const isDocAutofilledPattern = (predDoc) => {
      if (!predDoc) return false;
      if (predDoc.isAutofilled) return true;
      if (predDoc.predictions && predDoc.predictions.length >= 3) {
        return predDoc.predictions.slice(0, 3).every(isSingleMatchDefaultPattern);
      }
      return false;
    };

    // Populate and format predictions with accurate per-match and doc-level isAutofilled status
    const formatPredictionsList = (predsList) => {
      return predsList.map(p => {
        const plain = p.toObject ? p.toObject() : { ...p };
        const docAutofilled = isDocAutofilledPattern(plain);

        const formattedMatchPreds = (plain.predictions || []).map((mP, idx) => {
          let matchAutofilled = false;
          if (mP.isAutofilled === true) {
            matchAutofilled = true;
          } else if (mP.isAutofilled === false) {
            matchAutofilled = false;
          } else if (docAutofilled) {
            if (idx < 3) {
              matchAutofilled = true;
            } else {
              matchAutofilled = isSingleMatchDefaultPattern(mP);
            }
          }
          return { ...mP, isAutofilled: matchAutofilled };
        });

        return {
          ...plain,
          isAutofilled: docAutofilled,
          predictions: formattedMatchPreds
        };
      });
    };

    // Matchweek Deadline 1 passed.
    // Check requesting user's prediction submission status
    const requestingUserPred = predictions.find(p => {
      const pUserId = p.userId?._id ? p.userId._id.toString() : p.userId?.toString();
      return pUserId === req.user.id;
    });

    const isRequestingUserAutofilled = isDocAutofilledPattern(requestingUserPred);
    const isRequestingUserSubmittedBeforeD1 = requestingUserPred && requestingUserPred.isSubmitted && !isRequestingUserAutofilled;

    const formattedAllPredictions = formatPredictionsList(predictions);

    // If requesting user submitted before Deadline 1 OR Deadline 2 has passed, reveal all 5 match predictions for all users
    if (isRequestingUserSubmittedBeforeD1 || secondDeadlinePassed) {
      return res.json({ deadlinePassed: true, secondDeadlinePassed, predictions: formattedAllPredictions });
    }

    // For autofilled users before Deadline 2 passes: hide predictions for Matches 4 & 5 of other users
    const lastTwoMatchIds = matchweek.matches && matchweek.matches.length >= 5 
      ? matchweek.matches.slice(3).map(m => m._id.toString())
      : [];

    const processedPredictions = formattedAllPredictions.map((p) => {
      const pUserIdStr = p.userId?._id ? p.userId._id.toString() : p.userId?.toString();
      // Keep requesting user's own predictions intact so they can view/edit their own Games 4 & 5
      if (pUserIdStr === req.user.id) {
        return p;
      }

      const sanitizedPredictions = (p.predictions || []).map((singleP) => {
        const mIdStr = singleP.matchId ? singleP.matchId.toString() : '';
        if (lastTwoMatchIds.includes(mIdStr)) {
          return {
            ...singleP,
            result: 'Locked',
            homeScore: null,
            awayScore: null,
            safeBet: null,
            firstGoal: 'Locked',
            possession: 'Locked',
            wildPredictionCategory: 'None',
            wildPredictionValue: null,
            isLockedWindow: true
          };
        }
        return singleP;
      });

      let sanitizedCaptainId = p.captainMatchId;
      if (sanitizedCaptainId && lastTwoMatchIds.includes(sanitizedCaptainId.toString())) {
        sanitizedCaptainId = null;
      }

      let sanitizedGamble = p.gamble;
      if (sanitizedGamble && sanitizedGamble.matchId && lastTwoMatchIds.includes(sanitizedGamble.matchId.toString())) {
        sanitizedGamble = { active: false, points: 0, matchId: null };
      }

      const sanitizedPowerUps = (p.marketPowerUps || []).filter(
        pu => !pu.matchId || !lastTwoMatchIds.includes(pu.matchId.toString())
      );

      return {
        ...p,
        predictions: sanitizedPredictions,
        captainMatchId: sanitizedCaptainId,
        gamble: sanitizedGamble,
        marketPowerUps: sanitizedPowerUps
      };
    });

    res.json({ deadlinePassed: true, secondDeadlinePassed, predictions: processedPredictions });
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving predictions.', error: error.message });
  }
});

module.exports = router;
