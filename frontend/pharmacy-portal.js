/**
 * HansMed Pharmacy Portal
 * -----------------------
 * Injects a full pharmacy portal page into the DOM and wires it to the backend API.
 * Pharmacy users get: product catalog, inventory, incoming orders, dispensing, shipping, finance.
 */
(function () {
  'use strict';
  var A = window.HansMedAPI;
  if (!A) return;

  // ── Inject pharmacy page into DOM if it doesn't exist ──
  function ensurePharmacyPage() {
    if (document.getElementById('page-pharmacy')) return;
    var page = document.createElement('div');
    page.className = 'page';
    page.id = 'page-pharmacy';
    page.innerHTML = pharmacyPageHTML();
    // Insert before the closing pages area
    var pages = document.querySelectorAll('.page');
    var last = pages[pages.length - 1];
    if (last && last.parentNode) last.parentNode.insertBefore(page, last.nextSibling);
  }

  function pharmacyPageHTML() {
    return ''
      + '<section style="padding:6rem 3.5rem 3rem;min-height:100vh;background:var(--cream);">'
      + '  <div class="section-label">藥房端 Pharmacy Portal</div>'
      + '  <h1 style="animation:none;opacity:1;font-size:clamp(1.8rem,3vw,2.8rem);">Pharmacy <em>Management</em></h1>'
      + '  <p style="color:var(--stone);margin-bottom:2rem;">Manage your product catalog, fulfill orders, and track finances.</p>'
      + '  <div style="display:flex;gap:0;border-bottom:2px solid var(--mist);margin-bottom:2rem;flex-wrap:wrap;">'
      + '    <button class="pharm-tab active" onclick="showPharmPanel(\'ph-dashboard\',this)">📊 Dashboard</button>'
      + '    <button class="pharm-tab" onclick="showPharmPanel(\'ph-products\',this)">📦 Products</button>'
      + '    <button class="pharm-tab" onclick="showPharmPanel(\'ph-orders\',this)">📋 Orders</button>'
      + '    <button class="pharm-tab" onclick="showPharmPanel(\'ph-finance\',this)">💰 Finance</button>'
      + '  </div>'
      + '  <div id="ph-dashboard" class="pharm-panel active">' + dashboardHTML() + '</div>'
      + '  <div id="ph-products" class="pharm-panel" style="display:none;"></div>'
      + '  <div id="ph-orders" class="pharm-panel" style="display:none;"></div>'
      + '  <div id="ph-finance" class="pharm-panel" style="display:none;"></div>'
      + '</section>'
      + '<style>'
      + '.pharm-tab{background:none;border:none;padding:.7rem 1.5rem;font-family:"Source Sans 3",sans-serif;font-size:.78rem;letter-spacing:.15em;text-transform:uppercase;color:var(--stone);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .3s;}'
      + '.pharm-tab.active,.pharm-tab:hover{color:var(--ink);border-bottom-color:var(--gold);}'
      + '.pharm-panel{display:none;}.pharm-panel.active{display:block;}'
      + '.ph-card{background:var(--washi);border:1px solid var(--mist);padding:1.2rem;margin-bottom:.8rem;display:flex;justify-content:space-between;align-items:center;}'
      + '.ph-card-title{font-family:"Noto Serif SC",serif;font-size:1rem;color:var(--ink);}'
      + '.ph-card-sub{font-size:.78rem;color:var(--stone);margin-top:.2rem;}'
      + '.ph-btn{padding:.4rem 1rem;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;border:1px solid var(--ink);background:var(--ink);color:var(--washi);cursor:pointer;transition:all .3s;}'
      + '.ph-btn:hover{background:transparent;color:var(--ink);}'
      + '.ph-btn-outline{padding:.4rem 1rem;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;border:1px solid var(--mist);background:transparent;color:var(--stone);cursor:pointer;}'
      + '.ph-btn-outline:hover{border-color:var(--ink);color:var(--ink);}'
      + '.ph-stat{text-align:center;padding:1.5rem;background:var(--washi);border:1px solid var(--mist);}'
      + '.ph-stat-num{font-family:"Cormorant Garamond",serif;font-size:2rem;color:var(--ink);}'
      + '.ph-stat-label{font-size:.68rem;letter-spacing:.15em;text-transform:uppercase;color:var(--stone);margin-top:.3rem;}'
      + '</style>';
  }

  function dashboardHTML() {
    return '<div id="ph-dash-content" style="color:var(--stone);">Loading dashboard...</div>';
  }

  // ── Tab switching ──
  window.showPharmPanel = function (id, btn) {
    document.querySelectorAll('.pharm-panel').forEach(function (p) { p.style.display = 'none'; p.classList.remove('active'); });
    document.querySelectorAll('.pharm-tab').forEach(function (t) { t.classList.remove('active'); });
    var el = document.getElementById(id);
    if (el) { el.style.display = 'block'; el.classList.add('active'); }
    if (btn) btn.classList.add('active');

    if (id === 'ph-dashboard') loadPhDashboard();
    if (id === 'ph-products')  loadPhProducts();
    if (id === 'ph-orders')    loadPhOrders();
    if (id === 'ph-finance')   loadPhFinance();
  };

  // ── Dashboard ──
  async function loadPhDashboard() {
    var el = document.getElementById('ph-dash-content');
    if (!el) return;
    try {
      var [orders, products, summary] = await Promise.allSettled([
        A.pharmacy.listOrders(),
        A.pharmacy.listProducts(),
        A.pharmacy.getSummary('month'),
      ]);
      var orderData = orders.status === 'fulfilled' ? (orders.value.data || []) : [];
      var prodData = products.status === 'fulfilled' ? (products.value.data || []) : [];
      var sumData = summary.status === 'fulfilled' ? summary.value : {};

      var pending = orderData.filter(function (o) { return o.status === 'paid'; }).length;
      var dispensing = orderData.filter(function (o) { return o.status === 'dispensing'; }).length;

      el.innerHTML = ''
        + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:2rem;">'
        + '  <div class="ph-stat"><div class="ph-stat-num">' + prodData.length + '</div><div class="ph-stat-label">Products · 產品</div></div>'
        + '  <div class="ph-stat"><div class="ph-stat-num">' + pending + '</div><div class="ph-stat-label">Pending Orders · 待處理</div></div>'
        + '  <div class="ph-stat"><div class="ph-stat-num">' + dispensing + '</div><div class="ph-stat-label">Dispensing · 配藥中</div></div>'
        + '  <div class="ph-stat"><div class="ph-stat-num">RM ' + parseFloat(sumData.gross_revenue || 0).toFixed(0) + '</div><div class="ph-stat-label">Revenue (Month) · 月收入</div></div>'
        + '</div>'
        + '<h3>Recent Orders · 最新訂單</h3>'
        + (orderData.length ? orderData.slice(0, 5).map(orderCard).join('') : '<p style="color:var(--stone);">No orders yet · 暫無訂單</p>');
    } catch (e) { el.innerHTML = '<p style="color:var(--red-seal);">Failed to load dashboard</p>'; }
  }

  // ── Products ──
  async function loadPhProducts() {
    var el = document.getElementById('ph-products');
    if (!el) return;
    try {
      var res = await A.pharmacy.listProducts();
      var items = res.data || [];
      el.innerHTML = ''
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">'
        + '  <h3>Product Catalog · 產品目錄</h3>'
        + '  <button class="ph-btn" onclick="showAddProduct()">+ Add Product · 新增產品</button>'
        + '</div>'
        + '<div id="ph-add-product-form" style="display:none;background:var(--washi);padding:1.5rem;margin-bottom:1.5rem;border:1px solid var(--mist);">'
        + '  <h4 style="margin-bottom:1rem;">Add New Product · 新增產品</h4>'
        + '  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;">'
        + '    <div><label style="font-size:.68rem;letter-spacing:.12em;color:var(--gold);text-transform:uppercase;">Name · 名稱</label><input id="ph-p-name" class="fi" style="width:100%;padding:.5rem 0;border:none;border-bottom:1px solid var(--mist);background:transparent;outline:none;"></div>'
        + '    <div><label style="font-size:.68rem;letter-spacing:.12em;color:var(--gold);text-transform:uppercase;">Unit Price (RM) · 單價</label><input id="ph-p-price" type="number" step="0.01" class="fi" style="width:100%;padding:.5rem 0;border:none;border-bottom:1px solid var(--mist);background:transparent;outline:none;"></div>'
        + '    <div><label style="font-size:.68rem;letter-spacing:.12em;color:var(--gold);text-transform:uppercase;">Initial Stock · 初始庫存</label><input id="ph-p-stock" type="number" class="fi" style="width:100%;padding:.5rem 0;border:none;border-bottom:1px solid var(--mist);background:transparent;outline:none;"></div>'
        + '    <div><label style="font-size:.68rem;letter-spacing:.12em;color:var(--gold);text-transform:uppercase;">Unit · 單位</label><input id="ph-p-unit" value="g" class="fi" style="width:100%;padding:.5rem 0;border:none;border-bottom:1px solid var(--mist);background:transparent;outline:none;"></div>'
        + '    <div><label style="font-size:.68rem;letter-spacing:.12em;color:var(--gold);text-transform:uppercase;">SKU</label><input id="ph-p-sku" class="fi" style="width:100%;padding:.5rem 0;border:none;border-bottom:1px solid var(--mist);background:transparent;outline:none;"></div>'
        + '  </div>'
        + '  <div style="margin-top:1rem;display:flex;gap:.5rem;">'
        + '    <button class="ph-btn" onclick="saveNewProduct()">Save · 儲存</button>'
        + '    <button class="ph-btn-outline" onclick="hideAddProduct()">Cancel · 取消</button>'
        + '  </div>'
        + '</div>'
        + (items.length ? items.map(productCard).join('') : '<p style="color:var(--stone);">No products yet. Add your first product! · 暫無產品，請新增！</p>');
    } catch (e) { el.innerHTML = '<p style="color:var(--red-seal);">Failed to load products</p>'; }
  }

  function productCard(p) {
    var inv = p.inventory || {};
    var stock = parseFloat(inv.quantity_on_hand || 0);
    var stockColor = stock <= parseFloat(inv.reorder_threshold || 0) ? 'var(--red-seal)' : 'var(--sage)';
    return '<div class="ph-card">'
      + '<div><div class="ph-card-title">' + p.name + '</div>'
      + '<div class="ph-card-sub">RM ' + parseFloat(p.unit_price).toFixed(2) + ' / ' + p.unit
      + (p.sku ? ' · SKU: ' + p.sku : '') + '</div></div>'
      + '<div style="display:flex;align-items:center;gap:1rem;">'
      + '<div style="text-align:right;"><div style="font-size:1.1rem;font-weight:600;color:' + stockColor + ';">' + stock + '</div><div style="font-size:.65rem;color:var(--stone);">in stock</div></div>'
      + '<button class="ph-btn-outline" onclick="adjustStock(' + p.id + ',\'' + p.name + '\',' + stock + ')">± Stock</button>'
      + '</div></div>';
  }

  window.showAddProduct = function () { document.getElementById('ph-add-product-form').style.display = 'block'; };
  window.hideAddProduct = function () { document.getElementById('ph-add-product-form').style.display = 'none'; };

  window.saveNewProduct = async function () {
    var name = document.getElementById('ph-p-name').value;
    var price = document.getElementById('ph-p-price').value;
    var stock = document.getElementById('ph-p-stock').value;
    var unit = document.getElementById('ph-p-unit').value || 'g';
    var sku = document.getElementById('ph-p-sku').value;
    if (!name || !price) { showToast('Name and price are required · 名稱和價格為必填'); return; }
    try {
      await A.pharmacy.createProduct({ name: name, unit_price: parseFloat(price), unit: unit, sku: sku, initial_stock: parseFloat(stock || 0) });
      showToast('Product added! · 產品已新增 ✓');
      hideAddProduct();
      loadPhProducts();
    } catch (e) { showToast(e.message || 'Failed to add product'); }
  };

  window.adjustStock = function (productId, name, currentStock) {
    var qty = prompt('Adjust stock for "' + name + '" (current: ' + currentStock + ')\nEnter positive to add, negative to remove:');
    if (qty === null || qty === '') return;
    var num = parseFloat(qty);
    if (isNaN(num)) { showToast('Invalid number'); return; }
    A.pharmacy.adjustStock(productId, { change_qty: num, reason: 'adjustment' })
      .then(function () { showToast('Stock updated! · 庫存已更新 ✓'); loadPhProducts(); })
      .catch(function (e) { showToast(e.message || 'Failed to update stock'); });
  };

  // ── Orders ──
  async function loadPhOrders() {
    var el = document.getElementById('ph-orders');
    if (!el) return;
    try {
      var res = await A.pharmacy.listOrders();
      var items = res.data || [];
      el.innerHTML = ''
        + '<h3>Order Management · 訂單管理</h3>'
        + '<div style="display:flex;gap:.5rem;margin:1rem 0;flex-wrap:wrap;">'
        + '  <button class="ph-btn-outline" onclick="filterPhOrders(\'\')">All · 全部</button>'
        + '  <button class="ph-btn-outline" onclick="filterPhOrders(\'paid\')">New · 新訂單</button>'
        + '  <button class="ph-btn-outline" onclick="filterPhOrders(\'dispensing\')">Dispensing · 配藥中</button>'
        + '  <button class="ph-btn-outline" onclick="filterPhOrders(\'shipped\')">Shipped · 已寄出</button>'
        + '</div>'
        + '<div id="ph-orders-list">'
        + (items.length ? items.map(orderCard).join('') : '<p style="color:var(--stone);">No orders yet · 暫無訂單</p>')
        + '</div>';
    } catch (e) { el.innerHTML = '<p style="color:var(--red-seal);">Failed to load orders</p>'; }
  }

  function orderCard(o) {
    var itemNames = (o.items || []).map(function (i) { return i.drug_name; }).join(', ');
    var actions = '';
    if (o.status === 'paid') {
      actions = '<button class="ph-btn" onclick="startDispense(' + o.id + ')">Start Dispensing · 開始配藥</button>';
    } else if (o.status === 'dispensing') {
      actions = '<button class="ph-btn" onclick="finishDispense(' + o.id + ')">Mark Dispensed · 完成配藥</button>';
    } else if (o.status === 'dispensed') {
      actions = '<button class="ph-btn" onclick="shipOrder(' + o.id + ')">Ship · 寄出</button>';
    }
    var statusColors = { paid: 'var(--gold)', dispensing: 'orange', dispensed: 'var(--sage)', shipped: '#4a90d9', delivered: 'var(--sage)' };
    return '<div class="ph-card" style="flex-direction:column;align-items:stretch;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;">'
      + '  <div><div class="ph-card-title">' + o.order_no + '</div>'
      + '  <div class="ph-card-sub">' + itemNames + '</div></div>'
      + '  <div style="text-align:right;"><div style="font-size:1.1rem;font-weight:600;">RM ' + parseFloat(o.total).toFixed(2) + '</div>'
      + '  <div style="font-size:.72rem;color:' + (statusColors[o.status] || 'var(--stone)') + ';text-transform:uppercase;">' + o.status.replace(/_/g, ' ') + '</div></div>'
      + '</div>'
      + (actions ? '<div style="margin-top:.8rem;text-align:right;">' + actions + '</div>' : '')
      + '</div>';
  }

  window.filterPhOrders = async function (status) {
    try {
      var res = await A.pharmacy.listOrders(status ? 'status=' + status : '');
      var el = document.getElementById('ph-orders-list');
      var items = res.data || [];
      el.innerHTML = items.length ? items.map(orderCard).join('') : '<p style="color:var(--stone);">No orders in this category · 此分類暫無訂單</p>';
    } catch {}
  };

  window.startDispense = async function (id) {
    try { await A.pharmacy.startDispense(id); showToast('Dispensing started · 已開始配藥'); loadPhOrders(); } catch (e) { showToast(e.message); }
  };
  window.finishDispense = async function (id) {
    try { await A.pharmacy.finishDispense(id); showToast('Dispensed! · 配藥完成 ✓'); loadPhOrders(); } catch (e) { showToast(e.message); }
  };
  window.shipOrder = function (id) {
    var carrier = prompt('Carrier name (e.g. J&T, Pos Laju):');
    if (!carrier) return;
    var tracking = prompt('Tracking number:');
    if (!tracking) return;
    A.pharmacy.shipOrder(id, { carrier: carrier, tracking_no: tracking })
      .then(function () { showToast('Shipped! · 已寄出 ✓'); loadPhOrders(); })
      .catch(function (e) { showToast(e.message); });
  };

  // ── Finance ──
  async function loadPhFinance() {
    var el = document.getElementById('ph-finance');
    if (!el) return;
    try {
      var [summary, daily] = await Promise.allSettled([
        A.pharmacy.getSummary('month'),
        A.pharmacy.getDailyBreakdown(),
      ]);
      var s = summary.status === 'fulfilled' ? summary.value : {};
      var days = daily.status === 'fulfilled' ? (daily.value.days || []) : [];

      el.innerHTML = ''
        + '<h3>Financial Summary · 財務摘要</h3>'
        + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:1.5rem 0;">'
        + '  <div class="ph-stat"><div class="ph-stat-num">RM ' + parseFloat(s.gross_revenue || 0).toFixed(2) + '</div><div class="ph-stat-label">Gross Revenue · 總收入</div></div>'
        + '  <div class="ph-stat"><div class="ph-stat-num">RM ' + parseFloat(s.platform_fee || 0).toFixed(2) + '</div><div class="ph-stat-label">Platform Fee (' + ((s.platform_fee_rate || 0) * 100) + '%) · 平台費</div></div>'
        + '  <div class="ph-stat"><div class="ph-stat-num">RM ' + parseFloat(s.available_balance || 0).toFixed(2) + '</div><div class="ph-stat-label">Available · 可提取</div></div>'
        + '</div>'
        + '<h4 style="margin:1.5rem 0 .8rem;">Daily Breakdown · 每日明細</h4>'
        + (days.length
          ? '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:.85rem;">'
            + '<tr style="border-bottom:2px solid var(--mist);"><th style="text-align:left;padding:.5rem;color:var(--gold);font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;">Date</th><th style="text-align:center;padding:.5rem;color:var(--gold);font-size:.68rem;letter-spacing:.12em;">Orders</th><th style="text-align:right;padding:.5rem;color:var(--gold);font-size:.68rem;letter-spacing:.12em;">Revenue</th></tr>'
            + days.map(function (d) { return '<tr style="border-bottom:1px solid var(--mist);"><td style="padding:.5rem;">' + d.day + '</td><td style="text-align:center;padding:.5rem;">' + d.orders + '</td><td style="text-align:right;padding:.5rem;">RM ' + parseFloat(d.gross).toFixed(2) + '</td></tr>'; }).join('')
            + '</table></div>'
          : '<p style="color:var(--stone);">No data yet · 暫無數據</p>'
        );
    } catch (e) { el.innerHTML = '<p style="color:var(--red-seal);">Failed to load finance data</p>'; }
  }

  // ── Hook into page navigation ──
  var _origShowPage = window.showPage;
  window.showPage = function (p) {
    if (p === 'pharmacy') {
      ensurePharmacyPage();
    }
    if (typeof _origShowPage === 'function') _origShowPage(p);
    if (p === 'pharmacy') loadPhDashboard();
  };

  // ── Update login to route pharmacy users ──
  var _origLoginSuccess = window.loginSuccess;
  window.loginSuccess = function (user) {
    if (typeof _origLoginSuccess === 'function') _origLoginSuccess(user);
    if (user.role === 'pharmacy') {
      var navPortal = document.getElementById('nav-portal');
      if (navPortal) {
        navPortal.textContent = 'Pharmacy · 藥房';
        navPortal.setAttribute('onclick', "showPage('pharmacy')");
      }
    }
  };

  console.log('[HansMed] Pharmacy portal loaded');
})();
