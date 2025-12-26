import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auditAPI } from '../services/api';
import { format } from 'date-fns';

function AuditTrail() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');

  useEffect(() => {
    loadLogs();
  }, [pagination.page, eventTypeFilter, accountFilter]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await auditAPI.getAll(pagination.page, pagination.limit, eventTypeFilter || null, accountFilter || null);
      setLogs(response.data.logs);
      setPagination(response.data.pagination);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    setPagination({ ...pagination, page: newPage });
  };

  const handleFilterChange = () => {
    setPagination({ ...pagination, page: 1 });
  };

  const getEventTypeLabel = (eventType) => {
    return eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getEventColor = (eventType, success) => {
    if (!success) return '#ed4956';
    if (eventType.includes('failed')) return '#ed4956';
    if (eventType.includes('completed') || eventType.includes('success')) return '#00ba7c';
    return '#8e8e8e';
  };

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

        <h1 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '16px' }}>
          Audit Trail
        </h1>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '14px', fontWeight: '600' }}>Event Type:</label>
            <select
              value={eventTypeFilter}
              onChange={(e) => {
                setEventTypeFilter(e.target.value);
                handleFilterChange();
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #dbdbdb',
                fontSize: '14px'
              }}
            >
              <option value="">All Events</option>
              <option value="scraping_started">Scraping Started</option>
              <option value="scraping_completed">Scraping Completed</option>
              <option value="scraping_failed">Scraping Failed</option>
              <option value="login_success">Login Success</option>
              <option value="login_failed">Login Failed</option>
              <option value="account_added">Account Added</option>
              <option value="account_deleted">Account Deleted</option>
              <option value="follower_added">Follower Added</option>
              <option value="follower_removed">Follower Removed</option>
              <option value="following_added">Following Added</option>
              <option value="following_removed">Following Removed</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '14px', fontWeight: '600' }}>Account:</label>
            <input
              type="text"
              value={accountFilter}
              onChange={(e) => {
                setAccountFilter(e.target.value);
                handleFilterChange();
              }}
              placeholder="Username"
              style={{
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #dbdbdb',
                fontSize: '14px',
                width: '150px'
              }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading audit logs...</div>
      ) : (
        <>
          <div className="card">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #efefef' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Timestamp</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Event Type</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Account</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Affected User</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Details</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#8e8e8e' }}>
                        No audit logs found
                      </td>
                    </tr>
                  ) : (
                    logs.map((log, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #efefef' }}>
                        <td style={{ padding: '12px', fontSize: '14px' }}>
                          {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ 
                            color: getEventColor(log.eventType, log.success),
                            fontWeight: '600',
                            fontSize: '14px'
                          }}>
                            {getEventTypeLabel(log.eventType)}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px' }}>
                          {log.trackedAccountUsername ? (
                            <a 
                              href={`/account/${log.trackedAccountUsername}`}
                              onClick={(e) => {
                                e.preventDefault();
                                navigate(`/account/${log.trackedAccountUsername}`);
                              }}
                              style={{ color: '#0095f6', textDecoration: 'none' }}
                            >
                              @{log.trackedAccountUsername}
                            </a>
                          ) : (
                            <span style={{ color: '#8e8e8e' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px' }}>
                          {log.affectedUsername ? (
                            <a 
                              href={`https://instagram.com/${log.affectedUsername}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#0095f6', textDecoration: 'none' }}
                            >
                              @{log.affectedUsername}
                            </a>
                          ) : (
                            <span style={{ color: '#8e8e8e' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#8e8e8e', maxWidth: '300px' }}>
                          {log.details || '-'}
                          {log.error && (
                            <div style={{ color: '#ed4956', marginTop: '4px', fontSize: '12px' }}>
                              Error: {log.error}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ 
                            color: log.success ? '#00ba7c' : '#ed4956',
                            fontWeight: '600',
                            fontSize: '14px'
                          }}>
                            {log.success ? '✓ Success' : '✗ Failed'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {pagination.pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                style={{ padding: '8px 16px' }}
              >
                Previous
              </button>
              <span style={{ padding: '8px 16px', display: 'flex', alignItems: 'center' }}>
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </span>
              <button
                className="btn btn-secondary"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                style={{ padding: '8px 16px' }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AuditTrail;

