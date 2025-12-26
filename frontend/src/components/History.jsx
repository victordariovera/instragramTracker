import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { accountsAPI } from '../services/api';
import { format } from 'date-fns';

function History() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [eventTypeFilter, setEventTypeFilter] = useState('');

  useEffect(() => {
    loadHistory();
  }, [username, pagination.page, eventTypeFilter]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await accountsAPI.getHistory(username, pagination.page, pagination.limit, eventTypeFilter || null);
      setHistory(response.data.history);
      setPagination(response.data.pagination);
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    setPagination({ ...pagination, page: newPage });
  };

  const handleFilterChange = (e) => {
    setEventTypeFilter(e.target.value);
    setPagination({ ...pagination, page: 1 });
  };

  const getEventTypeLabel = (eventType) => {
    return eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getEventColor = (eventType) => {
    if (eventType.includes('added')) return '#00ba7c';
    if (eventType.includes('removed')) return '#ed4956';
    return '#8e8e8e';
  };

  return (
    <div className="container">
      <div style={{ marginBottom: '24px' }}>
        <button 
          className="btn btn-secondary"
          onClick={() => navigate(`/account/${username}`)}
          style={{ marginBottom: '16px' }}
        >
          ← Back to Account
        </button>

        <h1 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '16px' }}>
          Event History - @{username}
        </h1>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
          <label style={{ fontSize: '14px', fontWeight: '600' }}>Filter by Event Type:</label>
          <select
            value={eventTypeFilter}
            onChange={handleFilterChange}
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #dbdbdb',
              fontSize: '14px'
            }}
          >
            <option value="">All Events</option>
            <option value="follower_added">Follower Added</option>
            <option value="follower_removed">Follower Removed</option>
            <option value="following_added">Following Added</option>
            <option value="following_removed">Following Removed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading history...</div>
      ) : (
        <>
          <div className="card">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #efefef' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Date & Time</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Account</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Display Name</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Event Type</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#8e8e8e' }}>
                        No history found
                      </td>
                    </tr>
                  ) : (
                    history.map((event, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #efefef' }}>
                        <td style={{ padding: '12px', fontSize: '14px' }}>
                          {format(new Date(event.timestamp), 'MMM d, yyyy')}
                          <br />
                          <span style={{ color: '#8e8e8e', fontSize: '12px' }}>
                            {event.hour || format(new Date(event.timestamp), 'HH:mm')}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <a 
                            href={`https://instagram.com/${event.affectedUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontWeight: '600', color: '#0095f6', textDecoration: 'none' }}
                          >
                            @{event.affectedUsername}
                          </a>
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px' }}>
                          {event.affectedDisplayName || '-'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ 
                            color: getEventColor(event.eventType),
                            fontWeight: '600',
                            fontSize: '14px'
                          }}>
                            {getEventTypeLabel(event.eventType)}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#8e8e8e', maxWidth: '300px' }}>
                          {event.affectedDescription || '-'}
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

export default History;

