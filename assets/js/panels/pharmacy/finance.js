/**
 * Pharmacy Finance / Reconciliation
 */
(function () {
  'use strict';
  HM.pharmPanels = HM.pharmPanels || {};

  async function render(el) {
    HM.state.loading(el);
    try {
      var results = await Promise.all([
        HM.api.pharmacy.getSummary('month'),
        HM.api.pharmacy.getDailyBreakdown(),
      ]);
      var s = results[0];
      var days = results[1].days || [];

      el.innerHTML = '<div class="page-header">' +
        '<div class="page-header-label">Finance · 財務</div>' +
        '<h1 class="page-title">Monthly Reconciliation</h1>' +
        '</div>' +
        '<div class="stats-grid mb-6">' +
        stat(s.order_count || 0, 'Orders · 訂單') +
        stat(HM.format.money(s.gross_revenue), 'Gross · 總收入') +
        stat(HM.format.money(s.platform_fee), 'Platform Fee · 平台費') +
        stat(HM.format.money(s.available_balance), 'Available · 可提現') +
        '</div>' +
        '<div class="text-label mb-3">Daily Breakdown · 每日明細</div>' +
        (days.length ?
          '<div class="table-wrap"><table class="table table--responsive"><thead><tr><th>Date</th><th>Orders</th><th>Revenue</th></tr></thead><tbody>' +
          days.map(function (d) {
            return '<tr><td data-label="Date">' + d.day + '</td><td data-label="Orders">' + d.orders + '</td><td data-label="Revenue">' + HM.format.money(d.gross) + '</td></tr>';
          }).join('') +
          '</tbody></table></div>' :
          '<div class="card"><p class="text-muted text-center">No data yet</p></div>'
        );
    } catch (e) { HM.state.error(el, e); }
  }

  function stat(num, label) {
    return '<div class="stat-card"><div class="stat-number" style="font-size: var(--text-xl);">' + num + '</div><div class="stat-label">' + label + '</div></div>';
  }

  HM.pharmPanels.finance = { render: render };
})();
