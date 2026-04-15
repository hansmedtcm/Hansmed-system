/**
 * Doctor Appointments — all appointments with filter
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};
  var currentFilter = '';

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Appointments · 預約</div>' +
      '<h1 class="page-title">All Appointments</h1>' +
      '</div>' +
      '<div class="filter-bar">' +
      chip('', 'All · 全部') +
      chip('confirmed', 'Confirmed · 已確認') +
      chip('in_progress', 'In Progress · 進行中') +
      chip('completed', 'Completed · 已完成') +
      chip('cancelled', 'Cancelled · 已取消') +
      '</div><div id="appt-list"></div>';

    document.querySelectorAll('.filter-chip').forEach(function (c) {
      c.addEventListener('click', function () {
        document.querySelectorAll('.filter-chip').forEach(function (x) { x.classList.remove('is-active'); });
        c.classList.add('is-active');
        currentFilter = c.getAttribute('data-filter');
        load();
      });
    });
    await load();
  }

  function chip(filter, label) {
    return '<button class="filter-chip ' + (filter === currentFilter ? 'is-active' : '') + '" data-filter="' + filter + '">' + label + '</button>';
  }

  async function load() {
    var container = document.getElementById('appt-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.doctor.listAppointments(currentFilter ? 'status=' + currentFilter : '');
      var items = res.data || [];

      if (!items.length) {
        HM.state.empty(container, { icon: '📅', title: 'No appointments', text: 'Matching appointments will appear here' });
        return;
      }

      container.innerHTML = '';
      items.forEach(function (a) {
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
        if (consultBtn) consultBtn.addEventListener('click', function () { location.hash = '#/consult/' + a.id; });
        node.querySelector('[data-action="view"]').addEventListener('click', function () { location.hash = '#/appointments/' + a.id; });
        node.querySelector('[data-action="chat"]').addEventListener('click', async function () {
          try {
            var r = await HM.api.chat.openThread({ patient_id: a.patient_id, appointment_id: a.id });
            location.hash = '#/messages/' + r.thread.id;
          } catch (e) { HM.ui.toast(e.message || 'Could not open chat', 'danger'); }
        });
        container.appendChild(node);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  async function renderDetail(el, id) {
    HM.state.loading(el);
    try {
      var res = await HM.api.doctor.getAppointment(id);
      var a = res.appointment;
      var tongue = res.tongue_diagnosis;

      var html = '<div class="page-header">' +
        '<button class="btn btn--ghost" onclick="location.hash=\'#/appointments\'">← Back</button>' +
        '</div>' +
        '<div class="card card--pad-lg" style="max-width: 800px;">' +
        '<div class="flex-between mb-4">' +
        '<div><div class="text-label">' + HM.format.datetime(a.scheduled_start) + '</div>' +
        '<h2>Patient #' + a.patient_id + '</h2></div>' +
        HM.format.statusBadge(a.status) +
        '</div>' +
        (a.notes ? '<div class="alert alert--info"><div class="alert-body"><div class="alert-title">Patient Notes · 患者備註</div>' + HM.format.esc(a.notes) + '</div></div>' : '') +
        (tongue ? '<div class="mt-4"><div class="text-label mb-2">Tongue Diagnosis · 舌診</div><div class="card"><p class="text-sm">' + ((tongue.constitution_report && tongue.constitution_report.constitution && tongue.constitution_report.constitution.name_en) || 'View patient tongue history') + '</p></div></div>' : '') +
        '<div class="flex flex-gap-3 mt-6">' +
        (['confirmed','in_progress'].indexOf(a.status) >= 0 ?
          '<button class="btn btn--primary" onclick="location.hash=\'#/consult/' + a.id + '\'">Start Consultation · 開始問診</button>' : '') +
        '<button class="btn btn--outline" onclick="location.hash=\'#/patients/' + a.patient_id + '\'">View Patient History · 查看病史</button>' +
        '</div></div>';
      el.innerHTML = html;
    } catch (e) { HM.state.error(el, e); }
  }

  HM.doctorPanels.appointments = { render: render, renderDetail: renderDetail };
})();
