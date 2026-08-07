import React, { useState } from 'react';
import api from '../api';

function LoginSignup({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [signupCode, setSignupCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let data;
      if (isLogin) {
        data = await api.login(emailOrUsername, password);
      } else {
        data = await api.signup(name, username, email, password, signupCode);
      }
      onAuthSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      padding: '1rem'
    }}>
      <div className="card" style={{ maxWidth: '420px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ borderBottom: 'none', marginBottom: '0.25rem', paddingBottom: 0 }}>
            <span className="text-gradient">PredG</span>
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>Exclusive Prediction Game</p>
        </div>

        <div style={{ 
          display: 'flex', 
          background: 'rgba(0, 0, 0, 0.2)', 
          borderRadius: '10px', 
          padding: '0.25rem',
          marginBottom: '1.5rem'
        }}>
          <button 
            className="btn" 
            style={{ 
              flex: 1, 
              background: isLogin ? 'var(--primary)' : 'transparent',
              color: isLogin ? 'var(--bg-darker)' : 'var(--text-muted)',
              padding: '0.5rem'
            }}
            onClick={() => { setIsLogin(true); setError(''); }}
          >
            Login
          </button>
          <button 
            className="btn" 
            style={{ 
              flex: 1, 
              background: !isLogin ? 'var(--primary)' : 'transparent',
              color: !isLogin ? 'var(--bg-darker)' : 'var(--text-muted)',
              padding: '0.5rem'
            }}
            onClick={() => { setIsLogin(false); setError(''); }}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div style={{
            background: 'var(--danger-glow)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: 'var(--danger)',
            padding: '0.75rem',
            borderRadius: '8px',
            fontSize: '0.9rem',
            marginBottom: '1rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isLogin ? (
            <>
              <div className="form-group">
                <label className="form-label">Email or Username</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  placeholder="enter email or username"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. game_star"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. user@example.com"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="min 6 characters"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Registration Signup Code</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={signupCode}
                  onChange={(e) => setSignupCode(e.target.value)}
                  placeholder="e.g. PREDG_SECRET"
                  required
                />
              </div>
            </>
          )}

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : isLogin ? 'Login to Game' : 'Register Account'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginSignup;
