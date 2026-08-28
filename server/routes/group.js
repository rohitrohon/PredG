const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const GroupStanding = require('../models/GroupStanding');
const User = require('../models/User');
const Matchweek = require('../models/Matchweek');
const Prediction = require('../models/Prediction');
const Battle = require('../models/Battle');
const { auth } = require('../middleware/auth');

// Helper to generate a unique 6-char uppercase alphanumeric code
async function generateUniqueCode() {
  let code = '';
  let isUnique = false;
  while (!isUnique) {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
    // Ensure it's exactly 6 characters (sometimes substring is shorter)
    if (code.length !== 6) continue;
    
    const existing = await Group.findOne({ code });
    if (!existing) {
      isUnique = true;
    }
  }
  return code;
}

// @route   POST api/group
// @desc    Create a new group (Admin only / Creator is admin)
// @access  Private
router.post('/', auth, async (req, res) => {
  const { name } = req.body;

  try {
    if (!name) {
      return res.status(400).json({ message: 'Please provide a group name.' });
    }

    const code = await generateUniqueCode();
    
    const group = new Group({
      name,
      code,
      adminId: req.user.id,
      members: [], // Admin is not a player member
      pendingJoins: [],
      pendingLeaves: []
    });

    await group.save();

    res.status(201).json({ group });
  } catch (error) {
    res.status(500).json({ message: 'Server error creating group.', error: error.message });
  }
});

// @route   GET api/group/my
// @desc    Get user's joined and pending groups
// @access  Private
router.get('/my', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const joined = await Group.find({ 
      $or: [{ members: userId }, { adminId: userId }] 
    }).populate('adminId', 'username name email');
    const pendingJoin = await Group.find({ pendingJoins: userId }).populate('adminId', 'username name email');
    const pendingLeave = await Group.find({ pendingLeaves: userId }).populate('adminId', 'username name email');

    res.json({ joined, pendingJoin, pendingLeave });
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving groups.', error: error.message });
  }
});

// @route   POST api/group/join
// @desc    Request to join a group by entering code
// @access  Private
router.post('/join', auth, async (req, res) => {
  const { code } = req.body;

  try {
    if (!code) {
      return res.status(400).json({ message: 'Please provide a group join code.' });
    }

    if (req.user.role === 'admin') {
      return res.status(400).json({ message: 'Administrators cannot join leagues as players.' });
    }

    const group = await Group.findOne({ code: code.toUpperCase() });
    if (!group) {
      return res.status(404).json({ message: 'Group not found with that code.' });
    }

    const userId = req.user.id;

    // Check if already a member or pending
    if (group.members.some(id => id.toString() === userId)) {
      return res.status(400).json({ message: 'You are already a member of this group.' });
    }
    if (group.pendingJoins.some(id => id.toString() === userId)) {
      return res.status(400).json({ message: 'You have a pending join request for this group.' });
    }

    // Add to pending joins
    group.pendingJoins.push(userId);
    await group.save();

    res.json({ message: 'Join request submitted. Awaiting admin approval.', group });
  } catch (error) {
    res.status(500).json({ message: 'Server error requesting to join group.', error: error.message });
  }
});

// @route   POST api/group/:id/approve-join
// @desc    Approve user's join request (Admin only)
// @access  Private
router.post('/:id/approve-join', auth, async (req, res) => {
  const { userId } = req.body;

  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    // Check if requester is the admin of the group
    if (group.adminId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. Only group administrators can approve requests.' });
    }

    // Check if user is in pending joins
    if (!group.pendingJoins.some(id => id.toString() === userId)) {
      return res.status(400).json({ message: 'User does not have a pending join request.' });
    }

    // Move from pendingJoins to members
    group.pendingJoins = group.pendingJoins.filter(id => id.toString() !== userId);
    if (!group.members.some(id => id.toString() === userId)) {
      group.members.push(userId);
    }
    await group.save();

    // Create GroupStanding for user
    const existingStanding = await GroupStanding.findOne({ groupId: group._id, userId });
    if (!existingStanding) {
      // Calculate current ranks size to assign a rank
      const standingsCount = await GroupStanding.countDocuments({ groupId: group._id });
      const standing = new GroupStanding({
        groupId: group._id,
        userId,
        totalPoints: 0,
        battlePoints: 0,
        rank: standingsCount + 1
      });
      await standing.save();
    }

    res.json({ message: 'User approved and added to group successfully.', group });
  } catch (error) {
    res.status(500).json({ message: 'Server error approving join request.', error: error.message });
  }
});

// @route   POST api/group/:id/reject-join
// @desc    Reject user's join request (Admin only)
// @access  Private
router.post('/:id/reject-join', auth, async (req, res) => {
  const { userId } = req.body;

  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    if (group.adminId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. Only group administrators can reject join requests.' });
    }

    group.pendingJoins = group.pendingJoins.filter(id => id.toString() !== userId);
    await group.save();

    res.json({ message: 'User join request rejected.', group });
  } catch (error) {
    res.status(500).json({ message: 'Server error rejecting join request.', error: error.message });
  }
});

// @route   POST api/group/:id/request-leave
// @desc    Submit request to leave group (Users cannot leave directly)
// @access  Private
router.post('/:id/request-leave', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    const userId = req.user.id;

    // Check if user is a member
    if (!group.members.some(id => id.toString() === userId)) {
      return res.status(400).json({ message: 'You are not a member of this group.' });
    }

    // Admins cannot leave their own group (must transfer ownership or delete group)
    if (group.adminId.toString() === userId) {
      return res.status(400).json({ message: 'Group administrators cannot leave. You must delete the group or transfer admin first.' });
    }

    if (group.pendingLeaves.includes(userId)) {
      return res.status(400).json({ message: 'You already have a pending leave request.' });
    }

    // Add to pending leaves
    group.pendingLeaves.push(userId);
    await group.save();

    res.json({ message: 'Leave request submitted. Awaiting admin approval.', group });
  } catch (error) {
    res.status(500).json({ message: 'Server error requesting to leave group.', error: error.message });
  }
});

// @route   POST api/group/:id/approve-leave
// @desc    Approve user's request to leave (Admin only)
// @access  Private
router.post('/:id/approve-leave', auth, async (req, res) => {
  const { userId } = req.body;

  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    // Check admin permissions
    if (group.adminId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. Only group administrators can approve leave requests.' });
    }

    // Check if user has a pending leave request
    if (!group.pendingLeaves.includes(userId)) {
      return res.status(400).json({ message: 'User does not have a pending leave request.' });
    }

    // Remove from pending leaves and members
    group.pendingLeaves = group.pendingLeaves.filter(id => id.toString() !== userId);
    group.members = group.members.filter(id => id.toString() !== userId);
    await group.save();

    // Delete user standings for this group
    await GroupStanding.deleteOne({ groupId: group._id, userId });

    res.json({ message: 'User leave request approved. User removed from group.', group });
  } catch (error) {
    res.status(500).json({ message: 'Server error approving leave request.', error: error.message });
  }
});

// @route   POST api/group/:id/reject-leave
// @desc    Reject user's leave request (Admin only)
// @access  Private
router.post('/:id/reject-leave', auth, async (req, res) => {
  const { userId } = req.body;

  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    if (group.adminId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. Only group administrators can reject leave requests.' });
    }

    group.pendingLeaves = group.pendingLeaves.filter(id => id.toString() !== userId);
    await group.save();

    res.json({ message: 'User leave request rejected.', group });
  } catch (error) {
    res.status(500).json({ message: 'Server error rejecting leave request.', error: error.message });
  }
});

// @route   POST api/group/:id/remove-member
// @desc    Remove a player from group directly without a leave request (Admin only)
// @access  Private
router.post('/:id/remove-member', auth, async (req, res) => {
  const { userId } = req.body;

  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    if (group.adminId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. Only group administrators can remove members.' });
    }

    if (group.adminId.toString() === userId) {
      return res.status(400).json({ message: 'Cannot remove group administrator from group.' });
    }

    group.members = group.members.filter(id => id.toString() !== userId);
    group.pendingLeaves = group.pendingLeaves.filter(id => id.toString() !== userId);
    group.pendingJoins = group.pendingJoins.filter(id => id.toString() !== userId);
    await group.save();

    await GroupStanding.deleteOne({ groupId: group._id, userId });

    res.json({ message: 'Player removed from group successfully.', group });
  } catch (error) {
    res.status(500).json({ message: 'Server error removing member from group.', error: error.message });
  }
});

const isMemberOrAdminUser = (group, userId, userRole) => {
  if (!group) return false;
  if (userRole === 'admin') return true;
  const adminIdStr = group.adminId?._id ? group.adminId._id.toString() : group.adminId?.toString();
  return group.members.some(id => (id._id || id).toString() === userId) || adminIdStr === userId;
};

// @route   GET api/group/:id/members
// @desc    Get members and pending requests for group
// @access  Private
router.get('/:id/members', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('members', 'username name email')
      .populate('pendingJoins', 'username name email')
      .populate('pendingLeaves', 'username name email')
      .populate('adminId', 'username name email');

    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    // Verify requesting user is member or admin of the group
    if (!isMemberOrAdminUser(group, req.user.id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied. You are not a member of this group.' });
    }

    res.json(group);
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving group members.', error: error.message });
  }
});

// @route   GET api/group/:id/standings
// @desc    Get group standings sorted by points desc (players only)
// @access  Private
router.get('/:id/standings', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    if (!isMemberOrAdminUser(group, req.user.id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied. You are not a member of this group.' });
    }

    // Auto-sync standings totals from exact sum of prediction records to eliminate double-counting
    const existingStandings = await GroupStanding.find({ groupId: group._id });
    for (const std of existingStandings) {
      if (!std.userId || std.userId.toString() === '600000000000000000000000') continue;
      const userPreds = await Prediction.find({ groupId: group._id, userId: std.userId });
      const sumTotal = userPreds.reduce((sum, p) => sum + (p.totalPointsScored || 0), 0);
      const sumBattle = userPreds.reduce((sum, p) => sum + (p.battlePointsScored || 0), 0);

      std.totalPoints = sumTotal;
      std.battlePoints = sumBattle;
      await std.save();
    }

    const standings = await GroupStanding.find({ groupId: group._id })
      .populate('userId', 'username name email role')
      .sort({ totalPoints: -1 });

    for (let idx = 0; idx < standings.length; idx++) {
      standings[idx].rank = idx + 1;
      await standings[idx].save();
    }

    const playerStandings = standings.filter(s => s.userId && s.userId.role !== 'admin');

    res.json(playerStandings);
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving group standings.', error: error.message });
  }
});

// @route   GET api/group/:id/results-dashboard
// @desc    Get all completed matchweeks, predictions, and standings for charts/stats
// @access  Private
router.get('/:id/results-dashboard', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    if (!isMemberOrAdminUser(group, req.user.id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied. You are not a member of this group.' });
    }

    const matchweeks = await Matchweek.find({ groupId: group._id, status: 'completed' })
      .sort({ matchweekNumber: 1 });

    const matchweekIds = matchweeks.map(m => m._id);

    const predictions = await Prediction.find({ 
      groupId: group._id, 
      matchweekId: { $in: matchweekIds },
      isSubmitted: true 
    }).populate('userId', 'username name email role');

    const standings = await GroupStanding.find({ groupId: group._id })
      .populate('userId', 'username name email role')
      .sort({ totalPoints: -1 });

    const playerStandings = standings.filter(s => s.userId && s.userId.role !== 'admin');

    const battles = await Battle.find({
      groupId: group._id,
      matchweekId: { $in: matchweekIds }
    }).populate('player1Id', 'username name').populate('player2Id', 'username name');

    res.json({ matchweeks, predictions, standings: playerStandings, battles });
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving results dashboard.', error: error.message });
  }
});

// @route   DELETE api/group/:id
// @desc    Delete a group and all its related matchweeks, predictions, standings, and battles (Admin only)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    const adminIdStr = group.adminId?._id ? group.adminId._id.toString() : group.adminId?.toString();
    if (adminIdStr !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Only group administrators can delete this group.' });
    }

    // Clean up all related documents for this group
    await Matchweek.deleteMany({ groupId: group._id });
    await Prediction.deleteMany({ groupId: group._id });
    await GroupStanding.deleteMany({ groupId: group._id });
    await Battle.deleteMany({ groupId: group._id });
    await Group.deleteOne({ _id: group._id });

    res.json({ message: `Group "${group.name}" deleted successfully.` });
  } catch (error) {
    res.status(500).json({ message: 'Server error deleting group.', error: error.message });
  }
});

// @route   PUT api/group/:id
// @desc    Update group name (Admin only)
// @access  Private
router.put('/:id', auth, async (req, res) => {
  const { name } = req.body;

  try {
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Please provide a valid group name.' });
    }

    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    const adminIdStr = group.adminId?._id ? group.adminId._id.toString() : group.adminId?.toString();
    if (adminIdStr !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Only group administrators can update group details.' });
    }

    group.name = name.trim();
    await group.save();

    res.json({ message: 'Group name updated successfully!', group });
  } catch (error) {
    res.status(500).json({ message: 'Server error updating group name.', error: error.message });
  }
});

module.exports = router;
