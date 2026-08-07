/**
 * Scoring Engine for Prediction Game 3.0
 */

/**
 * Calculates the distribution of predictions for a given match and its categories.
 * @param {Array} predictionsList - Array of prediction documents for the matchweek.
 * @returns {Object} Distribution mapping: matchId -> category -> option -> count
 */
function calculateDistribution(predictionsList) {
  const distribution = {};

  predictionsList.forEach((predDoc) => {
    // Only calculate for submitted predictions
    if (!predDoc.isSubmitted) return;

    predDoc.predictions.forEach((singlePred) => {
      const mId = singlePred.matchId.toString();
      if (!distribution[mId]) {
        distribution[mId] = {
          result: { Home: 0, Away: 0, Draw: 0 },
          firstGoal: { Home: 0, Away: 0, 'No goal': 0 },
          possession: { Home: 0, Away: 0, Equal: 0 }
        };
      }

      // Increment counts
      if (singlePred.result in distribution[mId].result) {
        distribution[mId].result[singlePred.result]++;
      }
      if (singlePred.firstGoal in distribution[mId].firstGoal) {
        distribution[mId].firstGoal[singlePred.firstGoal]++;
      }
      if (singlePred.possession in distribution[mId].possession) {
        distribution[mId].possession[singlePred.possession]++;
      }
    });
  });

  return distribution;
}

/**
 * Calculates points for core general categories (Result, 1st Goal, Possession)
 */
function getGeneralCategoryPoints(userChoice, correctChoice, categoryDistribution, totalPlayers) {
  if (userChoice !== correctChoice) {
    return 0;
  }

  // Count of people who predicted the correct outcome
  const nCorrect = categoryDistribution[correctChoice] || 0;
  
  // Maximum count among all options in this category
  const counts = Object.values(categoryDistribution);
  const nMax = Math.max(...counts);

  if (nCorrect === 1) {
    return 100; // Unique
  }
  if (nCorrect === totalPlayers) {
    return 10; // Same
  }
  if (nCorrect === nMax) {
    return 20; // Majority
  }
  if (nCorrect < nMax && nCorrect > 1) {
    return 50; // Minority
  }

  return 0; // Fallback
}

/**
 * Calculates points for Scoreline category
 */
function getScorelinePoints(predHome, predAway, predSafeBet, actHome, actAway) {
  // Exactly Correct
  if (predHome === actHome && predAway === actAway) {
    return 100;
  }

  // Safe Bet Correct: Only the team designated as Safe Bet should score the exact number of goals predicted
  if (predSafeBet === 'Home' && predHome === actHome) {
    return 50;
  }
  if (predSafeBet === 'Away' && predAway === actAway) {
    return 50;
  }

  // Away Goal Correct
  if (predAway === actAway) {
    return 20;
  }

  // Home Goal Correct
  if (predHome === actHome) {
    return 10;
  }

  return 0;
}

/**
 * Scores a single user's predictions for a matchweek.
 */
function scoreUserPrediction(predictionDoc, matchweekDoc, distribution, totalPlayers) {
  const matchResults = [];
  let totalMatchweekPoints = 0;
  let gambleNetPoints = 0;
  let gambleOutcome = 'none';

  // Create lookup for actual match results
  const matchesMap = {};
  matchweekDoc.matches.forEach((m) => {
    matchesMap[m._id.toString()] = m;
  });

  // Calculate points for each match prediction
  predictionDoc.predictions.forEach((singlePred) => {
    const matchIdStr = singlePred.matchId.toString();
    const match = matchesMap[matchIdStr];

    if (!match || match.actualResults.result === null) {
      // Results not entered yet
      return;
    }

    const act = match.actualResults;
    const dist = distribution[matchIdStr] || {
      result: { Home: 0, Away: 0, Draw: 0 },
      firstGoal: { Home: 0, Away: 0, 'No goal': 0 },
      possession: { Home: 0, Away: 0, Equal: 0 }
    };

    // Calculate core categories points
    const ptsResult = getGeneralCategoryPoints(singlePred.result, act.result, dist.result, totalPlayers);
    const ptsFirstGoal = getGeneralCategoryPoints(singlePred.firstGoal, act.firstGoal, dist.firstGoal, totalPlayers);
    const ptsPossession = getGeneralCategoryPoints(singlePred.possession, act.possession, dist.possession, totalPlayers);
    
    // Scoreline points
    const ptsScoreline = getScorelinePoints(singlePred.homeScore, singlePred.awayScore, singlePred.safeBet, act.homeScore, act.awayScore);

    // Wild Prediction points: Automatically evaluate player's chosen stat category & value against actual match stats
    let isWildCorrect = false;
    if (singlePred.wildPredictionCategory && singlePred.wildPredictionCategory !== 'None') {
      const cat = singlePred.wildPredictionCategory;
      const val = Number(singlePred.wildPredictionValue);
      if (cat === 'Yellow Cards' && act.yellowCards !== null && val === Number(act.yellowCards)) isWildCorrect = true;
      if (cat === 'Offsides' && act.offsides !== null && val === Number(act.offsides)) isWildCorrect = true;
      if (cat === 'Corners' && act.corners !== null && val === Number(act.corners)) isWildCorrect = true;
      if (cat === 'Total Shots' && act.shots !== null && val === Number(act.shots)) isWildCorrect = true;
    }
    if (!isWildCorrect && act.wildPredictionCorrectUsers && act.wildPredictionCorrectUsers.some(
      (userId) => userId.toString() === predictionDoc.userId.toString()
    )) {
      isWildCorrect = true;
    }
    const ptsWild = isWildCorrect ? 100 : 0; // Wild is 100 points if correct, else 0

    // Count correct core categories (points scored > 0) out of 5 categories (Result, Scoreline, 1st Goal, Possession, and Wild Card)
    let correctCategoriesCount = 0;
    if (ptsResult > 0) correctCategoriesCount++;
    if (ptsScoreline > 0) correctCategoriesCount++;
    if (ptsFirstGoal > 0) correctCategoriesCount++;
    if (ptsPossession > 0) correctCategoriesCount++;
    if (ptsWild > 0) correctCategoriesCount++;

    // Bonus (+50 points if any 4 of the 5 categories have > 0 points)
    const gotBonus = correctCategoriesCount >= 4;
    const bonusPoints = gotBonus ? 50 : 0;

    // Process Gamble on this specific match if active
    let matchGamblePoints = 0;
    const isGambleMatch = predictionDoc.gamble && predictionDoc.gamble.active && predictionDoc.gamble.matchId && predictionDoc.gamble.matchId.toString() === matchIdStr;

    if (isGambleMatch) {
      const gamblePointsVal = predictionDoc.gamble.points || 0;
      // Check for Shield power-up on the gamble match
      const hasShield = predictionDoc.marketPowerUps.some(
        (pu) => pu.matchId.toString() === matchIdStr && pu.type === 'Shield'
      );

      if (correctCategoriesCount >= 4) {
        matchGamblePoints = gamblePointsVal;
        gambleOutcome = 'double';
        gambleNetPoints = gamblePointsVal;
      } else if (correctCategoriesCount === 3) {
        matchGamblePoints = 0;
        gambleOutcome = 'retained';
        gambleNetPoints = 0;
      } else {
        if (hasShield) {
          matchGamblePoints = 0;
          gambleOutcome = 'shielded';
          gambleNetPoints = 0;
        } else {
          matchGamblePoints = -gamblePointsVal;
          gambleOutcome = 'deducted';
          gambleNetPoints = -gamblePointsVal;
        }
      }
    }

    // Multipliers (applied to Categories + Bonus + Gamble)
    const isCaptain = predictionDoc.captainMatchId && predictionDoc.captainMatchId.toString() === matchIdStr;
    const hasDouble = predictionDoc.marketPowerUps.some(pu => pu.matchId.toString() === matchIdStr && pu.type === 'Double');
    const hasTriple = predictionDoc.marketPowerUps.some(pu => pu.matchId.toString() === matchIdStr && pu.type === 'Triple');

    const captainMult = isCaptain ? 2 : 1;
    const doubleMult = hasDouble ? 2 : 1;
    const tripleMult = hasTriple ? 3 : 1;
    const totalMultiplier = captainMult * doubleMult * tripleMult;

    // Match Points = (Points from all 5 Categories + Bonus + Gamble Points) * Captain * Double * Triple
    const categoriesSum = ptsResult + ptsScoreline + ptsFirstGoal + ptsPossession + ptsWild;
    const totalMatchPoints = (categoriesSum + bonusPoints + matchGamblePoints) * totalMultiplier;

    matchResults.push({
      matchId: singlePred.matchId,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      points: {
        result: ptsResult,
        scoreline: ptsScoreline,
        firstGoal: ptsFirstGoal,
        possession: ptsPossession,
        wild: ptsWild,
        bonus: bonusPoints,
        baseCore: categoriesSum,
        gamble: matchGamblePoints,
        total: totalMatchPoints
      },
      multiplier: totalMultiplier,
      correctCategoriesCount
    });

    totalMatchweekPoints += totalMatchPoints;
  });

  return {
    userId: predictionDoc.userId,
    matchResults,
    gamble: {
      active: predictionDoc.gamble ? predictionDoc.gamble.active : false,
      points: predictionDoc.gamble ? predictionDoc.gamble.points : 0,
      matchId: predictionDoc.gamble ? predictionDoc.gamble.matchId : null,
      outcome: gambleOutcome,
      netPoints: gambleNetPoints
    },
    totalMatchweekPoints
  };
}

/**
 * Score all predictions for a matchweek and determine battles
 * @param {Object} matchweekDoc - Matchweek document populated with matches
 * @param {Array} predictionsList - Array of prediction documents
 * @param {Array} battleMatchups - Array of battle matchup documents
 */
function scoreMatchweek(matchweekDoc, predictionsList, battleMatchups) {
  // 1. Calculate prediction counts across all players for groups sizing
  const distribution = calculateDistribution(predictionsList);
  
  // Total players who submitted predictions
  const submittedPredictions = predictionsList.filter(p => p.isSubmitted);
  const totalPlayers = submittedPredictions.length;

  // 2. Score each prediction doc
  const playerScoresMap = {};
  const scoredPredictions = predictionsList.map((pred) => {
    const scored = scoreUserPrediction(pred, matchweekDoc, distribution, totalPlayers);
    playerScoresMap[pred.userId.toString()] = scored;
    return scored;
  });

  // 3. Process battles (Matchweek 2 onwards)
  const battleResults = [];
  if (matchweekDoc.battleMatchId && battleMatchups && battleMatchups.length > 0) {
    const battleMatchIdStr = matchweekDoc.battleMatchId.toString();

    battleMatchups.forEach((matchup) => {
      const p1IdStr = matchup.player1Id.toString();
      const p2IdStr = matchup.player2Id.toString();

      const p1ScoreDoc = playerScoresMap[p1IdStr];
      const p2ScoreDoc = playerScoresMap[p2IdStr];

      // Default details
      const categories = ['result', 'scoreline', 'firstGoal', 'possession'];
      const details = [];
      let p1Wins = 0;
      let p2Wins = 0;

      // Find match predictions for p1 and p2
      const p1MatchPred = p1ScoreDoc ? p1ScoreDoc.matchResults.find(m => m.matchId.toString() === battleMatchIdStr) : null;
      const p2MatchPred = p2ScoreDoc ? p2ScoreDoc.matchResults.find(m => m.matchId.toString() === battleMatchIdStr) : null;

      categories.forEach((cat) => {
        const p1Pts = p1MatchPred ? p1MatchPred.points[cat] : 0;
        const p2Pts = p2MatchPred ? p2MatchPred.points[cat] : 0;

        let catWinner = 'Draw';
        if (p1Pts > p2Pts) {
          catWinner = 'Player1';
          p1Wins++;
        } else if (p2Pts > p1Pts) {
          catWinner = 'Player2';
          p2Wins++;
        }

        // Locate original prediction values
        let p1Val = null;
        let p2Val = null;

        if (p1ScoreDoc) {
          const originalPred = predictionsList.find(p => p.userId.toString() === p1IdStr)
            .predictions.find(m => m.matchId.toString() === battleMatchIdStr);
          p1Val = originalPred ? originalPred[cat === 'scoreline' ? 'homeScore' : cat] : null;
          // scoreline needs format
          if (cat === 'scoreline' && originalPred) {
            p1Val = `${originalPred.homeScore}-${originalPred.awayScore} (${originalPred.safeBet})`;
          }
        }
        if (p2ScoreDoc) {
          const originalPred = predictionsList.find(p => p.userId.toString() === p2IdStr)
            .predictions.find(m => m.matchId.toString() === battleMatchIdStr);
          p2Val = originalPred ? originalPred[cat === 'scoreline' ? 'homeScore' : cat] : null;
          if (cat === 'scoreline' && originalPred) {
            p2Val = `${originalPred.homeScore}-${originalPred.awayScore} (${originalPred.safeBet})`;
          }
        }

        details.push({
          category: cat,
          player1Val: p1Val,
          player2Val: p2Val,
          player1Pts: p1Pts,
          player2Pts: p2Pts,
          winner: catWinner
        });
      });

      // Calculate Battle Points
      let p1BattlePoints = 0;
      let p2BattlePoints = 0;
      let battleOutcome = 'Draw';

      if (p1Wins > p2Wins) {
        battleOutcome = 'Player1';
        // Clean sweep check: 4 wins
        p1BattlePoints = (p1Wins === 4) ? 5 : 3;
        p2BattlePoints = 0;
      } else if (p2Wins > p1Wins) {
        battleOutcome = 'Player2';
        p2BattlePoints = (p2Wins === 4) ? 5 : 3;
        p1BattlePoints = 0;
      } else {
        // Draw
        battleOutcome = 'Draw';
        p1BattlePoints = 1;
        p2BattlePoints = 1;
      }

      battleResults.push({
        battleId: matchup._id,
        player1Id: matchup.player1Id,
        player2Id: matchup.player2Id,
        player1Wins: p1Wins,
        player2Wins: p2Wins,
        player1Points: p1BattlePoints,
        player2Points: p2BattlePoints,
        outcome: battleOutcome,
        details
      });
    });
  }

  return {
    scoredPredictions,
    battleResults
  };
}

module.exports = {
  calculateDistribution,
  getGeneralCategoryPoints,
  getScorelinePoints,
  scoreUserPrediction,
  scoreMatchweek
};
