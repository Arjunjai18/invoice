const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { business_name, email, password, currency, address, phone } = req.body;
  if (!business_name || !email || !password) {
    return res.status(400).json({ error: 'business_name, email and password are required' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const password_hash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  db.prepare(`
    INSERT INTO users (id, business_name, email, password_hash, currency, address, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, business_name, email, password_hash, currency || 'USD', address || '', phone || '');

  const token = jwt.sign({ userId: id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.status(201).json({ token, user: { id, business_name, email, currency: currency || 'USD' } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({
    token,
    user: {
      id: user.id,
      business_name: user.business_name,
      email: user.email,
      currency: user.currency,
      address: user.address,
      phone: user.phone,
      logo_data_url: user.logo_data_url
    }
  });
});

router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT id, business_name, email, currency, address, phone, logo_data_url FROM users WHERE id = ?').get(req.userId);
  res.json({ user });
});

router.put('/me', authRequired, (req, res) => {
  const { business_name, currency, address, phone, logo_data_url } = req.body;
  db.prepare(`
    UPDATE users SET business_name = ?, currency = ?, address = ?, phone = ?, logo_data_url = ?
    WHERE id = ?
  `).run(business_name, currency, address, phone, logo_data_url, req.userId);
  const user = db.prepare('SELECT id, business_name, email, currency, address, phone, logo_data_url FROM users WHERE id = ?').get(req.userId);
  res.json({ user });
});

module.exports = router;
