const express = require('express');
const { Parser } = require('json2csv');
const TrackedAccount = require('../models/TrackedAccount');
const ChangeEvent = require('../models/ChangeEvent');
const AccountRelationship = require('../models/AccountRelationship');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/:username/followers', async (req, res) => {
  try {
    const { username } = req.params;
    
    const account = await TrackedAccount.findOne({ 
      username: username.toLowerCase(), 
      isActive: true 
    });
    
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }
    
    // Get all follower relationships (both active and removed)
    const relationships = await AccountRelationship.find({
      trackedAccountUsername: username.toLowerCase(),
      relationshipType: 'follower'
    }).sort({ firstObserved: -1 });
    
    // Get change events for event type and exact timestamps
    const events = await ChangeEvent.find({
      trackedAccountUsername: username.toLowerCase(),
      eventType: { $in: ['follower_added', 'follower_removed'] }
    }).sort({ timestamp: -1 });
    
    // Create a map of relationships by username for quick lookup
    const relationshipMap = new Map();
    relationships.forEach(rel => {
      relationshipMap.set(rel.relatedAccountUsername.toLowerCase(), rel);
    });
    
    // Create CSV data - one row per Instagram account
    const csvData = [];
    
    for (const rel of relationships) {
      // Find the most recent event for this account
      const recentEvent = events.find(e => 
        e.affectedUsername.toLowerCase() === rel.relatedAccountUsername.toLowerCase()
      );
      
      const eventDate = recentEvent ? recentEvent.date : rel.firstObserved.toISOString().split('T')[0];
      const eventTime = recentEvent ? recentEvent.timestamp.toISOString().split('T')[1].substring(0, 8) : rel.firstObserved.toISOString().split('T')[1].substring(0, 8);
      const eventType = recentEvent ? (recentEvent.eventType === 'follower_added' ? 'added' : 'removed') : 'added';
      
      csvData.push({
        'Tracked Account Username': account.username,
        'Affected Account Username': rel.relatedAccountUsername,
        'Display Name': rel.relatedAccountDisplayName || rel.relatedAccountUsername,
        'Profile Photo URL': rel.relatedAccountProfilePhoto || '',
        'Description': rel.relatedAccountDescription || '',
        'Relationship Type': 'follower',
        'Status': rel.status,
        'Event Type': eventType,
        'Event Date': eventDate,
        'Event Time': eventTime
      });
    }
    
    // If no data, return empty with headers
    if (csvData.length === 0) {
      csvData.push({
        'Tracked Account Username': account.username,
        'Affected Account Username': 'No followers data available',
        'Display Name': '',
        'Profile Photo URL': '',
        'Description': '',
        'Relationship Type': 'follower',
        'Status': 'N/A',
        'Event Type': 'N/A',
        'Event Date': new Date().toISOString().split('T')[0],
        'Event Time': new Date().toISOString().split('T')[1].substring(0, 8)
      });
    }
    
    const fields = [
      'Tracked Account Username',
      'Affected Account Username',
      'Display Name',
      'Profile Photo URL',
      'Description',
      'Relationship Type',
      'Status',
      'Event Type',
      'Event Date',
      'Event Time'
    ];
    const parser = new Parser({ fields });
    const csv = parser.parse(csvData);
    
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="${username}_followers_${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting followers:', error);
    res.status(500).json({ message: 'Export failed' });
  }
});

router.get('/:username/following', async (req, res) => {
  try {
    const { username } = req.params;
    
    const account = await TrackedAccount.findOne({ 
      username: username.toLowerCase(), 
      isActive: true 
    });
    
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }
    
    // Get all following relationships (both active and removed)
    const relationships = await AccountRelationship.find({
      trackedAccountUsername: username.toLowerCase(),
      relationshipType: 'following'
    }).sort({ firstObserved: -1 });
    
    // Get change events
    const events = await ChangeEvent.find({
      trackedAccountUsername: username.toLowerCase(),
      eventType: { $in: ['following_added', 'following_removed'] }
    }).sort({ timestamp: -1 });
    
    const csvData = [];
    
    for (const rel of relationships) {
      const recentEvent = events.find(e => 
        e.affectedUsername.toLowerCase() === rel.relatedAccountUsername.toLowerCase()
      );
      
      const eventDate = recentEvent ? recentEvent.date : rel.firstObserved.toISOString().split('T')[0];
      const eventTime = recentEvent ? recentEvent.timestamp.toISOString().split('T')[1].substring(0, 8) : rel.firstObserved.toISOString().split('T')[1].substring(0, 8);
      const eventType = recentEvent ? (recentEvent.eventType === 'following_added' ? 'added' : 'removed') : 'added';
      
      csvData.push({
        'Tracked Account Username': account.username,
        'Affected Account Username': rel.relatedAccountUsername,
        'Display Name': rel.relatedAccountDisplayName || rel.relatedAccountUsername,
        'Profile Photo URL': rel.relatedAccountProfilePhoto || '',
        'Description': rel.relatedAccountDescription || '',
        'Relationship Type': 'following',
        'Status': rel.status,
        'Event Type': eventType,
        'Event Date': eventDate,
        'Event Time': eventTime
      });
    }
    
    if (csvData.length === 0) {
      csvData.push({
        'Tracked Account Username': account.username,
        'Affected Account Username': 'No following data available',
        'Display Name': '',
        'Profile Photo URL': '',
        'Description': '',
        'Relationship Type': 'following',
        'Status': 'N/A',
        'Event Type': 'N/A',
        'Event Date': new Date().toISOString().split('T')[0],
        'Event Time': new Date().toISOString().split('T')[1].substring(0, 8)
      });
    }
    
    const fields = [
      'Tracked Account Username',
      'Affected Account Username',
      'Display Name',
      'Profile Photo URL',
      'Description',
      'Relationship Type',
      'Status',
      'Event Type',
      'Event Date',
      'Event Time'
    ];
    const parser = new Parser({ fields });
    const csv = parser.parse(csvData);
    
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="${username}_following_${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting following:', error);
    res.status(500).json({ message: 'Export failed' });
  }
});

router.get('/:username/mutual', async (req, res) => {
  try {
    const { username } = req.params;
    
    const account = await TrackedAccount.findOne({ 
      username: username.toLowerCase(), 
      isActive: true 
    });
    
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }
    
    // Get all mutual relationships (both active and removed)
    const relationships = await AccountRelationship.find({
      trackedAccountUsername: username.toLowerCase(),
      relationshipType: 'mutual'
    }).sort({ firstObserved: -1 });
    
    // Get change events that affected mutual status
    const events = await ChangeEvent.find({
      trackedAccountUsername: username.toLowerCase(),
      eventType: { $in: ['follower_added', 'follower_removed', 'following_added', 'following_removed'] }
    }).sort({ timestamp: -1 });
    
    const csvData = [];
    
    for (const rel of relationships) {
      // Find events that affected this mutual relationship
      const relatedEvents = events.filter(e => 
        e.affectedUsername.toLowerCase() === rel.relatedAccountUsername.toLowerCase()
      );
      const recentEvent = relatedEvents[0];
      
      const eventDate = recentEvent ? recentEvent.date : rel.firstObserved.toISOString().split('T')[0];
      const eventTime = recentEvent ? recentEvent.timestamp.toISOString().split('T')[1].substring(0, 8) : rel.firstObserved.toISOString().split('T')[1].substring(0, 8);
      const eventType = rel.status === 'removed' ? 'removed' : 'added';
      
      csvData.push({
        'Tracked Account Username': account.username,
        'Affected Account Username': rel.relatedAccountUsername,
        'Display Name': rel.relatedAccountDisplayName || rel.relatedAccountUsername,
        'Profile Photo URL': rel.relatedAccountProfilePhoto || '',
        'Description': rel.relatedAccountDescription || '',
        'Relationship Type': 'mutual',
        'Status': rel.status,
        'Event Type': eventType,
        'Event Date': eventDate,
        'Event Time': eventTime
      });
    }
    
    if (csvData.length === 0) {
      csvData.push({
        'Tracked Account Username': account.username,
        'Affected Account Username': 'No mutual friends data available',
        'Display Name': '',
        'Profile Photo URL': '',
        'Description': '',
        'Relationship Type': 'mutual',
        'Status': 'N/A',
        'Event Type': 'N/A',
        'Event Date': new Date().toISOString().split('T')[0],
        'Event Time': new Date().toISOString().split('T')[1].substring(0, 8)
      });
    }
    
    const fields = [
      'Tracked Account Username',
      'Affected Account Username',
      'Display Name',
      'Profile Photo URL',
      'Description',
      'Relationship Type',
      'Status',
      'Event Type',
      'Event Date',
      'Event Time'
    ];
    const parser = new Parser({ fields });
    const csv = parser.parse(csvData);
    
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="${username}_mutual_friends_${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting mutual friends:', error);
    res.status(500).json({ message: 'Export failed' });
  }
});

router.get('/:username/all', async (req, res) => {
  try {
    const { username } = req.params;
    
    const account = await TrackedAccount.findOne({ 
      username: username.toLowerCase(), 
      isActive: true 
    });
    
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }
    
    const accountObj = account.toObject();
    const csvData = [];
    
    // Add account summary
    csvData.push({
      'Section': 'Account Summary',
      'Instagram Username': account.username,
      'Display Name': accountObj.displayName || '',
      'Status': 'Active',
      'Category': 'Summary',
      'Followers Count': accountObj.followersCount || 0,
      'Following Count': accountObj.followingCount || 0,
      'Posts Count': accountObj.postsCount || 0,
      'Date': accountObj.lastChecked ? new Date(accountObj.lastChecked).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      'Time': accountObj.lastChecked ? new Date(accountObj.lastChecked).toISOString() : new Date().toISOString(),
      'Tracked Account': account.username
    });
    
    // Add current followers
    const currentFollowers = accountObj.currentFollowers || [];
    if (currentFollowers.length > 0) {
      currentFollowers.forEach(follower => {
        csvData.push({
          'Section': 'Current Followers',
          'Instagram Username': follower,
          'Display Name': '',
          'Status': 'Current Follower',
          'Category': 'Followers',
          'Followers Count': '',
          'Following Count': '',
          'Posts Count': '',
          'Date': accountObj.lastChecked ? new Date(accountObj.lastChecked).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          'Time': accountObj.lastChecked ? new Date(accountObj.lastChecked).toISOString() : new Date().toISOString(),
          'Tracked Account': account.username
        });
      });
    }
    
    // Add current following
    const currentFollowing = accountObj.currentFollowing || [];
    if (currentFollowing.length > 0) {
      currentFollowing.forEach(following => {
        csvData.push({
          'Section': 'Current Following',
          'Instagram Username': following,
          'Display Name': '',
          'Status': 'Current Following',
          'Category': 'Following',
          'Followers Count': '',
          'Following Count': '',
          'Posts Count': '',
          'Date': accountObj.lastChecked ? new Date(accountObj.lastChecked).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          'Time': accountObj.lastChecked ? new Date(accountObj.lastChecked).toISOString() : new Date().toISOString(),
          'Tracked Account': account.username
        });
      });
    }
    
    // Add change events
    const events = await ChangeEvent.find({
      trackedAccountUsername: account.username
    }).sort({ timestamp: -1 });
    
    events.forEach(event => {
      csvData.push({
        'Section': 'Change Event',
        'Instagram Username': event.affectedUsername,
        'Display Name': '',
        'Status': event.eventType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        'Category': event.eventType.includes('follower') ? 'Followers' : 'Following',
        'Followers Count': '',
        'Following Count': '',
        'Posts Count': '',
        'Date': event.date,
        'Time': event.timestamp.toISOString(),
        'Tracked Account': event.trackedAccountUsername
      });
    });
    
    // Always ensure we have at least the account summary
    // Define fields explicitly to ensure headers are always included
    const fields = ['Section', 'Instagram Username', 'Display Name', 'Status', 'Category', 'Followers Count', 'Following Count', 'Posts Count', 'Date', 'Time', 'Tracked Account'];
    const parser = new Parser({ fields });
    const csv = parser.parse(csvData);
    
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="${username}_all_data_${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting all data:', error);
    res.status(500).json({ message: 'Export failed' });
  }
});

module.exports = router;