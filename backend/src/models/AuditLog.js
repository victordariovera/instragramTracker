const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true,
    enum: [
      'scraping_started',
      'scraping_completed',
      'scraping_failed',
      'login_success',
      'login_failed',
      'account_added',
      'account_deleted',
      'follower_added',
      'follower_removed',
      'following_added',
      'following_removed'
    ],
    index: true
  },
  trackedAccountUsername: {
    type: String,
    default: null,
    index: true
  },
  affectedUsername: {
    type: String,
    default: null
  },
  username: {
    type: String,
    default: null,
    index: true
  },
  details: {
    type: String,
    default: ''
  },
  error: {
    type: String,
    default: null
  },
  success: {
    type: Boolean,
    default: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  }
}, {
  strict: false
});

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ eventType: 1, timestamp: -1 });
auditLogSchema.index({ trackedAccountUsername: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);

