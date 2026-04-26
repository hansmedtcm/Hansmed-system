/**
 * Pharmacy Dashboard
 */
(function () {
  'use strict';
  HM.pharmPanels = HM.pharmPanels || {};

  async function render(el) {
    HM.state.loading(el);
    try {
      var r = await Promise.allSettled([
        HM.api.pharmacy.listOrders(),
        HM.api.pharmacy.listProducts(),
        HM.api.pharmacy.posDaily(),
        HM.api.pharmacy.getSummary('month'),
      ]);
      var orders = r[0].status === 'fulfilled' ? (r[0].value.data || []) : [];
      var products = r[1].status === 'fulfilled' ? (r[1].value.data || []) : [];
      var posDaily = r[2].status === 'fulfilled' ? r[2].value : {};
      var recon = r[3].status === 'fulfilled' ? r[3].value : {};

      var pending = orders.filter(function (o) { return o.status === 'paid'; }).length;
      var dispensing = orders.filter(function (o) { return o.status === 'dispensing'; }).length;
      var lowStock = products.filter(function (p) {
        return p.inventory && parseFloat(p.inventory.quantity_on_hand) <= parseFloat(p.inventory.reorder_threshold);
      }).length;

      el.innerHTML = '<div class="page-header">' +
        '<div class="page-header-label">Dashboard · 總覽</div>' +
        '<h1 class="page-title">Pharmacy Operations</h1>' +
        '</div>' +
        '<div class="stats-grid mb-6">' +
        stat(products.length, 'Products · 產品') +
        stat(pending, 'Pending Orders · 待處理') +
        stat(dispensing, 'Dispensing · 配藥中') +
        stat(HM.format.moneyShort(recon.gross_revenue), 'Revenue (Month) · 月收入') +
        '</div>' +
        '<div class="grid-2 mb-6">' +
        posCard(posDaily) +
        alertsCard(lowStock) +
        '</div>' +
        '<div class="text-label mb-3">Quick Actions</div>' +
        '<div class="grid-auto" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">' +
        action('🧾', 'Open POS', '#/pos') +
        action('📋', 'Prescription Inbox', '#/inbox') +
        action('💊', 'Manage Products', '#/products') +
        action('💰', 'Finance', '#/finance') +
        '</div>';
    } catch (e) { HM.state.error(el, e); }
  }

  function stat(num, label) {
    return '<div class="stat-card"><div class="stat-number">' + num + '</div><div class="stat-label">' + label + '</div></div>';
  }

  function posCard(p) {
    var by = p.by_method || {};
    return '<div><div class="text-label mb-3">POS Today · 今日收銀</div>' +
      '<div class="card">' +
      '<div class="flex-between mb-2"><span class="text-muted">Total Sales</span><strong>' + (p.total_sales || 0) + '</strong></div>' +
      '<div class="flex-between mb-2"><span class="text-muted">Revenue</span><strong style="color: var(--gold);">' + HM.format.money(p.total_revenue) + '</strong></div>' +
      '<div class="flex-between text-sm mb-1"><span class="text-muted">Cash</span><span>' + HM.format.money(by.cash) + '</span></div>' +
      '<div class="flex-between text-sm mb-1"><span class="text-muted">Card</span><span>' + HM.format.money(by.card) + '</span></div>' +
      '<div class="flex-between text-sm"><span class="text-muted">E-wallet</span><span>' + HM.format.money(by.ewallet) + '</span></div>' +
      '<button class="btn btn--outline btn--sm btn--block mt-3" onclick="location.hash=\'#/pos\'">Open POS · 開啟收銀</button>' +
      '</div></div>';
  }

  function alertsCard(lowStock) {
    return '<div><div class="text-label mb-3">Alerts · 提醒</div>' +
      '<div class="card">' +
      (lowStock > 0 ?
        '<div class="alert alert--warning" style="margin: 0;"><div class="alert-icon">⚠</div><div class="alert-body"><strong>' + lowStock + '</strong> products below reorder threshold</div></div>' :
        '<p class="text-muted text-center">✓ All inventory levels are healthy</p>'
      ) +
      '<button class="btn btn--outline btn--sm btn--block mt-3" onclick="location.hash=\'#/products\'">View Inventory</button>' +
      '</div></div>';
  }

  function action(icon, t, href) {
    return '<div class="card card--clickable text-center" onclick="location.hash=\'' + href + '\'">' +
      '<div style="font-size: 2rem; margin-bottom: var(--s-2);">' + icon + '</div>' +
      '<div style="font-family: var(--font-display);">' + t + '</div></div>';
  }

  HM.pharmPanels.dashboard = { render: render };
})();
