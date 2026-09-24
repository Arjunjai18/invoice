require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const clientsRoutes = require('./routes/clients');
const invoicesRoutes = require('./routes/invoices');
const expensesRoutes = require('./routes/expenses');
const reportsRoutes = require('./routes/reports');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/reports', reportsRoutes);

// Optionally serve the frontend as static files for single-service deployment.
// Place a copy of the frontend/ folder at ../frontend relative to this file to enable.
const frontendDir = path.join(__dirname, '..', 'frontend');
if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(frontendDir, 'index.html')));
}

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Invoicing API listening on port ${PORT}`));
