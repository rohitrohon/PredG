import React, { useEffect, useState } from 'react';
import api from '../api';
import { Shield, Plus, List, Trophy, Sword, Trash, Play, AlertTriangle, UserCheck, UserX, Users } from 'lucide-react';

function AdminPanel({ groupId }) {
  const [matchweeks, setMatchweeks] = useState([]);
  const [groupDetails, setGroupDetails] = useState({ members: [], pendingJoins: [], pendingLeaves: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedMw, setSelectedMw] = useState(null);

  // Tabs: 'list', 'create', or 'roster'
  const [adminTab, setAdminTab] = useState('list');

  // Create matchweek form state
  const [newMwNum, setNewMwNum] = useState('');
  const [newMwDeadline, setNewMwDeadline] = useState('');
  const [newMwMatches, setNewMwMatches] = useState(
    Array.from({ length: 5 }, () => ({ homeTeam: '', awayTeam: '', kickoffTime: '', wildPredictionDetails: '' }))
  );

  // Results inputs state
  const [resultsInput, setResultsInput] = useState({});

  useEffect(() => {
    fetchData();
  }, [groupId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const mws = await api.getMatchweeks(groupId);
      setMatchweeks(mws);

      const roster = await api.getGroupMembers(groupId);
      setGroupDetails(roster);
    } catch (err) {
      setError('Failed to fetch admin data.');
    } finally {
      setLoading(false);
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

      setSuccess(`Matchweek #${newMwNum} created successfully!`);
      setNewMwNum('');
      setNewMwDeadline('');
      setNewMwMatches(
        Array.from({ length: 5 }, () => ({ homeTeam: '', awayTeam: '', kickoffTime: '', wildPredictionDetails: '' }))
      );
      setAdminTab('list');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to create matchweek.');
    } finally {
      setLoading(false);
    }
  };

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
    setResultsInput({
      ...resultsInput,
      [matchId]: {
        ...resultsInput[matchId],
        [field]: value
      }
    });
  };

  const handleWildUserToggle = (matchId, userId) => {
    const currentList = resultsInput[matchId].wildPredictionCorrectUsers;
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
      setSuccess('Results saved in draft successfully.');
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
      'WARNING: This will finalize calculations, distribute points/battle points, update standings, and mark this matchweek as COMPLETED. This operation is non-reversible. Proceed?'
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
      setSuccess(data.message || 'Calculated successfully!');
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
    if (!window.confirm('Are you sure you want to delete this matchweek? All predictions will be lost.')) return;
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

  const handleApproveJoin = async (userId) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await api.approveJoinRequest(groupId, userId);
      setSuccess('Player approved and added to group standing!');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to approve player.');
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
      setSuccess('Player leave request approved and removed from standings.');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to approve leave request.');
    } finally {
      setLoading(false);
    }
  };

  const handleMatchFormChange = (index, field, value) => {
    const updatedMatches = newMwMatches.map((m, idx) => {
      if (idx === index) {
        return { ...m, [field]: value };
      }
      return m;
    });
    setNewMwMatches(updatedMatches);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ borderBottom: 'none', marginBottom: '0.25rem', paddingBottom: 0 }}>
            League <span className="text-gradient">Console</span>
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>Manage fixtures, results, standings calculations, and member requests.</p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className={`btn ${adminTab === 'list' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            onClick={() => { setAdminTab('list'); setSelectedMw(null); }}
          >
            <List size={16} /> Manage Weeks
          </button>
          
          <button 
            className={`btn ${adminTab === 'create' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            onClick={() => { setAdminTab('create'); setSelectedMw(null); }}
          >
            <Plus size={16} /> Create fixtures
          </button>

          <button 
            className={`btn ${adminTab === 'roster' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            onClick={() => { setAdminTab('roster'); setSelectedMw(null); }}
          >
            <Users size={16} /> Roster ({groupDetails.pendingJoins.length + groupDetails.pendingLeaves.length})
          </button>
        </div>
      </div>

      {error && <div className="card" style={{ color: 'var(--danger)', background: 'var(--danger-glow)', marginBottom: '1rem' }}>{error}</div>}
      {success && <div className="card" style={{ color: 'var(--success)', background: 'var(--success-glow)', marginBottom: '1rem' }}>{success}</div>}

      {/* 1. Create Matchweek Form */}
      {adminTab === 'create' && (
        <div className="card">
          <form onSubmit={handleCreateMatchweek}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Matchweek Number</label>
                <input 
                  type="number" 
                  min="1" 
                  max="38" 
                  className="form-input" 
                  value={newMwNum} 
                  onChange={(e) => setNewMwNum(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Submission Deadline</label>
                <input 
                  type="datetime-local" 
                  className="form-input" 
                  value={newMwDeadline} 
                  onChange={(e) => setNewMwDeadline(e.target.value)} 
                  required 
                />
              </div>
            </div>

            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', margin: '1.5rem 0' }}>Matches (Exactly 5)</h3>
            
            {newMwMatches.map((match, idx) => (
              <div key={idx} className="card" style={{ background: 'rgba(0,0,0,0.15)', marginBottom: '1.5rem' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Game #{idx + 1}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
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
                  <div className="form-group">
                    <label className="form-label">Wild Prediction Detail (optional)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={match.wildPredictionDetails} 
                      onChange={(e) => handleMatchFormChange(idx, 'wildPredictionDetails', e.target.value)} 
                      placeholder="e.g. Penalty saved in the match" 
                    />
                  </div>
                </div>
              </div>
            ))}

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Create Matchweek Fixtures
            </button>
          </form>
        </div>
      )}

      {/* 2. Manage Weeks Tab */}
      {adminTab === 'list' && !selectedMw && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '80px', textAlign: 'center' }}>Week</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {matchweeks.map((mw) => (
                  <tr key={mw._id}>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>#{mw.matchweekNumber}</td>
                    <td>{new Date(mw.deadline).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${
                        mw.status === 'active' ? 'badge-success' : mw.status === 'completed' ? 'badge-info' : 'badge-warning'
                      }`}>
                        {mw.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                        {mw.status !== 'active' && mw.status !== 'completed' && (
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }} onClick={() => handleSetActive(mw._id)}>
                            Set Active
                          </button>
                        )}
                        <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }} onClick={() => handleSelectMwForScoring(mw)}>
                          Input Results / Grade
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '0.4rem', color: 'var(--danger)' }} onClick={() => handleDelete(mw._id)}>
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

      {/* 3. Group Roster Tab */}
      {adminTab === 'roster' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Join Requests */}
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
                      <th>Username</th>
                      <th>Email</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupDetails.pendingJoins.map((reqUser) => (
                      <tr key={reqUser._id}>
                        <td style={{ fontWeight: 600 }}>{reqUser.username}</td>
                        <td>{reqUser.email}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }} onClick={() => handleApproveJoin(reqUser._id)}>
                            Approve Join
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Leave Requests */}
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
                      <th>Username</th>
                      <th>Email</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupDetails.pendingLeaves.map((reqUser) => (
                      <tr key={reqUser._id}>
                        <td style={{ fontWeight: 600 }}>{reqUser.username}</td>
                        <td>{reqUser.email}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => handleApproveLeave(reqUser._id)}>
                            Approve Leave
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Active Members */}
          <div className="card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Users size={18} style={{ color: 'var(--primary)' }} /> Active Members ({groupDetails.members.length})
            </h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {groupDetails.members.map((member) => (
                    <tr key={member._id}>
                      <td style={{ fontWeight: 600 }}>{member.username}</td>
                      <td>{member.email}</td>
                      <td>
                        <span className={`badge ${member._id === groupDetails.adminId._id ? 'badge-accent' : 'badge-info'}`} style={{ fontSize: '0.7rem' }}>
                          {member._id === groupDetails.adminId._id ? 'Owner / Admin' : 'Player'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. Results & Calculations inputs panel */}
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
              <AlertTriangle size={16} /> Remember to save match results below before triggering calculations!
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

                  <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>
                      Wild Prediction Correct Players ({match.wildPredictionDetails || 'Optional Wild Prediction'})
                    </label>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                      {groupDetails.members
                        .filter(m => m._id !== AVERAGE_PLAYER_ID)
                        .map((p) => (
                          <label key={p._id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', cursor: 'pointer', background: 'rgba(255, 255, 255, 0.03)', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                            <input
                              type="checkbox"
                              checked={input.wildPredictionCorrectUsers?.includes(p._id)}
                              onChange={() => handleWildUserToggle(mId, p._id)}
                            />
                            {p.username}
                          </label>
                        ))}
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
