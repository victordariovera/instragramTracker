const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const schedulerService = require('../services/schedulerService');
const Config = require('../models/Config');

const router = express.Router();

router.use(authMiddleware);

// Get current configuration
router.get('/', async (req, res) => {
  try {
    const scrapingInterval = await Config.getValue('scrapingInterval', 10);
    res.json({
      scrapingInterval: parseInt(scrapingInterval),
      schedulerRunning: schedulerService.isRunning
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update scraping interval
router.put('/scraping-interval', async (req, res) => {
  try {
    const { intervalMinutes } = req.body;
    
    if (!intervalMinutes || intervalMinutes < 10 || intervalMinutes > 1440) {
      return res.status(400).json({ message: 'Interval must be between 10 and 1440 minutes' });
    }
    
    // Save to database
    await Config.setValue('scrapingInterval', parseInt(intervalMinutes));
    
    // Stop current scheduler
    if (schedulerService.isRunning) {
      schedulerService.stop();
    }
    
    // Start with new interval
    schedulerService.start(parseInt(intervalMinutes));
    
    res.json({
      message: 'Scraping interval updated',
      scrapingInterval: parseInt(intervalMinutes),
      schedulerRunning: schedulerService.isRunning
    });
  } catch (error) {
    console.error('Error updating scraping interval:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

