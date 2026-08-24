const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: [true, 'User name is required']
  },
  userPhone: {
    type: String,
    required: [true, 'User phone is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required']
  },
  plan: {
    type: String,
    required: [true, 'Plan is required']
  },
  receiptUrl: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  reviewedBy: {
    type: String,
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Payment', paymentSchema);
