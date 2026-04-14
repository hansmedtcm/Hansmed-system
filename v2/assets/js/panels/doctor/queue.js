/**
 * Doctor Queue — today's confirmed appointments
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Today\'s Queue · 今日候診</div>' +
      '<h1 class="page-title">Patients Waiting</h1>' +
      '</div><div id="queue-list"></div>';

    var container = document.getElementById('queue-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.doctor.listAppointments();
      var appts = res.data || [];
      var today = new Date().toDateString();
      var todayAppts = appts.filter(function (a) {
        return new Date(a.scheduled_start).toDateString() === today &&
               ['confirmed','pending_payment','in_progress'].indexOf(a.status) >= 0;
      }).sort(function (a, b) { return new Date(a.scheduled_start) - new Date(b.scheduled_start); });

      if (!todayAppts.length) {
        HM.state.empty(container, {
          icon: '📅',
          title: 'No patients today',
          text: 'Your queue will appear here when patients book',
        });
        return;
      }

      container.innerHTML = '';
      todayAppts.forEach(function (a) {
        var data = {
          id: a.id,
          scheduled_start: a.scheduled_start,
          patient_name: 'Patient #' + a.patient_id,
          notes: a.notes || '',
          status_badge: HM.format.statusBadge(a.status),
          fee_formatted: HM.format.money(a.fee),
          can_consult: ['confirmed','in_progress'].indexOf(a.status) >= 0,
        };
        var node = HM.render.fromTemplate('tpl-consult-card', data);
        var consultBtn = node.querySelector('[data-action="consult"]');
        if (consultBtn) consultBtn.addEventListener('click', function () {
          location.hash = '#/consult/' + a.id;
        });
        node.querySelector('[data-action="view"]').addEventListener('click', function () {
          location.hash = '#/appointments/' + a.id;
        });
        node.querySelector('[data-action="chat"]').addEventListener('click', async function () {
          try {
            var res = await HM.api.chat.openThread({ patient_id: a.patient_id, appointment_id: a.id });
            location.hash = '#/messages/' + res.thread.id;
          } catch (e) { HM.ui.toast('Could not open chat', 'danger'); }
        });
        container.appendChild(node);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  HM.doctorPanels.queue = { render: render };
})();
