const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone is required'],
    unique: true,
    trim: true
  },
  plan: {
    type: String,
    enum: ['free', 'basic', 'pro', 'premium'],
    default: 'free'
  },
  accessStatus: {
    type: String,
    enum: ['active', 'expired', 'banned'],
    default: 'expired'
  },
  expiresAt: {
    type: Date,
    default: null
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  messageCount: {
    type: Number,
    default: 0
  }
});

module.exports = mongoose.model('User', userSchema);
