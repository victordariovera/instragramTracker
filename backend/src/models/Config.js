const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  strict: false
});

// Index already defined on key field above

// Ensure only one config document exists
configSchema.statics.getConfig = async function() {
  let config = await this.findOne();
  if (!config) {
    config = new this({ key: 'default', value: { scrapingInterval: 10 } });
    await config.save();
  }
  return config;
};

configSchema.statics.setValue = async function(key, value) {
  let config = await this.getConfig();
  config.value = { ...config.value, [key]: value };
  config.updatedAt = new Date();
  await config.save();
  return config;
};

configSchema.statics.getValue = async function(key, defaultValue = null) {
  const config = await this.getConfig();
  return config.value[key] !== undefined ? config.value[key] : defaultValue;
};

module.exports = mongoose.model('Config', configSchema);

