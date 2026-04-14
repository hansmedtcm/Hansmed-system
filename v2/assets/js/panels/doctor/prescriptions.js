/**
 * Doctor Prescriptions — list + revoke + revise
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Prescriptions · 處方</div>' +
      '<h1 class="page-title">Issued Prescriptions</h1>' +
      '</div><div id="rx-list"></div>';

    var container = document.getElementById('rx-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.doctor.listPrescriptions();
      var items = res.data || [];

      if (!items.length) {
        HM.state.empty(container, {
          icon: '📝',
          title: 'No prescriptions issued yet',
          text: 'Prescriptions you issue during consultations will appear here',
        });
        return;
      }

      container.innerHTML = '';
      items.forEach(function (rx) {
        var drugs = (rx.items || []).map(function (i) { return i.drug_name + ' ' + i.quantity + i.unit; }).join(', ');
        var card = document.createElement('div');
        card.className = 'card mb-3';
        card.innerHTML = '<div class="flex-between mb-2">' +
          '<div><div class="text-label">' + HM.format.datetime(rx.created_at) + '</div>' +
          '<strong>' + HM.format.esc(rx.diagnosis || 'Prescription #' + rx.id) + '</strong>' +
          '<div class="text-xs text-muted">Patient #' + rx.patient_id + '</div></div>' +
          HM.format.statusBadge(rx.status) + '</div>' +
          '<p class="text-sm text-muted mb-3">' + HM.format.esc(drugs) + '</p>' +
          '<div class="flex flex-gap-2">' +
          '<a href="' + HM.config.API_BASE + '/documents/prescription/' + rx.id + '" target="_blank" class="btn btn--outline btn--sm">📄 PDF</a>' +
          (rx.status === 'issued' ? '<button class="btn btn--outline btn--sm" data-revise>Revise · 修改</button><button class="btn btn--ghost btn--sm" data-revoke style="color: var(--red-seal);">Revoke · 撤銷</button>' : '') +
          '</div>';
        var reviseBtn = card.querySelector('[data-revise]');
        if (reviseBtn) reviseBtn.addEventListener('click', function () { HM.ui.toast('Revise coming soon', 'info'); });
        var revokeBtn = card.querySelector('[data-revoke]');
        if (revokeBtn) revokeBtn.addEventListener('click', async function () {
          var ok = await HM.ui.confirm('Revoke this prescription? · 撤銷此處方？', { danger: true });
          if (!ok) return;
          try {
            await HM.api.doctor.revokePrescription(rx.id);
            HM.ui.toast('Prescription revoked · 已撤銷', 'success');
            render(el);
          } catch (e) { HM.ui.toast(e.message || 'Failed', 'danger'); }
        });
        container.appendChild(card);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  HM.doctorPanels.prescriptions = { render: render };
})();
