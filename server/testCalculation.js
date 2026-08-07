require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Group = require('./models/Group');
const GroupStanding = require('./models/GroupStanding');
const Matchweek = require('./models/Matchweek');
const Prediction = require('./models/Prediction');
const Battle = require('./models/Battle');
const { scoreMatchweek } = require('./utils/scoringEngine');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/prediction_game';
const AVERAGE_PLAYER_ID = '600000000000000000000000';

async function testCalc() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);

    const group = await Group.findOne({ name: 'Alpha League' });
    const mw = await Matchweek.findOne({ groupId: group._id, matchweekNumber: 1 });
    if (!mw) {
      console.error('Matchweek 1 not found. Run seed.js first.');
      process.exit(1);
    }

    const p1 = await User.findOne({ username: 'pred_star' });
    const p2 = await User.findOne({ username: 'kane_fan' });
    const p3 = await User.findOne({ username: 'sonny_smile' });

    console.log('Creating mock predictions...');

    // Clear previous predictions
    await Prediction.deleteMany({ groupId: group._id, matchweekId: mw._id });

    // Player 1 prediction (pred_star)
    const pred1 = new Prediction({
      groupId: group._id,
      userId: p1._id,
      matchweekId: mw._id,
      isSubmitted: true,
      predictions: [
        { matchId: mw.matches[0]._id, result: 'Home', homeScore: 2, awayScore: 0, safeBet: 'Home', firstGoal: 'Home', possession: 'Home', wildPredictionCategory: 'Yellow Cards', wildPredictionValue: 3 },
        { matchId: mw.matches[1]._id, result: 'Draw', homeScore: 1, awayScore: 1, safeBet: 'Home', firstGoal: 'No goal', possession: 'Equal', wildPredictionCategory: 'Yellow Cards', wildPredictionValue: 2 },
        { matchId: mw.matches[2]._id, result: 'Home', homeScore: 3, awayScore: 1, safeBet: 'Home', firstGoal: 'Home', possession: 'Home', wildPredictionCategory: 'Corners', wildPredictionValue: 6 },
        { matchId: mw.matches[3]._id, result: 'Away', homeScore: 1, awayScore: 2, safeBet: 'Away', firstGoal: 'Away', possession: 'Away', wildPredictionCategory: 'Corners', wildPredictionValue: 8 },
        { matchId: mw.matches[4]._id, result: 'Home', homeScore: 1, awayScore: 0, safeBet: 'Home', firstGoal: 'Home', possession: 'Home', wildPredictionCategory: 'Yellow Cards', wildPredictionValue: 4 }
      ],
      captainMatchId: mw.matches[0]._id,
      gamble: { active: true, points: 50, matchId: mw.matches[0]._id },
      marketPowerUps: [{ matchId: mw.matches[0]._id, type: 'Double' }]
    });

    // Player 2 prediction (kane_fan)
    const pred2 = new Prediction({
      groupId: group._id,
      userId: p2._id,
      matchweekId: mw._id,
      isSubmitted: true,
      predictions: [
        { matchId: mw.matches[0]._id, result: 'Home', homeScore: 2, awayScore: 0, safeBet: 'Home', firstGoal: 'Home', possession: 'Home', wildPredictionCategory: 'Yellow Cards', wildPredictionValue: 3 },
        { matchId: mw.matches[1]._id, result: 'Away', homeScore: 0, awayScore: 2, safeBet: 'Away', firstGoal: 'Away', possession: 'Away', wildPredictionCategory: 'Yellow Cards', wildPredictionValue: 2 },
        { matchId: mw.matches[2]._id, result: 'Home', homeScore: 2, awayScore: 0, safeBet: 'Home', firstGoal: 'Home', possession: 'Home', wildPredictionCategory: 'Corners', wildPredictionValue: 6 },
        { matchId: mw.matches[3]._id, result: 'Away', homeScore: 0, awayScore: 3, safeBet: 'Away', firstGoal: 'Away', possession: 'Away', wildPredictionCategory: 'Corners', wildPredictionValue: 8 },
        { matchId: mw.matches[4]._id, result: 'Home', homeScore: 2, awayScore: 1, safeBet: 'Home', firstGoal: 'Home', possession: 'Home', wildPredictionCategory: 'Yellow Cards', wildPredictionValue: 4 }
      ],
      captainMatchId: mw.matches[0]._id,
      gamble: { active: false, points: 0, matchId: null },
      marketPowerUps: []
    });

    // Player 3 prediction (sonny_smile)
    const pred3 = new Prediction({
      groupId: group._id,
      userId: p3._id,
      matchweekId: mw._id,
      isSubmitted: true,
      predictions: [
        { matchId: mw.matches[0]._id, result: 'Home', homeScore: 1, awayScore: 0, safeBet: 'Home', firstGoal: 'Home', possession: 'Home', wildPredictionCategory: 'Yellow Cards', wildPredictionValue: 2 },
        { matchId: mw.matches[1]._id, result: 'Home', homeScore: 2, awayScore: 1, safeBet: 'Home', firstGoal: 'Home', possession: 'Home', wildPredictionCategory: 'Yellow Cards', wildPredictionValue: 3 },
        { matchId: mw.matches[2]._id, result: 'Home', homeScore: 2, awayScore: 0, safeBet: 'Home', firstGoal: 'Home', possession: 'Home', wildPredictionCategory: 'Corners', wildPredictionValue: 5 },
        { matchId: mw.matches[3]._id, result: 'Home', homeScore: 2, awayScore: 1, safeBet: 'Home', firstGoal: 'Home', possession: 'Home', wildPredictionCategory: 'Corners', wildPredictionValue: 6 },
        { matchId: mw.matches[4]._id, result: 'Draw', homeScore: 0, awayScore: 0, safeBet: 'Home', firstGoal: 'No goal', possession: 'Equal', wildPredictionCategory: 'Yellow Cards', wildPredictionValue: 1 }
      ],
      captainMatchId: mw.matches[1]._id,
      gamble: { active: false, points: 0, matchId: null },
      marketPowerUps: []
    });

    await pred1.save();
    await pred2.save();
    await pred3.save();
    console.log('Saved predictions.');

    console.log('Admin entering actual results...');
    mw.matches[0].actualResults = { homeScore: 2, awayScore: 0, result: 'Home', firstGoal: 'Home', possession: 'Home', wildPredictionCorrectUsers: [p1._id, p2._id] };
    mw.matches[1].actualResults = { homeScore: 1, awayScore: 1, result: 'Draw', firstGoal: 'Away', possession: 'Equal', wildPredictionCorrectUsers: [] };
    mw.matches[2].actualResults = { homeScore: 2, awayScore: 0, result: 'Home', firstGoal: 'Home', possession: 'Home', wildPredictionCorrectUsers: [] };
    mw.matches[3].actualResults = { homeScore: 0, awayScore: 3, result: 'Away', firstGoal: 'Away', possession: 'Away', wildPredictionCorrectUsers: [] };
    mw.matches[4].actualResults = { homeScore: 2, awayScore: 1, result: 'Home', firstGoal: 'Home', possession: 'Home', wildPredictionCorrectUsers: [] };
    mw.status = 'active';
    await mw.save();
    console.log('Actual results saved.');

    console.log('Triggering calculations (Group standing scoping)...');
    
    const predictions = await Prediction.find({ groupId: group._id, matchweekId: mw._id });
    const battleMatchups = await Battle.find({ groupId: group._id, matchweekId: mw._id });

    const { scoredPredictions, battleResults } = scoreMatchweek(mw, predictions, battleMatchups);

    scoredPredictions.forEach((sp) => {
      const userObj = [p1, p2, p3].find(p => p._id.toString() === sp.userId.toString());
      console.log(`\nPlayer: ${userObj.username}`);
      console.log(`Weekly points: ${sp.totalMatchweekPoints}`);
      console.log('Gamble outcome:', sp.gamble);
    });

    console.log('\nBattle results:');
    const bMatchIdStr = mw.battleMatchId.toString();
    const realScores = scoredPredictions.map(sp => {
      const mResult = sp.matchResults.find(m => m.matchId.toString() === bMatchIdStr);
      return mResult ? mResult.points : null;
    }).filter(Boolean);

    const avgPoints = { result: 0, scoreline: 0, firstGoal: 0, possession: 0 };
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

    battleResults.forEach((br) => {
      const isP1Average = br.player1Id.toString() === AVERAGE_PLAYER_ID;
      const isP2Average = br.player2Id.toString() === AVERAGE_PLAYER_ID;
      const p1Name = isP1Average ? 'Average Player' : [p1, p2, p3].find(p => p._id.toString() === br.player1Id.toString()).username;
      const p2Name = isP2Average ? 'Average Player' : [p1, p2, p3].find(p => p._id.toString() === br.player2Id.toString()).username;
      console.log(`${p1Name} vs ${p2Name} -> Winner outcome: ${br.outcome}, BP: P1=${br.player1Points}, P2=${br.player2Points}`);
    });

    console.log('\nSaving calculations in database group standings...');
    for (const bRes of battleResults) {
      const isP1Average = bRes.player1Id.toString() === AVERAGE_PLAYER_ID;
      const isP2Average = bRes.player2Id.toString() === AVERAGE_PLAYER_ID;

      if (isP1Average || isP2Average) {
        const isP1Avg = isP1Average;
        let pWins = 0;
        let avgWins = 0;

        bRes.details.forEach((det) => {
          const realPts = isP1Avg ? det.player2Pts : det.player1Pts;
          const avgPts = avgPoints[det.category];
          det[isP1Avg ? 'player1Val' : 'player2Val'] = 'Average';
          det[isP1Avg ? 'player1Pts' : 'player2Pts'] = avgPts;

          if (realPts > avgPts) {
            det.winner = isP1Avg ? 'Player2' : 'Player1';
            pWins++;
          } else if (avgPts > realPts) {
            det.winner = isP1Avg ? 'Player1' : 'Player2';
            avgWins++;
          } else {
            det.winner = 'Draw';
          }
        });

        bRes.player1Wins = isP1Avg ? avgWins : pWins;
        bRes.player2Wins = isP1Avg ? pWins : avgWins;

        if (pWins > avgWins) {
          bRes.outcome = isP1Avg ? 'Player2' : 'Player1';
          bRes[isP1Avg ? 'player2Points' : 'player1Points'] = (pWins === 4) ? 5 : 3;
          bRes[isP1Avg ? 'player1Points' : 'player2Points'] = 0;
        } else if (avgWins > pWins) {
          bRes.outcome = isP1Avg ? 'Player1' : 'Player2';
          bRes[isP1Avg ? 'player1Points' : 'player2Points'] = (avgWins === 4) ? 5 : 3;
          bRes[isP1Avg ? 'player2Points' : 'player1Points'] = 0;
        } else {
          bRes.outcome = 'Draw';
          bRes.player1Points = 1;
          bRes.player2Points = 1;
        }
      }

      await Battle.findByIdAndUpdate(bRes.battleId, {
        player1Wins: bRes.player1Wins,
        player2Wins: bRes.player2Wins,
        player1Points: bRes.player1Points,
        player2Points: bRes.player2Points,
        outcome: bRes.outcome,
        details: bRes.details
      });
    }

    for (const score of scoredPredictions) {
      await GroupStanding.findOneAndUpdate(
        { groupId: group._id, userId: score.userId },
        { $inc: { totalPoints: score.totalMatchweekPoints } }
      );
    }
    console.log('Group standings updated.');

    mongoose.disconnect();
  } catch (err) {
    console.error('Test calc failed:', err);
    process.exit(1);
  }
}

testCalc();
