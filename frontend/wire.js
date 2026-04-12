/**
 * HansMed Frontend Wiring
 * -----------------------
 * Replaces demo/prototype logic with real API calls.
 * Depends on api.js (window.HansMedAPI).
 *
 * Include AFTER the original HTML's <script> block and api.js:
 *   <script src="frontend/api.js"></script>
 *   <script src="frontend/wire.js"></script>
 *
 * Design principle: we OVERRIDE existing global functions so the HTML
 * doesn't need any changes. Same element IDs, same function names,
 * different implementation.
 *
 * DEMO MODE: when the API is unreachable (e.g. GitHub Pages with no backend),
 * all overrides silently fall back to the original prototype functions so
 * demo accounts and local data still work.
 */

(function () {
  'use strict';
  var A = window.HansMedAPI;
  if (!A) { console.error('wire.js: api.js not loaded'); return; }

  // ── Demo mode detection ─────────────────────────────────────────
  // Ping the API once. If unreachable, don't override anything.
  var _apiReachable = null; // null = unknown, true/false after check

  function checkApi() {
    return fetch(window.HANSMED_API_BASE + '/auth/me', { method: 'GET', headers: { 'Accept': 'application/json' } })
      .then(function (res) {
        _apiReachable = true;
        console.log('[HansMed] API connected ✓ — using LIVE backend');
        showToast('🟢 Connected to live server · 已連接伺服器');
      })
      .catch(function (err) {
        _apiReachable = false;
        console.log('[HansMed] API unreachable — using DEMO mode', err);
        showToast('🟡 Demo mode — server offline · 離線示範模式');
      });
  }

  // Run check on load — if API is down, skip all overrides
  checkApi();

  /** Wrap an override so it falls back to the original when API is down */
  function wrapWithFallback(fnName, apiFn) {
    var original = window[fnName];
    window[fnName] = function () {
      if (_apiReachable === false) {
        // API unreachable — use original demo logic
        if (typeof original === 'function') return original.apply(this, arguments);
        return;
      }
      // API reachable (or still checking) — use real API
      return apiFn.apply(this, arguments);
    };
    return original;
  }

  // ================================================================
  // 1. AUTH — override handleLogin / handleRegister / handleLogout
  // ================================================================

  wrapWithFallback('handleLogin', async function () {
    var email = (document.getElementById('login-email').value || '').trim().toLowerCase();
    var password = document.getElementById('login-password').value || '';
    var errEl = document.getElementById('login-error');
    errEl.textContent = '';
    if (!email) { errEl.textContent = 'Please enter your email address. · 請輸入電郵地址。'; return; }
    if (!password) { errEl.textContent = 'Please enter your password. · 請輸入密碼。'; return; }

    try {
      var res = await A.authLogin(email, password);
      loginSuccess(res.user);
      closeAuthModal();
      if (res.user.role === 'admin') showPage('admin');
      else if (res.user.role === 'doctor') showPage('doctor');
      else showPage('portal');
    } catch (e) {
      errEl.textContent = (e.data && e.data.errors && e.data.errors.email && e.data.errors.email[0])
        || e.message || 'Login failed · 登入失敗';
    }
  });

  wrapWithFallback('handleDoctorLogin', async function () {
    var email = (document.getElementById('doc-email').value || '').trim().toLowerCase();
    var password = document.getElementById('doc-password').value || '';
    var errEl = document.getElementById('doc-error');
    errEl.textContent = '';
    if (!email) { errEl.textContent = 'Please enter your doctor email. · 請輸入醫師電郵。'; return; }
    if (!password) { errEl.textContent = 'Please enter your password. · 請輸入密碼。'; return; }

    try {
      var res = await A.authLogin(email, password);
      if (res.user.role !== 'doctor') { errEl.textContent = 'Not a doctor account. · 非醫師帳號。'; A.authLogout(); return; }
      loginSuccess(res.user);
      closeAuthModal();
      showPage('doctor');
    } catch (e) {
      errEl.textContent = (e.data && e.data.errors && e.data.errors.email && e.data.errors.email[0])
        || e.message || 'Login failed · 登入失敗';
    }
  });

  wrapWithFallback('handleRegister', async function () {
    var name = (document.getElementById('reg-name').value || '').trim();
    var email = (document.getElementById('reg-email').value || '').trim().toLowerCase();
    var password = document.getElementById('reg-password').value || '';
    var phone = (document.getElementById('reg-phone') || {}).value || '';
    var errEl = document.getElementById('reg-error');
    errEl.textContent = '';
    if (!name) { errEl.textContent = 'Please enter your full name. · 請輸入姓名。'; return; }
    if (!email || email.indexOf('@') < 0) { errEl.textContent = 'Please enter a valid email. · 請輸入有效電郵。'; return; }
    if (password.length < 8) { errEl.textContent = 'Password must be at least 8 characters. · 密碼至少需要8個字元。'; return; }

    try {
      var res = await A.authRegister({ email: email, password: password, role: 'patient', nickname: name });
      loginSuccess(res.user);
      closeAuthModal();
      showPage('portal');
      showToast('Welcome · 歡迎 ' + name + '！ Account created · 帳號已建立');
    } catch (e) {
      var msg = '';
      if (e.data && e.data.errors) {
        var errs = e.data.errors;
        msg = (errs.email && errs.email[0]) || (errs.password && errs.password[0]) || '';
      }
      errEl.textContent = msg || e.message || 'Registration failed · 註冊失敗';
    }
  });

  wrapWithFallback('handleLogout', async function () {
    await A.authLogout();
    window.currentUser = null;
    var badge = document.getElementById('nav-user-badge');
    if (badge) badge.classList.remove('show');
    var navPortal = document.getElementById('nav-portal');
    if (navPortal) {
      navPortal.textContent = 'My Portal · 我的帳號';
      navPortal.setAttribute('onclick', "requireLogin('patient')");
    }
    A.stopNotifPolling();
    showPage('home');
    showToast('Signed out · 已登出');
  });

  // Override loginSuccess to store on API user shape
  var _origLoginSuccess = window.loginSuccess;
  window.loginSuccess = function (user) {
    // Normalize backend user shape to what the HTML expects
    window.currentUser = {
      name: user.nickname || user.full_name || user.name || user.email,
      email: user.email,
      role: user.role,
      id: user.id,
    };
    // Run original UI updates
    if (typeof _origLoginSuccess === 'function') {
      _origLoginSuccess(window.currentUser);
    }
    // Start notification polling
    A.startNotifPolling(function (count) {
      updateNotifBadge(count);
    });
  };

  // Restore session on page load
  window.addEventListener('DOMContentLoaded', function () {
    var saved = A.getUser();
    if (saved && A.getToken()) {
      // Verify token still valid
      A.authMe().then(function (user) {
        loginSuccess(user);
      }).catch(function () {
        A.clearToken();
        A.clearUser();
      });
    }
  });

  // Handle auto-logout from 401
  window.addEventListener('hansmed:logout', function () {
    window.handleLogout();
  });

  // ================================================================
  // 2. TONGUE DIAGNOSIS — override handleTongue
  // ================================================================

  wrapWithFallback('handleTongue', async function (input) {
    if (!input.files || !input.files[0]) return;
    var file = input.files[0];

    // Show preview immediately
    var previewEl = document.getElementById('tongue-preview') || document.getElementById('tongue-img');
    if (previewEl) {
      var reader = new FileReader();
      reader.onload = function (e) { previewEl.src = e.target.result; };
      reader.readAsDataURL(file);
    }

    // Show loading state
    var resultEl = document.getElementById('tongue-result');
    if (resultEl) resultEl.innerHTML = '<p style="color:var(--stone)">Analyzing tongue image... · 正在分析舌象...</p>';

    try {
      var res = await A.patient.uploadTongue(file);
      var diag = res.diagnosis;

      if (diag.status === 'processing') {
        // Queued — poll for result
        if (resultEl) resultEl.innerHTML = '<p style="color:var(--gold)">Analysis in progress... · 分析中... (results will appear shortly)</p>';
        pollTongueDiagnosis(diag.id, resultEl);
      } else if (diag.status === 'completed') {
        renderTongueResult(diag, resultEl);
      } else {
        if (resultEl) resultEl.innerHTML = '<p style="color:var(--red-seal)">Analysis failed. Please try again. · 分析失敗，請重試。</p>';
      }
    } catch (e) {
      if (resultEl) resultEl.innerHTML = '<p style="color:var(--red-seal)">' + (e.message || 'Upload failed') + '</p>';
    }
  });

  function pollTongueDiagnosis(id, el) {
    var attempts = 0;
    var interval = setInterval(async function () {
      attempts++;
      try {
        var res = await A.patient.getDiagnosis(id);
        if (res.diagnosis.status === 'completed') {
          clearInterval(interval);
          renderTongueResult(res.diagnosis, el);
        } else if (res.diagnosis.status === 'failed' || attempts > 30) {
          clearInterval(interval);
          if (el) el.innerHTML = '<p style="color:var(--red-seal)">Analysis could not be completed. · 無法完成分析。</p>';
        }
      } catch { /* keep polling */ }
    }, 3000);
  }

  function renderTongueResult(diag, el) {
    if (!el) return;
    var report = diag.constitution_report || {};
    var constitution = report.constitution || {};
    var findings = report.findings || [];

    var html = '<div style="padding:1rem 0">';
    html += '<h3 style="margin-bottom:.8rem">Tongue Analysis Results · 舌診分析結果</h3>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-bottom:1rem">';

    // Findings
    findings.forEach(function (f) {
      html += '<div style="background:var(--washi);padding:.8rem;border-radius:4px">';
      html += '<div style="font-size:.7rem;letter-spacing:.12em;color:var(--gold);text-transform:uppercase;margin-bottom:.3rem">' + f.category.replace(/_/g, ' ') + '</div>';
      html += '<div style="font-size:.95rem;color:var(--ink)">' + (f.value || '') + '</div>';
      html += '<div style="font-size:.75rem;color:var(--stone);margin-top:.2rem">' + (f.value_zh || '') + '</div>';
      html += '</div>';
    });
    html += '</div>';

    // Constitution
    if (constitution.name_en) {
      html += '<div style="background:var(--washi-dark);padding:1rem;border-radius:4px;margin-bottom:1rem">';
      html += '<div style="font-size:.7rem;letter-spacing:.15em;color:var(--gold);text-transform:uppercase;margin-bottom:.4rem">Constitution · 體質</div>';
      html += '<div style="font-size:1.15rem;font-family:\'Cormorant Garamond\',serif;color:var(--ink)">' + constitution.name_en + '</div>';
      html += '<div style="font-size:.85rem;color:var(--stone)">' + (constitution.name_zh || '') + '</div>';
      html += '<div style="font-size:.75rem;color:var(--sage);margin-top:.3rem">Confidence: ' + Math.round((constitution.confidence || 0) * 100) + '%</div>';
      html += '</div>';
    }

    // Health score
    if (report.health_score != null) {
      var scoreColor = report.health_score >= 80 ? 'var(--sage)' : report.health_score >= 60 ? 'var(--gold)' : 'var(--red-seal)';
      html += '<div style="font-size:1rem;margin-bottom:.8rem">Health Score · 健康評分：<strong style="font-size:1.6rem;color:' + scoreColor + '">' + report.health_score + '</strong>/100</div>';
    }

    // Recommendations
    var recs = report.recommendations || [];
    if (recs.length) {
      html += '<div style="margin-top:.8rem"><div style="font-size:.7rem;letter-spacing:.12em;color:var(--gold);text-transform:uppercase;margin-bottom:.5rem">Lifestyle Recommendations · 養生建議</div>';
      html += '<ul style="list-style:none;padding:0">';
      recs.forEach(function (r) {
        html += '<li style="font-size:.85rem;color:var(--stone);padding:.25rem 0;border-bottom:1px solid var(--mist)">• ' + r + '</li>';
      });
      html += '</ul></div>';
    }

    html += '</div>';
    el.innerHTML = html;
  }

  // ================================================================
  // 3. BOOKING — override confirmBooking
  // ================================================================

  var _origConfirmBooking = window.confirmBooking;
  wrapWithFallback('confirmBooking', async function () {
    if (!window.currentUser || !A.getToken()) {
      requireLogin('patient');
      return;
    }

    // Read state from the existing booking flow globals
    var docId = window.bk_doc_id || window.selDocId;
    var startStr = window.bk_datetime || window.selDateTime;

    if (!docId || !startStr) {
      showToast('Please complete all booking steps · 請完成所有預約步驟');
      return;
    }

    // Build start/end from the selected date+time
    var start = new Date(startStr);
    var end = new Date(start.getTime() + 30 * 60000); // 30-min slot

    try {
      var res = await A.patient.bookAppointment({
        doctor_id: parseInt(docId),
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        notes: (document.getElementById('pt-notes') || {}).value || '',
      });

      // If Stripe client_secret returned, could initiate Stripe checkout here
      // For now show the confirmation
      if (res.stripe_client_secret) {
        window._pendingStripeSecret = res.stripe_client_secret;
        window._pendingPaymentAppointmentId = res.appointment.id;
      }

      showToast('Appointment booked! · 預約成功！');
      // Let the original confirmation UI render if it exists
      if (typeof _origConfirmBooking === 'function') {
        try { _origConfirmBooking(); } catch {}
      }
    } catch (e) {
      var msg = '';
      if (e.data && e.data.errors) {
        var k = Object.keys(e.data.errors)[0];
        msg = e.data.errors[k][0] || '';
      }
      showToast(msg || e.message || 'Booking failed · 預約失敗');
    }
  });

  // ================================================================
  // 4. SHOP — load products from API (pharmacy products)
  // ================================================================

  async function loadShopProducts() {
    try {
      var res = await A.patient.listPharmacies();
      var pharmacies = (res.data || []);
      // For MVP, load products from first approved pharmacy
      if (pharmacies.length === 0) return;
      // Products are on the pharmacy side — use a public product listing
      // If no public endpoint, keep using the prototype PRODUCTS array
    } catch {}
  }

  // ================================================================
  // 5. PATIENT PORTAL — load real data
  // ================================================================

  var _origShowPortalPanel = window.showPortalPanel;
  window.showPortalPanel = async function (id, btn) {
    // Run original UI switching
    if (typeof _origShowPortalPanel === 'function') _origShowPortalPanel(id, btn);

    if (id === 'portal-appts' || id === 'portal-appointments') {
      await loadPortalAppointments();
    } else if (id === 'portal-orders') {
      await loadPortalOrders();
    } else if (id === 'portal-rx' || id === 'portal-prescriptions') {
      await loadPortalPrescriptions();
    }
  };

  async function loadPortalAppointments() {
    try {
      var res = await A.patient.listAppointments();
      var el = document.getElementById('portal-appts-list') || document.getElementById('portal-appointments-list');
      if (!el) return;
      var items = res.data || [];
      if (!items.length) { el.innerHTML = '<p style="color:var(--stone)">No appointments yet · 暫無預約</p>'; return; }
      el.innerHTML = items.map(function (a) {
        var d = new Date(a.scheduled_start);
        return '<div style="padding:.8rem;border-bottom:1px solid var(--mist);display:flex;justify-content:space-between;align-items:center">'
          + '<div><strong>' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + '</strong>'
          + '<div style="font-size:.8rem;color:var(--stone)">Doctor ID: ' + a.doctor_id + '</div></div>'
          + '<span style="font-size:.72rem;padding:.25rem .6rem;border-radius:3px;background:var(--washi);color:var(--stone)">' + a.status + '</span>'
          + '</div>';
      }).join('');
    } catch {}
  }

  async function loadPortalOrders() {
    try {
      var res = await A.patient.listOrders();
      var el = document.getElementById('portal-orders-list');
      if (!el) return;
      var items = res.data || [];
      if (!items.length) { el.innerHTML = '<p style="color:var(--stone)">No orders yet · 暫無訂單</p>'; return; }
      el.innerHTML = items.map(function (o) {
        return '<div style="padding:.8rem;border-bottom:1px solid var(--mist);display:flex;justify-content:space-between">'
          + '<div><strong>' + o.order_no + '</strong><div style="font-size:.8rem;color:var(--stone)">' + o.status + '</div></div>'
          + '<div style="font-size:1rem;font-weight:600">RM ' + parseFloat(o.total).toFixed(2) + '</div>'
          + '</div>';
      }).join('');
    } catch {}
  }

  async function loadPortalPrescriptions() {
    try {
      var res = await A.patient.listPrescriptions();
      var el = document.getElementById('portal-rx-list') || document.getElementById('portal-prescriptions-list');
      if (!el) return;
      var items = res.data || [];
      if (!items.length) { el.innerHTML = '<p style="color:var(--stone)">No prescriptions yet · 暫無處方</p>'; return; }
      el.innerHTML = items.map(function (rx) {
        var itemNames = (rx.items || []).map(function (i) { return i.drug_name; }).join(', ');
        return '<div style="padding:.8rem;border-bottom:1px solid var(--mist)">'
          + '<div style="display:flex;justify-content:space-between"><strong>' + (rx.diagnosis || 'Prescription #' + rx.id) + '</strong>'
          + '<span style="font-size:.72rem;padding:.2rem .5rem;border-radius:3px;background:var(--washi);color:var(--sage)">' + rx.status + '</span></div>'
          + '<div style="font-size:.8rem;color:var(--stone);margin-top:.3rem">' + itemNames + '</div>'
          + '</div>';
      }).join('');
    } catch {}
  }

  // ================================================================
  // 6. DOCTOR WORKSPACE — load real appointment queue
  // ================================================================

  var _origShowDoctorPanel = window.showDoctorPanel;
  window.showDoctorPanel = async function (id, btn) {
    if (typeof _origShowDoctorPanel === 'function') _origShowDoctorPanel(id, btn);

    if (id === 'doc-queue' || id === 'doc-dashboard') {
      await loadDoctorQueue();
    }
  };

  async function loadDoctorQueue() {
    try {
      var res = await A.doctor.listAppointments('status=confirmed');
      var el = document.getElementById('doc-queue-list') || document.querySelector('[data-panel="doc-queue"]');
      if (!el) return;
      var items = res.data || [];
      if (!items.length) { /* keep showing prototype data if no real data */ return; }
      // Append real appointments to existing UI
    } catch {}
  }

  // Override consultation submission (prescription issuance)
  window.submitConsultation = async function (appointmentId, formData) {
    if (!appointmentId || !formData) return;

    try {
      // Start the appointment
      await A.doctor.startAppointment(appointmentId);

      // Issue prescription if items exist
      if (formData.rxItems && formData.rxItems.length) {
        await A.doctor.issuePrescription({
          appointment_id: appointmentId,
          diagnosis: formData.diagnosis || '',
          instructions: formData.instructions || '',
          duration_days: formData.durationDays || 7,
          items: formData.rxItems.map(function (item) {
            return {
              drug_name: item.name || item.herb,
              quantity: item.quantity || item.dosage || 1,
              unit: item.unit || 'g',
            };
          }),
        });
      }

      // Complete the appointment
      await A.doctor.completeAppointment(appointmentId);
      showToast('Consultation completed · 問診已完成');
    } catch (e) {
      showToast(e.message || 'Failed to save consultation');
    }
  };

  // ================================================================
  // 7. ADMIN — wire to real endpoints
  // ================================================================

  // Override renderAdminDoctors to fetch from API
  var _origRenderAdminDoctors = window.renderAdminDoctors;
  window.renderAdminDoctors = async function () {
    try {
      var res = await A.admin.pendingDoctors();
      var pending = res.data || [];
      // Merge with any existing ADMIN_DOCTORS for the table
      // For now fall back to prototype if no pending
      if (!pending.length && typeof _origRenderAdminDoctors === 'function') {
        _origRenderAdminDoctors();
        return;
      }
    } catch {
      if (typeof _origRenderAdminDoctors === 'function') _origRenderAdminDoctors();
    }
  };

  // Wire admin settings save to system config API
  window.saveAdminSettings = async function () {
    var clinicName = (document.getElementById('set-clinic-name') || {}).value;
    var clinicNameZh = (document.getElementById('set-clinic-name-zh') || {}).value;
    var address = (document.getElementById('set-address') || {}).value;
    var phone = (document.getElementById('set-phone') || {}).value;
    var email = (document.getElementById('set-email') || {}).value;
    var website = (document.getElementById('set-website') || {}).value;
    var freeShip = (document.getElementById('set-free-ship') || {}).value;
    var slotDuration = (document.getElementById('set-slot-duration') || {}).value;

    var configs = {};
    if (clinicName) configs.clinic_name = clinicName;
    if (clinicNameZh) configs.clinic_name_zh = clinicNameZh;
    if (address) configs.clinic_address = address;
    if (phone) configs.clinic_phone = phone;
    if (email) configs.clinic_email = email;
    if (website) configs.clinic_website = website;
    if (freeShip) configs.free_shipping_threshold = freeShip;
    if (slotDuration) configs.appointment_slot_minutes = slotDuration;

    try {
      await A.admin.setConfigs(configs);
      showToast('Settings saved · 設定已儲存');
    } catch (e) {
      showToast(e.message || 'Failed to save settings');
    }
  };

  // Wire admin dashboard stats
  async function loadAdminDashboard() {
    try {
      var res = await A.admin.dashboard();
      var el = document.getElementById('admin-dash-stats');
      if (!el) return;
      // Update stat cards if they exist
      var cards = el.querySelectorAll('.stat-card-value, .stat-num');
      if (cards.length >= 3) {
        cards[0].textContent = res.users ? res.users.patients : '—';
        cards[1].textContent = res.appointments ? res.appointments.total : '—';
        cards[2].textContent = res.orders ? 'RM ' + parseFloat(res.orders.revenue || 0).toFixed(0) : '—';
      }
    } catch {}
  }

  // Wire inventory export
  var _origExportCSV = window.exportInventoryCSV;
  window.exportInventoryCSV = async function () {
    try {
      var blob = await A.admin.exportCsv('orders');
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'orders-export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // Fallback to prototype version
      if (typeof _origExportCSV === 'function') _origExportCSV();
    }
  };

  // ================================================================
  // 8. NOTIFICATIONS — badge + polling
  // ================================================================

  function updateNotifBadge(count) {
    // Update any notification badge elements
    var badges = document.querySelectorAll('.notif-badge, .notification-count');
    badges.forEach(function (b) {
      b.textContent = count;
      b.style.display = count > 0 ? 'flex' : 'none';
    });
  }

  // ================================================================
  // 9. VIDEO CONSULTATION — Agora join
  // ================================================================

  window.joinVideoConsultation = async function (appointmentId) {
    try {
      var res = await A.consultation.joinToken(appointmentId);
      // res.rtc has: app_id, channel, uid, token
      // In production, pass these to the Agora Web SDK
      if (res.rtc.stub) {
        showToast('Video consultation ready (dev mode) · 視頻問診就緒（開發模式）');
      } else {
        showToast('Joining video room: ' + res.rtc.channel);
        // AgoraRTC.createClient(...) etc.
      }
      return res;
    } catch (e) {
      showToast(e.message || 'Failed to join video');
    }
  };

  // ================================================================
  // 10. CART CHECKOUT — Stripe integration placeholder
  // ================================================================

  window.checkoutWithStripe = async function () {
    if (!window.currentUser || !A.getToken()) {
      requireLogin('patient');
      return;
    }
    // The cart is client-side; to checkout, we need to:
    // 1. Create an order (POST /patient/orders with prescription_id + pharmacy_id + address_id)
    // 2. Use the returned stripe_client_secret with Stripe.js
    showToast('Checkout integration coming soon · 結帳功能即將推出');
  };

  // ================================================================
  // INIT
  // ================================================================

  console.log('[HansMed] Wire.js loaded — API wiring active');
})();
