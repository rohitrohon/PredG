import React, { useState } from 'react';
import api from '../api';

function LoginSignup({ onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot'
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [signupCode, setSignupCode] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const data = await api.login(emailOrUsername.trim(), password);
        onAuthSuccess(data.user);
      } else if (mode === 'signup') {
        const data = await api.signup(name.trim(), username.trim(), email.trim(), password, signupCode.trim());
        onAuthSuccess(data.user);
      } else if (mode === 'forgot') {
        const res = await api.resetPassword(name.trim(), email.trim(), newPassword);
        setSuccessMsg(res.message || 'Password successfully reset!');
        setPassword(newPassword);
        setEmailOrUsername(email.trim());
        setMode('login');
      }
    } catch (err) {
      setError(err.message || 'Action failed. Please check details and try again.');
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
          <p style={{ color: 'var(--text-muted)' }}>
            {mode === 'forgot' ? 'Reset Your Password' : 'Exclusive Prediction Game'}
          </p>
        </div>

        {mode !== 'forgot' && (
          <div style={{ 
            display: 'flex', 
            background: 'rgba(0, 0, 0, 0.2)', 
            borderRadius: '10px', 
            padding: '0.25rem',
            marginBottom: '1.5rem'
          }}>
            <button 
              type="button"
              className="btn" 
              style={{ 
                flex: 1, 
                background: mode === 'login' ? 'var(--primary)' : 'transparent',
                color: mode === 'login' ? 'var(--bg-darker)' : 'var(--text-muted)',
                padding: '0.5rem'
              }}
              onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
            >
              Login
            </button>
            <button 
              type="button"
              className="btn" 
              style={{ 
                flex: 1, 
                background: mode === 'signup' ? 'var(--primary)' : 'transparent',
                color: mode === 'signup' ? 'var(--bg-darker)' : 'var(--text-muted)',
                padding: '0.5rem'
              }}
              onClick={() => { setMode('signup'); setError(''); setSuccessMsg(''); }}
            >
              Sign Up
            </button>
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            color: '#4ade80',
            padding: '0.75rem',
            borderRadius: '8px',
            fontSize: '0.9rem',
            marginBottom: '1rem',
            textAlign: 'center'
          }}>
            {successMsg}
          </div>
        )}

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
          {mode === 'login' && (
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
              <div style={{ textAlign: 'right', marginTop: '-0.5rem', marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(''); setSuccessMsg(''); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    textDecoration: 'underline',
                    padding: 0
                  }}
                >
                  Forgot Password?
                </button>
              </div>
            </>
          )}

          {mode === 'signup' && (
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

          {mode === 'forgot' && (
            <>
              <div className="form-group">
                <label className="form-label">Full Name (Registered Name)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rohit"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Registered Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. rrskane@gmail.com"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="enter new password (min 6 chars)"
                  required
                />
              </div>
            </>
          )}

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '0.75rem' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Login to Game' : mode === 'signup' ? 'Register Account' : 'Reset Password'}
          </button>

          {mode === 'forgot' && (
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  textDecoration: 'underline'
                }}
              >
                ← Back to Login
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default LoginSignup;
