/**
 * HansMed API Client
 * ------------------
 * Central fetch wrapper with auth token management.
 * All backend calls go through here so the HTML/CSS layer stays clean.
 *
 * Usage:
 *   import { api, setToken, getToken, clearToken } from './api.js';
 *   const res = await api.post('/auth/login', { email, password });
 */

const API_BASE = window.HANSMED_API_BASE || '/api';

// ── Token management ──────────────────────────────────────────────

function getToken()  { return localStorage.getItem('hansmed_token'); }
function setToken(t) { localStorage.setItem('hansmed_token', t); }
function clearToken(){ localStorage.removeItem('hansmed_token'); }

function getUser()   { try { return JSON.parse(localStorage.getItem('hansmed_user')); } catch { return null; } }
function setUser(u)  { localStorage.setItem('hansmed_user', JSON.stringify(u)); }
function clearUser() { localStorage.removeItem('hansmed_user'); }

// ── Core fetch wrapper ────────────────────────────────────────────

async function request(method, path, body, opts = {}) {
  const headers = { 'Accept': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const init = { method, headers };

  if (body instanceof FormData) {
    init.body = body; // browser sets multipart boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(API_BASE + path, init);

  // Auto-logout on 401
  if (res.status === 401 && !path.includes('/auth/login')) {
    clearToken();
    clearUser();
    window.dispatchEvent(new CustomEvent('hansmed:logout'));
  }

  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else if (contentType.includes('text/csv')) {
    data = await res.blob();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const err = new Error(data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const api = {
  get:    (path)       => request('GET', path),
  post:   (path, body) => request('POST', path, body),
  put:    (path, body) => request('PUT', path, body),
  patch:  (path, body) => request('PATCH', path, body),
  delete: (path)       => request('DELETE', path),
};

// ── Auth ──────────────────────────────────────────────────────────

async function authRegister({ email, password, role, nickname, full_name, name }) {
  const res = await api.post('/auth/register', { email, password, role, nickname, full_name, name });
  setToken(res.token);
  setUser(res.user);
  return res;
}

async function authLogin(email, password) {
  const res = await api.post('/auth/login', { email, password });
  setToken(res.token);
  setUser(res.user);
  return res;
}

async function authLogout() {
  try { await api.post('/auth/logout'); } catch {}
  clearToken();
  clearUser();
}

async function authMe() {
  const res = await api.get('/auth/me');
  setUser(res.user);
  return res.user;
}

// ── Patient: Profile ──────────────────────────────────────────────

const patientApi = {
  getProfile:    ()     => api.get('/patient/profile'),
  updateProfile: (data) => api.put('/patient/profile', data),

  // Addresses
  getAddresses:    ()         => api.get('/patient/addresses'),
  createAddress:   (data)     => api.post('/patient/addresses', data),
  updateAddress:   (id, data) => api.put('/patient/addresses/' + id, data),
  deleteAddress:   (id)       => api.delete('/patient/addresses/' + id),

  // Tongue diagnosis
  listDiagnoses: (page = 1) => api.get('/patient/tongue-diagnoses?page=' + page),
  getDiagnosis:  (id)       => api.get('/patient/tongue-diagnoses/' + id),
  deleteDiagnosis: (id)     => api.delete('/patient/tongue-diagnoses/' + id),
  uploadTongue: (imageFile) => {
    const fd = new FormData();
    fd.append('image', imageFile);
    return api.post('/patient/tongue-diagnoses', fd);
  },

  // Doctors & pharmacies
  listDoctors:    (params = '') => api.get('/patient/doctors' + (params ? '?' + params : '')),
  getDoctor:      (id)         => api.get('/patient/doctors/' + id),
  listPharmacies: (params = '') => api.get('/patient/pharmacies' + (params ? '?' + params : '')),

  // Appointments
  listAppointments: (page = 1)  => api.get('/patient/appointments?page=' + page),
  bookAppointment:  (data)      => api.post('/patient/appointments', data),
  cancelAppointment:(id)        => api.post('/patient/appointments/' + id + '/cancel'),

  // Prescriptions & orders
  listPrescriptions: (page = 1) => api.get('/patient/prescriptions?page=' + page),
  listOrders:    (params = '')  => api.get('/patient/orders' + (params ? '?' + params : '')),
  getOrder:      (id)           => api.get('/patient/orders/' + id),
  createOrder:   (data)         => api.post('/patient/orders', data),
};

// ── Doctor ────────────────────────────────────────────────────────

const doctorApi = {
  listAppointments: (params = '') => api.get('/doctor/appointments' + (params ? '?' + params : '')),
  getAppointment:   (id)         => api.get('/doctor/appointments/' + id),
  startAppointment: (id)         => api.post('/doctor/appointments/' + id + '/start'),
  completeAppointment: (id)      => api.post('/doctor/appointments/' + id + '/complete'),

  listPrescriptions: (page = 1)  => api.get('/doctor/prescriptions?page=' + page),
  issuePrescription: (data)      => api.post('/doctor/prescriptions', data),
  getPrescription:   (id)        => api.get('/doctor/prescriptions/' + id),
  revokePrescription:(id)        => api.post('/doctor/prescriptions/' + id + '/revoke'),
  revisePrescription:(id, data)  => api.post('/doctor/prescriptions/' + id + '/revise', data),

  getEarnings:   () => api.get('/doctor/earnings/summary'),
  getHistory:    (page = 1) => api.get('/doctor/earnings/history?page=' + page),
  listWithdrawals: (page = 1) => api.get('/doctor/withdrawals?page=' + page),
  requestWithdrawal: (data) => api.post('/doctor/withdrawals', data),
};

// ── Pharmacy ──────────────────────────────────────────────────────

const pharmacyApi = {
  listProducts:  (page = 1)    => api.get('/pharmacy/products?page=' + page),
  createProduct: (data)        => api.post('/pharmacy/products', data),
  updateProduct: (id, data)    => api.put('/pharmacy/products/' + id, data),
  adjustStock:   (id, data)    => api.post('/pharmacy/products/' + id + '/stock', data),

  listOrders:    (params = '') => api.get('/pharmacy/orders' + (params ? '?' + params : '')),
  getOrder:      (id)          => api.get('/pharmacy/orders/' + id),
  startDispense: (id)          => api.post('/pharmacy/orders/' + id + '/dispense/start'),
  finishDispense:(id)          => api.post('/pharmacy/orders/' + id + '/dispense/finish'),
  shipOrder:     (id, data)    => api.post('/pharmacy/orders/' + id + '/ship', data),

  getSummary:    (period = 'month') => api.get('/pharmacy/reconciliation/summary?period=' + period),
  getDailyBreakdown: () => api.get('/pharmacy/reconciliation/daily'),
};

// ── Consultation (video) ──────────────────────────────────────────

const consultationApi = {
  joinToken: (appointmentId) => api.get('/consultations/' + appointmentId + '/join'),
  finish:    (appointmentId, data) => api.post('/consultations/' + appointmentId + '/finish', data),
};

// ── Payments ──────────────────────────────────────────────────────

const paymentApi = {
  createPayPal: (data) => api.post('/payments/paypal/create', data),
  capturePayPal:(data) => api.post('/payments/paypal/capture', data),
};

// ── Notifications ─────────────────────────────────────────────────

const notificationApi = {
  list:        (unreadOnly = false) => api.get('/notifications' + (unreadOnly ? '?unread_only=1' : '')),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead:    (id) => api.post('/notifications/' + id + '/read'),
  markAllRead: () => api.post('/notifications/read-all'),
};

// ── Admin ─────────────────────────────────────────────────────────

const adminApi = {
  // Doctor management (full CRUD)
  listDoctors:        (params = '') => api.get('/admin/doctors' + (params ? '?' + params : '')),
  createDoctor:       (data) => api.post('/admin/doctors', data),
  updateDoctor:       (id, data) => api.put('/admin/doctors/' + id, data),
  toggleDoctor:       (id) => api.post('/admin/doctors/' + id + '/toggle'),
  pendingDoctors:     () => api.get('/admin/doctors/pending'),
  reviewDoctor:       (id, data) => api.post('/admin/doctors/' + id + '/review', data),
  pendingPharmacies:  () => api.get('/admin/pharmacies/pending'),
  reviewPharmacy:     (id, data) => api.post('/admin/pharmacies/' + id + '/review', data),

  // Finance
  financeOverview:    () => api.get('/admin/finance/overview'),
  pendingWithdrawals: () => api.get('/admin/finance/withdrawals/pending'),
  reviewWithdrawal:   (id, data) => api.post('/admin/finance/withdrawals/' + id + '/review', data),
  listOrders:         (params = '') => api.get('/admin/finance/orders' + (params ? '?' + params : '')),

  // Prescriptions
  listPrescriptions:  (params = '') => api.get('/admin/prescriptions' + (params ? '?' + params : '')),
  getPrescription:    (id) => api.get('/admin/prescriptions/' + id),
  revokePrescription: (id, data) => api.post('/admin/prescriptions/' + id + '/revoke', data),

  // System config
  getConfigs:  () => api.get('/admin/configs'),
  setConfigs:  (data) => api.post('/admin/configs', { configs: data }),

  // Reports
  dashboard:   () => api.get('/admin/reports/dashboard'),
  exportCsv:   (entity) => api.get('/admin/reports/export/' + entity),
};

// ── Tongue knowledge (public) ─────────────────────────────────────

const tongueApi = {
  knowledgeBase: () => api.get('/tongue-knowledge'),
};

// ── Event helpers ─────────────────────────────────────────────────

/** Poll notification count every 60s while logged in */
let _notifInterval = null;
function startNotifPolling(callback) {
  stopNotifPolling();
  if (!getToken()) return;
  const poll = async () => {
    try {
      const res = await notificationApi.unreadCount();
      callback(res.count);
    } catch {}
  };
  poll();
  _notifInterval = setInterval(poll, 60000);
}
function stopNotifPolling() {
  if (_notifInterval) { clearInterval(_notifInterval); _notifInterval = null; }
}

// ── Export ─────────────────────────────────────────────────────────

window.HansMedAPI = {
  api, getToken, setToken, clearToken, getUser, setUser, clearUser,
  authRegister, authLogin, authLogout, authMe,
  patient: patientApi,
  doctor: doctorApi,
  pharmacy: pharmacyApi,
  consultation: consultationApi,
  payment: paymentApi,
  notification: notificationApi,
  admin: adminApi,
  tongue: tongueApi,
  startNotifPolling, stopNotifPolling,
};
