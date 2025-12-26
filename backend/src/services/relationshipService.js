const InstagramAccount = require('../models/InstagramAccount');
const AccountRelationship = require('../models/AccountRelationship');
const ChangeEvent = require('../models/ChangeEvent');
const instagramService = require('./instagramService');

class RelationshipService {
  /**
   * Store or update an Instagram account in the normalized accounts table
   */
  async ensureAccountExists(username, accountDetails = null) {
    let account = await InstagramAccount.findOne({ username: username.toLowerCase() });
    
    if (!account) {
      // Try to fetch details if not provided
      if (!accountDetails) {
        try {
          accountDetails = await instagramService.getAccountDetails(username);
          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
          console.log(`Could not fetch details for ${username}, creating with minimal data`);
          accountDetails = {
            username,
            displayName: username,
            profilePhoto: '',
            description: '',
            success: false
          };
        }
      }
      
      account = new InstagramAccount({
        username: username.toLowerCase(),
        displayName: accountDetails.displayName || username,
        profilePhoto: accountDetails.profilePhoto || '',
        description: accountDetails.description || '',
        lastUpdated: new Date()
      });
      await account.save();
    } else {
      // Update if we have new details
      if (accountDetails && accountDetails.success !== false) {
        account.displayName = accountDetails.displayName || account.displayName;
        account.profilePhoto = accountDetails.profilePhoto || account.profilePhoto;
        account.description = accountDetails.description || account.description;
        account.lastUpdated = new Date();
        await account.save();
      }
    }
    
    return account;
  }

  /**
   * Store initial snapshot of followers/following when account is first added
   * This creates baseline relationships without creating change events
   */
  async storeInitialSnapshot(trackedAccountUsername, followersList, followingList) {
    const now = new Date();
    const relationships = [];
    
    // Process followers
    for (const followerUsername of followersList) {
      try {
        // Ensure account exists
        const account = await this.ensureAccountExists(followerUsername);
        
        // Check if relationship already exists
        const existing = await AccountRelationship.findOne({
          trackedAccountUsername: trackedAccountUsername.toLowerCase(),
          relatedAccountUsername: followerUsername.toLowerCase(),
          relationshipType: 'follower'
        });
        
        if (!existing) {
          relationships.push({
            trackedAccountUsername: trackedAccountUsername.toLowerCase(),
            relatedAccountUsername: followerUsername.toLowerCase(),
            relationshipType: 'follower',
            status: 'active',
            firstObserved: now,
            lastConfirmed: now,
            relatedAccountDisplayName: account.displayName,
            relatedAccountProfilePhoto: account.profilePhoto,
            relatedAccountDescription: account.description
          });
        }
      } catch (err) {
        console.error(`Error processing follower ${followerUsername}:`, err.message);
      }
    }
    
    // Process following
    for (const followingUsername of followingList) {
      try {
        const account = await this.ensureAccountExists(followingUsername);
        
        const existing = await AccountRelationship.findOne({
          trackedAccountUsername: trackedAccountUsername.toLowerCase(),
          relatedAccountUsername: followingUsername.toLowerCase(),
          relationshipType: 'following'
        });
        
        if (!existing) {
          relationships.push({
            trackedAccountUsername: trackedAccountUsername.toLowerCase(),
            relatedAccountUsername: followingUsername.toLowerCase(),
            relationshipType: 'following',
            status: 'active',
            firstObserved: now,
            lastConfirmed: now,
            relatedAccountDisplayName: account.displayName,
            relatedAccountProfilePhoto: account.profilePhoto,
            relatedAccountDescription: account.description
          });
        }
      } catch (err) {
        console.error(`Error processing following ${followingUsername}:`, err.message);
      }
    }
    
    // Bulk insert relationships
    if (relationships.length > 0) {
      await AccountRelationship.insertMany(relationships, { ordered: false });
      console.log(`Stored ${relationships.length} initial relationships for ${trackedAccountUsername}`);
    }
    
    // Update mutual relationships
    await this.updateMutualRelationships(trackedAccountUsername);
  }

  /**
   * Update relationships based on detected changes
   * Creates change events and updates relationship status
   */
  async updateRelationships(trackedAccountUsername, followerChanges, followingChanges, timestamp, dateString, hourString) {
    const now = timestamp || new Date();
    const addedFollowers = Array.isArray(followerChanges?.added) ? followerChanges.added : [];
    const removedFollowers = Array.isArray(followerChanges?.removed) ? followerChanges.removed : [];
    const addedFollowing = Array.isArray(followingChanges?.added) ? followingChanges.added : [];
    const removedFollowing = Array.isArray(followingChanges?.removed) ? followingChanges.removed : [];
    
    // Process added followers
    for (const username of addedFollowers) {
      try {
        const account = await this.ensureAccountExists(username);
        
        await AccountRelationship.findOneAndUpdate(
          {
            trackedAccountUsername: trackedAccountUsername.toLowerCase(),
            relatedAccountUsername: username.toLowerCase(),
            relationshipType: 'follower'
          },
          {
            $set: {
              status: 'active',
              lastConfirmed: now,
              relatedAccountDisplayName: account.displayName,
              relatedAccountProfilePhoto: account.profilePhoto,
              relatedAccountDescription: account.description,
              removedAt: null
            },
            $setOnInsert: {
              firstObserved: now
            }
          },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.error(`Error updating follower ${username}:`, err.message);
      }
    }
    
    // Process removed followers
    for (const username of removedFollowers) {
      try {
        await AccountRelationship.findOneAndUpdate(
          {
            trackedAccountUsername: trackedAccountUsername.toLowerCase(),
            relatedAccountUsername: username.toLowerCase(),
            relationshipType: 'follower'
          },
          {
            $set: {
              status: 'removed',
              removedAt: now
            }
          }
        );
      } catch (err) {
        console.error(`Error removing follower ${username}:`, err.message);
      }
    }
    
    // Process added following
    for (const username of addedFollowing) {
      try {
        const account = await this.ensureAccountExists(username);
        
        await AccountRelationship.findOneAndUpdate(
          {
            trackedAccountUsername: trackedAccountUsername.toLowerCase(),
            relatedAccountUsername: username.toLowerCase(),
            relationshipType: 'following'
          },
          {
            $set: {
              status: 'active',
              lastConfirmed: now,
              relatedAccountDisplayName: account.displayName,
              relatedAccountProfilePhoto: account.profilePhoto,
              relatedAccountDescription: account.description,
              removedAt: null
            },
            $setOnInsert: {
              firstObserved: now
            }
          },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.error(`Error updating following ${username}:`, err.message);
      }
    }
    
    // Process removed following
    for (const username of removedFollowing) {
      try {
        await AccountRelationship.findOneAndUpdate(
          {
            trackedAccountUsername: trackedAccountUsername.toLowerCase(),
            relatedAccountUsername: username.toLowerCase(),
            relationshipType: 'following'
          },
          {
            $set: {
              status: 'removed',
              removedAt: now
            }
          }
        );
      } catch (err) {
        console.error(`Error removing following ${username}:`, err.message);
      }
    }
    
    // Update mutual relationships
    await this.updateMutualRelationships(trackedAccountUsername);
    
    // Create ChangeEvent records for the changes
    const changeEvents = [];
    
    for (const username of addedFollowers) {
      try {
        const account = await this.ensureAccountExists(username);
        changeEvents.push({
          trackedAccountUsername: trackedAccountUsername.toLowerCase(),
          eventType: 'follower_added',
          affectedUsername: username.toLowerCase(),
          affectedDisplayName: account.displayName,
          affectedProfilePhoto: account.profilePhoto,
          affectedDescription: account.description,
          timestamp: now,
          date: dateString,
          hour: hourString
        });
      } catch (err) {
        console.error(`Error creating change event for follower ${username}:`, err.message);
      }
    }
    
    for (const username of removedFollowers) {
      try {
        const account = await this.ensureAccountExists(username);
        changeEvents.push({
          trackedAccountUsername: trackedAccountUsername.toLowerCase(),
          eventType: 'follower_removed',
          affectedUsername: username.toLowerCase(),
          affectedDisplayName: account.displayName,
          affectedProfilePhoto: account.profilePhoto,
          affectedDescription: account.description,
          timestamp: now,
          date: dateString,
          hour: hourString
        });
      } catch (err) {
        console.error(`Error creating change event for removed follower ${username}:`, err.message);
      }
    }
    
    for (const username of addedFollowing) {
      try {
        const account = await this.ensureAccountExists(username);
        changeEvents.push({
          trackedAccountUsername: trackedAccountUsername.toLowerCase(),
          eventType: 'following_added',
          affectedUsername: username.toLowerCase(),
          affectedDisplayName: account.displayName,
          affectedProfilePhoto: account.profilePhoto,
          affectedDescription: account.description,
          timestamp: now,
          date: dateString,
          hour: hourString
        });
      } catch (err) {
        console.error(`Error creating change event for following ${username}:`, err.message);
      }
    }
    
    for (const username of removedFollowing) {
      try {
        const account = await this.ensureAccountExists(username);
        changeEvents.push({
          trackedAccountUsername: trackedAccountUsername.toLowerCase(),
          eventType: 'following_removed',
          affectedUsername: username.toLowerCase(),
          affectedDisplayName: account.displayName,
          affectedProfilePhoto: account.profilePhoto,
          affectedDescription: account.description,
          timestamp: now,
          date: dateString,
          hour: hourString
        });
      } catch (err) {
        console.error(`Error creating change event for removed following ${username}:`, err.message);
      }
    }
    
    if (changeEvents.length > 0) {
      try {
        await ChangeEvent.insertMany(changeEvents);
        console.log(`Created ${changeEvents.length} change events for ${trackedAccountUsername}`);
      } catch (err) {
        console.error(`Error inserting change events:`, err.message);
      }
    }
    
    return changeEvents;
  }

  /**
   * Update mutual relationships based on current follower/following state
   */
  async updateMutualRelationships(trackedAccountUsername) {
    const activeFollowers = await AccountRelationship.find({
      trackedAccountUsername: trackedAccountUsername.toLowerCase(),
      relationshipType: 'follower',
      status: 'active'
    }).select('relatedAccountUsername');
    
    const activeFollowing = await AccountRelationship.find({
      trackedAccountUsername: trackedAccountUsername.toLowerCase(),
      relationshipType: 'following',
      status: 'active'
    }).select('relatedAccountUsername');
    
    const followerSet = new Set(activeFollowers.map(r => r.relatedAccountUsername.toLowerCase()));
    const mutualUsernames = activeFollowing
      .filter(r => followerSet.has(r.relatedAccountUsername.toLowerCase()))
      .map(r => r.relatedAccountUsername.toLowerCase());
    
    const now = new Date();
    
    // Mark all current mutuals as active
    for (const username of mutualUsernames) {
      const followerRel = await AccountRelationship.findOne({
        trackedAccountUsername: trackedAccountUsername.toLowerCase(),
        relatedAccountUsername: username,
        relationshipType: 'follower',
        status: 'active'
      });
      
      if (followerRel) {
        await AccountRelationship.findOneAndUpdate(
          {
            trackedAccountUsername: trackedAccountUsername.toLowerCase(),
            relatedAccountUsername: username,
            relationshipType: 'mutual'
          },
          {
            $set: {
              status: 'active',
              lastConfirmed: now,
              relatedAccountDisplayName: followerRel.relatedAccountDisplayName,
              relatedAccountProfilePhoto: followerRel.relatedAccountProfilePhoto,
              relatedAccountDescription: followerRel.relatedAccountDescription,
              removedAt: null
            },
            $setOnInsert: {
              firstObserved: now
            }
          },
          { upsert: true, new: true }
        );
      }
    }
    
    // Mark mutuals that are no longer mutual as removed
    await AccountRelationship.updateMany(
      {
        trackedAccountUsername: trackedAccountUsername.toLowerCase(),
        relationshipType: 'mutual',
        status: 'active',
        relatedAccountUsername: { $nin: mutualUsernames }
      },
      {
        $set: {
          status: 'removed',
          removedAt: now
        }
      }
    );
  }

  /**
   * Get all relationships for a tracked account
   */
  async getRelationships(trackedAccountUsername, relationshipType, status = null) {
    const query = {
      trackedAccountUsername: trackedAccountUsername.toLowerCase(),
      relationshipType
    };
    
    if (status) {
      query.status = status;
    }
    
    return await AccountRelationship.find(query)
      .sort({ firstObserved: -1 });
  }
}

module.exports = new RelationshipService();

