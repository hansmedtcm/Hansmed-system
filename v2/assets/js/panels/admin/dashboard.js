/**
 * Admin Dashboard
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  async function render(el) {
    HM.state.loading(el);
    try {
      var r = await Promise.allSettled([
        HM.api.admin.dashboard(),
        HM.api.admin.pendingDoctors(),
        HM.api.admin.pendingPharmacies(),
        HM.api.admin.pendingWithdrawals(),
      ]);
      var d = r[0].status === 'fulfilled' ? r[0].value : {};
      var pendingDocs = r[1].status === 'fulfilled' ? (r[1].value.data || []) : [];
      var pendingPharms = r[2].status === 'fulfilled' ? (r[2].value.data || []) : [];
      var pendingWds = r[3].status === 'fulfilled' ? (r[3].value.data || []) : [];

      var u = d.users || {};
      var a = d.appointments || {};
      var o = d.orders || {};

      el.innerHTML = '<div class="page-header">' +
        '<div class="page-header-label">Dashboard · 儀表板</div>' +
        '<h1 class="page-title">Platform Overview</h1>' +
        '</div>' +

        '<div class="stats-grid mb-6">' +
        stat(u.patients || 0, 'Patients · 患者') +
        stat(u.doctors || 0, 'Doctors · 醫師') +
        stat(u.pharmacies || 0, 'Pharmacies · 藥房') +
        stat(a.today || 0, "Today's Appts · 今日預約") +
        '</div>' +

        '<div class="grid-2 mb-6">' +
        '<div><div class="text-label mb-3">System Status · 系統狀態</div>' +
        '<div class="card">' +
        statusRow('Total Appointments', a.total || 0) +
        statusRow('Completed', a.completed || 0) +
        statusRow('Total Orders', o.total || 0) +
        statusRow('Paid Orders', o.paid || 0) +
        statusRow('Order Revenue', HM.format.money(o.revenue || 0)) +
        statusRow('Payments Last 30 Days', HM.format.money(d.payments_last_30d || 0)) +
        '</div></div>' +
        '<div><div class="text-label mb-3">Pending Actions · 待處理</div>' +
        '<div class="card">' +
        pendingRow('Doctor Verifications', pendingDocs.length, '#/verifications') +
        pendingRow('Pharmacy Verifications', pendingPharms.length, '#/verifications') +
        pendingRow('Withdrawal Requests', pendingWds.length, '#/withdrawals') +
        '</div></div>' +
        '</div>' +

        '<div class="text-label mb-3">Quick Actions · 快捷操作</div>' +
        '<div class="grid-auto" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">' +
        action('+ Create Account', '#/accounts') +
        action('📦 View Orders', '#/orders') +
        action('📊 Export Data', '#/finance') +
        action('📜 View Audit', '#/audit') +
        '</div>';
    } catch (e) { HM.state.error(el, e); }
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
      (count > 0 ?
        '<button class="btn btn--outline btn--sm" onclick="location.hash=\'' + href + '\'">' + count + ' pending</button>' :
        '<span class="text-success">✓ All clear</span>') +
      '</div>';
  }

  function action(label, href) {
    return '<button class="card card--clickable" onclick="location.hash=\'' + href + '\'" style="text-align:center; padding: var(--s-4);">' +
      '<div style="font-size: var(--text-sm); font-weight: 500;">' + label + '</div></button>';
  }

  HM.adminPanels.dashboard = { render: render };
})();
