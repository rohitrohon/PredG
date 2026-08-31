const express = require('express');
const router = express.Router();
const Matchweek = require('../models/Matchweek');
const Prediction = require('../models/Prediction');
const User = require('../models/User');
const Group = require('../models/Group');
const GroupStanding = require('../models/GroupStanding');
const Battle = require('../models/Battle');
const { auth } = require('../middleware/auth');
const PLCache = require('../models/PLCache');
const { getPremierLeagueStandings } = require('../utils/premierLeagueStandings');
const { fetchPLMatchweekFixtures } = require('../utils/plFixturesFetcher');
const { fetchMatchResultStats } = require('../utils/plMatchStatsFetcher');

// Dummy ID for Average Player (in case of odd player count)
const AVERAGE_PLAYER_ID = '600000000000000000000000';

// @route   GET api/admin/pl-fixtures/:matchweekNumber
// @desc    Fetch scheduled Premier League fixtures for a matchweek with IST kickoff times
// @access  Private
router.get('/pl-fixtures/:matchweekNumber', auth, async (req, res) => {
  try {
    const fixtures = await fetchPLMatchweekFixtures(req.params.matchweekNumber);
    res.json({ matchweekNumber: req.params.matchweekNumber, count: fixtures.length, fixtures });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching PL fixtures.', error: error.message });
  }
});

// @route   GET api/admin/pl-match-stats
// @desc    Fetch official Premier League actual match result stats (scores, cards, shots, offsides, corners)
// @access  Private
router.get('/pl-match-stats', auth, async (req, res) => {
  try {
    const { homeTeam, awayTeam, date, eventId } = req.query;
    const stats = await fetchMatchResultStats(homeTeam, awayTeam, date, eventId);
    if (!stats) {
      return res.status(404).json({ message: 'Match result stats not found.' });
    }
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching PL match stats.', error: error.message });
  }
});

router.get('/pl-match-stats/:eventId', auth, async (req, res) => {
  try {
    const { homeTeam, awayTeam, date } = req.query;
    const stats = await fetchMatchResultStats(homeTeam, awayTeam, date, req.params.eventId);
    if (!stats) {
      return res.status(404).json({ message: 'Match result stats not found.' });
    }
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching PL match stats.', error: error.message });
  }
});

const { checkAndSyncActiveMatchweeks } = require('../utils/autoResultFetcher');

// @route   POST api/admin/auto-sync-now
// @desc    Manually trigger immediate background result sync and auto-scoring for all active matchweeks
// @access  Private
router.post('/auto-sync-now', auth, async (req, res) => {
  try {
    const result = await checkAndSyncActiveMatchweeks();
    res.json({ message: 'Auto-sync cycle executed successfully.', ...result });
  } catch (error) {
    res.status(500).json({ message: 'Error running auto-sync.', error: error.message });
  }
});

// @route   GET api/admin/pl-standings-db
// @desc    Get cached Premier League standings from database
// @access  Private
router.get('/pl-standings-db', auth, async (req, res) => {
  try {
    let record = await PLCache.findOne({ dataType: 'standings' });
    if (!record) {
      const standings = await getPremierLeagueStandings();
      record = await PLCache.findOneAndUpdate(
        { dataType: 'standings' },
        { dataType: 'standings', data: standings, lastRefreshedAt: new Date() },
        { upsert: true, new: true }
      );
    }
    res.json(record);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching PL standings from DB.', error: error.message });
  }
});

// @route   POST api/admin/pl-standings-db/refresh
// @desc    Trigger API call to refresh Premier League standings & update DB
// @access  Private
router.post('/pl-standings-db/refresh', auth, async (req, res) => {
  try {
    const standings = await getPremierLeagueStandings(true);
    const record = await PLCache.findOneAndUpdate(
      { dataType: 'standings' },
      { dataType: 'standings', data: standings, lastRefreshedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ message: 'Premier League standings updated in DB successfully!', record });
  } catch (error) {
    res.status(500).json({ message: 'Error refreshing PL standings API.', error: error.message });
  }
});

// @route   GET api/admin/pl-fixtures-db/:matchweekNumber
// @desc    Get cached PL fixtures for a matchweek from database
// @access  Private
router.get('/pl-fixtures-db/:matchweekNumber', auth, async (req, res) => {
  try {
    const mwNum = Number(req.params.matchweekNumber);
    let record = await PLCache.findOne({ dataType: 'fixtures', matchweekNumber: mwNum });
    if (!record) {
      const fixtures = await fetchPLMatchweekFixtures(mwNum);
      record = await PLCache.findOneAndUpdate(
        { dataType: 'fixtures', matchweekNumber: mwNum },
        { dataType: 'fixtures', matchweekNumber: mwNum, data: fixtures, lastRefreshedAt: new Date() },
        { upsert: true, new: true }
      );
    }
    res.json(record);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching PL fixtures from DB.', error: error.message });
  }
});

// @route   POST api/admin/pl-fixtures-db/refresh/:matchweekNumber
// @desc    Trigger API call to refresh PL fixtures for a matchweek & update DB
// @access  Private
router.post('/pl-fixtures-db/refresh/:matchweekNumber', auth, async (req, res) => {
  try {
    const mwNum = Number(req.params.matchweekNumber);
    const fixtures = await fetchPLMatchweekFixtures(mwNum);
    const record = await PLCache.findOneAndUpdate(
      { dataType: 'fixtures', matchweekNumber: mwNum },
      { dataType: 'fixtures', matchweekNumber: mwNum, data: fixtures, lastRefreshedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ message: `Matchweek #${mwNum} PL fixtures updated in DB successfully!`, record });
  } catch (error) {
    res.status(500).json({ message: 'Error refreshing PL fixtures API.', error: error.message });
  }
});

const isGroupAdmin = (group, userId, userRole) => {
  if (!group) return false;
  if (userRole === 'admin') return true;
  const adminIdStr = group.adminId?._id ? group.adminId._id.toString() : group.adminId?.toString();
  return adminIdStr === userId;
};

// Middleware to verify user is group admin of the matchweek
const verifyMwGroupAdmin = async (req, res, next) => {
  try {
    const matchweek = await Matchweek.findById(req.params.id);
    if (!matchweek) {
      return res.status(404).json({ message: 'Matchweek not found.' });
    }

    const group = await Group.findById(matchweek.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    if (!isGroupAdmin(group, req.user.id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Only group administrators can manage fixtures.' });
    }

    req.matchweek = matchweek;
    req.group = group;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Error checking permissions.', error: error.message });
  }
};

// @route   POST api/admin/matchweek/:id/fetch-results
// @desc    Fetch actual match results from official Premier League ESPN API for all matches in the matchweek
// @access  Private
router.post('/matchweek/:id/fetch-results', [auth, verifyMwGroupAdmin], async (req, res) => {
  const matchweek = req.matchweek;
  const { fetchMatchResultStats } = require('../utils/plMatchStatsFetcher');

  try {
    let updatedCount = 0;
    
    for (const match of matchweek.matches) {
      const dateIso = match.kickoffTime ? new Date(match.kickoffTime).toISOString().slice(0, 10) : '';
      const fetchedStats = await fetchMatchResultStats(match.homeTeam, match.awayTeam, dateIso);

      if (fetchedStats && fetchedStats.actualResults && fetchedStats.actualResults.homeScore !== null) {
        match.actualResults = {
          homeScore: fetchedStats.actualResults.homeScore,
          awayScore: fetchedStats.actualResults.awayScore,
          result: fetchedStats.actualResults.result,
          firstGoal: fetchedStats.actualResults.firstGoal,
          possession: fetchedStats.actualResults.possession,
          yellowCards: fetchedStats.actualResults.yellowCards,
          offsides: fetchedStats.actualResults.offsides,
          corners: fetchedStats.actualResults.corners,
          shots: fetchedStats.actualResults.shots,
          wildPredictionCorrectUsers: match.actualResults?.wildPredictionCorrectUsers || []
        };
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      await matchweek.save();
    }

    res.json({
      message: `Fetched and updated results for ${updatedCount} out of ${matchweek.matches.length} matches via Official Premier League API!`,
      matchweek,
      updatedCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching match results via API.', error: error.message });
  }
});

// @route   POST api/admin/matchweek/:id/reset-results
// @desc    Reset all match results and actualResults to null for a matchweek (Group Admin only)
// @access  Private
router.post('/matchweek/:id/reset-results', [auth, verifyMwGroupAdmin], async (req, res) => {
  const matchweek = req.matchweek;

  try {
    matchweek.matches.forEach((m) => {
      m.actualResults = {
        homeScore: null,
        awayScore: null,
        result: null,
        firstGoal: null,
        possession: null,
        yellowCards: null,
        offsides: null,
        corners: null,
        shots: null,
        wildPredictionCorrectUsers: []
      };
    });

    await matchweek.save();

    res.json({
      message: `All match results for Matchweek #${matchweek.matchweekNumber} have been reset to null.`,
      matchweek
    });
  } catch (error) {
    res.status(500).json({ message: 'Error resetting match results.', error: error.message });
  }
});

// @route   POST api/admin/matchweek/:id/results
// @desc    Enter actual match results for a matchweek (Group Admin only)
// @access  Private
router.post('/matchweek/:id/results', [auth, verifyMwGroupAdmin], async (req, res) => {
  const { matchesResults, wildPredictionDetails } = req.body;
  const matchweek = req.matchweek;

  try {
    // Update each match's actualResults
    matchweek.matches.forEach((m) => {
      const matchIdStr = m._id.toString();
      if (matchesResults && matchesResults[matchIdStr]) {
        const resObj = matchesResults[matchIdStr];
        m.actualResults = {
          homeScore: resObj.homeScore,
          awayScore: resObj.awayScore,
          result: resObj.result,
          firstGoal: resObj.firstGoal,
          possession: resObj.possession,
          yellowCards: resObj.yellowCards !== undefined ? resObj.yellowCards : null,
          offsides: resObj.offsides !== undefined ? resObj.offsides : null,
          corners: resObj.corners !== undefined ? resObj.corners : null,
          shots: resObj.shots !== undefined ? resObj.shots : null,
          wildPredictionCorrectUsers: resObj.wildPredictionCorrectUsers || []
        };
      }
    });

    if (wildPredictionDetails !== undefined) {
      matchweek.wildPredictionDetails = wildPredictionDetails;
    }

    await matchweek.save();
    res.json({ message: 'Results updated successfully.', matchweek });
  } catch (error) {
    res.status(500).json({ message: 'Server error updating results.', error: error.message });
  }
});

const { generateBattlePairingsInternal } = require('../utils/battlePairing');

// @route   POST api/admin/matchweek/:id/pair-battles
// @desc    Manually generate battle pairings for a matchweek (1st vs Nth, 2nd vs N-1th, triad in middle if odd)
// @access  Private
router.post('/matchweek/:id/pair-battles', [auth, verifyMwGroupAdmin], async (req, res) => {
  const matchweek = req.matchweek;
  const group = req.group;

  try {
    const battles = await generateBattlePairingsInternal(matchweek, group);

    res.json({
      message: `Generated ${battles.length} battle matchups/triads successfully.`,
      battles
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error generating pairings.', error: error.message });
  }
});

// @route   POST api/admin/matchweek/:id/calculate
// @desc    Apply Autofills, calculate scores, battle outcomes, and update group standings
// @access  Private
router.post('/matchweek/:id/calculate', [auth, verifyMwGroupAdmin], async (req, res) => {
  const matchweek = req.matchweek;
  const group = req.group;

  try {
    // Auto-generate battle pairings if not present
    let existingBattles = await Battle.find({ groupId: group._id, matchweekId: matchweek._id });
    if (existingBattles.length === 0) {
      await generateBattlePairingsInternal(matchweek, group);
    }

    // 2. Fetch all real players in the group
    const groupMembers = group.members.filter(id => id.toString() !== AVERAGE_PLAYER_ID);

    // 3. Process Autofills for group members who did not submit predictions
    const previousMatchweek = await Matchweek.findOne({ 
      groupId: group._id, 
      matchweekNumber: matchweek.matchweekNumber - 1 
    });
    
    for (const memberId of groupMembers) {
      let pred = await Prediction.findOne({ groupId: group._id, userId: memberId, matchweekId: matchweek._id });
      
      if (!pred || !pred.isSubmitted) {
        let prevPred = null;
        if (previousMatchweek) {
          prevPred = await Prediction.findOne({ groupId: group._id, userId: memberId, matchweekId: previousMatchweek._id });
        }

        const autofillPredictions = [];
        matchweek.matches.forEach((m) => {
          let prevMatchPred = null;
          if (prevPred) {
            const idx = matchweek.matches.indexOf(m);
            if (idx >= 0 && idx < prevPred.predictions.length) {
              prevMatchPred = prevPred.predictions[idx];
            }
          }

          autofillPredictions.push({
            matchId: m._id,
            result: prevMatchPred ? prevMatchPred.result : 'Home',
            homeScore: prevMatchPred ? prevMatchPred.homeScore : 1,
            awayScore: prevMatchPred ? prevMatchPred.awayScore : 0,
            safeBet: prevMatchPred ? prevMatchPred.safeBet : 'Home',
            firstGoal: prevMatchPred ? prevMatchPred.firstGoal : 'Home',
            possession: prevMatchPred ? prevMatchPred.possession : 'Home',
            wildPredictionCategory: prevMatchPred ? prevMatchPred.wildPredictionCategory : 'None',
            wildPredictionValue: prevMatchPred ? prevMatchPred.wildPredictionValue : 0,
            isAutofilled: true
          });
        });

        if (!pred) {
          pred = new Prediction({
            groupId: group._id,
            userId: memberId,
            matchweekId: matchweek._id,
            predictions: autofillPredictions,
            captainMatchId: matchweek.matches[0]._id,
            isSubmitted: true,
            isAutofilled: true
          });
        } else {
          pred.predictions = autofillPredictions;
          pred.captainMatchId = matchweek.matches[0]._id;
          pred.isSubmitted = true;
          pred.isAutofilled = true;
          pred.gamble = { active: false, points: 0, matchId: null };
          pred.marketPowerUps = [];
        }
        await pred.save();
      }
    }

    // Load all finalized predictions for this group and matchweek
    const predictions = await Prediction.find({ groupId: group._id, matchweekId: matchweek._id });

    // Load battles for this group and matchweek
    const battleMatchups = await Battle.find({ groupId: group._id, matchweekId: matchweek._id });

    // 4. Run scoring calculations
    const { scoredPredictions, battleResults } = scoreMatchweek(matchweek, predictions, battleMatchups);

    // If Average Player was in battles, calculate its average scores for the Battle Match
    let averagePlayerPrediction = null;
    const hasAveragePlayer = battleMatchups.some(
      b => b.player1Id.toString() === AVERAGE_PLAYER_ID || b.player2Id.toString() === AVERAGE_PLAYER_ID
    );

    if (hasAveragePlayer && matchweek.battleMatchId) {
      const bMatchIdStr = matchweek.battleMatchId.toString();
      
      const realScores = scoredPredictions.map(sp => {
        const mResult = sp.matchResults.find(m => m.matchId.toString() === bMatchIdStr);
        return mResult ? mResult.points : null;
      }).filter(Boolean);

      const avgPoints = { result: 0, scoreline: 0, firstGoal: 0, possession: 0 };

      if (realScores.length > 0) {
        realScores.forEach(s => {
          avgPoints.result += s.result;
          avgPoints.scoreline += s.scoreline;
          avgPoints.firstGoal += s.firstGoal;
          avgPoints.possession += s.possession;
        });
        avgPoints.result /= realScores.length;
        avgPoints.scoreline /= realScores.length;
        avgPoints.firstGoal /= realScores.length;
        avgPoints.possession /= realScores.length;
      }

      const getUserIdStr = (idObj) => idObj ? (idObj._id ? idObj._id : idObj).toString() : '';

      for (const res of battleResults) {
        const p1IdStr = getUserIdStr(res.player1Id);
        const p2IdStr = getUserIdStr(res.player2Id);

        if (p1IdStr === AVERAGE_PLAYER_ID || p2IdStr === AVERAGE_PLAYER_ID) {
          const isP1Average = p1IdStr === AVERAGE_PLAYER_ID;
          let realPlayerWins = 0;
          let averagePlayerWins = 0;

          res.details.forEach((det) => {
            const realPlayerPts = isP1Average ? det.player2Pts : det.player1Pts;
            const avgPts = avgPoints[det.category];

            det[isP1Average ? 'player1Val' : 'player2Val'] = 'Average';
            det[isP1Average ? 'player1Pts' : 'player2Pts'] = avgPts;

            if (realPlayerPts > avgPts) {
              det.winner = isP1Average ? 'Player2' : 'Player1';
              realPlayerWins++;
            } else if (avgPts > realPlayerPts) {
              det.winner = isP1Average ? 'Player1' : 'Player2';
              averagePlayerWins++;
            } else {
              det.winner = 'Draw';
            }
          });

          res.player1Wins = isP1Average ? averagePlayerWins : realPlayerWins;
          res.player2Wins = isP1Average ? realPlayerWins : averagePlayerWins;

          if (realPlayerWins > averagePlayerWins) {
            res.outcome = isP1Average ? 'Player2' : 'Player1';
            res[isP1Average ? 'player2Points' : 'player1Points'] = (realPlayerWins >= 4) ? 5 : 3;
            res[isP1Average ? 'player1Points' : 'player2Points'] = 0;
          } else if (averagePlayerWins > realPlayerWins) {
            res.outcome = isP1Average ? 'Player1' : 'Player2';
            res[isP1Average ? 'player1Points' : 'player2Points'] = (averagePlayerWins >= 4) ? 5 : 3;
            res[isP1Average ? 'player2Points' : 'player1Points'] = 0;
          } else {
            res.outcome = 'Draw';
            res.player1Points = 1;
            res.player2Points = 1;
          }
        }
      }
    }

    // 5. Save Battle results & update User Group standings
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

      // Update Predictions with battle points scored
      const p1IdStr = getUserIdStr(bRes.player1Id);
      const p2IdStr = getUserIdStr(bRes.player2Id);
      const p3IdStr = getUserIdStr(bRes.player3Id);

      if (p1IdStr && p1IdStr !== AVERAGE_PLAYER_ID) {
        await Prediction.findOneAndUpdate(
          { groupId: group._id, userId: p1IdStr, matchweekId: matchweek._id },
          { battlePointsScored: bRes.player1Points }
        );
      }
      if (p2IdStr && p2IdStr !== AVERAGE_PLAYER_ID) {
        await Prediction.findOneAndUpdate(
          { groupId: group._id, userId: p2IdStr, matchweekId: matchweek._id },
          { battlePointsScored: bRes.player2Points }
        );
      }
      if (bRes.isTriad && p3IdStr && p3IdStr !== AVERAGE_PLAYER_ID) {
        await Prediction.findOneAndUpdate(
          { groupId: group._id, userId: p3IdStr, matchweekId: matchweek._id },
          { battlePointsScored: bRes.player3Points }
        );
      }
    }

    // Update Predictions with total weekly points scored
    for (const score of scoredPredictions) {
      const scoreUserIdStr = getUserIdStr(score.userId);
      await Prediction.findOneAndUpdate(
        { groupId: group._id, userId: scoreUserIdStr, matchweekId: matchweek._id },
        { totalPointsScored: score.totalMatchweekPoints }
      );
    }

    // 6. Recalculate GroupStandings (exact sum of all matchweeks) and ranks within the group
    const allStandings = await GroupStanding.find({ groupId: group._id });
    for (const std of allStandings) {
      const uIdStr = std.userId.toString();
      if (uIdStr === AVERAGE_PLAYER_ID) continue;

      const userPreds = await Prediction.find({ groupId: group._id, userId: uIdStr });
      const sumTotal = userPreds.reduce((sum, p) => sum + (p.totalPointsScored || 0), 0);
      const sumBattle = userPreds.reduce((sum, p) => sum + (p.battlePointsScored || 0), 0);

      std.totalPoints = sumTotal;
      std.battlePoints = sumBattle;
      await std.save();
    }

    const updatedStandings = await GroupStanding.find({ 
      groupId: group._id, 
      userId: { $ne: AVERAGE_PLAYER_ID } 
    }).sort({ totalPoints: -1 });

    for (let index = 0; index < updatedStandings.length; index++) {
      const standing = updatedStandings[index];
      standing.rank = index + 1;
      await standing.save();
    }

    // Mark matchweek as completed
    matchweek.status = 'completed';
    await matchweek.save();

    res.json({
      message: 'Points calculations and battles finalized successfully for the group.',
      matchweek,
      scoredPredictions,
      battleResults
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during score calculation.', error: error.message });
  }
});

// @route   GET api/admin/matchweek/:id/predictions
// @desc    Get all user predictions for a matchweek (Group Admin only)
// @access  Private
router.get('/matchweek/:id/predictions', [auth, verifyMwGroupAdmin], async (req, res) => {
  try {
    const predictions = await Prediction.find({ 
      groupId: req.group._id, 
      matchweekId: req.matchweek._id 
    }).populate('userId', 'username name email role');
    
    res.json(predictions);
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving matchweek predictions.', error: error.message });
  }
});

// @route   PUT api/admin/prediction/:id
// @desc    Edit a user's prediction choices, chips, and power-ups after deadline (Group Admin only)
// @access  Private
router.put('/prediction/:id', auth, async (req, res) => {
  const { predictions, captainMatchId, gamble, marketPowerUps, isSubmitted } = req.body;

  try {
    const predDoc = await Prediction.findById(req.params.id);
    if (!predDoc) {
      return res.status(404).json({ message: 'Prediction record not found.' });
    }

    const group = await Group.findById(predDoc.groupId);
    if (!group || !isGroupAdmin(group, req.user.id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Only group administrators can edit predictions.' });
    }

    if (predictions !== undefined) predDoc.predictions = predictions;
    if (captainMatchId !== undefined) predDoc.captainMatchId = captainMatchId;
    if (gamble !== undefined) predDoc.gamble = gamble;
    if (marketPowerUps !== undefined) predDoc.marketPowerUps = marketPowerUps;
    if (isSubmitted !== undefined) predDoc.isSubmitted = isSubmitted;

    await predDoc.save();
    res.json({ message: 'User prediction updated successfully.', prediction: predDoc });
  } catch (error) {
    res.status(500).json({ message: 'Server error updating prediction.', error: error.message });
  }
});

// @route   PUT api/admin/prediction/:id/override-scores
// @desc    Manually override prediction points & battle points for a player (Group Admin only)
// @access  Private
router.put('/prediction/:id/override-scores', auth, async (req, res) => {
  const { totalPointsScored, battlePointsScored } = req.body;

  try {
    const predDoc = await Prediction.findById(req.params.id);
    if (!predDoc) {
      return res.status(404).json({ message: 'Prediction record not found.' });
    }

    const group = await Group.findById(predDoc.groupId);
    if (!group || !isGroupAdmin(group, req.user.id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Only group administrators can override scores.' });
    }

    const prevTotal = predDoc.totalPointsScored || 0;
    const prevBattle = predDoc.battlePointsScored || 0;

    const newTotal = totalPointsScored !== undefined ? Number(totalPointsScored) : prevTotal;
    const newBattle = battlePointsScored !== undefined ? Number(battlePointsScored) : prevBattle;

    const diffTotal = newTotal - prevTotal;
    const diffBattle = newBattle - prevBattle;

    predDoc.totalPointsScored = newTotal;
    predDoc.battlePointsScored = newBattle;
    await predDoc.save();

    // Recalculate exact totalPoints and battlePoints for user's group standings from all predictions
    const userPreds = await Prediction.find({ groupId: group._id, userId: predDoc.userId });
    const sumTotal = userPreds.reduce((sum, p) => sum + (p.totalPointsScored || 0), 0);
    const sumBattle = userPreds.reduce((sum, p) => sum + (p.battlePointsScored || 0), 0);

    await GroupStanding.findOneAndUpdate(
      { groupId: group._id, userId: predDoc.userId },
      { totalPoints: sumTotal, battlePoints: sumBattle }
    );

    // Recalculate group ranks
    const updatedStandings = await GroupStanding.find({ 
      groupId: group._id, 
      userId: { $ne: AVERAGE_PLAYER_ID } 
    }).sort({ totalPoints: -1 });

    for (let index = 0; index < updatedStandings.length; index++) {
      const standing = updatedStandings[index];
      standing.rank = index + 1;
      await standing.save();
    }

    res.json({ message: 'Points overridden successfully.', prediction: predDoc });
  } catch (error) {
    res.status(500).json({ message: 'Server error overriding points.', error: error.message });
  }
});

// @route   PUT api/admin/battle/:id/override
// @desc    Manually override battle scores and winner outcomes (Group Admin only)
// @access  Private
router.put('/battle/:id/override', auth, async (req, res) => {
  const { player1Wins, player2Wins, player1Points, player2Points, outcome, details } = req.body;

  try {
    const battle = await Battle.findById(req.params.id);
    if (!battle) {
      return res.status(404).json({ message: 'Battle not found.' });
    }

    const group = await Group.findById(battle.groupId);
    if (!group || !isGroupAdmin(group, req.user.id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Only group administrators can override battles.' });
    }

    const prevP1Pts = battle.player1Points || 0;
    const prevP2Pts = battle.player2Points || 0;

    if (player1Wins !== undefined) battle.player1Wins = player1Wins;
    if (player2Wins !== undefined) battle.player2Wins = player2Wins;
    if (player1Points !== undefined) battle.player1Points = player1Points;
    if (player2Points !== undefined) battle.player2Points = player2Points;
    if (outcome !== undefined) battle.outcome = outcome;
    if (details !== undefined) battle.details = details;

    await battle.save();

    // Adjust group standings battle points by difference if not Average Player
    if (battle.player1Id.toString() !== AVERAGE_PLAYER_ID && player1Points !== undefined) {
      const diff1 = battle.player1Points - prevP1Pts;
      await GroupStanding.findOneAndUpdate(
        { groupId: group._id, userId: battle.player1Id },
        { $inc: { battlePoints: diff1 } }
      );
    }
    if (battle.player2Id.toString() !== AVERAGE_PLAYER_ID && player2Points !== undefined) {
      const diff2 = battle.player2Points - prevP2Pts;
      await GroupStanding.findOneAndUpdate(
        { groupId: group._id, userId: battle.player2Id },
        { $inc: { battlePoints: diff2 } }
      );
    }

    res.json({ message: 'Battle record overridden successfully.', battle });
  } catch (error) {
    res.status(500).json({ message: 'Server error overriding battle.', error: error.message });
  }
});

module.exports = router;
