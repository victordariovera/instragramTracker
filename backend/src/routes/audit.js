const express = require('express');
const AuditLog = require('../models/AuditLog');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Get all audit logs with pagination
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, eventType, trackedAccountUsername } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const query = {};
    if (eventType) query.eventType = eventType;
    if (trackedAccountUsername) query.trackedAccountUsername = trackedAccountUsername;
    
    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await AuditLog.countDocuments(query);
    
    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get audit logs for a specific account
router.get('/account/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const logs = await AuditLog.find({ trackedAccountUsername: username })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await AuditLog.countDocuments({ trackedAccountUsername: username });
    
    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching account audit logs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get recent scraping executions
router.get('/scraping', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const logs = await AuditLog.find({
      eventType: { $in: ['scraping_started', 'scraping_completed', 'scraping_failed'] }
    })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    
    res.json({ logs });
  } catch (error) {
    console.error('Error fetching scraping logs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

