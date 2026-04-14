/**
 * Admin Prescriptions — oversight + force revoke
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Prescriptions · 處方</div>' +
      '<h1 class="page-title">Prescription Oversight</h1>' +
      '</div><div id="rx-list"></div>';

    var container = document.getElementById('rx-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.admin.listPrescriptions();
      var items = res.data || [];
      if (!items.length) {
        HM.state.empty(container, { icon: '📝', title: 'No prescriptions', text: 'All prescriptions will appear here' });
        return;
      }
      container.innerHTML = '';
      items.forEach(function (rx) {
        var drugs = (rx.items || []).map(function (i) { return i.drug_name; }).join(', ');
        var card = document.createElement('div');
        card.className = 'card mb-3';
        card.innerHTML = '<div class="flex-between mb-2">' +
          '<div><strong>' + HM.format.esc(rx.diagnosis || 'Prescription #' + rx.id) + '</strong>' +
          '<div class="text-xs text-muted">Doctor #' + rx.doctor_id + ' → Patient #' + rx.patient_id + ' · ' + HM.format.date(rx.created_at) + '</div></div>' +
          HM.format.statusBadge(rx.status) + '</div>' +
          '<p class="text-sm text-muted">' + HM.format.esc(drugs) + '</p>' +
          (rx.status === 'issued' ? '<button class="btn btn--outline btn--sm" style="color: var(--red-seal); margin-top: var(--s-2);" data-revoke>Force Revoke</button>' : '');
        var btn = card.querySelector('[data-revoke]');
        if (btn) btn.addEventListener('click', async function () {
          var reason = await HM.ui.prompt('Reason for force revoke:', { required: true });
          if (!reason) return;
          try { await HM.api.admin.revokePrescription(rx.id, { reason: reason }); HM.ui.toast('Revoked', 'success'); render(el); }
          catch (e) { HM.ui.toast(e.message, 'danger'); }
        });
        container.appendChild(card);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  HM.adminPanels.prescriptions = { render: render };
})();
