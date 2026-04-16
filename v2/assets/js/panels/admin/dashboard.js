/**
 * Admin Dashboard — clinic live status + queue snapshot
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  var refreshTimer = null;

  async function render(el) {
    HM.state.loading(el);
    try {
      el.innerHTML = '<div class="page-header flex-between">' +
        '<div><div class="page-header-label">Dashboard · 儀表板</div>' +
        '<h1 class="page-title">Clinic Live Status</h1>' +
        '<p class="text-muted text-sm mt-1">Real-time view of today\'s patient flow. Auto-refreshes every 30 seconds. ' +
        '<span style="font-family: var(--font-zh);">即時診所狀態，每 30 秒自動更新。</span></p>' +
        '</div>' +
        '<button class="btn btn--ghost btn--sm" id="dash-refresh">↻ Refresh now</button>' +
        '</div>' +

        '<div id="dash-live"></div>' +
        '<div id="dash-overview" class="mt-6"></div>';

      document.getElementById('dash-refresh').addEventListener('click', loadAll);
      await loadAll();

      // Auto refresh while the dashboard is open
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = setInterval(function () {
        if (document.getElementById('dash-live')) loadAll();
        else { clearInterval(refreshTimer); refreshTimer = null; }
      }, 30000);
    } catch (e) { HM.state.error(el, e); }
  }

  async function loadAll() {
    var todayStr = todayISO();
    try {
      var results = await Promise.allSettled([
        HM.api.admin.dashboard(),
        HM.api.admin.pendingDoctors(),
        HM.api.admin.pendingPharmacies(),
        HM.api.admin.pendingWithdrawals(),
        HM.api.admin.listAppointments('date=' + todayStr),
      ]);
      var d              = results[0].status === 'fulfilled' ? results[0].value : {};
      var pendingDocs    = results[1].status === 'fulfilled' ? (results[1].value.data || []) : [];
      var pendingPharms  = results[2].status === 'fulfilled' ? (results[2].value.data || []) : [];
      var pendingWds     = results[3].status === 'fulfilled' ? (results[3].value.data || []) : [];
      var todayAppts     = results[4].status === 'fulfilled' ? (results[4].value.data || []) : [];

      renderLive(todayAppts);
      renderOverview(d, pendingDocs, pendingPharms, pendingWds);
    } catch (e) {
      HM.state.error(document.getElementById('dash-live'), e);
    }
  }

  function renderLive(todayAppts) {
    var host = document.getElementById('dash-live');
    if (!host) return;

    // Bucket today's appointments
    var awaiting = []; // confirmed but not started yet
    var consulting = []; // in_progress
    var completed = []; // completed today
    var cancelled = []; // cancelled today

    todayAppts.forEach(function (a) {
      if (a.status === 'in_progress') consulting.push(a);
      else if (a.status === 'completed') completed.push(a);
      else if (a.status === 'cancelled' || a.status === 'no_show') cancelled.push(a);
      else awaiting.push(a); // confirmed / pending_payment / paid / etc.
    });

    var walkInToday   = todayAppts.filter(function (a) { return a.visit_type === 'walk_in'; }).length;
    var onlineToday   = todayAppts.length - walkInToday;

    host.innerHTML = '<div class="text-label mb-3" style="color: var(--gold);">📍 Today · ' + new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }) + '</div>' +

      // Live status — 4 prominent counters
      '<div class="dash-live-grid mb-4">' +
      liveCard('⏳', awaiting.length, 'Awaiting · 候診', 'var(--gold)') +
      liveCard('🩺', consulting.length, 'In Consultation · 問診中', '#4a90d9') +
      liveCard('✓', completed.length, 'Completed · 已完成', 'var(--sage)') +
      liveCard('✕', cancelled.length, 'Cancelled · 取消', 'var(--red-seal)') +
      '</div>' +

      // Today summary mini-row
      '<div class="card mb-4" style="padding: var(--s-3) var(--s-4);">' +
      '<div class="flex-between flex-wrap" style="gap: var(--s-3); align-items: center;">' +
      '<span class="text-sm"><strong>' + todayAppts.length + '</strong> appointment' + (todayAppts.length === 1 ? '' : 's') + ' total today</span>' +
      '<span class="text-sm text-muted">🏥 ' + walkInToday + ' walk-in · 📹 ' + onlineToday + ' online</span>' +
      '<button class="btn btn--outline btn--sm" onclick="location.hash=\'#/appointments\'">View all → 查看全部</button>' +
      '</div></div>';

    // Queue list — show awaiting + consulting in detail, since those are the ones admin acts on
    var liveItems = awaiting.concat(consulting).sort(function (a, b) {
      return (new Date(a.scheduled_start)) - (new Date(b.scheduled_start));
    });
    if (liveItems.length) {
      host.innerHTML += '<div class="text-label mb-2">Live queue · 即時候診名單</div>' +
        '<div class="card" style="padding: 0;">' +
        '<div class="table-wrap"><table class="table table--responsive">' +
        '<thead><tr><th>Time</th><th>Patient</th><th>Doctor</th><th>Visit</th><th>Status</th></tr></thead>' +
        '<tbody>' +
        liveItems.map(function (a) {
          var visitLbl = (a.visit_type === 'walk_in')
            ? '<span class="badge" style="background:rgba(184,150,90,.15);color:var(--gold);font-size:10px;">🏥 Walk-in</span>'
            : '<span class="badge" style="background:rgba(74,144,217,.15);color:#4a90d9;font-size:10px;">📹 Online</span>';
          return '<tr>' +
            '<td data-label="Time"><strong>' + HM.format.time(a.scheduled_start) + '</strong></td>' +
            '<td data-label="Patient">#' + a.patient_id + (a.concern_label ? ' · ' + HM.format.esc(a.concern_label) : '') + '</td>' +
            '<td data-label="Doctor">' + (a.doctor_id ? '#' + a.doctor_id : '<span class="text-muted">— pool</span>') + '</td>' +
            '<td data-label="Visit">' + visitLbl + '</td>' +
            '<td data-label="Status">' + HM.format.statusBadge(a.status) + '</td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>' +
        '</div>';
    }
  }

  function renderOverview(d, pendingDocs, pendingPharms, pendingWds) {
    var host = document.getElementById('dash-overview');
    if (!host) return;
    var u = d.users || {};
    var a = d.appointments || {};
    var o = d.orders || {};

    host.innerHTML = '<div class="text-label mb-3">Platform Overview · 平台總覽</div>' +
      '<div class="stats-grid mb-6">' +
      stat(u.patients || 0, 'Patients · 患者') +
      stat(u.doctors || 0, 'Doctors · 醫師') +
      stat(u.pharmacies || 0, 'Pharmacies · 藥房') +
      stat(a.total || 0, 'Total Appts · 累計預約') +
      '</div>' +

      '<div class="grid-2 mb-6">' +
      '<div><div class="text-label mb-3">System Status · 系統狀態</div>' +
      '<div class="card">' +
      statusRow('Total Appointments', a.total || 0) +
      statusRow('Completed All-Time', a.completed || 0) +
      statusRow('Total Orders', o.total || 0) +
      statusRow('Paid Orders', o.paid || 0) +
      statusRow('Order Revenue', HM.format.money(o.revenue || 0)) +
      statusRow('Payments Last 30 Days', HM.format.money(d.payments_last_30d || 0)) +
      '</div></div>' +
      '<div><div class="text-label mb-3">Pending Actions · 待處理</div>' +
      '<div class="card">' +
      pendingRow('Doctor Verifications · 醫師審核', pendingDocs.length, '#/verifications') +
      pendingRow('Pharmacy Verifications · 藥房審核', pendingPharms.length, '#/verifications') +
      pendingRow('Withdrawal Requests · 提現申請', pendingWds.length, '#/withdrawals') +
      '</div></div>' +
      '</div>' +

      '<div class="text-label mb-3">Quick Actions · 快捷操作</div>' +
      '<div class="grid-auto" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">' +
      action('+ Create Account · 新增帳號', '#/accounts') +
      action('📦 View Orders · 查看訂單', '#/orders') +
      action('📊 Finance · 財務', '#/finance') +
      action('📜 Audit Log · 日誌', '#/audit') +
      '</div>';
  }

  // ── Helpers ───────────────────────────────────────────────
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function liveCard(icon, count, label, color) {
    return '<div class="dash-live-card" style="border-left: 4px solid ' + color + ';">' +
      '<div class="dash-live-icon" style="color: ' + color + ';">' + icon + '</div>' +
      '<div class="dash-live-count" style="color: ' + color + ';">' + count + '</div>' +
      '<div class="dash-live-label">' + label + '</div>' +
      '</div>';
  }

  function stat(num, label) {
    return '<div class="stat-card"><div class="stat-number">' + num + '</div><div class="stat-label">' + label + '</div></div>';
  }
  function statusRow(label, value) {
    return '<div class="flex-between mb-2" style="padding: var(--s-2) 0; border-bottom: 1px solid var(--border); font-size: var(--text-sm);">' +
      '<span class="text-muted">' + label + '</span><strong>' + value + '</strong></div>';
  }
  function pendingRow(label, count, href) {
    return '<div class="flex-between mb-2" style="padding: var(--s-2) 0; border-bottom: 1px solid var(--border);">' +
      '<span class="text-muted">' + label + '</span>' +
      (count > 0
        ? '<button class="btn btn--outline btn--sm" onclick="location.hash=\'' + href + '\'">' + count + ' pending</button>'
        : '<span class="text-success">✓ All clear</span>') +
      '</div>';
  }
  function action(label, href) {
    return '<button class="card card--clickable" onclick="location.hash=\'' + href + '\'" style="text-align:center; padding: var(--s-4);">' +
      '<div style="font-size: var(--text-sm); font-weight: 500;">' + label + '</div></button>';
  }

  // Inject minimal CSS for live cards (once)
  function injectCss() {
    if (document.getElementById('dash-style')) return;
    var s = document.createElement('style');
    s.id = 'dash-style';
    s.textContent =
      '.dash-live-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--s-3);}' +
      '@media (max-width:768px){.dash-live-grid{grid-template-columns:repeat(2,1fr);}}' +
      '.dash-live-card{background:#fff;border:1px solid var(--border);border-radius:var(--r-md);padding:var(--s-4);text-align:center;transition:transform .15s ease;}' +
      '.dash-live-card:hover{transform:translateY(-2px);}' +
      '.dash-live-icon{font-size:1.6rem;margin-bottom:6px;line-height:1;}' +
      '.dash-live-count{font-family:var(--font-display);font-size:2.4rem;font-weight:500;line-height:1;margin-bottom:4px;}' +
      '.dash-live-label{font-size:11px;color:var(--stone);letter-spacing:.05em;}';
    document.head.appendChild(s);
  }
  injectCss();

  HM.adminPanels.dashboard = { render: render };
})();
