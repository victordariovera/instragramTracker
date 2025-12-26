const express = require('express');
const TrackedAccount = require('../models/TrackedAccount');
const ChangeEvent = require('../models/ChangeEvent');
const AccountRelationship = require('../models/AccountRelationship');
const AuditLog = require('../models/AuditLog');
const { authMiddleware } = require('../middleware/auth');
const instagramService = require('../services/instagramService');
const relationshipService = require('../services/relationshipService');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    // Don't use select() to ensure all fields including followersCount/followingCount are included
    const accounts = await TrackedAccount.find({ isActive: true })
      .sort({ createdAt: -1 });
    
    // Transform accounts to include counts
    // Use toObject() to ensure all fields are included, including ones added after schema creation
    const accountsWithCounts = accounts.map(account => {
      const accountObj = account.toObject();
      return {
        username: accountObj.username,
        displayName: accountObj.displayName,
        profilePhoto: accountObj.profilePhoto,
        description: accountObj.description,
        postsCount: accountObj.postsCount || 0,
        followersCount: accountObj.followersCount || 0,
        followingCount: accountObj.followingCount || 0,
        mutualFriendsCount: account.getMutualFriends().length,
        lastChecked: accountObj.lastChecked,
        createdAt: accountObj.createdAt
      };
    });
    
    // Create a map of accounts with their counts for quick lookup
    const accountsDataMap = new Map();
    accountsWithCounts.forEach(acc => {
      accountsDataMap.set(acc.username, acc);
    });
    
    // Get last scraping error for each account
    // BUT only show errors for accounts that don't have data (to avoid showing errors unnecessarily)
    const accountErrors = await AuditLog.find({
      eventType: 'scraping_failed',
      trackedAccountUsername: { $in: accounts.map(a => a.username) },
      success: false
    })
      .sort({ timestamp: -1 })
      .then(logs => {
        const errorMap = new Map();
        logs.forEach(log => {
          if (!errorMap.has(log.trackedAccountUsername)) {
            // Only include error if account doesn't have data
            const accountData = accountsDataMap.get(log.trackedAccountUsername);
            if (accountData) {
              const hasData = (accountData.followersCount && accountData.followersCount > 0) || (accountData.followingCount && accountData.followingCount > 0);
              // Only show error if account has NO data
              if (!hasData) {
                errorMap.set(log.trackedAccountUsername, log);
              }
            } else {
              // If account not found in map, include error (shouldn't happen)
              errorMap.set(log.trackedAccountUsername, log);
            }
          }
        });
        return errorMap;
      });
    
    // Get last successful scrape for each account
    const lastSuccess = await AuditLog.find({
      eventType: 'scraping_completed',
      trackedAccountUsername: { $in: accounts.map(a => a.username) },
      success: true
    })
      .sort({ timestamp: -1 })
      .then(logs => {
        const successMap = new Map();
        logs.forEach(log => {
          if (!successMap.has(log.trackedAccountUsername)) {
            successMap.set(log.trackedAccountUsername, log);
          }
        });
        return successMap;
      });
    
    // Add error and last success info to accounts
    const accountsWithErrors = accountsWithCounts.map(acc => {
      const error = accountErrors.get(acc.username);
      const lastSuccessful = lastSuccess.get(acc.username);
      return {
        ...acc,
        lastError: error ? {
          message: error.error || error.details,
          timestamp: error.timestamp,
          type: error.error?.includes('RATE_LIMIT') ? 'rate_limit' : 'other'
        } : null,
        lastSuccessfulScrape: lastSuccessful?.timestamp || null
      };
    });
    
    res.json({ accounts: accountsWithErrors });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username || !username.trim()) {
      return res.status(400).json({ message: 'Username is required' });
    }
    
    const cleanUsername = username.trim().toLowerCase().replace('@', '');
    
    // Check if account exists and is active
    const existing = await TrackedAccount.findOne({ 
      username: cleanUsername,
      isActive: true 
    });
    if (existing) {
      return res.status(400).json({ message: 'Account already being tracked' });
    }
    
    // If account exists but is inactive, reactivate it instead of creating new
    const inactiveAccount = await TrackedAccount.findOne({ 
      username: cleanUsername,
      isActive: false 
    });
    if (inactiveAccount) {
      console.log(`Reactivating account: ${cleanUsername}`);
      const data = await instagramService.getAccountData(cleanUsername);
      
      inactiveAccount.displayName = data.displayName || cleanUsername;
      inactiveAccount.profilePhoto = data.profilePhoto || '';
      inactiveAccount.description = data.description || '';
      inactiveAccount.postsCount = data.postsCount || 0;
      inactiveAccount.followersCount = data.followersCount || 0;
      inactiveAccount.followingCount = data.followingCount || 0;
      inactiveAccount.currentFollowers = data.followers;
      inactiveAccount.currentFollowing = data.following;
      inactiveAccount.lastChecked = new Date();
      inactiveAccount.isActive = true;
      
      await inactiveAccount.save();
      
      console.log(`Successfully reactivated account: ${cleanUsername} with ${data.followers.length} followers, ${data.following.length} following`);
      
      return res.status(200).json({ 
        account: {
          id: inactiveAccount._id,
          username: inactiveAccount.username,
          displayName: inactiveAccount.displayName,
          lastChecked: inactiveAccount.lastChecked,
          createdAt: inactiveAccount.createdAt
        }
      });
    }
    
    console.log(`Adding new tracked account: ${cleanUsername}`);
    const data = await instagramService.getAccountData(cleanUsername);
    
    if (!data.success && data.rateLimited) {
      await AuditLog.create({
        eventType: 'account_added',
        trackedAccountUsername: cleanUsername,
        details: 'Account added but scraping failed due to rate limit',
        error: data.error,
        timestamp: new Date(),
        success: false
      });
      return res.status(429).json({ 
        message: 'Instagram rate limit exceeded. Account will be tracked once rate limit clears.',
        rateLimited: true
      });
    }
    
    const account = new TrackedAccount({
      username: cleanUsername,
      displayName: data.displayName || cleanUsername,
      profilePhoto: data.profilePhoto || '',
      description: data.description || '',
      postsCount: data.postsCount || 0,
      followersCount: data.followersCount || 0,
      followingCount: data.followingCount || 0,
      currentFollowers: data.followers || [],
      currentFollowing: data.following || [],
      lastChecked: new Date(),
      isActive: true
    });
    
    await account.save();
    
    // Store initial snapshot of all followers and following
    // This creates baseline relationships without creating change events
    if (data.followers && data.followers.length > 0 || data.following && data.following.length > 0) {
      console.log(`Storing initial snapshot for ${cleanUsername}: ${data.followers?.length || 0} followers, ${data.following?.length || 0} following`);
      // Store in background to avoid blocking response
      relationshipService.storeInitialSnapshot(
        cleanUsername,
        data.followers || [],
        data.following || []
      ).catch(err => {
        console.error(`Error storing initial snapshot for ${cleanUsername}:`, err);
      });
    }
    
    await AuditLog.create({
      eventType: 'account_added',
      trackedAccountUsername: cleanUsername,
      details: `Account added with ${data.followersCount || 0} followers, ${data.followingCount || 0} following`,
      timestamp: new Date(),
      success: true
    });
    
    console.log(`Successfully added account: ${cleanUsername} with ${account.followersCount} followers, ${account.followingCount} following, ${account.postsCount} posts`);
    res.status(201).json({ 
      account: {
        id: account._id,
        username: account.username,
        displayName: account.displayName,
        lastChecked: account.lastChecked,
        createdAt: account.createdAt
      }
    });
  } catch (error) {
    console.error('Error adding account:', error);
    res.status(500).json({ message: 'Failed to add account' });
  }
});

router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    const account = await TrackedAccount.findOne({ 
      username: username.toLowerCase(), 
      isActive: true 
    });
    
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }
    
    const mutualFriends = account.getMutualFriends();
    
    const accountObj = account.toObject();
    res.json({
      account: {
        username: accountObj.username,
        displayName: accountObj.displayName,
        profilePhoto: accountObj.profilePhoto || '',
        description: accountObj.description || '',
        postsCount: accountObj.postsCount || 0,
        followerCount: accountObj.followersCount || 0,
        followingCount: accountObj.followingCount || 0,
        mutualFriendsCount: mutualFriends.length,
        lastChecked: accountObj.lastChecked,
        createdAt: accountObj.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:username/stats', async (req, res) => {
  try {
    const { username } = req.params;
    const { days = 30 } = req.query;
    
    const account = await TrackedAccount.findOne({ 
      username: username.toLowerCase(), 
      isActive: true 
    });
    
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    
    const events = await ChangeEvent.find({
      trackedAccountUsername: account.username,
      timestamp: { $gte: cutoffDate }
    }).sort({ timestamp: 1 });
    
    const dailyStats = {};
    
    // Add initial baseline point from account creation or first check
    // Always include this baseline, even if outside the date range
    const accountObj = account.toObject();
    const accountDate = accountObj.createdAt || accountObj.lastChecked || new Date();
    const accountDateString = accountDate.toISOString().split('T')[0];
    const initialFollowersCount = accountObj.followersCount || 0;
    const initialFollowingCount = accountObj.followingCount || 0;
    
    // Initialize with actual counts from database as baseline (always include this)
    dailyStats[accountDateString] = {
      date: accountDateString,
      followerAdded: 0,
      followerRemoved: 0,
      followingAdded: 0,
      followingRemoved: 0,
      initialFollowers: initialFollowersCount,
      initialFollowing: initialFollowingCount,
      followersCount: initialFollowersCount,
      followingCount: initialFollowingCount
    };
    
    events.forEach(event => {
      const date = event.date;
      
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          followerAdded: 0,
          followerRemoved: 0,
          followingAdded: 0,
          followingRemoved: 0
        };
      }
      
      if (event.eventType === 'follower_added') {
        dailyStats[date].followerAdded++;
      } else if (event.eventType === 'follower_removed') {
        dailyStats[date].followerRemoved++;
      } else if (event.eventType === 'following_added') {
        dailyStats[date].followingAdded++;
      } else if (event.eventType === 'following_removed') {
        dailyStats[date].followingRemoved++;
      }
    });
    
    // Convert to array and calculate cumulative values
    const statsArray = [];
    let cumulativeFollowers = dailyStats[accountDateString]?.initialFollowers || 0;
    let cumulativeFollowing = dailyStats[accountDateString]?.initialFollowing || 0;
    
    const sortedDates = Object.keys(dailyStats).sort();
    
    sortedDates.forEach(date => {
      const day = dailyStats[date];
      const followersDelta = day.followerAdded - day.followerRemoved;
      const followingDelta = day.followingAdded - day.followingRemoved;
      
      // For the initial date, use the actual counts from the baseline
      if (date === accountDateString) {
        cumulativeFollowers = day.followersCount !== undefined ? day.followersCount : (day.initialFollowers || 0);
        cumulativeFollowing = day.followingCount !== undefined ? day.followingCount : (day.initialFollowing || 0);
      } else {
        cumulativeFollowers += followersDelta;
        cumulativeFollowing += followingDelta;
      }
      
      statsArray.push({
        date: day.date,
        followersDelta: followersDelta,
        followingDelta: followingDelta,
        followersCount: cumulativeFollowers,
        followingCount: cumulativeFollowing,
        mutualFriendsDelta: 0
      });
    });
    
    res.json({ stats: statsArray });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:username/recent-changes', async (req, res) => {
  try {
    const { username } = req.params;
    const { type, limit = 10 } = req.query;
    
    const account = await TrackedAccount.findOne({ 
      username: username.toLowerCase(), 
      isActive: true 
    });
    
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }
    
    let eventTypes = [];
    if (type === 'followers') {
      eventTypes = ['follower_added', 'follower_removed'];
    } else if (type === 'following') {
      eventTypes = ['following_added', 'following_removed'];
    } else if (type === 'mutual') {
      const mutualUsernames = new Set(account.getMutualFriends());
      const followerEvents = await ChangeEvent.find({
        trackedAccountUsername: account.username,
        eventType: { $in: ['follower_added', 'follower_removed'] }
      }).sort({ timestamp: -1 }).limit(parseInt(limit) * 2);
      
      const mutualChanges = followerEvents
        .filter(event => mutualUsernames.has(event.affectedUsername))
        .slice(0, parseInt(limit));
      
      return res.json({ changes: mutualChanges });
    }
    
    const changes = await ChangeEvent.find({
      trackedAccountUsername: account.username,
      eventType: { $in: eventTypes }
    })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit));
    
    res.json({ changes });
  } catch (error) {
    console.error('Error fetching recent changes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get recent activity (last 10 events across all types)
router.get('/:username/recent-activity', async (req, res) => {
  try {
    const { username } = req.params;
    const { limit = 10 } = req.query;
    
    const account = await TrackedAccount.findOne({ 
      username: username.toLowerCase(), 
      isActive: true 
    });
    
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }
    
    const events = await ChangeEvent.find({
      trackedAccountUsername: username.toLowerCase()
    })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    
    const activity = events.map(event => ({
      eventType: event.eventType,
      affectedUsername: event.affectedUsername,
      affectedDisplayName: event.affectedDisplayName || event.affectedUsername,
      affectedProfilePhoto: event.affectedProfilePhoto || '',
      timestamp: event.timestamp,
      date: event.date,
      hour: event.hour || event.timestamp.toISOString().split('T')[1].substring(0, 5)
    }));
    
    res.json({ activity });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get full history with pagination
router.get('/:username/history', async (req, res) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 50, eventType, relationshipType } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const account = await TrackedAccount.findOne({ 
      username: username.toLowerCase(), 
      isActive: true 
    });
    
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }
    
    const query = { trackedAccountUsername: username.toLowerCase() };
    if (eventType) {
      query.eventType = eventType;
    }
    
    const events = await ChangeEvent.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await ChangeEvent.countDocuments(query);
    
    const history = events.map(event => ({
      eventType: event.eventType,
      affectedUsername: event.affectedUsername,
      affectedDisplayName: event.affectedDisplayName || event.affectedUsername,
      affectedProfilePhoto: event.affectedProfilePhoto || '',
      affectedDescription: event.affectedDescription || '',
      timestamp: event.timestamp,
      date: event.date,
      hour: event.hour || event.timestamp.toISOString().split('T')[1].substring(0, 5)
    }));
    
    res.json({
      history,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get removed followers
router.get('/:username/removed-followers', async (req, res) => {
  try {
    const { username } = req.params;
    
    const account = await TrackedAccount.findOne({ 
      username: username.toLowerCase(), 
      isActive: true 
    });
    
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }
    
    const removed = await AccountRelationship.find({
      trackedAccountUsername: username.toLowerCase(),
      relationshipType: 'follower',
      status: 'removed'
    })
      .sort({ removedAt: -1 });
    
    res.json({ 
      removed: removed.map(rel => ({
        username: rel.relatedAccountUsername,
        displayName: rel.relatedAccountDisplayName || rel.relatedAccountUsername,
        profilePhoto: rel.relatedAccountProfilePhoto || '',
        description: rel.relatedAccountDescription || '',
        removedAt: rel.removedAt,
        firstObserved: rel.firstObserved
      }))
    });
  } catch (error) {
    console.error('Error fetching removed followers:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get removed following
router.get('/:username/removed-following', async (req, res) => {
  try {
    const { username } = req.params;
    
    const account = await TrackedAccount.findOne({ 
      username: username.toLowerCase(), 
      isActive: true 
    });
    
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }
    
    const removed = await AccountRelationship.find({
      trackedAccountUsername: username.toLowerCase(),
      relationshipType: 'following',
      status: 'removed'
    })
      .sort({ removedAt: -1 });
    
    res.json({ 
      removed: removed.map(rel => ({
        username: rel.relatedAccountUsername,
        displayName: rel.relatedAccountDisplayName || rel.relatedAccountUsername,
        profilePhoto: rel.relatedAccountProfilePhoto || '',
        description: rel.relatedAccountDescription || '',
        removedAt: rel.removedAt,
        firstObserved: rel.firstObserved
      }))
    });
  } catch (error) {
    console.error('Error fetching removed following:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    const account = await TrackedAccount.findOne({ 
      username: username.toLowerCase() 
    });
    
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }
    
    // Actually delete the account and related change events
    await ChangeEvent.deleteMany({ trackedAccountUsername: account.username });
    await TrackedAccount.deleteOne({ _id: account._id });
    
    res.json({ message: 'Account removed successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;