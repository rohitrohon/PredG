require('dotenv').config();
const mongoose = require('mongoose');
const Group = require('./models/Group');
const Matchweek = require('./models/Matchweek');
const Prediction = require('./models/Prediction');
const GroupStanding = require('./models/GroupStanding');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/prediction_game';

async function test() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB.');

    const group = await Group.findOne({ name: 'Alpha League' });
    if (!group) {
      console.error('Group not found.');
      process.exit(1);
    }
    console.log('Group found:', group.name, 'ID:', group._id);
    console.log('Group members count:', group.members.length);
    console.log('Members:', group.members);

    const matchweeks = await Matchweek.find({ groupId: group._id, status: 'completed' })
      .sort({ matchweekNumber: 1 });
    console.log('Completed matchweeks found:', matchweeks.length);

    const matchweekIds = matchweeks.map(m => m._id);
    console.log('Matchweek IDs:', matchweekIds);

    const predictions = await Prediction.find({ 
      groupId: group._id, 
      matchweekId: { $in: matchweekIds },
      isSubmitted: true 
    }).populate('userId', 'username email role');
    console.log('Submitted predictions found:', predictions.length);
    if (predictions.length > 0) {
      console.log('First prediction user:', predictions[0].userId);
    }

    const standings = await GroupStanding.find({ groupId: group._id })
      .populate('userId', 'username email role')
      .sort({ totalPoints: -1 });
    console.log('Standings found:', standings.length);

    mongoose.disconnect();
  } catch (error) {
    console.error('Query failed:', error);
    process.exit(1);
  }
}

test();
