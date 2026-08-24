const router = require('express').Router();
const Payment = require('../models/Payment');
const User = require('../models/User');
const Log = require('../models/Log');
const auth = require('../middleware/auth');
const { getClient } = require('../services/whatsapp');

function getTimeStr() {
  return new Date().toTimeString().split(' ')[0];
}

router.get('/', auth, async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', auth, async (req, res) => {
  try {
    const total = await Payment.countDocuments();
    const pending = await Payment.countDocuments({ status: 'pending' });
    const approved = await Payment.countDocuments({ status: 'approved' });
    const rejected = await Payment.countDocuments({ status: 'rejected' });
    const revenue = await Payment.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    res.json({
      total,
      pending,
      approved,
      rejected,
      totalRevenue: revenue.length > 0 ? revenue[0].total : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/submit', async (req, res) => {
  try {
    const { phone, name, amount, plan, receiptUrl } = req.body;
    if (!phone || !name || !amount || !plan) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const payment = await Payment.create({
      userPhone: phone,
      userName: name,
      amount: Number(amount),
      plan,
      receiptUrl: receiptUrl || null,
      status: 'pending'
    });
    await Log.create({
      type: 'system',
      message: `New payment submitted by ${name} - Rs.${amount} (${plan})`,
      time: getTimeStr()
    });
    res.status(201).json(payment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id/approve', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status !== 'pending') return res.status(400).json({ error: 'Already reviewed' });

    payment.status = 'approved';
    payment.reviewedBy = req.admin.name;
    payment.reviewedAt = new Date();
    await payment.save();

    const durations = { basic: 30, pro: 90, premium: 365 };
    const days = durations[payment.plan] || 30;
    const expiresAt = new Date(Date.now() + days * 86400000);

    const user = await User.findOneAndUpdate(
      { phone: payment.userPhone },
      { name: payment.userName, plan: payment.plan, accessStatus: 'active', expiresAt },
      { upsert: true, new: true }
    );

    const client = getClient();
    if (client) {
      try {
        const chatId = payment.userPhone.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        await client.sendMessage(chatId,
          `*Payment Approved*\n\nAmount: Rs.${payment.amount}\nPlan: ${payment.plan.charAt(0).toUpperCase() + payment.plan.slice(1)}\nValid until: ${expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\nThank you!`
        );
      } catch (err) {
        console.error('[WA] Send failed:', err.message);
      }
    }

    await Log.create({
      type: 'system',
      message: `Payment APPROVED: ${payment.userName} - Rs.${payment.amount} (${payment.plan})`,
      time: getTimeStr()
    });

    res.json({ payment, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/reject', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status !== 'pending') return res.status(400).json({ error: 'Already reviewed' });

    payment.status = 'rejected';
    payment.reviewedBy = req.admin.name;
    payment.reviewedAt = new Date();
    await payment.save();

    const client = getClient();
    if (client) {
      try {
        const chatId = payment.userPhone.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        await client.sendMessage(chatId,
          `*Payment Rejected*\n\nAmount: Rs.${payment.amount}\n\nYour receipt could not be verified. Please contact support.`
        );
      } catch (err) {
        console.error('[WA] Send failed:', err.message);
      }
    }

    await Log.create({
      type: 'system',
      message: `Payment REJECTED: ${payment.userName} - Rs.${payment.amount}`,
      time: getTimeStr()
    });

    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
