/**
 * Patient Shop — curated TCM herbs, OTC remedies, wellness products.
 *
 * Safety gates (enforced sequentially before browsing):
 *   Gate 1 — Current prescription medications? → redirect to consultation
 *   Gate 2 — Pregnant / breastfeeding? → redirect to consultation
 *   Gate 3 — Only products flagged self_safe (single-herb supplements or
 *            well-known classical low-potency formulas) are shown here.
 *            Complex multi-herb formulas require practitioner consultation.
 *   Gate 4 — Prominent disclaimer on shop grid + product detail pages.
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  var CATEGORIES = [
    { key: 'all',        label: 'All · 全部', icon: '🌸' },
    { key: 'otc',        label: 'Classical Formulas · 經方', icon: '💊' },
    { key: 'tea',        label: 'Wellness Teas · 茶飲', icon: '🍵' },
    { key: 'herbs',      label: 'Single Herbs · 單味草藥', icon: '🌿' },
    { key: 'topical',    label: 'Topical · 外用', icon: '🧴' },
    { key: 'supplement', label: 'Supplements · 保健', icon: '🌱' },
  ];

  // Curated fallback — every item flagged self_safe=true (classical low-potency
  // formulas or well-known single-herb supplements only). Complex custom formulas
  // are intentionally excluded and must come through a practitioner consultation.
  var FALLBACK = [
    { id: 'p1',  category: 'tea',        emoji: '🍵', name: 'Ginger Wellness Tea',        name_zh: '薑母養生茶',     price: 28,  description: 'Warms the body, aids digestion. 15 sachets.', stock: 50,  self_safe: true },
    { id: 'p2',  category: 'herbs',      emoji: '🌿', name: 'Astragalus Slices',           name_zh: '黃芪片',         price: 45,  description: 'Traditional qi tonic, 100g dried slices. Safe as daily tea in moderation.', stock: 30,  self_safe: true },
    { id: 'p3',  category: 'otc',        emoji: '💊', name: 'Liu Wei Di Huang Wan',        name_zh: '六味地黃丸',     price: 38,  description: 'Classical formula for kidney yin deficiency. Low-potency pill, OTC in Malaysia.', stock: 80,  self_safe: true },
    { id: 'p4',  category: 'topical',    emoji: '🧴', name: 'Meridian Balm',               name_zh: '經絡膏',         price: 38,  description: 'Warming balm for sore muscles and joints. External use only.', stock: 40,  self_safe: true },
    { id: 'p5',  category: 'tea',        emoji: '🌼', name: 'Chrysanthemum & Goji Tea',    name_zh: '菊花枸杞茶',     price: 24,  description: 'Cooling eye-bright tea, 20 sachets.', stock: 60, self_safe: true },
    { id: 'p6',  category: 'herbs',      emoji: '🌰', name: 'Goji Berries',                name_zh: '枸杞子',         price: 35,  description: 'Premium Ningxia goji, 200g.', stock: 45, self_safe: true },
    { id: 'p7',  category: 'otc',        emoji: '💊', name: 'Gui Pi Wan',                  name_zh: '歸脾丸',         price: 42,  description: 'Classical formula for spleen qi & heart blood deficiency — mild fatigue, poor sleep.', stock: 25, self_safe: true },
    { id: 'p8',  category: 'otc',        emoji: '💧', name: 'Bao Ji Wan (Digestion)',      name_zh: '保濟丸',         price: 18,  description: 'For indigestion & travel upset, 10 vials.', stock: 100, self_safe: true },
    { id: 'p9',  category: 'tea',        emoji: '🌺', name: 'Rose Petal Tea',              name_zh: '玫瑰花茶',       price: 30,  description: 'Soothes mood, 15 sachets.', stock: 55, self_safe: true },
    { id: 'p10', category: 'topical',    emoji: '🪷', name: 'White Flower Oil',            name_zh: '白花油',         price: 22,  description: 'Classic aromatic for headaches, 20ml. External use.', stock: 70, self_safe: true },
    { id: 'p11', category: 'otc',        emoji: '💊', name: 'Xiao Yao Wan',                name_zh: '逍遙丸',         price: 36,  description: 'Classical formula for liver qi stagnation — mild stress relief.', stock: 30, self_safe: true },
    { id: 'p12', category: 'herbs',      emoji: '🫚', name: 'Dried Ginger Slices',         name_zh: '乾薑片',         price: 20,  description: 'For cooking, tea, decoctions. 100g.', stock: 90, self_safe: true },
    { id: 'p13', category: 'supplement', emoji: '🌱', name: 'Red Date Snacks',             name_zh: '紅棗',           price: 26,  description: 'Seedless dried red dates. Blood-nourishing snack, 250g.', stock: 60, self_safe: true },
    { id: 'p14', category: 'otc',        emoji: '💊', name: 'Ba Zhen Wan',                 name_zh: '八珍丸',         price: 46,  description: 'Classical qi-and-blood tonic. Low-potency OTC pill form.', stock: 20, self_safe: true },
  ];

  var state = { products: [], category: 'all', search: '' };

  async function render(el) {
    state = { products: [], category: 'all', search: '' };

    // Safety gates 1 + 2 before showing any product
    if (!sessionGateCleared()) {
      return renderGateQuestionnaire(el);
    }

    el.innerHTML = '<div class="page-header flex-between">' +
      '<div><div class="page-header-label">Shop · 漢方商店</div>' +
      '<h1 class="page-title">TCM Remedies &amp; Wellness</h1></div>' +
      '<div class="flex gap-2">' +
      '<button class="btn btn--ghost btn--sm" id="reset-gates" title="Answer safety questions again">Reset</button>' +
      '<button class="btn btn--outline" id="open-cart">🛒 Cart · 購物車 (<span id="sh-cart-count">0</span>)</button>' +
      '</div></div>' +

      // Gate 4 — prominent disclaimer at top of shop
      '<div class="alert alert--info mb-4">' +
      '<div class="alert-icon">ℹ️</div>' +
      '<div class="alert-body">' +
      '<strong>Self-care guidance, not a medical diagnosis · 自我保健建議，非醫療診斷</strong><br>' +
      'These products are curated for safe self-administration based on your self-reported constitution. We do not have your full medical history or current medications. ' +
      'If your symptoms are severe or persistent, please consult a qualified TCM practitioner or medical doctor. ' +
      '<span style="font-family: var(--font-zh);">如症狀嚴重或持續，請諮詢合格中醫師或醫師。</span>' +
      '</div></div>' +

      '<div class="field mb-4">' +
      '<input type="search" id="sh-search" class="field-input field-input--boxed" placeholder="🔍 Search remedies… · 搜尋">' +
      '</div>' +

      '<div class="filter-bar mb-5" id="sh-cats"></div>' +

      '<div id="sh-grid"></div>' +

      // Footer note about complex formulas
      '<div class="card mt-6" style="background: var(--washi); border-left: 3px solid var(--gold);">' +
      '<div class="card-title">Looking for a custom formula? · 需要個人化處方？</div>' +
      '<p class="text-sm text-muted mt-2">Complex multi-herb formulas require a practitioner consultation for your specific constitution and condition. ' +
      '<span style="font-family: var(--font-zh);">複方、定制處方需經醫師診斷。</span></p>' +
      '<button class="btn btn--outline mt-2" onclick="location.hash=\'#/book\'">Book Consultation · 預約問診 →</button>' +
      '</div>';

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
    document.getElementById('reset-gates').addEventListener('click', function () {
      sessionStorage.removeItem('hm_shop_cleared');
      render(el);
    });

    updateCartCount();
    await loadProducts();
    renderGrid();
  }

  // ── SAFETY GATES ─────────────────────────────────────────────
  function sessionGateCleared() {
    return sessionStorage.getItem('hm_shop_cleared') === '1';
  }

  function renderGateQuestionnaire(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Shop · 漢方商店</div>' +
      '<h1 class="page-title">Before You Browse · 使用前確認</h1>' +
      '<p class="text-muted mt-1">A couple of quick safety questions so we can show you products that are right for you. ' +
      '<span style="font-family: var(--font-zh);">在您瀏覽前，請先回答幾個簡單的安全問題。</span></p>' +
      '</div>' +

      '<form id="gate-form" class="card card--pad-lg" style="max-width: 720px;">' +

      '<div class="field mb-5" data-gate="1">' +
      '<label class="field-label" data-required>' +
      '1. Are you currently taking any prescription medications? · 您目前是否正在服用處方藥？' +
      '</label>' +
      '<div class="radio-row">' +
      '<label class="radio-option"><input type="radio" name="medications" value="no"> No · 否</label>' +
      '<label class="radio-option"><input type="radio" name="medications" value="yes"> Yes · 是</label>' +
      '</div>' +
      '</div>' +

      '<div class="field mb-5" data-gate="2">' +
      '<label class="field-label" data-required>' +
      '2. Are you pregnant or breastfeeding? · 您目前是否懷孕或哺乳？' +
      '</label>' +
      '<div class="radio-row">' +
      '<label class="radio-option"><input type="radio" name="pregnant" value="no"> No · 否 / Not applicable · 不適用</label>' +
      '<label class="radio-option"><input type="radio" name="pregnant" value="yes"> Yes · 是</label>' +
      '</div>' +
      '</div>' +

      '<div class="field mb-5">' +
      '<label class="check-item">' +
      '<input type="checkbox" name="acknowledge" required> ' +
      'I understand these products are for self-care based on my self-reported constitution and are not a medical diagnosis.' +
      '<br><span style="font-family: var(--font-zh); font-size: var(--text-xs); color: var(--stone);">我理解這些商品基於我的體質自評，不構成醫療診斷。</span>' +
      '</label>' +
      '</div>' +

      '<div id="gate-error" class="alert alert--danger" style="display:none;"></div>' +

      '<div class="flex gap-2">' +
      '<button type="button" class="btn btn--ghost" onclick="location.hash=\'#/\'">Cancel · 取消</button>' +
      '<button type="submit" class="btn btn--primary btn--block">Continue · 繼續</button>' +
      '</div>' +
      '</form>';

    // Inject a small style block for the radio rows (simple, scoped)
    if (!document.getElementById('gate-style')) {
      var s = document.createElement('style');
      s.id = 'gate-style';
      s.textContent = '.radio-row{display:flex;gap:var(--s-3);flex-wrap:wrap;margin-top:var(--s-2);}' +
        '.radio-option{display:inline-flex;align-items:center;gap:var(--s-2);padding:var(--s-2) var(--s-3);border:1px solid var(--border);border-radius:var(--r-md);cursor:pointer;font-size:var(--text-sm);}' +
        '.radio-option input{margin:0;}' +
        '.radio-option:has(input:checked){border-color:var(--gold);background:var(--washi);}';
      document.head.appendChild(s);
    }

    document.getElementById('gate-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var form = e.target;
      var data = HM.form.serialize(form);
      var err = document.getElementById('gate-error');
      err.style.display = 'none';

      if (!data.medications || !data.pregnant) {
        err.textContent = 'Please answer both questions. · 請回答兩個問題。';
        err.style.display = 'block';
        return;
      }

      if (data.medications === 'yes' || data.pregnant === 'yes') {
        renderRedirectToConsult(el, data);
        return;
      }

      sessionStorage.setItem('hm_shop_cleared', '1');
      render(el);
    });
  }

  function renderRedirectToConsult(el, reason) {
    var cause = reason.medications === 'yes' ?
      'You indicated you are <strong>currently taking prescription medications</strong>.' :
      'You indicated you are <strong>pregnant or breastfeeding</strong>.';
    var cause_zh = reason.medications === 'yes' ?
      '您表示目前正在<strong>服用處方藥</strong>。' :
      '您表示目前<strong>懷孕或哺乳中</strong>。';

    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Consultation Required · 需先諮詢</div>' +
      '<h1 class="page-title">Let\'s Have a Practitioner Review First</h1>' +
      '</div>' +

      '<div class="card card--pad-lg" style="max-width: 720px; border-left: 3px solid var(--gold);">' +
      '<div style="font-size: 3rem; margin-bottom: var(--s-3);">🩺</div>' +
      '<h3 class="mb-3">Your safety comes first · 安全第一</h3>' +
      '<p class="mb-3">' + cause + ' Herbs and classical formulas can interact with prescription drugs or affect pregnancy. A licensed TCM practitioner must review your situation before we recommend any product.</p>' +
      '<p class="mb-4" style="font-family: var(--font-zh); color: var(--stone);">' + cause_zh + '草藥與處方藥可能產生交互作用，或影響孕期。請先由持證中醫師為您評估，再決定是否服用任何商品。</p>' +

      '<div class="flex gap-2 flex-wrap">' +
      '<button class="btn btn--primary" onclick="location.hash=\'#/book\'">📅 Book Consultation · 預約問診</button>' +
      '<button class="btn btn--outline" onclick="location.hash=\'#/messages\'">💬 Chat with Us · 聯絡我們</button>' +
      '<button class="btn btn--ghost" onclick="sessionStorage.removeItem(\'hm_shop_cleared\'); location.hash=\'#/shop\'; HM.patientPanels.shop.render(document.getElementById(\'panel-container\'));">← Change my answer</button>' +
      '</div>' +
      '</div>';
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

    // 2. Try reading the admin-managed catalog from system_configs
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
      // Gate 3 — only self-safe products are shown in direct-shop.
      // Products without the flag are assumed NOT self-safe (conservative default).
      if (p.self_safe !== true) return false;
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
    // Detail view still enforces the gates — in case a user deep-links.
    if (!sessionGateCleared()) {
      return renderGateQuestionnaire(el);
    }

    el.innerHTML = '<div class="state state--loading"><div class="state-icon"></div></div>';
    if (!state.products.length) await loadProducts();
    var p = state.products.find(function (x) { return String(x.id) === String(id); });
    if (!p || p.self_safe !== true) {
      el.innerHTML = '<p class="text-muted">Product not found or requires consultation. <a href="#/shop">Back to shop</a></p>';
      return;
    }

    el.innerHTML = '<div class="page-header">' +
      '<a href="#/shop" class="text-sm text-muted">← Back to Shop · 返回商店</a>' +
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
      '</div></div>' +

      // Gate 4 — disclaimer on every product detail page
      '<div class="alert alert--warning mt-6" style="max-width: 820px;">' +
      '<div class="alert-icon">⚠️</div>' +
      '<div class="alert-body">' +
      '<strong>Important · 重要提示</strong><br>' +
      'This recommendation is based on your self-reported constitution assessment and is <strong>not a medical diagnosis</strong>. It does not account for your full medical history or current medications. If symptoms are severe or persistent, consult a qualified TCM practitioner or medical doctor. ' +
      '<br><span style="font-family: var(--font-zh); color: var(--stone);">此推薦基於您的體質自評，<strong>不構成醫療診斷</strong>，也未考慮您完整的病史或當前用藥。如症狀嚴重或持續，請諮詢合格中醫師或醫師。</span>' +
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
