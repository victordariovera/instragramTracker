const mongoose = require('mongoose');

const changeEventSchema = new mongoose.Schema({
  trackedAccountUsername: {
    type: String,
    required: true,
    index: true
  },
  eventType: {
    type: String,
    required: true,
    enum: ['follower_added', 'follower_removed', 'following_added', 'following_removed']
  },
  affectedUsername: {
    type: String,
    required: true,
    index: true
  },
  affectedDisplayName: {
    type: String,
    default: ''
  },
  affectedProfilePhoto: {
    type: String,
    default: ''
  },
  affectedDescription: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  date: {
    type: String,
    required: true,
    index: true
  },
  hour: {
    type: String,
    default: ''
  }
}, {
  strict: false
});

changeEventSchema.index({ trackedAccountUsername: 1, timestamp: -1 });
changeEventSchema.index({ trackedAccountUsername: 1, eventType: 1, timestamp: -1 });
changeEventSchema.index({ affectedUsername: 1, timestamp: -1 });

module.exports = mongoose.model('ChangeEvent', changeEventSchema);