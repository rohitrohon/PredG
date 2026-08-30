const mongoose = require('mongoose');
const Matchweek = require('../models/Matchweek');
const Prediction = require('../models/Prediction');
const { getTeamPLRank } = require('./premierLeagueStandings');

/**
 * Calculates higher ranked team between homeTeam and awayTeam using real Premier League standings,
 * falling back to prior completed matchweeks in the group if PL rank is unavailable.
 */
async function getHigherRankedTeamChoice(groupId, currentMwNumber, homeTeam, awayTeam) {
  try {
    // 1. Try Real Premier League Standings first (Free API call)
    const homePLRank = await getTeamPLRank(homeTeam);
    const awayPLRank = await getTeamPLRank(awayTeam);

    if (homePLRank !== 99 || awayPLRank !== 99) {
      if (homePLRank < awayPLRank) return 'Home';
      if (awayPLRank < homePLRank) return 'Away';
    }

    // 2. Fallback to Group's prior completed matches points table
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return 'Home';
    }

    const priorCompletedMws = await Matchweek.find({
      groupId,
      matchweekNumber: { $lt: currentMwNumber },
      status: 'completed'
    });

    const teamStats = {};
    const initTeam = (t) => {
      if (!t) return;
      if (!teamStats[t]) teamStats[t] = { points: 0, gd: 0, goalsFor: 0 };
    };

    initTeam(homeTeam);
    initTeam(awayTeam);

    priorCompletedMws.forEach(mw => {
      mw.matches.forEach(m => {
        if (m.actualResults && m.actualResults.homeScore !== null && m.actualResults.awayScore !== null) {
          const h = Number(m.actualResults.homeScore);
          const a = Number(m.actualResults.awayScore);
          initTeam(m.homeTeam);
          initTeam(m.awayTeam);

          teamStats[m.homeTeam].goalsFor += h;
          teamStats[m.awayTeam].goalsFor += a;
          teamStats[m.homeTeam].gd += (h - a);
          teamStats[m.awayTeam].gd += (a - h);

          if (h > a) {
            teamStats[m.homeTeam].points += 3;
          } else if (a > h) {
            teamStats[m.awayTeam].points += 3;
          } else {
            teamStats[m.homeTeam].points += 1;
            teamStats[m.awayTeam].points += 1;
          }
        }
      });
    });

    const hStats = teamStats[homeTeam] || { points: 0, gd: 0, goalsFor: 0 };
    const aStats = teamStats[awayTeam] || { points: 0, gd: 0, goalsFor: 0 };

    if (hStats.points > aStats.points) return 'Home';
    if (aStats.points > hStats.points) return 'Away';
    if (hStats.gd > aStats.gd) return 'Home';
    if (aStats.gd > hStats.gd) return 'Away';
    if (hStats.goalsFor > aStats.goalsFor) return 'Home';
    if (aStats.goalsFor > hStats.goalsFor) return 'Away';

    return 'Home'; // Default if tied or no prior data
  } catch (err) {
    console.error('Error calculating team rank:', err);
    return 'Home';
  }
}

/**
 * Generates intelligent default prediction for a user who missed Deadline 1.
 */
async function generateIntelligentDefaultPrediction(groupId, matchweek, userId) {
  const predictions = [];

  for (let i = 0; i < matchweek.matches.length; i++) {
    const match = matchweek.matches[i];
    const higherTeamChoice = await getHigherRankedTeamChoice(groupId, matchweek.matchweekNumber, match.homeTeam, match.awayTeam);

    const isHomeHigher = higherTeamChoice === 'Home';

    predictions.push({
      matchId: match._id,
      result: isHomeHigher ? 'Home' : 'Away',
      homeScore: isHomeHigher ? 3 : 0,
      awayScore: isHomeHigher ? 0 : 3,
      safeBet: 'Home',
      firstGoal: isHomeHigher ? 'Home' : 'Away',
      possession: isHomeHigher ? 'Home' : 'Away',
      wildPredictionCategory: 'None',
      wildPredictionValue: 0,
      isAutofilled: true
    });
  }

  // Assign Captain to 5th game (index 4) if available, else last game
  const captainMatchId = matchweek.matches[4] ? matchweek.matches[4]._id : (matchweek.matches[matchweek.matches.length - 1]?._id || null);

  return {
    groupId,
    userId,
    matchweekId: matchweek._id,
    isSubmitted: true,
    isAutofilled: true,
    predictions,
    captainMatchId,
    gamble: { active: false, points: 0, matchId: null },
    marketPowerUps: []
  };
}

module.exports = {
  getHigherRankedTeamChoice,
  generateIntelligentDefaultPrediction
};

