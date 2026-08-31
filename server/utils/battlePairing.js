const GroupStanding = require('../models/GroupStanding');
const Battle = require('../models/Battle');

const AVERAGE_PLAYER_ID = '600000000000000000000000';

const getUserIdStr = (idObj) => {
  if (!idObj) return '';
  return (idObj._id ? idObj._id : idObj).toString();
};

/**
 * Generates Battle pairings for a matchweek based on current group standings:
 * - Sorts standings by totalPoints desc (1st, 2nd, ..., Nth).
 * - Even participants (N is even): Pairs 1st vs Nth, 2nd vs (N-1)th, etc.
 * - Odd participants (N is odd): Pairs outer players (1st vs Nth, 2nd vs (N-1)th, etc.) 
 *   until 3 players are left in the middle. Put those middle 3 players into a Triad (3-way matchup)!
 */
async function generateBattlePairingsInternal(matchweek, group) {
  if (!matchweek || !group) return [];

  // Fetch current standings in group sorted by totalPoints desc
  const standings = await GroupStanding.find({ groupId: group._id })
    .populate('userId', 'username email role')
    .sort({ totalPoints: -1 });

  // Exclude dummy average player if present
  const activeStandings = standings.filter(s => {
    const uIdStr = getUserIdStr(s.userId);
    return uIdStr && uIdStr !== AVERAGE_PLAYER_ID;
  });

  if (activeStandings.length < 2) return [];

  // Delete old pairings for this matchweek
  await Battle.deleteMany({ groupId: group._id, matchweekId: matchweek._id });

  const n = activeStandings.length;
  const createdBattles = [];

  if (n % 2 === 0) {
    // EVEN NUMBER: Pair 1st vs Nth, 2nd vs (N-1)th, etc.
    const numPairs = n / 2;
    for (let i = 0; i < numPairs; i++) {
      const p1Id = getUserIdStr(activeStandings[i].userId);
      const p2Id = getUserIdStr(activeStandings[n - 1 - i].userId);
      const battle = new Battle({
        groupId: group._id,
        matchweekId: matchweek._id,
        isTriad: false,
        player1Id: p1Id,
        player2Id: p2Id
      });
      await battle.save();
      createdBattles.push(battle);
    }
  } else {
    // ODD NUMBER: Pair outer players, and put middle 3 into a Triad!
    const numPairs = (n - 3) / 2;
    for (let i = 0; i < numPairs; i++) {
      const p1Id = getUserIdStr(activeStandings[i].userId);
      const p2Id = getUserIdStr(activeStandings[n - 1 - i].userId);
      const battle = new Battle({
        groupId: group._id,
        matchweekId: matchweek._id,
        isTriad: false,
        player1Id: p1Id,
        player2Id: p2Id
      });
      await battle.save();
      createdBattles.push(battle);
    }

    // Middle 3 players form the Triad
    const t1Id = getUserIdStr(activeStandings[numPairs].userId);
    const t2Id = getUserIdStr(activeStandings[numPairs + 1].userId);
    const t3Id = getUserIdStr(activeStandings[numPairs + 2].userId);

    const triadBattle = new Battle({
      groupId: group._id,
      matchweekId: matchweek._id,
      isTriad: true,
      player1Id: t1Id,
      player2Id: t2Id,
      player3Id: t3Id
    });
    await triadBattle.save();
    createdBattles.push(triadBattle);
  }

  return createdBattles;
}

module.exports = {
  generateBattlePairingsInternal
};
