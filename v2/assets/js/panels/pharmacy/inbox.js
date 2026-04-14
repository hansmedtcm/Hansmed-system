/**
 * Prescription Inbox
 */
(function () {
  'use strict';
  HM.pharmPanels = HM.pharmPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Inbox · 處方</div>' +
      '<h1 class="page-title">Prescription Inbox</h1>' +
      '<p class="page-subtitle">Prescriptions attached to your orders</p>' +
      '</div><div id="inbox-list"></div>';

    var container = document.getElementById('inbox-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.pharmacy.listPrescriptions();
      var orders = res.data || [];
      if (!orders.length) {
        HM.state.empty(container, { icon: '📋', title: 'No prescriptions', text: 'Prescriptions will appear here when patients order' });
        return;
      }
      container.innerHTML = '';
      orders.forEach(function (o) {
        var rx = o.prescription || {};
        var doctor = (rx.doctor && rx.doctor.doctor_profile) || {};
        var patient = (rx.patient && rx.patient.patient_profile) || {};
        var items = (rx.items || []).map(function (i) { return i.drug_name + ' ' + i.quantity + i.unit; }).join(', ');
        var card = document.createElement('div');
        card.className = 'card card--bordered mb-3';
        card.style.borderLeftColor = o.status === 'paid' ? 'var(--gold)' : 'var(--sage)';
        card.innerHTML = '<div class="flex-between mb-2">' +
          '<div><strong>' + HM.format.esc(o.order_no) + '</strong>' +
          '<div class="text-xs text-muted">Patient: ' + HM.format.esc(patient.full_name || 'Unknown') + ' · Doctor: ' + HM.format.esc(doctor.full_name || 'Unknown') + '</div></div>' +
          HM.format.statusBadge(o.status) + '</div>' +
          (rx.diagnosis ? '<p class="text-sm"><strong>Dx:</strong> ' + HM.format.esc(rx.diagnosis) + '</p>' : '') +
          '<p class="text-sm text-muted">' + HM.format.esc(items) + '</p>' +
          (rx.instructions ? '<p class="text-xs" style="color: var(--sage); margin-top: var(--s-2);">⚠ ' + HM.format.esc(rx.instructions) + '</p>' : '') +
          '<button class="btn btn--outline btn--sm mt-3" onclick="location.hash=\'#/orders/' + o.id + '\'">View Order · 查看</button>';
        container.appendChild(card);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  HM.pharmPanels.inbox = { render: render };
})();
