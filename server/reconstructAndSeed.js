const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Group = require('./models/Group');
const GroupStanding = require('./models/GroupStanding');
const Matchweek = require('./models/Matchweek');
const Prediction = require('./models/Prediction');
const Battle = require('./models/Battle');

const { scoreMatchweek } = require('./utils/scoringEngine');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/prediction_game';
const AVERAGE_PLAYER_ID = '600000000000000000000000';

const ABBR_TO_TEAM = {
  'MUN': 'Manchester United',
  'FUL': 'Fulham',
  'LIV': 'Liverpool FC',
  'IPS': 'Ipswich Town',
  'WHU': 'West Ham United',
  'AVL': 'Aston Villa',
  'CHE': 'Chelsea FC',
  'MCI': 'Manchester City',
  'TOT': 'Tottenham Hotspur',
  'LEI': 'Leicester City',
  'CRY': 'Crystal Palace',
  'WOL': 'Wolverhampton Wanderers',
  'EVE': 'Everton FC',
  'BHA': 'Brighton & Hove Albion',
  'ARS': 'Arsenal FC',
  'NEW': 'Newcastle United',
  'NFO': 'Nottingham Forest',
  'BOU': 'Bournemouth',
  'BRE': 'Brentford',
  'SOU': 'Southampton'
};

const TEAM_TO_ABBR = {};
Object.entries(ABBR_TO_TEAM).forEach(([abbr, team]) => {
  TEAM_TO_ABBR[team] = abbr;
});

// Helper to match fixture names (e.g. "IPS vs LIV" with "Ipswich Town vs Liverpool FC")
function matchFixture(abbrFixture, matchesList) {
  if (!abbrFixture) return null;
  const cleanAbbr = abbrFixture.replace(/\s+/g, '').toLowerCase();
  
  for (let m of matchesList) {
    const homeAbbr = TEAM_TO_ABBR[m.homeTeam] || m.homeTeam.substring(0, 3);
    const awayAbbr = TEAM_TO_ABBR[m.awayTeam] || m.awayTeam.substring(0, 3);
    
    const combinedOption1 = `${homeAbbr}vs${awayAbbr}`.toLowerCase();
    const combinedOption2 = `${m.homeTeam}vs${m.awayTeam}`.replace(/\s+/g, '').toLowerCase();
    
    if (cleanAbbr.includes(homeAbbr.toLowerCase()) && cleanAbbr.includes(awayAbbr.toLowerCase())) {
      return m;
    }
    if (combinedOption1.includes(cleanAbbr) || combinedOption2.includes(cleanAbbr) || cleanAbbr.includes(combinedOption1)) {
      return m;
    }
  }
  return matchesList[0]; // fallback
}

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

// Clean player name from CSV
function cleanPlayerName(rawName) {
  if (!rawName) return '';
  return rawName
    .replace(/\(.*?\)/g, '')
    .replace(/[0-9]/g, '')
    .replace(/🛡️/g, '')
    .replace(/2️⃣/g, '')
    .replace(/3️⃣/g, '')
    .replace(/1️⃣/g, '')
    .replace(/=+/g, '')
    .trim();
}

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  // Clear existing collections
  await User.deleteMany({});
  await Group.deleteMany({});
  await GroupStanding.deleteMany({});
  await Matchweek.deleteMany({});
  await Prediction.deleteMany({});
  await Battle.deleteMany({});

  console.log('Database cleared.');

  // Hash passwords
  const passwordHash = await bcrypt.hash('user123', 10);

  // Create real players
  const players = [
    { name: 'Rohit', username: 'pred_star', email: 'user1@predg.com' },
    { name: 'Anshuman', username: 'anshuman', email: 'anshuman@predg.com' },
    { name: 'Debadutta', username: 'debadutta', email: 'debadutta@predg.com' },
    { name: 'Niroj', username: 'niroj', email: 'niroj@predg.com' },
    { name: 'Omkar', username: 'omkar', email: 'omkar@predg.com' },
    { name: 'Sarthak', username: 'sarthak', email: 'sarthak@predg.com' },
    { name: 'Shovam', username: 'shovam', email: 'shovam@predg.com' },
    { name: 'Siddharth', username: 'siddharth', email: 'siddharth@predg.com' }
  ];

  const userDocs = {};
  const userMapByCsvName = {};

  for (let p of players) {
    const user = new User({
      username: p.username,
      email: p.email,
      password: passwordHash,
      role: 'player'
    });
    await user.save();
    userDocs[p.username] = user;
    userMapByCsvName[p.name] = user;
    console.log(`Created user: ${p.username} (${p.name})`);
  }

  // Create admin user
  const adminUser = new User({
    username: 'admin',
    email: 'admin@predg.com',
    password: passwordHash,
    role: 'admin'
  });
  await adminUser.save();
  console.log('Created admin user.');

  // Create average player
  const averagePlayer = new User({
    _id: AVERAGE_PLAYER_ID,
    username: 'Average Player',
    email: 'average.player@predg.com',
    password: 'dummy_hash_not_usable',
    role: 'player'
  });
  await averagePlayer.save();
  userMapByCsvName['Average Player'] = averagePlayer;
  console.log('Created Average Player.');

  // Create Group Standing records
  const groupStandingDocs = [];

  // Create Group
  const group = new Group({
    name: 'Alpha League',
    code: 'ALPHA1',
    adminId: adminUser._id,
    members: Object.values(userDocs).map(u => u._id)
  });
  await group.save();
  console.log('Created Group Alpha League (ALPHA1)');

  for (let u of Object.values(userDocs)) {
    const standing = new GroupStanding({
      groupId: group._id,
      userId: u._id,
      totalPoints: 0,
      battlePoints: 0,
      rank: 1
    });
    await standing.save();
    groupStandingDocs.push(standing);
  }

  // Add average player standing
  const avgStanding = new GroupStanding({
    groupId: group._id,
    userId: averagePlayer._id,
    totalPoints: 0,
    battlePoints: 0,
    rank: 999
  });
  await avgStanding.save();

  // Read Consolidated Predictions CSV
  const csvPath = '/Users/rohit.rohon01gmail.com/Documents/PredG/Prediction Game 2.0 - Consolidated Predictions.csv';
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const lines = csv.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let currentMwNumber = 0;
  let currentMatch = '';
  let matchPredictions = [];
  let matchweeksToCreate = [];

  // Structure to collect prediction docs per week before saving
  let mweeks = {}; // matchweekNumber -> { matches: [], userPredictions: {} }

  for (let line of lines) {
    const parts = parseCsvLine(line);
    if (parts[0] === 'Matchweek') {
      currentMwNumber = parseInt(parts[1]);
      mweeks[currentMwNumber] = { matches: [], userPredictions: {} };
      continue;
    }

    if (parts[0] && parts[0].includes(' vs ') && !parts[0].includes('Battle Match')) {
      currentMatch = parts[0];
      const matchTeams = currentMatch.split(' vs ');
      const homeTeam = matchTeams[0].trim();
      const awayTeam = matchTeams[1].trim();

      mweeks[currentMwNumber].matches.push({
        homeTeam,
        awayTeam,
        predictions: []
      });
      continue;
    }

    if (currentMwNumber && currentMatch && parts[0] && parts[0] !== 'Name' && parts[0] !== 'FALSE' && parts[0] !== 'CURRENT MATCHWEEK POINTS' && parts[0] !== 'TOTAL POINTS') {
      const csvPlayerName = cleanPlayerName(parts[0]);
      const userDoc = userMapByCsvName[csvPlayerName];
      if (!userDoc) continue;

      const scoreParts = parts[3].split('-');
      const predHome = parseInt(scoreParts[0]) || 0;
      const predAway = parseInt(scoreParts[1]) || 0;

      // Collect match predictions for score resolution later
      const matchIdx = mweeks[currentMwNumber].matches.length - 1;
      const activeMatch = mweeks[currentMwNumber].matches[matchIdx];

      activeMatch.predictions.push({
        userId: userDoc._id,
        username: userDoc.username,
        csvName: csvPlayerName,
        result: parts[1],
        resultPts: parseInt(parts[2]) || 0,
        predHome,
        predAway,
        safeBet: parts[4],
        scorelinePts: parseInt(parts[5]) || 0,
        firstGoal: parts[6],
        firstGoalPts: parseInt(parts[7]) || 0,
        possession: parts[8],
        possessionPts: parseInt(parts[9]) || 0,
        
        // Captain, Gamble, Market Power-ups
        captainMatch: parts[14],
        gambleMatch: parts[17],
        gamblePoints: parseInt(parts[18]) || 0,
        doubleMatch: parts[22],
        tripleMatch: parts[24],
        shieldMatch: parts[26]
      });
    }
  }

  console.log('CSV Predictions parsed. Deduced week count:', Object.keys(mweeks).length);

  // Round-robin battle pairings schedule over 37 weeks
  const getRoundRobinPairs = (mwNum, membersList) => {
    // 8 players: list of length 8
    const n = membersList.length;
    const round = (mwNum - 1) % 7; // Round Robin rounds 0 to 6
    const pairs = [];

    // Round Robin generation
    const temp = [...membersList];
    const pivot = temp[0];
    const rot = temp.slice(1);
    
    // Rotate the rot list by the round index
    for (let r = 0; r < round; r++) {
      const last = rot.pop();
      rot.unshift(last);
    }
    const currentList = [pivot, ...rot];
    
    for (let i = 0; i < n / 2; i++) {
      pairs.push([currentList[i], currentList[n - 1 - i]]);
    }
    return pairs;
  };

  const membersArray = Object.values(userDocs);

  // Loop through weeks, create matchweek, matches, predictions, battles, and calculate
  for (let mwNumStr of Object.keys(mweeks).sort((a, b) => parseInt(a) - parseInt(b))) {
    const mwNum = parseInt(mwNumStr);
    const mwData = mweeks[mwNum];

    console.log(`Processing MW #${mwNum}...`);

    // Create Match Schema objects
    const matchObjects = [];
    const matchesMap = {}; // matchName -> match object

    mwData.matches.forEach((m) => {
      // 1. Deduce actual outcomes
      let actResult = 'Draw';
      let actFirstGoal = 'No goal';
      let actPossession = 'Equal';
      let bestH = 0, bestA = 0;

      // Brute force score satisfying all players' points
      let found = false;
      for (let h = 0; h <= 6; h++) {
        for (let a = 0; a <= 6; a++) {
          let matchesAll = true;
          for (let p of m.predictions) {
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

      if (bestH > bestA) actResult = 'Home';
      else if (bestA > bestH) actResult = 'Away';

      // Find actual first goal
      for (let p of m.predictions) {
        if (p.firstGoalPts > 0) {
          // Map abbreviation team to Home/Away
          if (p.firstGoal === 'No goal') actFirstGoal = 'No goal';
          else if (TEAM_TO_ABBR[m.homeTeam] === p.firstGoal) actFirstGoal = 'Home';
          else if (TEAM_TO_ABBR[m.awayTeam] === p.firstGoal) actFirstGoal = 'Away';
          else actFirstGoal = p.firstGoal === m.homeTeam ? 'Home' : 'Away';
          break;
        }
      }
      if (!actFirstGoal) {
        if (bestH === 0 && bestA === 0) actFirstGoal = 'No goal';
        else if (bestH > 0 && bestA === 0) actFirstGoal = 'Home';
        else if (bestA > 0 && bestH === 0) actFirstGoal = 'Away';
        else actFirstGoal = actResult === 'Away' ? 'Away' : 'Home';
      }

      // Find actual possession
      for (let p of m.predictions) {
        if (p.possessionPts > 0) {
          if (p.possession === 'Equal' || p.possession === 'Equal Possession') actPossession = 'Equal';
          else if (TEAM_TO_ABBR[m.homeTeam] === p.possession) actPossession = 'Home';
          else if (TEAM_TO_ABBR[m.awayTeam] === p.possession) actPossession = 'Away';
          else actPossession = p.possession === m.homeTeam ? 'Home' : 'Away';
          break;
        }
      }
      if (!actPossession) actPossession = 'Equal';

      const matchObj = {
        _id: new mongoose.Types.ObjectId(),
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        kickoffTime: new Date(Date.now() - (38 - mwNum) * 7 * 24 * 60 * 60 * 1000), // historical dates
        actualResults: {
          homeScore: bestH,
          awayScore: bestA,
          result: actResult,
          firstGoal: actFirstGoal,
          possession: actPossession,
          wildPredictionCorrectUsers: []
        }
      };

      matchObjects.push(matchObj);
      matchesMap[`${m.homeTeam} vs ${m.awayTeam}`] = matchObj;
    });

    // Create Matchweek document
    const matchweek = new Matchweek({
      groupId: group._id,
      matchweekNumber: mwNum,
      status: 'completed',
      deadline: new Date(Date.now() - (38 - mwNum) * 7 * 24 * 60 * 60 * 1000 - 2 * 60 * 60 * 1000),
      battleMatchId: matchObjects[0]._id, // default first match as battle match
      matches: matchObjects
    });
    await matchweek.save();

    // Map and insert player Predictions
    const predictionsToSave = [];
    const playerPredictionsMap = {}; // userIdStr -> prediction doc

    for (let u of membersArray) {
      // Find all predictions for this player in this week
      const singleMatchPredictions = [];
      let captainMatchId = matchObjects[0]._id;
      let gamble = { active: false, points: 0, matchId: null };
      const marketPowerUps = [];

      // Iterate matches to map the player's prediction fields
      matchObjects.forEach((mObj) => {
        const fixtureName = `${mObj.homeTeam} vs ${mObj.awayTeam}`;
        const csvMatchData = mwData.matches.find(m => `${m.homeTeam} vs ${m.awayTeam}` === fixtureName);
        const pPred = csvMatchData?.predictions.find(p => p.userId.toString() === u._id.toString());

        if (pPred) {
          // Map predicted result to 'Home'/'Away'/'Draw'
          let resChoice = 'Draw';
          if (pPred.result === 'Draw') resChoice = 'Draw';
          else if (TEAM_TO_ABBR[mObj.homeTeam] === pPred.result || pPred.result === mObj.homeTeam) resChoice = 'Home';
          else if (TEAM_TO_ABBR[mObj.awayTeam] === pPred.result || pPred.result === mObj.awayTeam) resChoice = 'Away';

          // Map predicted safe bet
          const safeChoice = pPred.safeBet === 'Home' || pPred.safeBet === 'Away' ? pPred.safeBet : 'Home';

          // Map first goal choice
          let firstChoice = 'No goal';
          if (pPred.firstGoal === 'No goal') firstChoice = 'No goal';
          else if (TEAM_TO_ABBR[mObj.homeTeam] === pPred.firstGoal || pPred.firstGoal === mObj.homeTeam) firstChoice = 'Home';
          else if (TEAM_TO_ABBR[mObj.awayTeam] === pPred.firstGoal || pPred.firstGoal === mObj.awayTeam) firstChoice = 'Away';

          // Map possession choice
          let possChoice = 'Equal';
          if (pPred.possession === 'Equal' || pPred.possession === 'Equal Possession') possChoice = 'Equal';
          else if (TEAM_TO_ABBR[mObj.homeTeam] === pPred.possession || pPred.possession === mObj.homeTeam) possChoice = 'Home';
          else if (TEAM_TO_ABBR[mObj.awayTeam] === pPred.possession || pPred.possession === mObj.awayTeam) possChoice = 'Away';

          singleMatchPredictions.push({
            matchId: mObj._id,
            result: resChoice,
            homeScore: pPred.predHome,
            awayScore: pPred.predAway,
            safeBet: safeChoice,
            firstGoal: firstChoice,
            possession: possChoice
          });

          // Check Captain match
          if (pPred.captainMatch) {
            const captainMatch = matchFixture(pPred.captainMatch, matchObjects);
            if (captainMatch) {
              captainMatchId = captainMatch._id;
            }
          }

          // Check Gamble
          if (pPred.gambleMatch && pPred.gamblePoints > 0) {
            const gambleMatch = matchFixture(pPred.gambleMatch, matchObjects);
            if (gambleMatch) {
              gamble = {
                active: true,
                points: pPred.gamblePoints,
                matchId: gambleMatch._id
              };
            }
          }

          // Check Power-ups
          if (pPred.doubleMatch) {
            const doubleMatch = matchFixture(pPred.doubleMatch, matchObjects);
            if (doubleMatch) marketPowerUps.push({ type: 'Double', matchId: doubleMatch._id });
          }
          if (pPred.tripleMatch) {
            const tripleMatch = matchFixture(pPred.tripleMatch, matchObjects);
            if (tripleMatch) marketPowerUps.push({ type: 'Triple', matchId: tripleMatch._id });
          }
          if (pPred.shieldMatch) {
            const shieldMatch = matchFixture(pPred.shieldMatch, matchObjects);
            if (shieldMatch) marketPowerUps.push({ type: 'Shield', matchId: shieldMatch._id });
          }
        }
      });

      // If no predictions found, default them
      if (singleMatchPredictions.length === 0) {
        matchObjects.forEach((mObj) => {
          singleMatchPredictions.push({
            matchId: mObj._id,
            result: 'Home',
            homeScore: 1,
            awayScore: 0,
            safeBet: 'Home',
            firstGoal: 'Home',
            possession: 'Home'
          });
        });
      }

      const predDoc = new Prediction({
        groupId: group._id,
        userId: u._id,
        matchweekId: matchweek._id,
        isSubmitted: true,
        predictions: singleMatchPredictions,
        captainMatchId,
        gamble,
        marketPowerUps
      });
      await predDoc.save();
      predictionsToSave.push(predDoc);
      playerPredictionsMap[u._id.toString()] = predDoc;
    }

    // Generate Battle Matchup Pairings for the matchweek (Round Robin)
    const pairings = getRoundRobinPairs(mwNum, membersArray);
    const battleMatchups = [];

    for (let pair of pairings) {
      const battle = new Battle({
        groupId: group._id,
        matchweekId: matchweek._id,
        player1Id: pair[0]._id,
        player2Id: pair[1]._id
      });
      await battle.save();
      battleMatchups.push(battle);
    }

    // Call the Scoring Engine calculation logic to update all points and battle outcomes!
    const { scoredPredictions, battleResults } = scoreMatchweek(matchweek, predictionsToSave, battleMatchups);

    // Save scored outputs to predictions and battles
    for (let sp of scoredPredictions) {
      await Prediction.updateOne(
        { groupId: group._id, userId: sp.userId, matchweekId: matchweek._id },
        { 
          $set: { 
            totalPointsScored: sp.totalMatchweekPoints
          }
        }
      );
    }

    for (let br of battleResults) {
      await Battle.updateOne(
        { _id: br.battleId },
        {
          $set: {
            player1Wins: br.player1Wins,
            player2Wins: br.player2Wins,
            outcome: br.outcome,
            player1Points: br.player1Points,
            player2Points: br.player2Points,
            details: br.details
          }
        }
      );
    }

    console.log(`MW #${mwNum} calculated & finalized.`);
  }

  // Recalculate group standings and update leaderboard
  console.log('Recalculating overall leaderboard standings...');
  const allStandings = await GroupStanding.find({ groupId: group._id });
  for (let s of allStandings) {
    if (s.userId.toString() === AVERAGE_PLAYER_ID) continue;

    const userPreds = await Prediction.find({ groupId: group._id, userId: s.userId });
    const userBattlesP1 = await Battle.find({ groupId: group._id, player1Id: s.userId });
    const userBattlesP2 = await Battle.find({ groupId: group._id, player2Id: s.userId });

    const totalPoints = userPreds.reduce((acc, p) => acc + (p.totalPointsScored || 0), 0);
    
    let battlePoints = 0;
    userBattlesP1.forEach(b => { battlePoints += b.player1Points; });
    userBattlesP2.forEach(b => { battlePoints += b.player2Points; });

    await GroupStanding.updateOne(
      { _id: s._id },
      { $set: { totalPoints, battlePoints } }
    );
  }

  // Assign ranks
  const updatedStandings = await GroupStanding.find({ groupId: group._id, userId: { $ne: AVERAGE_PLAYER_ID } })
    .sort({ totalPoints: -1 });

  for (let i = 0; i < updatedStandings.length; i++) {
    await GroupStanding.updateOne(
      { _id: updatedStandings[i]._id },
      { $set: { rank: i + 1 } }
    );
  }

  console.log('Seeder run complete. Overall Leaderboard is fully up to date!');
  mongoose.connection.close();
}

seed().catch(err => {
  console.error('Error seeding DB:', err);
  mongoose.connection.close();
});
