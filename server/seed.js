require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Group = require('./models/Group');
const GroupStanding = require('./models/GroupStanding');
const Matchweek = require('./models/Matchweek');
const Prediction = require('./models/Prediction');
const Battle = require('./models/Battle');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/prediction_game';

async function seed() {
  try {
    console.log('Connecting to database for seeding...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    // Clear existing data
    console.log('Clearing database...');
    await User.deleteMany({});
    await Group.deleteMany({});
    await GroupStanding.deleteMany({});
    await Matchweek.deleteMany({});
    await Prediction.deleteMany({});
    await Battle.deleteMany({});
    console.log('Cleared.');

    // Create Admin
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('admin123', salt);
    const admin = new User({
      username: 'admin_predg',
      email: 'admin@predg.com',
      password: adminPassword,
      role: 'admin'
    });
    await admin.save();

    // Create Players
    const playerPassword = await bcrypt.hash('user123', salt);
    const player1 = new User({ name: 'Rohit', username: 'pred_star', email: 'user1@predg.com', password: playerPassword, role: 'player' });
    const player2 = new User({ username: 'kane_fan', email: 'user2@predg.com', password: playerPassword, role: 'player' });
    const player3 = new User({ username: 'sonny_smile', email: 'user3@predg.com', password: playerPassword, role: 'player' });
    await player1.save();
    await player2.save();
    await player3.save();

    // Create mock Average Player (global bye player)
    let averagePlayer = new User({
      _id: '600000000000000000000000',
      username: 'Average Player',
      email: 'average.player@predg.com',
      password: 'dummy_hash_not_usable',
      role: 'player'
    });
    await averagePlayer.save();

    // Create Group: "Alpha League"
    const group = new Group({
      name: 'Alpha League',
      code: 'PREDLG',
      adminId: admin._id,
      members: [admin._id, player1._id, player2._id, player3._id],
      pendingJoins: [],
      pendingLeaves: []
    });
    await group.save();

    // Create Group Standings representing totals after Matchweek 5 calculations
    const standingAdmin = new GroupStanding({ groupId: group._id, userId: admin._id, totalPoints: 0, battlePoints: 0, rank: 4 });
    const standingP1 = new GroupStanding({ groupId: group._id, userId: player1._id, totalPoints: 5450, battlePoints: 12, rank: 1 });
    const standingP2 = new GroupStanding({ groupId: group._id, userId: player2._id, totalPoints: 4950, battlePoints: 6, rank: 2 });
    const standingP3 = new GroupStanding({ groupId: group._id, userId: player3._id, totalPoints: 4350, battlePoints: 8, rank: 3 });
    
    await standingAdmin.save();
    await standingP1.save();
    await standingP2.save();
    await standingP3.save();

    const pastDate = new Date();

    // ================== MATCHWEEK 1 (Completed) ==================
    pastDate.setDate(pastDate.getDate() - 20);
    const mw1 = new Matchweek({
      groupId: group._id, matchweekNumber: 1, status: 'completed', deadline: new Date(pastDate),
      matches: [
        { homeTeam: 'Arsenal', awayTeam: 'Wolves', kickoffTime: pastDate },
        { homeTeam: 'Chelsea', awayTeam: 'Man City', kickoffTime: pastDate }
      ]
    });
    await mw1.save();

    const mw1P1 = new Prediction({
      groupId: group._id, userId: player1._id, matchweekId: mw1._id, isSubmitted: true,
      predictions: [{ matchId: mw1.matches[0]._id, result: 'Home', homeScore: 2, awayScore: 0, safeBet: 'Home', firstGoal: 'Home', possession: 'Home' }],
      captainMatchId: mw1.matches[0]._id, totalPointsScored: 1200, battlePointsScored: 3
    });
    const mw1P2 = new Prediction({
      groupId: group._id, userId: player2._id, matchweekId: mw1._id, isSubmitted: true,
      predictions: [{ matchId: mw1.matches[0]._id, result: 'Home', homeScore: 1, awayScore: 0, safeBet: 'Home', firstGoal: 'Home', possession: 'Home' }],
      captainMatchId: mw1.matches[0]._id, totalPointsScored: 950, battlePointsScored: 0
    });
    const mw1P3 = new Prediction({
      groupId: group._id, userId: player3._id, matchweekId: mw1._id, isSubmitted: true,
      predictions: [{ matchId: mw1.matches[0]._id, result: 'Draw', homeScore: 1, awayScore: 1, safeBet: 'Home', firstGoal: 'Away', possession: 'Away' }],
      captainMatchId: mw1.matches[0]._id, totalPointsScored: 400, battlePointsScored: 3
    });
    await mw1P1.save();
    await mw1P2.save();
    await mw1P3.save();

    const mw1B1 = new Battle({ groupId: group._id, matchweekId: mw1._id, player1Id: player1._id, player2Id: averagePlayer._id, outcome: 'Player1', player1Points: 3, player2Points: 0 });
    const mw1B2 = new Battle({ groupId: group._id, matchweekId: mw1._id, player1Id: player2._id, player2Id: player3._id, outcome: 'Player2', player1Points: 0, player2Points: 3 });
    await mw1B1.save();
    await mw1B2.save();

    // ================== MATCHWEEK 2 (Completed) ==================
    pastDate.setDate(pastDate.getDate() + 3);
    const mw2 = new Matchweek({
      groupId: group._id, matchweekNumber: 2, status: 'completed', deadline: new Date(pastDate),
      matches: [
        { homeTeam: 'Spurs', awayTeam: 'Everton', kickoffTime: pastDate },
        { homeTeam: 'Villa', awayTeam: 'Arsenal', kickoffTime: pastDate }
      ]
    });
    await mw2.save();

    const mw2P1 = new Prediction({
      groupId: group._id, userId: player1._id, matchweekId: mw2._id, isSubmitted: true,
      predictions: [{ matchId: mw2.matches[0]._id, result: 'Home', homeScore: 3, awayScore: 1, safeBet: 'Home', firstGoal: 'Home', possession: 'Home' }],
      captainMatchId: mw2.matches[0]._id, totalPointsScored: 800, battlePointsScored: 0
    });
    const mw2P2 = new Prediction({
      groupId: group._id, userId: player2._id, matchweekId: mw2._id, isSubmitted: true,
      predictions: [{ matchId: mw2.matches[0]._id, result: 'Home', homeScore: 2, awayScore: 1, safeBet: 'Home', firstGoal: 'Home', possession: 'Home' }],
      captainMatchId: mw2.matches[0]._id, totalPointsScored: 1100, battlePointsScored: 3
    });
    const mw2P3 = new Prediction({
      groupId: group._id, userId: player3._id, matchweekId: mw2._id, isSubmitted: true,
      predictions: [{ matchId: mw2.matches[0]._id, result: 'Home', homeScore: 2, awayScore: 1, safeBet: 'Home', firstGoal: 'Home', possession: 'Home' }],
      captainMatchId: mw2.matches[0]._id, totalPointsScored: 750, battlePointsScored: 3
    });
    await mw2P1.save();
    await mw2P2.save();
    await mw2P3.save();

    const mw2B1 = new Battle({ groupId: group._id, matchweekId: mw2._id, player1Id: player1._id, player2Id: averagePlayer._id, outcome: 'Player2', player1Points: 0, player2Points: 3 });
    const mw2B2 = new Battle({ groupId: group._id, matchweekId: mw2._id, player1Id: player2._id, player2Id: player3._id, outcome: 'Draw', player1Points: 1, player2Points: 1 });
    await mw2B1.save();
    await mw2B2.save();

    // ================== MATCHWEEK 3 (Completed) ==================
    pastDate.setDate(pastDate.getDate() + 3);
    const mw3 = new Matchweek({
      groupId: group._id, matchweekNumber: 3, status: 'completed', deadline: new Date(pastDate),
      matches: [
        { homeTeam: 'Man Utd', awayTeam: 'Liverpool', kickoffTime: pastDate },
        { homeTeam: 'Newcastle', awayTeam: 'Spurs', kickoffTime: pastDate }
      ]
    });
    await mw3.save();

    const mw3P1 = new Prediction({
      groupId: group._id, userId: player1._id, matchweekId: mw3._id, isSubmitted: true,
      predictions: [{ matchId: mw3.matches[0]._id, result: 'Away', homeScore: 0, awayScore: 3, safeBet: 'Away', firstGoal: 'Away', possession: 'Away' }],
      captainMatchId: mw3.matches[0]._id, totalPointsScored: 1400, battlePointsScored: 5
    });
    const mw3P2 = new Prediction({
      groupId: group._id, userId: player2._id, matchweekId: mw3._id, isSubmitted: true,
      predictions: [{ matchId: mw3.matches[0]._id, result: 'Draw', homeScore: 2, awayScore: 2, safeBet: 'Away', firstGoal: 'Home', possession: 'Away' }],
      captainMatchId: mw3.matches[0]._id, totalPointsScored: 850, battlePointsScored: 0
    });
    const mw3P3 = new Prediction({
      groupId: group._id, userId: player3._id, matchweekId: mw3._id, isSubmitted: true,
      predictions: [{ matchId: mw3.matches[0]._id, result: 'Away', homeScore: 1, awayScore: 3, safeBet: 'Away', firstGoal: 'Away', possession: 'Away' }],
      captainMatchId: mw3.matches[0]._id, totalPointsScored: 1200, battlePointsScored: 0
    });
    await mw3P1.save();
    await mw3P2.save();
    await mw3P3.save();

    const mw3B1 = new Battle({ groupId: group._id, matchweekId: mw3._id, player1Id: player1._id, player2Id: averagePlayer._id, outcome: 'Player1', player1Points: 5, player2Points: 0 });
    const mw3B2 = new Battle({ groupId: group._id, matchweekId: mw3._id, player1Id: player2._id, player2Id: player3._id, outcome: 'Player2', player1Points: 0, player2Points: 3 });
    await mw3B1.save();
    await mw3B2.save();

    // ================== MATCHWEEK 4 (Completed) ==================
    pastDate.setDate(pastDate.getDate() + 3);
    const mw4 = new Matchweek({
      groupId: group._id, matchweekNumber: 4, status: 'completed', deadline: new Date(pastDate),
      matches: [
        { homeTeam: 'Man City', awayTeam: 'Chelsea', kickoffTime: pastDate },
        { homeTeam: 'Spurs', awayTeam: 'Arsenal', kickoffTime: pastDate }
      ]
    });
    await mw4.save();

    const mw4P1 = new Prediction({
      groupId: group._id, userId: player1._id, matchweekId: mw4._id, isSubmitted: true,
      predictions: [{ matchId: mw4.matches[0]._id, result: 'Home', homeScore: 3, awayScore: 1, safeBet: 'Home', firstGoal: 'Home', possession: 'Home' }],
      captainMatchId: mw4.matches[0]._id, totalPointsScored: 950, battlePointsScored: 4
    });
    const mw4P2 = new Prediction({
      groupId: group._id, userId: player2._id, matchweekId: mw4._id, isSubmitted: true,
      predictions: [{ matchId: mw4.matches[0]._id, result: 'Home', homeScore: 2, awayScore: 0, safeBet: 'Home', firstGoal: 'Home', possession: 'Home' }],
      captainMatchId: mw4.matches[0]._id, totalPointsScored: 1300, battlePointsScored: 3
    });
    const mw4P3 = new Prediction({
      groupId: group._id, userId: player3._id, matchweekId: mw4._id, isSubmitted: true,
      predictions: [{ matchId: mw4.matches[0]._id, result: 'Away', homeScore: 0, awayScore: 2, safeBet: 'Away', firstGoal: 'Away', possession: 'Away' }],
      captainMatchId: mw4.matches[0]._id, totalPointsScored: 600, battlePointsScored: 0
    });
    await mw4P1.save();
    await mw4P2.save();
    await mw4P3.save();

    const mw4B1 = new Battle({ groupId: group._id, matchweekId: mw4._id, player1Id: player1._id, player2Id: averagePlayer._id, outcome: 'Player1', player1Points: 4, player2Points: 0 });
    const mw4B2 = new Battle({ groupId: group._id, matchweekId: mw4._id, player1Id: player2._id, player2Id: player3._id, outcome: 'Player1', player1Points: 3, player2Points: 0 });
    await mw4B1.save();
    await mw4B2.save();

    // ================== MATCHWEEK 5 (Completed) ==================
    pastDate.setDate(pastDate.getDate() + 3);
    const mw5 = new Matchweek({
      groupId: group._id, matchweekNumber: 5, status: 'completed', deadline: new Date(pastDate),
      matches: [
        { homeTeam: 'Liverpool', awayTeam: 'Chelsea', kickoffTime: pastDate },
        { homeTeam: 'Arsenal', awayTeam: 'Leicester', kickoffTime: pastDate }
      ]
    });
    await mw5.save();

    const mw5P1 = new Prediction({
      groupId: group._id, userId: player1._id, matchweekId: mw5._id, isSubmitted: true,
      predictions: [{ matchId: mw5.matches[0]._id, result: 'Home', homeScore: 2, awayScore: 1, safeBet: 'Home', firstGoal: 'Home', possession: 'Home' }],
      captainMatchId: mw5.matches[0]._id, totalPointsScored: 1100, battlePointsScored: 0
    });
    const mw5P2 = new Prediction({
      groupId: group._id, userId: player2._id, matchweekId: mw5._id, isSubmitted: true,
      predictions: [{ matchId: mw5.matches[0]._id, result: 'Draw', homeScore: 1, awayScore: 1, safeBet: 'Home', firstGoal: 'No goal', possession: 'Equal' }],
      captainMatchId: mw5.matches[0]._id, totalPointsScored: 750, battlePointsScored: 0
    });
    const mw5P3 = new Prediction({
      groupId: group._id, userId: player3._id, matchweekId: mw5._id, isSubmitted: true,
      predictions: [{ matchId: mw5.matches[0]._id, result: 'Home', homeScore: 3, awayScore: 0, safeBet: 'Home', firstGoal: 'Home', possession: 'Home' }],
      captainMatchId: mw5.matches[0]._id, totalPointsScored: 1400, battlePointsScored: 1
    });
    await mw5P1.save();
    await mw5P2.save();
    await mw5P3.save();

    const mw5B1 = new Battle({ groupId: group._id, matchweekId: mw5._id, player1Id: player1._id, player2Id: averagePlayer._id, outcome: 'Draw', player1Points: 1, player2Points: 1 });
    const mw5B2 = new Battle({ groupId: group._id, matchweekId: mw5._id, player1Id: player2._id, player2Id: player3._id, outcome: 'Draw', player1Points: 1, player2Points: 1 });
    await mw5B1.save();
    await mw5B2.save();

    // ================== MATCHWEEK 6 (Active for Play) ==================
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const mw6 = new Matchweek({
      groupId: group._id, matchweekNumber: 6, status: 'active', deadline: tomorrow,
      matches: [
        { homeTeam: 'Arsenal', awayTeam: 'Leicester', kickoffTime: tomorrow },
        { homeTeam: 'Chelsea', awayTeam: 'Brighton', kickoffTime: tomorrow },
        { homeTeam: 'Brentford', awayTeam: 'West Ham', kickoffTime: tomorrow },
        { homeTeam: 'Newcastle', awayTeam: 'Man City', kickoffTime: tomorrow },
        { homeTeam: 'Man Utd', awayTeam: 'Spurs', kickoffTime: tomorrow }
      ]
    });
    await mw6.save();
    mw6.battleMatchId = mw6.matches[4]._id;
    await mw6.save();

    const mw6B1 = new Battle({ groupId: group._id, matchweekId: mw6._id, player1Id: player1._id, player2Id: averagePlayer._id });
    const mw6B2 = new Battle({ groupId: group._id, matchweekId: mw6._id, player1Id: player2._id, player2Id: player3._id });
    await mw6B1.save();
    await mw6B2.save();

    console.log('Database seeded with 5 completed matchweeks (1-5) and 1 active matchweek (6).');
    mongoose.disconnect();
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seed();
