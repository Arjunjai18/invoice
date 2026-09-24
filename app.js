const state = { user: null, clients: [] };
const app = document.getElementById('app');
const fmt = (n) => `${state.user?.currency || 'USD'} ${Number(n || 0).toFixed(2)}`;
const esc = (s) => (s ?? '').toString().replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toast(msg, isError = false) {
  const t = document.createElement('div');
  t.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ---------- Layout ----------
function shell(activeRoute, content) {
  const nav = [
    ['#/dashboard', 'Dashboard'],
    ['#/clients', 'Clients'],
    ['#/invoices', 'Invoices'],
    ['#/estimates', 'Estimates'],
    ['#/expenses', 'Expenses'],
    ['#/reports', 'Reports'],
    ['#/settings', 'Settings'],
  ];
  app.innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">InvoiceFlow</div>
        <nav>
          ${nav.map(([href, label]) => `<a href="${href}" class="${activeRoute === href ? 'active' : ''}">${label}</a>`).join('')}
        </nav>
        <button id="logoutBtn" class="link-btn">Log out</button>
      </aside>
      <main class="content">${content}</main>
    </div>`;
  document.getElementById('logoutBtn').onclick = () => {
    Api.clearToken();
    location.hash = '#/login';
  };
}

// ---------- Auth Pages ----------
function renderLogin() {
  app.innerHTML = `
    <div class="auth-wrap">
      <form id="loginForm" class="auth-card">
        <h1>InvoiceFlow</h1>
        <p class="muted">Log in to your account</p>
        <label>Email</label>
        <input type="email" name="email" required />
        <label>Password</label>
        <input type="password" name="password" required />
        <button type="submit">Log In</button>
        <p class="muted">No account? <a href="#/register">Sign up</a></p>
      </form>
    </div>`;
  document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const { token, user } = await Api.login({ email: fd.get('email'), password: fd.get('password') });
      Api.setToken(token);
      state.user = user;
      location.hash = '#/dashboard';
    } catch (err) { toast(err.message, true); }
  };
}

function renderRegister() {
  app.innerHTML = `
    <div class="auth-wrap">
      <form id="regForm" class="auth-card">
        <h1>Create your account</h1>
        <label>Business Name</label>
        <input type="text" name="business_name" required />
        <label>Email</label>
        <input type="email" name="email" required />
        <label>Password</label>
        <input type="password" name="password" required minlength="6" />
        <label>Currency</label>
        <select name="currency">
          <option>USD</option><option>EUR</option><option>GBP</option><option>INR</option><option>AUD</option><option>CAD</option>
        </select>
        <button type="submit">Sign Up</button>
        <p class="muted">Already have an account? <a href="#/login">Log in</a></p>
      </form>
    </div>`;
  document.getElementById('regForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const { token, user } = await Api.register(Object.fromEntries(fd));
      Api.setToken(token);
      state.user = user;
      location.hash = '#/dashboard';
    } catch (err) { toast(err.message, true); }
  };
}

// ---------- Dashboard ----------
async function renderDashboard() {
  shell('#/dashboard', `<div class="loading">Loading dashboard…</div>`);
  try {
    const d = await Api.dashboard();
    const cards = [
      ['Total Invoiced', fmt(d.totalInvoiced)],
      ['Total Paid', fmt(d.totalPaid)],
      ['Outstanding', fmt(d.totalOutstanding)],
      ['Total Expenses', fmt(d.totalExpenses)],
      ['Net Profit', fmt(d.netProfit)],
      ['Overdue Invoices', d.overdueCount],
    ];
    const html = `
      <h1>Dashboard</h1>
      <div class="stat-grid">
        ${cards.map(([label, val]) => `<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value">${val}</div></div>`).join('')}
      </div>
      <h2>Recent Invoices</h2>
      <table class="table">
        <thead><tr><th>Number</th><th>Client</th><th>Status</th><th>Total</th><th>Due</th></tr></thead>
        <tbody>
          ${d.recentInvoices.length ? d.recentInvoices.map(inv => `
            <tr onclick="location.hash='#/invoices/${inv.id}'" class="clickable">
              <td>${esc(inv.invoice_number)}</td>
              <td>${esc(inv.client_name)}</td>
              <td><span class="badge badge-${inv.status}">${inv.status}</span></td>
              <td>${fmt(inv.total)}</td>
              <td>${inv.due_date || '-'}</td>
            </tr>`).join('') : `<tr><td colspan="5" class="muted">No invoices yet</td></tr>`}
        </tbody>
      </table>`;
    shell('#/dashboard', html);
  } catch (err) { shell('#/dashboard', `<p class="error">${esc(err.message)}</p>`); }
}

// ---------- Clients ----------
async function renderClients() {
  shell('#/clients', `<div class="loading">Loading…</div>`);
  const { clients } = await Api.listClients();
  state.clients = clients;
  const html = `
    <div class="page-header"><h1>Clients</h1><button id="newClientBtn">+ New Client</button></div>
    <table class="table">
      <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th></th></tr></thead>
      <tbody>
        ${clients.length ? clients.map(c => `
          <tr>
            <td>${esc(c.name)}</td><td>${esc(c.email)}</td><td>${esc(c.phone)}</td>
            <td class="row-actions">
              <button data-edit="${c.id}">Edit</button>
              <button data-del="${c.id}" class="danger">Delete</button>
            </td>
          </tr>`).join('') : `<tr><td colspan="4" class="muted">No clients yet</td></tr>`}
      </tbody>
    </table>
    <div id="modalRoot"></div>`;
  shell('#/clients', html);

  document.getElementById('newClientBtn').onclick = () => openClientModal();
  document.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => openClientModal(clients.find(c => c.id === btn.dataset.edit)));
  document.querySelectorAll('[data-del]').forEach(btn => btn.onclick = async () => {
    if (!confirm('Delete this client?')) return;
    try { await Api.deleteClient(btn.dataset.del); toast('Client deleted'); renderClients(); }
    catch (err) { toast(err.message, true); }
  });
}

function openClientModal(client = null) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-backdrop">
      <form class="modal" id="clientForm">
        <h2>${client ? 'Edit' : 'New'} Client</h2>
        <label>Name</label><input name="name" required value="${esc(client?.name)}" />
        <label>Email</label><input name="email" type="email" value="${esc(client?.email)}" />
        <label>Phone</label><input name="phone" value="${esc(client?.phone)}" />
        <label>Address</label><textarea name="address">${esc(client?.address)}</textarea>
        <label>Notes</label><textarea name="notes">${esc(client?.notes)}</textarea>
        <div class="modal-actions">
          <button type="button" id="cancelBtn" class="secondary">Cancel</button>
          <button type="submit">Save</button>
        </div>
      </form>
    </div>`;
  document.getElementById('cancelBtn').onclick = () => root.innerHTML = '';
  document.getElementById('clientForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target));
    try {
      if (client) await Api.updateClient(client.id, payload);
      else await Api.createClient(payload);
      toast('Client saved');
      renderClients();
    } catch (err) { toast(err.message, true); }
  };
}

// ---------- Invoices / Estimates ----------
async function renderInvoiceList(type) {
  const route = type === 'estimate' ? '#/estimates' : '#/invoices';
  shell(route, `<div class="loading">Loading…</div>`);
  const { invoices } = await Api.listInvoices({ type });
  const clientsMap = {};
  (await Api.listClients()).clients.forEach(c => clientsMap[c.id] = c.name);
  const label = type === 'estimate' ? 'Estimate' : 'Invoice';
  const html = `
    <div class="page-header"><h1>${label}s</h1><button id="newBtn">+ New ${label}</button></div>
    <table class="table">
      <thead><tr><th>Number</th><th>Client</th><th>Issue Date</th><th>Status</th><th>Total</th><th></th></tr></thead>
      <tbody>
        ${invoices.length ? invoices.map(i => `
          <tr class="clickable" onclick="location.hash='#/invoices/${i.id}'">
            <td>${esc(i.invoice_number)}</td>
            <td>${esc(clientsMap[i.client_id] || '')}</td>
            <td>${i.issue_date}</td>
            <td><span class="badge badge-${i.status}">${i.status}</span></td>
            <td>${fmt(i.total)}</td>
            <td></td>
          </tr>`).join('') : `<tr><td colspan="6" class="muted">No ${label.toLowerCase()}s yet</td></tr>`}
      </tbody>
    </table>`;
  shell(route, html);
  document.getElementById('newBtn').onclick = () => location.hash = `#/invoices/new?type=${type}`;
}

async function renderInvoiceForm(type) {
  const route = '#/invoices/new';
  shell(route, `<div class="loading">Loading…</div>`);
  const { clients } = await Api.listClients();
  if (!clients.length) {
    shell(route, `<h1>New ${type === 'estimate' ? 'Estimate' : 'Invoice'}</h1><p>You need at least one client first. <a href="#/clients">Add a client</a>.</p>`);
    return;
  }
  let itemRows = 1;
  const label = type === 'estimate' ? 'Estimate' : 'Invoice';
  const html = `
    <h1>New ${label}</h1>
    <form id="invForm" class="form-card">
      <div class="grid-2">
        <div><label>Client</label>
          <select name="client_id" required>${clients.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
        </div>
        <div><label>Issue Date</label><input type="date" name="issue_date" required value="${new Date().toISOString().slice(0,10)}" /></div>
        <div><label>Due Date</label><input type="date" name="due_date" /></div>
        <div><label>Tax Rate (%)</label><input type="number" name="tax_rate" value="0" step="0.01" /></div>
        <div><label>Discount (flat)</label><input type="number" name="discount" value="0" step="0.01" /></div>
      </div>
      <h3>Line Items</h3>
      <div id="itemsWrap"></div>
      <button type="button" id="addItemBtn" class="secondary">+ Add Line Item</button>
      <label>Notes</label><textarea name="notes"></textarea>
      <div class="totals" id="totalsBox"></div>
      <div class="modal-actions">
        <button type="button" class="secondary" onclick="history.back()">Cancel</button>
        <button type="submit">Save ${label}</button>
      </div>
    </form>`;
  shell(route, html);

  const itemsWrap = document.getElementById('itemsWrap');
  function addItemRow() {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <input type="text" placeholder="Description" class="it-desc" required />
      <input type="number" placeholder="Qty" class="it-qty" value="1" min="0" step="0.01" />
      <input type="number" placeholder="Unit Price" class="it-price" value="0" min="0" step="0.01" />
      <span class="it-amount">${fmt(0)}</span>
      <button type="button" class="danger small remove-item">✕</button>`;
    itemsWrap.appendChild(row);
    row.querySelector('.remove-item').onclick = () => { row.remove(); recalc(); };
    row.querySelectorAll('input').forEach(inp => inp.oninput = recalc);
  }
  function recalc() {
    let subtotal = 0;
    itemsWrap.querySelectorAll('.item-row').forEach(row => {
      const qty = parseFloat(row.querySelector('.it-qty').value) || 0;
      const price = parseFloat(row.querySelector('.it-price').value) || 0;
      const amt = qty * price;
      row.querySelector('.it-amount').textContent = fmt(amt);
      subtotal += amt;
    });
    const taxRate = parseFloat(document.querySelector('[name="tax_rate"]').value) || 0;
    const discount = parseFloat(document.querySelector('[name="discount"]').value) || 0;
    const afterDiscount = Math.max(subtotal - discount, 0);
    const tax = afterDiscount * (taxRate / 100);
    const total = afterDiscount + tax;
    document.getElementById('totalsBox').innerHTML = `
      <div>Subtotal: ${fmt(subtotal)}</div>
      <div>Discount: ${fmt(discount)}</div>
      <div>Tax: ${fmt(tax)}</div>
      <div class="total-line">Total: ${fmt(total)}</div>`;
  }
  document.getElementById('addItemBtn').onclick = addItemRow;
  document.querySelector('[name="tax_rate"]').oninput = recalc;
  document.querySelector('[name="discount"]').oninput = recalc;
  for (let i = 0; i < itemRows; i++) addItemRow();
  recalc();

  document.getElementById('invForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const items = [...itemsWrap.querySelectorAll('.item-row')].map(row => ({
      description: row.querySelector('.it-desc').value,
      quantity: parseFloat(row.querySelector('.it-qty').value) || 0,
      unit_price: parseFloat(row.querySelector('.it-price').value) || 0,
    })).filter(it => it.description);
    if (!items.length) return toast('Add at least one line item', true);
    const payload = {
      client_id: fd.get('client_id'), type,
      issue_date: fd.get('issue_date'), due_date: fd.get('due_date') || null,
      tax_rate: parseFloat(fd.get('tax_rate')) || 0, discount: parseFloat(fd.get('discount')) || 0,
      notes: fd.get('notes'), items,
    };
    try {
      const { invoice } = await Api.createInvoice(payload);
      toast(`${label} created`);
      location.hash = `#/invoices/${invoice.id}`;
    } catch (err) { toast(err.message, true); }
  };
}

async function renderInvoiceDetail(id) {
  shell('#/invoices', `<div class="loading">Loading…</div>`);
  const { invoice, items, payments } = await Api.getInvoice(id);
  const client = state.clients.find(c => c.id === invoice.client_id) || (await Api.getClient(invoice.client_id)).client;
  const label = invoice.type === 'estimate' ? 'Estimate' : 'Invoice';
  const balance = invoice.total - invoice.amount_paid;
  const html = `
    <div class="page-header">
      <h1>${label} ${esc(invoice.invoice_number)} <span class="badge badge-${invoice.status}">${invoice.status}</span></h1>
      <div>
        <button id="pdfBtn" class="secondary">Download PDF</button>
        ${invoice.type === 'invoice' && balance > 0 ? `<button id="payBtn">Record Payment</button>` : ''}
      </div>
    </div>
    <div class="detail-grid">
      <div>
        <h3>Bill To</h3>
        <p>${esc(client.name)}<br/>${esc(client.email || '')}<br/>${esc(client.address || '')}</p>
      </div>
      <div>
        <p><strong>Issue Date:</strong> ${invoice.issue_date}</p>
        <p><strong>Due Date:</strong> ${invoice.due_date || '-'}</p>
      </div>
    </div>
    <table class="table">
      <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead>
      <tbody>${items.map(it => `<tr><td>${esc(it.description)}</td><td>${it.quantity}</td><td>${fmt(it.unit_price)}</td><td>${fmt(it.amount)}</td></tr>`).join('')}</tbody>
    </table>
    <div class="totals">
      <div>Subtotal: ${fmt(invoice.subtotal)}</div>
      <div>Discount: ${fmt(invoice.discount)}</div>
      <div>Tax: ${fmt(invoice.tax_amount)}</div>
      <div class="total-line">Total: ${fmt(invoice.total)}</div>
      ${invoice.type === 'invoice' ? `<div>Paid: ${fmt(invoice.amount_paid)}</div><div class="total-line">Balance Due: ${fmt(balance)}</div>` : ''}
    </div>
    ${invoice.notes ? `<h3>Notes</h3><p>${esc(invoice.notes)}</p>` : ''}
    ${payments.length ? `<h3>Payment History</h3><table class="table"><thead><tr><th>Date</th><th>Amount</th><th>Method</th></tr></thead><tbody>${payments.map(p => `<tr><td>${p.paid_date}</td><td>${fmt(p.amount)}</td><td>${esc(p.method)}</td></tr>`).join('')}</tbody></table>` : ''}
    <div id="modalRoot"></div>`;
  shell(invoice.type === 'estimate' ? '#/estimates' : '#/invoices', html);

  document.getElementById('pdfBtn').onclick = async () => {
    try {
      const blob = await Api.downloadPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${invoice.type}-${invoice.invoice_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast(err.message, true); }
  };
  const payBtn = document.getElementById('payBtn');
  if (payBtn) payBtn.onclick = () => {
    const root = document.getElementById('modalRoot');
    root.innerHTML = `
      <div class="modal-backdrop">
        <form class="modal" id="payForm">
          <h2>Record Payment</h2>
          <label>Amount</label><input type="number" name="amount" step="0.01" max="${balance}" value="${balance}" required />
          <label>Date</label><input type="date" name="paid_date" required value="${new Date().toISOString().slice(0,10)}" />
          <label>Method</label>
          <select name="method"><option>bank_transfer</option><option>card</option><option>cash</option><option>upi</option><option>other</option></select>
          <label>Notes</label><textarea name="notes"></textarea>
          <div class="modal-actions">
            <button type="button" class="secondary" id="cancelPay">Cancel</button>
            <button type="submit">Save</button>
          </div>
        </form></div>`;
    document.getElementById('cancelPay').onclick = () => root.innerHTML = '';
    document.getElementById('payForm').onsubmit = async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(e.target));
      try { await Api.recordPayment(id, payload); toast('Payment recorded'); renderInvoiceDetail(id); }
      catch (err) { toast(err.message, true); }
    };
  };
}

// ---------- Expenses ----------
async function renderExpenses() {
  shell('#/expenses', `<div class="loading">Loading…</div>`);
  const { expenses } = await Api.listExpenses();
  const html = `
    <div class="page-header"><h1>Expenses</h1><button id="newExpenseBtn">+ New Expense</button></div>
    <table class="table">
      <thead><tr><th>Date</th><th>Vendor</th><th>Category</th><th>Description</th><th>Amount</th><th></th></tr></thead>
      <tbody>
        ${expenses.length ? expenses.map(e => `
          <tr>
            <td>${e.expense_date}</td><td>${esc(e.vendor)}</td><td>${esc(e.category)}</td>
            <td>${esc(e.description)}</td><td>${fmt(e.amount)}</td>
            <td class="row-actions"><button data-del="${e.id}" class="danger">Delete</button></td>
          </tr>`).join('') : `<tr><td colspan="6" class="muted">No expenses yet</td></tr>`}
      </tbody>
    </table>
    <div id="modalRoot"></div>`;
  shell('#/expenses', html);
  document.getElementById('newExpenseBtn').onclick = () => {
    const root = document.getElementById('modalRoot');
    root.innerHTML = `
      <div class="modal-backdrop">
        <form class="modal" id="expForm">
          <h2>New Expense</h2>
          <label>Date</label><input type="date" name="expense_date" required value="${new Date().toISOString().slice(0,10)}" />
          <label>Vendor</label><input name="vendor" />
          <label>Category</label><input name="category" placeholder="e.g. Software, Travel" />
          <label>Description</label><textarea name="description"></textarea>
          <label>Amount</label><input type="number" name="amount" step="0.01" required />
          <div class="modal-actions">
            <button type="button" class="secondary" id="cancelExp">Cancel</button>
            <button type="submit">Save</button>
          </div>
        </form></div>`;
    document.getElementById('cancelExp').onclick = () => root.innerHTML = '';
    document.getElementById('expForm').onsubmit = async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(e.target));
      try { await Api.createExpense(payload); toast('Expense added'); renderExpenses(); }
      catch (err) { toast(err.message, true); }
    };
  };
  document.querySelectorAll('[data-del]').forEach(btn => btn.onclick = async () => {
    if (!confirm('Delete this expense?')) return;
    try { await Api.deleteExpense(btn.dataset.del); toast('Deleted'); renderExpenses(); }
    catch (err) { toast(err.message, true); }
  });
}

// ---------- Reports ----------
async function renderReports() {
  shell('#/reports', `<div class="loading">Loading…</div>`);
  const [dash, monthly] = await Promise.all([Api.dashboard(), Api.monthly()]);
  const months = [...new Set([...monthly.revenue.map(r => r.month), ...monthly.expenses.map(e => e.month)])].sort();
  const revMap = Object.fromEntries(monthly.revenue.map(r => [r.month, r.total]));
  const expMap = Object.fromEntries(monthly.expenses.map(e => [e.month, e.total]));
  const maxVal = Math.max(1, ...months.map(m => Math.max(revMap[m] || 0, expMap[m] || 0)));
  const html = `
    <h1>Reports</h1>
    <h2>Revenue vs Expenses (last 6 months)</h2>
    <div class="chart">
      ${months.length ? months.map(m => `
        <div class="chart-col">
          <div class="bars">
            <div class="bar bar-rev" style="height:${((revMap[m]||0)/maxVal*140).toFixed(0)}px" title="Revenue: ${fmt(revMap[m]||0)}"></div>
            <div class="bar bar-exp" style="height:${((expMap[m]||0)/maxVal*140).toFixed(0)}px" title="Expenses: ${fmt(expMap[m]||0)}"></div>
          </div>
          <div class="chart-label">${m}</div>
        </div>`).join('') : `<p class="muted">Not enough data yet</p>`}
    </div>
    <div class="legend"><span class="dot bar-rev"></span> Revenue &nbsp; <span class="dot bar-exp"></span> Expenses</div>

    <h2>Invoice Status Breakdown</h2>
    <table class="table">
      <thead><tr><th>Status</th><th>Count</th><th>Total</th></tr></thead>
      <tbody>${dash.statusBreakdown.length ? dash.statusBreakdown.map(s => `<tr><td>${s.status}</td><td>${s.count}</td><td>${fmt(s.total)}</td></tr>`).join('') : `<tr><td colspan="3" class="muted">No data</td></tr>`}</tbody>
    </table>`;
  shell('#/reports', html);
}

// ---------- Settings ----------
async function renderSettings() {
  shell('#/settings', `<div class="loading">Loading…</div>`);
  const { user } = await Api.me();
  state.user = user;
  const html = `
    <h1>Business Settings</h1>
    <form id="settingsForm" class="form-card">
      <label>Business Name</label><input name="business_name" value="${esc(user.business_name)}" required />
      <label>Currency</label>
      <select name="currency">
        ${['USD','EUR','GBP','INR','AUD','CAD'].map(c => `<option ${user.currency===c?'selected':''}>${c}</option>`).join('')}
      </select>
      <label>Address</label><textarea name="address">${esc(user.address)}</textarea>
      <label>Phone</label><input name="phone" value="${esc(user.phone)}" />
      <div class="modal-actions"><button type="submit">Save Changes</button></div>
    </form>`;
  shell('#/settings', html);
  document.getElementById('settingsForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target));
    try { const { user } = await Api.updateMe(payload); state.user = user; toast('Settings saved'); }
    catch (err) { toast(err.message, true); }
  };
}

// ---------- Router ----------
async function router() {
  const hash = location.hash || '#/dashboard';
  const [path, query] = hash.split('?');
  const params = new URLSearchParams(query || '');

  const isAuthPage = path === '#/login' || path === '#/register';
  if (!Api.getToken() && !isAuthPage) { location.hash = '#/login'; return; }
  if (Api.getToken() && isAuthPage) { location.hash = '#/dashboard'; return; }

  if (Api.getToken() && !state.user) {
    try { state.user = (await Api.me()).user; } catch (e) { /* handled by 401 in Api */ }
  }

  if (path === '#/login') return renderLogin();
  if (path === '#/register') return renderRegister();
  if (path === '#/dashboard') return renderDashboard();
  if (path === '#/clients') return renderClients();
  if (path === '#/invoices') return renderInvoiceList('invoice');
  if (path === '#/estimates') return renderInvoiceList('estimate');
  if (path === '#/invoices/new') return renderInvoiceForm(params.get('type') === 'estimate' ? 'estimate' : 'invoice');
  if (path.startsWith('#/invoices/')) return renderInvoiceDetail(path.split('/')[2]);
  if (path === '#/expenses') return renderExpenses();
  if (path === '#/reports') return renderReports();
  if (path === '#/settings') return renderSettings();

  location.hash = '#/dashboard';
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
