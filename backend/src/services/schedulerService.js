const cron = require('node-cron');
const TrackedAccount = require('../models/TrackedAccount');
const ChangeEvent = require('../models/ChangeEvent');
const AuditLog = require('../models/AuditLog');
const instagramService = require('./instagramService');
const relationshipService = require('./relationshipService');

class SchedulerService {
  constructor() {
    this.isRunning = false;
    this.job = null;
  }

  start(intervalMinutes = 10) {
    if (this.isRunning) {
      console.log('Scheduler already running');
      return;
    }

    // Convert minutes to cron expression (every N minutes)
    const cronExpression = `*/${intervalMinutes} * * * *`;
    
    this.job = cron.schedule(cronExpression, async () => {
      await this.checkAllAccounts();
    });

    this.isRunning = true;
    console.log(`Scheduler started - checking accounts every ${intervalMinutes} minutes`);
    
    setTimeout(() => {
      this.checkAllAccounts();
    }, 5000);
  }

  async checkAllAccounts() {
    const startTime = new Date();
    console.log(`[${startTime.toISOString()}] Starting account check...`);
    
    await AuditLog.create({
      eventType: 'scraping_started',
      details: 'Scheduled scraping started',
      timestamp: startTime,
      success: true
    });
    
    try {
      const accounts = await TrackedAccount.find({ isActive: true });
      console.log(`Found ${accounts.length} active accounts to check`);

      for (const account of accounts) {
        await this.checkAccount(account);
        // Add delay between accounts to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      const endTime = new Date();
      const duration = (endTime - startTime) / 1000;
      console.log(`Account check completed in ${duration}s`);

      await AuditLog.create({
        eventType: 'scraping_completed',
        details: `Checked ${accounts.length} accounts in ${duration}s`,
        timestamp: endTime,
        success: true
      });
    } catch (error) {
      console.error('Error in scheduled check:', error);
      await AuditLog.create({
        eventType: 'scraping_failed',
        details: 'Scheduled scraping failed',
        error: error.message,
        timestamp: new Date(),
        success: false
      });
    }
  }

  async checkAccount(account) {
    const startTime = new Date();
    try {
      console.log(`Checking account: ${account.username}`);
      
      await AuditLog.create({
        eventType: 'scraping_started',
        trackedAccountUsername: account.username,
        details: `Started scraping for ${account.username}`,
        timestamp: startTime,
        success: true
      });

      const data = await instagramService.getAccountData(account.username);
      
      const now = new Date();
      const dateString = now.toISOString().split('T')[0];
      const hourString = now.toISOString().split('T')[1].substring(0, 5); // HH:MM

      // Handle rate limiting
      if (data.rateLimited) {
        await AuditLog.create({
          eventType: 'scraping_failed',
          trackedAccountUsername: account.username,
          details: 'Rate limit exceeded',
          error: data.error,
          timestamp: now,
          success: false
        });
        return;
      }

      if (!data.success) {
        const errorMessage = data.error || 'Unknown error';
        await AuditLog.create({
          eventType: 'scraping_failed',
          trackedAccountUsername: account.username,
          details: `Failed to fetch data: ${errorMessage}`,
          error: errorMessage,
          timestamp: now,
          success: false
        });
        
        // Store error in account for UI display
        account.lastScrapeError = errorMessage;
        account.lastScrapeTimestamp = now;
        await account.save();
        
        console.log(`Failed to fetch data for ${account.username}: ${errorMessage}`);
        return; // Exit early if scraping failed
      }
      
      // Clear any previous errors on successful scrape
      account.lastScrapeError = null;

      // Get actual follower/following lists from the scraped data
      const currentFollowersFromDB = account.currentFollowers || [];
      const currentFollowingFromDB = account.currentFollowing || [];
      
      const newFollowersList = data.followers || [];
      const newFollowingList = data.following || [];
      
      // Detect changes by comparing actual username lists
      const followerChanges = instagramService.detectChanges(currentFollowersFromDB, newFollowersList);
      const followingChanges = instagramService.detectChanges(currentFollowingFromDB, newFollowingList);

      // Update relationships using the relationship service
      // This handles account details fetching, relationship storage, and mutual updates
      // dateString and hourString already declared above
      const relationshipEvents = await relationshipService.updateRelationships(
        account.username,
        followerChanges,
        followingChanges,
        now,
        dateString,
        hourString
      );
      
      // ChangeEvent records are now created by relationshipService
      // Create audit logs for the changes
      const events = relationshipEvents || [];

      // Process follower additions for audit logging
      for (const username of followerChanges.added) {
        const rels = await relationshipService.getRelationships(account.username, 'follower', 'active');
        const rel = rels.find(r => r.relatedAccountUsername.toLowerCase() === username.toLowerCase());
        
        events.push({
          trackedAccountUsername: account.username,
          eventType: 'follower_added',
          affectedUsername: username,
          affectedDisplayName: rel?.relatedAccountDisplayName || username,
          affectedProfilePhoto: rel?.relatedAccountProfilePhoto || '',
          affectedDescription: rel?.relatedAccountDescription || '',
          timestamp: now,
          date: dateString,
          hour: hourString
        });

        await AuditLog.create({
          eventType: 'follower_added',
          trackedAccountUsername: account.username,
          affectedUsername: username,
          details: `Follower ${username} added`,
          timestamp: now,
          success: true
        });
      }

      // Process follower removals
      for (const username of followerChanges.removed) {
        const rels = await relationshipService.getRelationships(account.username, 'follower', 'removed');
        const rel = rels.find(r => r.relatedAccountUsername.toLowerCase() === username.toLowerCase());
        
        events.push({
          trackedAccountUsername: account.username,
          eventType: 'follower_removed',
          affectedUsername: username,
          affectedDisplayName: rel?.relatedAccountDisplayName || username,
          affectedProfilePhoto: rel?.relatedAccountProfilePhoto || '',
          affectedDescription: rel?.relatedAccountDescription || '',
          timestamp: now,
          date: dateString,
          hour: hourString
        });

        await AuditLog.create({
          eventType: 'follower_removed',
          trackedAccountUsername: account.username,
          affectedUsername: username,
          details: `Follower ${username} removed`,
          timestamp: now,
          success: true
        });
      }

      // Process following additions
      for (const username of followingChanges.added) {
        const rels = await relationshipService.getRelationships(account.username, 'following', 'active');
        const rel = rels.find(r => r.relatedAccountUsername.toLowerCase() === username.toLowerCase());
        
        events.push({
          trackedAccountUsername: account.username,
          eventType: 'following_added',
          affectedUsername: username,
          affectedDisplayName: rel?.relatedAccountDisplayName || username,
          affectedProfilePhoto: rel?.relatedAccountProfilePhoto || '',
          affectedDescription: rel?.relatedAccountDescription || '',
          timestamp: now,
          date: dateString,
          hour: hourString
        });

        await AuditLog.create({
          eventType: 'following_added',
          trackedAccountUsername: account.username,
          affectedUsername: username,
          details: `Following ${username} added`,
          timestamp: now,
          success: true
        });
      }

      // Process following removals
      for (const username of followingChanges.removed) {
        const rels = await relationshipService.getRelationships(account.username, 'following', 'removed');
        const rel = rels.find(r => r.relatedAccountUsername.toLowerCase() === username.toLowerCase());
        
        events.push({
          trackedAccountUsername: account.username,
          eventType: 'following_removed',
          affectedUsername: username,
          affectedDisplayName: rel?.relatedAccountDisplayName || username,
          affectedProfilePhoto: rel?.relatedAccountProfilePhoto || '',
          affectedDescription: rel?.relatedAccountDescription || '',
          timestamp: now,
          date: dateString,
          hour: hourString
        });

        await AuditLog.create({
          eventType: 'following_removed',
          trackedAccountUsername: account.username,
          affectedUsername: username,
          details: `Following ${username} removed`,
          timestamp: now,
          success: true
        });
      }

      if (events.length > 0) {
        await ChangeEvent.insertMany(events);
        console.log(`Recorded ${events.length} changes for ${account.username}`);
      }

      // Store counts and actual follower/following lists
      account.followersCount = data.followersCount || 0;
      account.followingCount = data.followingCount || 0;
      
      // Update follower/following lists if we got actual data
      if (data.followers && data.followers.length > 0) {
        account.currentFollowers = data.followers;
        console.log(`Updated ${account.username} with ${data.followers.length} actual followers`);
      } else if (data.followersCount > 0) {
        console.log(`⚠️ Warning: Got ${data.followersCount} followers count but no actual follower list for ${account.username}`);
      }
      
      if (data.following && data.following.length > 0) {
        account.currentFollowing = data.following;
        console.log(`Updated ${account.username} with ${data.following.length} actual following`);
      } else if (data.followingCount > 0) {
        console.log(`⚠️ Warning: Got ${data.followingCount} following count but no actual following list for ${account.username}`);
      }
      account.displayName = data.displayName || account.displayName;
      account.profilePhoto = data.profilePhoto || account.profilePhoto;
      account.description = data.description || account.description;
      account.postsCount = data.postsCount || account.postsCount;
      account.lastChecked = now;
      await account.save();

      const endTime = new Date();
      const duration = (endTime - startTime) / 1000;
      
      await AuditLog.create({
        eventType: 'scraping_completed',
        trackedAccountUsername: account.username,
        details: `Scraping completed in ${duration}s. Changes: ${events.length}`,
        timestamp: endTime,
        success: true
      });

      console.log(`Successfully updated ${account.username} in ${duration}s`);
    } catch (error) {
      console.error(`Error checking account ${account.username}:`, error);
      await AuditLog.create({
        eventType: 'scraping_failed',
        trackedAccountUsername: account.username,
        details: `Error: ${error.message}`,
        error: error.message,
        timestamp: new Date(),
        success: false
      });
    }
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.isRunning = false;
      console.log('Scheduler stopped');
    }
  }
}

module.exports = new SchedulerService();