/**
 * Doctor Withdrawals
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  async function render(el) {
    HM.state.loading(el);
    try {
      var results = await Promise.all([
        HM.api.doctor.getEarnings(),
        HM.api.doctor.listWithdrawals(),
      ]);
      var e = results[0];
      var items = results[1].data || [];

      el.innerHTML = '<div class="page-header">' +
        '<div class="page-header-label">Withdrawals · 提現</div>' +
        '<h1 class="page-title">Request Withdrawal</h1>' +
        '</div>' +
        '<div class="card card--pad-lg mb-6" style="max-width: 600px;">' +
        '<div class="stat-card mb-4"><div class="stat-number">' + HM.format.money(e.available_balance) + '</div><div class="stat-label">Available Balance · 可提現餘額</div></div>' +
        '<form id="wd-form">' +
        '<div class="field"><label class="field-label" data-required>Amount (RM) · 金額</label><input name="amount" type="number" step="0.01" min="1" max="' + (e.available_balance || 0) + '" class="field-input field-input--boxed" required></div>' +
        '<div class="field"><label class="field-label" data-required>Bank Name · 銀行</label><input name="bank_name" class="field-input field-input--boxed" required placeholder="e.g. Maybank"></div>' +
        '<div class="field"><label class="field-label" data-required>Account Number · 帳號</label><input name="account_number" class="field-input field-input--boxed" required></div>' +
        '<div class="field"><label class="field-label" data-required>Account Holder · 戶名</label><input name="account_holder" class="field-input field-input--boxed" required></div>' +
        '<button type="submit" class="btn btn--primary btn--block">Submit Request · 提交申請</button>' +
        '</form></div>' +

        '<div class="text-label mb-3">Withdrawal History · 提現記錄</div>' +
        (items.length ?
          items.map(function (w) {
            return '<div class="card mb-2"><div class="flex-between">' +
              '<div><strong>' + HM.format.money(w.amount) + '</strong><br>' +
              '<span class="text-xs text-muted">Requested ' + HM.format.date(w.created_at) + '</span></div>' +
              HM.format.statusBadge(w.status) +
              '</div></div>';
          }).join('') :
          '<div class="card"><p class="text-muted text-center">No withdrawal requests yet</p></div>');

      document.getElementById('wd-form').addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var d = HM.form.serialize(ev.target);
        try {
          await HM.api.doctor.requestWithdrawal({
            amount: parseFloat(d.amount),
            bank_info: {
              bank: d.bank_name,
              account: d.account_number,
              holder: d.account_holder,
            },
          });
          HM.ui.toast('Withdrawal request submitted · 申請已提交', 'success');
          render(el);
        } catch (err) { HM.ui.toast(err.message || 'Failed', 'danger'); }
      });
    } catch (err) { HM.state.error(el, err); }
  }

  HM.doctorPanels.withdrawals = { render: render };
})();
