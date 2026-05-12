/**
 * Admin Withdrawals — approve/reject payout requests
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Withdrawals · 提現審核</div>' +
      '<h1 class="page-title">Pending Withdrawal Requests</h1>' +
      '</div><div id="wd-list"></div>';

    var container = document.getElementById('wd-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.admin.pendingWithdrawals();
      var items = res.data || [];
      if (!items.length) {
        HM.state.empty(container, { icon: '🏦', title: 'No pending withdrawals', text: 'All withdrawal requests have been processed' });
        return;
      }
      container.innerHTML = '<div class="table-wrap"><table class="table table--responsive"><thead><tr><th>Request #</th><th>Applicant</th><th>Amount</th><th>Method</th><th>Requested</th><th></th></tr></thead><tbody></tbody></table></div>';
      var tbody = container.querySelector('tbody');
      items.forEach(function (w) {
        var applicant = (w.user && (w.user.doctor_profile && w.user.doctor_profile.full_name || w.user.pharmacy_profile && w.user.pharmacy_profile.name || w.user.email)) || '—';
        var tr = document.createElement('tr');
        tr.innerHTML = '<td data-label="Request #"><strong>#' + w.id + '</strong></td>' +
          '<td data-label="Applicant">' + HM.format.esc(applicant) + '</td>' +
          '<td data-label="Amount"><strong>' + HM.format.money(w.amount) + '</strong></td>' +
          '<td data-label="Method">' + HM.format.esc(w.method || 'Bank Transfer') + '</td>' +
          '<td data-label="Requested">' + HM.format.date(w.created_at) + '</td>' +
          '<td data-label="Actions"><div class="flex gap-2">' +
          '<button class="btn btn--primary btn--sm" data-approve="' + w.id + '">Approve</button>' +
          '<button class="btn btn--ghost btn--sm" data-reject="' + w.id + '">Reject</button>' +
          '<button class="btn btn--outline btn--sm" data-view="' + w.id + '">Details</button>' +
          '</div></td>';
        tr.querySelector('[data-approve]').addEventListener('click', function () { review(w.id, 'approved'); });
        tr.querySelector('[data-reject]').addEventListener('click', function () { review(w.id, 'rejected'); });
        tr.querySelector('[data-view]').addEventListener('click', function () { showDetail(w); });
        tbody.appendChild(tr);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  async function review(id, decision) {
    var msg = decision === 'approved' ? 'Transaction reference (optional):' : 'Reason for rejection:';
    var note = await HM.ui.prompt(msg, {
      title: decision === 'approved' ? 'Approve Withdrawal' : 'Reject Withdrawal',
      placeholder: decision === 'approved' ? 'Bank TXN ID' : 'Please explain…',
      required: decision !== 'approved',
    });
    if (note === null) return;
    try {
      await HM.api.admin.reviewWithdrawal(id, { decision: decision, note: note });
      HM.ui.toast(decision === 'approved' ? 'Withdrawal approved' : 'Withdrawal rejected', 'success');
      render(document.getElementById('panel-container'));
    } catch (e) { HM.ui.toast(e.message, 'danger'); }
  }

  function showDetail(w) {
    HM.ui.modal({
      size: 'md',
      title: 'Withdrawal Request #' + w.id,
      content: '<div class="info-list">' +
        '<div><div class="info-label">Amount</div><div class="info-value">' + HM.format.money(w.amount) + '</div></div>' +
        '<div><div class="info-label">Method</div><div class="info-value">' + HM.format.esc(w.method || 'Bank Transfer') + '</div></div>' +
        '<div><div class="info-label">Bank Account</div><div class="info-value">' + HM.format.esc(w.bank_account || '—') + '</div></div>' +
        '<div><div class="info-label">Notes</div><div class="info-value">' + HM.format.esc(w.notes || '—') + '</div></div>' +
        '<div><div class="info-label">Requested</div><div class="info-value">' + HM.format.date(w.created_at) + '</div></div>' +
        '</div>',
    });
  }

  HM.adminPanels.withdrawals = { render: render };
})();
