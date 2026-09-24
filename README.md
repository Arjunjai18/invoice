# InvoiceFlow — Invoicing, Estimates & Billing App

A complete, ready-to-deploy invoicing web app: user accounts, clients,
invoices & estimates (with PDF export), payment tracking, expense tracking,
and a reports dashboard.

## Stack
- **Backend:** Node.js + Express + SQLite (via `better-sqlite3`), JWT auth, PDF generation with `pdfkit`
- **Frontend:** Plain HTML/CSS/JavaScript (no build step needed) — served as static files by the backend, or hosted separately

## Features
- Email/password accounts (JWT auth), per-account business profile (name, logo, currency, address)
- Client management (CRUD)
- Invoices & Estimates with line items, tax rate, flat discount, auto-numbering (`INV-0001`, `EST-0001`), status tracking
- Downloadable PDF for any invoice/estimate
- Payment recording against invoices, automatic status updates (draft → sent → paid) and balance-due tracking
- Expense tracking (category, vendor, amount, date)
- Dashboard: total invoiced, paid, outstanding, expenses, net profit, overdue count, recent invoices
- Reports: 6-month revenue vs. expenses chart, invoice status breakdown

## Project Structure
```
invoiceapp/
  backend/     Express API + SQLite database
  frontend/    Static HTML/CSS/JS client
```

## Local Setup

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env      # edit JWT_SECRET at minimum
npm start                 # runs on http://localhost:4000
```
The SQLite database file is created automatically at `backend/data/app.db`.

### 2. Frontend
The backend automatically serves the `frontend/` folder as static files and
handles client-side routing — so once the backend is running, just open:
```
http://localhost:4000
```
No separate frontend server or build step is required.

(If you prefer to host the frontend separately — e.g. on Netlify/Vercel —
edit `frontend/js/config.js` and set `API_BASE_URL` to your deployed
backend's URL, then deploy the `frontend/` folder as a static site.)

## Deploying to Production

**Simplest option — one service (Render, Railway, Fly.io, a VPS, etc.):**
1. Push this whole project to a Git repo.
2. Create a new Web Service pointing at the `backend/` folder.
3. Build command: `npm install`. Start command: `npm start`.
4. Set environment variables from `.env.example` (especially `JWT_SECRET` —
   generate a long random string, and `CORS_ORIGIN` to your app's URL).
5. Attach a persistent disk/volume mounted at `backend/data` so the SQLite
   file survives restarts and deploys (Render/Railway both support this —
   look for "persistent disk" or "volume" in the service settings).
6. Done — the same service serves both the API and the web app.

**Two-service option (separate frontend hosting):**
- Deploy `backend/` to Render/Railway/Fly as above.
- Deploy `frontend/` as a static site (Netlify, Vercel, Cloudflare Pages, S3).
- Set `frontend/js/config.js` → `API_BASE_URL` to the backend's public URL.
- Set the backend's `CORS_ORIGIN` env var to the frontend's public URL.

**Scaling beyond SQLite:** SQLite is great for a single small-to-medium
business and needs zero setup. If you outgrow it (many concurrent users,
multi-region), swap `better-sqlite3` for `pg` (PostgreSQL) — the SQL in
`db.js` and the route files is plain, portable SQL and translates directly.

## API Overview
All endpoints under `/api`, JSON in/out. Authenticated routes require
`Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| POST | /auth/register | Create account, returns token |
| POST | /auth/login | Log in, returns token |
| GET/PUT | /auth/me | Get/update business profile |
| GET/POST | /clients | List / create clients |
| GET/PUT/DELETE | /clients/:id | Read / update / delete a client |
| GET/POST | /invoices?type=invoice\|estimate | List / create invoices or estimates |
| GET/PUT/DELETE | /invoices/:id | Read / update / delete |
| POST | /invoices/:id/payments | Record a payment |
| GET | /invoices/:id/pdf | Download PDF |
| GET/POST | /expenses | List / create expenses |
| PUT/DELETE | /expenses/:id | Update / delete an expense |
| GET | /reports/dashboard | Summary stats |
| GET | /reports/monthly | 6-month revenue vs. expenses |

## Notes on this build
This was built as an original app with the same category of features as
typical invoicing/billing apps (invoices, estimates, clients, payments,
PDF export) — it does not reuse any other product's branding, code, or
design assets. Feel free to reskin the CSS in `frontend/css/style.css`
and rename it for your client.
