const router = require('express').Router();
const jwt = require('jsonwebtoken');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign(
      { name: 'Admin', role: 'superadmin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    return res.json({ token, user: { name: 'Admin', role: 'superadmin' } });
  }
  return res.status(401).json({ error: 'Invalid username or password' });
});

router.get('/verify', (req, res) => {
  const header = req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false });
  }
  try {
    jwt.verify(header.replace('Bearer ', ''), process.env.JWT_SECRET);
    return res.json({ valid: true });
  } catch {
    return res.status(401).json({ valid: false });
  }
});

module.exports = router;
