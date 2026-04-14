/**
 * Admin Finance — revenue, payouts, platform fees
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header flex-between">' +
      '<div><div class="page-header-label">Finance · 財務</div>' +
      '<h1 class="page-title">Financial Overview</h1></div>' +
      '<div>' +
      '<button class="btn btn--outline mr-2" onclick="HM.adminPanels.finance._export(\'orders\')">📊 Orders CSV</button>' +
      '<button class="btn btn--outline" onclick="HM.adminPanels.finance._export(\'appointments\')">📊 Appointments CSV</button>' +
      '</div></div>' +
      '<div id="fin-body"></div>';

    var body = document.getElementById('fin-body');
    HM.state.loading(body);
    try {
      var res = await HM.api.admin.financeOverview();
      var d = res || {};
      var rev = d.revenue || {};
      var payouts = d.payouts || {};
      var fees = d.fees || {};

      body.innerHTML =
        '<div class="stats-grid mb-6">' +
        stat(HM.format.money(rev.total || 0), 'Total Revenue · 總收入') +
        stat(HM.format.money(rev.last_30d || 0), 'Revenue 30 Days · 近30天') +
        stat(HM.format.money(fees.platform_total || 0), 'Platform Fees · 平台費') +
        stat(HM.format.money(payouts.total || 0), 'Paid to Staff · 已支付') +
        '</div>' +

        '<div class="grid-2 mb-6">' +
        '<div><div class="text-label mb-3">Revenue Breakdown · 收入明細</div>' +
        '<div class="card">' +
        row('Consultations', HM.format.money(rev.consultations || 0)) +
        row('Orders', HM.format.money(rev.orders || 0)) +
        row('POS Sales', HM.format.money(rev.pos || 0)) +
        row('Total', HM.format.money(rev.total || 0), true) +
        '</div></div>' +

        '<div><div class="text-label mb-3">Platform Fees · 平台費用</div>' +
        '<div class="card">' +
        row('Doctor Fees (15%)', HM.format.money(fees.doctor || 0)) +
        row('Pharmacy Fees (8%)', HM.format.money(fees.pharmacy || 0)) +
        row('Total Fees', HM.format.money(fees.platform_total || 0), true) +
        '</div></div>' +
        '</div>' +

        '<div class="text-label mb-3">Recent Transactions · 近期交易</div>' +
        '<div class="card" id="fin-recent"></div>';

      var recent = d.recent || [];
      var recentEl = document.getElementById('fin-recent');
      if (!recent.length) {
        recentEl.innerHTML = '<div class="text-center text-muted p-4">No recent transactions</div>';
      } else {
        var html = '<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Type</th><th>Description</th><th style="text-align:right;">Amount</th></tr></thead><tbody>';
        recent.forEach(function (t) {
          html += '<tr><td>' + HM.format.date(t.created_at) + '</td>' +
            '<td><span class="badge">' + (t.type || '') + '</span></td>' +
            '<td>' + HM.format.esc(t.description || '') + '</td>' +
            '<td style="text-align:right;">' + HM.format.money(t.amount || 0) + '</td></tr>';
        });
        html += '</tbody></table></div>';
        recentEl.innerHTML = html;
      }
    } catch (e) { HM.state.error(body, e); }
  }

  function stat(num, label) {
    return '<div class="stat-card"><div class="stat-number" style="font-size: var(--text-2xl);">' + num + '</div><div class="stat-label">' + label + '</div></div>';
  }

  function row(label, value, bold) {
    return '<div class="flex-between" style="padding: var(--s-2) 0; border-bottom: 1px solid var(--border); font-size: var(--text-sm);' + (bold ? 'font-weight:600;' : '') + '">' +
      '<span class="' + (bold ? '' : 'text-muted') + '">' + label + '</span><span>' + value + '</span></div>';
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
