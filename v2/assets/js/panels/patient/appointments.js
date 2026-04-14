/**
 * Appointments — list + detail + cancel
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  var currentFilter = '';

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Appointments · 預約記錄</div>' +
      '<h1 class="page-title">Your Consultations</h1>' +
      '</div>' +
      '<div class="filter-bar">' +
      chip('', 'All · 全部') +
      chip('confirmed', 'Upcoming · 即將') +
      chip('completed', 'Past · 過去') +
      chip('cancelled', 'Cancelled · 已取消') +
      '</div>' +
      '<div id="appt-list"></div>' +
      '<div class="text-center mt-6"><button class="btn btn--primary" onclick="location.hash=\'#/book\'">+ Book New · 新預約</button></div>';

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
      var res = await HM.api.patient.listAppointments();
      var items = res.data || [];
      if (currentFilter) {
        if (currentFilter === 'confirmed') {
          items = items.filter(function (a) { return ['confirmed','pending_payment','in_progress'].indexOf(a.status) >= 0; });
        } else {
          items = items.filter(function (a) { return a.status === currentFilter; });
        }
      }

      if (!items.length) {
        HM.state.empty(container, {
          icon: '📅',
          title: 'No appointments',
          text: 'Your consultation bookings will appear here',
          actionText: 'Book First Consultation',
          actionHref: '#/book',
        });
        return;
      }

      container.innerHTML = '';
      items.forEach(function (a) {
        var data = {
          id: a.id,
          scheduled_start: a.scheduled_start,
          doctor_name: 'Doctor #' + a.doctor_id,
          notes: a.notes || '',
          status_badge: HM.format.statusBadge(a.status),
          fee_formatted: HM.format.money(a.fee),
          can_act: true,
          can_video: a.status === 'confirmed' || a.status === 'in_progress',
          can_cancel: ['confirmed','pending_payment'].indexOf(a.status) >= 0,
        };
        var node = HM.render.fromTemplate('tpl-appt-card', data);
        node.querySelector('[data-action="view"]').addEventListener('click', function () {
          location.hash = '#/appointments/' + a.id;
        });
        var videoBtn = node.querySelector('[data-action="video"]');
        if (videoBtn) videoBtn.addEventListener('click', function () {
          location.hash = '#/consult/' + a.id;
        });
        var cancelBtn = node.querySelector('[data-action="cancel"]');
        if (cancelBtn) cancelBtn.addEventListener('click', async function () {
          var ok = await HM.ui.confirm('Cancel this appointment? · 取消此預約？', { danger: true });
          if (!ok) return;
          try {
            await HM.api.patient.cancelAppointment(a.id);
            HM.ui.toast('Appointment cancelled · 已取消', 'success');
            load();
          } catch (e) { HM.ui.toast(e.message || 'Failed', 'danger'); }
        });
        container.appendChild(node);
      });
    } catch (e) {
      HM.state.error(container, e);
    }
  }

  async function renderDetail(el, id) {
    HM.state.loading(el);
    try {
      // No detail endpoint, use list
      var res = await HM.api.patient.listAppointments();
      var a = (res.data || []).find(function (x) { return x.id == id; });
      if (!a) throw new Error('Appointment not found');

      el.innerHTML = '<div class="page-header">' +
        '<button class="btn btn--ghost" onclick="location.hash=\'#/appointments\'">← Back</button>' +
        '</div>' +
        '<div class="card card--pad-lg" style="max-width: 600px;">' +
        '<div class="text-label mb-2">Appointment Details · 預約詳情</div>' +
        '<h2 class="mb-4">' + HM.format.datetime(a.scheduled_start) + '</h2>' +
        '<div class="mb-3">' + HM.format.statusBadge(a.status) + '</div>' +
        '<dl class="mb-6">' +
        '<div class="flex-between mb-2" style="padding: var(--s-2) 0; border-bottom: 1px solid var(--border);"><dt class="text-muted">Doctor</dt><dd>#' + a.doctor_id + '</dd></div>' +
        '<div class="flex-between mb-2" style="padding: var(--s-2) 0; border-bottom: 1px solid var(--border);"><dt class="text-muted">Fee</dt><dd>' + HM.format.money(a.fee) + '</dd></div>' +
        (a.notes ? '<div class="flex-between mb-2" style="padding: var(--s-2) 0;"><dt class="text-muted">Notes</dt><dd>' + HM.format.esc(a.notes) + '</dd></div>' : '') +
        '</dl>' +
        (['confirmed','in_progress'].indexOf(a.status) >= 0 ?
          '<button class="btn btn--primary btn--block" onclick="location.hash=\'#/consult/' + a.id + '\'">Join Video Consultation · 加入視訊</button>' : '') +
        '</div>';
    } catch (e) { HM.state.error(el, e); }
  }

  HM.patientPanels.appointments = { render: render, renderDetail: renderDetail };
})();
