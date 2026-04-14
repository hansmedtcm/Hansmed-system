/**
 * POS — Point of Sale
 */
(function () {
  'use strict';
  HM.pharmPanels = HM.pharmPanels || {};

  var products = [];
  var cart = [];
  var paymentMethod = null;
  var saleType = 'walk_in';

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Point of Sale · 收銀台</div>' +
      '<h1 class="page-title">New Sale</h1>' +
      '</div>' +
      '<div class="grid-2" style="grid-template-columns: 1.3fr 1fr; gap: var(--s-4);">' +
      '<div><input id="pos-search" type="text" class="field-input field-input--boxed mb-3" placeholder="Search product or SKU · 搜尋">' +
      '<div id="pos-products" style="max-height: 60vh; overflow-y: auto;"></div></div>' +
      '<div><div class="card card--pad-lg" style="position: sticky; top: 80px;">' +
      '<h3 class="mb-3">Cart · 購物車</h3>' +
      '<div class="field"><label class="field-label">Sale Type · 類型</label>' +
      '<select id="pos-type" class="field-input field-input--boxed">' +
      '<option value="walk_in">Walk-in · 散客</option>' +
      '<option value="otc">OTC · 成藥</option>' +
      '<option value="prescription">Prescription · 處方藥</option>' +
      '</select></div>' +
      '<div class="field"><label class="field-label">Patient Name · 患者姓名 (optional)</label><input id="pos-pt" class="field-input field-input--boxed"></div>' +
      '<div id="pos-cart"></div>' +
      '<div class="flex-between mt-3 mb-3" style="padding-top: var(--s-3); border-top: 1px solid var(--border);">' +
      '<strong>Total · 總計</strong><strong id="pos-total" style="color: var(--gold); font-size: var(--text-xl);">RM 0.00</strong>' +
      '</div>' +
      '<div class="text-label mb-2">Payment Method</div>' +
      '<div class="grid-3" style="gap: var(--s-1);">' +
      pay('cash', '💵', 'Cash') +
      pay('card', '💳', 'Card') +
      pay('fpx', '🏦', 'FPX') +
      pay('ewallet_tng', '🔵', 'TNG') +
      pay('ewallet_grab', '🟢', 'Grab') +
      pay('ewallet_shopee', '🟠', 'Shopee') +
      '</div>' +
      '<button id="pos-complete" class="btn btn--primary btn--block mt-4" disabled>Complete Sale · 完成交易</button>' +
      '</div></div>' +
      '</div>';

    document.getElementById('pos-search').addEventListener('input', debounce(filterProducts, 200));
    document.getElementById('pos-type').addEventListener('change', function (e) { saleType = e.target.value; });
    document.querySelectorAll('[data-pay]').forEach(function (b) {
      b.addEventListener('click', function () {
        paymentMethod = b.getAttribute('data-pay');
        document.querySelectorAll('[data-pay]').forEach(function (x) { x.style.borderColor = 'var(--border)'; x.style.background = 'var(--cream)'; });
        b.style.borderColor = 'var(--gold)';
        b.style.background = 'var(--washi)';
        updateCompleteBtn();
      });
    });
    document.getElementById('pos-complete').addEventListener('click', completeSale);

    cart = [];
    paymentMethod = null;
    await loadProducts();
  }

  function pay(id, icon, label) {
    return '<button data-pay="' + id + '" class="btn btn--outline" style="padding: var(--s-2); flex-direction: column; gap: 2px; height: auto; font-size: var(--text-xs);">' +
      '<span style="font-size: 1.2rem;">' + icon + '</span><span>' + label + '</span></button>';
  }

  async function loadProducts() {
    var container = document.getElementById('pos-products');
    HM.state.loading(container);
    try {
      var data = await HM.api.pharmacy.posProducts();
      products = Array.isArray(data) ? data : (data.data || []);
      renderProductList(products);
    } catch (e) { HM.state.error(container, e); }
  }

  function filterProducts() {
    var q = document.getElementById('pos-search').value.toLowerCase();
    if (!q) { renderProductList(products); return; }
    var filtered = products.filter(function (p) {
      return (p.name || '').toLowerCase().indexOf(q) >= 0 || (p.sku || '').toLowerCase().indexOf(q) >= 0;
    });
    renderProductList(filtered);
  }

  function renderProductList(items) {
    var container = document.getElementById('pos-products');
    if (!items.length) {
      container.innerHTML = '<p class="text-muted text-center" style="padding: 2rem;">No products found</p>';
      return;
    }
    container.innerHTML = '<div class="grid-auto" style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: var(--s-2);"></div>';
    var grid = container.querySelector('.grid-auto');
    items.forEach(function (p) {
      var stock = p.inventory ? parseFloat(p.inventory.quantity_on_hand) : 0;
      var card = document.createElement('div');
      card.className = 'card card--clickable';
      card.style.padding = 'var(--s-3)';
      card.innerHTML = '<div class="text-sm" style="color: var(--ink); font-weight: 500;">' + HM.format.esc(p.name) + '</div>' +
        '<div class="text-xs text-muted">' + HM.format.esc(p.sku || p.specification || '') + '</div>' +
        '<div class="flex-between mt-2">' +
        '<strong>' + HM.format.money(p.unit_price) + '</strong>' +
        '<span class="text-xs ' + (stock <= 5 ? 'text-danger' : 'text-muted') + '">' + stock + '</span>' +
        '</div>';
      card.addEventListener('click', function () { addToCart(p); });
      grid.appendChild(card);
    });
  }

  function addToCart(p) {
    var existing = cart.find(function (i) { return i.product_id === p.id; });
    if (existing) existing.quantity++;
    else cart.push({ product_id: p.id, name: p.name, unit_price: parseFloat(p.unit_price), unit: p.unit || 'g', quantity: 1 });
    renderCart();
  }

  function renderCart() {
    var container = document.getElementById('pos-cart');
    if (!cart.length) {
      container.innerHTML = '<p class="text-muted text-sm text-center" style="padding: var(--s-4);">Click products to add to cart</p>';
    } else {
      var total = 0;
      container.innerHTML = cart.map(function (it, i) {
        var line = it.unit_price * it.quantity;
        total += line;
        return '<div class="flex-between mb-2" style="padding: var(--s-2) 0; border-bottom: 1px solid var(--border);">' +
          '<div style="flex:1;"><div class="text-sm">' + HM.format.esc(it.name) + '</div>' +
          '<div class="text-xs text-muted">' + HM.format.money(it.unit_price) + ' × ' + it.quantity + '</div></div>' +
          '<div class="flex flex-gap-1">' +
          '<button class="btn btn--ghost btn--sm" onclick="HM.pharmPanels.pos._qty(' + i + ',-1)">−</button>' +
          '<span style="min-width:24px;text-align:center;font-weight:500;">' + it.quantity + '</span>' +
          '<button class="btn btn--ghost btn--sm" onclick="HM.pharmPanels.pos._qty(' + i + ',1)">+</button>' +
          '<button class="btn btn--ghost btn--sm" style="color: var(--red-seal);" onclick="HM.pharmPanels.pos._rm(' + i + ')">✕</button>' +
          '</div></div>';
      }).join('');
      document.getElementById('pos-total').textContent = HM.format.money(total);
    }
    updateCompleteBtn();
  }

  function updateCompleteBtn() {
    var btn = document.getElementById('pos-complete');
    if (btn) btn.disabled = !cart.length || !paymentMethod;
  }

  async function completeSale() {
    var total = cart.reduce(function (s, i) { return s + i.unit_price * i.quantity; }, 0);
    var received = total;
    if (paymentMethod === 'cash') {
      var amt = await HM.ui.prompt('Amount received (RM) · 收到金額:', { type: 'number', defaultValue: String(total) });
      if (!amt) return;
      received = parseFloat(amt);
      if (received < total) { HM.ui.toast('Insufficient amount · 金額不足', 'warning'); return; }
    }

    try {
      var res = await HM.api.pharmacy.posSale({
        items: cart.map(function (c) { return { product_id: c.product_id, quantity: c.quantity }; }),
        payment_method: paymentMethod,
        amount_received: received,
        patient_name: document.getElementById('pos-pt').value || null,
        sale_type: saleType,
      });
      showReceipt(res.sale);
      cart = [];
      paymentMethod = null;
      renderCart();
      document.querySelectorAll('[data-pay]').forEach(function (x) { x.style.borderColor = 'var(--border)'; x.style.background = 'var(--cream)'; });
    } catch (e) { HM.ui.toast(e.message || 'Sale failed', 'danger'); }
  }

  function showReceipt(sale) {
    var items = sale.items || [];
    var html = '<div style="font-family: monospace;">' +
      '<div class="text-center mb-3">' +
      '<strong style="font-family: var(--font-zh); font-size: var(--text-lg);">漢方現代中醫</strong><br>' +
      '<span class="text-xs">HansMed Modern TCM</span></div>' +
      '<div class="flex-between text-xs mb-2"><span>' + sale.sale_no + '</span><span>' + new Date(sale.created_at).toLocaleString() + '</span></div>' +
      (sale.patient_name ? '<div class="text-xs mb-2">Patient: ' + HM.format.esc(sale.patient_name) + '</div>' : '') +
      '<div style="border-top: 1px dashed #ccc; border-bottom: 1px dashed #ccc; padding: var(--s-2) 0; margin: var(--s-2) 0;">' +
      items.map(function (i) {
        return '<div class="flex-between text-sm"><span>' + HM.format.esc(i.name) + ' × ' + i.quantity + '</span><span>' + HM.format.money(i.line_total) + '</span></div>';
      }).join('') +
      '</div>' +
      '<div class="flex-between" style="font-size: var(--text-lg); font-weight: 500;"><span>Total</span><span>' + HM.format.money(sale.total) + '</span></div>' +
      (sale.payment_method === 'cash' ? '<div class="flex-between text-sm"><span>Received</span><span>' + HM.format.money(sale.amount_received) + '</span></div>' +
      '<div class="flex-between text-sm" style="color: var(--sage);"><span>Change</span><span>' + HM.format.money(sale.change) + '</span></div>' : '') +
      '<div class="text-center text-xs text-muted mt-4" style="border-top: 1px dashed #ccc; padding-top: var(--s-2);">Thank you · 謝謝惠顧</div>' +
      '</div>';

    var m = HM.ui.modal({
      title: 'Sale Complete · 交易完成',
      content: html + '<div class="flex flex-gap-2 mt-4"><button class="btn btn--primary btn--block" onclick="window.print()">🖨 Print</button></div>',
    });
  }

  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  HM.pharmPanels.pos = {
    render: render,
    _qty: function (i, d) { cart[i].quantity += d; if (cart[i].quantity <= 0) cart.splice(i, 1); renderCart(); },
    _rm: function (i) { cart.splice(i, 1); renderCart(); },
  };
})();
