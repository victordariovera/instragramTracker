import React, { useState, useEffect } from 'react';
import { authAPI } from '../services/api';

function Login({ onLogin }) {
  const [setupRequired, setSetupRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    checkSetup();
  }, []);

  const checkSetup = async () => {
    try {
      const response = await authAPI.checkSetup();
      setSetupRequired(response.data.setupRequired);
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }

    try {
      let response;
      if (setupRequired) {
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          return;
        }
        response = await authAPI.setup(username, password);
      } else {
        response = await authAPI.login(username, password);
      }

      localStorage.setItem('token', response.data.token);
      onLogin();
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed');
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#fafafa'
    }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Instagram Tracker</h1>
          <p style={{ color: '#8e8e8e', fontSize: '14px' }}>
            {setupRequired ? 'Create your account' : 'Sign in to continue'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            className="input"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />

          <input
            type="password"
            className="input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={setupRequired ? 'new-password' : 'current-password'}
          />

          {setupRequired && (
            <p style={{ fontSize: '12px', color: '#8e8e8e', marginBottom: '12px' }}>
              Password must be at least 6 characters
            </p>
          )}

          {error && <div className="error">{error}</div>}

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '12px' }}
          >
            {setupRequired ? 'Create Account' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;