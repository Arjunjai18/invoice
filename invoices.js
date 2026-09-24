const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const { generateInvoicePdf } = require('../utils/pdfGenerator');

const router = express.Router();
router.use(authRequired);

function computeTotals(items, tax_rate, discount) {
  const subtotal = items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_price), 0);
  const afterDiscount = Math.max(subtotal - Number(discount || 0), 0);
  const tax_amount = afterDiscount * (Number(tax_rate || 0) / 100);
  const total = afterDiscount + tax_amount;
  return { subtotal, tax_amount, total };
}

function nextInvoiceNumber(userId, type) {
  const prefix = type === 'estimate' ? 'EST' : 'INV';
  const row = db.prepare(`
    SELECT COUNT(*) as count FROM invoices WHERE user_id = ? AND type = ?
  `).get(userId, type);
  const seq = (row.count + 1).toString().padStart(4, '0');
  return `${prefix}-${seq}`;
}

// List invoices/estimates, optional ?type=invoice|estimate&status=
router.get('/', (req, res) => {
  const { type, status } = req.query;
  let query = 'SELECT * FROM invoices WHERE user_id = ?';
  const params = [req.userId];
  if (type) { query += ' AND type = ?'; params.push(type); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  query += ' ORDER BY created_at DESC';
  const invoices = db.prepare(query).all(...params);
  res.json({ invoices });
});

router.get('/:id', (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!invoice) return res.status(404).json({ error: 'Not found' });
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC').all(invoice.id);
  const payments = db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY paid_date DESC').all(invoice.id);
  res.json({ invoice, items, payments });
});

router.post('/', (req, res) => {
  const { client_id, type, issue_date, due_date, tax_rate, discount, notes, items, status } = req.body;
  if (!client_id || !issue_date || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'client_id, issue_date and at least one item are required' });
  }
  const client = db.prepare('SELECT id FROM clients WHERE id = ? AND user_id = ?').get(client_id, req.userId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const invType = type === 'estimate' ? 'estimate' : 'invoice';
  const { subtotal, tax_amount, total } = computeTotals(items, tax_rate, discount);
  const id = uuidv4();
  const invoice_number = nextInvoiceNumber(req.userId, invType);

  db.prepare(`
    INSERT INTO invoices (id, user_id, client_id, invoice_number, type, status, issue_date, due_date, tax_rate, discount, notes, subtotal, tax_amount, total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.userId, client_id, invoice_number, invType, status || 'draft', issue_date, due_date || null, tax_rate || 0, discount || 0, notes || '', subtotal, tax_amount, total);

  const insertItem = db.prepare(`
    INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, amount, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  items.forEach((it, idx) => {
    const amount = Number(it.quantity) * Number(it.unit_price);
    insertItem.run(uuidv4(), id, it.description, it.quantity, it.unit_price, amount, idx);
  });

  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  const savedItems = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC').all(id);
  res.status(201).json({ invoice, items: savedItems });
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { client_id, issue_date, due_date, tax_rate, discount, notes, items, status } = req.body;
  const finalItems = Array.isArray(items) ? items : null;
  let subtotal = existing.subtotal, tax_amount = existing.tax_amount, total = existing.total;

  if (finalItems) {
    const totals = computeTotals(finalItems, tax_rate ?? existing.tax_rate, discount ?? existing.discount);
    subtotal = totals.subtotal; tax_amount = totals.tax_amount; total = totals.total;
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(req.params.id);
    const insertItem = db.prepare(`
      INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, amount, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    finalItems.forEach((it, idx) => {
      const amount = Number(it.quantity) * Number(it.unit_price);
      insertItem.run(uuidv4(), req.params.id, it.description, it.quantity, it.unit_price, amount, idx);
    });
  }

  db.prepare(`
    UPDATE invoices SET client_id = ?, issue_date = ?, due_date = ?, tax_rate = ?, discount = ?, notes = ?,
      status = ?, subtotal = ?, tax_amount = ?, total = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    client_id ?? existing.client_id,
    issue_date ?? existing.issue_date,
    due_date ?? existing.due_date,
    tax_rate ?? existing.tax_rate,
    discount ?? existing.discount,
    notes ?? existing.notes,
    status ?? existing.status,
    subtotal, tax_amount, total,
    req.params.id
  );

  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  const savedItems = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC').all(req.params.id);
  res.json({ invoice, items: savedItems });
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Record a payment against an invoice
router.post('/:id/payments', (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!invoice) return res.status(404).json({ error: 'Not found' });
  const { amount, method, paid_date, notes } = req.body;
  if (!amount || !paid_date) return res.status(400).json({ error: 'amount and paid_date are required' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO payments (id, user_id, invoice_id, amount, method, paid_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.userId, req.params.id, amount, method || '', paid_date, notes || '');

  const newAmountPaid = invoice.amount_paid + Number(amount);
  const newStatus = newAmountPaid >= invoice.total ? 'paid' : invoice.status === 'draft' ? 'sent' : invoice.status;
  db.prepare(`UPDATE invoices SET amount_paid = ?, status = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(newAmountPaid, newStatus, req.params.id);

  const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  res.status(201).json({ invoice: updated });
});

// Download PDF
router.get('/:id/pdf', (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!invoice) return res.status(404).json({ error: 'Not found' });
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(invoice.client_id);
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC').all(invoice.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  generateInvoicePdf({ user, client, invoice, items }, res);
});

module.exports = router;
