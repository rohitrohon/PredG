import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, Users, Shield, ArrowRight, Share2, LogOut, Loader2, Hourglass } from 'lucide-react';

function GroupSelector({ user, onSelectGroup, onLogout }) {
  const [groups, setGroups] = useState({ joined: [], pendingJoin: [], pendingLeave: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form states
  const [joinCode, setJoinCode] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [submittingJoin, setSubmittingJoin] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getMyGroups();
      setGroups(data);
    } catch (err) {
      setError('Failed to retrieve your groups.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setError('');
    setSuccess('');
    setSubmittingJoin(true);

    try {
      const data = await api.joinGroup(joinCode.trim());
      setSuccess(data.message || 'Join request submitted! Awaiting admin approval.');
      setJoinCode('');
      fetchGroups();
    } catch (err) {
      setError(err.message || 'Failed to request to join group.');
    } finally {
      setSubmittingJoin(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    setError('');
    setSuccess('');
    setSubmittingCreate(true);

    try {
      const data = await api.createGroup(newGroupName.trim());
      setSuccess(`Group "${data.group.name}" created successfully! Code: ${data.group.code}`);
      setNewGroupName('');
      fetchGroups();
    } catch (err) {
      setError(err.message || 'Failed to create group.');
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleRequestLeave = async (groupId, groupName) => {
    const confirmLeave = window.confirm(
      `Are you sure you want to request to leave "${groupName}"? Your leave request must be approved by the administrator.`
    );
    if (!confirmLeave) return;

    setError('');
    setSuccess('');

    try {
      await api.requestLeave(groupId);
      setSuccess('Leave request submitted successfully. Awaiting administrator approval.');
      fetchGroups();
    } catch (err) {
      setError(err.message || 'Failed to submit leave request.');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: '1rem' }}>
        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary)' }} />
        <span>Loading your leagues...</span>
      </div>
    );
  }

  const isAdmin = user && user.role === 'admin';

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '0 1.5rem' }}>
      
      {/* Top Welcome Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Welcome to <span className="text-gradient">PredG</span></h1>
          <p style={{ color: 'var(--text-muted)' }}>Choose a league to compete in or request to join a new one.</p>
        </div>
        <button className="btn btn-secondary" onClick={onLogout}>
          <LogOut size={16} /> Log Out
        </button>
      </div>

      {error && (
        <div className="card" style={{ background: 'var(--danger-glow)', color: 'var(--danger)', marginBottom: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="card" style={{ background: 'var(--success-glow)', color: 'var(--success)', marginBottom: '1.5rem', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          {success}
        </div>
      )}

      {/* 1. Joined Groups */}
      <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Your Leagues</h3>
      
      {groups.joined.length === 0 && groups.pendingLeave.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', marginBottom: '2.5rem', color: 'var(--text-muted)' }}>
          You haven't joined any prediction leagues yet. Use the codes below to join one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
          {/* Active Memberships */}
          {groups.joined.map((group) => {
            const isGroupAdmin = group.adminId._id.toString() === user.id;
            return (
              <div key={group._id} className="card" style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                borderLeft: isGroupAdmin ? '4px solid var(--accent)' : '4px solid var(--primary)',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div>
                  <h3 style={{ margin: 0 }}>{group.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Users size={14} /> {group.members.length} Members
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Shield size={14} style={{ color: isGroupAdmin ? 'var(--accent)' : 'var(--primary)' }} />
                      {isGroupAdmin ? 'Admin (Owner)' : 'Player'}
                    </span>
                    {isGroupAdmin && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--warning)', fontWeight: 600 }}>
                        <Share2 size={12} /> Invite Code: {group.code}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  {!isGroupAdmin && (
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', color: 'var(--danger)' }}
                      onClick={() => handleRequestLeave(group._id, group.name)}
                    >
                      Request Leave
                    </button>
                  )}
                  <button 
                    className="btn btn-primary" 
                    onClick={() => onSelectGroup(group)}
                  >
                    Enter League <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Pending Leaves (Groups they are still in but waiting to leave) */}
          {groups.pendingLeave.map((group) => (
            <div key={group._id} className="card" style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              borderLeft: '4px solid var(--danger)',
              opacity: 0.85,
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-muted)' }}>{group.name}</h3>
                <span className="badge badge-danger" style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>
                  LEAVE REQUEST PENDING APPROVAL
                </span>
              </div>
              <button 
                className="btn btn-primary" 
                onClick={() => onSelectGroup(group)}
              >
                Enter League <ArrowRight size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 2. Pending Join Requests */}
      {groups.pendingJoin.length > 0 && (
        <div style={{ marginBottom: '2.5rem' }}>
          <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Pending Join Requests</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {groups.pendingJoin.map((group) => (
              <div key={group._id} className="card" style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                borderLeft: '4px solid var(--warning)'
              }}>
                <div>
                  <h4 style={{ margin: 0 }}>{group.name}</h4>
                  <small style={{ color: 'var(--text-muted)' }}>Admin: {group.adminId.username}</small>
                </div>
                <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Hourglass size={12} /> Awaiting Approval
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Action panels (Join / Create) */}
      <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 1fr' : '1fr', gap: '2rem' }}>
        {/* Join League Card */}
        <div className="card">
          <h3>Join a League</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            Enter the 6-character league join code shared by your administrator.
          </p>
          <form onSubmit={handleJoinGroup} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              className="form-input" 
              maxLength="6"
              style={{ textTransform: 'uppercase', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.1em', textAlign: 'center' }}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="CODE"
              required
            />
            <button type="submit" className="btn btn-primary" disabled={submittingJoin} style={{ whiteSpace: 'nowrap' }}>
              {submittingJoin ? 'Requesting...' : 'Join Code'}
            </button>
          </form>
        </div>

        {/* Create League Card (Admin Only) */}
        {isAdmin && (
          <div className="card" style={{ border: '1px solid rgba(168, 85, 247, 0.2)', background: 'rgba(168, 85, 247, 0.03)' }}>
            <h3 style={{ color: 'var(--accent)' }}>Create a League</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Set up a self-contained league. Joining codes are auto-assigned immediately.
            </p>
            <form onSubmit={handleCreateGroup} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                className="form-input" 
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="League name"
                required
              />
              <button type="submit" className="btn btn-accent" disabled={submittingCreate} style={{ whiteSpace: 'nowrap' }}>
                {submittingCreate ? 'Creating...' : 'Create League'}
              </button>
            </form>
          </div>
        )}
      </div>

    </div>
  );
}

export default GroupSelector;
