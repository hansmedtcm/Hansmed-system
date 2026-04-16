/**
 * Doctor Appointments — all appointments with filter
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};
  var state = { dateFilter: 'today', statusFilter: '', visitFilter: '' };

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Appointments · 預約</div>' +
      '<h1 class="page-title">All Appointments</h1>' +
      '</div>' +

      '<div class="text-label mb-2">Date · 日期</div>' +
      '<div class="filter-bar mb-3" id="d-date-filter">' +
      chip('date', 'today',    '📅 Today · 今日', true) +
      chip('date', 'week',     'This Week · 本週') +
      chip('date', 'upcoming', 'Upcoming · 未來') +
      chip('date', 'past',     'Past · 過去') +
      chip('date', 'all',      'All · 全部') +
      '</div>' +

      '<div class="text-label mb-2">Status · 狀態</div>' +
      '<div class="filter-bar mb-3" id="d-status-filter">' +
      chip('status', '',           'All · 全部', true) +
      chip('status', 'confirmed',  'Confirmed · 已確認') +
      chip('status', 'in_progress','In Progress · 進行中') +
      chip('status', 'completed',  'Completed · 已完成') +
      chip('status', 'cancelled',  'Cancelled · 已取消') +
      '</div>' +

      '<div class="text-label mb-2">Visit Type · 就診方式</div>' +
      '<div class="filter-bar mb-4" id="d-visit-filter">' +
      chip('visit', '',        'All · 全部', true) +
      chip('visit', 'walk_in', '🏥 Walk-in · 臨診') +
      chip('visit', 'online',  '📹 Teleconsult · 線上') +
      '</div>' +

      '<div class="flex-between mb-3">' +
      '<div id="d-appt-summary" class="text-sm text-muted"></div>' +
      '<button class="btn btn--ghost btn--sm" id="d-appt-refresh">↻ Refresh</button>' +
      '</div>' +

      '<div id="appt-list"></div>';

    wireFilter('d-date-filter', function (v) { state.dateFilter = v; load(); });
    wireFilter('d-status-filter', function (v) { state.statusFilter = v; load(); });
    wireFilter('d-visit-filter', function (v) { state.visitFilter = v; load(); });
    document.getElementById('d-appt-refresh').addEventListener('click', load);
    await load();
  }

  function chip(group, value, label, active) {
    return '<button class="filter-chip' + (active ? ' is-active' : '') + '" data-group="' + group + '" data-value="' + value + '">' + label + '</button>';
  }

  function wireFilter(containerId, onChange) {
    var c = document.getElementById(containerId);
    if (!c) return;
    c.querySelectorAll('.filter-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        c.querySelectorAll('.filter-chip').forEach(function (x) { x.classList.remove('is-active'); });
        btn.classList.add('is-active');
        onChange(btn.getAttribute('data-value'));
      });
    });
  }

  function visitTypeBadge(type) {
    if (type === 'walk_in') {
      return '<span class="badge" style="background:rgba(184,150,90,.15);color:var(--gold);border:1px solid rgba(184,150,90,.35);">🏥 Walk-in · 臨診</span>';
    }
    return '<span class="badge" style="background:rgba(74,144,217,.15);color:#4a90d9;border:1px solid rgba(74,144,217,.35);">📹 Teleconsult · 線上</span>';
  }

  async function load() {
    var container = document.getElementById('appt-list');
    var summary = document.getElementById('d-appt-summary');
    HM.state.loading(container);
    try {
      var qs = [];
      if (state.statusFilter) qs.push('status=' + state.statusFilter);
      if (state.dateFilter === 'today') qs.push('date=' + todayISO());
      var res = await HM.api.doctor.listAppointments(qs.join('&'));
      var items = res.data || [];

      // Client-side date refinement
      if (state.dateFilter !== 'today' && state.dateFilter !== 'all') {
        items = items.filter(function (a) {
          var when = new Date(a.scheduled_start);
          var now = new Date();
          if (state.dateFilter === 'upcoming') return when >= now;
          if (state.dateFilter === 'past')     return when < now;
          if (state.dateFilter === 'week') {
            var weekOut = new Date(now.getTime() + 7 * 86400000);
            return when >= now && when <= weekOut;
          }
          return true;
        });
      }
      if (state.visitFilter) {
        items = items.filter(function (a) { return (a.visit_type || 'online') === state.visitFilter; });
      }
      if (summary) summary.textContent = items.length + ' appointment' + (items.length === 1 ? '' : 's');

      if (!items.length) {
        HM.state.empty(container, { icon: '📅', title: 'No appointments', text: 'Adjust the filters above to see more.' });
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
          visit_badge: visitTypeBadge(a.visit_type),
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
