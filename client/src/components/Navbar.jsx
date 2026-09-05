import React, { useState } from 'react';
import { LogOut, Trophy, Sword, User, ShieldAlert, BookOpen, Layers, BarChart3, Home, Edit2, ZoomOut } from 'lucide-react';
import api from '../api';

function Navbar({ user, group, standing, onLogout, activeTab, setActiveTab, onSwitchGroup, onUserUpdate, tableZoom = '100', setTableZoom }) {
  const adminIdStr = typeof group?.adminId === 'object' ? group?.adminId?._id?.toString() : group?.adminId?.toString();
  const isGroupAdmin = (adminIdStr && user && adminIdStr === user.id) || user?.role === 'admin';

  const [showEditModal, setShowEditModal] = useState(false);
  const [editUsernameVal, setEditUsernameVal] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [editError, setEditError] = useState('');

  const changeCount = user?.usernameChangeCount || 0;
  const remainingEdits = Math.max(0, 2 - changeCount);

  const handleOpenEditModal = () => {
    if (changeCount >= 2) {
      alert('Maximum limit reached!\n\nYou have already edited your username 2 times (the maximum limit allowed).');
      return;
    }
    setEditUsernameVal(user?.username || '');
    setEditError('');
    setShowEditModal(true);
  };

  const handleSaveUsername = async (e) => {
    e.preventDefault();
    if (!editUsernameVal.trim()) {
      setEditError('Username cannot be empty.');
      return;
    }

    if (editUsernameVal.trim() === user?.username) {
      setEditError('New username must be different from current username.');
      return;
    }

    try {
      setSavingUsername(true);
      setEditError('');
      const res = await api.updateUsername(editUsernameVal.trim());
      
      if (onUserUpdate) {
        onUserUpdate(res.user);
      }
      
      setShowEditModal(false);
      alert(`✅ Username successfully changed to "${res.user.username}"! (${Math.max(0, 2 - res.user.usernameChangeCount)} changes remaining)`);
    } catch (err) {
      setEditError(err.message || 'Failed to update username.');
    } finally {
      setSavingUsername(false);
    }
  };

  return (
    <nav style={{
      background: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'var(--glass-blur)',
      borderBottom: '1px solid var(--border-color)',
      padding: '0.85rem 1.5rem',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Brand & Active Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => setActiveTab('home')}>
            <Trophy size={24} className="text-gradient" />
            <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.03em' }}>
              PREDG
            </span>
          </div>
          
          <div style={{ borderLeft: '1px solid var(--border-color)', height: '20px' }}></div>
          
          <div className="badge badge-info" style={{ fontSize: '0.85rem', textTransform: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Layers size={14} /> {group?.name}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {user?.role === 'admin' ? (
            <button 
              className={`btn ${activeTab === 'admin' ? 'btn-accent' : 'btn-secondary'}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              onClick={() => setActiveTab('admin')}
            >
              <ShieldAlert size={16} /> Admin Panel
            </button>
          ) : (
            <>
              <button 
                className={`btn ${activeTab === 'home' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                onClick={() => setActiveTab('home')}
              >
                <Home size={16} /> Home
              </button>

              <button 
                className={`btn ${activeTab === 'leaderboard' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                onClick={() => setActiveTab('leaderboard')}
              >
                <Trophy size={16} /> Standings
              </button>
              
              <button 
                className={`btn ${activeTab === 'predictions' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                onClick={() => setActiveTab('predictions')}
              >
                <BookOpen size={16} /> Predictions
              </button>
              
              <button 
                className={`btn ${activeTab === 'battles' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                onClick={() => setActiveTab('battles')}
              >
                <Sword size={16} /> Battles
              </button>

              <button 
                className={`btn ${activeTab === 'results' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                onClick={() => setActiveTab('results')}
              >
                <BarChart3 size={16} /> Results
              </button>

              {isGroupAdmin && (
                <button 
                  className={`btn ${activeTab === 'admin' ? 'btn-accent' : 'btn-secondary'}`}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                  onClick={() => setActiveTab('admin')}
                >
                  <ShieldAlert size={16} /> Admin Panel
                </button>
              )}
            </>
          )}
        </div>

        {/* User Group Stats / Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {standing && (
            <div className="card" style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: 'rgba(0, 0, 0, 0.2)'
            }}>
              <div>
                PTS: <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{standing.totalPoints}</span>
              </div>
              
              <div style={{ borderLeft: '1px solid var(--border-color)', height: '14px' }}></div>
              
              <div>
                BP: <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{standing.battlePoints}</span>
              </div>

              {standing.rank && (
                <>
                  <div style={{ borderLeft: '1px solid var(--border-color)', height: '14px' }}></div>
                  <div>
                    RANK: <span style={{ color: 'var(--warning)', fontWeight: 700 }}>#{standing.rank}</span>
                  </div>
                </>
              )}
            </div>
          )}

          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', borderRadius: '8px' }}
            onClick={onSwitchGroup}
          >
            Leagues
          </button>

          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.5rem', borderRadius: '8px' }}
            onClick={onLogout}
            title="Log Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* ACTIVE USERFIELD BAR (JUST BELOW TOP MENU BAR) */}
      <div style={{
        maxWidth: '1200px',
        margin: '0.75rem auto 0',
        paddingTop: '0.65rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
        fontSize: '0.85rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <User size={15} style={{ color: 'var(--primary)' }} /> Active User:
          </span>
          <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>
            {user?.username}
          </span>
          
          <button
            type="button"
            className="btn btn-secondary"
            style={{ 
              padding: '0.2rem 0.55rem', 
              fontSize: '0.75rem', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.3rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)'
            }}
            onClick={handleOpenEditModal}
            title={changeCount >= 2 ? 'Limit Reached (Max 2 Username Changes)' : 'Edit Username'}
          >
            <Edit2 size={13} style={{ color: changeCount >= 2 ? 'var(--danger)' : 'var(--accent)' }} />
            <span>Edit</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(255,255,255,0.05)', padding: '0.15rem 0.4rem', borderRadius: '6px', border: '1px solid var(--border-color)', marginLeft: '0.25rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <ZoomOut size={12} /> View:
            </span>
            {[
              { label: '100%', val: '100' },
              { label: '50%', val: '50' },
              { label: '25%', val: '25' },
              { label: '12.5%', val: '12' }
            ].map(z => (
              <button
                key={z.val}
                type="button"
                onClick={() => setTableZoom && setTableZoom(z.val)}
                style={{
                  padding: '0.15rem 0.4rem',
                  fontSize: '0.65rem',
                  fontWeight: tableZoom === z.val ? 700 : 500,
                  borderRadius: '4px',
                  border: 'none',
                  background: tableZoom === z.val ? 'var(--primary)' : 'transparent',
                  color: tableZoom === z.val ? '#0f172a' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {z.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* EDIT USERNAME MODAL OVERLAY */}
      {showEditModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.82)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '420px',
            background: 'rgba(15, 23, 42, 0.96)',
            border: '1px solid var(--primary-glow)',
            borderRadius: '16px',
            padding: '1.75rem',
            boxShadow: '0 20px 50px rgba(0,0,0,0.7)'
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
              <Edit2 size={20} /> Edit Username
            </h3>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              You can change your username a <strong>maximum of 2 times</strong> per account. 
              <br />
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                Changes remaining: {remainingEdits} of 2
              </span>
            </p>

            {editError && (
              <div className="card" style={{ 
                color: 'var(--danger)', 
                background: 'rgba(239, 68, 68, 0.1)', 
                borderColor: 'rgba(239, 68, 68, 0.3)',
                padding: '0.6rem 0.8rem',
                fontSize: '0.85rem',
                marginBottom: '1rem'
              }}>
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveUsername}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.35rem', display: 'block' }}>
                  New Username
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={editUsernameVal}
                  onChange={(e) => setEditUsernameVal(e.target.value)}
                  placeholder="Enter new username"
                  autoFocus
                  required
                  style={{ fontSize: '0.95rem', padding: '0.65rem 0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                  disabled={savingUsername}
                  style={{ padding: '0.55rem 1.25rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingUsername}
                  style={{ padding: '0.55rem 1.5rem', fontWeight: 700 }}
                >
                  {savingUsername ? 'Saving...' : 'Save Username'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
