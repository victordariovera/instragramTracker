const mongoose = require('mongoose');

const trackedAccountSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  displayName: {
    type: String,
    default: ''
  },
  profilePhoto: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  postsCount: {
    type: Number,
    default: 0
  },
  followersCount: {
    type: Number,
    default: 0
  },
  followingCount: {
    type: Number,
    default: 0
  },
  currentFollowers: {
    type: [String],
    default: []
  },
  currentFollowing: {
    type: [String],
    default: []
  },
      lastChecked: {
        type: Date,
        default: null
      },
      lastScrapeError: {
        type: String,
        default: null
      },
      lastScrapeTimestamp: {
        type: Date,
        default: null
      },
      isActive: {
        type: Boolean,
        default: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
}, {
  strict: false  // Allow fields not explicitly defined in schema (for backwards compatibility)
});

trackedAccountSchema.methods.getMutualFriends = function() {
  const followersSet = new Set(this.currentFollowers);
  return this.currentFollowing.filter(username => followersSet.has(username));
};

module.exports = mongoose.model('TrackedAccount', trackedAccountSchema);