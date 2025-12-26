const mongoose = require('mongoose');

/**
 * Tracks relationships between tracked accounts and their followers/following
 * This provides a normalized, historical view of all relationships
 */
const accountRelationshipSchema = new mongoose.Schema({
  trackedAccountUsername: {
    type: String,
    required: true,
    index: true
  },
  relatedAccountUsername: {
    type: String,
    required: true
  },
  relationshipType: {
    type: String,
    required: true,
    enum: ['follower', 'following', 'mutual'],
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'removed'],
    default: 'active',
    index: true
  },
  // When this relationship was first observed
  firstObserved: {
    type: Date,
    required: true,
    default: Date.now
  },
  // When this relationship was last confirmed active
  lastConfirmed: {
    type: Date,
    required: true,
    default: Date.now
  },
  // When this relationship was removed (if status = 'removed')
  removedAt: {
    type: Date,
    default: null
  },
  // Store account details at time of relationship (snapshot)
  relatedAccountDisplayName: {
    type: String,
    default: ''
  },
  relatedAccountProfilePhoto: {
    type: String,
    default: ''
  },
  relatedAccountDescription: {
    type: String,
    default: ''
  }
}, {
  strict: false
});

// Compound index for efficient queries
accountRelationshipSchema.index({ trackedAccountUsername: 1, relationshipType: 1, status: 1 });
accountRelationshipSchema.index({ trackedAccountUsername: 1, relatedAccountUsername: 1, relationshipType: 1 }, { unique: true });
accountRelationshipSchema.index({ relatedAccountUsername: 1 });
accountRelationshipSchema.index({ firstObserved: -1 });
accountRelationshipSchema.index({ removedAt: -1 });

module.exports = mongoose.model('AccountRelationship', accountRelationshipSchema);

