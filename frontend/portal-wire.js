/**
 * HansMed Portal Wiring
 * ---------------------
 * Replaces all hardcoded demo data in the patient portal with real API data.
 * Loaded after wire.js.
 */
(function () {
  'use strict';
  var A = window.HansMedAPI;
  if (!A) return;

  // ── Helper: empty state card ──
  function emptyState(msg) {
    return '<div style="text-align:center;padding:3rem 1rem;color:var(--stone);font-size:.92rem;">'
      + '<div style="font-size:2rem;margin-bottom:.5rem;">📭</div>' + msg + '</div>';
  }

  // ── Override showPortalPanel to load real data ──
  var _orig = window.showPortalPanel;
  window.showPortalPanel = function (id, btn) {
    if (typeof _orig === 'function') _orig(id, btn);
    // Load data based on panel
    if (id === 'p-overview')      loadOverview();
    if (id === 'p-profile')       loadProfile();
    if (id === 'p-tongue')        loadTongueHistory();
    if (id === 'p-appointments')  loadAppointments();
    if (id === 'p-rx')            loadPrescriptions();
    if (id === 'p-orders')        loadOrders();
    if (id === 'p-notif')         loadNotifications();
  };

  // ── Auto-load overview when portal page opens ──
  var _origShowPage = window.showPage;
  window.showPage = function (p) {
    if (typeof _origShowPage === 'function') _origShowPage(p);
    if (p === 'portal') {
      updateSidebar();
      loadOverview();
    }
  };

  // ── Sidebar: show real user name ──
  function updateSidebar() {
    var user = A.getUser();
    if (!user) return;
    var name = user.nickname || user.full_name || user.name || user.email;
    // Update sidebar name
    var sidebar = document.querySelector('.portal-sidebar');
    if (sidebar) {
      var nameEl = sidebar.querySelector('div[style*="font-size:1rem"]');
      if (nameEl) nameEl.textContent = name;
      var memberEl = sidebar.querySelector('div[style*="font-size:.62rem"]');
      if (memberEl) memberEl.textContent = 'Member since ' + new Date(user.created_at || Date.now()).getFullYear();
      // Update avatar initial
      var avatarEl = sidebar.querySelector('div[style*="border-radius:50%"]');
      if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
    }
  }

  // ── Overview Panel ──
  async function loadOverview() {
    var el = document.getElementById('p-overview');
    if (!el || !A.getToken()) return;
    try {
      var user = A.getUser();
      var name = user ? (user.nickname || user.full_name || user.name || user.email) : 'User';

      // Fetch real data in parallel
      var [appts, rxs, diags] = await Promise.allSettled([
        A.patient.listAppointments(),
        A.patient.listPrescriptions(),
        A.patient.listDiagnoses()
      ]);

      var apptData = appts.status === 'fulfilled' ? (appts.value.data || []) : [];
      var rxData = rxs.status === 'fulfilled' ? (rxs.value.data || []) : [];
      var diagData = diags.status === 'fulfilled' ? (diags.value.data || []) : [];

      var activeRx = rxData.filter(function (r) { return r.status === 'issued'; }).length;
      var nextAppt = apptData.find(function (a) { return a.status === 'confirmed' || a.status === 'pending_payment'; });

      el.innerHTML = ''
        + '<h3>Welcome back, ' + name + '</h3>'
        + '<div class="sub-label">歡迎回來 · Your health at a glance</div>'
        + '<div class="stats-row">'
        + '  <div class="stat-card"><div class="stat-card-num">' + apptData.length + '</div><div class="stat-card-label">Consultations · 問診次數</div></div>'
        + '  <div class="stat-card"><div class="stat-card-num">' + diagData.length + '</div><div class="stat-card-label">Tongue Scans · 舌診記錄</div></div>'
        + '  <div class="stat-card"><div class="stat-card-num">' + activeRx + '</div><div class="stat-card-label">Active Rx · 有效處方</div></div>'
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">'
        + '  <div>'
        + '    <div style="font-family:\'Source Sans 3\',\'Noto Serif SC\',sans-serif;font-size:.68rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:.8rem;">Next Appointment · 下次預約</div>'
        + (nextAppt
          ? '<div style="background:var(--washi);border:1px solid var(--mist);padding:1.1rem 1.3rem;border-left:3px solid var(--gold);">'
            + '<div style="font-family:\'Noto Serif SC\',serif;font-size:1rem;color:var(--ink);margin-bottom:.2rem;">Doctor #' + nextAppt.doctor_id + '</div>'
            + '<div style="font-family:\'Source Sans 3\',sans-serif;font-size:.72rem;color:var(--gold);margin-top:.5rem;">' + formatDate(nextAppt.scheduled_start) + '</div>'
            + '</div>'
          : '<div style="background:var(--washi);border:1px solid var(--mist);padding:1.1rem 1.3rem;color:var(--stone);font-size:.85rem;">No upcoming appointments · 暫無預約</div>'
        )
        + '  </div>'
        + '  <div>'
        + '    <div style="font-family:\'Source Sans 3\',\'Noto Serif SC\',sans-serif;font-size:.68rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:.8rem;">Latest Tongue Scan · 最近舌診</div>'
        + (diagData.length
          ? '<div style="background:var(--washi);border:1px solid var(--mist);padding:1.1rem 1.3rem;border-left:3px solid var(--sage);">'
            + '<div style="font-family:\'Noto Serif SC\',serif;font-size:1rem;color:var(--ink);margin-bottom:.2rem;">' + (diagData[0].tongue_color || 'Analysis') + '</div>'
            + '<div style="font-family:\'Source Sans 3\',sans-serif;font-size:.68rem;color:var(--stone);">Score: ' + (diagData[0].health_score || '—') + '/100</div>'
            + '<div style="font-family:\'Source Sans 3\',sans-serif;font-size:.72rem;color:var(--sage);margin-top:.5rem;">' + formatDate(diagData[0].created_at) + '</div>'
            + '</div>'
          : '<div style="background:var(--washi);border:1px solid var(--mist);padding:1.1rem 1.3rem;color:var(--stone);font-size:.85rem;">No scans yet · 暫無記錄</div>'
        )
        + '  </div>'
        + '</div>';
    } catch (e) { console.error('loadOverview', e); }
  }

  // ── Profile Panel ──
  async function loadProfile() {
    var user = A.getUser();
    if (!user || !A.getToken()) return;
    try {
      var res = await A.patient.getProfile();
      var profile = res.user || res;
      var p = profile.patient_profile || {};
      // Fill form fields
      setVal('p-profile', 'Full Name', p.nickname || profile.email);
      setVal('p-profile', 'Email', profile.email);
      setVal('p-profile', 'Phone', p.phone || '');
      setVal('p-profile', 'Date of Birth', p.birth_date || '');
    } catch (e) { console.error('loadProfile', e); }
  }

  function setVal(panelId, labelText, value) {
    var panel = document.getElementById(panelId);
    if (!panel) return;
    var labels = panel.querySelectorAll('label');
    for (var i = 0; i < labels.length; i++) {
      if (labels[i].textContent.indexOf(labelText) >= 0) {
        var input = labels[i].parentElement.querySelector('input, select');
        if (input) input.value = value;
        break;
      }
    }
  }

  // ── Tongue History ──
  async function loadTongueHistory() {
    var el = document.getElementById('p-tongue');
    if (!el || !A.getToken()) return;
    try {
      var res = await A.patient.listDiagnoses();
      var items = res.data || [];
      var header = '<h3>Tongue Diagnosis History</h3>'
        + '<div class="sub-label">舌診歷史記錄 · Compare your tongue scans over time</div>'
        + '<div style="display:flex;gap:.8rem;margin-bottom:1.5rem;flex-wrap:wrap;">'
        + '  <button class="btn-primary" onclick="showPage(\'ai\')">New Tongue Scan · 新舌診 →</button>'
        + '</div>';

      if (!items.length) {
        el.innerHTML = header + emptyState('No tongue scans yet · 暫無舌診記錄<br><br>Go to AI Diagnosis to take your first scan!');
        return;
      }
      el.innerHTML = header + items.map(function (d) {
        var report = d.constitution_report || {};
        var constitution = report.constitution || {};
        return '<div class="tongue-history-item">'
          + '<div class="thi-thumb">👅</div>'
          + '<div>'
          + '  <div class="thi-date">' + formatDate(d.created_at) + '</div>'
          + '  <div class="thi-result">' + (d.tongue_color || '—').replace(/_/g, ' ')
          + ', ' + (d.coating || '—').replace(/_/g, ' ')
          + ' — <strong>' + (constitution.name_en || d.status) + '</strong>'
          + ' · Score: ' + (d.health_score || '—') + '/100</div>'
          + '</div></div>';
      }).join('');
    } catch (e) { console.error('loadTongueHistory', e); }
  }

  // ── Appointments ──
  async function loadAppointments() {
    var el = document.getElementById('p-appointments');
    if (!el || !A.getToken()) return;
    try {
      var res = await A.patient.listAppointments();
      var items = res.data || [];
      var header = '<h3>Appointment History</h3>'
        + '<div class="sub-label">預約記錄 · Your past and upcoming consultations</div>'
        + '<button class="btn-primary" style="margin-bottom:1.5rem;" onclick="showPage(\'booking\')">Book New Appointment · 新預約 →</button>';

      if (!items.length) {
        el.innerHTML = header + emptyState('No appointments yet · 暫無預約<br><br>Book your first consultation!');
        return;
      }

      var upcoming = items.filter(function (a) { return ['confirmed','pending_payment','in_progress'].indexOf(a.status) >= 0; });
      var past = items.filter(function (a) { return ['completed','cancelled','no_show'].indexOf(a.status) >= 0; });

      var html = header;
      if (upcoming.length) {
        html += '<div style="font-family:\'Source Sans 3\',sans-serif;font-size:.68rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:.8rem;">Upcoming · 即將到來</div>';
        html += upcoming.map(function (a) {
          return '<div class="health-record-card"><div class="hrc-icon">📅</div><div>'
            + '<div class="hrc-title">Doctor #' + a.doctor_id + ' — ' + a.status + '</div>'
            + '<div class="hrc-val">' + formatDate(a.scheduled_start) + ' · RM ' + parseFloat(a.fee).toFixed(0) + '</div>'
            + '</div>'
            + (a.status !== 'completed' ? '<button class="hrc-edit" onclick="cancelAppt(' + a.id + ')">Cancel</button>' : '')
            + '</div>';
        }).join('');
      }
      if (past.length) {
        html += '<div style="font-family:\'Source Sans 3\',sans-serif;font-size:.68rem;letter-spacing:.18em;text-transform:uppercase;color:var(--stone);margin:1.3rem 0 .8rem;">Past · 過去記錄</div>';
        html += past.map(function (a) {
          return '<div class="health-record-card" style="opacity:.75;"><div class="hrc-icon">✅</div><div>'
            + '<div class="hrc-title">Doctor #' + a.doctor_id + '</div>'
            + '<div class="hrc-val">' + formatDate(a.scheduled_start) + ' · ' + a.status + '</div>'
            + '</div></div>';
        }).join('');
      }
      el.innerHTML = html;
    } catch (e) { console.error('loadAppointments', e); }
  }

  window.cancelAppt = async function (id) {
    try {
      await A.patient.cancelAppointment(id);
      showToast('Appointment cancelled · 預約已取消');
      loadAppointments();
    } catch (e) { showToast(e.message || 'Failed to cancel'); }
  };

  // ── Prescriptions ──
  async function loadPrescriptions() {
    var el = document.getElementById('p-rx');
    if (!el || !A.getToken()) return;
    try {
      var res = await A.patient.listPrescriptions();
      var items = res.data || [];
      var header = '<h3>Electronic Prescriptions</h3>'
        + '<div class="sub-label">電子處方 · View your prescribed medicines</div>';

      if (!items.length) {
        el.innerHTML = header + emptyState('No prescriptions yet · 暫無處方<br><br>Prescriptions will appear here after your doctor consultation.');
        return;
      }
      el.innerHTML = header + items.map(function (rx) {
        var itemNames = (rx.items || []).map(function (i) { return i.drug_name + ' ' + i.quantity + i.unit; }).join(', ');
        var statusClass = rx.status === 'issued' ? 'active' : 'pending';
        return '<div class="rx-card"><div class="rx-icon">🌾</div><div style="flex:1;">'
          + '<div class="rx-name">' + (rx.diagnosis || 'Prescription #' + rx.id) + '</div>'
          + '<div class="rx-detail">' + formatDate(rx.created_at)
          + (rx.duration_days ? ' · ' + rx.duration_days + ' days course' : '')
          + '<br>' + itemNames + '</div>'
          + '</div><span class="rx-status ' + statusClass + '">' + rx.status + '</span></div>';
      }).join('');
    } catch (e) { console.error('loadPrescriptions', e); }
  }

  // ── Orders ──
  async function loadOrders() {
    var el = document.getElementById('p-orders');
    if (!el || !A.getToken()) return;
    try {
      var res = await A.patient.listOrders();
      var items = res.data || [];
      var header = '<h3>Order Management</h3>'
        + '<div class="sub-label">訂單管理 · Track your medicine deliveries</div>';

      if (!items.length) {
        el.innerHTML = header + emptyState('No orders yet · 暫無訂單<br><br>Orders will appear here after you purchase prescribed medicines.');
        return;
      }
      el.innerHTML = header + items.map(function (o) {
        return '<div class="health-record-card"><div class="hrc-icon">📦</div><div>'
          + '<div class="hrc-title">' + o.order_no + '</div>'
          + '<div class="hrc-val">' + formatDate(o.created_at) + ' · RM ' + parseFloat(o.total).toFixed(2) + ' · ' + o.status.replace(/_/g, ' ') + '</div>'
          + '</div></div>';
      }).join('');
    } catch (e) { console.error('loadOrders', e); }
  }

  // ── Notifications ──
  async function loadNotifications() {
    var el = document.getElementById('p-notif');
    if (!el || !A.getToken()) return;
    try {
      var res = await A.notification.list();
      var items = res.data || [];
      var header = '<h3>Notifications</h3>'
        + '<div class="sub-label">通知中心 · Stay updated on your health journey</div>'
        + '<button class="btn-outline" style="margin-bottom:1rem;" onclick="markAllNotifRead()">Mark All Read · 全部已讀</button>';

      if (!items.length) {
        el.innerHTML = header + emptyState('No notifications yet · 暫無通知<br><br>You\'ll receive updates about appointments, prescriptions, and orders here.');
        return;
      }
      el.innerHTML = header + items.map(function (n) {
        var isUnread = !n.read_at;
        return '<div class="notif-item' + (isUnread ? ' unread' : '') + '" onclick="markNotifRead(' + n.id + ')">'
          + '<div class="notif-dot' + (isUnread ? '' : ' read') + '"></div>'
          + '<div><div class="notif-title">' + n.title + '</div>'
          + '<div class="notif-time">' + (n.body || '') + ' · ' + formatDate(n.created_at) + '</div>'
          + '</div></div>';
      }).join('');
    } catch (e) { console.error('loadNotifications', e); }
  }

  window.markNotifRead = async function (id) {
    try { await A.notification.markRead(id); loadNotifications(); } catch {}
  };
  window.markAllNotifRead = async function () {
    try { await A.notification.markAllRead(); loadNotifications(); showToast('All read · 全部已讀'); } catch {}
  };

  // ── Utility ──
  function formatDate(str) {
    if (!str) return '—';
    var d = new Date(str);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  console.log('[HansMed] Portal wire loaded');
})();
