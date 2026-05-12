/**
 * Admin Shop Catalog — curated product list shown in the patient Shop panel.
 * Stores in system_configs under key `shop_catalog` as JSON array.
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  var CATEGORIES = [
    { key: 'herbs',      label: 'Herbs · 草藥' },
    { key: 'otc',        label: 'OTC Formulas · 成藥' },
    { key: 'tea',        label: 'Wellness Teas · 茶飲' },
    { key: 'topical',    label: 'Topical · 外用' },
    { key: 'supplement', label: 'Supplements · 保健' },
  ];

  var catalog = [];

  async function render(el) {
    el.innerHTML = '<div class="page-header flex-between">' +
      '<div><div class="page-header-label">Shop Catalog · 商店目錄</div>' +
      '<h1 class="page-title">Curated Products</h1>' +
      '<p class="text-muted mt-1">These products appear in the patient Shop. Add, edit, or reorder them here.</p>' +
      '</div>' +
      '<button class="btn btn--primary" id="add-product">+ Add Product</button></div>' +
      '<div id="cat-body"></div>';

    document.getElementById('add-product').addEventListener('click', function () { showEditor(null); });
    await load();
  }

  async function load() {
    var body = document.getElementById('cat-body');
    HM.state.loading(body);
    try {
      catalog = [];
      try {
        var res = await HM.api.admin.getConfigs();
        (res.data || []).forEach(function (row) {
          if (row.config_key === 'shop_catalog') {
            try { catalog = JSON.parse(row.config_value); } catch (_) { catalog = []; }
          }
        });
      } catch (_) {
        catalog = [];
      }

      if (!catalog.length) {
        HM.state.empty(body, {
          icon: '🛍️',
          title: 'No products in catalog yet',
          text: 'Click "+ Add Product" to add your first curated item.',
        });
        return;
      }

      body.innerHTML = '<div class="table-wrap"><table class="table table--responsive"><thead><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Self-safe</th><th>Status</th><th></th></tr></thead><tbody></tbody></table></div>';
      var tbody = body.querySelector('tbody');
      catalog.forEach(function (p, idx) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td data-label=""><span style="font-size: 1.5rem;">' + (p.emoji || '🌿') + '</span></td>' +
          '<td data-label="Name"><strong>' + HM.format.esc(p.name) + '</strong>' +
          '<div class="text-xs text-muted" style="font-family: var(--font-zh);">' + HM.format.esc(p.name_zh || '') + '</div></td>' +
          '<td data-label="Category">' + HM.format.esc(catLabel(p.category)) + '</td>' +
          '<td data-label="Price">' + HM.format.money(p.price) + '</td>' +
          '<td data-label="Stock">' + (p.stock != null ? p.stock : '—') + '</td>' +
          '<td data-label="Self-safe">' + (p.self_safe === true ? '<span class="badge badge--success">✓ Safe</span>' : '<span class="badge badge--danger">Consult only</span>') + '</td>' +
          '<td data-label="Status">' + (p.active === false ? '<span class="badge">Hidden</span>' : '<span class="badge badge--success">Live</span>') + '</td>' +
          '<td data-label="Actions"><div class="flex gap-2">' +
          '<button class="btn btn--outline btn--sm" data-edit>Edit</button>' +
          '<button class="btn btn--ghost btn--sm" data-del>Delete</button>' +
          '</div></td>';
        tr.querySelector('[data-edit]').addEventListener('click', function () { showEditor(idx); });
        tr.querySelector('[data-del]').addEventListener('click', async function () {
          var ok = await HM.ui.confirm('Remove "' + p.name + '" from the shop?', { danger: true });
          if (!ok) return;
          catalog.splice(idx, 1);
          await save();
          load();
        });
        tbody.appendChild(tr);
      });
    } catch (e) { HM.state.error(body, e); }
  }

  function catLabel(key) {
    var c = CATEGORIES.find(function (x) { return x.key === key; });
    return c ? c.label : key;
  }

  function showEditor(idx) {
    var p = idx != null ? catalog[idx] : { active: true };
    var isNew = idx == null;

    var catOpts = CATEGORIES.map(function (c) {
      return '<option value="' + c.key + '"' + (p.category === c.key ? ' selected' : '') + '>' + c.label + '</option>';
    }).join('');

    var m = HM.ui.modal({
      size: 'lg',
      title: isNew ? 'Add Product · 新增產品' : 'Edit Product · 編輯產品',
      content: '<form id="pe-form">' +
        '<div class="field-grid field-grid--2">' +
        '<div class="field"><label class="field-label" data-required>Name · 名稱</label>' +
        '<input name="name" class="field-input field-input--boxed" required value="' + HM.format.esc(p.name || '') + '"></div>' +
        '<div class="field"><label class="field-label">Chinese Name · 中文</label>' +
        '<input name="name_zh" class="field-input field-input--boxed" value="' + HM.format.esc(p.name_zh || '') + '"></div>' +
        '<div class="field"><label class="field-label" data-required>Category</label>' +
        '<select name="category" class="field-input field-input--boxed" required>' + catOpts + '</select></div>' +
        '<div class="field"><label class="field-label">Emoji Icon</label>' +
        '<input name="emoji" class="field-input field-input--boxed" value="' + HM.format.esc(p.emoji || '🌿') + '" placeholder="🌿"></div>' +
        '<div class="field"><label class="field-label" data-required>Price (RM)</label>' +
        '<input name="price" type="number" step="0.01" min="0" class="field-input field-input--boxed" required value="' + (p.price || '') + '"></div>' +
        '<div class="field"><label class="field-label">Stock</label>' +
        '<input name="stock" type="number" min="0" class="field-input field-input--boxed" value="' + (p.stock != null ? p.stock : '') + '"></div>' +
        '</div>' +
        '<div class="field"><label class="field-label">Description · 描述</label>' +
        '<textarea name="description" class="field-input field-input--boxed" rows="3">' + HM.format.esc(p.description || '') + '</textarea></div>' +

        '<div class="field"><label class="check-item"><input type="checkbox" name="active" value="1"' + (p.active !== false ? ' checked' : '') + '> Show in shop (uncheck to hide)</label></div>' +

        '<div class="alert alert--warning mb-2" style="margin-top: var(--s-3);">' +
        '<div class="alert-body" style="font-size: var(--text-xs);">' +
        '<strong>Gate 3 · Self-administration safety</strong><br>' +
        'Only tick this box for products that are <strong>safe for unsupervised self-use</strong> — single-herb supplements, classical low-potency formulas (e.g. Liu Wei Di Huang Wan 六味地黃丸, Gui Pi Wan 歸脾丸, Bao Ji Wan 保濟丸), wellness teas, external topicals. Complex multi-herb or customised formulas must NOT be sold direct — they require practitioner consultation.' +
        '</div></div>' +
        '<div class="field"><label class="check-item"><input type="checkbox" name="self_safe" value="1"' + (p.self_safe === true ? ' checked' : '') + '> ✓ Safe for self-administration (visible to patients in Shop)</label></div>' +
        '<div data-general-error class="alert alert--danger" style="display:none;"></div>' +
        '<button type="submit" class="btn btn--primary btn--block mt-4">' + (isNew ? 'Add to Catalog' : 'Save Changes') + '</button>' +
        '</form>',
    });

    var form = m.element.querySelector('#pe-form');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var data = HM.form.serialize(form);
      data.price = parseFloat(data.price);
      data.stock = data.stock ? parseInt(data.stock, 10) : null;
      data.active = !!data.active;
      data.self_safe = !!data.self_safe;
      if (isNew) {
        data.id = 'p' + Date.now();
        catalog.push(data);
      } else {
        catalog[idx] = Object.assign({}, p, data);
      }
      HM.form.setLoading(form, true);
      try {
        await save();
        m.close();
        HM.ui.toast('Catalog updated', 'success');
        load();
      } catch (err) {
        HM.form.setLoading(form, false);
        HM.form.showGeneralError(form, err.message || 'Save failed');
      }
    });
  }

  async function save() {
    await HM.api.admin.setConfigs({ shop_catalog: JSON.stringify(catalog) });
  }

  HM.adminPanels.shopCatalog = { render: render };
})();
