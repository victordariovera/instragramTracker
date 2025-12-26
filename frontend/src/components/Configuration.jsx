import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { configAPI } from '../services/api';

function Configuration() {
  const navigate = useNavigate();
  const [config, setConfig] = useState({ scrapingInterval: 10, schedulerRunning: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [intervalInput, setIntervalInput] = useState(10);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await configAPI.get();
      setConfig(response.data);
      setIntervalInput(response.data.scrapingInterval);
    } catch (err) {
      console.error('Error loading config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (intervalInput < 10 || intervalInput > 1440) {
      setMessage('Interval must be between 10 and 1440 minutes');
      return;
    }

    setSaving(true);
    setMessage('');
    
    try {
      await configAPI.updateScrapingInterval(intervalInput);
      setMessage('Scraping interval updated successfully!');
      await loadConfig();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to update scraping interval');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading configuration...</div>
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

        <h1 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '16px' }}>
          Configuration
        </h1>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
          Scraping Settings
        </h2>

        <form onSubmit={handleSave}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
              Scraping Interval (minutes)
            </label>
            <input
              type="number"
              min="10"
              max="1440"
              value={intervalInput}
              onChange={(e) => setIntervalInput(parseInt(e.target.value))}
              style={{
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #dbdbdb',
                fontSize: '14px',
                width: '200px'
              }}
              required
            />
            <p style={{ fontSize: '12px', color: '#8e8e8e', marginTop: '4px' }}>
              Minimum: 10 minutes, Maximum: 1440 minutes (24 hours)
            </p>
          </div>

          <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
            <div style={{ fontSize: '14px', marginBottom: '4px' }}>
              <strong>Current Interval:</strong> {config.scrapingInterval} minutes
            </div>
            <div style={{ fontSize: '14px', marginBottom: '4px' }}>
              <strong>Scheduler Status:</strong>{' '}
              <span style={{ color: config.schedulerRunning ? '#00ba7c' : '#ed4956', fontWeight: '600' }}>
                {config.schedulerRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
            {config.scrapingInterval && (
              <div style={{ fontSize: '12px', color: '#8e8e8e', marginTop: '4px' }}>
                Accounts are checked every {config.scrapingInterval} minutes
              </div>
            )}
          </div>

          {message && (
            <div style={{
              padding: '12px',
              marginBottom: '16px',
              borderRadius: '4px',
              backgroundColor: message.includes('success') ? '#d4edda' : '#f8d7da',
              color: message.includes('success') ? '#155724' : '#721c24',
              fontSize: '14px'
            }}>
              {message}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || intervalInput === config.scrapingInterval}
            style={{ marginTop: '8px' }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
          About Scraping
        </h2>
        <div style={{ fontSize: '14px', color: '#8e8e8e', lineHeight: '1.6' }}>
          <p style={{ marginBottom: '12px' }}>
            The scraping interval determines how often the system checks all tracked Instagram accounts for changes.
          </p>
          <p style={{ marginBottom: '12px' }}>
            <strong>Important:</strong> Instagram has rate limits. Setting the interval too low (less than 10 minutes) may result in rate limiting errors.
          </p>
          <p>
            Changes to the scraping interval take effect immediately. The scheduler will restart with the new interval.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Configuration;

