/**
 * Appointments — list + detail + cancel
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  var currentFilter = '';
  var customFrom = '', customTo = '';

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
      chip('custom', '🗓 Custom · 自訂') +
      '</div>' +
      '<div id="p-date-custom" class="flex gap-2 flex-wrap mb-3" style="align-items:end; display:none;">' +
        '<div><label class="text-xs text-muted">From · 起</label><input type="date" id="p-date-from" class="field-input field-input--boxed" style="margin:0;padding:6px 10px;"></div>' +
        '<div><label class="text-xs text-muted">To · 迄</label><input type="date" id="p-date-to" class="field-input field-input--boxed" style="margin:0;padding:6px 10px;"></div>' +
        '<button class="btn btn--primary btn--sm" id="p-date-apply">Apply · 套用</button>' +
      '</div>' +
      '<div id="appt-list"></div>' +
      '<div class="text-center mt-6"><button class="btn btn--primary" onclick="location.hash=\'#/book\'">+ Book New · 新預約</button></div>';

    document.querySelectorAll('.filter-chip').forEach(function (c) {
      c.addEventListener('click', function () {
        document.querySelectorAll('.filter-chip').forEach(function (x) { x.classList.remove('is-active'); });
        c.classList.add('is-active');
        currentFilter = c.getAttribute('data-filter');
        var box = document.getElementById('p-date-custom');
        if (box) box.style.display = currentFilter === 'custom' ? 'flex' : 'none';
        if (currentFilter !== 'custom') load();
      });
    });
    document.getElementById('p-date-apply').addEventListener('click', function () {
      var from = document.getElementById('p-date-from').value;
      var to   = document.getElementById('p-date-to').value;
      if (!from || !to) { HM.ui.toast('Pick both from and to dates', 'warning'); return; }
      if (from > to)    { HM.ui.toast('From must be before To', 'warning'); return; }
      customFrom = from; customTo = to;
      load();
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
        } else if (currentFilter === 'custom' && customFrom && customTo) {
          var from = new Date(customFrom + 'T00:00:00');
          var to   = new Date(customTo   + 'T23:59:59');
          items = items.filter(function (a) {
            var when = new Date(a.scheduled_start);
            return when >= from && when <= to;
          });
        } else if (currentFilter !== 'custom') {
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
        // 1-hour self-cancel rule (walk-ins exempt). We hide the button
        // when inside the window so patients aren't taunted with a
        // disabled control — the error toast on the backend still
        // catches any stale UI.
        var minutesUntil = null;
        if (a.scheduled_start) {
          minutesUntil = Math.round((new Date(a.scheduled_start).getTime() - Date.now()) / 60000);
        }
        var isWalkIn = (a.visit_type || 'online') === 'walk_in';
        var withinHour = !isWalkIn && minutesUntil !== null && minutesUntil < 60 && minutesUntil > -60;
        var data = {
          id: a.id,
          scheduled_start: a.scheduled_start,
          doctor_name: 'Doctor #' + a.doctor_id,
          notes: a.notes || '',
          status_badge: HM.format.statusBadge(a.status),
          fee_formatted: HM.format.money(a.fee),
          can_act: true,
          can_video: a.status === 'confirmed' || a.status === 'in_progress',
          can_cancel: ['confirmed','pending_payment'].indexOf(a.status) >= 0 && !withinHour,
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
          var ok = await HM.ui.confirm(
            'Cancel this appointment? · 取消此預約？\n\nNote: Cancellations must be made at least 1 hour before your appointment time.\n注意：取消須於預約前至少 1 小時進行。',
            { danger: true }
          );
          if (!ok) return;
          try {
            await HM.api.patient.cancelAppointment(a.id);
            HM.ui.toast('Appointment cancelled · 已取消', 'success');
            load();
          } catch (e) {
            // Backend returns a specific bilingual message for the 1hr rule.
            HM.ui.toast(e.message || 'Failed to cancel. Please contact the clinic.', 'danger');
          }
        });
        // When inside the 1hr window, replace the hidden cancel button
        // with a small inline hint so the patient knows *why* they
        // can't self-cancel.
        if (withinHour && node.querySelector('.appt-actions')) {
          var hint = document.createElement('div');
          hint.className = 'text-xs text-muted mt-1';
          hint.style.cssText = 'font-style:italic;';
          hint.textContent = 'Within 1 hour — contact clinic via WhatsApp to cancel · 預約前 1 小時內，請透過 WhatsApp 聯絡診所取消';
          node.querySelector('.appt-actions').appendChild(hint);
        }
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
