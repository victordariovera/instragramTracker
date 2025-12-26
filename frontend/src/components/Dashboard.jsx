import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountsAPI } from '../services/api';
import { formatDistanceToNow } from 'date-fns';

function Dashboard() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const response = await accountsAPI.getAll();
      setAccounts(response.data.accounts);
    } catch (err) {
      setError('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    setError('');

    if (!newUsername.trim()) {
      setError('Please enter an Instagram username');
      return;
    }

    setAdding(true);
    try {
      await accountsAPI.add(newUsername);
      setNewUsername('');
      setShowAddForm(false);
      await loadAccounts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add account');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading accounts...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h1 style={{ fontSize: '28px', fontWeight: '600' }}>Tracked Accounts</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : '+ Add Account'}
        </button>
      </div>

      {showAddForm && (
        <div className="card">
          <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Add Instagram Account</h2>
          <form onSubmit={handleAddAccount}>
            <input
              type="text"
              className="input"
              placeholder="Instagram username (e.g., instagram)"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              disabled={adding}
            />
            {error && <div className="error">{error}</div>}
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={adding}
              >
                {adding ? 'Adding...' : 'Add Account'}
              </button>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => {
                  setShowAddForm(false);
                  setError('');
                  setNewUsername('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="empty-state">
          <h2>No accounts tracked yet</h2>
          <p>Click "Add Account" to start tracking an Instagram account</p>
        </div>
      ) : (
        <div>
          {/* Error Banner for accounts with scraping errors */}
          {accounts.filter(acc => acc.lastError).length > 0 && (
            <div style={{
              marginBottom: '24px',
              padding: '16px',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '8px'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#856404' }}>
                ⚠️ Scraping Errors Detected
              </h3>
              {accounts.filter(acc => acc.lastError).map(account => (
                <div key={account.username} style={{ marginBottom: '8px', fontSize: '14px' }}>
                  <strong>@{account.username}:</strong> {account.lastError.message}
                  {account.lastError.type === 'rate_limit' && (
                    <span style={{ color: '#856404', marginLeft: '8px' }}>
                      (Rate limit - will retry automatically)
                    </span>
                  )}
                  {account.lastSuccessfulScrape && (
                    <div style={{ fontSize: '12px', color: '#856404', marginTop: '4px' }}>
                      Last successful scrape: {formatDistanceToNow(new Date(account.lastSuccessfulScrape), { addSuffix: true })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="grid">
            {accounts.map((account) => (
              <div
                key={account.username}
                className="account-card"
                onClick={() => navigate(`/account/${account.username}`)}
              >
                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                  {account.profilePhoto && (
                    <img 
                      src={account.profilePhoto} 
                      alt={account.username}
                      style={{ 
                        width: '60px', 
                        height: '60px', 
                        borderRadius: '50%', 
                        objectFit: 'cover',
                        flexShrink: 0
                      }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '20px', marginBottom: '4px', fontWeight: '600' }}>
                      @{account.username}
                    </h3>
                    {account.displayName && account.displayName !== account.username && (
                      <p style={{ color: '#8e8e8e', fontSize: '13px', marginBottom: '8px' }}>
                        {account.displayName}
                      </p>
                    )}
                  </div>
                </div>
                
                {account.description && (
                  <p style={{ color: '#8e8e8e', fontSize: '13px', marginBottom: '12px', lineHeight: '1.4' }}>
                    {account.description.length > 100 ? account.description.substring(0, 100) + '...' : account.description}
                  </p>
                )}
                
                <div style={{ 
                  display: 'flex', 
                  gap: '16px', 
                  fontSize: '14px',
                  marginBottom: '12px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #efefef'
                }}>
                  <span><strong>{account.followersCount?.toLocaleString() || 0}</strong> Followers</span>
                  <span><strong>{account.followingCount?.toLocaleString() || 0}</strong> Following</span>
                  <span><strong>{account.postsCount?.toLocaleString() || 0}</strong> Posts</span>
                </div>
                
                {account.lastError && (
                  <div style={{
                    marginBottom: '8px',
                    padding: '8px',
                    backgroundColor: '#f8d7da',
                    border: '1px solid #f5c6cb',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#721c24'
                  }}>
                    ⚠️ {account.lastError.message}
                  </div>
                )}
                
                <p style={{ color: '#8e8e8e', fontSize: '12px' }}>
                  {account.lastChecked 
                    ? `Updated ${formatDistanceToNow(new Date(account.lastChecked), { addSuffix: true })}`
                    : 'Not yet checked'
                  }
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;