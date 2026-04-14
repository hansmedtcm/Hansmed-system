/**
 * Doctor Earnings
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  async function render(el) {
    HM.state.loading(el);
    try {
      var results = await Promise.all([
        HM.api.doctor.getEarnings(),
        HM.api.doctor.getEarningHistory(),
      ]);
      var e = results[0];
      var history = results[1].data || [];

      el.innerHTML = '<div class="page-header">' +
        '<div class="page-header-label">Earnings · 收入</div>' +
        '<h1 class="page-title">Revenue Summary</h1>' +
        '</div>' +

        '<div class="stats-grid mb-6">' +
        stat(HM.format.money(e.gross_revenue), 'Gross Revenue · 總收入') +
        stat(HM.format.money(e.platform_fee), 'Platform Fee · 平台費 (' + Math.round((e.platform_fee_rate || 0) * 100) + '%)') +
        stat(HM.format.money(e.net_earnings), 'Net Earnings · 淨收入') +
        stat(HM.format.money(e.available_balance), 'Available · 可提現') +
        '</div>' +

        '<div class="card card--pad-lg mb-6">' +
        '<div class="flex-between mb-4">' +
        '<h3>Breakdown · 明細</h3>' +
        '<button class="btn btn--primary btn--sm" onclick="location.hash=\'#/withdrawals\'">Request Withdrawal · 提現</button>' +
        '</div>' +
        '<div class="flex-between mb-2"><span class="text-muted">Already Withdrawn</span><span>' + HM.format.money(e.already_withdrawn) + '</span></div>' +
        '<div class="flex-between"><span class="text-muted">Pending Withdrawal</span><span>' + HM.format.money(e.pending_withdrawal) + '</span></div>' +
        '</div>' +

        '<div class="text-label mb-3">Payment History · 收款記錄</div>' +
        (history.length ?
          '<div class="table-wrap"><table class="table table--responsive"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead><tbody>' +
          history.map(function (p) {
            return '<tr>' +
              '<td data-label="Date">' + HM.format.date(p.paid_at || p.created_at) + '</td>' +
              '<td data-label="Type">' + (p.payable_type || '—') + '</td>' +
              '<td data-label="Amount">' + HM.format.money(p.amount) + '</td>' +
              '<td data-label="Status">' + HM.format.statusBadge(p.status) + '</td>' +
              '</tr>';
          }).join('') +
          '</tbody></table></div>' :
          '<div class="card"><p class="text-muted text-center">No payments yet</p></div>'
        );
    } catch (e) { HM.state.error(el, e); }
  }

  function stat(num, label) {
    return '<div class="stat-card"><div class="stat-number" style="font-size: var(--text-xl);">' + num + '</div><div class="stat-label">' + label + '</div></div>';
  }

  HM.doctorPanels.earnings = { render: render };
})();
