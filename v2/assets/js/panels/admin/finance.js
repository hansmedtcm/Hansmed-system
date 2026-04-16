/**
 * Admin Finance — overview + per-doctor breakdown with date range filter
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  var state = { from: null, to: null, preset: 'month' };

  function ymd(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function applyPreset(preset) {
    var n = new Date();
    if (preset === 'today') {
      state.from = ymd(n); state.to = ymd(n);
    } else if (preset === 'week') {
      // start of week (Monday)
      var dow = (n.getDay() + 6) % 7;
      var start = new Date(n); start.setDate(n.getDate() - dow);
      var end   = new Date(start); end.setDate(start.getDate() + 6);
      state.from = ymd(start); state.to = ymd(end);
    } else if (preset === 'month') {
      state.from = ymd(new Date(n.getFullYear(), n.getMonth(), 1));
      state.to   = ymd(new Date(n.getFullYear(), n.getMonth() + 1, 0));
    } else if (preset === 'year') {
      state.from = ymd(new Date(n.getFullYear(), 0, 1));
      state.to   = ymd(new Date(n.getFullYear(), 11, 31));
    } else if (preset === 'all') {
      state.from = null; state.to = null;
    }
    state.preset = preset;
  }

  async function render(el) {
    applyPreset('month'); // default

    el.innerHTML = '<div class="page-header flex-between">' +
      '<div><div class="page-header-label">Finance · 財務</div>' +
      '<h1 class="page-title">Financial Overview</h1></div>' +
      '<div>' +
      '<button class="btn btn--outline mr-2" onclick="HM.adminPanels.finance._export(\'orders\')">📊 Orders CSV</button>' +
      '<button class="btn btn--outline" onclick="HM.adminPanels.finance._export(\'appointments\')">📊 Appts CSV</button>' +
      '</div></div>' +

      // Date range filter
      '<div class="card mb-4" style="padding: var(--s-4);">' +
      '<div class="text-label mb-2">Date Range · 日期區間</div>' +
      '<div class="filter-bar mb-3" id="fin-presets">' +
      preset('today',  '📅 Today · 今日') +
      preset('week',   'This Week · 本週') +
      preset('month',  'This Month · 本月', true) +
      preset('year',   'This Year · 今年') +
      preset('all',    'All-time · 全部') +
      preset('custom', '🗓 Custom · 自訂') +
      '</div>' +
      '<div id="fin-custom" style="display:none;" class="flex gap-2 flex-wrap" style="align-items:end;">' +
      '<div><label class="text-xs text-muted">From · 起</label><input type="date" id="fin-from" class="field-input field-input--boxed" style="margin:0;padding:6px 10px;"></div>' +
      '<div><label class="text-xs text-muted">To · 迄</label><input type="date" id="fin-to" class="field-input field-input--boxed" style="margin:0;padding:6px 10px;"></div>' +
      '<button class="btn btn--primary btn--sm" id="fin-apply">Apply · 套用</button>' +
      '</div>' +
      '<div class="text-xs text-muted mt-2" id="fin-range-label"></div>' +
      '</div>' +

      '<div id="fin-summary"></div>' +
      '<div id="fin-doctors" class="mt-6"></div>';

    // Wire preset buttons
    document.querySelectorAll('#fin-presets .filter-chip').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('#fin-presets .filter-chip').forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        var p = b.getAttribute('data-preset');
        if (p === 'custom') {
          document.getElementById('fin-custom').style.display = 'flex';
        } else {
          document.getElementById('fin-custom').style.display = 'none';
          applyPreset(p);
          load();
        }
      });
    });
    document.getElementById('fin-apply').addEventListener('click', function () {
      var from = document.getElementById('fin-from').value;
      var to   = document.getElementById('fin-to').value;
      if (!from || !to) { HM.ui.toast('Pick both from and to dates', 'warning'); return; }
      if (from > to)    { HM.ui.toast('From must be before To', 'warning'); return; }
      state.from = from; state.to = to; state.preset = 'custom';
      load();
    });

    await load();
  }

  function preset(value, label, active) {
    return '<button class="filter-chip' + (active ? ' is-active' : '') + '" data-preset="' + value + '">' + label + '</button>';
  }

  async function load() {
    var summaryEl = document.getElementById('fin-summary');
    var doctorsEl = document.getElementById('fin-doctors');
    var rangeLbl  = document.getElementById('fin-range-label');
    HM.state.loading(summaryEl);
    doctorsEl.innerHTML = '';

    rangeLbl.textContent = state.from || state.to
      ? 'Showing: ' + (state.from || 'beginning') + ' → ' + (state.to || 'today')
      : 'Showing: all-time';

    var qs = [];
    if (state.from) qs.push('from=' + state.from);
    if (state.to)   qs.push('to=' + state.to);
    var qsStr = qs.join('&');

    try {
      var results = await Promise.allSettled([
        HM.api.admin.financeOverview(qsStr),
        HM.api.admin.financeDoctorBreakdown(qsStr),
      ]);
      var ov  = results[0].status === 'fulfilled' ? results[0].value : {};
      var bd  = results[1].status === 'fulfilled' ? results[1].value : {};

      // Summary cards
      summaryEl.innerHTML =
        '<div class="stats-grid mb-4">' +
        statCard(HM.format.money(ov.total_revenue || 0),       'Total Revenue · 總收入', 'var(--gold)') +
        statCard(HM.format.money(ov.appointment_revenue || 0), 'Consultations · 問診', '#4a90d9') +
        statCard(HM.format.money(ov.order_revenue || 0),       'Orders · 訂單', 'var(--sage)') +
        statCard(HM.format.money(ov.pending_withdrawals || 0), 'Pending Payouts · 待付', 'var(--red-seal)') +
        '</div>';

      // Doctor breakdown
      renderDoctorTable(doctorsEl, bd);
    } catch (e) {
      summaryEl.innerHTML = '';
      HM.state.error(doctorsEl, e);
    }
  }

  function renderDoctorTable(host, bd) {
    var doctors = (bd && bd.doctors) || [];
    var summary = (bd && bd.summary) || {};

    var summaryRow =
      '<div class="flex-between mb-3" style="align-items: end;">' +
      '<div><div class="text-label">By Doctor · 按醫師統計</div>' +
      '<div class="text-xs text-muted mt-1">' + (summary.doctor_count || 0) + ' active doctor(s) · ' +
      (summary.visit_count || 0) + ' completed visit(s)</div></div>' +
      '<div style="text-align:right;">' +
      '<div class="text-xs text-muted">Total · 總計</div>' +
      '<div style="font-size: var(--text-xl); font-weight: 500; color: var(--gold);">' + HM.format.money(summary.total_revenue || 0) + '</div>' +
      '</div></div>';

    if (!doctors.length) {
      host.innerHTML = summaryRow + '<div class="card"><p class="text-muted text-center" style="padding: var(--s-5);">No completed appointments in this date range.</p></div>';
      return;
    }

    var rows = doctors.map(function (d, idx) {
      return '<tr>' +
        '<td data-label="Rank" style="font-family: var(--font-mono); color: var(--stone);">#' + (idx + 1) + '</td>' +
        '<td data-label="Doctor"><strong>' + HM.format.esc(d.doctor_name || ('#' + d.doctor_id)) + '</strong></td>' +
        '<td data-label="Visits" style="text-align: right;">' + d.visit_count + '</td>' +
        '<td data-label="Walk-in / Online" style="font-size: var(--text-xs); color: var(--stone);">🏥 ' + (d.walk_in_count || 0) + ' · 📹 ' + (d.online_count || 0) + '</td>' +
        '<td data-label="Consultation" style="text-align: right;">' + HM.format.money(d.consultation_revenue || 0) + '</td>' +
        '<td data-label="Treatments" style="text-align: right;">' + HM.format.money(d.treatment_revenue || 0) + '</td>' +
        '<td data-label="Total" style="text-align: right; font-weight: 600; color: var(--gold);">' + HM.format.money(d.total_revenue || 0) + '</td>' +
        '</tr>';
    }).join('');

    host.innerHTML = summaryRow +
      '<div class="card" style="padding: 0;">' +
      '<div class="table-wrap"><table class="table table--responsive">' +
      '<thead><tr><th>#</th><th>Doctor</th><th style="text-align:right;">Visits</th><th>Walk-in / Online</th><th style="text-align:right;">Consultation</th><th style="text-align:right;">Treatments</th><th style="text-align:right;">Total</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table></div>' +
      '</div>';
  }

  function statCard(num, label, color) {
    return '<div class="stat-card" style="border-left: 3px solid ' + (color || 'var(--gold)') + ';">' +
      '<div class="stat-number" style="font-size: var(--text-xl); color: ' + (color || 'var(--ink)') + ';">' + num + '</div>' +
      '<div class="stat-label">' + label + '</div></div>';
  }

  HM.adminPanels.finance = {
    render: render,
    _export: async function (entity) {
      try {
        var blob = await HM.api.admin.exportCsv(entity);
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = entity + '-' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click();
        URL.revokeObjectURL(url);
        HM.ui.toast('Exported', 'success');
      } catch (e) { HM.ui.toast(e.message, 'danger'); }
    },
  };
})();
