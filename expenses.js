const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/', (req, res) => {
  const expenses = db.prepare('SELECT * FROM expenses WHERE user_id = ? ORDER BY expense_date DESC').all(req.userId);
  res.json({ expenses });
});

router.post('/', (req, res) => {
  const { category, vendor, description, amount, expense_date } = req.body;
  if (!amount || !expense_date) return res.status(400).json({ error: 'amount and expense_date are required' });
  const id = uuidv4();
  db.prepare(`
    INSERT INTO expenses (id, user_id, category, vendor, description, amount, expense_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.userId, category || '', vendor || '', description || '', amount, expense_date);
  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
  res.status(201).json({ expense });
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { category, vendor, description, amount, expense_date } = req.body;
  db.prepare(`
    UPDATE expenses SET category = ?, vendor = ?, description = ?, amount = ?, expense_date = ? WHERE id = ?
  `).run(
    category ?? existing.category, vendor ?? existing.vendor, description ?? existing.description,
    amount ?? existing.amount, expense_date ?? existing.expense_date, req.params.id
  );
  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  res.json({ expense });
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
