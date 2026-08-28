/**
 * Automated Background Result & Score Poller for PredG
 * Automatically polls for completed Premier League matches, populates actual match results,
 * calculates player scores & battle outcomes, and updates group standings.
 */

const Matchweek = require('../models/Matchweek');
const Group = require('../models/Group');
const GroupStanding = require('../models/GroupStanding');
const Prediction = require('../models/Prediction');
const Battle = require('../models/Battle');
const User = require('../models/User');
const { fetchMatchResultStats } = require('./plMatchStatsFetcher');
const { scoreMatchweek } = require('./scoringEngine');
const { getPremierLeagueStandings } = require('./premierLeagueStandings');

const AVERAGE_PLAYER_ID = '600000000000000000000000';

async function generateBattlePairingsInternal(matchweek, group) {
  const standings = await GroupStanding.find({ groupId: group._id })
    .populate('userId', 'username email role')
    .sort({ totalPoints: -1 });

  const activeStandings = standings.filter(s => s.userId && s.userId._id.toString() !== AVERAGE_PLAYER_ID);
  if (activeStandings.length < 2) return;

  await Battle.deleteMany({ groupId: group._id, matchweekId: matchweek._id });

  const pairedStandings = [...activeStandings];
  if (pairedStandings.length % 2 !== 0) {
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
    pairedStandings.push({
      groupId: group._id,
      userId: averagePlayer,
      totalPoints: 0,
      battlePoints: 0,
      rank: 999
    });
  }

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
  }
}

async function finalizeMatchweekScoresInternal(matchweek, group) {
  let existingBattles = await Battle.find({ groupId: group._id, matchweekId: matchweek._id });
  if (existingBattles.length === 0) {
    await generateBattlePairingsInternal(matchweek, group);
  }

  const groupMembers = group.members.filter(id => id.toString() !== AVERAGE_PLAYER_ID);
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

  const predictions = await Prediction.find({ groupId: group._id, matchweekId: matchweek._id });
  const battleMatchups = await Battle.find({ groupId: group._id, matchweekId: matchweek._id });

  const { scoredPredictions, battleResults } = scoreMatchweek(matchweek, predictions, battleMatchups);

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

  for (const bRes of battleResults) {
    await Battle.findByIdAndUpdate(bRes.battleId, {
      player1Wins: bRes.player1Wins,
      player2Wins: bRes.player2Wins,
      player1Points: bRes.player1Points,
      player2Points: bRes.player2Points,
      outcome: bRes.outcome,
      details: bRes.details
    });

    if (bRes.player1Id.toString() !== AVERAGE_PLAYER_ID) {
      await Prediction.findOneAndUpdate(
        { groupId: group._id, userId: bRes.player1Id, matchweekId: matchweek._id },
        { battlePointsScored: bRes.player1Points }
      );
    }
    if (bRes.player2Id.toString() !== AVERAGE_PLAYER_ID) {
      await Prediction.findOneAndUpdate(
        { groupId: group._id, userId: bRes.player2Id, matchweekId: matchweek._id },
        { battlePointsScored: bRes.player2Points }
      );
    }
  }

  for (const score of scoredPredictions) {
    await Prediction.findOneAndUpdate(
      { groupId: group._id, userId: score.userId, matchweekId: matchweek._id },
      { totalPointsScored: score.totalMatchweekPoints }
    );
  }

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

  matchweek.status = 'completed';
  await matchweek.save();
}

/**
 * Main polling routine to check active matchweeks and fetch completed match results
 */
async function checkAndSyncActiveMatchweeks() {
  try {
    const activeMatchweeks = await Matchweek.find({ status: 'active' });
    if (activeMatchweeks.length === 0) return { syncCount: 0, completedMwCount: 0 };

    let syncCount = 0;
    let completedMwCount = 0;
    const now = new Date();

    for (const matchweek of activeMatchweeks) {
      const group = await Group.findById(matchweek.groupId);
      if (!group) continue;

      let mwModified = false;

      for (const match of matchweek.matches) {
        // Only fetch if actualResults are not yet populated and kickoff time has passed
        const hasResult = match.actualResults && match.actualResults.result !== null && match.actualResults.homeScore !== null;
        const isPastKickoff = match.kickoffTime && new Date(match.kickoffTime) <= now;

        if (!hasResult && isPastKickoff) {
          const dateIso = match.kickoffTime ? match.kickoffTime.toISOString().slice(0, 10) : '';
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
            mwModified = true;
            syncCount++;
            console.log(`[AutoSync] Saved match result for ${match.homeTeam} ${match.actualResults.homeScore}-${match.actualResults.awayScore} ${match.awayTeam}`);
          }
        }
      }

      if (mwModified) {
        await matchweek.save();
      }

      // Check if ALL matches in this matchweek have non-null actual results
      const allMatchesFinished = matchweek.matches.every(
        m => m.actualResults && m.actualResults.result !== null && m.actualResults.homeScore !== null
      );

      if (allMatchesFinished) {
        console.log(`[AutoSync] All matches finished for Matchweek #${matchweek.matchweekNumber} in group ${group.name}. Auto-scoring and finalizing...`);
        await finalizeMatchweekScoresInternal(matchweek, group);
        await getPremierLeagueStandings(true);
        completedMwCount++;
      }
    }

    return { syncCount, completedMwCount };
  } catch (err) {
    console.error('[AutoSync] Error during background match sync:', err.message);
    return { error: err.message };
  }
}

let syncIntervalTimer = null;

function startAutoResultSync(intervalMinutes = 5) {
  if (syncIntervalTimer) {
    clearInterval(syncIntervalTimer);
  }

  console.log(`[AutoSync] Started background match result sync worker (polling every ${intervalMinutes} minutes).`);
  
  // Initial check on startup
  checkAndSyncActiveMatchweeks();

  // Recurring check
  const intervalMs = intervalMinutes * 60 * 1000;
  syncIntervalTimer = setInterval(() => {
    checkAndSyncActiveMatchweeks();
  }, intervalMs);
}

module.exports = {
  checkAndSyncActiveMatchweeks,
  finalizeMatchweekScoresInternal,
  startAutoResultSync
};
