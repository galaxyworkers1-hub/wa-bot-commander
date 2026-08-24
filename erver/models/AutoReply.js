const mongoose = require('mongoose');

const autoReplySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Rule name is required']
  },
  type: {
    type: String,
    enum: ['contains', 'exact', 'regex'],
    required: [true, 'Match type is required']
  },
  keyword: {
    type: String,
    required: [true, 'Keyword is required']
  },
  response: {
    type: String,
    required: [true, 'Response is required']
  },
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AutoReply', autoReplySchema);
