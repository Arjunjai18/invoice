const Api = (() => {
  function getToken() { return localStorage.getItem('token'); }
  function setToken(t) { localStorage.setItem('token', t); }
  function clearToken() { localStorage.removeItem('token'); }

  async function request(path, { method = 'GET', body, isBlob = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      clearToken();
      location.hash = '#/login';
      throw new Error('Session expired. Please log in again.');
    }

    if (isBlob) {
      if (!res.ok) throw new Error('Request failed');
      return res.blob();
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  return {
    getToken, setToken, clearToken,
    register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
    login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
    me: () => request('/auth/me'),
    updateMe: (payload) => request('/auth/me', { method: 'PUT', body: payload }),

    listClients: () => request('/clients'),
    getClient: (id) => request(`/clients/${id}`),
    createClient: (payload) => request('/clients', { method: 'POST', body: payload }),
    updateClient: (id, payload) => request(`/clients/${id}`, { method: 'PUT', body: payload }),
    deleteClient: (id) => request(`/clients/${id}`, { method: 'DELETE' }),

    listInvoices: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/invoices${qs ? '?' + qs : ''}`);
    },
    getInvoice: (id) => request(`/invoices/${id}`),
    createInvoice: (payload) => request('/invoices', { method: 'POST', body: payload }),
    updateInvoice: (id, payload) => request(`/invoices/${id}`, { method: 'PUT', body: payload }),
    deleteInvoice: (id) => request(`/invoices/${id}`, { method: 'DELETE' }),
    recordPayment: (id, payload) => request(`/invoices/${id}/payments`, { method: 'POST', body: payload }),
    downloadPdf: (id) => request(`/invoices/${id}/pdf`, { isBlob: true }),

    listExpenses: () => request('/expenses'),
    createExpense: (payload) => request('/expenses', { method: 'POST', body: payload }),
    updateExpense: (id, payload) => request(`/expenses/${id}`, { method: 'PUT', body: payload }),
    deleteExpense: (id) => request(`/expenses/${id}`, { method: 'DELETE' }),

    dashboard: () => request('/reports/dashboard'),
    monthly: () => request('/reports/monthly'),
  };
})();
