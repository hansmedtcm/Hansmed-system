/**
 * HansMed API Client
 * Central fetch wrapper with auth token management.
 * All backend calls go through here.
 */
(function () {
  'use strict';

  window.HM = window.HM || {};
  var cfg = window.HM.config;

  // ── Token & user storage ──
  function getToken()  { return localStorage.getItem(cfg.STORAGE.token); }
  function setToken(t) { localStorage.setItem(cfg.STORAGE.token, t); }
  function clearToken(){ localStorage.removeItem(cfg.STORAGE.token); }

  function getUser()   { try { return JSON.parse(localStorage.getItem(cfg.STORAGE.user)); } catch { return null; } }
  function setUser(u)  { localStorage.setItem(cfg.STORAGE.user, JSON.stringify(u)); }
  function clearUser() { localStorage.removeItem(cfg.STORAGE.user); }

  // ── Core fetch wrapper ──
  async function request(method, path, body, opts) {
    opts = opts || {};
    var headers = { 'Accept': 'application/json' };
    var token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    var init = { method: method, headers: headers };

    if (body instanceof FormData) {
      init.body = body;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    // Timeout via AbortController
    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, opts.timeout || cfg.API_TIMEOUT);
    init.signal = controller.signal;

    try {
      var res = await fetch(cfg.API_BASE + path, init);
      clearTimeout(timeoutId);

      // Auto-logout on 401
      if (res.status === 401 && path !== '/auth/login' && path !== '/auth/register') {
        clearToken();
        clearUser();
        window.dispatchEvent(new CustomEvent('hm:unauthenticated'));
      }

      var contentType = res.headers.get('content-type') || '';
      var data;
      if (contentType.indexOf('application/json') >= 0) {
        data = await res.json();
      } else if (contentType.indexOf('text/csv') >= 0) {
        data = await res.blob();
      } else {
        data = await res.text();
      }

      if (!res.ok) {
        var err = new Error((data && data.message) || ('HTTP ' + res.status));
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        var te = new Error('Request timed out. Please check your connection.');
        te.status = 0;
        throw te;
      }
      throw e;
    }
  }

  var api = {
    get:    function (p)    { return request('GET', p); },
    post:   function (p, b) { return request('POST', p, b); },
    put:    function (p, b) { return request('PUT', p, b); },
    patch:  function (p, b) { return request('PATCH', p, b); },
    delete: function (p)    { return request('DELETE', p); },
  };

  // ── Auth ──
  async function authRegister(data) {
    var res = await api.post('/auth/register', data);
    setToken(res.token);
    setUser(res.user);
    return res;
  }

  async function authLogin(email, password) {
    var res = await api.post('/auth/login', { email: email, password: password });
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
    var res = await api.get('/auth/me');
    setUser(res.user);
    return res.user;
  }

  // ── Patient endpoints ──
  var patient = {
    getProfile:       function () { return api.get('/patient/profile'); },
    updateProfile:    function (d) { return api.put('/patient/profile', d); },
    completeRegistration: function (d) { return api.post('/patient/profile/complete-registration', d); },

    getAddresses:    function () { return api.get('/patient/addresses'); },
    createAddress:   function (d) { return api.post('/patient/addresses', d); },
    updateAddress:   function (id, d) { return api.put('/patient/addresses/' + id, d); },
    deleteAddress:   function (id) { return api.delete('/patient/addresses/' + id); },

    listDiagnoses: function (page) { return api.get('/patient/tongue-diagnoses?page=' + (page || 1)); },
    getDiagnosis:  function (id) { return api.get('/patient/tongue-diagnoses/' + id); },
    deleteDiagnosis: function (id) { return api.delete('/patient/tongue-diagnoses/' + id); },
    uploadTongue: function (file) {
      var fd = new FormData();
      fd.append('image', file);
      return api.post('/patient/tongue-diagnoses', fd);
    },

    saveQuestionnaire:  function (d)  { return api.post('/patient/questionnaires', d); },
    listQuestionnaires: function ()   { return api.get('/patient/questionnaires'); },
    getQuestionnaire:   function (id) { return api.get('/patient/questionnaires/' + id); },

    listDoctors:    function (q) { return api.get('/patient/doctors' + (q ? '?' + q : '')); },
    getDoctor:      function (id) { return api.get('/patient/doctors/' + id); },
    listPharmacies: function (q) { return api.get('/patient/pharmacies' + (q ? '?' + q : '')); },
    getDoctorSlots: function (id, date) { return api.get('/doctors/' + id + '/slots?date=' + date); },

    listAppointments: function (page) { return api.get('/patient/appointments?page=' + (page || 1)); },
    bookAppointment:  function (d) { return api.post('/patient/appointments', d); },
    cancelAppointment: function (id) { return api.post('/patient/appointments/' + id + '/cancel'); },

    listPrescriptions: function (page) { return api.get('/patient/prescriptions?page=' + (page || 1)); },
    listOrders:    function (q) { return api.get('/patient/orders' + (q ? '?' + q : '')); },
    getOrder:      function (id) { return api.get('/patient/orders/' + id); },
    createOrder:   function (d) { return api.post('/patient/orders', d); },
  };

  // ── Doctor endpoints ──
  var doctor = {
    getProfile:    function () { return api.get('/doctor/profile'); },
    updateProfile: function (d) { return api.put('/doctor/profile', d); },

    listAppointments: function (q) { return api.get('/doctor/appointments' + (q ? '?' + q : '')); },
    createAppointment:function (d) { return api.post('/doctor/appointments', d); },
    getAppointment:   function (id) { return api.get('/doctor/appointments/' + id); },
    startAppointment: function (id) { return api.post('/doctor/appointments/' + id + '/start'); },
    completeAppointment: function (id) { return api.post('/doctor/appointments/' + id + '/complete'); },

    listPatients:      function (q) { return api.get('/doctor/patients' + (q ? '?' + q : '')); },
    patientTongue:     function (id) { return api.get('/doctor/patients/' + id + '/tongue-diagnoses'); },
    patientConsults:   function (id) { return api.get('/doctor/patients/' + id + '/consultations'); },

    listPrescriptions: function (page) { return api.get('/doctor/prescriptions?page=' + (page || 1)); },
    issuePrescription: function (d) { return api.post('/doctor/prescriptions', d); },
    getPrescription:   function (id) { return api.get('/doctor/prescriptions/' + id); },
    revokePrescription:function (id) { return api.post('/doctor/prescriptions/' + id + '/revoke'); },
    revisePrescription:function (id, d) { return api.post('/doctor/prescriptions/' + id + '/revise', d); },

    listSchedules:  function () { return api.get('/doctor/schedules'); },
    createSchedule: function (d) { return api.post('/doctor/schedules', d); },
    deleteSchedule: function (id) { return api.delete('/doctor/schedules/' + id); },

    listOffDays:    function ()  { return api.get('/doctor/off-days'); },
    toggleOffDay:   function (d) { return api.post('/doctor/off-days', { date: d }); },
    setDayOverride: function (d, type, start, end) {
      return api.post('/doctor/off-days', { date: d, type: type, start: start, end: end });
    },

    getEarnings:       function () { return api.get('/doctor/earnings/summary'); },
    getEarningHistory: function (page) { return api.get('/doctor/earnings/history?page=' + (page || 1)); },
    // Doctor withdrawals removed — doctors are paid by clinic salary, not commission.

    // Tongue diagnosis review
    listTongueReviews: function (filter) { return api.get('/doctor/tongue-reviews' + (filter ? '?filter=' + filter : '')); },
    getTongueReview:   function (id)     { return api.get('/doctor/tongue-reviews/' + id); },
    reviewTongue:      function (id, d)  { return api.post('/doctor/tongue-reviews/' + id + '/review', d); },

    // AI constitution review
    listConstitutionReviews:    function (filter)   { return api.get('/doctor/constitution-reviews' + (filter ? '?filter=' + filter : '')); },
    patientConstitutionReports: function (patientId){ return api.get('/doctor/patients/' + patientId + '/constitution-reviews'); },
    getConstitutionReview:      function (id)       { return api.get('/doctor/constitution-reviews/' + id); },
    reviewConstitution:         function (id, d)    { return api.post('/doctor/constitution-reviews/' + id + '/review', d); },

    issueMC:       function (d) { return api.post('/doctor/documents/mc', d); },
    issueReferral: function (d) { return api.post('/doctor/documents/referral', d); },
  };

  // ── Pharmacy endpoints ──
  var pharmacy = {
    getProfile:    function () { return api.get('/pharmacy/profile'); },
    updateProfile: function (d) { return api.put('/pharmacy/profile', d); },

    listProducts:  function (page) { return api.get('/pharmacy/products?page=' + (page || 1)); },
    createProduct: function (d) { return api.post('/pharmacy/products', d); },
    updateProduct: function (id, d) { return api.put('/pharmacy/products/' + id, d); },
    adjustStock:   function (id, d) { return api.post('/pharmacy/products/' + id + '/stock', d); },

    listOrders:    function (q) { return api.get('/pharmacy/orders' + (q ? '?' + q : '')); },
    getOrder:      function (id) { return api.get('/pharmacy/orders/' + id); },
    startDispense: function (id) { return api.post('/pharmacy/orders/' + id + '/dispense/start'); },
    finishDispense:function (id) { return api.post('/pharmacy/orders/' + id + '/dispense/finish'); },
    shipOrder:     function (id, d) { return api.post('/pharmacy/orders/' + id + '/ship', d); },

    listPrescriptions: function () { return api.get('/pharmacy/prescriptions'); },

    getSummary:        function (p) { return api.get('/pharmacy/reconciliation/summary?period=' + (p || 'month')); },
    getDailyBreakdown: function () { return api.get('/pharmacy/reconciliation/daily'); },

    posProducts:    function () { return api.get('/pharmacy/pos/products'); },
    posSale:        function (d) { return api.post('/pharmacy/pos/sale', d); },
    posHistory:     function (q) { return api.get('/pharmacy/pos/history' + (q ? '?' + q : '')); },
    posDaily:       function () { return api.get('/pharmacy/pos/daily-summary'); },
  };

  // ── Admin endpoints ──
  var admin = {
    dashboard:          function () { return api.get('/admin/reports/dashboard'); },

    listAccounts:       function (q) { return api.get('/admin/accounts' + (q ? '?' + q : '')); },
    createAccount:      function (d) { return api.post('/admin/accounts', d); },
    toggleAccount:      function (id) { return api.post('/admin/accounts/' + id + '/toggle'); },

    listPatients:       function (q) { return api.get('/admin/patients' + (q ? '?' + q : '')); },
    getPatient:         function (id) { return api.get('/admin/patients/' + id); },
    updatePatient:      function (id, d) { return api.put('/admin/patients/' + id, d); },

    listDoctors:        function (q) { return api.get('/admin/doctors' + (q ? '?' + q : '')); },
    pendingDoctors:     function () { return api.get('/admin/doctors/pending'); },
    reviewDoctor:       function (id, d) { return api.post('/admin/doctors/' + id + '/review', d); },
    updateDoctor:       function (id, d) { return api.put('/admin/doctors/' + id, d); },
    toggleDoctor:       function (id) { return api.post('/admin/doctors/' + id + '/toggle'); },

    pendingPharmacies:  function () { return api.get('/admin/pharmacies/pending'); },
    reviewPharmacy:     function (id, d) { return api.post('/admin/pharmacies/' + id + '/review', d); },

    listAppointments:   function (q) { return api.get('/admin/appointments' + (q ? '?' + q : '')); },
    createAppointment:  function (d) { return api.post('/admin/appointments', d); },

    financeOverview:    function () { return api.get('/admin/finance/overview'); },
    pendingWithdrawals: function () { return api.get('/admin/finance/withdrawals/pending'); },
    reviewWithdrawal:   function (id, d) { return api.post('/admin/finance/withdrawals/' + id + '/review', d); },
    listOrders:         function (q) { return api.get('/admin/finance/orders' + (q ? '?' + q : '')); },

    listPrescriptions:  function (q) { return api.get('/admin/prescriptions' + (q ? '?' + q : '')); },
    getPrescription:    function (id) { return api.get('/admin/prescriptions/' + id); },
    revokePrescription: function (id, d) { return api.post('/admin/prescriptions/' + id + '/revoke', d); },

    getConfigs:     function () { return api.get('/admin/configs'); },
    setConfigs:     function (d) { return api.post('/admin/configs', { configs: d }); },
    getTongueConfig:function () { return api.get('/admin/tongue-config'); },
    setTongueConfig:function (d) { return api.post('/admin/tongue-config', d); },

    getPermissions: function () { return api.get('/admin/permissions'); },
    setPermissions: function (d) { return api.post('/admin/permissions', { permissions: d }); },

    auditLogs:      function (q) { return api.get('/admin/audit-logs' + (q ? '?' + q : '')); },

    listContent:    function () { return api.get('/admin/content'); },
    getContent:     function (slug) { return api.get('/admin/content/' + slug); },
    saveContent:    function (d) { return api.post('/admin/content', d); },
    deleteContent:  function (slug) { return api.delete('/admin/content/' + slug); },

    exportCsv:      function (entity) { return api.get('/admin/reports/export/' + entity); },
  };

  // ── Notifications (all roles) ──
  var notification = {
    list:        function (unreadOnly) { return api.get('/notifications' + (unreadOnly ? '?unread_only=1' : '')); },
    unreadCount: function () { return api.get('/notifications/unread-count'); },
    markRead:    function (id) { return api.post('/notifications/' + id + '/read'); },
    markAllRead: function () { return api.post('/notifications/read-all'); },
  };

  // ── Chat (all roles) ──
  var chat = {
    threads:        function () { return api.get('/chat/threads'); },
    openThread:     function (d) { return api.post('/chat/thread', d); },
    messages:       function (threadId) { return api.get('/chat/threads/' + threadId + '/messages'); },
    sendMessage:    function (threadId, d) {
      if (d instanceof FormData) return api.post('/chat/threads/' + threadId + '/messages', d);
      return api.post('/chat/threads/' + threadId + '/messages', d);
    },
  };

  // ── Consultation (video) ──
  var consultation = {
    joinToken: function (apptId) { return api.get('/consultations/' + apptId + '/join'); },
    finish:    function (apptId, d) { return api.post('/consultations/' + apptId + '/finish', d); },
  };

  // ── Content pages (public) ──
  var pages = {
    list: function () { return api.get('/pages'); },
    show: function (slug) { return api.get('/pages/' + slug); },
  };

  // ── Shop (curated public catalog) ──
  var shop = {
    list:     function (q) { return api.get('/shop/products' + (q ? '?' + q : '')); },
    featured: function ()  { return api.get('/shop/featured'); },
    show:     function (id){ return api.get('/shop/products/' + id); },
    checkout: function (d) { return api.post('/shop/checkout', d); },
  };

  // ── Security ──
  var security = {
    changePassword: function (d) { return api.post('/auth/change-password', d); },
    deleteAccount:  function (d) { return api.post('/auth/delete-account', d); },
  };

  // ── Export ──
  window.HM.api = {
    request: request,
    get:     api.get,
    post:    api.post,
    put:     api.put,
    patch:   api.patch,
    delete:  api.delete,

    getToken: getToken, setToken: setToken, clearToken: clearToken,
    getUser: getUser, setUser: setUser, clearUser: clearUser,

    authRegister: authRegister,
    authLogin: authLogin,
    authLogout: authLogout,
    authMe: authMe,

    patient: patient,
    doctor: doctor,
    pharmacy: pharmacy,
    admin: admin,
    shop: shop,
    notification: notification,
    chat: chat,
    consultation: consultation,
    pages: pages,
    security: security,
  };
})();
