import React from 'react';
import { LogOut, Trophy, Sword, User, ShieldAlert, BookOpen, Layers, BarChart3, Home } from 'lucide-react';

function Navbar({ user, group, standing, onLogout, activeTab, setActiveTab, onSwitchGroup }) {
  const adminIdStr = typeof group?.adminId === 'object' ? group?.adminId?._id?.toString() : group?.adminId?.toString();
  const isGroupAdmin = (adminIdStr && user && adminIdStr === user.id) || user?.role === 'admin';

  return (
    <nav style={{
      background: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'var(--glass-blur)',
      borderBottom: '1px solid var(--border-color)',
      padding: '1rem 1.5rem',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <User size={14} style={{ color: 'var(--primary)' }} />
                <span style={{ fontWeight: 600 }}>{user?.username}</span>
              </div>
              
              <div style={{ borderLeft: '1px solid var(--border-color)', height: '14px' }}></div>
              
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
    </nav>
  );
}

export default Navbar;
