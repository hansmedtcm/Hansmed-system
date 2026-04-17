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
      '<div id="fin-sources" class="mt-6"></div>' +
      '<div id="fin-doctors" class="mt-6"></div>' +
      '<div id="fin-pharmacies" class="mt-6"></div>';

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
    var sourcesEl = document.getElementById('fin-sources');
    var doctorsEl = document.getElementById('fin-doctors');
    var pharmsEl  = document.getElementById('fin-pharmacies');
    var rangeLbl  = document.getElementById('fin-range-label');
    HM.state.loading(summaryEl);
    sourcesEl.innerHTML = '';
    doctorsEl.innerHTML = '';
    pharmsEl.innerHTML  = '';

    rangeLbl.textContent = state.from || state.to
      ? 'Showing: ' + (state.from || 'beginning') + ' → ' + (state.to || 'today')
      : 'Showing: all-time';

    var qs = [];
    if (state.from) qs.push('from=' + state.from);
    if (state.to)   qs.push('to=' + state.to);
    var qsStr = qs.join('&');

    try {
      // Pull all four reports in parallel — each is independently useful,
      // and allSettled means a single endpoint failure doesn't blank the page.
      var results = await Promise.allSettled([
        HM.api.admin.financeOverview(qsStr),
        HM.api.admin.financeDoctorBreakdown(qsStr),
        HM.api.admin.financeRevenueBySource(qsStr),
        HM.api.admin.financePharmacyBreakdown(qsStr),
      ]);
      var ov  = results[0].status === 'fulfilled' ? results[0].value : {};
      var bd  = results[1].status === 'fulfilled' ? results[1].value : {};
      var src = results[2].status === 'fulfilled' ? results[2].value : {};
      var ph  = results[3].status === 'fulfilled' ? results[3].value : {};

      // Headline summary cards — use the source total as the authoritative
      // grand total since it covers teleconsult + walk-in + treatments + orders + POS.
      var grandTotal = src.total_revenue != null ? src.total_revenue : (ov.total_revenue || 0);
      summaryEl.innerHTML =
        '<div class="stats-grid mb-4">' +
        statCard(HM.format.money(grandTotal),                  'Total Revenue · 總收入', 'var(--gold)') +
        statCard(HM.format.money(ov.appointment_revenue || 0), 'Consultations · 問診',   '#4a90d9') +
        statCard(HM.format.money(ov.order_revenue || 0),       'Orders · 訂單',          'var(--sage)') +
        statCard(HM.format.money(ov.pending_withdrawals || 0), 'Pending Payouts · 待付', 'var(--red-seal)') +
        '</div>';

      renderSourceBreakdown(sourcesEl, src);
      renderDoctorTable(doctorsEl, bd);
      renderPharmacyTable(pharmsEl, ph);
    } catch (e) {
      summaryEl.innerHTML = '';
      HM.state.error(doctorsEl, e);
    }
  }

  // ── Revenue by income source ─────────────────────────────────────
  // Cards per source + horizontal stacked bar so the admin can see at
  // a glance which channel drives the most revenue.
  function renderSourceBreakdown(host, src) {
    var sources = (src && src.sources) || [];
    var total = (src && src.total_revenue) || 0;
    if (!sources.length) return;

    // Color per source key so the legend/bar stay consistent
    var palette = {
      teleconsult:  '#4a90d9',
      walkin:       'var(--gold)',
      treatments:   'var(--red-seal)',
      rx_orders:    'var(--sage)',
      shop_orders:  '#9b6bc8',
      pos:          '#e08e45',
    };

    // Stacked bar segments
    var bar = total > 0
      ? '<div class="fin-stackbar">' +
        sources.filter(function (s) { return s.amount > 0; }).map(function (s) {
          return '<div class="fin-stackbar-seg" style="width:' + s.pct + '%;background:' + (palette[s.key] || 'var(--stone)') + ';" ' +
            'title="' + HM.format.esc(s.label) + ' · ' + HM.format.money(s.amount) + ' (' + s.pct + '%)"></div>';
        }).join('') +
        '</div>'
      : '';

    // Cards per source
    var cards = sources.map(function (s) {
      var color = palette[s.key] || 'var(--stone)';
      return '<div class="fin-src-card" style="border-left-color:' + color + ';">' +
        '<div class="flex-between" style="align-items:start;">' +
          '<div>' +
            '<div class="fin-src-icon">' + s.icon + '</div>' +
            '<div class="fin-src-label">' + HM.format.esc(s.label) + '</div>' +
            '<div class="fin-src-label-zh" style="font-family: var(--font-zh);">' + HM.format.esc(s.label_zh) + '</div>' +
          '</div>' +
          '<div class="fin-src-pct" style="color:' + color + ';">' + s.pct + '%</div>' +
        '</div>' +
        '<div class="fin-src-amount" style="color:' + color + ';">' + HM.format.money(s.amount) + '</div>' +
        '<div class="fin-src-count text-xs text-muted">' + s.count + ' transaction' + (s.count === 1 ? '' : 's') + '</div>' +
        '</div>';
    }).join('');

    host.innerHTML =
      '<div class="flex-between mb-3"><div>' +
      '<div class="text-label">By Income Source · 按收入來源</div>' +
      '<div class="text-xs text-muted mt-1">Breakdown across teleconsult, walk-in, treatments, orders, and pharmacy POS.</div>' +
      '</div></div>' +
      bar +
      '<div class="fin-src-grid">' + cards + '</div>';

    injectSourceStyles();
  }

  // ── Pharmacy breakdown (cashier / POS sales per pharmacy) ──
  function renderPharmacyTable(host, ph) {
    var rows = (ph && ph.pharmacies) || [];
    var summary = (ph && ph.summary) || {};

    var summaryRow =
      '<div class="flex-between mb-3" style="align-items: end;">' +
      '<div><div class="text-label">By Pharmacy · 按藥房統計</div>' +
      '<div class="text-xs text-muted mt-1">' + (summary.pharmacy_count || 0) + ' pharmacy · ' +
      (summary.sale_count || 0) + ' POS sale(s) · POS acts as the cashier for walk-in + prescription dispensing.</div></div>' +
      '<div style="text-align:right;">' +
      '<div class="text-xs text-muted">Total · 總計</div>' +
      '<div style="font-size: var(--text-xl); font-weight: 500; color: var(--gold);">' + HM.format.money(summary.total_revenue || 0) + '</div>' +
      '</div></div>';

    if (!rows.length) {
      host.innerHTML = summaryRow + '<div class="card"><p class="text-muted text-center" style="padding: var(--s-5);">No POS sales in this date range. If the pos_sales table isn\'t created yet, pharmacy cashier data will appear once the first sale is made.</p></div>';
      return;
    }

    var body = rows.map(function (r, idx) {
      return '<tr>' +
        '<td data-label="Rank" style="font-family: var(--font-mono); color: var(--stone);">#' + (idx + 1) + '</td>' +
        '<td data-label="Pharmacy"><strong>' + HM.format.esc(r.pharmacy_name || ('#' + r.pharmacy_id)) + '</strong></td>' +
        '<td data-label="POS Sales" style="text-align: right;">' + r.sale_count + '</td>' +
        '<td data-label="Walk-in / Rx" style="font-size: var(--text-xs); color: var(--stone);">🛒 ' + (r.walk_in_count || 0) + ' · 💊 ' + (r.rx_count || 0) + '</td>' +
        '<td data-label="POS Revenue" style="text-align: right;">' + HM.format.money(r.pos_revenue || 0) + '</td>' +
        '<td data-label="Online Orders" style="text-align: right;">' + HM.format.money(r.online_revenue || 0) + '</td>' +
        '<td data-label="Total" style="text-align: right; font-weight: 600; color: var(--gold);">' + HM.format.money(r.total_revenue || 0) + '</td>' +
        '</tr>';
    }).join('');

    host.innerHTML = summaryRow +
      '<div class="card" style="padding: 0;">' +
      '<div class="table-wrap"><table class="table table--responsive">' +
      '<thead><tr><th>#</th><th>Pharmacy</th><th style="text-align:right;">POS</th><th>Walk-in / Rx</th><th style="text-align:right;">POS Revenue</th><th style="text-align:right;">Online Orders</th><th style="text-align:right;">Total</th></tr></thead>' +
      '<tbody>' + body + '</tbody>' +
      '</table></div></div>';
  }

  function injectSourceStyles() {
    if (document.getElementById('fin-src-style')) return;
    var s = document.createElement('style');
    s.id = 'fin-src-style';
    s.textContent =
      '.fin-stackbar{display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--border);margin-bottom:var(--s-4);}' +
      '.fin-stackbar-seg{height:100%;transition:opacity .15s ease;}' +
      '.fin-stackbar-seg:hover{opacity:.8;}' +
      '.fin-src-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:var(--s-3);}' +
      '.fin-src-card{background:var(--washi);border:1px solid var(--border);border-left:3px solid var(--stone);border-radius:var(--r-md);padding:var(--s-4);}' +
      '.fin-src-icon{font-size:1.4rem;}' +
      '.fin-src-label{font-weight:600;font-size:var(--text-sm);margin-top:4px;}' +
      '.fin-src-label-zh{font-size:var(--text-xs);color:var(--stone);}' +
      '.fin-src-amount{font-size:var(--text-xl);font-weight:500;margin-top:var(--s-2);line-height:1;}' +
      '.fin-src-count{margin-top:4px;}' +
      '.fin-src-pct{font-family:var(--font-mono);font-size:var(--text-base);font-weight:600;}';
    document.head.appendChild(s);
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
