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
        const errorMessage = data.error || data.warning || 'Could not extract data from Instagram';
        await AuditLog.create({
          eventType: 'scraping_failed',
          trackedAccountUsername: account.username,
          details: `Failed to fetch data: ${errorMessage}`,
          error: errorMessage,
          timestamp: now,
          success: false
        });
        
        // NO guardar error en la cuenta si ya tiene datos (para no mostrar errores innecesarios)
        // Solo guardar error si la cuenta no tiene datos y el scraping falló
        if (!account.followersCount && !account.followingCount) {
          account.lastScrapeError = errorMessage;
          account.lastScrapeTimestamp = now;
        } else {
          // Si ya tiene datos, limpiar errores previos
          account.lastScrapeError = null;
          account.lastScrapeTimestamp = null;
        }
        
        // Actualizar lastChecked incluso si falló (para que no diga "hace un día")
        account.lastChecked = now;
        await account.save();
        
        console.log(`Failed to fetch data for ${account.username}: ${errorMessage}`);
        return; // Exit early if scraping failed
      }
      
      // Clear any previous errors on successful scrape
      account.lastScrapeError = null;

      // Get actual follower/following lists from the scraped data
      const currentFollowersFromDB = account.currentFollowers || [];
      const currentFollowingFromDB = account.currentFollowing || [];
      
      const newFollowersList = Array.isArray(data.followers) ? data.followers : [];
      const newFollowingList = Array.isArray(data.following) ? data.following : [];
      
      // Detect changes by comparing actual username lists
      const followerChanges = instagramService.detectChanges(currentFollowersFromDB, newFollowersList);
      const followingChanges = instagramService.detectChanges(currentFollowingFromDB, newFollowingList);
      
      // Asegurar que los cambios sean objetos con arrays (evitar errores de iteración)
      const safeFollowerChanges = {
        added: Array.isArray(followerChanges?.added) ? followerChanges.added : [],
        removed: Array.isArray(followerChanges?.removed) ? followerChanges.removed : []
      };
      
      const safeFollowingChanges = {
        added: Array.isArray(followingChanges?.added) ? followingChanges.added : [],
        removed: Array.isArray(followingChanges?.removed) ? followingChanges.removed : []
      };

      // Update relationships using the relationship service
      // This handles account details fetching, relationship storage, and mutual updates
      // dateString and hourString already declared above
      const relationshipEvents = await relationshipService.updateRelationships(
        account.username,
        safeFollowerChanges,
        safeFollowingChanges,
        now,
        dateString,
        hourString
      );
      
      // ChangeEvent records are now created by relationshipService
      // Create audit logs for the changes
      const events = relationshipEvents || [];

      // Process follower additions for audit logging
      for (const username of safeFollowerChanges.added) {
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
      for (const username of safeFollowerChanges.removed) {
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
      for (const username of safeFollowingChanges.added) {
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
      for (const username of safeFollowingChanges.removed) {
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
      // Update counts if we got new data (even if 0, to reflect current state)
      if (data.followersCount !== undefined && data.followersCount !== null) {
        account.followersCount = data.followersCount;
      }
      if (data.followingCount !== undefined && data.followingCount !== null) {
        account.followingCount = data.followingCount;
      }
      if (data.postsCount !== undefined && data.postsCount !== null) {
        account.postsCount = data.postsCount;
      }
      
      // Update other fields if available
      if (data.displayName) account.displayName = data.displayName;
      if (data.profilePhoto && !data.profilePhoto.includes('rsrc.php')) {
        // Solo actualizar si no es una imagen por defecto de Instagram
        account.profilePhoto = data.profilePhoto;
      }
      if (data.description) account.description = data.description;
      
      // Clear any previous errors on successful scrape
      account.lastScrapeError = null;
      account.lastScrapeTimestamp = null;
      account.lastChecked = now;
      
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