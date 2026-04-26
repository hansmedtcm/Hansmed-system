/**
 * Patient Overview (dashboard)
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  async function render(el) {
    HM.state.loading(el);
    try {
      var results = await Promise.allSettled([
        HM.api.patient.listAppointments(),
        HM.api.patient.listPrescriptions(),
        HM.api.patient.listDiagnoses(),
        HM.api.patient.listOrders(),
      ]);
      var appts = results[0].status === 'fulfilled' ? (results[0].value.data || []) : [];
      var rxs   = results[1].status === 'fulfilled' ? (results[1].value.data || []) : [];
      var diags = results[2].status === 'fulfilled' ? (results[2].value.data || []) : [];
      var orders= results[3].status === 'fulfilled' ? (results[3].value.data || []) : [];

      var upcoming = appts.filter(function (a) {
        return ['confirmed','pending_payment','in_progress'].indexOf(a.status) >= 0;
      }).sort(function (a, b) { return new Date(a.scheduled_start) - new Date(b.scheduled_start); });
      var next = upcoming[0];

      var active = rxs.filter(function (r) { return r.status === 'issued'; }).length;
      var user = HM.auth.user();
      var name = HM.auth.displayName(user).split(' ')[0];

      el.innerHTML = '' +
        '<div class="page-header">' +
        '  <div class="page-header-label">Patient Portal · 患者端</div>' +
        '  <h1 class="page-title">Welcome back, ' + HM.format.esc(name) + '</h1>' +
        '  <p class="page-subtitle">Here\'s your health at a glance</p>' +
        '</div>' +

        '<div class="stats-grid mb-6">' +
        stat(appts.length, 'Consultations · 問診') +
        stat(diags.length, 'Tongue Scans · 舌診') +
        stat(active, 'Active Rx · 有效處方') +
        stat(orders.length, 'Orders · 訂單') +
        '</div>' +

        '<div class="grid-auto mb-6" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">' +
        nextApptCard(next) +
        latestTongueCard(diags[0]) +
        '</div>' +

        quickActions();
    } catch (e) {
      HM.state.error(el, e);
    }
  }

  function stat(num, label) {
    return '<div class="stat-card"><div class="stat-number">' + num + '</div><div class="stat-label">' + label + '</div></div>';
  }

  function nextApptCard(a) {
    var html = '<div>' +
      '<div class="text-label mb-3">Next Appointment · 下次預約</div>';
    if (!a) {
      html += '<div class="card" style="padding: var(--s-5);">' +
        '<p class="text-muted text-sm">No upcoming appointments</p>' +
        '<p class="text-muted text-sm" style="font-family: var(--font-zh);">暫無預約</p>' +
        '<button class="btn btn--outline btn--sm mt-4" onclick="location.hash=\'#/book\'">Book Consultation · 預約 →</button>' +
        '</div>';
    } else {
      html += '<div class="card card--bordered" style="padding: var(--s-5);">' +
        '<div class="text-label text-gold">' + HM.format.datetime(a.scheduled_start) + '</div>' +
        '<div class="card-title mt-1">Doctor #' + a.doctor_id + '</div>' +
        '<div class="text-sm text-muted mt-1">' + HM.format.status(a.status) + ' · ' + HM.format.money(a.fee) + '</div>' +
        '<button class="btn btn--outline btn--sm mt-4" onclick="location.hash=\'#/appointments/' + a.id + '\'">View Details · 查看</button>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function latestTongueCard(d) {
    var html = '<div>' +
      '<div class="text-label mb-3">Latest Tongue Scan · 最近舌診</div>';
    if (!d) {
      html += '<div class="card" style="padding: var(--s-5);">' +
        '<p class="text-muted text-sm">No tongue scans yet</p>' +
        '<p class="text-muted text-sm" style="font-family: var(--font-zh);">暫無記錄</p>' +
        '<button class="btn btn--outline btn--sm mt-4" onclick="location.hash=\'#/wellness-assessment\'">Start AI Wellness Assessment · 開始 AI 健康評估 →</button>' +
        '</div>';
    } else {
      var c = (d.constitution_report && d.constitution_report.constitution) || {};
      html += '<div class="card card--bordered" style="padding: var(--s-5); border-left-color: var(--sage);">' +
        '<div class="text-label text-gold">' + HM.format.date(d.created_at) + '</div>' +
        '<div class="card-title mt-1">' + HM.format.esc(c.name_en || 'Analysis complete') + '</div>' +
        (c.name_zh ? '<div class="text-sm text-muted" style="font-family: var(--font-zh);">' + c.name_zh + '</div>' : '') +
        '<div class="text-sm mt-2">Score: <strong>' + (d.health_score || '—') + '</strong>/100</div>' +
        '<button class="btn btn--outline btn--sm mt-4" onclick="location.hash=\'#/tongue/' + d.id + '\'">View Details · 詳情</button>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function quickActions() {
    return '<div>' +
      '<div class="text-label mb-3">Quick Actions · 快捷操作</div>' +
      '<div class="grid-auto" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">' +
      actionCard('📅', 'Book Appointment', '預約', '#/book') +
      actionCard('🧭', 'AI Wellness Assessment', '健康評估', '#/wellness-assessment') +
      actionCard('🛍️', 'Shop', '商店', '#/shop') +
      actionCard('💊', 'Prescriptions', '處方', '#/prescriptions') +
      '</div>' +
      '</div>';
  }

  function actionCard(icon, title, titleZh, href) {
    return '<div class="card card--clickable text-center" onclick="location.hash=\'' + href + '\'" style="padding: var(--s-5);">' +
      '<div style="font-size: 2rem; margin-bottom: var(--s-2);">' + icon + '</div>' +
      '<div style="font-family: var(--font-display); color: var(--ink);">' + title + '</div>' +
      '<div class="text-sm text-muted" style="font-family: var(--font-zh);">' + titleZh + '</div>' +
      '</div>';
  }

  HM.patientPanels.overview = { render: render };
})();
