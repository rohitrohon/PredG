const express = require('express');
const router = express.Router();
const Matchweek = require('../models/Matchweek');
const Prediction = require('../models/Prediction');
const Group = require('../models/Group');
const { auth } = require('../middleware/auth');

const isGroupAdmin = (group, userId, userRole) => {
  if (!group) return false;
  if (userRole === 'admin') return true;
  const adminIdStr = group.adminId?._id ? group.adminId._id.toString() : group.adminId?.toString();
  return adminIdStr === userId;
};

const isMemberOrAdmin = (group, userId, userRole) => {
  if (!group) return false;
  if (userRole === 'admin') return true;
  const adminIdStr = group.adminId?._id ? group.adminId._id.toString() : group.adminId?.toString();
  if (adminIdStr === userId) return true;
  return group.members.some(id => (id._id || id).toString() === userId);
};

// Middleware to verify user is group admin
const verifyGroupAdmin = async (req, res, next) => {
  try {
    let groupId = req.body.groupId || req.query.groupId || req.params.groupId;
    
    // If groupId is not directly passed, check if req.params.id is a matchweek ID
    if (!groupId && req.params.id) {
      const mw = await Matchweek.findById(req.params.id);
      if (mw) {
        groupId = mw.groupId;
        req.matchweek = mw;
      }
    }

    if (!groupId) {
      return res.status(400).json({ message: 'groupId is required.' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    if (!isGroupAdmin(group, req.user.id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied. You are not the administrator of this group.' });
    }

    req.group = group;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Error checking permissions.', error: error.message });
  }
};

// @route   GET api/matchweek
// @desc    Get all matchweeks for a group
// @access  Private
router.get('/', auth, async (req, res) => {
  const { groupId } = req.query;

  try {
    if (!groupId) {
      return res.status(400).json({ message: 'groupId query parameter is required.' });
    }

    // Verify user belongs to or manages group
    const group = await Group.findById(groupId);
    if (!isMemberOrAdmin(group, req.user.id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied. You are not a member or admin of this group.' });
    }

    const matchweeks = await Matchweek.find({ groupId }).sort({ matchweekNumber: 1 });
    res.json(matchweeks);
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving matchweeks.', error: error.message });
  }
});

// @route   GET api/matchweek/active
// @desc    Get the current active matchweek for a group
// @access  Private
router.get('/active', auth, async (req, res) => {
  const { groupId } = req.query;

  try {
    if (!groupId) {
      return res.status(400).json({ message: 'groupId query parameter is required.' });
    }

    const group = await Group.findById(groupId);
    if (!isMemberOrAdmin(group, req.user.id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied. You are not a member or admin of this group.' });
    }

    let matchweek = await Matchweek.findOne({ groupId, status: 'active' });
    if (!matchweek) {
      // Fallback: If no active matchweek, find the latest draft or completed one
      matchweek = await Matchweek.findOne({ groupId }).sort({ matchweekNumber: -1 });
    }
    
    if (!matchweek) {
      return res.status(404).json({ message: 'No matchweeks found for this group.' });
    }

    res.json(matchweek);
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving active matchweek.', error: error.message });
  }
});

// @route   GET api/matchweek/:id
// @desc    Get a matchweek by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const matchweek = await Matchweek.findById(req.params.id);
    if (!matchweek) {
      return res.status(404).json({ message: 'Matchweek not found.' });
    }

    // Verify user belongs to or manages the matchweek's group
    const group = await Group.findById(matchweek.groupId);
    if (!isMemberOrAdmin(group, req.user.id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied. You are not a member or admin of this group.' });
    }

    res.json(matchweek);
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving matchweek.', error: error.message });
  }
});

const { parseISTToISO } = require('../utils/plFixturesFetcher');

// @route   POST api/matchweek
// @desc    Create a new matchweek for a group
// @access  Private/GroupAdmin
router.post('/', [auth, verifyGroupAdmin], async (req, res) => {
  const { groupId, matchweekNumber, deadline, matches, battleMatchId, battleMatchIndex } = req.body;

  try {
    if (!matchweekNumber || !deadline || !matches || !Array.isArray(matches) || matches.length === 0) {
      return res.status(400).json({ message: 'Please provide matchweek number, deadline, and matches.' });
    }

    // Check if matchweek number already exists in this group
    let existing = await Matchweek.findOne({ groupId, matchweekNumber });
    if (existing) {
      return res.status(400).json({ message: `Matchweek ${matchweekNumber} already exists in this group.` });
    }

    if (matches.length > 5) {
      return res.status(400).json({ message: 'A matchweek can have at most 5 selected games.' });
    }

    const isoDeadlineStr = parseISTToISO(deadline);
    const deadlineDate = new Date(isoDeadlineStr);
    if (isNaN(deadlineDate.getTime())) {
      return res.status(400).json({ message: 'Invalid deadline date format.' });
    }

    const formattedMatches = matches.map(m => ({
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      kickoffTime: new Date(parseISTToISO(m.kickoffTime))
    }));

    for (let m of formattedMatches) {
      if (isNaN(m.kickoffTime.getTime())) {
        return res.status(400).json({ message: `Invalid kickoff time for match ${m.homeTeam} vs ${m.awayTeam}` });
      }
    }

    const matchweek = new Matchweek({
      groupId,
      matchweekNumber,
      deadline: deadlineDate,
      matches: formattedMatches,
      battleMatchId
    });

    await matchweek.save();

    if (battleMatchIndex !== undefined && matchweek.matches[battleMatchIndex]) {
      matchweek.battleMatchId = matchweek.matches[battleMatchIndex]._id;
      await matchweek.save();
    }

    res.status(201).json(matchweek);
  } catch (error) {
    console.error('Error creating matchweek:', error);
    res.status(500).json({ message: error.message || 'Server error creating matchweek.' });
  }
});

// @route   PUT api/matchweek/:id
// @desc    Update matchweek details (Admin only - verified via body groupId)
// @access  Private/GroupAdmin
router.put('/:id', [auth, verifyGroupAdmin], async (req, res) => {
  const { matchweekNumber, deadline, matches, status, battleMatchId, battleMatchIndex } = req.body;

  try {
    let matchweek = await Matchweek.findById(req.params.id);
    if (!matchweek) {
      return res.status(404).json({ message: 'Matchweek not found.' });
    }

    if (matchweekNumber !== undefined) matchweek.matchweekNumber = matchweekNumber;
    if (deadline) matchweek.deadline = new Date(parseISTToISO(deadline));
    if (status) matchweek.status = status;
    if (matches) {
      matchweek.matches = matches.map(m => ({
        ...m,
        kickoffTime: new Date(parseISTToISO(m.kickoffTime))
      }));
    }

    await matchweek.save();

    if (battleMatchIndex !== undefined && matchweek.matches[battleMatchIndex]) {
      matchweek.battleMatchId = matchweek.matches[battleMatchIndex]._id;
      await matchweek.save();
    } else if (battleMatchId !== undefined) {
      matchweek.battleMatchId = battleMatchId;
      await matchweek.save();
    }

    res.json(matchweek);
  } catch (error) {
    res.status(500).json({ message: 'Server error updating matchweek.', error: error.message });
  }
});

// @route   POST api/matchweek/:id/set-active
// @desc    Set matchweek status to active, and set all others in group to draft
// @access  Private/GroupAdmin
router.post('/:id/set-active', [auth, verifyGroupAdmin], async (req, res) => {
  try {
    const matchweek = await Matchweek.findById(req.params.id);
    if (!matchweek) {
      return res.status(404).json({ message: 'Matchweek not found.' });
    }

    // Set other active matchweeks in the same group to draft
    await Matchweek.updateMany(
      { groupId: matchweek.groupId, _id: { $ne: matchweek._id }, status: 'active' },
      { status: 'draft' }
    );

    matchweek.status = 'active';
    await matchweek.save();

    res.json({ message: `Matchweek ${matchweek.matchweekNumber} is now active.`, matchweek });
  } catch (error) {
    res.status(500).json({ message: 'Server error setting active matchweek.', error: error.message });
  }
});

// @route   DELETE api/matchweek/:id
// @desc    Delete a matchweek
// @access  Private/GroupAdmin
router.delete('/:id', [auth, verifyGroupAdmin], async (req, res) => {
  try {
    const matchweek = await Matchweek.findById(req.params.id);
    if (!matchweek) {
      return res.status(404).json({ message: 'Matchweek not found.' });
    }

    await Matchweek.findByIdAndDelete(matchweek._id);
    // Delete predictions associated with this matchweek
    await Prediction.deleteMany({ matchweekId: matchweek._id });
    res.json({ message: 'Matchweek and associated predictions deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error deleting matchweek.', error: error.message });
  }
});

module.exports = router;
