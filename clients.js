const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/', (req, res) => {
  const clients = db.prepare('SELECT * FROM clients WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json({ clients });
});

router.get('/:id', (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json({ client });
});

router.post('/', (req, res) => {
  const { name, email, phone, address, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const id = uuidv4();
  db.prepare(`
    INSERT INTO clients (id, user_id, name, email, phone, address, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.userId, name, email || '', phone || '', address || '', notes || '');
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  res.status(201).json({ client });
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM clients WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Client not found' });
  const { name, email, phone, address, notes } = req.body;
  db.prepare(`
    UPDATE clients SET name = ?, email = ?, phone = ?, address = ?, notes = ? WHERE id = ?
  `).run(name ?? existing.name, email ?? existing.email, phone ?? existing.phone, address ?? existing.address, notes ?? existing.notes, req.params.id);
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  res.json({ client });
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM clients WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Client not found' });
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
