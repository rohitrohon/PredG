require('dotenv').config();
const mongoose = require('mongoose');
const Group = require('./models/Group');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/prediction_game';

async function testEndpoint() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('DB Connected.');

    const user = await User.findOne({ username: 'pred_star' });
    if (!user) {
      console.error('User pred_star not found.');
      process.exit(1);
    }
    console.log('User found:', user.username, 'ID:', user._id);

    const group = await Group.findOne({ name: 'Alpha League' });
    if (!group) {
      console.error('Group not found.');
      process.exit(1);
    }
    console.log('Group found:', group.name, 'ID:', group._id);

    // Verify membership using the exact logic in group.js route
    const isMember = group.members.some(id => id.toString() === user._id.toString());
    console.log('Is member check:', isMember);

    // Let's print out group.members and see if they match user._id
    console.log('Group members list:', group.members.map(id => id.toString()));
    console.log('User ID to match:', user._id.toString());

    mongoose.disconnect();
  } catch (error) {
    console.error('Endpoint test failed:', error);
    process.exit(1);
  }
}

testEndpoint();
