import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AccountView from './components/AccountView';
import Settings from './components/Settings';
import History from './components/History';
import AuditTrail from './components/AuditTrail';
import Configuration from './components/Configuration';
import { authAPI } from './services/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await authAPI.getCurrentUser();
      setUser(response.data.user);
      setIsAuthenticated(true);
    } catch (err) {
      localStorage.removeItem('token');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    checkAuth();
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <div>
        <header className="header">
          <div className="header-content">
            <Link to="/" style={{ textDecoration: 'none', color: '#262626' }}>
              <h1 style={{ fontSize: '24px', fontWeight: '600' }}>Instagram Tracker</h1>
            </Link>
            <nav className="nav">
              <Link to="/" className="nav-link">Dashboard</Link>
              <Link to="/audit" className="nav-link">Audit Trail</Link>
              <Link to="/config" className="nav-link">Configuration</Link>
              <Link to="/settings" className="nav-link">Settings</Link>
              {user && (
                <span style={{ color: '#8e8e8e', fontSize: '14px' }}>
                  {user.username}
                </span>
              )}
            </nav>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/account/:username" element={<AccountView />} />
          <Route path="/account/:username/history" element={<History />} />
          <Route path="/audit" element={<AuditTrail />} />
          <Route path="/config" element={<Configuration />} />
          <Route path="/settings" element={<Settings onLogout={handleLogout} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;