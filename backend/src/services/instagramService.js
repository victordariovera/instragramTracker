const axios = require('axios');
const cheerio = require('cheerio');
const InstagramAccount = require('../models/InstagramAccount');

class InstagramService {
  constructor() {
    this.baseURL = 'https://www.instagram.com';
    // Use minimal headers to avoid detection - same as test script that worked
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    this.rateLimitDelay = 3000; // 3 seconds between requests to avoid rate limiting
    this.lastRequestTime = 0;
    this.rateLimitError = false;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async checkRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await this.sleep(this.rateLimitDelay - timeSinceLastRequest);
    }
    this.lastRequestTime = Date.now();
  }

  async getAccountData(username) {
    try {
      await this.checkRateLimit();
      const url = `${this.baseURL}/${username}/`;
      console.log(`Fetching data for ${username}...`);
      const response = await axios.get(url, { 
        headers: this.headers,
        timeout: 15000,
        validateStatus: (status) => status < 500 // Don't throw on 429, 404, etc.
      });
      
      // Handle rate limiting
      if (response.status === 429) {
        this.rateLimitError = true;
        throw new Error('RATE_LIMIT: Instagram rate limit exceeded. Please wait before trying again.');
      }
      
      // Handle 404
      if (response.status === 404) {
        return {
          username,
          displayName: username,
          followers: [],
          following: [],
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          profilePhoto: '',
          description: '',
          success: false,
          error: 'Account not found'
        };
      }

      const html = typeof response.data === 'string' ? response.data : String(response.data);
      let followersCount = 0;
      let followingCount = 0;
      let postsCount = 0;
      let profilePhoto = '';
      let description = '';
      let displayName = username;

      // Load cheerio early for meta tag extraction
      const $ = cheerio.load(html);
      
      // PRIMARY METHOD: Use cheerio to extract og:description (proven to work in testing)
      let metaContent = null;
      
      // Try to extract og:description using cheerio (most reliable)
      const metaTags = $('meta[property="og:description"]');
      
      if (metaTags.length > 0) {
        metaContent = metaTags.first().attr('content');
        if (metaContent) {
          console.log(`✅ Found og:description via cheerio`);
        }
      }
      
      // Fallback to regex if cheerio didn't work
      if (!metaContent) {
        const regexMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
        if (regexMatch && regexMatch[1]) {
          metaContent = regexMatch[1];
          console.log(`✅ Found og:description via regex`);
        }
      }
      
      let metaMatch = metaContent ? { 1: metaContent } : null;
      
      if (metaMatch && metaMatch[1]) {
        let metaContent = metaMatch[1]
          .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(parseInt(d, 10)))
          .replace(/&amp;/g, '&');
        
        console.log(`Meta content sample: ${metaContent.substring(0, 100)}...`);
        
        const fMatch = metaContent.match(/([\d,]+)\s+Followers?/i);
        const folMatch = metaContent.match(/([\d,]+)\s+Following/i);
        const pMatch = metaContent.match(/([\d,]+)\s+Posts?/i);
        
        console.log(`Matches - Followers: ${fMatch ? fMatch[1] : 'NO'}, Following: ${folMatch ? folMatch[1] : 'NO'}, Posts: ${pMatch ? pMatch[1] : 'NO'}`);
        
        if (fMatch) followersCount = parseInt(fMatch[1].replace(/,/g, '')) || 0;
        if (folMatch) followingCount = parseInt(folMatch[1].replace(/,/g, '')) || 0;
        if (pMatch) postsCount = parseInt(pMatch[1].replace(/,/g, '')) || 0;
        
        const nameMatch = metaContent.match(/from\s+([^(]+)\s*\(@/);
        if (nameMatch) displayName = nameMatch[1].trim();
        
        if (followersCount > 0 || followingCount > 0) {
          console.log(`✅ Found from meta: ${followersCount} followers, ${followingCount} following, ${postsCount} posts`);
        } else {
          console.log(`Meta found but no stats extracted`);
        }
      }
      
      // FALLBACK: Decode HTML and search directly
      if (followersCount === 0 && followingCount === 0) {
        const decodedHtml = html
          .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)))
          .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&nbsp;/g, ' ');

        const statsPattern = decodedHtml.match(/([\d,]+)\s+Followers?[^<]*?([\d,]+)\s+Following[^<]*?([\d,]+)\s+Posts?/i);
        
        if (statsPattern && statsPattern[1] && statsPattern[2]) {
          followersCount = parseInt(statsPattern[1].replace(/,/g, '')) || 0;
          followingCount = parseInt(statsPattern[2].replace(/,/g, '')) || 0;
          postsCount = statsPattern[3] ? parseInt(statsPattern[3].replace(/,/g, '')) || 0 : 0;
          console.log(`✅ Found from decoded HTML: ${followersCount} followers, ${followingCount} following, ${postsCount} posts`);
        }
      }
      
      // If still no data, try JSON extraction from script tags (Instagram's new structure)
      if (followersCount === 0 && followingCount === 0) {
        try {
          // Try to find JSON-LD or window._sharedData
          const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/s);
          if (jsonLdMatch) {
            try {
              const jsonLd = JSON.parse(jsonLdMatch[1]);
              if (jsonLd['@type'] === 'Person' || jsonLd.mainEntityOfPage) {
                // Extract from JSON-LD if available
                console.log('Found JSON-LD data');
              }
            } catch (e) {
              console.log('JSON-LD parse failed:', e.message);
            }
          }

          // Try window._sharedData pattern (Instagram's internal data)
          const sharedDataMatch = html.match(/window\._sharedData\s*=\s*({.+?});/s);
          if (sharedDataMatch) {
            try {
              const sharedData = JSON.parse(sharedDataMatch[1]);
              const user = sharedData?.entry_data?.ProfilePage?.[0]?.graphql?.user;
              if (user) {
                followersCount = user.edge_followed_by?.count || 0;
                followingCount = user.edge_follow?.count || 0;
                postsCount = user.edge_owner_to_timeline_media?.count || 0;
                profilePhoto = user.profile_pic_url_hd || user.profile_pic_url || '';
                description = user.biography || '';
                displayName = user.full_name || username;
                console.log(`✅ Found from _sharedData: ${followersCount} followers, ${followingCount} following, ${postsCount} posts`);
              }
            } catch (e) {
              console.log('_sharedData parse failed:', e.message);
            }
          }

          // Try to find data in script tags with type="application/json"
          if (followersCount === 0 && followingCount === 0) {
            const scriptMatches = html.match(/<script[^>]*type=["']application\/json["'][^>]*>(.*?)<\/script>/gs);
            if (scriptMatches) {
              for (const scriptMatch of scriptMatches) {
                try {
                  const jsonContent = scriptMatch.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
                  const data = JSON.parse(jsonContent);
                  
                  // Try different data structures
                  const user = data?.entry_data?.ProfilePage?.[0]?.graphql?.user ||
                              data?.graphql?.user ||
                              data?.user ||
                              data?.data?.user;
                  
                  if (user) {
                    followersCount = user.edge_followed_by?.count || user.follower_count || user.followers_count || 0;
                    followingCount = user.edge_follow?.count || user.following_count || 0;
                    postsCount = user.edge_owner_to_timeline_media?.count || user.media_count || user.posts_count || 0;
                    profilePhoto = user.profile_pic_url_hd || user.profile_pic_url || user.profile_picture || '';
                    description = user.biography || user.bio || '';
                    displayName = user.full_name || user.name || username;
                    
                    if (followersCount > 0 || followingCount > 0) {
                      console.log(`✅ Found from JSON script: ${followersCount} followers, ${followingCount} following, ${postsCount} posts`);
                      break;
                    }
                  }
                } catch (e) {
                  // Continue to next script tag
                }
              }
            }
          }

          // Try old ProfilePage pattern as last resort
          if (followersCount === 0 && followingCount === 0) {
            const oldPatternMatch = html.match(/<script[^>]*type=["']text\/javascript["'][^>]*>([^<]*"ProfilePage"[^<]*)<\/script>/);
            if (oldPatternMatch) {
              try {
                const jsonMatch = oldPatternMatch[1].match(/\{"config":\{[^}]+\},"entry_data":\{[^}]+\}\}/);
                if (jsonMatch) {
                  const data = JSON.parse(jsonMatch[0]);
                  if (data.entry_data && data.entry_data.ProfilePage && data.entry_data.ProfilePage[0]) {
                    const profileData = data.entry_data.ProfilePage[0].graphql?.user;
                    if (profileData) {
                      followersCount = profileData.edge_followed_by?.count || 0;
                      followingCount = profileData.edge_follow?.count || 0;
                      postsCount = profileData.edge_owner_to_timeline_media?.count || 0;
                      profilePhoto = profileData.profile_pic_url_hd || profileData.profile_pic_url || '';
                      description = profileData.biography || '';
                      displayName = profileData.full_name || username;
                      console.log(`✅ Found from old JSON pattern: ${followersCount} followers, ${followingCount} following, ${postsCount} posts`);
                    }
                  }
                }
              } catch (e) {
                console.log(`Failed to parse old JSON pattern: ${e.message}`);
              }
            }
          }
        } catch (e) {
          console.log(`Error in JSON extraction: ${e.message}`);
        }
      }

      // Use cheerio (already loaded) for other extractions
      if (!profilePhoto) {
        profilePhoto = $('meta[property="og:image"]').attr('content') || '';
      }
      
      if (displayName === username) {
        const titleContent = $('title').text();
        if (titleContent) {
          const nameMatch = titleContent.match(/([^(]+)\s*\(@/);
          if (nameMatch) displayName = nameMatch[1].trim();
        }
      }
      
      if (!description) {
        const titleContent = $('title').text();
        if (titleContent) {
          description = titleContent.split('(')[0].trim();
        }
      }

      console.log(`Extracted for ${username}: ${followersCount} followers, ${followingCount} following, ${postsCount} posts`);

      // Try to get actual follower/following lists from Instagram's GraphQL endpoints
      let followers = [];
      let following = [];
      
      try {
        // Try to extract from window._sharedData or similar structures
        const sharedDataMatch = html.match(/window\._sharedData\s*=\s*({.+?});/s);
        if (sharedDataMatch) {
          try {
            const sharedData = JSON.parse(sharedDataMatch[1]);
            const user = sharedData?.entry_data?.ProfilePage?.[0]?.graphql?.user;
            if (user) {
              // Try to get followers/following from edges (if available)
              if (user.edge_followed_by?.edges) {
                followers = user.edge_followed_by.edges.map(edge => edge.node?.username).filter(Boolean);
                console.log(`Found ${followers.length} followers from _sharedData`);
              }
              if (user.edge_follow?.edges) {
                following = user.edge_follow.edges.map(edge => edge.node?.username).filter(Boolean);
                console.log(`Found ${following.length} following from _sharedData`);
              }
            }
          } catch (e) {
            console.log(`Failed to parse _sharedData: ${e.message}`);
          }
        }
        
        // If we didn't get lists from _sharedData, try to fetch from GraphQL endpoints
        if (followers.length === 0 && followersCount > 0) {
          console.log(`Attempting to fetch followers list for ${username}...`);
          followers = await this.fetchFollowersList(username, followersCount);
        }
        
        if (following.length === 0 && followingCount > 0) {
          console.log(`Attempting to fetch following list for ${username}...`);
          following = await this.fetchFollowingList(username, followingCount);
        }
      } catch (error) {
        console.log(`Error fetching follower/following lists: ${error.message}`);
        // Continue with empty arrays if fetching fails
      }

      // Even if we can't get actual usernames, if we got counts, consider it successful
      const success = followersCount > 0 || followingCount > 0 || postsCount > 0;
      
      if (!success) {
        console.log(`⚠️ Warning: Could not extract any data for ${username}. Instagram may have changed their structure or is blocking requests.`);
      }

      return {
        username,
        displayName,
        followers, // Empty array - Instagram doesn't expose follower lists publicly
        following, // Empty array - Instagram doesn't expose following lists publicly
        followersCount,
        followingCount,
        postsCount,
        profilePhoto,
        description,
        success,
        warning: !success ? 'Could not extract data from Instagram. The page structure may have changed or requests are being blocked.' : null
      };
    } catch (error) {
      console.error(`Error fetching data for ${username}:`, error.message);
      
      // Check for rate limiting
      if (error.response && error.response.status === 429) {
        this.rateLimitError = true;
        return {
          username,
          displayName: username,
          followers: [],
          following: [],
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          profilePhoto: '',
          description: '',
          success: false,
          error: 'RATE_LIMIT: Instagram rate limit exceeded. Please wait before trying again.',
          rateLimited: true
        };
      }

      // Return empty data on error (don't use mock data)
      return {
        username,
        displayName: username,
        followers: [],
        following: [],
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        profilePhoto: '',
        description: '',
        success: false,
        error: error.message
      };
    }
  }

  async getAccountDetails(username) {
    try {
      await this.checkRateLimit();
      
      // Check if we already have this account in database
      let accountDoc = await InstagramAccount.findOne({ username: username.toLowerCase() });
      
      // If account exists and was updated recently (within 24 hours), return cached data
      if (accountDoc && accountDoc.lastUpdated) {
        const hoursSinceUpdate = (Date.now() - accountDoc.lastUpdated.getTime()) / (1000 * 60 * 60);
        if (hoursSinceUpdate < 24) {
          return {
            username: accountDoc.username,
            displayName: accountDoc.displayName,
            profilePhoto: accountDoc.profilePhoto,
            description: accountDoc.description,
            success: true,
            cached: true
          };
        }
      }

      const url = `${this.baseURL}/${username}/`;
      const response = await axios.get(url, { 
        headers: this.headers,
        timeout: 15000,
        validateStatus: (status) => status < 500 // Don't throw on 429, 404, etc.
      });

      // Handle rate limiting
      if (response.status === 429) {
        this.rateLimitError = true;
        throw new Error('RATE_LIMIT: Instagram rate limit exceeded. Please wait before trying again.');
      }

      if (response.status === 404) {
        return {
          username: username,
          displayName: username,
          profilePhoto: '',
          description: '',
          success: false,
          error: 'Account not found'
        };
      }

      const html = typeof response.data === 'string' ? response.data : String(response.data);
      let profilePhoto = '';
      let description = '';
      let displayName = username;

      const $ = cheerio.load(html);
      
      // Extract profile photo
      profilePhoto = $('meta[property="og:image"]').attr('content') || '';
      
      // Extract display name and description from title
      const titleContent = $('title').text();
      if (titleContent) {
        const nameMatch = titleContent.match(/([^(]+)\s*\(@/);
        if (nameMatch) displayName = nameMatch[1].trim();
      }

      // Try to extract description from meta
      const metaDescription = $('meta[property="og:description"]').attr('content') || '';
      if (metaDescription) {
        description = metaDescription
          .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(parseInt(d, 10)))
          .replace(/&amp;/g, '&')
          .split(' - ')[0] // Get description part before stats
          .trim();
      }

      // Save or update in database
      if (accountDoc) {
        accountDoc.displayName = displayName;
        accountDoc.profilePhoto = profilePhoto;
        accountDoc.description = description;
        accountDoc.lastUpdated = new Date();
        await accountDoc.save();
      } else {
        accountDoc = new InstagramAccount({
          username: username.toLowerCase(),
          displayName,
          profilePhoto,
          description,
          lastUpdated: new Date()
        });
        await accountDoc.save();
      }

      return {
        username: accountDoc.username,
        displayName: accountDoc.displayName,
        profilePhoto: accountDoc.profilePhoto,
        description: accountDoc.description,
        success: true,
        cached: false
      };
    } catch (error) {
      console.error(`Error fetching account details for ${username}:`, error.message);
      
      // Check if we have cached data
      const accountDoc = await InstagramAccount.findOne({ username: username.toLowerCase() });
      if (accountDoc) {
        return {
          username: accountDoc.username,
          displayName: accountDoc.displayName,
          profilePhoto: accountDoc.profilePhoto,
          description: accountDoc.description,
          success: true,
          cached: true,
          error: error.message
        };
      }

      return {
        username: username,
        displayName: username,
        profilePhoto: '',
        description: '',
        success: false,
        error: error.message.includes('RATE_LIMIT') ? error.message : 'Failed to fetch account details'
      };
    }
  }

  async fetchFollowersList(username, expectedCount) {
    try {
      await this.checkRateLimit();
      const url = `${this.baseURL}/${username}/followers/`;
      console.log(`Fetching followers list from ${url}...`);
      const response = await axios.get(url, {
        headers: this.headers,
        timeout: 15000,
        validateStatus: (status) => status < 500
      });
      
      if (response.status === 200) {
        const html = typeof response.data === 'string' ? response.data : String(response.data);
        const $ = cheerio.load(html);
        
        // Try to extract usernames from links
        const usernames = new Set();
        $('a[href*="/"]').each((i, el) => {
          const href = $(el).attr('href');
          if (href && href.startsWith('/') && !href.includes('/p/') && !href.includes('/reel/') && !href.includes('/stories/')) {
            const match = href.match(/^\/([^\/\?]+)\/?$/);
            if (match && match[1] && match[1] !== username && match[1] !== 'explore' && match[1] !== 'accounts' && match[1] !== 'direct' && match[1] !== 'reels') {
              usernames.add(match[1]);
            }
          }
        });
        
        // Also try to find usernames in data attributes or JSON
        const jsonMatches = html.match(/window\._sharedData\s*=\s*({.+?});/s);
        if (jsonMatches) {
          try {
            const sharedData = JSON.parse(jsonMatches[1]);
            const edges = sharedData?.entry_data?.ProfilePage?.[0]?.graphql?.user?.edge_followed_by?.edges;
            if (edges && Array.isArray(edges)) {
              edges.forEach(edge => {
                if (edge.node?.username) {
                  usernames.add(edge.node.username);
                }
              });
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
        
        const uniqueUsernames = Array.from(usernames).slice(0, Math.min(expectedCount, 1000));
        console.log(`Extracted ${uniqueUsernames.length} followers from followers page`);
        return uniqueUsernames;
      } else {
        console.log(`Followers page returned status ${response.status} - may require authentication`);
      }
    } catch (error) {
      console.log(`Error fetching followers list: ${error.message}`);
    }
    return [];
  }

  async fetchFollowingList(username, expectedCount) {
    try {
      await this.checkRateLimit();
      const url = `${this.baseURL}/${username}/following/`;
      console.log(`Fetching following list from ${url}...`);
      const response = await axios.get(url, {
        headers: this.headers,
        timeout: 15000,
        validateStatus: (status) => status < 500
      });
      
      if (response.status === 200) {
        const html = typeof response.data === 'string' ? response.data : String(response.data);
        const $ = cheerio.load(html);
        
        // Try to extract usernames from links
        const usernames = new Set();
        $('a[href*="/"]').each((i, el) => {
          const href = $(el).attr('href');
          if (href && href.startsWith('/') && !href.includes('/p/') && !href.includes('/reel/') && !href.includes('/stories/')) {
            const match = href.match(/^\/([^\/\?]+)\/?$/);
            if (match && match[1] && match[1] !== username && match[1] !== 'explore' && match[1] !== 'accounts' && match[1] !== 'direct' && match[1] !== 'reels') {
              usernames.add(match[1]);
            }
          }
        });
        
        // Also try to find usernames in data attributes or JSON
        const jsonMatches = html.match(/window\._sharedData\s*=\s*({.+?});/s);
        if (jsonMatches) {
          try {
            const sharedData = JSON.parse(jsonMatches[1]);
            const edges = sharedData?.entry_data?.ProfilePage?.[0]?.graphql?.user?.edge_follow?.edges;
            if (edges && Array.isArray(edges)) {
              edges.forEach(edge => {
                if (edge.node?.username) {
                  usernames.add(edge.node.username);
                }
              });
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
        
        const uniqueUsernames = Array.from(usernames).slice(0, Math.min(expectedCount, 1000));
        console.log(`Extracted ${uniqueUsernames.length} following from following page`);
        return uniqueUsernames;
      } else {
        console.log(`Following page returned status ${response.status} - may require authentication`);
      }
    } catch (error) {
      console.log(`Error fetching following list: ${error.message}`);
    }
    return [];
  }

  async detectChanges(oldList, newList) {
    const oldSet = new Set(oldList);
    const newSet = new Set(newList);
    
    const added = [...newSet].filter(username => !oldSet.has(username));
    const removed = [...oldSet].filter(username => !newSet.has(username));
    
    return { added, removed };
  }
}

module.exports = new InstagramService();
