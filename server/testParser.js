const fs = require('fs');
const path = require('path');

// Helper to parse simple CSV line
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function getScorelinePoints(predHome, predAway, predSafeBet, actHome, actAway) {
  if (predHome === actHome && predAway === actAway) {
    return 100;
  }
  let actualWinner = null;
  if (actHome > actAway) actualWinner = 'Home';
  else if (actAway > actHome) actualWinner = 'Away';
  else actualWinner = 'Draw';

  if (actualWinner === predSafeBet) {
    if (predSafeBet === 'Home' && predHome === actHome) return 50;
    if (predSafeBet === 'Away' && predAway === actAway) return 50;
  }
  if (predAway === actAway) return 20;
  if (predHome === actHome) return 10;
  return 0;
}

function run() {
  const csvPath = '/Users/rohit.rohon01gmail.com/Documents/PredG/Prediction Game 2.0 - Consolidated Predictions.csv';
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const lines = csv.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let currentMw = 0;
  let currentMatch = '';
  let matchPredictions = [];

  for (let line of lines) {
    const parts = parseCsvLine(line);
    if (parts[0] === 'Matchweek') {
      currentMw = parseInt(parts[1]);
      continue;
    }
    
    // Check if it's a fixture title
    if (line.includes(' vs ') && !line.startsWith('Name')) {
      if (currentMatch) {
        // Reconstruct score for previous match
        deduceMatchScore(currentMatch, matchPredictions);
      }
      currentMatch = parts[0];
      matchPredictions = [];
      continue;
    }

    if (currentMatch && parts[0] && parts[0] !== 'Name' && parts[0] !== 'FALSE' && parts[0] !== 'CURRENT MATCHWEEK POINTS' && parts[0] !== 'TOTAL POINTS') {
      // It's a player row
      // Columns: Name (0), Result (1), ResultPts (2), Scoreline (3), SafeBet (4), ScorelinePts (5), 1stGoal (6), GoalPts (7), Possession (8), PossPts (9), Total (10)
      const scoreParts = parts[3].split('-');
      const predHome = parseInt(scoreParts[0]) || 0;
      const predAway = parseInt(scoreParts[1]) || 0;
      
      matchPredictions.push({
        name: parts[0],
        result: parts[1],
        resultPts: parseInt(parts[2]) || 0,
        predHome,
        predAway,
        safeBet: parts[4],
        scorelinePts: parseInt(parts[5]) || 0,
        firstGoal: parts[6],
        firstGoalPts: parseInt(parts[7]) || 0,
        possession: parts[8],
        possessionPts: parseInt(parts[9]) || 0
      });
    }

    if (parts[0] === 'CURRENT MATCHWEEK POINTS') {
      if (currentMatch) {
        deduceMatchScore(currentMatch, matchPredictions);
        currentMatch = '';
        matchPredictions = [];
      }
    }
  }

  console.log('Parser testing done.');
}

function deduceMatchScore(matchName, preds) {
  if (preds.length === 0) return null;

  // Brute force actual Home score (h) and Away score (a) from 0 to 6
  let found = false;
  let bestH = 0, bestA = 0;

  for (let h = 0; h <= 6; h++) {
    for (let a = 0; a <= 6; a++) {
      // Check if this (h, a) satisfies the scoreline points for all players
      let matchesAll = true;
      for (let p of preds) {
        const computed = getScorelinePoints(p.predHome, p.predAway, p.safeBet, h, a);
        if (computed !== p.scorelinePts) {
          matchesAll = false;
          break;
        }
      }
      if (matchesAll) {
        bestH = h;
        bestA = a;
        found = true;
        break;
      }
    }
    if (found) break;
  }

  // Deduce actual result from scoreline
  let actResult = 'Draw';
  if (bestH > bestA) actResult = 'Home';
  else if (bestA > bestH) actResult = 'Away';

  // Deduce actual first goal
  let actFirstGoal = null;
  for (let p of preds) {
    if (p.firstGoalPts > 0) {
      actFirstGoal = p.firstGoal;
      break;
    }
  }
  if (!actFirstGoal) {
    if (bestH === 0 && bestA === 0) {
      actFirstGoal = 'No goal';
    } else if (bestH > 0 && bestA === 0) {
      actFirstGoal = 'Home';
    } else if (bestA > 0 && bestH === 0) {
      actFirstGoal = 'Away';
    } else {
      // Default to winner or Home
      actFirstGoal = actResult === 'Away' ? 'Away' : 'Home';
    }
  }

  // Deduce actual possession
  let actPossession = null;
  for (let p of preds) {
    if (p.possessionPts > 0) {
      actPossession = p.possession;
      break;
    }
  }
  if (!actPossession) {
    actPossession = 'Equal';
  }

  // Map choices (e.g. team names or Home/Away/Draw) to standard values
  // Since team names can be anything, let's keep them as parsed or normalize
  console.log(`Deducing score for: ${matchName} -> Score: ${bestH}-${bestA}, Result: ${actResult}, 1st Goal: ${actFirstGoal}, Possession: ${actPossession}`);
}

run();
