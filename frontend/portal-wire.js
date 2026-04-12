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
    var el = document.getElementById('p-profile');
    if (!el || !A.getToken()) return;
    try {
      var res = await A.patient.getProfile();
      var user = res.user || res;
      var p = user.patient_profile || {};
      var locked = p.registration_completed;
      _profileLocked = locked;

      el.innerHTML = ''
        + '<h3>Personal Profile</h3>'
        + '<div class="sub-label">個人資料管理 · Manage your information</div>'
        + (locked ? '<div style="background:var(--washi-dark);border-left:3px solid var(--gold);padding:.8rem 1rem;margin-bottom:1rem;font-size:.85rem;color:var(--stone);">🔒 Profile is locked. Contact admin to request changes. · 資料已鎖定，如需修改請聯絡管理員。</div>' : '')
        // Section 1: Basic Info
        + sectionLabel('Basic Information · 基本資料')
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.3rem;margin-bottom:1.5rem;">'
        + profileField('pp-fullname', 'Full Name · 姓名', p.full_name || p.nickname || '', 'text')
        + profileField('pp-nickname', 'Nickname · 暱稱', p.nickname || '', 'text')
        + profileField('pp-email', 'Email · 電郵', user.email || '', 'email', true)
        + profileField('pp-phone', 'Phone · 電話', p.phone || '', 'tel')
        + profileField('pp-ic', 'IC / ID Number · 身份證號碼', p.ic_number || '', 'text')
        + profileField('pp-dob', 'Date of Birth · 出生日期', p.birth_date ? p.birth_date.substring(0,10) : '', 'date')
        + profileSelect('pp-gender', 'Gender · 性別', p.gender || '', [
            {v:'',l:'Select · 請選擇'},{v:'male',l:'Male · 男'},{v:'female',l:'Female · 女'},{v:'other',l:'Other · 其他'}
          ])
        + profileField('pp-occupation', 'Occupation · 職業', p.occupation || '', 'text')
        + '</div>'
        // Section 2: Address
        + sectionLabel('Address · 地址')
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.3rem;margin-bottom:1.5rem;">'
        + profileField('pp-addr1', 'Address Line 1 · 地址', p.address_line1 || '', 'text')
        + profileField('pp-addr2', 'Address Line 2 · 地址2', p.address_line2 || '', 'text')
        + profileField('pp-city', 'City · 城市', p.city || '', 'text')
        + profileField('pp-state', 'State · 州', p.state || '', 'text')
        + profileField('pp-postal', 'Postal Code · 郵遞區號', p.postal_code || '', 'text')
        + profileField('pp-country', 'Country · 國家', p.country || '', 'text')
        + '</div>'
        // Section 3: Emergency Contact
        + sectionLabel('Emergency Contact · 緊急聯絡人')
        + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1.3rem;margin-bottom:1.5rem;">'
        + profileField('pp-emname', 'Name · 姓名', p.emergency_contact_name || '', 'text')
        + profileField('pp-emphone', 'Phone · 電話', p.emergency_contact_phone || '', 'tel')
        + profileField('pp-emrel', 'Relationship · 關係', p.emergency_contact_relation || '', 'text')
        + '</div>'
        // Section 4: Medical
        + sectionLabel('Medical Information · 醫療資訊')
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.3rem;margin-bottom:1.5rem;">'
        + profileSelect('pp-blood', 'Blood Type · 血型', p.blood_type || '', [
            {v:'',l:'Select · 請選擇'},{v:'A+',l:'A+'},{v:'A-',l:'A-'},{v:'B+',l:'B+'},{v:'B-',l:'B-'},
            {v:'AB+',l:'AB+'},{v:'AB-',l:'AB-'},{v:'O+',l:'O+'},{v:'O-',l:'O-'},{v:'unknown',l:'Unknown · 不明'}
          ])
        + profileField('pp-height', 'Height (cm) · 身高', p.height_cm || '', 'number')
        + profileField('pp-weight', 'Weight (kg) · 體重', p.weight_kg || '', 'number')
        + '</div>'
        + profileArea('pp-allergies', 'Allergies · 過敏史', p.allergies || '', 'e.g. Penicillin, shellfish, pollen · 青黴素、海鮮、花粉')
        + profileArea('pp-medhist', 'Medical History · 病史', p.medical_history || '', 'e.g. Diabetes (2020), mild anaemia (2022) · 糖尿病、貧血')
        + profileArea('pp-meds', 'Current Medications · 現用藥物', p.current_medications || '', 'e.g. Vitamin D 1000IU daily · 每日維他命D')
        + profileArea('pp-famhist', 'Family History · 家族病史', p.family_history || '', 'e.g. Mother: hypertension, Father: diabetes · 母親高血壓')
        + '<div style="margin-top:1.5rem;">'
        + (locked ? '' : '  <button class="btn-primary" onclick="saveProfile()">Save Changes · 儲存變更</button>')
        + '</div>';
    } catch (e) { console.error('loadProfile', e); }
  }

  function sectionLabel(text) {
    return '<div style="font-family:\'Source Sans 3\',sans-serif;font-size:.68rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin:1.5rem 0 .8rem;border-bottom:1px solid var(--mist);padding-bottom:.4rem;">' + text + '</div>';
  }

  var _profileLocked = false;

  function profileField(id, label, value, type, disabled) {
    var dis = disabled || _profileLocked;
    return '<div><label style="display:block;font-family:\'Source Sans 3\',sans-serif;font-size:.68rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:.4rem;">' + label + '</label>'
      + '<input id="' + id + '" type="' + type + '" style="width:100%;background:' + (dis ? 'var(--washi-dark)' : 'transparent') + ';border:none;border-bottom:1.5px solid var(--mist);padding:.6rem 0;color:var(--ink);font-family:\'Cormorant Garamond\',serif;font-size:1.05rem;outline:none;" value="' + escHtml(value) + '"' + (dis ? ' disabled' : '') + '></div>';
  }

  function profileSelect(id, label, value, options) {
    var html = '<div><label style="display:block;font-family:\'Source Sans 3\',sans-serif;font-size:.68rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:.4rem;">' + label + '</label>'
      + '<select id="' + id + '" style="width:100%;background:' + (_profileLocked ? 'var(--washi-dark)' : 'transparent') + ';border:none;border-bottom:1.5px solid var(--mist);padding:.6rem 0;color:var(--ink);font-family:\'Cormorant Garamond\',serif;font-size:1.05rem;outline:none;"' + (_profileLocked ? ' disabled' : '') + '>';
    options.forEach(function (o) {
      html += '<option value="' + o.v + '"' + (o.v === value ? ' selected' : '') + '>' + o.l + '</option>';
    });
    return html + '</select></div>';
  }

  function profileArea(id, label, value, placeholder) {
    return '<div style="margin-bottom:1rem;"><label style="display:block;font-family:\'Source Sans 3\',sans-serif;font-size:.68rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:.4rem;">' + label + '</label>'
      + '<textarea id="' + id + '" rows="2" placeholder="' + placeholder + '" style="width:100%;background:' + (_profileLocked ? 'var(--washi-dark)' : 'transparent') + ';border:1px solid var(--mist);padding:.6rem;color:var(--ink);font-family:\'Source Sans 3\',sans-serif;font-size:.9rem;outline:none;resize:vertical;"' + (_profileLocked ? ' disabled' : '') + '>' + escHtml(value) + '</textarea></div>';
  }

  function escHtml(s) { return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  window.saveProfile = async function () {
    var data = {
      full_name:       gv('pp-fullname'),
      nickname:        gv('pp-nickname'),
      phone:           gv('pp-phone'),
      ic_number:       gv('pp-ic'),
      birth_date:      gv('pp-dob'),
      gender:          gv('pp-gender'),
      occupation:      gv('pp-occupation'),
      address_line1:   gv('pp-addr1'),
      address_line2:   gv('pp-addr2'),
      city:            gv('pp-city'),
      state:           gv('pp-state'),
      postal_code:     gv('pp-postal'),
      country:         gv('pp-country'),
      emergency_contact_name:     gv('pp-emname'),
      emergency_contact_phone:    gv('pp-emphone'),
      emergency_contact_relation: gv('pp-emrel'),
      blood_type:          gv('pp-blood'),
      height_cm:           gv('pp-height') || null,
      weight_kg:           gv('pp-weight') || null,
      allergies:           gv('pp-allergies'),
      medical_history:     gv('pp-medhist'),
      current_medications: gv('pp-meds'),
      family_history:      gv('pp-famhist'),
    };
    try {
      await A.patient.updateProfile(data);
      showToast('Profile saved! · 資料已儲存 ✓');
    } catch (e) {
      showToast(e.message || 'Failed to save · 儲存失敗');
    }
  };

  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }

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
