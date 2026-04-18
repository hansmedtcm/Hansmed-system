/**
 * Products & Inventory
 */
(function () {
  'use strict';
  HM.pharmPanels = HM.pharmPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header flex-between">' +
      '<div><div class="page-header-label">Products · 產品</div>' +
      '<h1 class="page-title">Inventory Management</h1></div>' +
      '<button class="btn btn--primary" id="add-prod">+ Add Product · 新增</button>' +
      '</div>' +
      '<div id="prod-list"></div>';

    document.getElementById('add-prod').addEventListener('click', showAddForm);
    await load();
  }

  async function load() {
    var container = document.getElementById('prod-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.pharmacy.listProducts();
      var items = res.data || [];
      if (!items.length) {
        HM.state.empty(container, { icon: '💊', title: 'No products yet', text: 'Add products to start selling' });
        return;
      }
      container.innerHTML = '<div class="table-wrap"><table class="table table--responsive"><thead><tr><th>Product</th><th>SKU</th><th style="text-align:right;">Cost / 1 g</th><th style="text-align:right;">Stock (g)</th><th>Status</th><th></th></tr></thead><tbody></tbody></table></div>';
      var tbody = container.querySelector('tbody');
      items.forEach(function (p) {
        var stock = p.inventory ? parseFloat(p.inventory.quantity_on_hand) : 0;
        var threshold = p.inventory ? parseFloat(p.inventory.reorder_threshold) : 0;
        var lowStock = stock <= threshold;
        var unitPrice = parseFloat(p.unit_price) || 0;
        var tr = document.createElement('tr');
        tr.innerHTML = '<td data-label="Product"><strong>' + HM.format.esc(p.name) + '</strong>' +
          (p.specification ? '<br><span class="text-xs text-muted">' + HM.format.esc(p.specification) + '</span>' : '') + '</td>' +
          '<td data-label="SKU">' + HM.format.esc(p.sku || '—') + '</td>' +
          '<td data-label="Cost / 1 g" style="text-align:right;font-family:var(--font-mono);">RM ' + unitPrice.toFixed(4) + '</td>' +
          '<td data-label="Stock (g)" style="text-align:right;"><span class="' + (lowStock ? 'text-danger' : '') + '">' + stock.toFixed(0) + ' ' + (p.unit || 'g') + '</span></td>' +
          '<td data-label="Status">' + (p.is_listed ? '<span class="badge badge--success">Listed</span>' : '<span class="badge">Hidden</span>') + '</td>' +
          '<td data-label="Actions"><button class="btn btn--outline btn--sm" data-stock>± Stock</button> <button class="btn btn--ghost btn--sm" data-toggle>' + (p.is_listed ? 'Hide' : 'Show') + '</button></td>';
        tr.querySelector('[data-stock]').addEventListener('click', function () { adjustStock(p); });
        tr.querySelector('[data-toggle]').addEventListener('click', function () { toggleListing(p); });
        tbody.appendChild(tr);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  // Add-product form uses the bulk-pack pricing model: pharmacies buy
  // herbs in bags with a known weight (grams per pack) and a known
  // bag price, so the unit cost per gram is computed automatically
  // as price_per_pack / grams_per_pack. The unit_price stored on the
  // product row is always "per 1 g" so doctor prescriptions can
  // multiply grams × unit_price to get the total.
  function showAddForm() {
    var m = HM.ui.modal({
      title: 'Add Product · 新增產品',
      content: '<form id="np-form">' +
        '<div class="field"><label class="field-label" data-required>Name · 名稱</label>' +
        '<input name="name" class="field-input field-input--boxed" required></div>' +

        '<div class="field"><label class="field-label">Specification · 規格</label>' +
        '<input name="specification" class="field-input field-input--boxed" placeholder="e.g. 濃縮細粒 / Granules"></div>' +

        '<div class="text-label mt-3 mb-2">Pack Pricing · 套裝計價</div>' +
        '<div class="field-grid field-grid--3">' +
          '<div class="field"><label class="field-label" data-required>Grams per Unit · 每單位克數</label>' +
          '<input name="pack_grams" id="np-grams" type="number" step="1" min="1" class="field-input field-input--boxed" value="100" required>' +
          '<div class="field-hint">How many grams per bag / jar?</div></div>' +

          '<div class="field"><label class="field-label" data-required>Total Price (RM) · 套裝總價</label>' +
          '<input name="pack_price" id="np-pack-price" type="number" step="0.01" min="0" class="field-input field-input--boxed" required>' +
          '<div class="field-hint">What does one unit cost?</div></div>' +

          '<div class="field"><label class="field-label">Cost per 1 g · 每克成本 (auto)</label>' +
          '<input name="unit_price" id="np-unit-price" type="number" step="0.0001" class="field-input field-input--boxed" readonly style="background:var(--washi);font-weight:600;color:var(--gold);">' +
          '<div class="field-hint">Auto-calculated. Used for prescriptions.</div></div>' +
        '</div>' +

        '<div class="field-grid field-grid--2">' +
          '<div class="field"><label class="field-label">Unit · 單位</label>' +
          '<input name="unit" class="field-input field-input--boxed" value="g" readonly style="background:var(--washi);"></div>' +
          '<div class="field"><label class="field-label">SKU · 貨號</label>' +
          '<input name="sku" class="field-input field-input--boxed"></div>' +
        '</div>' +

        '<div class="field"><label class="field-label">Initial Stock (grams) · 初始庫存（克）</label>' +
        '<input name="initial_stock" type="number" step="1" min="0" class="field-input field-input--boxed" value="0">' +
        '<div class="field-hint">Total grams on hand — e.g. 5 bags × 100 g = 500</div></div>' +

        '<button type="submit" class="btn btn--primary btn--block">Create · 建立</button>' +
        '</form>',
    });
    var form = m.element.querySelector('#np-form');
    var grams = form.querySelector('#np-grams');
    var packPrice = form.querySelector('#np-pack-price');
    var unitPrice = form.querySelector('#np-unit-price');

    function recalc() {
      var g = parseFloat(grams.value) || 0;
      var p = parseFloat(packPrice.value) || 0;
      if (g > 0 && p >= 0) {
        unitPrice.value = (p / g).toFixed(4);
      } else {
        unitPrice.value = '';
      }
    }
    grams.addEventListener('input', recalc);
    packPrice.addEventListener('input', recalc);

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var d = HM.form.serialize(form);
      if (!d.unit_price || parseFloat(d.unit_price) <= 0) {
        HM.ui.toast('Enter grams per unit and total price to compute cost per gram', 'warning');
        return;
      }
      try {
        // Store cost per 1 g on products.unit_price and tuck the pack
        // metadata into specification so we can re-display it later.
        var packSuffix = d.pack_grams + ' g / RM ' + parseFloat(d.pack_price).toFixed(2) + ' per unit';
        d.specification = d.specification
          ? d.specification + ' · ' + packSuffix
          : packSuffix;
        await HM.api.pharmacy.createProduct(d);
        m.close();
        HM.ui.toast('Product added · 已新增', 'success');
        load();
      } catch (err) { HM.ui.toast(err.message || 'Failed', 'danger'); }
    });
  }

  async function adjustStock(p) {
    var qty = await HM.ui.prompt('Adjust stock for "' + p.name + '"\nPositive to add, negative to remove:', { type: 'number' });
    if (!qty) return;
    try {
      await HM.api.pharmacy.adjustStock(p.id, { change_qty: parseFloat(qty), reason: 'adjustment' });
      HM.ui.toast('Stock updated · 庫存已更新', 'success');
      load();
    } catch (e) { HM.ui.toast(e.message || 'Failed', 'danger'); }
  }

  async function toggleListing(p) {
    try {
      await HM.api.pharmacy.updateProduct(p.id, { is_listed: !p.is_listed });
      HM.ui.toast(p.is_listed ? 'Product hidden · 已下架' : 'Product listed · 已上架', 'success');
      load();
    } catch (e) { HM.ui.toast(e.message || 'Failed', 'danger'); }
  }

  HM.pharmPanels.products = { render: render };
})();
