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

function run() {
  const workspaceRoot = '/Users/rohit.rohon01gmail.com/Documents/PredG';
  
  // 1. Parse Predictions CSV
  const predictionsCsv = fs.readFileSync(path.join(workspaceRoot, 'Prediction Game 2.0 - Predictions.csv'), 'utf-8');
  const predLines = predictionsCsv.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const matches = {};
  let currentMatch = '';
  
  for (let line of predLines) {
    if (line.includes('Aston Villa vs') || line.includes('Chelsea FC vs') || line.includes('Brentford vs') || line.includes('Arsenal FC vs') || line.includes('Crystal Palace vs') || line.includes('CURRENT MATCHWEEK POINTS')) {
      currentMatch = line.split(',')[0].trim();
      matches[currentMatch] = [];
      continue;
    }
    if (currentMatch && !line.startsWith('Name') && !line.startsWith('FALSE') && !line.startsWith('Matchweek')) {
      const parts = parseCsvLine(line);
      if (parts[0] && parts[0] !== '') {
        matches[currentMatch].push({
          name: parts[0],
          prediction: parts[1] || '-',
          predPoints: parseInt(parts[2]) || 0,
          scoreline: parts[3] || '-',
          safeBet: parts[4] || '-',
          safeBetPoints: parseInt(parts[5]) || 0,
          firstGoal: parts[6] || '-',
          firstGoalPoints: parseInt(parts[7]) || 0,
          possession: parts[8] || '-',
          possessionPoints: parseInt(parts[9]) || 0,
          total: parseInt(parts[10]) || 0
        });
      }
    }
  }

  // 2. Parse Battle CSV
  const battleCsv = fs.readFileSync(path.join(workspaceRoot, 'Prediction Game 2.0 - Battle.csv'), 'utf-8');
  const battleLines = battleCsv.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // We can see from line 9 onwards: Name, BATTLE POINTS, opponent, matchResult, scoreline, etc.
  const battles = [];
  for (let line of battleLines) {
    const parts = parseCsvLine(line);
    // Columns: Name (0), BATTLE POINTS (1), Opponent (3), OpponentPoints (4), Scoreline (5), scorelinePoints (6), 1stGoal (7), goalPoints (8), Possession (9), possPoints (10), BP (12)
    if (parts[0] && parts[3] && parts[0] !== 'Name' && parts[0] !== 'FALSE' && parts[0] !== 'Battle Match' && parts[0] !== 'Matchweek') {
      battles.push({
        player1: parts[0],
        player1BP: parseInt(parts[1]) || 0,
        player2: parts[3],
        player2Points: parseInt(parts[4]) || 0,
        scorelineType: parts[5] || '-',
        scorelinePoints: parseInt(parts[6]) || 0,
        goalType: parts[7] || '-',
        goalPoints: parseInt(parts[8]) || 0,
        possessionType: parts[9] || '-',
        possessionPoints: parseInt(parts[10]) || 0,
        netBP: parseInt(parts[12]) || 0
      });
    }
  }

  // 3. Parse Rankings CSV
  const rankingsCsv = fs.readFileSync(path.join(workspaceRoot, 'Prediction Game 2.0 - Rankings.csv'), 'utf-8');
  const rankLines = rankingsCsv.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const progression = [];
  const rankProgression = [];
  const winners = [];
  
  // Line 12 onwards (Match Weeks 1 to 36)
  for (let i = 11; i < rankLines.length; i++) {
    const parts = parseCsvLine(rankLines[i]);
    if (parts[0] && !isNaN(parseInt(parts[0]))) {
      const mw = parseInt(parts[0]);
      
      // Total Points at end of Match Week (Columns L-T, which is index 11-19)
      // Wait, let's look at index columns in Rankings.csv line:
      // Match Week (0), Anshuman (1), Debadutta (2), Niroj (3), Omkar (4), Rohit (5), Sarthak (6), Shovam (7), Siddharth (8), Avg (9)
      // Then: Match Week (11), Anshuman (12), Debadutta (13), Niroj (14), Omkar (15), Rohit (16), Sarthak (17), Shovam (18), Siddharth (19)
      // Then: Match Week (21), Winner (22), Winner Points (23)
      // Then: Match Week (25), Anshuman (26), Debadutta (27), Niroj (28), Omkar (29), Rohit (30), Sarthak (31), Shovam (32), Siddharth (33)
      
      progression.push({
        mw,
        anshuman: parseInt(parts[12]) || 0,
        debadutta: parseInt(parts[13]) || 0,
        niroj: parseInt(parts[14]) || 0,
        omkar: parseInt(parts[15]) || 0,
        rohit: parseInt(parts[16]) || 0,
        sarthak: parseInt(parts[17]) || 0,
        shovam: parseInt(parts[18]) || 0,
        siddharth: parseInt(parts[19]) || 0,
        avg: parseInt(parts[9]) || 0
      });

      if (parts[22] && parts[22] !== '') {
        winners.push({
          mw,
          winner: parts[22],
          points: parseInt(parts[23]) || 0
        });
      }

      rankProgression.push({
        mw,
        anshuman: parseInt(parts[26]) || 0,
        debadutta: parseInt(parts[27]) || 0,
        niroj: parseInt(parts[28]) || 0,
        omkar: parseInt(parts[29]) || 0,
        rohit: parseInt(parts[30]) || 0,
        sarthak: parseInt(parts[31]) || 0,
        shovam: parseInt(parts[32]) || 0,
        siddharth: parseInt(parts[33]) || 0
      });
    }
  }

  // Write to Javascript file
  const jsContent = `export const HISTORICAL_PREDICTIONS = ${JSON.stringify(matches, null, 2)};

export const HISTORICAL_BATTLES = ${JSON.stringify(battles, null, 2)};

export const HISTORICAL_PROGRESSION = ${JSON.stringify(progression, null, 2)};

export const HISTORICAL_WINNERS = ${JSON.stringify(winners, null, 2)};

export const HISTORICAL_RANKS = ${JSON.stringify(rankProgression, null, 2)};
`;

  fs.writeFileSync(path.join(workspaceRoot, 'client/src/components/HistoricalData2.js'), jsContent);
  console.log('HistoricalData2.js generated successfully!');
}

run();
