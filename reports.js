const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// Dashboard summary
router.get('/dashboard', (req, res) => {
  const userId = req.userId;

  const totalInvoiced = db.prepare(`
    SELECT COALESCE(SUM(total), 0) as sum FROM invoices WHERE user_id = ? AND type = 'invoice'
  `).get(userId).sum;

  const totalPaid = db.prepare(`
    SELECT COALESCE(SUM(amount_paid), 0) as sum FROM invoices WHERE user_id = ? AND type = 'invoice'
  `).get(userId).sum;

  const totalOutstanding = totalInvoiced - totalPaid;

  const totalExpenses = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as sum FROM expenses WHERE user_id = ?
  `).get(userId).sum;

  const overdueCount = db.prepare(`
    SELECT COUNT(*) as count FROM invoices
    WHERE user_id = ? AND type = 'invoice' AND status != 'paid' AND due_date IS NOT NULL AND due_date < date('now')
  `).get(userId).count;

  const statusBreakdown = db.prepare(`
    SELECT status, COUNT(*) as count, COALESCE(SUM(total), 0) as total
    FROM invoices WHERE user_id = ? AND type = 'invoice' GROUP BY status
  `).all(userId);

  const recentInvoices = db.prepare(`
    SELECT i.*, c.name as client_name FROM invoices i
    JOIN clients c ON c.id = i.client_id
    WHERE i.user_id = ? ORDER BY i.created_at DESC LIMIT 5
  `).all(userId);

  res.json({
    totalInvoiced,
    totalPaid,
    totalOutstanding,
    totalExpenses,
    netProfit: totalPaid - totalExpenses,
    overdueCount,
    statusBreakdown,
    recentInvoices
  });
});

// Monthly revenue vs expenses for the last 6 months
router.get('/monthly', (req, res) => {
  const userId = req.userId;
  const revenue = db.prepare(`
    SELECT strftime('%Y-%m', paid_date) as month, COALESCE(SUM(amount), 0) as total
    FROM payments WHERE user_id = ?
    GROUP BY month ORDER BY month DESC LIMIT 6
  `).all(userId);

  const expenses = db.prepare(`
    SELECT strftime('%Y-%m', expense_date) as month, COALESCE(SUM(amount), 0) as total
    FROM expenses WHERE user_id = ?
    GROUP BY month ORDER BY month DESC LIMIT 6
  `).all(userId);

  res.json({ revenue: revenue.reverse(), expenses: expenses.reverse() });
});

module.exports = router;
