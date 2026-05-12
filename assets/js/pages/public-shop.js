/**
 * Public shop page — browsable without login.
 * Clicking "+ Cart" on any product:
 *   1. If signed-in, adds to cart and redirects to portal cart
 *   2. If guest, prompts to sign in / register first
 */
(function () {
  'use strict';

  var CATEGORIES = [
    { key: 'all',        label: 'All · 全部', icon: '🌸' },
    { key: 'otc',        label: 'Classical Formulas · 經方', icon: '💊' },
    { key: 'tea',        label: 'Wellness Teas · 茶飲', icon: '🍵' },
    { key: 'herbs',      label: 'Single Herbs · 單味草藥', icon: '🌿' },
    { key: 'topical',    label: 'Topical · 外用', icon: '🧴' },
    { key: 'supplement', label: 'Supplements · 保健', icon: '🌱' },
  ];

  // Curated fallback — only self-safe items (mirrors portal shop)
  var FALLBACK = [
    { id: 'p1',  category: 'tea',        emoji: '🍵', name: 'Ginger Wellness Tea',        name_zh: '薑母養生茶',     price: 28,  description: 'Warms the body, aids digestion. 15 sachets.', stock: 50,  self_safe: true },
    { id: 'p2',  category: 'herbs',      emoji: '🌿', name: 'Astragalus Slices',           name_zh: '黃芪片',         price: 45,  description: 'Traditional qi tonic, 100g dried slices.', stock: 30,  self_safe: true },
    { id: 'p3',  category: 'otc',        emoji: '💊', name: 'Liu Wei Di Huang Wan',        name_zh: '六味地黃丸',     price: 38,  description: 'Classical formula for kidney yin deficiency.', stock: 80,  self_safe: true },
    { id: 'p4',  category: 'topical',    emoji: '🧴', name: 'Meridian Balm',               name_zh: '經絡膏',         price: 38,  description: 'Warming balm for sore muscles and joints.', stock: 40,  self_safe: true },
    { id: 'p5',  category: 'tea',        emoji: '🌼', name: 'Chrysanthemum & Goji Tea',    name_zh: '菊花枸杞茶',     price: 24,  description: 'Cooling eye-bright tea, 20 sachets.', stock: 60, self_safe: true },
    { id: 'p6',  category: 'herbs',      emoji: '🌰', name: 'Goji Berries',                name_zh: '枸杞子',         price: 35,  description: 'Premium Ningxia goji, 200g.', stock: 45, self_safe: true },
    { id: 'p7',  category: 'otc',        emoji: '💊', name: 'Gui Pi Wan',                  name_zh: '歸脾丸',         price: 42,  description: 'Classical formula for spleen qi & heart blood deficiency.', stock: 25, self_safe: true },
    { id: 'p8',  category: 'otc',        emoji: '💧', name: 'Bao Ji Wan (Digestion)',      name_zh: '保濟丸',         price: 18,  description: 'For indigestion & travel upset, 10 vials.', stock: 100, self_safe: true },
    { id: 'p9',  category: 'tea',        emoji: '🌺', name: 'Rose Petal Tea',              name_zh: '玫瑰花茶',       price: 30,  description: 'Soothes mood, 15 sachets.', stock: 55, self_safe: true },
    { id: 'p10', category: 'topical',    emoji: '🪷', name: 'White Flower Oil',            name_zh: '白花油',         price: 22,  description: 'Classic aromatic for headaches, 20ml.', stock: 70, self_safe: true },
    { id: 'p11', category: 'otc',        emoji: '💊', name: 'Xiao Yao Wan',                name_zh: '逍遙丸',         price: 36,  description: 'Classical formula for liver qi stagnation.', stock: 30, self_safe: true },
    { id: 'p12', category: 'herbs',      emoji: '🫚', name: 'Dried Ginger Slices',         name_zh: '乾薑片',         price: 20,  description: 'For cooking, tea, decoctions. 100g.', stock: 90, self_safe: true },
    { id: 'p13', category: 'supplement', emoji: '🌱', name: 'Red Date Snacks',             name_zh: '紅棗',           price: 26,  description: 'Seedless dried red dates, 250g.', stock: 60, self_safe: true },
    { id: 'p14', category: 'otc',        emoji: '💊', name: 'Ba Zhen Wan',                 name_zh: '八珍丸',         price: 46,  description: 'Classical qi-and-blood tonic.', stock: 20, self_safe: true },
  ];

  var state = { products: [], category: 'all', search: '' };

  async function init() {
    await loadProducts();
    renderCats();
    renderGrid();
    wireFilters();
  }

  async function loadProducts() {
    try {
      var res = await HM.api.shop.list();
      if (res && res.data && res.data.length) {
        state.products = res.data;
        return;
      }
    } catch (_) { /* fall through */ }
    try {
      var cfg = await HM.api.get('/public/shop-catalog');
      if (cfg && cfg.catalog && cfg.catalog.length) {
        state.products = cfg.catalog.filter(function (p) { return p.active !== false; });
        return;
      }
    } catch (_) { /* fall through */ }
    state.products = FALLBACK.slice();
  }

  function renderCats() {
    var host = document.getElementById('pub-cats');
    host.innerHTML = '';
    CATEGORIES.forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'filter-chip' + (c.key === 'all' ? ' is-active' : '');
      b.setAttribute('data-cat', c.key);
      b.innerHTML = c.icon + ' ' + c.label;
      b.addEventListener('click', function () {
        state.category = c.key;
        host.querySelectorAll('.filter-chip').forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        renderGrid();
      });
      host.appendChild(b);
    });
  }

  function wireFilters() {
    var s = document.getElementById('pub-search');
    if (s) s.addEventListener('input', function (e) {
      state.search = e.target.value.trim().toLowerCase();
      renderGrid();
    });
  }

  function renderGrid() {
    var grid = document.getElementById('pub-grid');
    var items = state.products.filter(function (p) {
      if (p.self_safe !== true) return false; // safety gate
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
      var node = HM.render.fromTemplate('tpl-pub-product', data);
      var cardEl = node.firstElementChild;
      var btn = node.querySelector('[data-action="add"]');
      if (btn) btn.addEventListener('click', function (e) {
        e.stopPropagation();
        handleAddToCart(p);
      });
      g.appendChild(node);
    });
  }

  // ── Add-to-cart: login gate ──
  function handleAddToCart(p) {
    var isAuthed = HM.api && HM.api.getToken && HM.api.getToken();
    if (!isAuthed) {
      return showLoginPrompt(p);
    }
    HM.cart.add(p, 1);
    HM.ui.toast(p.name + ' added to cart · 已加入購物車', 'success');
    // Offer to jump to cart
    setTimeout(function () {
      if (confirm('View your cart now? · 前往購物車？')) {
        location.href = 'portal.html#/cart';
      }
    }, 300);
  }

  function showLoginPrompt(p) {
    var m = HM.ui.modal({
      size: 'sm',
      title: 'Sign in to add to cart · 登入以加入購物車',
      content:
        '<p class="mb-4">You can browse freely, but adding items to your cart requires a HansMed account. ' +
        '<span style="font-family: var(--font-zh);">瀏覽無需登入，加入購物車需登入帳號。</span></p>' +
        '<div class="card mb-4" style="padding: var(--s-3); background: var(--washi);">' +
        '<div class="text-sm"><strong>' + (p.emoji || '🌿') + ' ' + HM.format.esc(p.name) + '</strong>' +
        (p.name_zh ? ' · <span style="font-family: var(--font-zh);">' + HM.format.esc(p.name_zh) + '</span>' : '') +
        '</div>' +
        '<div class="text-xs text-muted mt-1">' + HM.format.money(p.price) + ' — will be saved to your cart after sign-in.</div>' +
        '</div>' +
        '<div class="flex gap-2">' +
        '<button class="btn btn--primary btn--block" data-action="signin">Sign In · 登入</button>' +
        '<button class="btn btn--outline btn--block" data-action="register">Create Account · 註冊</button>' +
        '</div>' +
        '<div class="text-center mt-3"><button class="btn btn--ghost btn--sm" data-action="guest">Keep browsing · 繼續瀏覽</button></div>',
    });

    // Remember the product so after sign-in it's auto-added
    try {
      sessionStorage.setItem('hm_pending_cart_add', JSON.stringify({ product: p, ts: Date.now() }));
    } catch (_) {}

    m.element.querySelector('[data-action="signin"]').addEventListener('click', function () {
      location.href = 'index.html#/login';
    });
    m.element.querySelector('[data-action="register"]').addEventListener('click', function () {
      location.href = 'index.html#/register';
    });
    m.element.querySelector('[data-action="guest"]').addEventListener('click', function () {
      sessionStorage.removeItem('hm_pending_cart_add');
      m.close();
    });
  }

  // If the user just signed in and had a pending add, fulfil it silently.
  function consumePendingAdd() {
    try {
      var raw = sessionStorage.getItem('hm_pending_cart_add');
      if (!raw) return;
      var payload = JSON.parse(raw);
      if (!payload || !payload.product) return;
      // Only honour within 30 min
      if ((Date.now() - (payload.ts || 0)) > 30 * 60 * 1000) return;
      if (HM.api && HM.api.getToken && HM.api.getToken()) {
        HM.cart.add(payload.product, 1);
        HM.ui.toast(payload.product.name + ' added · 已加入', 'success');
      }
      sessionStorage.removeItem('hm_pending_cart_add');
    } catch (_) {}
  }

  document.addEventListener('DOMContentLoaded', function () {
    consumePendingAdd();
    init();
  });
  if (document.readyState !== 'loading') {
    consumePendingAdd();
    init();
  }
})();
