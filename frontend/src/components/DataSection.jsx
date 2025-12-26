import React from 'react';
import { formatDistanceToNow, parseISO, isToday, isYesterday, format } from 'date-fns';
import Chart from './Chart';
import { exportAPI } from '../services/api';

function DataSection({ title, type, username, stats, recentChanges, color, compact = false }) {
  const getExportURL = () => {
    const token = localStorage.getItem('token');
    let url;
    
    if (type === 'followers') {
      url = exportAPI.getFollowersCSV(username);
    } else if (type === 'following') {
      url = exportAPI.getFollowingCSV(username);
    } else if (type === 'mutual') {
      url = exportAPI.getMutualCSV(username);
    }
    
    return `${url}?token=${token}`;
  };

  const handleExport = () => {
    const token = localStorage.getItem('token');
    const url = getExportURL().replace('?token=', '');
    
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
      a.download = `${username}_${type}_${Date.now()}.csv`;
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

  const formatChangeDate = (timestamp) => {
    const date = parseISO(timestamp);
    
    if (isToday(date)) {
      return 'Today';
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM d, yyyy');
    }
  };

  const getChartData = () => {
    if (!stats || stats.length === 0) return [];
    
    return stats.map(day => ({
      date: day.date,
      // Use actual counts if available, otherwise use delta
      value: type === 'followers' ? (day.followersCount !== undefined ? day.followersCount : day.followersDelta) :
             type === 'following' ? (day.followingCount !== undefined ? day.followingCount : day.followingDelta) :
             day.mutualFriendsDelta
    }));
  };

  return (
    <div className="section" style={compact ? { marginBottom: 0 } : {}}>
      <div className="section-header" style={compact ? { marginBottom: '12px' } : {}}>
        <h2 className="section-title" style={compact ? { fontSize: '18px' } : {}}>{title}</h2>
        <button 
          className="btn btn-secondary"
          onClick={handleExport}
          style={{ fontSize: '12px', padding: '6px 12px' }}
        >
          Export CSV
        </button>
      </div>

      <div className="card" style={compact ? { aspectRatio: '1', minHeight: '300px' } : {}}>
        <Chart 
          data={getChartData()}
          dataKey="value"
          title="Daily Changes"
          color={color}
          compact={compact}
        />
      </div>

      {!compact && (
        <div className="card">
          <h3 style={{ fontSize: '16px', marginBottom: '16px', fontWeight: '600' }}>
            Recent Changes (Last 10)
          </h3>
          
          {!recentChanges || recentChanges.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#8e8e8e' }}>
              No changes recorded yet
            </div>
          ) : (
            <ul className="change-list">
              {recentChanges.map((change, index) => (
                <li key={index} className="change-item">
                  <div>
                    <a 
                      href={`https://instagram.com/${change.affectedUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="change-username"
                    >
                      @{change.affectedUsername}
                    </a>
                    <div className="change-time">
                      {formatChangeDate(change.timestamp)} at {format(parseISO(change.timestamp), 'h:mm a')}
                    </div>
                  </div>
                  <div>
                    {change.eventType.includes('added') ? (
                      <span className="change-added">+ Added</span>
                    ) : (
                      <span className="change-removed">- Removed</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default DataSection;