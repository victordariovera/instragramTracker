import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { accountsAPI, exportAPI } from '../services/api';
import DataSection from './DataSection';
import { format } from 'date-fns';

function AccountView() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [stats, setStats] = useState([]);
  const [followerChanges, setFollowerChanges] = useState([]);
  const [followingChanges, setFollowingChanges] = useState([]);
  const [mutualChanges, setMutualChanges] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [removedFollowers, setRemovedFollowers] = useState([]);
  const [removedFollowing, setRemovedFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAccountData();
  }, [username]);

  const loadAccountData = async () => {
    try {
      const [accountRes, statsRes, followerRes, followingRes, mutualRes, activityRes, removedFollowersRes, removedFollowingRes] = await Promise.all([
        accountsAPI.getDetails(username),
        accountsAPI.getStats(username, 30),
        accountsAPI.getRecentChanges(username, 'followers', 10),
        accountsAPI.getRecentChanges(username, 'following', 10),
        accountsAPI.getRecentChanges(username, 'mutual', 10),
        accountsAPI.getRecentActivity(username, 10),
        accountsAPI.getRemovedFollowers(username),
        accountsAPI.getRemovedFollowing(username)
      ]);

      setAccount(accountRes.data.account);
      setStats(statsRes.data.stats);
      setFollowerChanges(followerRes.data.changes);
      setFollowingChanges(followingRes.data.changes);
      setMutualChanges(mutualRes.data.changes);
      setRecentActivity(activityRes.data.activity || []);
      setRemovedFollowers(removedFollowersRes.data.removed || []);
      setRemovedFollowing(removedFollowingRes.data.removed || []);
    } catch (err) {
      setError('Failed to load account data');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to stop tracking @${username}?`)) {
      return;
    }

    try {
      await accountsAPI.delete(username);
      navigate('/');
    } catch (err) {
      alert('Failed to delete account');
    }
  };

  const handleExportAll = () => {
    const token = localStorage.getItem('token');
    const url = exportAPI.getAllCSV(username);
    
    fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => response.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${username}_all_data_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    })
    .catch(err => {
      console.error('Export failed:', err);
      alert('Failed to export data');
    });
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading account data...</div>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="container">
        <div className="error">{error || 'Account not found'}</div>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ marginBottom: '24px' }}>
        <button 
          className="btn btn-secondary"
          onClick={() => navigate('/')}
          style={{ marginBottom: '16px' }}
        >
          ← Back to Dashboard
        </button>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <h1 style={{ fontSize: '32px', marginBottom: '8px', fontWeight: '600' }}>
                @{account.username}
              </h1>
              <div style={{ color: '#8e8e8e', fontSize: '14px' }}>
                {account.profilePhoto && (
                  <img 
                    src={account.profilePhoto} 
                    alt={account.username}
                    style={{ 
                      width: '80px', 
                      height: '80px', 
                      borderRadius: '50%', 
                      marginBottom: '12px',
                      objectFit: 'cover'
                    }}
                  />
                )}
                {account.displayName && account.displayName !== account.username && (
                  <p style={{ fontWeight: '600', color: '#262626', marginBottom: '8px' }}>
                    {account.displayName}
                  </p>
                )}
                {account.description && (
                  <p style={{ marginBottom: '12px', fontSize: '13px' }}>
                    {account.description}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                  <span><strong>{(account.followerCount || account.followersCount || 0).toLocaleString()}</strong> Followers</span>
                  <span><strong>{(account.followingCount || 0).toLocaleString()}</strong> Following</span>
                  <span><strong>{(account.postsCount || 0).toLocaleString()}</strong> Posts</span>
                </div>
                <p>Mutual Friends: {account.mutualFriendsCount || 0}</p>
                {account.lastChecked && (
                  <p style={{ marginTop: '8px', fontSize: '12px' }}>
                    Last checked: {new Date(account.lastChecked).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn btn-primary"
                onClick={handleExportAll}
              >
                Export All Data
              </button>
              <button 
                className="btn btn-danger"
                onClick={handleDelete}
              >
                Remove Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Three graphs in one row - square layout */}
      <div className="graphs-grid" style={{ marginBottom: '24px' }}>
        <DataSection
          title="Followers"
          type="followers"
          username={username}
          stats={stats}
          recentChanges={followerChanges}
          color="#0095f6"
          compact={true}
        />
        <DataSection
          title="Following"
          type="following"
          username={username}
          stats={stats}
          recentChanges={followingChanges}
          color="#8e44ad"
          compact={true}
        />
        <DataSection
          title="Mutual Friends"
          type="mutual"
          username={username}
          stats={stats}
          recentChanges={mutualChanges}
          color="#00ba7c"
          compact={true}
        />
      </div>

      {/* Recent Activity Section */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600' }}>Recent Activity (Last 10 Events)</h2>
          <Link to={`/account/${username}/history`} className="btn btn-secondary" style={{ fontSize: '13px', padding: '8px 16px' }}>
            View All History →
          </Link>
        </div>
        
        {recentActivity.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#8e8e8e' }}>
            No activity recorded yet
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {recentActivity.map((event, index) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                backgroundColor: '#fafafa',
                borderRadius: '8px',
                border: '1px solid #efefef'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {event.affectedProfilePhoto && (
                    <img 
                      src={event.affectedProfilePhoto} 
                      alt={event.affectedUsername}
                      style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  )}
                  <div>
                    <a 
                      href={`https://instagram.com/${event.affectedUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontWeight: '600', color: '#262626', textDecoration: 'none' }}
                    >
                      @{event.affectedUsername}
                    </a>
                    {event.affectedDisplayName && event.affectedDisplayName !== event.affectedUsername && (
                      <div style={{ fontSize: '12px', color: '#8e8e8e' }}>{event.affectedDisplayName}</div>
                    )}
                    <div style={{ fontSize: '12px', color: '#8e8e8e', marginTop: '4px' }}>
                      {format(new Date(event.timestamp), 'MMM d, yyyy')} at {event.hour || format(new Date(event.timestamp), 'HH:mm')}
                    </div>
                  </div>
                </div>
                <div>
                  {event.eventType.includes('added') ? (
                    <span style={{ color: '#00ba7c', fontWeight: '600' }}>+ {event.eventType.replace('_', ' ')}</span>
                  ) : (
                    <span style={{ color: '#ed4956', fontWeight: '600' }}>- {event.eventType.replace('_', ' ')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Removed Followers Section */}
      {removedFollowers.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Removed Followers</h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {removedFollowers.slice(0, 10).map((removed, index) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                backgroundColor: '#fff5f5',
                borderRadius: '8px',
                border: '1px solid #fed7d7'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {removed.profilePhoto && (
                    <img 
                      src={removed.profilePhoto} 
                      alt={removed.username}
                      style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  )}
                  <div>
                    <a 
                      href={`https://instagram.com/${removed.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontWeight: '600', color: '#262626', textDecoration: 'none' }}
                    >
                      @{removed.username}
                    </a>
                    {removed.displayName && removed.displayName !== removed.username && (
                      <div style={{ fontSize: '12px', color: '#8e8e8e' }}>{removed.displayName}</div>
                    )}
                    <div style={{ fontSize: '12px', color: '#8e8e8e', marginTop: '4px' }}>
                      Removed: {format(new Date(removed.removedAt), 'MMM d, yyyy HH:mm')}
                    </div>
                  </div>
                </div>
                <span style={{ color: '#ed4956', fontWeight: '600' }}>Removed</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Removed Following Section */}
      {removedFollowing.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Removed Following</h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {removedFollowing.slice(0, 10).map((removed, index) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                backgroundColor: '#fff5f5',
                borderRadius: '8px',
                border: '1px solid #fed7d7'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {removed.profilePhoto && (
                    <img 
                      src={removed.profilePhoto} 
                      alt={removed.username}
                      style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  )}
                  <div>
                    <a 
                      href={`https://instagram.com/${removed.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontWeight: '600', color: '#262626', textDecoration: 'none' }}
                    >
                      @{removed.username}
                    </a>
                    {removed.displayName && removed.displayName !== removed.username && (
                      <div style={{ fontSize: '12px', color: '#8e8e8e' }}>{removed.displayName}</div>
                    )}
                    <div style={{ fontSize: '12px', color: '#8e8e8e', marginTop: '4px' }}>
                      Removed: {format(new Date(removed.removedAt), 'MMM d, yyyy HH:mm')}
                    </div>
                  </div>
                </div>
                <span style={{ color: '#ed4956', fontWeight: '600' }}>Removed</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AccountView;