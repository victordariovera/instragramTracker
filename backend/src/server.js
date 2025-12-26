const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/accounts');
const exportRoutes = require('./routes/export');
const auditRoutes = require('./routes/audit');
const configRoutes = require('./routes/config');
const schedulerService = require('./services/schedulerService');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/config', configRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    scheduler: schedulerService.isRunning ? 'running' : 'stopped'
  });
});

const startServer = async () => {
  try {
    await connectDB();
    
    // Load scraping interval from config or use default
    const Config = require('./models/Config');
    let scrapingInterval = 10;
    try {
      scrapingInterval = await Config.getValue('scrapingInterval', 10);
    } catch (err) {
      console.log('Using default scraping interval of 10 minutes');
    }
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check available at http://localhost:${PORT}/api/health`);
      
      schedulerService.start(parseInt(scrapingInterval));
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();