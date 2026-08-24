const router = require('express').Router();
const AutoReply = require('../models/AutoReply');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Log = require('../models/Log');
const auth = require('../middleware/auth');

function getTimeStr() {
  return new Date().toTimeString().split(' ')[0];
}

router.get('/replies', auth, async (req, res) => {
  try {
    const replies = await AutoReply.find().sort({ createdAt: -1 });
    res.json(replies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/replies', auth, async (req, res) => {
  try {
    const { name, type, keyword, response } = req.body;
    if (!name || !type || !keyword || !response) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const rule = await AutoReply.create({ name, type, keyword, response });
    await Log.create({
      type: 'system',
      message: `New reply rule added: ${name} (${type}: "${keyword}")`,
      time: getTimeStr()
    });
    res.status(201).json(rule);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/replies/:id/toggle', auth, async (req, res) => {
  try {
    const rule = await AutoReply.findById(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    rule.active = !rule.active;
    await rule.save();
    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/replies/:id', auth, async (req, res) => {
  try {
    const rule = await AutoReply.findByIdAndDelete(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    await Log.create({
      type: 'system',
      message: `Reply rule deleted: ${rule.name}`,
      time: getTimeStr()
    });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/logs', auth, async (req, res) => {
  try {
    const { type, limit } = req.query;
    let query = {};
    if (type && type !== 'all') query.type = type;
    const logs = await Log.find(query).sort({ createdAt: -1 }).limit(Number(limit) || 100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/logs', auth, async (req, res) => {
  try {
    await Log.deleteMany({});
    res.json({ message: 'All logs cleared' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', auth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ accessStatus: 'active' });
    const totalMessages = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$messageCount' } } }
    ]);
    const pendingPayments = await Payment.countDocuments({ status: 'pending' });
    res.json({
      totalUsers,
      activeUsers,
      totalMessages: totalMessages.length > 0 ? totalMessages[0].total : 0,
      pendingPayments
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/status', auth, async (req, res) => {
  const { isConnected, getInfo } = require('../services/whatsapp');
  const info = getInfo();
  res.json({
    connected: isConnected(),
    phone: info ? (info.wid ? info.wid._serialized : null) : null,
    pushName: info ? info.pushName : null
  });
});

module.exports = router;
