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
      container.innerHTML = '<div class="table-wrap"><table class="table table--responsive"><thead><tr><th>Product</th><th>SKU</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead><tbody></tbody></table></div>';
      var tbody = container.querySelector('tbody');
      items.forEach(function (p) {
        var stock = p.inventory ? parseFloat(p.inventory.quantity_on_hand) : 0;
        var threshold = p.inventory ? parseFloat(p.inventory.reorder_threshold) : 0;
        var lowStock = stock <= threshold;
        var tr = document.createElement('tr');
        tr.innerHTML = '<td data-label="Product"><strong>' + HM.format.esc(p.name) + '</strong>' +
          (p.specification ? '<br><span class="text-xs text-muted">' + HM.format.esc(p.specification) + '</span>' : '') + '</td>' +
          '<td data-label="SKU">' + HM.format.esc(p.sku || '—') + '</td>' +
          '<td data-label="Price">' + HM.format.money(p.unit_price) + '</td>' +
          '<td data-label="Stock"><span class="' + (lowStock ? 'text-danger' : '') + '">' + stock + ' ' + p.unit + '</span></td>' +
          '<td data-label="Status">' + (p.is_listed ? '<span class="badge badge--success">Listed</span>' : '<span class="badge">Hidden</span>') + '</td>' +
          '<td data-label="Actions"><button class="btn btn--outline btn--sm" data-stock>± Stock</button> <button class="btn btn--ghost btn--sm" data-toggle>' + (p.is_listed ? 'Hide' : 'Show') + '</button></td>';
        tr.querySelector('[data-stock]').addEventListener('click', function () { adjustStock(p); });
        tr.querySelector('[data-toggle]').addEventListener('click', function () { toggleListing(p); });
        tbody.appendChild(tr);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  function showAddForm() {
    var m = HM.ui.modal({
      title: 'Add Product · 新增產品',
      content: '<form id="np-form">' +
        '<div class="field"><label class="field-label" data-required>Name · 名稱</label><input name="name" class="field-input field-input--boxed" required></div>' +
        '<div class="field-grid field-grid--2">' +
        '<div class="field"><label class="field-label" data-required>Unit Price (RM)</label><input name="unit_price" type="number" step="0.01" class="field-input field-input--boxed" required></div>' +
        '<div class="field"><label class="field-label">Unit</label><input name="unit" class="field-input field-input--boxed" value="g"></div>' +
        '<div class="field"><label class="field-label">SKU</label><input name="sku" class="field-input field-input--boxed"></div>' +
        '<div class="field"><label class="field-label">Initial Stock</label><input name="initial_stock" type="number" class="field-input field-input--boxed" value="0"></div>' +
        '</div>' +
        '<div class="field"><label class="field-label">Specification</label><input name="specification" class="field-input field-input--boxed"></div>' +
        '<button type="submit" class="btn btn--primary btn--block">Create · 建立</button>' +
        '</form>',
    });
    m.element.querySelector('#np-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var d = HM.form.serialize(e.target);
      try {
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
