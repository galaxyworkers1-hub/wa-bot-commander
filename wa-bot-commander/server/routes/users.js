const router = require('express').Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find().sort({ joinedAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, phone, plan, days } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }
    const exists = await User.findOne({ phone });
    if (exists) {
      return res.status(400).json({ error: 'User with this phone already exists' });
    }
    const expiresAt = days > 0 ? new Date(Date.now() + days * 86400000) : null;
    const user = await User.create({
      name,
      phone,
      plan: plan || 'free',
      accessStatus: days > 0 ? 'active' : 'expired',
      expiresAt
    });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id/toggle-access', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.accessStatus === 'active') {
      user.accessStatus = 'expired';
      user.expiresAt = null;
    } else {
      const durations = { basic: 30, pro: 90, premium: 365 };
      const days = durations[user.plan] || 30;
      user.accessStatus = 'active';
      user.expiresAt = new Date(Date.now() + days * 86400000);
    }
    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
