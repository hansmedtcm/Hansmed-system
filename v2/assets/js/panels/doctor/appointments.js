/**
 * Doctor Appointments — all appointments with filter
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};
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

      '<div class="text-label mb-2">Date · 日期</div>' +
      '<div class="filter-bar mb-3" id="d-date-filter">' +
      chip('date', 'today',    '📅 Today · 今日', true) +
      chip('date', 'week',     'This Week · 本週') +
      chip('date', 'upcoming', 'Upcoming · 未來') +
      chip('date', 'past',     'Past · 過去') +
      chip('date', 'all',      'All · 全部') +
      chip('date', 'custom',   '🗓 Custom · 自訂') +
      '</div>' +
      '<div id="d-date-custom" class="flex gap-2 flex-wrap mb-3" style="align-items:end; display:none;">' +
        '<div><label class="text-xs text-muted">From · 起</label><input type="date" id="d-date-from" class="field-input field-input--boxed" style="margin:0;padding:6px 10px;"></div>' +
        '<div><label class="text-xs text-muted">To · 迄</label><input type="date" id="d-date-to" class="field-input field-input--boxed" style="margin:0;padding:6px 10px;"></div>' +
        '<button class="btn btn--primary btn--sm" id="d-date-apply">Apply · 套用</button>' +
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

    wireFilter('d-date-filter', function (v) {
      state.dateFilter = v;
      var box = document.getElementById('d-date-custom');
      if (box) box.style.display = v === 'custom' ? 'flex' : 'none';
      if (v !== 'custom') load();
    });
    wireFilter('d-status-filter', function (v) { state.statusFilter = v; load(); });
    wireFilter('d-visit-filter', function (v) { state.visitFilter = v; load(); });
    document.getElementById('d-appt-refresh').addEventListener('click', load);
    document.getElementById('d-date-apply').addEventListener('click', function () {
      var from = document.getElementById('d-date-from').value;
      var to   = document.getElementById('d-date-to').value;
      if (!from || !to) { HM.ui.toast('Pick both from and to dates', 'warning'); return; }
      if (from > to)    { HM.ui.toast('From must be before To', 'warning'); return; }
      state.customFrom = from; state.customTo = to;
      load();
    });
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
      if (summary) summary.textContent = items.length + ' appointment' + (items.length === 1 ? '' : 's');

      if (!items.length) {
        HM.state.empty(container, { icon: '📅', title: 'No appointments', text: 'Adjust the filters above to see more.' });
        return;
      }

      container.innerHTML = '';
      items.forEach(function (a) {
        // Prefer the joined profile name; fall back to id only if the
        // patient hasn't completed their profile yet (should be rare
        // after registration-wall enforces it).
        var pp = (a.patient && a.patient.patient_profile) || {};
        var realName = pp.full_name || (a.patient && a.patient.email) || ('Patient #' + a.patient_id);
        // Combined fee = consultation + treatments + paid Rx orders.
        // Backend computes total_billed; fall back to bare fee on
        // older payloads.
        var consultFee   = parseFloat(a.consult_fee   != null ? a.consult_fee   : a.fee) || 0;
        var treatmentFee = parseFloat(a.treatment_fee || 0);
        var rxOrderFee   = parseFloat(a.rx_order_fee  || 0);
        var totalBilled  = (a.total_billed != null) ? parseFloat(a.total_billed) : (consultFee + treatmentFee + rxOrderFee);
        var hasExtras = treatmentFee > 0 || rxOrderFee > 0;

        var feeBlock = hasExtras
          ? '<div style="text-align:right;">' +
            '<strong style="color:var(--gold);font-size:var(--text-lg);">' + HM.format.money(totalBilled) + '</strong>' +
            '<div class="text-xs text-muted" style="margin-top:2px;">' +
              '診費 ' + HM.format.money(consultFee) +
              (treatmentFee > 0 ? ' · 治療 ' + HM.format.money(treatmentFee) : '') +
              (rxOrderFee   > 0 ? ' · 藥單 ' + HM.format.money(rxOrderFee)   : '') +
            '</div>' +
            '</div>'
          : HM.format.money(consultFee);

        var data = {
          id: a.id,
          scheduled_start: a.scheduled_start,
          patient_name: realName,
          notes: a.notes || '',
          status_badge: HM.format.statusBadge(a.status),
          fee_formatted: feeBlock,
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
      var pp = (a.patient && a.patient.patient_profile) || {};
      var pname = pp.full_name || (a.patient && a.patient.email) || ('Patient #' + a.patient_id);

      // Fee breakdown card — consult + treatments + each Rx order line.
      var fb = res.fee_breakdown || {};
      var feeBreakdownHtml = '';
      if (fb.total_billed > 0 || (fb.consult_fee || 0) > 0) {
        feeBreakdownHtml =
          '<div class="card card--pad-lg mt-4" style="max-width: 800px; border-left:3px solid var(--gold);">' +
          '<div class="text-label mb-3">💰 Fee Breakdown · 費用明細</div>' +
          '<div class="flex-between" style="padding: var(--s-2) 0; border-bottom: 1px dashed var(--border);">' +
            '<span>Consultation · 診費</span>' +
            '<strong>' + HM.format.money(fb.consult_fee || 0) + '</strong>' +
          '</div>';

        if ((fb.treatments || []).length) {
          fb.treatments.forEach(function (t) {
            feeBreakdownHtml +=
              '<div class="flex-between" style="padding: var(--s-2) 0; border-bottom: 1px dashed var(--border);">' +
                '<span class="text-sm">💉 ' + HM.format.esc(t.name) +
                (t.name_zh ? ' <span style="font-family:var(--font-zh);color:var(--stone);">· ' + HM.format.esc(t.name_zh) + '</span>' : '') +
                '</span>' +
                '<span>' + HM.format.money(t.fee) + '</span>' +
              '</div>';
          });
        }

        if ((fb.rx_orders || []).length) {
          fb.rx_orders.forEach(function (o) {
            feeBreakdownHtml +=
              '<div class="flex-between" style="padding: var(--s-2) 0; border-bottom: 1px dashed var(--border);">' +
                '<span class="text-sm">💊 Rx Order ' +
                '<a href="#/orders" style="font-family:var(--font-mono);color:var(--gold);">' + HM.format.esc(o.order_no) + '</a> ' +
                HM.format.statusBadge(o.status) +
                '</span>' +
                '<span>' + HM.format.money(o.total) + '</span>' +
              '</div>';
          });
        }

        feeBreakdownHtml +=
          '<div class="flex-between mt-2" style="padding-top: var(--s-2); border-top: 2px solid var(--ink);">' +
            '<strong>Total · 合計</strong>' +
            '<strong style="color: var(--gold); font-size: var(--text-xl);">' + HM.format.money(fb.total_billed) + '</strong>' +
          '</div>' +
          '<div class="text-xs text-muted mt-2" style="font-style:italic;">Consultation fee is yours; medicine order revenue is shared with the dispensing pharmacy. · 診費歸醫師，藥單收入與配藥藥房分成。</div>' +
          '</div>';
      }

      var html = '<div class="page-header">' +
        '<button class="btn btn--ghost" onclick="location.hash=\'#/appointments\'">← Back</button>' +
        '</div>' +
        '<div class="card card--pad-lg" style="max-width: 800px;">' +
        '<div class="flex-between mb-4">' +
        '<div><div class="text-label">' + HM.format.datetime(a.scheduled_start) + '</div>' +
        '<h2>' + HM.format.esc(pname) + '</h2>' +
        '<div class="text-xs text-muted">Patient #' + a.patient_id + '</div></div>' +
        HM.format.statusBadge(a.status) +
        '</div>' +
        (a.notes ? '<div class="alert alert--info"><div class="alert-body"><div class="alert-title">Patient Notes · 患者備註</div>' + HM.format.esc(a.notes) + '</div></div>' : '') +
        (tongue ? '<div class="mt-4"><div class="text-label mb-2">Tongue Diagnosis · 舌診</div><div class="card"><p class="text-sm">' + ((tongue.constitution_report && tongue.constitution_report.constitution && tongue.constitution_report.constitution.name_en) || 'View patient tongue history') + '</p></div></div>' : '') +
        '<div class="flex flex-gap-3 mt-6">' +
        (['confirmed','in_progress'].indexOf(a.status) >= 0 ?
          '<button class="btn btn--primary" onclick="location.hash=\'#/consult/' + a.id + '\'">Start Consultation · 開始問診</button>' : '') +
        '<button class="btn btn--outline" onclick="location.hash=\'#/patients/' + a.patient_id + '\'">View Patient History · 查看病史</button>' +
        '</div></div>' +
        feeBreakdownHtml;
      el.innerHTML = html;
    } catch (e) { HM.state.error(el, e); }
  }

  HM.doctorPanels.appointments = { render: render, renderDetail: renderDetail };
})();
