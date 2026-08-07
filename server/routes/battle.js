const express = require('express');
const router = express.Router();
const Battle = require('../models/Battle');
const Group = require('../models/Group');
const { auth } = require('../middleware/auth');

// @route   GET api/battle/:matchweekId
// @desc    Get all battles for a specific matchweek in a group
// @access  Private
router.get('/:matchweekId', auth, async (req, res) => {
  const { groupId } = req.query;

  try {
    if (!groupId) {
      return res.status(400).json({ message: 'groupId query parameter is required.' });
    }

    // Verify user is a member of the group
    const group = await Group.findById(groupId);
    if (!group || !group.members.some(id => id.toString() === req.user.id)) {
      return res.status(403).json({ message: 'Access denied. You are not a member of this group.' });
    }

    const battles = await Battle.find({ groupId, matchweekId: req.params.matchweekId })
      .populate('player1Id', 'username')
      .populate('player2Id', 'username');
      
    res.json(battles);
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving battles.', error: error.message });
  }
});

module.exports = router;
