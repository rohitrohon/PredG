import React, { useEffect, useState } from 'react';
import api from './api';
import Navbar from './components/Navbar';
import LoginSignup from './components/LoginSignup';
import GroupSelector from './components/GroupSelector';
import Leaderboard from './components/Leaderboard';
import PredictionForm from './components/PredictionForm';
import Battles from './components/Battles';
import AdminPanel from './components/AdminPanel';
import Results from './components/Results';
import Live from './components/Live';

function App() {
  const [user, setUser] = useState(null);
  const [activeGroup, setActiveGroup] = useState(null);
  const [userStanding, setUserStanding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (activeGroup && user) {
      refreshUserStanding();
      if (user.role === 'admin') {
        setActiveTab('admin');
      }
    }
  }, [activeGroup, user]);

  const checkAuth = async () => {
    const token = api.getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const data = await api.getMe();
      setUser(data);

      // Auto-enter if user belongs to exactly one group
      const groupsData = await api.getMyGroups();
      if (groupsData.joined.length === 1 && groupsData.pendingLeave.length === 0) {
        setActiveGroup(groupsData.joined[0]);
      }
    } catch (error) {
      console.error('Session expired or invalid.');
      api.setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshUserStanding = async () => {
    if (!activeGroup || !user) return;
    try {
      const standings = await api.getGroupStandings(activeGroup._id);
      const standing = standings.find(s => s.userId && s.userId._id === user.id);
      setUserStanding(standing || null);
    } catch (err) {
      console.error('Error fetching standing:', err);
    }
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setActiveGroup(null);
    setUserStanding(null);
    setActiveTab('home');
  };

  const refreshUserProfile = async () => {
    try {
      const data = await api.getMe();
      setUser(data);
      await refreshUserStanding();
    } catch (error) {
      console.error('Failed to refresh profile.');
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-dark)'
      }}>
        <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>Loading PredG...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginSignup onAuthSuccess={(authenticatedUser) => setUser(authenticatedUser)} />;
  }

  // If no group is actively selected, show GroupSelector landing screen
  if (!activeGroup) {
    return (
      <GroupSelector 
        user={user} 
        onSelectGroup={(group) => setActiveGroup(group)} 
        onLogout={handleLogout} 
      />
    );
  }

  return (
    <div className="app-container">
      <Navbar 
        user={user} 
        group={activeGroup}
        standing={userStanding}
        onLogout={handleLogout} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onSwitchGroup={() => { setActiveGroup(null); setUserStanding(null); }}
      />
      <main className="main-content">
        {activeTab === 'home' && (
          <Live 
            groupId={activeGroup._id}
            user={user}
            onNavigateToPredictions={() => setActiveTab('predictions')}
          />
        )}
        {activeTab === 'leaderboard' && (
          <Leaderboard 
            groupId={activeGroup._id} 
          />
        )}
        {activeTab === 'predictions' && (
          <PredictionForm 
            user={user} 
            groupId={activeGroup._id}
            standing={userStanding}
            onPointsUpdate={refreshUserProfile} 
          />
        )}
        {activeTab === 'battles' && (
          <Battles 
            user={user} 
            groupId={activeGroup._id}
          />
        )}
        {activeTab === 'results' && (
          <Results 
            groupId={activeGroup._id}
            user={user}
          />
        )}
        {activeTab === 'admin' && (
          <AdminPanel 
            groupId={activeGroup._id} 
          />
        )}
      </main>
    </div>
  );
}

export default App;
