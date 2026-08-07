const express = require('express');
const router = express.Router();
const Matchweek = require('../models/Matchweek');
const Prediction = require('../models/Prediction');
const User = require('../models/User');
const Group = require('../models/Group');
const GroupStanding = require('../models/GroupStanding');
const Battle = require('../models/Battle');
const { auth } = require('../middleware/auth');
const { scoreMatchweek } = require('../utils/scoringEngine');

// Dummy ID for Average Player (in case of odd player count)
const AVERAGE_PLAYER_ID = '600000000000000000000000';

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

    if (group.adminId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. Only group administrators can manage fixtures.' });
    }

    req.matchweek = matchweek;
    req.group = group;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Error checking permissions.', error: error.message });
  }
};

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

// @route   POST api/admin/matchweek/:id/pair-battles
// @desc    Generate battle pairings for a matchweek based on group standings
// @access  Private
router.post('/matchweek/:id/pair-battles', [auth, verifyMwGroupAdmin], async (req, res) => {
  const matchweek = req.matchweek;
  const group = req.group;

  try {
    // Fetch players' standings in the group, sorted by totalPoints desc
    const standings = await GroupStanding.find({ groupId: group._id })
      .populate('userId', 'username email role')
      .sort({ totalPoints: -1 });

    // Exclude Average Player standing if it somehow got in
    const activeStandings = standings.filter(s => s.userId._id.toString() !== AVERAGE_PLAYER_ID);

    if (activeStandings.length < 2) {
      return res.status(400).json({ message: 'Need at least 2 players in the group to generate pairings.' });
    }

    // Delete existing pairings for this matchweek first to avoid duplicates
    await Battle.deleteMany({ groupId: group._id, matchweekId: matchweek._id });

    // Pairings logic: 1 vs N, 2 vs N-1, etc.
    const pairedStandings = [...activeStandings];
    let oddPlayerBye = false;

    // Check if odd number of players
    if (pairedStandings.length % 2 !== 0) {
      oddPlayerBye = true;
      // We will create/assert a dummy Average Player in the DB
      let averagePlayer = await User.findById(AVERAGE_PLAYER_ID);
      if (!averagePlayer) {
        averagePlayer = new User({
          _id: AVERAGE_PLAYER_ID,
          username: 'Average Player',
          email: 'average.player@predg.com',
          password: 'dummy_hash_not_usable',
          role: 'player'
        });
        await averagePlayer.save();
      }

      // Add temporary mock standing to complete the pairing list
      pairedStandings.push({
        groupId: group._id,
        userId: averagePlayer,
        totalPoints: 0,
        battlePoints: 0,
        rank: 999
      });
    }

    const battles = [];
    const n = pairedStandings.length;
    for (let i = 0; i < Math.floor(n / 2); i++) {
      const p1 = pairedStandings[i].userId;
      const p2 = pairedStandings[n - 1 - i].userId;

      const battle = new Battle({
        groupId: group._id,
        matchweekId: matchweek._id,
        player1Id: p1._id,
        player2Id: p2._id
      });
      await battle.save();
      battles.push(battle);
    }

    res.json({
      message: `Paired ${battles.length} battles. ${oddPlayerBye ? 'Odd number of players, paired the odd player with Average Player.' : ''}`,
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
    // 1. Verify that results have been entered for all matches
    const incompleteMatch = matchweek.matches.find(m => m.actualResults.result === null);
    if (incompleteMatch) {
      return res.status(400).json({ message: 'Cannot calculate points. Some matches do not have actual results entered yet.' });
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
            wildPredictionValue: prevMatchPred ? prevMatchPred.wildPredictionValue : 0
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

      for (const res of battleResults) {
        const p1IdStr = res.player1Id.toString();
        const p2IdStr = res.player2Id.toString();

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
            res[isP1Average ? 'player2Points' : 'player1Points'] = (realPlayerWins === 4) ? 5 : 3;
            res[isP1Average ? 'player1Points' : 'player2Points'] = 0;
          } else if (averagePlayerWins > realPlayerWins) {
            res.outcome = isP1Average ? 'Player1' : 'Player2';
            res[isP1Average ? 'player1Points' : 'player2Points'] = (averagePlayerWins === 4) ? 5 : 3;
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
      await Battle.findByIdAndUpdate(bRes.battleId, {
        player1Wins: bRes.player1Wins,
        player2Wins: bRes.player2Wins,
        player1Points: bRes.player1Points,
        player2Points: bRes.player2Points,
        outcome: bRes.outcome,
        details: bRes.details
      });

      // Award battle points to players' Group standings & update Predictions
      if (bRes.player1Id.toString() !== AVERAGE_PLAYER_ID) {
        await GroupStanding.findOneAndUpdate(
          { groupId: group._id, userId: bRes.player1Id }, 
          { $inc: { battlePoints: bRes.player1Points } }
        );
        await Prediction.findOneAndUpdate(
          { groupId: group._id, userId: bRes.player1Id, matchweekId: matchweek._id },
          { battlePointsScored: bRes.player1Points }
        );
      }
      if (bRes.player2Id.toString() !== AVERAGE_PLAYER_ID) {
        await GroupStanding.findOneAndUpdate(
          { groupId: group._id, userId: bRes.player2Id }, 
          { $inc: { battlePoints: bRes.player2Points } }
        );
        await Prediction.findOneAndUpdate(
          { groupId: group._id, userId: bRes.player2Id, matchweekId: matchweek._id },
          { battlePointsScored: bRes.player2Points }
        );
      }
    }

    // Update real players' total points in Group standings & update Predictions
    for (const score of scoredPredictions) {
      await GroupStanding.findOneAndUpdate(
        { groupId: group._id, userId: score.userId },
        { $inc: { totalPoints: score.totalMatchweekPoints } }
      );
      await Prediction.findOneAndUpdate(
        { groupId: group._id, userId: score.userId, matchweekId: matchweek._id },
        { totalPointsScored: score.totalMatchweekPoints }
      );
    }

    // 6. Recalculate standings and ranks within the group
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

module.exports = router;
