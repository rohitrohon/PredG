import React, { useEffect, useState } from 'react';
import api from '../api';
import { 
  Shield, Plus, List, Trophy, Sword, Trash, Play, AlertTriangle, 
  UserCheck, UserX, Users, Edit3, Settings, Save, X, UserMinus, 
  PlusCircle, RefreshCw, Eye, CheckCircle2, ChevronRight, Award
} from 'lucide-react';

function AdminPanel({ groupId }) {
  const [matchweeks, setMatchweeks] = useState([]);
  const [groupDetails, setGroupDetails] = useState({ members: [], pendingJoins: [], pendingLeaves: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Currently selected matchweek for results/grading
  const [selectedMw, setSelectedMw] = useState(null);

  // Tabs: 'list', 'create', 'roster', 'overrides'
  const [adminTab, setAdminTab] = useState('list');

  // Create matchweek form state
  const [newMwNum, setNewMwNum] = useState('');
  const [newMwDeadline, setNewMwDeadline] = useState('');
  const [isManualDeadline, setIsManualDeadline] = useState(false);
  const [newMwMatches, setNewMwMatches] = useState(
    Array.from({ length: 5 }, () => ({ homeTeam: '', awayTeam: '', kickoffTime: '' }))
  );

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

  useEffect(() => {
    fetchData();
  }, [groupId]);

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

      if (mws.length > 0 && !overrideMwId) {
        setOverrideMwId(mws[0]._id);
      }
    } catch (err) {
      setError('Failed to fetch admin console data.');
    } finally {
      setLoading(false);
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
        matches: newMwMatches
      });

      setSuccess(`Matchweek #${newMwNum} fixtures created successfully!`);
      setNewMwNum('');
      setNewMwDeadline('');
      setIsManualDeadline(false);
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
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await api.updateResults(selectedMw._id, {
        matchesResults: resultsInput
      });
      setSuccess('Match results draft saved successfully.');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to save results.');
    } finally {
      setLoading(false);
    }
  };

  const handlePairBattles = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      const data = await api.pairBattles(selectedMw._id);
      setSuccess(data.message || 'Battles paired successfully!');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to pair battles.');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateScores = async () => {
    const confirmCalc = window.confirm(
      'WARNING: This will finalize calculations, distribute points/battle points, update standings, and mark this matchweek as COMPLETED. Proceed?'
    );
    if (!confirmCalc) return;

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      await api.updateResults(selectedMw._id, {
        matchesResults: resultsInput
      });

      const data = await api.calculateScores(selectedMw._id);
      setSuccess(data.message || 'Calculated scores and battle outcomes successfully!');
      setSelectedMw(null);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to calculate scores.');
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

            <h4 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              Matchweek Games (Exactly 5 Fixtures)
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {newMwMatches.map((match, idx) => (
                <div key={idx} className="card" style={{ background: 'rgba(0,0,0,0.15)', margin: 0, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>Fixture #{idx + 1}</span>
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
                  <tr key={mw._id}>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>#{mw.matchweekNumber}</td>
                    <td>{new Date(mw.deadline).toLocaleString()}</td>
                    <td>{mw.matches?.length || 0} Games</td>
                    <td>
                      <span className={`badge ${
                        mw.status === 'active' ? 'badge-success' : mw.status === 'completed' ? 'badge-info' : 'badge-warning'
                      }`}>
                        {mw.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem' }}>
                        {mw.status !== 'active' && mw.status !== 'completed' && (
                          <button className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }} onClick={() => handleSetActive(mw._id)}>
                            Set Active
                          </button>
                        )}
                        <button className="btn btn-primary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }} onClick={() => handleSelectMwForScoring(mw)}>
                          Input Results / Grade
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '0.35rem', color: 'var(--danger)' }} onClick={() => handleDelete(mw._id)}>
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
                              Accept Join
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                        <span className={`badge ${pred.isSubmitted ? 'badge-success' : 'badge-warning'}`}>
                          {pred.isSubmitted ? 'Submitted' : 'Draft / Autofilled'}
                        </span>
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
                    {mwBattles.map((b, idx) => (
                      <tr key={b._id}>
                        <td style={{ fontWeight: 700 }}>Bracket #{idx + 1}</td>
                        <td>{b.player1Id?.name || b.player1Id?.username}</td>
                        <td>{b.player2Id?.name || b.player2Id?.username}</td>
                        <td style={{ fontWeight: 700 }}>{b.player1Wins} - {b.player2Wins}</td>
                        <td>
                          <span className={`badge ${b.outcome === 'Draw' ? 'badge-info' : 'badge-success'}`}>
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
                    ))}
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
      {selectedMw && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>Input Results: Matchweek #{selectedMw.matchweekNumber}</h3>
            <button className="btn btn-secondary" onClick={() => setSelectedMw(null)}>Back to list</button>
          </div>

          <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', background: 'rgba(245, 158, 11, 0.05)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
            <button className="btn btn-accent" onClick={handlePairBattles}>
              <Sword size={16} /> 1. Generate & Save Battle Pairings
            </button>
            <button className="btn btn-primary" onClick={handleCalculateScores}>
              <Play size={16} /> 2. Finalize & Calculate Weekly Points
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--warning)', fontSize: '0.85rem' }}>
              <AlertTriangle size={16} /> Save match results draft below before calculating final scores!
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
                    <h4 style={{ margin: 0 }}>{match.homeTeam} vs {match.awayTeam}</h4>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={isBattleMatch}
                        onChange={async (e) => {
                          const updatedBattleId = e.target.checked ? mId : null;
                          try {
                            const res = await api.updateMatchweek(selectedMw._id, { groupId, battleMatchId: updatedBattleId });
                            setSelectedMw(res);
                            setSuccess('Battle Match designated.');
                          } catch (err) {
                            setError('Failed to update Battle Match.');
                          }
                        }}
                      />
                      Designate as Battle Match
                    </label>
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

          <button className="btn btn-accent" onClick={handleUpdateResults} style={{ width: '100%' }}>
            Save Match Results Draft
          </button>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
