const mongoose = require('mongoose');

const instagramAccountSchema = new mongoose.Schema({
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
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  strict: false
});

instagramAccountSchema.index({ username: 1 });
instagramAccountSchema.index({ lastUpdated: -1 });

module.exports = mongoose.model('InstagramAccount', instagramAccountSchema);

