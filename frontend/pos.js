/**
 * HansMed POS (Point of Sale) System
 * ------------------------------------
 * Full cashier interface for walk-in payments, OTC sales,
 * prescription dispensing, and receipt generation.
 * Accessible to pharmacy role users.
 */
(function () {
  'use strict';
  var A = window.HansMedAPI;
  if (!A) return;

  var _posProducts = [];
  var _posCart = [];
  var _lastSale = null;

  // ── Inject POS tab into pharmacy portal ──
  function injectPosTab() {
    var tabBar = document.querySelector('#page-pharmacy .pharm-tab')?.parentElement;
    if (!tabBar || document.getElementById('pos-tab-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'pos-tab-btn';
    btn.className = 'pharm-tab';
    btn.textContent = '🧾 POS';
    btn.onclick = function () { window.showPharmPanel('ph-pos', btn); };
    tabBar.appendChild(btn);

    var panel = document.createElement('div');
    panel.id = 'ph-pos';
    panel.className = 'pharm-panel';
    panel.style.display = 'none';
    var container = tabBar.parentElement;
    container.appendChild(panel);
  }

  // ── Hook into pharmacy page ──
  var _origShowPharmPanel = window.showPharmPanel;
  window.showPharmPanel = function (id, btn) {
    if (typeof _origShowPharmPanel === 'function') _origShowPharmPanel(id, btn);
    if (id === 'ph-pos') loadPOS();
  };

  var _origShowPage = window.showPage;
  window.showPage = function (p) {
    if (typeof _origShowPage === 'function') _origShowPage(p);
    if (p === 'pharmacy') setTimeout(injectPosTab, 100);
  };

  // ── POS Interface ──
  async function loadPOS() {
    var el = document.getElementById('ph-pos');
    if (!el) return;

    // Load products
    try {
      var res = await A.api.get('/pharmacy/pos/products');
      _posProducts = res || [];
    } catch { _posProducts = []; }

    _posCart = [];
    renderPOS(el);
  }

  function renderPOS(el) {
    el.innerHTML = ''
      + '<div style="display:grid;grid-template-columns:1.2fr 1fr;gap:1.5rem;min-height:60vh;">'
      // Left: Product search + grid
      + '<div>'
      + '  <div style="display:flex;gap:.8rem;margin-bottom:1rem;">'
      + '    <input id="pos-search" type="text" placeholder="Search product or scan barcode · 搜尋產品或掃描條碼" style="flex:1;padding:.7rem;border:1px solid var(--mist);background:var(--washi);outline:none;font-size:.9rem;" oninput="filterPosProducts(this.value)">'
      + '    <select id="pos-sale-type" style="padding:.5rem;border:1px solid var(--mist);background:var(--washi);outline:none;font-size:.82rem;">'
      + '      <option value="walk_in">Walk-in · 散客</option>'
      + '      <option value="otc">OTC Sale · 成藥</option>'
      + '      <option value="prescription">Prescription · 處方藥</option>'
      + '    </select>'
      + '  </div>'
      + '  <div id="pos-product-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;max-height:55vh;overflow-y:auto;">'
      + renderProductGrid(_posProducts)
      + '  </div>'
      + '</div>'
      // Right: Cart + payment
      + '<div style="background:var(--washi);border:1px solid var(--mist);padding:1.2rem;display:flex;flex-direction:column;">'
      + '  <div style="font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:.8rem;">Current Sale · 當前交易</div>'
      + '  <div style="margin-bottom:.5rem;"><input id="pos-patient" placeholder="Patient name (optional) · 患者姓名（選填）" style="width:100%;padding:.5rem;border:1px solid var(--mist);background:transparent;outline:none;font-size:.85rem;"></div>'
      + '  <div id="pos-cart-items" style="flex:1;overflow-y:auto;margin-bottom:1rem;">'
      + '    <div style="text-align:center;padding:2rem;color:var(--stone);font-size:.85rem;">Add items to start · 新增商品開始</div>'
      + '  </div>'
      + '  <div style="border-top:1px solid var(--mist);padding-top:.8rem;">'
      + '    <div style="display:flex;justify-content:space-between;font-size:1.1rem;font-weight:600;margin-bottom:.8rem;">'
      + '      <span>Total · 總計</span><span id="pos-total">RM 0.00</span>'
      + '    </div>'
      + '    <div style="font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);margin-bottom:.5rem;">Payment Method · 付款方式</div>'
      + '    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem;margin-bottom:.8rem;">'
      + posPayBtn('cash', '💵', 'Cash')
      + posPayBtn('card', '💳', 'Card')
      + posPayBtn('ewallet_tng', '🔵', 'TNG')
      + posPayBtn('ewallet_grab', '🟢', 'Grab')
      + posPayBtn('ewallet_shopee', '🟠', 'Shopee')
      + posPayBtn('fpx', '🏦', 'FPX')
      + '    </div>'
      + '    <div id="pos-cash-input" style="display:none;margin-bottom:.5rem;">'
      + '      <input id="pos-received" type="number" placeholder="Amount received · 收款金額" style="width:100%;padding:.5rem;border:1px solid var(--mist);background:transparent;outline:none;" oninput="calcPosChange()">'
      + '      <div id="pos-change" style="font-size:.85rem;color:var(--sage);margin-top:.3rem;"></div>'
      + '    </div>'
      + '    <button class="btn-primary" style="width:100%;padding:.8rem;" onclick="completePOSSale()">Complete Sale · 完成交易</button>'
      + '    <button class="btn-ghost" style="margin-top:.5rem;width:100%;justify-content:center;" onclick="clearPOSCart()">Clear · 清除</button>'
      + '  </div>'
      + '</div>'
      + '</div>'
      // Daily summary bar
      + '<div id="pos-daily-bar" style="margin-top:1.5rem;"></div>';

    loadDailySummary();
  }

  function renderProductGrid(products) {
    if (!products.length) return '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--stone);">No products found · 沒有找到產品</div>';
    return products.map(function (p) {
      var inv = p.inventory || {};
      var stock = parseFloat(inv.quantity_on_hand || 0);
      var lowStock = stock <= 5;
      return '<div onclick="addToPOSCart(' + p.id + ')" style="background:var(--cream);border:1px solid var(--mist);padding:.8rem;cursor:pointer;transition:all .2s;position:relative;" onmouseenter="this.style.borderColor=\'var(--gold)\'" onmouseleave="this.style.borderColor=\'var(--mist)\'">'
        + '<div style="font-size:.88rem;color:var(--ink);font-weight:500;margin-bottom:.2rem;">' + p.name + '</div>'
        + '<div style="font-size:.78rem;color:var(--stone);">' + (p.specification || p.unit) + '</div>'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:.4rem;">'
        + '  <span style="font-size:1rem;font-weight:600;color:var(--ink);">RM ' + parseFloat(p.unit_price).toFixed(2) + '</span>'
        + '  <span style="font-size:.68rem;color:' + (lowStock ? 'var(--red-seal)' : 'var(--stone)') + ';">' + stock + ' left</span>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  function posPayBtn(method, icon, label) {
    return '<button class="pos-pay-btn" data-method="' + method + '" onclick="selectPosPayment(\'' + method + '\')" '
      + 'style="padding:.5rem;border:1.5px solid var(--mist);background:transparent;cursor:pointer;text-align:center;transition:all .2s;font-size:.75rem;">'
      + '<div style="font-size:1.2rem;">' + icon + '</div>' + label + '</button>';
  }

  var _posPayMethod = null;

  window.selectPosPayment = function (method) {
    _posPayMethod = method;
    document.querySelectorAll('.pos-pay-btn').forEach(function (b) {
      b.style.borderColor = 'var(--mist)'; b.style.background = 'transparent';
    });
    var chosen = document.querySelector('.pos-pay-btn[data-method="' + method + '"]');
    if (chosen) { chosen.style.borderColor = 'var(--gold)'; chosen.style.background = 'var(--washi-dark)'; }
    var cashInput = document.getElementById('pos-cash-input');
    if (cashInput) cashInput.style.display = method === 'cash' ? 'block' : 'none';
  };

  window.filterPosProducts = function (val) {
    var filtered = _posProducts.filter(function (p) {
      var s = val.toLowerCase();
      return p.name.toLowerCase().indexOf(s) >= 0 || (p.sku || '').toLowerCase().indexOf(s) >= 0;
    });
    var grid = document.getElementById('pos-product-grid');
    if (grid) grid.innerHTML = renderProductGrid(filtered);
  };

  window.addToPOSCart = function (productId) {
    var p = _posProducts.find(function (x) { return x.id === productId; });
    if (!p) return;
    var existing = _posCart.find(function (c) { return c.product_id === productId; });
    if (existing) {
      existing.quantity++;
    } else {
      _posCart.push({ product_id: p.id, name: p.name, unit_price: parseFloat(p.unit_price), quantity: 1, unit: p.unit });
    }
    renderPOSCart();
  };

  window.updatePosQty = function (productId, delta) {
    var item = _posCart.find(function (c) { return c.product_id === productId; });
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) {
      _posCart = _posCart.filter(function (c) { return c.product_id !== productId; });
    }
    renderPOSCart();
  };

  window.removePosItem = function (productId) {
    _posCart = _posCart.filter(function (c) { return c.product_id !== productId; });
    renderPOSCart();
  };

  function renderPOSCart() {
    var el = document.getElementById('pos-cart-items');
    var totalEl = document.getElementById('pos-total');
    if (!el) return;
    if (!_posCart.length) {
      el.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--stone);font-size:.85rem;">Add items to start · 新增商品開始</div>';
      if (totalEl) totalEl.textContent = 'RM 0.00';
      return;
    }
    var total = 0;
    el.innerHTML = _posCart.map(function (item) {
      var line = item.unit_price * item.quantity;
      total += line;
      return '<div style="display:flex;align-items:center;gap:.5rem;padding:.5rem 0;border-bottom:1px solid var(--mist);">'
        + '<div style="flex:1;"><div style="font-size:.85rem;color:var(--ink);">' + item.name + '</div>'
        + '<div style="font-size:.72rem;color:var(--stone);">RM ' + item.unit_price.toFixed(2) + ' × ' + item.quantity + '</div></div>'
        + '<div style="display:flex;align-items:center;gap:.3rem;">'
        + '<button onclick="updatePosQty(' + item.product_id + ',-1)" style="width:24px;height:24px;border:1px solid var(--mist);background:transparent;cursor:pointer;font-size:.9rem;">−</button>'
        + '<span style="font-size:.85rem;min-width:20px;text-align:center;">' + item.quantity + '</span>'
        + '<button onclick="updatePosQty(' + item.product_id + ',1)" style="width:24px;height:24px;border:1px solid var(--mist);background:transparent;cursor:pointer;font-size:.9rem;">+</button>'
        + '</div>'
        + '<div style="min-width:70px;text-align:right;font-size:.9rem;font-weight:600;">RM ' + line.toFixed(2) + '</div>'
        + '<button onclick="removePosItem(' + item.product_id + ')" style="background:none;border:none;cursor:pointer;color:var(--red-seal);font-size:.9rem;">✕</button>'
        + '</div>';
    }).join('');
    if (totalEl) totalEl.textContent = 'RM ' + total.toFixed(2);
  }

  window.calcPosChange = function () {
    var received = parseFloat((document.getElementById('pos-received') || {}).value) || 0;
    var total = _posCart.reduce(function (s, i) { return s + i.unit_price * i.quantity; }, 0);
    var change = received - total;
    var el = document.getElementById('pos-change');
    if (el) {
      el.textContent = change >= 0 ? 'Change: RM ' + change.toFixed(2) + ' · 找零' : 'Insufficient · 金額不足';
      el.style.color = change >= 0 ? 'var(--sage)' : 'var(--red-seal)';
    }
  };

  window.clearPOSCart = function () {
    _posCart = [];
    _posPayMethod = null;
    renderPOSCart();
    document.querySelectorAll('.pos-pay-btn').forEach(function (b) {
      b.style.borderColor = 'var(--mist)'; b.style.background = 'transparent';
    });
  };

  window.completePOSSale = async function () {
    if (!_posCart.length) { showToast('Cart is empty · 購物車為空'); return; }
    if (!_posPayMethod) { showToast('Select payment method · 請選擇付款方式'); return; }

    var total = _posCart.reduce(function (s, i) { return s + i.unit_price * i.quantity; }, 0);
    var received = parseFloat((document.getElementById('pos-received') || {}).value) || total;

    if (_posPayMethod === 'cash' && received < total) {
      showToast('Insufficient amount · 金額不足');
      return;
    }

    try {
      var res = await A.api.post('/pharmacy/pos/sale', {
        items: _posCart.map(function (c) { return { product_id: c.product_id, quantity: c.quantity }; }),
        payment_method: _posPayMethod,
        amount_received: received,
        patient_name: (document.getElementById('pos-patient') || {}).value || null,
        sale_type: (document.getElementById('pos-sale-type') || {}).value || 'walk_in',
      });

      _lastSale = res.sale;
      showToast('Sale completed! · 交易完成 ✓');
      showReceipt(res.sale);
      _posCart = [];
      _posPayMethod = null;
      loadDailySummary();
    } catch (e) {
      showToast(e.message || 'Sale failed · 交易失敗');
    }
  };

  // ── Receipt ──
  function showReceipt(sale) {
    var existing = document.getElementById('pos-receipt-modal');
    if (existing) existing.remove();

    var payLabels = { cash:'Cash · 現金', card:'Card · 信用卡/借記卡', ewallet_tng:'Touch\'n Go', ewallet_grab:'GrabPay', ewallet_shopee:'ShopeePay', fpx:'FPX Banking' };
    var items = sale.items || [];

    var html = ''
      + '<div id="pos-receipt-modal" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:999;display:flex;align-items:center;justify-content:center;">'
      + '<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);" onclick="closeReceipt()"></div>'
      + '<div id="pos-receipt-content" style="position:relative;background:#fff;width:320px;padding:1.5rem;font-family:\'Source Sans 3\',monospace;font-size:.82rem;color:#333;">'
      + '<div style="text-align:center;border-bottom:1px dashed #ccc;padding-bottom:.8rem;margin-bottom:.8rem;">'
      + '  <div style="font-family:\'Noto Serif SC\',serif;font-size:1.1rem;font-weight:600;">漢方現代中醫</div>'
      + '  <div style="font-size:.72rem;">HansMed Modern TCM</div>'
      + '  <div style="font-size:.68rem;color:#999;margin-top:.3rem;">Receipt · 收據</div>'
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;font-size:.72rem;color:#666;margin-bottom:.5rem;"><span>' + sale.sale_no + '</span><span>' + new Date(sale.created_at).toLocaleString() + '</span></div>'
      + (sale.patient_name ? '<div style="font-size:.72rem;color:#666;margin-bottom:.5rem;">Patient: ' + sale.patient_name + '</div>' : '')
      + '<div style="border-bottom:1px dashed #ccc;padding-bottom:.5rem;margin-bottom:.5rem;">'
      + items.map(function (i) {
          return '<div style="display:flex;justify-content:space-between;margin-bottom:.3rem;"><span>' + i.name + ' × ' + i.quantity + '</span><span>RM ' + parseFloat(i.line_total).toFixed(2) + '</span></div>';
        }).join('')
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;font-weight:600;font-size:.95rem;margin-bottom:.3rem;"><span>Total · 總計</span><span>RM ' + parseFloat(sale.total).toFixed(2) + '</span></div>'
      + '<div style="display:flex;justify-content:space-between;font-size:.78rem;color:#666;"><span>Payment · 付款</span><span>' + (payLabels[sale.payment_method] || sale.payment_method) + '</span></div>'
      + (sale.payment_method === 'cash' ? '<div style="display:flex;justify-content:space-between;font-size:.78rem;color:#666;"><span>Received · 收款</span><span>RM ' + parseFloat(sale.amount_received).toFixed(2) + '</span></div>'
        + '<div style="display:flex;justify-content:space-between;font-size:.78rem;color:var(--sage);"><span>Change · 找零</span><span>RM ' + parseFloat(sale.change).toFixed(2) + '</span></div>' : '')
      + '<div style="text-align:center;margin-top:1rem;border-top:1px dashed #ccc;padding-top:.8rem;font-size:.68rem;color:#999;">Thank you · 謝謝惠顧</div>'
      + '<div style="display:flex;gap:.5rem;margin-top:1rem;">'
      + '  <button class="btn-primary" style="flex:1;font-size:.75rem;" onclick="printReceipt()">Print · 列印</button>'
      + '  <button class="btn-outline" style="flex:1;font-size:.75rem;" onclick="closeReceipt()">Close · 關閉</button>'
      + '</div>'
      + '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
  }

  window.closeReceipt = function () {
    var el = document.getElementById('pos-receipt-modal');
    if (el) el.remove();
  };

  window.printReceipt = function () {
    var content = document.getElementById('pos-receipt-content');
    if (!content) return;
    var win = window.open('', '_blank', 'width=350,height=600');
    win.document.write('<html><head><title>Receipt</title><style>body{font-family:monospace,sans-serif;padding:10px;font-size:12px;}button{display:none;}</style></head><body>');
    win.document.write(content.innerHTML);
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  // ── Daily Summary ──
  async function loadDailySummary() {
    var el = document.getElementById('pos-daily-bar');
    if (!el) return;
    try {
      var res = await A.api.get('/pharmacy/pos/daily-summary');
      el.innerHTML = ''
        + '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.8rem;">'
        + '<div class="ph-stat"><div class="ph-stat-num">' + (res.total_sales || 0) + '</div><div class="ph-stat-label">Sales Today · 今日交易</div></div>'
        + '<div class="ph-stat"><div class="ph-stat-num">RM ' + parseFloat(res.total_revenue || 0).toFixed(0) + '</div><div class="ph-stat-label">Revenue · 收入</div></div>'
        + '<div class="ph-stat"><div class="ph-stat-num">RM ' + parseFloat((res.by_method || {}).cash || 0).toFixed(0) + '</div><div class="ph-stat-label">Cash · 現金</div></div>'
        + '<div class="ph-stat"><div class="ph-stat-num">RM ' + parseFloat((res.by_method || {}).card || 0).toFixed(0) + '</div><div class="ph-stat-label">Card · 刷卡</div></div>'
        + '<div class="ph-stat"><div class="ph-stat-num">RM ' + parseFloat((res.by_method || {}).ewallet || 0).toFixed(0) + '</div><div class="ph-stat-label">E-wallet · 電子錢包</div></div>'
        + '</div>';
    } catch {}
  }

  console.log('[HansMed] POS system loaded');
})();
