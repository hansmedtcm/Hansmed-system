/**
 * Patient Shop — curated TCM herbs, OTC remedies, wellness products.
 * Uses HM.api.shop with a hardcoded fallback catalog so the UI works
 * even before the backend catalog endpoint is wired up.
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  var CATEGORIES = [
    { key: 'all',     label: 'All · 全部', icon: '🌸' },
    { key: 'herbs',   label: 'Herbs · 草藥', icon: '🌿' },
    { key: 'otc',     label: 'OTC Formulas · 成藥', icon: '💊' },
    { key: 'tea',     label: 'Wellness Teas · 茶飲', icon: '🍵' },
    { key: 'topical', label: 'Topical · 外用', icon: '🧴' },
    { key: 'supplement', label: 'Supplements · 保健', icon: '🌱' },
  ];

  var FALLBACK = [
    { id: 'p1', category: 'tea',     emoji: '🍵', name: 'Ginger Wellness Tea',   name_zh: '薑母養生茶',  price: 28, description: 'Warms the body, aids digestion. 15 sachets.', stock: 50 },
    { id: 'p2', category: 'herbs',   emoji: '🌿', name: 'Astragalus Root',        name_zh: '黃芪',      price: 45, description: 'Traditional qi tonic, 100g dried slices.',   stock: 30 },
    { id: 'p3', category: 'otc',     emoji: '💊', name: 'Cough & Cold Formula',   name_zh: '止咳感冒方', price: 32, description: 'Classic pien tze huang style relief, 30 caps.', stock: 80 },
    { id: 'p4', category: 'topical', emoji: '🧴', name: 'Meridian Balm',          name_zh: '經絡膏',    price: 38, description: 'Warming balm for sore muscles and joints.',  stock: 40 },
    { id: 'p5', category: 'tea',     emoji: '🌼', name: 'Chrysanthemum & Goji',   name_zh: '菊花枸杞',  price: 24, description: 'Eye-bright cooling tea, 20 sachets.',        stock: 60 },
    { id: 'p6', category: 'herbs',   emoji: '🌰', name: 'Goji Berries',           name_zh: '枸杞子',    price: 35, description: 'Premium Ningxia goji, 200g.',                 stock: 45 },
    { id: 'p7', category: 'supplement', emoji: '🌱', name: 'Women\'s Harmony Blend', name_zh: '婦安寧',  price: 68, description: 'Monthly cycle support, 60 capsules.',         stock: 25 },
    { id: 'p8', category: 'otc',     emoji: '💧', name: 'Bao Ji Wan (Digestion)', name_zh: '保濟丸',    price: 18, description: 'For indigestion & travel upset, 10 vials.',  stock: 100 },
    { id: 'p9', category: 'tea',     emoji: '🌺', name: 'Rose Petal Qi Tea',      name_zh: '玫瑰理氣茶', price: 30, description: 'Soothes mood & liver qi, 15 sachets.',       stock: 55 },
    { id: 'p10', category: 'topical', emoji: '🪷', name: 'White Flower Oil',       name_zh: '白花油',    price: 22, description: 'Classic aromatic for headaches, 20ml.',     stock: 70 },
    { id: 'p11', category: 'supplement', emoji: '🍶', name: 'Cordyceps Capsules', name_zh: '冬蟲夏草膠囊', price: 128, description: 'Lung & kidney tonic, 30 caps.',           stock: 15 },
    { id: 'p12', category: 'herbs',   emoji: '🫚', name: 'Dried Ginger Slices',   name_zh: '乾薑片',    price: 20, description: 'For cooking, tea, decoctions. 100g.',        stock: 90 },
  ];

  var state = { products: [], category: 'all', search: '' };

  async function render(el) {
    state = { products: [], category: 'all', search: '' };

    el.innerHTML = '<div class="page-header flex-between">' +
      '<div><div class="page-header-label">Shop · 漢方商店</div>' +
      '<h1 class="page-title">TCM Remedies &amp; Wellness</h1></div>' +
      '<button class="btn btn--outline" id="open-cart">🛒 Cart · 購物車 (<span id="sh-cart-count">0</span>)</button>' +
      '</div>' +

      '<div class="field mb-4">' +
      '<input type="search" id="sh-search" class="field-input field-input--boxed" placeholder="🔍 Search remedies… · 搜尋">' +
      '</div>' +

      '<div class="filter-bar mb-5" id="sh-cats"></div>' +

      '<div id="sh-grid"></div>';

    var cats = document.getElementById('sh-cats');
    CATEGORIES.forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'filter-chip' + (c.key === 'all' ? ' is-active' : '');
      b.setAttribute('data-cat', c.key);
      b.innerHTML = c.icon + ' ' + c.label;
      b.addEventListener('click', function () {
        state.category = c.key;
        cats.querySelectorAll('.filter-chip').forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        renderGrid();
      });
      cats.appendChild(b);
    });

    document.getElementById('sh-search').addEventListener('input', function (e) {
      state.search = e.target.value.trim().toLowerCase();
      renderGrid();
    });
    document.getElementById('open-cart').addEventListener('click', function () {
      location.hash = '#/cart';
    });

    updateCartCount();
    await loadProducts();
    renderGrid();
  }

  async function loadProducts() {
    // 1. Try the dedicated shop endpoint
    try {
      var res = await HM.api.shop.list();
      if (res && res.data && res.data.length) {
        state.products = res.data;
        return;
      }
    } catch (_) { /* fall through */ }

    // 2. Try reading the admin-managed catalog from system_configs (public pages endpoint fallback)
    try {
      var cfg = await HM.api.get('/public/shop-catalog');
      if (cfg && cfg.catalog && cfg.catalog.length) {
        state.products = cfg.catalog.filter(function (p) { return p.active !== false; });
        return;
      }
    } catch (_) { /* fall through */ }

    // 3. Use the curated fallback list (ships with the frontend)
    state.products = FALLBACK.slice();
  }

  function renderGrid() {
    var grid = document.getElementById('sh-grid');
    var items = state.products.filter(function (p) {
      if (state.category !== 'all' && p.category !== state.category) return false;
      if (state.search && (p.name + ' ' + (p.name_zh || '')).toLowerCase().indexOf(state.search) < 0) return false;
      return true;
    });
    if (!items.length) {
      HM.state.empty(grid, { icon: '🔍', title: 'No products match', text: 'Try a different filter or search term.' });
      return;
    }
    grid.innerHTML = '<div class="grid-auto" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--s-4);"></div>';
    var g = grid.querySelector('.grid-auto');
    items.forEach(function (p) {
      var data = {
        id: p.id,
        emoji: p.emoji || '🌿',
        category: (CATEGORIES.find(function (c) { return c.key === p.category; }) || { label: 'Remedy' }).label,
        name: p.name,
        name_zh: p.name_zh || '',
        description: p.description || '',
        price_formatted: HM.format.money(p.price),
        stock_label: p.stock > 0 ? 'In stock · 有貨' : 'Out of stock · 缺貨',
      };
      var node = HM.render.fromTemplate('tpl-product-card', data);
      var cardEl = node.firstElementChild;
      var btn = node.querySelector('[data-action="add"]');
      if (btn) btn.addEventListener('click', function (e) {
        e.stopPropagation();
        HM.cart.add(p, 1);
        HM.ui.toast(p.name + ' added to cart · 已加入', 'success');
        updateCartCount();
      });
      if (cardEl) cardEl.addEventListener('click', function () { renderDetail(document.getElementById('panel-container'), p.id); });
      g.appendChild(node);
    });
  }

  async function renderDetail(el, id) {
    el.innerHTML = '<div class="state state--loading"><div class="state-icon"></div></div>';
    if (!state.products.length) await loadProducts();
    var p = state.products.find(function (x) { return String(x.id) === String(id); });
    if (!p) { el.innerHTML = '<p class="text-muted">Product not found.</p>'; return; }

    el.innerHTML = '<div class="page-header">' +
      '<a href="#/shop" class="text-sm text-muted">← Back to Shop</a>' +
      '<h1 class="page-title mt-2">' + HM.format.esc(p.name) + '</h1>' +
      '<div class="text-muted" style="font-family: var(--font-zh);">' + HM.format.esc(p.name_zh || '') + '</div>' +
      '</div>' +

      '<div class="grid-2" style="gap: var(--s-6);">' +
      '<div style="font-size: 8rem; text-align:center; padding: var(--s-8); background: var(--washi); border-radius: var(--r-lg);">' + (p.emoji || '🌿') + '</div>' +
      '<div>' +
      '<div class="text-label text-gold mb-3">' + ((CATEGORIES.find(function (c) { return c.key === p.category; }) || { label: '' }).label) + '</div>' +
      '<div class="card-title mb-3" style="font-size: var(--text-2xl); color: var(--gold);">' + HM.format.money(p.price) + '</div>' +
      '<p class="text-muted mb-4">' + HM.format.esc(p.description || '') + '</p>' +
      '<div class="field mb-4"><label class="field-label">Quantity · 數量</label>' +
      '<input type="number" id="sh-qty" class="field-input field-input--boxed" value="1" min="1" max="99" style="max-width: 120px;"></div>' +
      '<button class="btn btn--primary btn--lg" id="sh-add">+ Add to Cart · 加入購物車</button>' +
      '<div class="text-xs text-muted mt-3">Platform ships via verified pharmacies. 7-day return on unopened items.</div>' +
      '</div></div>';

    document.getElementById('sh-add').addEventListener('click', function () {
      var qty = Math.max(1, parseInt(document.getElementById('sh-qty').value || '1', 10));
      HM.cart.add(p, qty);
      HM.ui.toast('Added ' + qty + ' × ' + p.name, 'success');
    });
  }

  function updateCartCount() {
    var el = document.getElementById('sh-cart-count');
    if (el) el.textContent = HM.cart.count();
  }

  HM.patientPanels.shop = { render: render, renderDetail: renderDetail };
})();
