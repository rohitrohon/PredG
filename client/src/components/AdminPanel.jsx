import React, { useEffect, useState } from 'react';
import api from '../api';
import { 
  Shield, Plus, List, Trophy, Sword, Trash, Play, AlertTriangle, 
  UserCheck, UserX, Users, Edit3, Settings, Save, X, UserMinus, 
  PlusCircle, RefreshCw, Eye, CheckCircle2, ChevronRight, Award, Calendar, RotateCcw
} from 'lucide-react';

function getShortTeamName(teamName) {
  if (!teamName || typeof teamName !== 'string') return '';
  const words = teamName.trim().split(/\s+/);
  if (words.length >= 2) {
    const w1 = words[0];
    const w2 = words[1];
    if (w1.length >= 1 && w2.length >= 2) {
      return (w1[0] + w2.slice(0, 2)).toUpperCase();
    }
  }
  return teamName.trim().slice(0, 3).toUpperCase();
}

function renderChoiceAbbreviation(choice, homeTeam, awayTeam) {
  if (!choice) return '-';
  if (choice === 'Home') return getShortTeamName(homeTeam);
  if (choice === 'Away') return getShortTeamName(awayTeam);
  if (choice === 'Draw') return 'DRAW';
  if (choice === 'Equal') return 'EQUAL';
  if (choice === 'No goal') return 'NO GOAL';
  if (homeTeam && choice.toLowerCase() === homeTeam.toLowerCase()) return getShortTeamName(homeTeam);
  if (awayTeam && choice.toLowerCase() === awayTeam.toLowerCase()) return getShortTeamName(awayTeam);
  return getShortTeamName(choice);
}

function getMatchWinnerChoice(actualResults, homeTeam, awayTeam) {
  if (!actualResults) return null;
  if (actualResults.result === 'Home' || actualResults.result === 'Away' || actualResults.result === 'Draw') {
    return actualResults.result;
  }
  const h = Number(actualResults.homeScore);
  const a = Number(actualResults.awayScore);
  if (isNaN(h) || isNaN(a)) return null;
  if (h > a) return 'Home';
  if (a > h) return 'Away';
  return 'Draw';
}

function AdminPanel({ groupId }) {
  const [matchweeks, setMatchweeks] = useState([]);
  const [groupDetails, setGroupDetails] = useState({ members: [], pendingJoins: [], pendingLeaves: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Currently selected matchweek for results/grading
  const [selectedMw, setSelectedMw] = useState(null);
  const [fetchingApiResults, setFetchingApiResults] = useState(false);

  // Group Settings State
  const [groupNameInput, setGroupNameInput] = useState('');
  const [updatingGroupName, setUpdatingGroupName] = useState(false);

  // Tabs: 'list', 'create', 'roster', 'overrides'
  const [adminTab, setAdminTab] = useState('list');

  // Create matchweek form state
  const [newMwNum, setNewMwNum] = useState('');
  const [newMwDeadline, setNewMwDeadline] = useState('');
  const [isManualDeadline, setIsManualDeadline] = useState(false);
  const [newMwBattleIndex, setNewMwBattleIndex] = useState(0);
  const [newMwMatches, setNewMwMatches] = useState(
    Array.from({ length: 5 }, () => ({ homeTeam: '', awayTeam: '', kickoffTime: '' }))
  );

  // Premier League official fixtures fetcher state
  const [fetchedPlFixtures, setFetchedPlFixtures] = useState([]);
  const [selectedPlIndices, setSelectedPlIndices] = useState([]);
  const [fetchingPl, setFetchingPl] = useState(false);

  const handleFetchPLFixtures = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newMwNum) {
      setError('Please enter a matchweek number first.');
      return;
    }
    try {
      setFetchingPl(true);
      setError('');
      setSuccess('');
      const data = await api.fetchPLFixtures(newMwNum);
      const fixturesList = data.fixtures || [];
      setFetchedPlFixtures(fixturesList);
      setSelectedPlIndices([]);
      if (fixturesList.length === 0) {
        setError(`No official fixtures found for Matchweek #${newMwNum}.`);
      } else {
        setSuccess(`Successfully fetched ${fixturesList.length} PL fixtures for Matchweek #${newMwNum}! Select 5 matches below.`);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch PL fixtures.');
    } finally {
      setFetchingPl(false);
    }
  };

  const handleTogglePlMatch = (index) => {
    let updated;
    if (selectedPlIndices.includes(index)) {
      updated = selectedPlIndices.filter(i => i !== index);
    } else {
      if (selectedPlIndices.length >= 5) {
        setError('You can select a maximum of 5 matches for the matchweek.');
        return;
      }
      updated = [...selectedPlIndices, index];
    }
    setSelectedPlIndices(updated);

    const selectedFixtures = updated.map(i => fetchedPlFixtures[i]);
    const newMatches = Array.from({ length: 5 }, (_, idx) => {
      if (idx < selectedFixtures.length) {
        return {
          homeTeam: selectedFixtures[idx].homeTeam,
          awayTeam: selectedFixtures[idx].awayTeam,
          kickoffTime: selectedFixtures[idx].kickoffTime
        };
      }
      return { homeTeam: '', awayTeam: '', kickoffTime: '' };
    });

    setNewMwMatches(newMatches);

    const validKickoffs = selectedFixtures.map(f => f.kickoffTime).filter(Boolean);
    if (validKickoffs.length > 0) {
      validKickoffs.sort();
      setNewMwDeadline(validKickoffs[0]);
    }
  };

  // Edit matchweek modal state
  const [editingMw, setEditingMw] = useState(null);
  const [editMwForm, setEditMwForm] = useState(null);

  // Quick Glance modal state
  const [viewDetailsMw, setViewDetailsMw] = useState(null);

  // Results inputs state
  const [resultsInput, setResultsInput] = useState({});

  // Overrides State
  const [overrideMwId, setOverrideMwId] = useState('');
  const [mwPredictions, setMwPredictions] = useState([]);
  const [selectedPred, setSelectedPred] = useState(null);
  const [editPredData, setEditPredData] = useState(null);
  const [overrideScoresInput, setOverrideScoresInput] = useState({ totalPointsScored: 0, battlePointsScored: 0 });

  // Battle Overrides State
  const [mwBattles, setMwBattles] = useState([]);
  const [selectedBattle, setSelectedBattle] = useState(null);
  const [editBattleData, setEditBattleData] = useState(null);

  // PL Database Cache State
  const [plStandingsRecord, setPlStandingsRecord] = useState(null);
  const [refreshingPlStandings, setRefreshingPlStandings] = useState(false);
  const [plFixturesMw, setPlFixturesMw] = useState(1);
  const [plFixturesRecord, setPlFixturesRecord] = useState(null);
  const [refreshingPlFixtures, setRefreshingPlFixtures] = useState(false);

  // Refresh State for Roster & Overrides
  const [refreshingRoster, setRefreshingRoster] = useState(false);
  const [refreshingOverrides, setRefreshingOverrides] = useState(false);

  const handleRefreshRoster = async () => {
    try {
      setRefreshingRoster(true);
      setError('');
      setSuccess('');
      const roster = await api.getGroupMembers(groupId);
      setGroupDetails(roster);
      setSuccess('Group roster and pending requests refreshed successfully!');
    } catch (err) {
      setError(err.message || 'Failed to refresh group roster.');
    } finally {
      setRefreshingRoster(false);
    }
  };

  const [generatingPairings, setGeneratingPairings] = useState(false);

  const handleGeneratePairingsInRoster = async () => {
    const activeMw = matchweeks.find(m => m.status === 'active') || matchweeks[matchweeks.length - 1];
    if (!activeMw) {
      setError('No active matchweek found to generate battle pairings for.');
      return;
    }
    try {
      setGeneratingPairings(true);
      setError('');
      setSuccess('');
      const res = await api.pairBattles(activeMw._id);
      setSuccess(res.message || `Battle pairings & triads generated for Matchweek #${activeMw.matchweekNumber}!`);
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to generate battle pairings.');
    } finally {
      setGeneratingPairings(false);
    }
  };

  const handleRefreshOverrides = async () => {
    try {
      setRefreshingOverrides(true);
      setError('');
      setSuccess('');
      await fetchData();
      if (overrideMwId) {
        await fetchMwPredictionsAndBattles(overrideMwId);
      }
      setSuccess('Predictions and manual overrides data refreshed successfully!');
    } catch (err) {
      setError(err.message || 'Failed to refresh override data.');
    } finally {
      setRefreshingOverrides(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [groupId]);

  useEffect(() => {
    if (adminTab === 'pl-standings') {
      fetchPLStandingsDB();
    } else if (adminTab === 'pl-fixtures') {
      fetchPLFixturesDB(plFixturesMw);
    }
  }, [adminTab, plFixturesMw]);

  const fetchPLStandingsDB = async () => {
    try {
      const record = await api.getPLStandingsDB();
      setPlStandingsRecord(record);
    } catch (err) {
      console.error('Error loading DB PL standings:', err);
    }
  };

  const handleRefreshPLStandingsDB = async () => {
    try {
      setRefreshingPlStandings(true);
      setError('');
      setSuccess('');
      const res = await api.refreshPLStandingsDB();
      setPlStandingsRecord(res.record);
      setSuccess('Premier League standings updated in DB successfully!');
    } catch (err) {
      setError(err.message || 'Failed to refresh PL standings.');
    } finally {
      setRefreshingPlStandings(false);
    }
  };

  const fetchPLFixturesDB = async (mwNum) => {
    try {
      const record = await api.getPLFixturesDB(mwNum);
      setPlFixturesRecord(record);
    } catch (err) {
      console.error('Error loading DB PL fixtures:', err);
    }
  };

  const handleRefreshPLFixturesDB = async (mwNum) => {
    try {
      setRefreshingPlFixtures(true);
      setError('');
      setSuccess('');
      const res = await api.refreshPLFixturesDB(mwNum || plFixturesMw);
      setPlFixturesRecord(res.record);
      setSuccess(`Matchweek #${mwNum || plFixturesMw} PL fixtures updated in DB successfully!`);
    } catch (err) {
      setError(err.message || 'Failed to refresh PL fixtures.');
    } finally {
      setRefreshingPlFixtures(false);
    }
  };

  useEffect(() => {
    if (overrideMwId) {
      fetchMwPredictionsAndBattles(overrideMwId);
    }
  }, [overrideMwId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const mws = await api.getMatchweeks(groupId);
      setMatchweeks(mws);

      const roster = await api.getGroupMembers(groupId);
      setGroupDetails(roster);
      if (roster && roster.name) {
        setGroupNameInput(roster.name);
      }

      if (mws.length > 0 && !overrideMwId) {
        setOverrideMwId(mws[0]._id);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch admin console data.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGroupName = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!groupNameInput || !groupNameInput.trim()) {
      setError('Please enter a valid group name.');
      return;
    }
    try {
      setUpdatingGroupName(true);
      setError('');
      setSuccess('');
      await api.updateGroupName(groupId, groupNameInput.trim());
      setSuccess(`Group name updated to "${groupNameInput.trim()}" successfully!`);
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to update group name.');
    } finally {
      setUpdatingGroupName(false);
    }
  };

  const fetchMwPredictionsAndBattles = async (mwId) => {
    try {
      const preds = await api.getAdminPredictions(mwId);
      setMwPredictions(preds);

      const bList = await api.getBattles(mwId, groupId);
      setMwBattles(bList);
    } catch (err) {
      console.error('Failed to load predictions/battles for override:', err);
    }
  };



  // --- 2. MATCHWEEK FIXTURES BUILDER (AUTO DEADLINE FROM KICKOFF TIMES) ---
  const handleMatchFormChange = (index, field, value) => {
    const updatedMatches = newMwMatches.map((m, idx) => {
      if (idx === index) {
        return { ...m, [field]: value };
      }
      return m;
    });
    setNewMwMatches(updatedMatches);

    // Auto-calculate deadline based on earliest kickoff time if not manually overridden
    if (field === 'kickoffTime' && !isManualDeadline) {
      const validTimes = updatedMatches.map(m => m.kickoffTime).filter(Boolean);
      if (validTimes.length > 0) {
        validTimes.sort();
        setNewMwDeadline(validTimes[0]);
      }
    }
  };

  const handleCreateMatchweek = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newMwNum || !newMwDeadline) {
      setError('Please fill in matchweek number and deadline.');
      return;
    }

    const invalidMatch = newMwMatches.find(m => !m.homeTeam || !m.awayTeam || !m.kickoffTime);
    if (invalidMatch) {
      setError('Please fill in home, away, and kickoff times for all 5 matches.');
      return;
    }

    try {
      setLoading(true);
      await api.createMatchweek({
        groupId,
        matchweekNumber: parseInt(newMwNum),
        deadline: newMwDeadline,
        matches: newMwMatches,
        battleMatchIndex: newMwBattleIndex
      });

      setSuccess(`Matchweek #${newMwNum} fixtures created successfully!`);
      setNewMwNum('');
      setNewMwDeadline('');
      setIsManualDeadline(false);
      setNewMwBattleIndex(0);
      setNewMwMatches(
        Array.from({ length: 5 }, () => ({ homeTeam: '', awayTeam: '', kickoffTime: '' }))
      );
      setAdminTab('list');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to create matchweek.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditMw = (mw) => {
    setEditingMw(mw);
    let bIndex = 0;
    if (mw.battleMatchId) {
      const idx = mw.matches.findIndex(m => m._id.toString() === mw.battleMatchId.toString());
      if (idx !== -1) bIndex = idx;
    }
    setEditMwForm({
      matchweekNumber: mw.matchweekNumber,
      deadline: mw.deadline ? new Date(mw.deadline).toISOString().slice(0, 16) : '',
      battleMatchIndex: bIndex,
      matches: mw.matches.map(m => ({
        _id: m._id,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        kickoffTime: m.kickoffTime ? new Date(m.kickoffTime).toISOString().slice(0, 16) : ''
      }))
    });
  };

  const handleSaveMwEdit = async () => {
    if (!editingMw || !editMwForm) return;
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      await api.updateMatchweek(editingMw._id, {
        groupId,
        matchweekNumber: parseInt(editMwForm.matchweekNumber),
        deadline: editMwForm.deadline,
        matches: editMwForm.matches,
        battleMatchIndex: editMwForm.battleMatchIndex
      });

      setSuccess(`Matchweek #${editMwForm.matchweekNumber} updated successfully!`);
      setEditingMw(null);
      setEditMwForm(null);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to update matchweek.');
    } finally {
      setLoading(false);
    }
  };

  // --- 3. ROSTER / MEMBERS MANAGEMENT (JOIN, LEAVE, REMOVE) ---
  const handleApproveJoin = async (userId) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await api.approveJoinRequest(groupId, userId);
      setSuccess('Player join request approved!');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to approve player.');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectJoin = async (userId) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await api.rejectJoinRequest(groupId, userId);
      setSuccess('Player join request rejected.');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to reject join request.');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveLeave = async (userId) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await api.approveLeaveRequest(groupId, userId);
      setSuccess('Player leave request approved.');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to approve leave request.');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectLeave = async (userId) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await api.rejectLeaveRequest(groupId, userId);
      setSuccess('Player leave request rejected.');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to reject leave request.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to remove "${username}" from the group?`)) return;
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await api.removeGroupMember(groupId, userId);
      setSuccess(`Player "${username}" removed from group.`);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to remove member.');
    } finally {
      setLoading(false);
    }
  };

  // --- 4. MATCH RESULTS ENTRY & GRADING ---
  const handleSelectMwForScoring = (mw) => {
    setSelectedMw(mw);
    setError('');
    setSuccess('');

    const initialResults = {};
    mw.matches.forEach((m) => {
      initialResults[m._id] = {
        homeScore: m.actualResults.homeScore !== null ? m.actualResults.homeScore : 0,
        awayScore: m.actualResults.awayScore !== null ? m.actualResults.awayScore : 0,
        result: m.actualResults.result || 'Home',
        firstGoal: m.actualResults.firstGoal || 'Home',
        possession: m.actualResults.possession || 'Home',
        yellowCards: m.actualResults.yellowCards !== null && m.actualResults.yellowCards !== undefined ? m.actualResults.yellowCards : 0,
        offsides: m.actualResults.offsides !== null && m.actualResults.offsides !== undefined ? m.actualResults.offsides : 0,
        corners: m.actualResults.corners !== null && m.actualResults.corners !== undefined ? m.actualResults.corners : 0,
        shots: m.actualResults.shots !== null && m.actualResults.shots !== undefined ? m.actualResults.shots : 0,
        wildPredictionCorrectUsers: m.actualResults.wildPredictionCorrectUsers || []
      };
    });
    setResultsInput(initialResults);
  };

  const handleResultChange = (matchId, field, value) => {
    const updatedMatch = {
      ...resultsInput[matchId],
      [field]: value
    };

    if (field === 'homeScore' || field === 'awayScore') {
      const h = field === 'homeScore' ? Number(value) : Number(updatedMatch.homeScore);
      const a = field === 'awayScore' ? Number(value) : Number(updatedMatch.awayScore);
      if (!isNaN(h) && !isNaN(a)) {
        if (h > a) updatedMatch.result = 'Home';
        else if (a > h) updatedMatch.result = 'Away';
        else updatedMatch.result = 'Draw';
      }
    }

    setResultsInput({
      ...resultsInput,
      [matchId]: updatedMatch
    });
  };

  const handleWildUserToggle = (matchId, userId) => {
    const currentList = resultsInput[matchId].wildPredictionCorrectUsers || [];
    let newList;
    if (currentList.includes(userId)) {
      newList = currentList.filter(id => id !== userId);
    } else {
      newList = [...currentList, userId];
    }
    handleResultChange(matchId, 'wildPredictionCorrectUsers', newList);
  };

  const handleUpdateResults = async () => {
    if (!selectedMw) return;
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // 1. Save match results
      await api.updateResults(selectedMw._id, {
        matchesResults: resultsInput
      });

      // 2. Automatically calculate scores for updated matches so far
      await api.calculateScores(selectedMw._id);

      setSuccess('Match results updated! Points calculated and updated in Home & Standings.');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to update match results.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteMatchweek = async () => {
    if (!selectedMw) return;
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // 1. Save match results
      await api.updateResults(selectedMw._id, {
        matchesResults: resultsInput
      });

      // 2. Calculate scores & battles
      await api.calculateScores(selectedMw._id);

      // 3. Update status to completed
      await api.updateMatchweek(selectedMw._id, {
        groupId,
        status: 'completed'
      });

      setSuccess(`Matchweek #${selectedMw.matchweekNumber} Completed! Results are now available in the Results section.`);
      setSelectedMw(null);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to complete matchweek.');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchResultsViaAPI = async () => {
    if (!selectedMw) return;
    try {
      setFetchingApiResults(true);
      setError('');
      setSuccess('');
      const res = await api.fetchMatchweekResultsAPI(selectedMw._id);
      setSelectedMw(res.matchweek);

      const updatedInputs = {};
      res.matchweek.matches.forEach((m) => {
        updatedInputs[m._id] = {
          homeScore: m.actualResults?.homeScore !== null && m.actualResults?.homeScore !== undefined ? m.actualResults.homeScore : 0,
          awayScore: m.actualResults?.awayScore !== null && m.actualResults?.awayScore !== undefined ? m.actualResults.awayScore : 0,
          result: m.actualResults?.result || 'Home',
          firstGoal: m.actualResults?.firstGoal || 'Home',
          possession: m.actualResults?.possession || 'Home',
          yellowCards: m.actualResults?.yellowCards !== null && m.actualResults?.yellowCards !== undefined ? m.actualResults.yellowCards : 0,
          offsides: m.actualResults?.offsides !== null && m.actualResults?.offsides !== undefined ? m.actualResults.offsides : 0,
          corners: m.actualResults?.corners !== null && m.actualResults?.corners !== undefined ? m.actualResults.corners : 0,
          shots: m.actualResults?.shots !== null && m.actualResults?.shots !== undefined ? m.actualResults.shots : 0,
          wildPredictionCorrectUsers: m.actualResults?.wildPredictionCorrectUsers || []
        };
      });
      setResultsInput(updatedInputs);
      setSuccess(res.message || 'Official match results fetched via API successfully!');
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to fetch match results via API.');
    } finally {
      setFetchingApiResults(false);
    }
  };

  useEffect(() => {
    if (!selectedMw?._id) return;

    // Auto-fetch API live match results every 5 minutes while viewing selectedMw in Admin Panel
    const interval = setInterval(() => {
      api.fetchMatchweekResultsAPI(selectedMw._id)
        .then(res => {
          if (res && res.matchweek) {
            setSelectedMw(res.matchweek);
            const updatedInputs = {};
            res.matchweek.matches.forEach((m) => {
              updatedInputs[m._id] = {
                homeScore: m.actualResults?.homeScore !== null && m.actualResults?.homeScore !== undefined ? m.actualResults.homeScore : 0,
                awayScore: m.actualResults?.awayScore !== null && m.actualResults?.awayScore !== undefined ? m.actualResults.awayScore : 0,
                result: m.actualResults?.result || 'Home',
                firstGoal: m.actualResults?.firstGoal || 'Home',
                possession: m.actualResults?.possession || 'Home',
                yellowCards: m.actualResults?.yellowCards !== null && m.actualResults?.yellowCards !== undefined ? m.actualResults.yellowCards : 0,
                offsides: m.actualResults?.offsides !== null && m.actualResults?.offsides !== undefined ? m.actualResults.offsides : 0,
                corners: m.actualResults?.corners !== null && m.actualResults?.corners !== undefined ? m.actualResults.corners : 0,
                shots: m.actualResults?.shots !== null && m.actualResults?.shots !== undefined ? m.actualResults.shots : 0,
                wildPredictionCorrectUsers: m.actualResults?.wildPredictionCorrectUsers || []
              };
            });
            setResultsInput(updatedInputs);
          }
        })
        .catch(err => console.error('Auto API fetch error in Admin Panel:', err));
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [selectedMw?._id]);

  const handleResetResultsToNull = async () => {
    if (!selectedMw) return;
    if (!window.confirm(`Are you sure you want to reset all 5 match results to NULL for Matchweek #${selectedMw.matchweekNumber}? This will clear all recorded actual scores, outcomes, and stats.`)) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const res = await api.resetMatchweekResults(selectedMw._id);
      setSelectedMw(res.matchweek);

      const nullInputs = {};
      res.matchweek.matches.forEach((m) => {
        nullInputs[m._id] = {
          homeScore: '',
          awayScore: '',
          result: 'Home',
          firstGoal: 'Home',
          possession: 'Home',
          yellowCards: '',
          offsides: '',
          corners: '',
          shots: '',
          wildPredictionCorrectUsers: []
        };
      });
      setResultsInput(nullInputs);
      setSuccess(res.message || 'All match results reset to null successfully.');
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to reset match results.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetActive = async (id) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await api.setActiveMatchweek(id, groupId);
      setSuccess('Active matchweek updated.');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to set active.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this matchweek? All predictions for this week will be lost.')) return;
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await api.deleteMatchweek(id, groupId);
      setSuccess('Matchweek deleted.');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to delete matchweek.');
    } finally {
      setLoading(false);
    }
  };

  // --- 5. PREDICTION EDITING & MANUAL OVERRIDES ---
  const handleSelectPredForEdit = (pred) => {
    setSelectedPred(pred);
    setEditPredData(JSON.parse(JSON.stringify(pred)));
    setOverrideScoresInput({
      totalPointsScored: pred.totalPointsScored || 0,
      battlePointsScored: pred.battlePointsScored || 0
    });
  };

  const handleSavePredEdit = async () => {
    if (!selectedPred || !editPredData) return;
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await api.updateAdminPrediction(selectedPred._id, {
        predictions: editPredData.predictions,
        captainMatchId: editPredData.captainMatchId,
        gamble: editPredData.gamble,
        marketPowerUps: editPredData.marketPowerUps,
        isSubmitted: editPredData.isSubmitted
      });
      setSuccess(`Prediction for ${selectedPred.userId?.name || selectedPred.userId?.username} updated!`);
      setSelectedPred(null);
      fetchMwPredictionsAndBattles(overrideMwId);
    } catch (err) {
      setError(err.message || 'Failed to update prediction.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveScoreOverride = async () => {
    if (!selectedPred) return;
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await api.overridePredictionScores(selectedPred._id, {
        totalPointsScored: Number(overrideScoresInput.totalPointsScored),
        battlePointsScored: Number(overrideScoresInput.battlePointsScored)
      });
      setSuccess(`Scores overridden for ${selectedPred.userId?.name || selectedPred.userId?.username}!`);
      setSelectedPred(null);
      fetchMwPredictionsAndBattles(overrideMwId);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to override scores.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBattleOverride = async () => {
    if (!selectedBattle || !editBattleData) return;
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await api.overrideBattleResult(selectedBattle._id, editBattleData);
      setSuccess(`Battle outcome overridden successfully!`);
      setSelectedBattle(null);
      fetchMwPredictionsAndBattles(overrideMwId);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to override battle.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* CONSOLE HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ borderBottom: 'none', marginBottom: '0.25rem', paddingBottom: 0 }}>
            League <span className="text-gradient">Admin Console</span>
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>Complete control over groups, fixtures, player predictions, points & chip overrides.</p>
        </div>

        {/* ADMIN TAB NAVIGATION BUTTONS */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button 
            className={`btn ${adminTab === 'list' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem' }}
            onClick={() => { setAdminTab('list'); setSelectedMw(null); }}
          >
            <List size={15} /> Matchweeks ({matchweeks.length})
          </button>
          
          <button 
            className={`btn ${adminTab === 'create' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem' }}
            onClick={() => { setAdminTab('create'); setSelectedMw(null); }}
          >
            <Plus size={15} /> Create Fixtures
          </button>

          <button 
            className={`btn ${adminTab === 'roster' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem' }}
            onClick={() => { setAdminTab('roster'); setSelectedMw(null); }}
          >
            <Users size={15} /> Group Roster ({groupDetails.members.length})
          </button>

          <button 
            className={`btn ${adminTab === 'overrides' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem' }}
            onClick={() => { setAdminTab('overrides'); setSelectedMw(null); }}
          >
            <Edit3 size={15} /> Edit & Overrides
          </button>

          <button 
            className={`btn ${adminTab === 'pl-standings' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem' }}
            onClick={() => { setAdminTab('pl-standings'); setSelectedMw(null); }}
          >
            🏆 PL Points Table
          </button>

          <button 
            className={`btn ${adminTab === 'pl-fixtures' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem' }}
            onClick={() => { setAdminTab('pl-fixtures'); setSelectedMw(null); }}
          >
            🗓️ PL Schedule
          </button>

          <button 
            className={`btn ${adminTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem' }}
            onClick={() => { setAdminTab('settings'); setSelectedMw(null); }}
          >
            <Settings size={15} /> Group Settings
          </button>
        </div>
      </div>

      {/* ALERT MESSAGES */}
      {error && <div className="card" style={{ color: 'var(--danger)', background: 'var(--danger-glow)', marginBottom: 0 }}>{error}</div>}
      {success && <div className="card" style={{ color: 'var(--success)', background: 'var(--success-glow)', marginBottom: 0 }}>{success}</div>}

      {/* ================= TAB 2: CREATE MATCHWEEK & 5 FIXTURES ================= */}
      {adminTab === 'create' && (
        <div className="card">
          <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} style={{ color: 'var(--primary)' }} /> Add 5 Fixtures & Auto-Calculate Deadline
          </h3>

          <form onSubmit={handleCreateMatchweek}>
            <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label">Matchweek Number</label>
                <input 
                  type="number" 
                  min="1" 
                  max="38" 
                  className="form-input" 
                  value={newMwNum} 
                  onChange={(e) => setNewMwNum(e.target.value)} 
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleFetchPLFixtures(e);
                    }
                  }}
                  placeholder="e.g. 6"
                  required 
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">Submission Deadline</label>
                  <span style={{ fontSize: '0.75rem', color: isManualDeadline ? 'var(--warning)' : 'var(--success)' }}>
                    {isManualDeadline ? 'Manual Override' : 'Auto (Earliest Kickoff)'}
                  </span>
                </div>
                <input 
                  type="datetime-local" 
                  className="form-input" 
                  value={newMwDeadline} 
                  onChange={(e) => {
                    setNewMwDeadline(e.target.value);
                    setIsManualDeadline(true);
                  }} 
                  required 
                />
              </div>
            </div>

            {/* OFFICIAL PL FIXTURES SELECTOR GRID */}
            <div className="card" style={{ background: 'rgba(56, 189, 248, 0.05)', borderColor: 'rgba(56, 189, 248, 0.2)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h4 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <RefreshCw size={16} /> Official Premier League Schedule Fetcher (IST)
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Enter matchweek number above and click fetch to load all 10 scheduled games with kickoff times corrected to IST (+05:30).
                  </span>
                </div>

                <button 
                  type="button" 
                  className="btn btn-accent" 
                  onClick={(e) => handleFetchPLFixtures(e)} 
                  disabled={fetchingPl || !newMwNum}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}
                >
                  <RefreshCw size={15} className={fetchingPl ? 'spin' : ''} /> {fetchingPl ? 'Fetching PL Games...' : 'Fetch PL Schedule'}
                </button>
              </div>

              {fetchedPlFixtures.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      Select 5 Games: <strong style={{ color: selectedPlIndices.length === 5 ? 'var(--success)' : 'var(--warning)' }}>{selectedPlIndices.length} / 5 Selected</strong>
                    </span>
                    {selectedPlIndices.length === 5 && (
                      <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>✓ 5 Matches Selected! Fixtures populated below.</span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                    {fetchedPlFixtures.map((f, idx) => {
                      const isSelected = selectedPlIndices.includes(idx);

                      return (
                        <div 
                          key={idx}
                          onClick={() => handleTogglePlMatch(idx)}
                          style={{
                            padding: '0.75rem',
                            borderRadius: '8px',
                            border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                            background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(0,0,0,0.2)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                          }}
                        >
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem' }}>
                              {f.homeTeam} <span style={{ color: 'var(--text-muted)' }}>vs</span> {f.awayTeam}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Calendar size={12} /> {f.kickoffDisplayIST || f.kickoffTime}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <h4 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              Matchweek Games (Exactly 5 Selected Fixtures)
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {newMwMatches.map((match, idx) => (
                <div key={idx} className="card" style={{ background: 'rgba(0,0,0,0.15)', margin: 0, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>Fixture #{idx + 1}</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', color: newMwBattleIndex === idx ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600 }}>
                      <input 
                        type="radio" 
                        name="newMwBattleRadio" 
                        checked={newMwBattleIndex === idx} 
                        onChange={() => setNewMwBattleIndex(idx)} 
                      />
                      ⚔️ Designate as Battle Match
                    </label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                    <div className="form-group">
                      <label className="form-label">Home Team</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={match.homeTeam} 
                        onChange={(e) => handleMatchFormChange(idx, 'homeTeam', e.target.value)} 
                        placeholder="e.g. Arsenal" 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Away Team</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={match.awayTeam} 
                        onChange={(e) => handleMatchFormChange(idx, 'awayTeam', e.target.value)} 
                        placeholder="e.g. Chelsea" 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Kickoff Time</label>
                      <input 
                        type="datetime-local" 
                        className="form-input" 
                        value={match.kickoffTime} 
                        onChange={(e) => handleMatchFormChange(idx, 'kickoffTime', e.target.value)} 
                        required 
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              Create Matchweek & Fixtures
            </button>
          </form>
        </div>
      )}

      {/* ================= TAB 3: MANAGE WEEKS & RESULTS GRADING ================= */}
      {adminTab === 'list' && !selectedMw && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '80px', textAlign: 'center' }}>Week</th>
                  <th>Deadline</th>
                  <th>Fixtures</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {matchweeks.map((mw) => (
                  <tr 
                    key={mw._id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setViewDetailsMw(mw)}
                    title="Click to view matchweek details quick glance"
                  >
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>#{mw.matchweekNumber}</td>
                    <td>{new Date(mw.deadline).toLocaleString()}</td>
                    <td>
                      {mw.matches?.length || 0} Games
                      {mw.battleMatchId && <span style={{ marginLeft: '0.4rem', color: 'var(--accent)' }} title="Battle Match Designated">⚔️</span>}
                    </td>
                    <td>
                      <span className={`badge ${
                        mw.status === 'active' ? 'badge-success' : mw.status === 'completed' ? 'badge-info' : 'badge-warning'
                      }`}>
                        {mw.status}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem' }}>
                        {mw.status !== 'active' && mw.status !== 'completed' && (
                          <button className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }} onClick={() => handleSetActive(mw._id)}>
                            Set Active
                          </button>
                        )}
                        <button className="btn btn-primary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }} onClick={() => handleSelectMwForScoring(mw)}>
                          Input Results
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }} onClick={() => handleStartEditMw(mw)} title="Edit Matchweek">
                          <Edit3 size={13} style={{ marginRight: '0.2rem' }} /> Edit
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '0.35rem', color: 'var(--danger)' }} onClick={() => handleDelete(mw._id)} title="Delete Matchweek">
                          <Trash size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 4: GROUP ROSTER & REQUESTS (ACCEPT / REJECT / REMOVE) ================= */}
      {adminTab === 'roster' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* ROSTER HEADER WITH REFRESH & BATTLE PAIRING BUTTONS */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={18} style={{ color: 'var(--primary)' }} /> Group Roster & Member Requests
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                Manage member join requests, leave approvals, active group roster, and execute battle pairings.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-secondary" 
                onClick={handleRefreshRoster} 
                disabled={refreshingRoster}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', gap: '0.4rem', borderColor: 'var(--primary-glow)', color: 'var(--primary)' }}
              >
                <RefreshCw size={15} className={refreshingRoster ? 'spin' : ''} />
                {refreshingRoster ? 'Refreshing Roster...' : 'Refresh Roster'}
              </button>
              <button 
                className="btn btn-accent" 
                onClick={handleGeneratePairingsInRoster} 
                disabled={generatingPairings}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', gap: '0.4rem' }}
                title="Execute battle pairing function for current standings (1st vs Nth, 2nd vs N-1th, middle triad if odd)"
              >
                <Sword size={15} className={generatingPairings ? 'spin' : ''} />
                {generatingPairings ? 'Pairing Battles...' : 'Re-pair Battles (Current Standings)'}
              </button>
            </div>
          </div>

          {/* JOIN REQUESTS */}
          <div className="card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <UserCheck size={18} style={{ color: 'var(--success)' }} /> Pending Join Requests ({groupDetails.pendingJoins.length})
            </h3>
            {groupDetails.pendingJoins.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No pending join requests.</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupDetails.pendingJoins.map((reqUser) => (
                      <tr key={reqUser._id}>
                        <td style={{ fontWeight: 600 }}>{reqUser.name || '-'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{reqUser.username}</td>
                        <td>{reqUser.email}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={() => handleApproveJoin(reqUser._id)}>
                              Approve Join
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleRejectJoin(reqUser._id)}>
                              Reject Join
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* LEAVE REQUESTS */}
          <div className="card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <UserX size={18} style={{ color: 'var(--danger)' }} /> Pending Leave Requests ({groupDetails.pendingLeaves.length})
            </h3>
            {groupDetails.pendingLeaves.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No pending leave requests.</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupDetails.pendingLeaves.map((reqUser) => (
                      <tr key={reqUser._id}>
                        <td style={{ fontWeight: 600 }}>{reqUser.name || '-'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{reqUser.username}</td>
                        <td>{reqUser.email}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => handleApproveLeave(reqUser._id)}>
                              Accept Leave
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={() => handleRejectLeave(reqUser._id)}>
                              Reject Leave
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ACTIVE MEMBERS ROSTER WITH DIRECT REMOVE */}
          <div className="card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Users size={18} style={{ color: 'var(--primary)' }} /> Active Group Members ({groupDetails.members.length})
            </h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupDetails.members.map((member) => {
                    const isOwner = member._id === groupDetails.adminId?._id;
                    return (
                      <tr key={member._id}>
                        <td style={{ fontWeight: 600 }}>{member.name || '-'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{member.username}</td>
                        <td>{member.email}</td>
                        <td>
                          <span className={`badge ${isOwner ? 'badge-accent' : 'badge-info'}`} style={{ fontSize: '0.7rem' }}>
                            {isOwner ? 'Owner / Admin' : 'Player'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {!isOwner && (
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                              onClick={() => handleRemoveMember(member._id, member.name || member.username)}
                            >
                              <UserMinus size={13} style={{ marginRight: '0.2rem' }} /> Remove Member
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 5: PREDICTIONS & MANUAL OVERRIDES CONSOLE ================= */}
      {adminTab === 'overrides' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit3 size={18} style={{ color: 'var(--accent)' }} /> Predictions & Manual Overrides
              </h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Matchweek:</label>
                <select 
                  className="form-input" 
                  style={{ width: '180px' }}
                  value={overrideMwId}
                  onChange={(e) => setOverrideMwId(e.target.value)}
                >
                  {matchweeks.map((mw) => (
                    <option key={mw._id} value={mw._id}>Matchweek #{mw.matchweekNumber}</option>
                  ))}
                </select>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleRefreshOverrides} 
                  disabled={refreshingOverrides}
                  style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', gap: '0.35rem', borderColor: 'var(--accent)', color: 'var(--accent)' }}
                  title="Refresh predictions, scores and battle overrides"
                >
                  <RefreshCw size={15} className={refreshingOverrides ? 'spin' : ''} />
                  {refreshingOverrides ? 'Refreshing...' : 'Refresh Overrides'}
                </button>
              </div>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
              Select a player to edit their choices/chips or directly override their total score and battle points.
            </p>
          </div>

          {/* PLAYER PREDICTIONS LIST & OVERRIDE CONTROLS */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Player Name</th>
                    <th>Username</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Total Scored</th>
                    <th style={{ textAlign: 'right' }}>Battle Points</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mwPredictions.map((pred) => (
                    <tr key={pred._id}>
                      <td style={{ fontWeight: 600 }}>{pred.userId?.name || '-'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{pred.userId?.username}</td>
                      <td>
                        {pred.isAutofilled ? (
                          <span className="badge badge-warning" style={{ fontWeight: 700 }}>
                            🤖 Autofilled
                          </span>
                        ) : pred.isSubmitted ? (
                          <span className="badge badge-success" style={{ fontWeight: 700 }}>
                            ✅ Submitted
                          </span>
                        ) : (
                          <span className="badge badge-secondary" style={{ fontWeight: 700 }}>
                            Draft / Unsubmitted
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                        {pred.totalPointsScored} pts
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                        {pred.battlePointsScored} BP
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                          onClick={() => handleSelectPredForEdit(pred)}
                        >
                          <Edit3 size={13} style={{ marginRight: '0.2rem' }} /> Edit / Override
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* EDIT PREDICTION / OVERRIDE MODAL EDITOR */}
          {selectedPred && editPredData && (
            <div className="card" style={{ border: '2px solid var(--primary)', background: 'rgba(15, 23, 42, 0.95)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, color: 'var(--primary)' }}>
                  Editing Sheet: {selectedPred.userId?.name || selectedPred.userId?.username}
                </h4>
                <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setSelectedPred(null)}>
                  <X size={16} />
                </button>
              </div>

              {/* OVERRIDE POINTS SECTION */}
              <div className="card" style={{ background: 'rgba(56, 189, 248, 0.05)', borderColor: 'rgba(56, 189, 248, 0.2)', marginBottom: '1.5rem' }}>
                <h4 style={{ color: 'var(--primary)', margin: '0 0 0.75rem 0' }}>Direct Score Overrides</h4>
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Total Matchweek Points</label>
                    <input 
                      type="number"
                      className="form-input"
                      style={{ width: '120px' }}
                      value={overrideScoresInput.totalPointsScored}
                      onChange={(e) => setOverrideScoresInput({ ...overrideScoresInput, totalPointsScored: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Battle Points (BP)</label>
                    <input 
                      type="number"
                      className="form-input"
                      style={{ width: '120px' }}
                      value={overrideScoresInput.battlePointsScored}
                      onChange={(e) => setOverrideScoresInput({ ...overrideScoresInput, battlePointsScored: e.target.value })}
                    />
                  </div>

                  <button className="btn btn-accent" onClick={handleSaveScoreOverride} style={{ padding: '0.5rem 1rem' }}>
                    <Save size={14} /> Apply Points Override
                  </button>
                </div>
              </div>

              {/* EDIT CHIPS & GAMBLE */}
              <div className="card" style={{ background: 'rgba(0,0,0,0.2)', marginBottom: '1.5rem' }}>
                <h4 style={{ color: 'var(--accent)', margin: '0 0 0.75rem 0' }}>Gamble & Chips Override</h4>
                
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Gamble Active</label>
                    <select 
                      className="form-input"
                      value={editPredData.gamble?.active ? 'yes' : 'no'}
                      onChange={(e) => setEditPredData({
                        ...editPredData,
                        gamble: { ...editPredData.gamble, active: e.target.value === 'yes' }
                      })}
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Gamble Points</label>
                    <input 
                      type="number"
                      className="form-input"
                      value={editPredData.gamble?.points || 0}
                      onChange={(e) => setEditPredData({
                        ...editPredData,
                        gamble: { ...editPredData.gamble, points: Number(e.target.value) || 0 }
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* EDIT SINGLE MATCH PREDICTIONS */}
              <h4 style={{ margin: '1rem 0 0.75rem 0' }}>Match Prediction Choices</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {editPredData.predictions.map((p, idx) => (
                  <div key={idx} className="card" style={{ background: 'rgba(255,255,255,0.02)', margin: 0, padding: '0.75rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>Game #{idx + 1}</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Result</label>
                        <select 
                          className="form-input" 
                          style={{ padding: '0.3rem', fontSize: '0.85rem' }}
                          value={p.result} 
                          onChange={(e) => {
                            const updated = [...editPredData.predictions];
                            updated[idx].result = e.target.value;
                            setEditPredData({ ...editPredData, predictions: updated });
                          }}
                        >
                          <option value="Home">Home</option>
                          <option value="Away">Away</option>
                          <option value="Draw">Draw</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Scores (H-A)</label>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ padding: '0.3rem', fontSize: '0.85rem', textAlign: 'center' }}
                            value={p.homeScore} 
                            onChange={(e) => {
                              const updated = [...editPredData.predictions];
                              updated[idx].homeScore = Number(e.target.value);
                              setEditPredData({ ...editPredData, predictions: updated });
                            }} 
                          />
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ padding: '0.3rem', fontSize: '0.85rem', textAlign: 'center' }}
                            value={p.awayScore} 
                            onChange={(e) => {
                              const updated = [...editPredData.predictions];
                              updated[idx].awayScore = Number(e.target.value);
                              setEditPredData({ ...editPredData, predictions: updated });
                            }} 
                          />
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>1st Goal</label>
                        <select 
                          className="form-input" 
                          style={{ padding: '0.3rem', fontSize: '0.85rem' }}
                          value={p.firstGoal} 
                          onChange={(e) => {
                            const updated = [...editPredData.predictions];
                            updated[idx].firstGoal = e.target.value;
                            setEditPredData({ ...editPredData, predictions: updated });
                          }}
                        >
                          <option value="Home">Home</option>
                          <option value="Away">Away</option>
                          <option value="No goal">No goal</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Possession</label>
                        <select 
                          className="form-input" 
                          style={{ padding: '0.3rem', fontSize: '0.85rem' }}
                          value={p.possession} 
                          onChange={(e) => {
                            const updated = [...editPredData.predictions];
                            updated[idx].possession = e.target.value;
                            setEditPredData({ ...editPredData, predictions: updated });
                          }}
                        >
                          <option value="Home">Home</option>
                          <option value="Away">Away</option>
                          <option value="Equal">Equal</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSavePredEdit}>
                <Save size={16} /> Save Prediction Sheet Changes
              </button>
            </div>
          )}

          {/* BATTLES H2H OVERRIDE SECTION */}
          {mwBattles.length > 0 && (
            <div className="card">
              <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sword size={18} style={{ color: 'var(--primary)' }} /> Battle H2H Outcomes Manual Override
              </h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Bracket</th>
                      <th>Player 1</th>
                      <th>Player 2</th>
                      <th>Score</th>
                      <th>Winner / Outcome</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mwBattles.map((b, idx) => {
                      const p1Name = b.player1Id?.name || b.player1Id?.username || 'Player 1';
                      const p2Name = b.player2Id?.name || b.player2Id?.username || 'Player 2';
                      const p3Name = b.player3Id?.name || b.player3Id?.username || 'Player 3';
                      const isTriad = b.isTriad && b.player3Id;

                      return (
                        <tr key={b._id}>
                          <td style={{ fontWeight: 700 }}>
                            Bracket #{idx + 1} {isTriad ? '(Triad)' : ''}
                          </td>
                          <td>{p1Name}</td>
                          <td>{p2Name} {isTriad ? `& ${p3Name}` : ''}</td>
                          <td style={{ fontWeight: 700 }}>
                            {!isTriad ? `${b.player1Wins} - ${b.player2Wins}` : `${b.player1Wins} - ${b.player2Wins} - ${b.player3Wins}`}
                          </td>
                          <td>
                            <span className={`badge ${b.outcome === 'Draw' || b.outcome === 'Tie' ? 'badge-info' : 'badge-success'}`}>
                              {b.outcome}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                              onClick={() => {
                                setSelectedBattle(b);
                                setEditBattleData(JSON.parse(JSON.stringify(b)));
                              }}
                            >
                              Override Battle
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* EDIT BATTLE MODAL */}
          {selectedBattle && editBattleData && (
            <div className="card" style={{ border: '2px solid var(--accent)', background: 'rgba(15, 23, 42, 0.95)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, color: 'var(--accent)' }}>
                  Editing Battle: {selectedBattle.player1Id?.name || selectedBattle.player1Id?.username} vs {selectedBattle.player2Id?.name || selectedBattle.player2Id?.username}
                </h4>
                <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setSelectedBattle(null)}>
                  <X size={16} />
                </button>
              </div>

              <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Player 1 Wins</label>
                  <input 
                    type="number"
                    className="form-input"
                    value={editBattleData.player1Wins}
                    onChange={(e) => setEditBattleData({ ...editBattleData, player1Wins: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Player 2 Wins</label>
                  <input 
                    type="number"
                    className="form-input"
                    value={editBattleData.player2Wins}
                    onChange={(e) => setEditBattleData({ ...editBattleData, player2Wins: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Player 1 BP Awarded</label>
                  <input 
                    type="number"
                    className="form-input"
                    value={editBattleData.player1Points}
                    onChange={(e) => setEditBattleData({ ...editBattleData, player1Points: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Player 2 BP Awarded</label>
                  <input 
                    type="number"
                    className="form-input"
                    value={editBattleData.player2Points}
                    onChange={(e) => setEditBattleData({ ...editBattleData, player2Points: Number(e.target.value) })}
                  />
                </div>
              </div>

              <button className="btn btn-accent" style={{ width: '100%' }} onClick={handleSaveBattleOverride}>
                <Save size={16} /> Save Battle Override
              </button>
            </div>
          )}

        </div>
      )}

      {/* ================= RESULTS & CALCULATIONS MODAL / INPUT PANEL ================= */}
      {selectedMw && (() => {
        const allMatchesScored = selectedMw.matches && selectedMw.matches.length > 0 && selectedMw.matches.every(m => {
          const input = resultsInput[m._id];
          return input && input.homeScore !== null && input.homeScore !== undefined && input.homeScore !== '';
        });

        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Input Results: Matchweek #{selectedMw.matchweekNumber}</h3>
              <button className="btn btn-secondary" onClick={() => setSelectedMw(null)}>Back to list</button>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', borderColor: 'var(--border-color)' }}>
              <button 
                className="btn btn-secondary" 
                onClick={handleFetchResultsViaAPI} 
                disabled={fetchingApiResults || loading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: 'var(--accent)', color: 'var(--accent)' }}
                title="Fetch latest match scorelines & stats from Official Premier League API"
              >
                <RefreshCw size={16} className={fetchingApiResults ? 'spin' : ''} />
                {fetchingApiResults ? 'Fetching API Results...' : '⚡ Fetch Results via API'}
              </button>

              <button 
                className="btn btn-secondary" 
                onClick={handleResetResultsToNull} 
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: 'rgba(239, 68, 68, 0.5)', color: 'var(--danger)' }}
                title="Reset all match scores, outcomes and stats in database to null"
              >
                <RotateCcw size={16} /> Reset Results to Null
              </button>

              <button className="btn btn-primary" onClick={handleUpdateResults} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Save size={16} /> Update Results
              </button>
              
              <button 
                className={`btn ${allMatchesScored ? 'btn-accent' : 'btn-secondary'}`} 
                onClick={handleCompleteMatchweek} 
                disabled={!allMatchesScored || loading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: !allMatchesScored ? 0.6 : 1 }}
                title={allMatchesScored ? 'Mark matchweek as completed and unlock in Results section' : 'Enter results for all 5 matches to enable completion'}
              >
                <CheckCircle2 size={16} /> Matchweek Completed
              </button>

              <div style={{ fontSize: '0.85rem', color: allMatchesScored ? 'var(--success)' : 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>
                {allMatchesScored ? (
                  <>
                    <CheckCircle2 size={15} /> All matches scored! Ready to complete matchweek.
                  </>
                ) : (
                  <>
                    <AlertTriangle size={15} /> Click "Update Results" for partial match points (updates Home & Standings). Fill all matches to enable "Matchweek Completed".
                  </>
                )}
              </div>
            </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
            {selectedMw.matches.map((match, idx) => {
              const mId = match._id;
              const input = resultsInput[mId] || {};
              const isBattleMatch = selectedMw.battleMatchId === mId;

              return (
                <div key={mId} className="card" style={{ borderLeft: isBattleMatch ? '5px solid var(--accent)' : '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {match.homeTeam} vs {match.awayTeam}
                      {isBattleMatch && <span style={{ color: 'var(--accent)', fontSize: '0.85rem' }} title="Battle Match of the Week">⚔️ Battle Match</span>}
                    </h4>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Scoreline</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="number"
                          min="0"
                          className="form-input"
                          style={{ width: '60px', textAlign: 'center' }}
                          value={input.homeScore}
                          onChange={(e) => handleResultChange(mId, 'homeScore', parseInt(e.target.value) || 0)}
                        />
                        <span>-</span>
                        <input
                          type="number"
                          min="0"
                          className="form-input"
                          style={{ width: '60px', textAlign: 'center' }}
                          value={input.awayScore}
                          onChange={(e) => handleResultChange(mId, 'awayScore', parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Outcome (Result)</label>
                      <select
                        className="form-input"
                        value={input.result}
                        onChange={(e) => handleResultChange(mId, 'result', e.target.value)}
                      >
                        <option value="Home">{match.homeTeam} Win</option>
                        <option value="Away">{match.awayTeam} Win</option>
                        <option value="Draw">Draw</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">1st Goal Scorer</label>
                      <select
                        className="form-input"
                        value={input.firstGoal}
                        onChange={(e) => handleResultChange(mId, 'firstGoal', e.target.value)}
                      >
                        <option value="Home">{match.homeTeam}</option>
                        <option value="Away">{match.awayTeam}</option>
                        <option value="No goal">No goal</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Greater Possession</label>
                      <select
                        className="form-input"
                        value={input.possession}
                        onChange={(e) => handleResultChange(mId, 'possession', e.target.value)}
                      >
                        <option value="Home">{match.homeTeam}</option>
                        <option value="Away">{match.awayTeam}</option>
                        <option value="Equal">Equal Possession</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Yellow Cards</label>
                      <input
                        type="number"
                        min="0"
                        className="form-input"
                        style={{ width: '80px', textAlign: 'center' }}
                        value={input.yellowCards}
                        onChange={(e) => handleResultChange(mId, 'yellowCards', parseInt(e.target.value) || 0)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Offsides</label>
                      <input
                        type="number"
                        min="0"
                        className="form-input"
                        style={{ width: '80px', textAlign: 'center' }}
                        value={input.offsides}
                        onChange={(e) => handleResultChange(mId, 'offsides', parseInt(e.target.value) || 0)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Corners</label>
                      <input
                        type="number"
                        min="0"
                        className="form-input"
                        style={{ width: '80px', textAlign: 'center' }}
                        value={input.corners}
                        onChange={(e) => handleResultChange(mId, 'corners', parseInt(e.target.value) || 0)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Total Shots</label>
                      <input
                        type="number"
                        min="0"
                        className="form-input"
                        style={{ width: '80px', textAlign: 'center' }}
                        value={input.shots}
                        onChange={(e) => handleResultChange(mId, 'shots', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-primary" onClick={handleUpdateResults} disabled={loading} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <Save size={16} /> Update Results
              </button>
              
              <button 
                className={`btn ${allMatchesScored ? 'btn-accent' : 'btn-secondary'}`} 
                onClick={handleCompleteMatchweek} 
                disabled={!allMatchesScored || loading}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', opacity: !allMatchesScored ? 0.6 : 1 }}
              >
                <CheckCircle2 size={16} /> Matchweek Completed
              </button>
            </div>
          </div>
        );
      })()}

      {/* ================= EDIT MATCHWEEK MODAL POPUP ================= */}
      {editingMw && editMwForm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{
            maxWidth: '750px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '2px solid var(--accent)',
            background: '#0f172a',
            padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit3 size={20} /> Edit Matchweek #{editingMw.matchweekNumber} Fixtures
              </h3>
              <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setEditingMw(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Matchweek Number</label>
                <input 
                  type="number"
                  className="form-input"
                  value={editMwForm.matchweekNumber}
                  onChange={(e) => setEditMwForm({ ...editMwForm, matchweekNumber: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Submission Deadline</label>
                <input 
                  type="datetime-local"
                  className="form-input"
                  value={editMwForm.deadline}
                  onChange={(e) => setEditMwForm({ ...editMwForm, deadline: e.target.value })}
                />
              </div>
            </div>

            <h4 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              Fixtures & Designated Battle Match
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {editMwForm.matches.map((match, idx) => (
                <div key={idx} className="card" style={{ background: 'rgba(0,0,0,0.25)', margin: 0, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>Fixture #{idx + 1}</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', color: editMwForm.battleMatchIndex === idx ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600 }}>
                      <input 
                        type="radio" 
                        name="editBattleMatchRadio" 
                        checked={editMwForm.battleMatchIndex === idx} 
                        onChange={() => setEditMwForm({ ...editMwForm, battleMatchIndex: idx })} 
                      />
                      ⚔️ Designate as Battle Match
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                    <div className="form-group">
                      <label className="form-label">Home Team</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={match.homeTeam} 
                        onChange={(e) => {
                          const updated = [...editMwForm.matches];
                          updated[idx].homeTeam = e.target.value;
                          setEditMwForm({ ...editMwForm, matches: updated });
                        }} 
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Away Team</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={match.awayTeam} 
                        onChange={(e) => {
                          const updated = [...editMwForm.matches];
                          updated[idx].awayTeam = e.target.value;
                          setEditMwForm({ ...editMwForm, matches: updated });
                        }} 
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Kickoff Time</label>
                      <input 
                        type="datetime-local" 
                        className="form-input" 
                        value={match.kickoffTime} 
                        onChange={(e) => {
                          const updated = [...editMwForm.matches];
                          updated[idx].kickoffTime = e.target.value;
                          setEditMwForm({ ...editMwForm, matches: updated });
                        }} 
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-accent" style={{ flex: 1 }} onClick={handleSaveMwEdit} disabled={loading}>
                Save Fixture Updates
              </button>
              <button className="btn btn-secondary" onClick={() => setEditingMw(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 5: OFFICIAL PL STANDINGS DB CACHE ================= */}
      {adminTab === 'pl-standings' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🏆 Official Premier League Points Table (Database Cache)
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                Stored in MongoDB for maximum robustness. Click refresh to perform API call and update database table.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              {plStandingsRecord?.lastRefreshedAt && (
                <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                  Last Synced DB: {new Date(plStandingsRecord.lastRefreshedAt).toLocaleString()}
                </span>
              )}
              <button 
                className="btn btn-accent" 
                onClick={handleRefreshPLStandingsDB} 
                disabled={refreshingPlStandings}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <RefreshCw size={15} className={refreshingPlStandings ? 'spin' : ''} />
                {refreshingPlStandings ? 'Syncing API to DB...' : 'Refresh & Sync Standings to DB'}
              </button>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '60px', textAlign: 'center' }}>Rank</th>
                  <th>Premier League Club</th>
                  <th style={{ textAlign: 'center' }}>Points</th>
                  <th style={{ textAlign: 'center' }}>Goal Diff (GD)</th>
                </tr>
              </thead>
              <tbody>
                {plStandingsRecord?.data && plStandingsRecord.data.length > 0 ? (
                  plStandingsRecord.data.map((s, idx) => (
                    <tr key={idx} style={{ background: s.rank <= 4 ? 'rgba(16, 185, 129, 0.05)' : 'transparent' }}>
                      <td style={{ textAlign: 'center', fontWeight: 800 }}>
                        <span className={`badge ${s.rank <= 4 ? 'badge-success' : (s.rank >= 18 ? 'badge-danger' : 'badge-secondary')}`}>
                          #{s.rank}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, fontSize: '0.95rem' }}>{s.teamName}</td>
                      <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--accent)', fontSize: '1rem' }}>{s.points} pts</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No Premier League standings cached in database yet. Click "Refresh & Sync Standings to DB" above!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 6: OFFICIAL PL FIXTURES DB CACHE ================= */}
      {adminTab === 'pl-fixtures' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🗓️ Premier League Matchweek Schedule (Database Cache)
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                Stored in MongoDB with IST kickoff timestamps. Select matchweek and click sync to update database table.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Matchweek:</label>
                <select 
                  className="form-input" 
                  style={{ width: '80px', padding: '0.4rem' }}
                  value={plFixturesMw}
                  onChange={(e) => setPlFixturesMw(Number(e.target.value))}
                >
                  {Array.from({ length: 38 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>#{n}</option>
                  ))}
                </select>
              </div>

              {plFixturesRecord?.lastRefreshedAt && (
                <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                  Last Synced DB: {new Date(plFixturesRecord.lastRefreshedAt).toLocaleString()}
                </span>
              )}

              <button 
                className="btn btn-accent" 
                onClick={() => handleRefreshPLFixturesDB(plFixturesMw)} 
                disabled={refreshingPlFixtures}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <RefreshCw size={15} className={refreshingPlFixtures ? 'spin' : ''} />
                {refreshingPlFixtures ? 'Syncing API to DB...' : `Sync Matchweek #${plFixturesMw} Fixtures to DB`}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {plFixturesRecord?.data && plFixturesRecord.data.length > 0 ? (
              plFixturesRecord.data.map((f, idx) => (
                <div key={idx} className="card" style={{ background: 'rgba(0,0,0,0.2)', margin: 0, padding: '1rem', borderLeft: '4px solid var(--primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Game #{idx + 1}</span>
                    <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>IST +05:30</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.4rem' }}>
                    {f.homeTeam} <span style={{ color: 'var(--accent)' }}>vs</span> {f.awayTeam}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Calendar size={13} /> {f.kickoffDisplayIST || f.kickoffTime}
                  </div>
                </div>
              ))
            ) : (
              <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                No fixtures cached in database for Matchweek #{plFixturesMw} yet. Click "Sync Matchweek #{plFixturesMw} Fixtures to DB" above!
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= QUICK GLANCE DETAILS MODAL POPUP ================= */}
      {viewDetailsMw && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '2px solid var(--primary)',
            background: '#0f172a',
            padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Eye size={20} /> Matchweek #{viewDetailsMw.matchweekNumber} Quick Glance
              </h3>
              <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setViewDetailsMw(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.25rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
              <div><strong>Deadline:</strong> {new Date(viewDetailsMw.deadline).toLocaleString()}</div>
              <div><strong>Status:</strong> <span className={`badge ${viewDetailsMw.status === 'active' ? 'badge-success' : viewDetailsMw.status === 'completed' ? 'badge-info' : 'badge-warning'}`}>{viewDetailsMw.status}</span></div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '60px', textAlign: 'center' }}>No.</th>
                    <th>Fixture</th>
                    <th style={{ textAlign: 'center' }}>Kickoff</th>
                    <th style={{ textAlign: 'center' }}>Score / Outcome</th>
                    <th>1st Goal</th>
                    <th>Possession</th>
                    <th style={{ textAlign: 'center' }}>Y. Cards</th>
                    <th style={{ textAlign: 'center' }}>Offsides</th>
                    <th style={{ textAlign: 'center' }}>Corners</th>
                    <th style={{ textAlign: 'center' }}>Shots</th>
                  </tr>
                </thead>
                <tbody>
                  {viewDetailsMw.matches?.map((m, idx) => {
                    const hasScore = m.actualResults && m.actualResults.homeScore !== null;
                    const isBattle = viewDetailsMw.battleMatchId?.toString() === m._id?.toString();

                    return (
                      <tr key={m._id || idx}>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>#{idx + 1}</td>
                        <td style={{ fontWeight: 700 }}>
                          {m.homeTeam} vs {m.awayTeam}
                          {isBattle && <span style={{ marginLeft: '0.4rem', color: 'var(--accent)' }} title="Battle Match">⚔️</span>}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '0.8rem' }}>
                          {new Date(m.kickoffTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {hasScore ? (
                            <span className="badge badge-success" style={{ fontWeight: 800 }}>
                              {m.actualResults.homeScore} - {m.actualResults.awayScore} ({renderChoiceAbbreviation(getMatchWinnerChoice(m.actualResults, m.homeTeam, m.awayTeam), m.homeTeam, m.awayTeam)})
                            </span>
                          ) : (
                            <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Not Entered</span>
                          )}
                        </td>
                        <td>{hasScore ? renderChoiceAbbreviation(m.actualResults.firstGoal, m.homeTeam, m.awayTeam) : '-'}</td>
                        <td>{hasScore ? renderChoiceAbbreviation(m.actualResults.possession, m.homeTeam, m.awayTeam) : '-'}</td>
                        <td style={{ textAlign: 'center' }}>{hasScore && m.actualResults.yellowCards !== null ? m.actualResults.yellowCards : '-'}</td>
                        <td style={{ textAlign: 'center' }}>{hasScore && m.actualResults.offsides !== null ? m.actualResults.offsides : '-'}</td>
                        <td style={{ textAlign: 'center' }}>{hasScore && m.actualResults.corners !== null ? m.actualResults.corners : '-'}</td>
                        <td style={{ textAlign: 'center' }}>{hasScore && m.actualResults.shots !== null ? m.actualResults.shots : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button className="btn btn-secondary" style={{ width: '100%', marginTop: '1.25rem' }} onClick={() => setViewDetailsMw(null)}>
              Close Quick Glance
            </button>
          </div>
        </div>
      )}

      {/* ================= TAB 7: GROUP SETTINGS (RENAME GROUP) ================= */}
      {adminTab === 'settings' && (
        <div className="card" style={{ maxWidth: '600px' }}>
          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={20} style={{ color: 'var(--primary)' }} /> Group Settings
          </h3>
          <form onSubmit={handleUpdateGroupName}>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                Group Name
              </label>
              <input
                type="text"
                className="form-control"
                value={groupNameInput}
                onChange={(e) => setGroupNameInput(e.target.value)}
                placeholder="Enter group name..."
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'rgba(0,0,0,0.25)',
                  color: 'var(--text-light)',
                  fontSize: '1rem'
                }}
              />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                This changes the displayed title of the league across all member dashboards.
              </p>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={updatingGroupName}
              style={{
                padding: '0.65rem 1.5rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Save size={16} /> {updatingGroupName ? 'Saving...' : 'Update Group Name'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
