/**
 * Doctor Consultation Log — wage-based reference (no withdrawals).
 * Doctors are paid by salary by the clinic, not commission. This page
 * is a personal record of consultations completed and the consultation
 * fees collected by the clinic on the doctor's behalf.
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  async function render(el) {
    HM.state.loading(el);
    try {
      var results = await Promise.all([
        HM.api.doctor.getEarnings().catch(function () { return {}; }),
        HM.api.doctor.getEarningHistory().catch(function () { return { data: [] }; }),
      ]);
      var e = results[0] || {};
      var history = (results[1] && results[1].data) || [];

      var consultCount = (history || []).filter(function (p) { return p.payable_type === 'appointment'; }).length;
      var totalCollected = (history || []).reduce(function (s, p) { return s + (parseFloat(p.amount) || 0); }, 0);

      el.innerHTML = '<div class="page-header">' +
        '<div class="page-header-label">Consultation Log · 問診記錄</div>' +
        '<h1 class="page-title">My Consultation Record</h1>' +
        '<p class="text-muted mt-1">Doctors are paid by monthly salary from the clinic. This page shows the consultation fees collected by the clinic on your behalf — for your reference only. ' +
        '<span style="font-family: var(--font-zh);">醫師工資由診所按月發放。此頁面僅為您診金記錄的參考。</span></p>' +
        '</div>' +

        '<div class="stats-grid mb-6">' +
        stat(consultCount, 'Consultations · 問診次數') +
        stat(HM.format.money(totalCollected), 'Fees Collected · 已收診金') +
        stat(HM.format.money(e.gross_revenue || totalCollected), 'Gross (All-Time) · 累計') +
        '</div>' +

        '<div class="alert alert--info mb-4">' +
        '<div class="alert-icon">💡</div>' +
        '<div class="alert-body">' +
        '<strong>Salary-based compensation · 工資制薪酬</strong><br>' +
        'You receive a fixed monthly salary from the clinic regardless of these figures. Bonuses, if any, are calculated by HR. ' +
        'For payslip questions, please contact the clinic admin office. ' +
        '<span style="font-family: var(--font-zh);">您的薪資按月固定發放，與此記錄無關。如有薪資疑問請聯絡診所行政部。</span>' +
        '</div></div>' +

        '<div class="text-label mb-3">Payment History · 收款明細</div>' +
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
          '<div class="card"><p class="text-muted text-center">No consultation fees recorded yet · 暫無記錄</p></div>'
        );
    } catch (e) { HM.state.error(el, e); }
  }

  function stat(num, label) {
    return '<div class="stat-card"><div class="stat-number" style="font-size: var(--text-xl);">' + num + '</div><div class="stat-label">' + label + '</div></div>';
  }

  HM.doctorPanels.earnings = { render: render };
})();
