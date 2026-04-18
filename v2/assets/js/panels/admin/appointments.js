/**
 * Admin Appointments — with date + status filters
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  var state = { dateFilter: 'today', statusFilter: '', visitFilter: '', customFrom: '', customTo: '' };

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Appointments · 預約</div>' +
      '<h1 class="page-title">All Appointments</h1>' +
      '</div>' +

      // Date filter
      '<div class="text-label mb-2">Date · 日期</div>' +
      '<div class="filter-bar mb-3" id="date-filter">' +
      dchip('today',     '📅 Today · 今日', true) +
      dchip('week',      'This Week · 本週') +
      dchip('upcoming',  'Upcoming · 未來') +
      dchip('past',      'Past · 過去') +
      dchip('all',       'All · 全部') +
      dchip('custom',    '🗓 Custom Range · 自訂區間') +
      '</div>' +
      '<div id="date-custom" class="flex gap-2 flex-wrap mb-3" style="align-items:end; display:none;">' +
        '<div><label class="text-xs text-muted">From · 起</label><input type="date" id="date-from" class="field-input field-input--boxed" style="margin:0;padding:6px 10px;"></div>' +
        '<div><label class="text-xs text-muted">To · 迄</label><input type="date" id="date-to" class="field-input field-input--boxed" style="margin:0;padding:6px 10px;"></div>' +
        '<button class="btn btn--primary btn--sm" id="date-apply">Apply · 套用</button>' +
      '</div>' +

      // Status filter
      '<div class="text-label mb-2">Status · 狀態</div>' +
      '<div class="filter-bar mb-3" id="status-filter">' +
      schip('',           'All · 全部', true) +
      schip('confirmed',  'Confirmed · 已確認') +
      schip('in_progress','In Progress · 進行中') +
      schip('completed',  'Completed · 已完成') +
      schip('cancelled',  'Cancelled · 已取消') +
      '</div>' +

      // Visit type filter
      '<div class="text-label mb-2">Visit Type · 就診方式</div>' +
      '<div class="filter-bar mb-4" id="visit-filter">' +
      vchip('',        'All · 全部', true) +
      vchip('walk_in', '🏥 Walk-in · 臨診') +
      vchip('online',  '📹 Online · 線上') +
      '</div>' +

      '<div class="flex-between mb-3">' +
      '<div id="appt-summary" class="text-sm text-muted"></div>' +
      '<button class="btn btn--ghost btn--sm" id="appt-refresh">↻ Refresh</button>' +
      '</div>' +

      '<div id="appt-list"></div>';

    wireFilter('date-filter', function (v) {
      state.dateFilter = v;
      var customBox = document.getElementById('date-custom');
      if (customBox) customBox.style.display = v === 'custom' ? 'flex' : 'none';
      if (v !== 'custom') load();
    });
    wireFilter('status-filter', function (v) { state.statusFilter = v; load(); });
    wireFilter('visit-filter', function (v) { state.visitFilter = v; load(); });
    document.getElementById('appt-refresh').addEventListener('click', load);
    document.getElementById('date-apply').addEventListener('click', function () {
      var from = document.getElementById('date-from').value;
      var to   = document.getElementById('date-to').value;
      if (!from || !to)  { HM.ui.toast('Pick both from and to dates', 'warning'); return; }
      if (from > to)     { HM.ui.toast('From must be before To', 'warning'); return; }
      state.customFrom = from; state.customTo = to;
      load();
    });
    await load();
  }

  function dchip(v, l, active) { return chip('date', v, l, active); }
  function schip(v, l, active) { return chip('status', v, l, active); }
  function vchip(v, l, active) { return chip('visit', v, l, active); }
  function chip(group, value, label, active) {
    return '<button class="filter-chip' + (active ? ' is-active' : '') + '" data-value="' + value + '">' + label + '</button>';
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

  async function load() {
    var container = document.getElementById('appt-list');
    var summary = document.getElementById('appt-summary');
    HM.state.loading(container);
    try {
      var qs = [];
      if (state.statusFilter) qs.push('status=' + state.statusFilter);
      // Today filter is server-side, others client-side
      if (state.dateFilter === 'today') qs.push('date=' + todayISO());
      var res = await HM.api.admin.listAppointments(qs.join('&'));
      var items = res.data || [];

      // Client-side date filtering for the non-today buckets
      if (state.dateFilter !== 'today' && state.dateFilter !== 'all') {
        items = items.filter(function (a) {
          var when = new Date(a.scheduled_start);
          var now = new Date();
          if (state.dateFilter === 'upcoming') return when >= now;
          if (state.dateFilter === 'past')     return when < now;
          if (state.dateFilter === 'week') {
            var sevenDaysOut = new Date(now.getTime() + 7 * 86400000);
            return when >= now && when <= sevenDaysOut;
          }
          if (state.dateFilter === 'custom' && state.customFrom && state.customTo) {
            var from = new Date(state.customFrom + 'T00:00:00');
            var to   = new Date(state.customTo   + 'T23:59:59');
            return when >= from && when <= to;
          }
          return true;
        });
      }
      if (state.visitFilter) {
        items = items.filter(function (a) { return (a.visit_type || 'online') === state.visitFilter; });
      }

      summary.textContent = items.length + ' appointment' + (items.length === 1 ? '' : 's');

      if (!items.length) {
        HM.state.empty(container, { icon: '📅', title: 'No appointments', text: 'Adjust the filters above to see more.' });
        return;
      }
      container.innerHTML = '<div class="table-wrap"><table class="table table--responsive"><thead><tr><th>Date / Time</th><th>Patient</th><th>Doctor</th><th>Visit</th><th>Concern</th><th>Fee</th><th>Status</th></tr></thead><tbody></tbody></table></div>';
      var tbody = container.querySelector('tbody');
      items.forEach(function (a) {
        var visitLbl = (a.visit_type === 'walk_in')
          ? '<span class="badge" style="background:rgba(184,150,90,.15);color:var(--gold);font-size:10px;">🏥 Walk-in</span>'
          : '<span class="badge" style="background:rgba(74,144,217,.15);color:#4a90d9;font-size:10px;">📹 Online</span>';

        var patientName = a.patient_name || a.patient_email || ('Patient #' + a.patient_id);
        var doctorName  = a.doctor_id
          ? (a.doctor_name || a.doctor_email || ('Doctor #' + a.doctor_id))
          : '<span class="text-muted">— pool</span>';

        var tr = document.createElement('tr');
        tr.innerHTML = '<td data-label="Date">' + HM.format.datetime(a.scheduled_start) + '</td>' +
          '<td data-label="Patient"><strong>' + HM.format.esc(patientName) + '</strong>' +
          '<div class="text-xs text-muted">#' + a.patient_id + '</div></td>' +
          '<td data-label="Doctor">' + (a.doctor_id ? ('<strong>' + HM.format.esc(doctorName) + '</strong><div class="text-xs text-muted">#' + a.doctor_id + '</div>') : doctorName) + '</td>' +
          '<td data-label="Visit">' + visitLbl + '</td>' +
          '<td data-label="Concern">' + HM.format.esc(a.concern_label || '—') + '</td>' +
          '<td data-label="Fee">' + HM.format.money(a.fee) + '</td>' +
          '<td data-label="Status">' + HM.format.statusBadge(a.status) + '</td>';
        tbody.appendChild(tr);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  HM.adminPanels.appointments = { render: render };
})();
