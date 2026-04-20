/**
 * Admin Medicine Stock — inventory + purchase-order log.
 *
 * Two sub-views share this panel:
 *   • Stock     — list every medicine with current grams on hand + pack pricing.
 *                 Admin edits per-row details or adjusts stock directly.
 *   • Purchase  — log of stock-in transactions (invoice, supplier, quantity,
 *                 price). Creating a row auto-increments the medicine's
 *                 stock_grams so the Stock view stays accurate without
 *                 double-entry.
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  var state = { q: '', type: '', activeOnly: true, view: 'stock' };
  var purchaseState = { q: '', from: '', to: '', medicineId: '' };

  async function render(el) {
    el.innerHTML =
      '<div class="page-header flex-between" style="align-items:center;flex-wrap:wrap;gap:var(--s-2);">' +
        '<div><div class="page-header-label">Medicine Stock · 藥材庫存</div>' +
        '<h1 class="page-title">Inventory &amp; Purchases</h1>' +
        '<p class="text-muted text-sm mt-1">Track grams on hand, log supplier purchases, and keep pack pricing in sync. ' +
        '<span style="font-family: var(--font-zh);">庫存管理與進貨記錄。</span></p></div>' +
      '</div>' +

      // Sub-view tabs
      '<div class="tabs mb-4">' +
        '<button class="tab is-active" data-view="stock">📦 Stock · 庫存</button>' +
        '<button class="tab" data-view="purchase">🧾 Purchase Log · 進貨記錄</button>' +
      '</div>' +

      '<div id="mc-view-stock" class="mc-view"></div>' +
      '<div id="mc-view-purchase" class="mc-view" style="display:none;"></div>';

    // Wire tab switching
    el.querySelectorAll('.tabs .tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        el.querySelectorAll('.tabs .tab').forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
        state.view = tab.getAttribute('data-view');
        document.getElementById('mc-view-stock').style.display    = state.view === 'stock'    ? 'block' : 'none';
        document.getElementById('mc-view-purchase').style.display = state.view === 'purchase' ? 'block' : 'none';
        if (state.view === 'stock') {
          ensureStockRendered();
        } else {
          ensurePurchaseRendered();
        }
      });
    });

    renderStockView();
    renderPurchaseView();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STOCK VIEW — table of medicines with current grams on hand
  // ═══════════════════════════════════════════════════════════════════════

  function renderStockView() {
    var host = document.getElementById('mc-view-stock');
    if (!host) return;
    host.innerHTML =
      '<div class="flex-between mb-3 flex-wrap" style="gap:var(--s-2);">' +
        '<div id="mc-summary" class="text-sm text-muted"></div>' +
        '<div class="flex gap-2 flex-wrap">' +
          '<button class="btn btn--outline" id="mc-export">📥 Export CSV · 匯出</button>' +
          '<label class="btn btn--outline" style="cursor:pointer;margin:0;">' +
            '📤 Import CSV · 匯入' +
            '<input type="file" id="mc-import-file" accept=".csv,text/csv" style="display:none;">' +
          '</label>' +
          '<button class="btn btn--outline" id="mc-reconcile" title="Apply any missing stock decrements from dispensed orders">🔄 Sync Dispensed · 對賬</button>' +
          '<button class="btn btn--primary" id="mc-add">+ Add Medicine · 新增</button>' +
        '</div>' +
      '</div>' +

      '<div class="card mb-3" style="padding: var(--s-3);">' +
        '<div class="flex gap-3 flex-wrap" style="align-items:center;">' +
          '<input type="text" id="mc-search" class="field-input field-input--boxed" placeholder="🔍 Search Chinese name, Pinyin, or code…" style="flex:1;min-width:240px;">' +
          '<select id="mc-type" class="field-input field-input--boxed" style="min-width:160px;">' +
            '<option value="">All types</option>' +
            '<option value="single">单方 Single herbs</option>' +
            '<option value="compound">复方 Compound formulas</option>' +
          '</select>' +
          '<label class="flex gap-1" style="align-items:center;font-size:var(--text-sm);color:var(--stone);">' +
            '<input type="checkbox" id="mc-active" checked> Active only · 僅顯示有效' +
          '</label>' +
          '<label class="flex gap-1" style="align-items:center;font-size:var(--text-sm);color:var(--stone);">' +
            '<input type="checkbox" id="mc-lowstock"> ⚠ Low stock only · 僅顯示低庫存' +
          '</label>' +
        '</div>' +
      '</div>' +

      '<div id="mc-list"></div>';

    document.getElementById('mc-search').addEventListener('input', debounce(function (e) {
      state.q = e.target.value; loadStock();
    }, 250));
    document.getElementById('mc-type').addEventListener('change', function (e) {
      state.type = e.target.value; loadStock();
    });
    document.getElementById('mc-active').addEventListener('change', function (e) {
      state.activeOnly = e.target.checked; loadStock();
    });
    document.getElementById('mc-lowstock').addEventListener('change', function () { loadStock(); });
    document.getElementById('mc-add').addEventListener('click', function () { showEditModal(null); });
    document.getElementById('mc-export').addEventListener('click', exportCsv);
    document.getElementById('mc-reconcile').addEventListener('click', reconcileStock);
    document.getElementById('mc-import-file').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) importCsv(file);
      e.target.value = ''; // allow re-uploading the same filename
    });

    loadStock();
  }

  async function ensureStockRendered() { loadStock(); }

  async function loadStock() {
    var host = document.getElementById('mc-list');
    var summaryEl = document.getElementById('mc-summary');
    if (!host) return;
    HM.state.loading(host);
    try {
      var qs = [];
      if (state.q)    qs.push('q=' + encodeURIComponent(state.q));
      if (state.type) qs.push('type=' + state.type);
      if (state.activeOnly) qs.push('active_only=1');
      var res = await HM.api.admin.listMedicineCatalog(qs.join('&'));
      var rows = res.data || [];
      var lowOnly = document.getElementById('mc-lowstock') && document.getElementById('mc-lowstock').checked;
      if (lowOnly) {
        rows = rows.filter(function (r) {
          var stock = parseFloat(r.stock_grams) || 0;
          var threshold = parseFloat(r.reorder_threshold) || 0;
          return threshold > 0 && stock <= threshold;
        });
      }

      if (!rows.length) {
        if (state.q || state.type || lowOnly) {
          HM.state.empty(host, { icon: '🔍', title: 'No matches', text: 'Try a different search or filter.' });
        } else {
          HM.state.empty(host, {
            icon: '🌿',
            title: 'No medicines yet',
            text: 'Click "Re-import Mar-2026" for the Timing Herbs list, or "+ Add Medicine" to create one manually.',
          });
        }
        summaryEl.textContent = '';
        return;
      }

      var totalStockGrams = rows.reduce(function (s, r) { return s + (parseFloat(r.stock_grams) || 0); }, 0);
      var outOfStock = rows.filter(function (r) { return (parseFloat(r.stock_grams) || 0) === 0; }).length;
      var lowStock = rows.filter(function (r) {
        var s = parseFloat(r.stock_grams) || 0;
        var t = parseFloat(r.reorder_threshold) || 0;
        return t > 0 && s > 0 && s <= t;
      }).length;
      summaryEl.innerHTML =
        '📦 <strong>' + rows.length + '</strong> medicines · ' +
        '⚖️ Total <strong>' + (totalStockGrams / 1000).toFixed(2) + ' kg</strong> on hand · ' +
        (outOfStock > 0 ? '<span style="color:var(--red-seal);">⛔ ' + outOfStock + ' out of stock</span> · ' : '') +
        (lowStock > 0 ? '<span style="color:var(--gold);">⚠ ' + lowStock + ' low</span>' : '');

      host.innerHTML = '<div class="table-wrap"><table class="table">' +
        '<thead><tr>' +
          '<th>Code</th><th>中文</th><th>Pinyin</th><th>Type</th>' +
          '<th style="text-align:right;">Pack</th>' +
          '<th style="text-align:right;">Pack Price</th>' +
          '<th style="text-align:right;">Cost / 1 g</th>' +
          '<th style="text-align:right;">Stock (g)</th>' +
          '<th>Status</th><th></th>' +
        '</tr></thead><tbody></tbody></table></div>';
      var tbody = host.querySelector('tbody');

      rows.forEach(function (r) {
        var packGrams = parseFloat(r.pack_grams) || 100;
        var pricePerGram = r.unit_price != null ? (parseFloat(r.unit_price) / packGrams) : null;
        var stock = parseFloat(r.stock_grams) || 0;
        var threshold = parseFloat(r.reorder_threshold) || 0;
        var stockColor = stock === 0 ? 'var(--red-seal)'
                       : (threshold > 0 && stock <= threshold) ? 'var(--gold)'
                       : 'var(--sage)';
        var stockIcon = stock === 0 ? '⛔ '
                       : (threshold > 0 && stock <= threshold) ? '⚠ '
                       : '';

        var typeBadge = r.type === 'compound'
          ? '<span class="chip chip--gold">复方</span>'
          : '<span class="chip chip--sage">单方</span>';
        var statusBadge = r.is_active
          ? '<span class="badge badge--success">Active</span>'
          : '<span class="badge">Inactive</span>';
        var packCell = packGrams + ' g';
        var priceCell = r.unit_price == null
          ? '<span class="text-muted">—</span>'
          : HM.format.money(r.unit_price);
        var perGramCell = pricePerGram == null
          ? '<span class="text-muted">—</span>'
          : '<span style="font-family: var(--font-mono); color: var(--gold);">RM ' + pricePerGram.toFixed(4) + '</span>';

        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td style="font-family: var(--font-mono); color: var(--stone);">' + HM.format.esc(r.code) + '</td>' +
          '<td><strong>' + HM.format.esc(r.name_zh) + '</strong></td>' +
          '<td>' + HM.format.esc(r.name_pinyin) + '</td>' +
          '<td>' + typeBadge + '</td>' +
          '<td style="text-align:right; font-family: var(--font-mono); color: var(--stone);">' + packCell + '</td>' +
          '<td style="text-align:right;">' + priceCell + '</td>' +
          '<td style="text-align:right;">' + perGramCell + '</td>' +
          '<td style="text-align:right; font-family: var(--font-mono); color: ' + stockColor + '; font-weight:600;">' + stockIcon + stock.toFixed(1) + ' g</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td style="white-space:nowrap;">' +
            '<button class="btn btn--ghost btn--sm" data-act="stock" title="Adjust stock">± Stock</button> ' +
            '<button class="btn btn--ghost btn--sm" data-act="edit">✎ Edit</button> ' +
            '<button class="btn btn--ghost btn--sm" data-act="del" style="color:var(--red-seal);">🗑</button>' +
          '</td>';
        tr.querySelector('[data-act="edit"]').addEventListener('click', function () { showEditModal(r); });
        tr.querySelector('[data-act="del"]').addEventListener('click', function () { confirmDelete(r); });
        tr.querySelector('[data-act="stock"]').addEventListener('click', function () { showStockAdjustModal(r); });
        tbody.appendChild(tr);
      });
    } catch (e) { HM.state.error(host, e); }
  }

  // Manual stock adjustment (for corrections outside a purchase order).
  function showStockAdjustModal(row) {
    var current = parseFloat(row.stock_grams) || 0;
    var m = HM.ui.modal({
      size: 'md',
      title: '± Adjust Stock · 調整庫存 — ' + row.name_zh,
      content:
        '<p class="text-sm text-muted mb-3">Current stock: <strong>' + current.toFixed(1) + ' g</strong>. ' +
        'Use this for corrections, stocktake write-offs, or entering an opening balance. ' +
        'For supplier purchases, use the Purchase Log tab instead — that auto-updates stock and keeps an invoice record.</p>' +
        '<form id="sa-form">' +
        '<div class="field-grid field-grid--2">' +
          '<div class="field"><label class="field-label" data-required>Mode · 模式</label>' +
          '<select name="mode" class="field-input field-input--boxed" required>' +
            '<option value="add">+ Add (stock in) · 入庫</option>' +
            '<option value="subtract">− Subtract (write-off / dispense) · 出庫</option>' +
            '<option value="set">= Set exact value (stocktake) · 設定實際值</option>' +
          '</select></div>' +
          '<div class="field"><label class="field-label" data-required>Amount (grams) · 克數</label>' +
          '<input name="amount" type="number" step="0.1" min="0" class="field-input field-input--boxed" required></div>' +
        '</div>' +
        '<div class="field"><label class="field-label">Notes · 備註</label>' +
        '<input name="notes" class="field-input field-input--boxed" placeholder="Reason for adjustment (optional)"></div>' +
        '<div data-general-error class="alert alert--danger mt-2" style="display:none;"></div>' +
        '<button type="submit" class="btn btn--primary btn--block mt-4">Apply Adjustment · 套用</button>' +
        '</form>',
    });

    var form = m.element.querySelector('#sa-form');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var d = HM.form.serialize(form);
      d.amount = parseFloat(d.amount) || 0;
      HM.form.setLoading(form, true);
      try {
        var res = await HM.api.admin.adjustMedicineStock(row.id, d);
        m.close();
        HM.ui.toast(row.name_zh + ' → ' + res.stock_grams + ' g', 'success');
        loadStock();
      } catch (err) {
        HM.form.setLoading(form, false);
        HM.form.showGeneralError(form, (err && err.message) || 'Failed');
      }
    });
  }

  function showEditModal(row) {
    var isNew = !row;
    row = row || {
      code: '', name_zh: '', name_pinyin: '', type: 'single',
      unit_price: '', pack_grams: 100, unit: 'per 100g',
      stock_grams: 0, reorder_threshold: 0,
      notes: '', is_active: 1,
    };

    var m = HM.ui.modal({
      size: 'md',
      title: isNew ? '+ Add Medicine · 新增藥材' : '✎ Edit Medicine · 編輯藥材',
      content:
        '<form id="mc-form">' +
        '<div class="field-grid field-grid--2">' +
          '<div class="field"><label class="field-label" data-required>Code · 編號</label>' +
          '<input name="code" class="field-input field-input--boxed" required value="' + HM.format.esc(row.code || '') + '" placeholder="e.g. 5504 or B0207"></div>' +
          '<div class="field"><label class="field-label" data-required>Type · 類型</label>' +
          '<select name="type" class="field-input field-input--boxed" required>' +
            '<option value="single"'   + (row.type === 'single'   ? ' selected' : '') + '>单方 Single herb</option>' +
            '<option value="compound"' + (row.type === 'compound' ? ' selected' : '') + '>复方 Compound formula</option>' +
          '</select></div>' +
          '<div class="field"><label class="field-label" data-required>中文</label>' +
          '<input name="name_zh" class="field-input field-input--boxed" required value="' + HM.format.esc(row.name_zh || '') + '"></div>' +
          '<div class="field"><label class="field-label" data-required>Pinyin</label>' +
          '<input name="name_pinyin" class="field-input field-input--boxed" required value="' + HM.format.esc(row.name_pinyin || '') + '"></div>' +
        '</div>' +

        '<div class="text-label mt-4 mb-2">Pack Pricing · 套裝計價</div>' +
        '<div class="field-grid field-grid--3">' +
          '<div class="field"><label class="field-label" data-required>Grams per Unit · 每單位</label>' +
          '<input name="pack_grams" id="mc-grams" type="number" step="1" min="1" class="field-input field-input--boxed" value="' + HM.format.esc(row.pack_grams != null ? row.pack_grams : 100) + '" required></div>' +

          '<div class="field"><label class="field-label">Total Price (RM) · 套裝總價</label>' +
          '<input name="unit_price" id="mc-pack-price" type="number" step="0.01" min="0" class="field-input field-input--boxed" value="' + HM.format.esc(row.unit_price != null ? row.unit_price : '') + '" placeholder="Leave blank for 询价"></div>' +

          '<div class="field"><label class="field-label">Cost per 1 g · 每克</label>' +
          '<input id="mc-per-gram" type="text" class="field-input field-input--boxed" readonly style="background:var(--washi);font-weight:600;color:var(--gold);"></div>' +
        '</div>' +

        '<div class="text-label mt-4 mb-2">Stock · 庫存</div>' +
        '<div class="field-grid field-grid--2">' +
          '<div class="field"><label class="field-label">Current Stock (grams) · 目前庫存</label>' +
          '<input name="stock_grams" type="number" step="0.1" min="0" class="field-input field-input--boxed" value="' + HM.format.esc(row.stock_grams != null ? row.stock_grams : 0) + '"></div>' +
          '<div class="field"><label class="field-label">Reorder Threshold · 補貨閾值</label>' +
          '<input name="reorder_threshold" type="number" step="0.1" min="0" class="field-input field-input--boxed" value="' + HM.format.esc(row.reorder_threshold != null ? row.reorder_threshold : 0) + '" placeholder="Warn when stock falls below this">' +
          '<div class="field-hint">Low-stock warning triggers when stock ≤ this value.</div></div>' +
        '</div>' +

        '<div class="field-grid field-grid--2 mt-2">' +
          '<div class="field"><label class="field-label">Unit Label</label>' +
          '<input name="unit" class="field-input field-input--boxed" value="' + HM.format.esc(row.unit || 'per 100g') + '"></div>' +
          '<div class="field"><label class="flex gap-2" style="align-items:center;margin-top:26px;">' +
          '<input type="checkbox" name="is_active" ' + (row.is_active ? 'checked' : '') + '> Active · 有效</label></div>' +
        '</div>' +

        '<div class="field"><label class="field-label">Notes · 備註</label>' +
        '<textarea name="notes" class="field-input field-input--boxed" rows="2">' + HM.format.esc(row.notes || '') + '</textarea></div>' +

        '<div data-general-error class="alert alert--danger mt-3" style="display:none;"></div>' +
        '<div class="flex gap-2 mt-4">' +
        '<button type="submit" class="btn btn--primary" style="margin-left:auto;">' + (isNew ? 'Create' : 'Save') + '</button>' +
        '</div>' +
        '</form>',
    });

    var form = m.element.querySelector('#mc-form');
    var gramsInp = form.querySelector('#mc-grams');
    var priceInp = form.querySelector('#mc-pack-price');
    var perGramEl = form.querySelector('#mc-per-gram');
    function recalc() {
      var g = parseFloat(gramsInp.value) || 0;
      var p = parseFloat(priceInp.value);
      perGramEl.value = (g > 0 && !isNaN(p) && p >= 0) ? 'RM ' + (p / g).toFixed(4) + ' / g' : '—';
    }
    gramsInp.addEventListener('input', recalc);
    priceInp.addEventListener('input', recalc);
    recalc();

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var d = HM.form.serialize(form);
      if (d.unit_price === '' || d.unit_price === undefined) d.unit_price = null;
      else d.unit_price = parseFloat(d.unit_price);
      d.pack_grams = parseFloat(d.pack_grams) || 100;
      d.stock_grams = parseFloat(d.stock_grams) || 0;
      d.reorder_threshold = parseFloat(d.reorder_threshold) || 0;
      d.is_active = form.querySelector('[name="is_active"]').checked ? 1 : 0;

      HM.form.setLoading(form, true);
      try {
        if (isNew) await HM.api.admin.createMedicine(d);
        else       await HM.api.admin.updateMedicine(row.id, d);
        HM.ui.toast(isNew ? 'Medicine added' : 'Medicine updated', 'success');
        m.close();
        loadStock();
      } catch (err) {
        HM.form.setLoading(form, false);
        if (err.data && err.data.errors) HM.form.showErrors(form, err.data.errors);
        else HM.form.showGeneralError(form, (err && err.message) || 'Failed');
      }
    });
  }

  function confirmDelete(row) {
    HM.ui.confirm({
      title: 'Delete ' + row.name_zh + '?',
      message: 'Soft-delete hides this medicine from prescription autocomplete but keeps historical records and stock balance intact. You can restore it by unchecking "Active only".',
      confirmLabel: '🗑 Soft-delete · 停用',
      cancelLabel: 'Cancel',
      onConfirm: async function () {
        try {
          await HM.api.admin.deleteMedicine(row.id);
          HM.ui.toast('Medicine deactivated', 'success');
          loadStock();
        } catch (e) { HM.ui.toast(e.message || 'Failed', 'danger'); }
      },
    });
  }

  // Reconcile medicine_catalog.stock_grams against every historical
  // dispensed order. Idempotent via audit_logs dedup. Useful when
  // dispenses happened before the matcher was robust enough to debit
  // stock — one click applies all missing decrements.
  async function reconcileStock() {
    var ok = await HM.ui.confirm(
      'Sync all dispensed orders into medicine stock?\n\n' +
      'Walks every dispensed/shipped/delivered order and applies any\n' +
      'missing stock decrement. Already-applied decrements are skipped\n' +
      '(safe to run repeatedly).\n\n' +
      '對賬：將所有已配藥訂單同步到藥材庫存。重複執行亦安全。'
    );
    if (! ok) return;

    var btn = document.getElementById('mc-reconcile');
    var orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Syncing… · 對賬中';
    try {
      var res = await HM.api.admin.reconcileMedicineStock();
      var msg =
        (res.items_applied || 0) + ' applied · ' +
        (res.items_skipped || 0) + ' skipped (already booked) · ' +
        (res.items_unmatched || 0) + ' unmatched';
      HM.ui.toast(
        'Sync complete · 對賬完成\n' + msg,
        res.items_unmatched ? 'warning' : 'success',
        8000
      );
      // If anything was applied, reload so the new stock_grams shows.
      if (res.items_applied > 0) loadStock();

      // Surface unmatched rows in a modal so the admin can fix them.
      if (res.details && res.details.some(function (d) { return d.outcome === 'unmatched'; })) {
        var unmatched = res.details.filter(function (d) { return d.outcome === 'unmatched'; });
        HM.ui.modal({
          size: 'md',
          title: 'Unmatched items · 未對應項目',
          content:
            '<p class="text-sm text-muted mb-3">' +
            'These dispensed items did not match any medicine_catalog row. ' +
            'Check the name / Chinese character variants. ' +
            '<span style="font-family:var(--font-zh);">以下項目找不到對應的藥材。請檢查名稱或繁/簡字變體。</span>' +
            '</p>' +
            '<ul style="font-size:var(--text-sm);line-height:1.6;">' +
            unmatched.map(function (d) {
              return '<li>' + HM.format.esc(d.order) + ' · ' + HM.format.esc(d.drug) + '</li>';
            }).join('') +
            '</ul>',
        });
      }
    } catch (e) {
      HM.ui.toast('Sync failed: ' + (e.message || ''), 'danger');
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  // Download the full catalog as CSV. Triggers a direct browser download
  // using the streamed response from /admin/medicine-catalog/export.
  async function exportCsv() {
    var btn = document.getElementById('mc-export');
    var orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Exporting…';
    try {
      var blob = await HM.api.admin.exportMedicineCsv();
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'medicine-stock-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      HM.ui.toast('CSV exported · 已匯出', 'success');
    } catch (e) {
      HM.ui.toast('Export failed: ' + (e.message || ''), 'danger');
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  // Upload a CSV and upsert by code. Shows a summary modal of
  // inserted / updated / skipped rows with the first few error messages
  // so admin can fix them and re-upload.
  async function importCsv(file) {
    var btn = document.querySelector('label[for="mc-import-file"]');
    try {
      var res = await HM.api.admin.importMedicineCsv(file);
      var parts = [];
      if (res.inserted) parts.push(res.inserted + ' new');
      if (res.updated)  parts.push(res.updated + ' updated');
      if (res.skipped)  parts.push(res.skipped + ' skipped');
      HM.ui.toast(
        'Import complete · ' + (parts.join(', ') || 'no rows processed'),
        res.errors && res.errors.length ? 'warning' : 'success',
        6000
      );

      if (res.errors && res.errors.length) {
        HM.ui.modal({
          size: 'md',
          title: '⚠ Import completed with warnings',
          content:
            '<p class="text-sm text-muted mb-3">' +
            (res.inserted || 0) + ' row(s) inserted, ' +
            (res.updated || 0) + ' updated, ' +
            (res.skipped || 0) + ' skipped. Review the warnings below and re-upload the corrected rows if needed. ' +
            '<span style="font-family: var(--font-zh);">以下為略過的資料，可修正後再匯入。</span>' +
            '</p>' +
            '<div style="max-height: 300px; overflow-y: auto; background: var(--washi); padding: var(--s-3); border-radius: var(--r-sm); font-family: var(--font-mono); font-size: var(--text-xs); line-height: 1.6;">' +
            res.errors.slice(0, 50).map(function (e) { return '• ' + HM.format.esc(e); }).join('<br>') +
            (res.errors.length > 50 ? '<br>… and ' + (res.errors.length - 50) + ' more' : '') +
            '</div>',
        });
      }

      loadStock();
    } catch (e) {
      HM.ui.toast('Import failed: ' + (e.message || 'unknown error'), 'danger', 6000);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PURCHASE VIEW — stock-in log
  // ═══════════════════════════════════════════════════════════════════════

  function renderPurchaseView() {
    var host = document.getElementById('mc-view-purchase');
    if (!host) return;
    host.innerHTML =
      '<div class="flex-between mb-3 flex-wrap" style="gap:var(--s-2);">' +
        '<div id="mp-summary" class="text-sm text-muted"></div>' +
        '<button class="btn btn--primary" id="mp-add">+ Log Purchase · 登記進貨</button>' +
      '</div>' +

      '<div class="card mb-3" style="padding: var(--s-3);">' +
        '<div class="flex gap-2 flex-wrap" style="align-items:end;">' +
          '<div style="flex:1;min-width:240px;"><label class="text-xs text-muted">Search · 搜尋</label>' +
          '<input type="text" id="mp-search" class="field-input field-input--boxed" placeholder="Invoice, supplier, or medicine" style="margin:0;padding:6px 10px;"></div>' +
          '<div><label class="text-xs text-muted">From · 起</label>' +
          '<input type="date" id="mp-from" class="field-input field-input--boxed" style="margin:0;padding:6px 10px;"></div>' +
          '<div><label class="text-xs text-muted">To · 迄</label>' +
          '<input type="date" id="mp-to" class="field-input field-input--boxed" style="margin:0;padding:6px 10px;"></div>' +
          '<button class="btn btn--outline btn--sm" id="mp-apply">Apply · 套用</button>' +
          '<button class="btn btn--ghost btn--sm" id="mp-clear">Clear</button>' +
        '</div>' +
      '</div>' +

      '<div id="mp-list"></div>';

    document.getElementById('mp-add').addEventListener('click', function () { showPurchaseModal(); });
    document.getElementById('mp-apply').addEventListener('click', function () {
      purchaseState.q    = document.getElementById('mp-search').value;
      purchaseState.from = document.getElementById('mp-from').value;
      purchaseState.to   = document.getElementById('mp-to').value;
      loadPurchases();
    });
    document.getElementById('mp-clear').addEventListener('click', function () {
      document.getElementById('mp-search').value = '';
      document.getElementById('mp-from').value = '';
      document.getElementById('mp-to').value = '';
      purchaseState = { q: '', from: '', to: '', medicineId: '' };
      loadPurchases();
    });
    document.getElementById('mp-search').addEventListener('keypress', function (e) {
      if (e.key === 'Enter') document.getElementById('mp-apply').click();
    });
  }

  async function ensurePurchaseRendered() { loadPurchases(); }

  async function loadPurchases() {
    var host = document.getElementById('mp-list');
    var summaryEl = document.getElementById('mp-summary');
    if (!host) return;
    HM.state.loading(host);
    try {
      var qs = [];
      if (purchaseState.q)    qs.push('q=' + encodeURIComponent(purchaseState.q));
      if (purchaseState.from) qs.push('from=' + purchaseState.from);
      if (purchaseState.to)   qs.push('to=' + purchaseState.to);
      var res = await HM.api.admin.listMedicinePurchases(qs.join('&'));
      var rows = res.data || [];
      var s = res.summary || {};

      summaryEl.innerHTML =
        '🧾 <strong>' + (s.count || 0) + '</strong> purchases · ' +
        '⚖️ <strong>' + ((s.total_grams || 0) / 1000).toFixed(2) + ' kg</strong> received · ' +
        '💰 <strong>' + HM.format.money(s.total_cost || 0) + '</strong> total · ' +
        '🏢 <strong>' + (s.supplier_count || 0) + '</strong> supplier' + ((s.supplier_count || 0) === 1 ? '' : 's');

      if (!rows.length) {
        HM.state.empty(host, {
          icon: '🧾',
          title: 'No purchases logged',
          text: 'Click "+ Log Purchase" to record your first invoice.',
        });
        return;
      }

      host.innerHTML = '<div class="table-wrap"><table class="table table--responsive">' +
        '<thead><tr>' +
          '<th>Date</th><th>Invoice #</th><th>Supplier</th><th>Medicine</th>' +
          '<th style="text-align:right;">Qty (g)</th>' +
          '<th style="text-align:right;">Cost</th>' +
          '<th style="text-align:right;">Cost/1g</th>' +
          '<th></th>' +
        '</tr></thead><tbody></tbody></table></div>';
      var tbody = host.querySelector('tbody');

      rows.forEach(function (r) {
        var medLabel = r.name_zh
          ? '<strong>' + HM.format.esc(r.name_zh) + '</strong>' +
            (r.name_pinyin ? '<br><span class="text-xs text-muted">' + HM.format.esc(r.name_pinyin) + '</span>' : '')
          : '<span class="text-muted">(deleted medicine)</span>';
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td data-label="Date">' + HM.format.date(r.purchase_date) + '</td>' +
          '<td data-label="Invoice" style="font-family: var(--font-mono);">' + HM.format.esc(r.invoice_no || '—') + '</td>' +
          '<td data-label="Supplier">' + HM.format.esc(r.supplier_name) + '</td>' +
          '<td data-label="Medicine">' + medLabel + '</td>' +
          '<td data-label="Qty (g)" style="text-align:right; font-family: var(--font-mono);">' + (parseFloat(r.quantity_grams) || 0).toFixed(1) + '</td>' +
          '<td data-label="Cost" style="text-align:right;">' + (r.total_cost != null ? HM.format.money(r.total_cost) : '<span class="text-muted">—</span>') + '</td>' +
          '<td data-label="Cost/1g" style="text-align:right; font-family: var(--font-mono); color: var(--stone);">' +
            (r.unit_cost_per_gram != null ? 'RM ' + parseFloat(r.unit_cost_per_gram).toFixed(4) : '<span class="text-muted">—</span>') +
          '</td>' +
          '<td style="white-space:nowrap;">' +
            '<button class="btn btn--ghost btn--sm" data-act="del" style="color:var(--red-seal);">🗑</button>' +
          '</td>';
        tr.querySelector('[data-act="del"]').addEventListener('click', function () { confirmPurchaseDelete(r); });
        tbody.appendChild(tr);
      });
    } catch (e) { HM.state.error(host, e); }
  }

  // Purchase-order entry form. Picks a medicine from the catalog so stock
  // auto-updates on the right row; lets admin enter either grams directly
  // or pack_count × pack_grams for the convenience of entering "5 bags × 100 g".
  async function showPurchaseModal() {
    // Pre-load the active medicine list so the picker is already populated
    var catalog = [];
    try {
      var res = await HM.api.admin.listMedicineCatalog('active_only=1');
      catalog = res.data || [];
    } catch (_) {}

    var today = new Date().toISOString().substring(0, 10);
    var m = HM.ui.modal({
      size: 'lg',
      title: '🧾 Log Purchase Order · 登記進貨',
      content:
        '<form id="mp-form">' +

        '<div class="field-grid field-grid--3">' +
          '<div class="field"><label class="field-label" data-required>Purchase Date · 日期</label>' +
          '<input type="date" name="purchase_date" class="field-input field-input--boxed" value="' + today + '" required></div>' +

          '<div class="field"><label class="field-label">Invoice # · 發票號碼</label>' +
          '<input name="invoice_no" class="field-input field-input--boxed" placeholder="e.g. TH-2604-012"></div>' +

          '<div class="field"><label class="field-label" data-required>Supplier · 供應商</label>' +
          '<input name="supplier_name" class="field-input field-input--boxed" required placeholder="e.g. Timing Herbs SDN. BHD." list="mp-supplier-list">' +
          '<datalist id="mp-supplier-list"></datalist></div>' +
        '</div>' +

        '<div class="field"><label class="field-label" data-required>Medicine · 藥材</label>' +
        '<input type="text" id="mp-med-search" class="field-input field-input--boxed" placeholder="🔍 Search code, 中文, or pinyin…" required list="mp-med-list">' +
        '<datalist id="mp-med-list"></datalist>' +
        '<input type="hidden" name="medicine_id" id="mp-med-id">' +
        '<div id="mp-med-hint" class="text-xs text-muted mt-1"></div></div>' +

        '<div class="text-label mt-3 mb-2">Quantity · 數量</div>' +
        '<p class="text-xs text-muted mb-2">Enter either total grams, OR pack size × pack count. Leave the other empty and it\'s auto-calculated. ' +
        '<span style="font-family: var(--font-zh);">輸入克數，或每包克數 × 包數。</span></p>' +
        '<div class="field-grid field-grid--3">' +
          '<div class="field"><label class="field-label">Pack Size (g) · 每包</label>' +
          '<input name="pack_grams" id="mp-pack-g" type="number" step="1" min="0" class="field-input field-input--boxed" placeholder="e.g. 100"></div>' +

          '<div class="field"><label class="field-label">Pack Count · 包數</label>' +
          '<input name="pack_count" id="mp-pack-n" type="number" step="0.1" min="0" class="field-input field-input--boxed" placeholder="e.g. 5"></div>' +

          '<div class="field"><label class="field-label" data-required>Total Grams · 總克數</label>' +
          '<input name="quantity_grams" id="mp-qty-g" type="number" step="0.1" min="0" class="field-input field-input--boxed" placeholder="auto = pack × count"></div>' +
        '</div>' +

        '<div class="field-grid field-grid--2 mt-2">' +
          '<div class="field"><label class="field-label">Total Cost (RM) · 總金額</label>' +
          '<input name="total_cost" id="mp-cost" type="number" step="0.01" min="0" class="field-input field-input--boxed"></div>' +

          '<div class="field"><label class="field-label">Cost per 1 g · 每克 (auto)</label>' +
          '<input id="mp-cost-per-g" type="text" class="field-input field-input--boxed" readonly style="background:var(--washi);font-weight:600;color:var(--gold);"></div>' +
        '</div>' +

        '<div class="field mt-2"><label class="flex gap-2" style="align-items:center;">' +
        '<input type="checkbox" name="update_unit_price" checked> Also update the Medicine Stock reference price with this purchase\'s pack pricing · 同時更新藥材參考單價</label></div>' +

        '<div class="field"><label class="field-label">Notes · 備註</label>' +
        '<input name="notes" class="field-input field-input--boxed" placeholder="Batch no., expiry, anything else"></div>' +

        '<div data-general-error class="alert alert--danger mt-3" style="display:none;"></div>' +
        '<div class="flex gap-2 mt-4">' +
        '<button type="submit" class="btn btn--primary" style="margin-left:auto;">Save Purchase · 儲存</button>' +
        '</div>' +
        '</form>',
    });

    // Populate medicine + supplier autocomplete datalists
    var medList = m.element.querySelector('#mp-med-list');
    medList.innerHTML = catalog.map(function (x) {
      var label = x.code + '  ·  ' + x.name_zh + '  ·  ' + x.name_pinyin;
      return '<option value="' + HM.format.esc(label) + '" data-id="' + x.id + '"></option>';
    }).join('');

    // Pre-populate supplier datalist with recent unique suppliers
    try {
      var recent = await HM.api.admin.listMedicinePurchases('');
      var suppliers = {};
      (recent.data || []).forEach(function (r) { if (r.supplier_name) suppliers[r.supplier_name] = true; });
      var sList = m.element.querySelector('#mp-supplier-list');
      sList.innerHTML = Object.keys(suppliers).map(function (s) {
        return '<option value="' + HM.format.esc(s) + '"></option>';
      }).join('');
    } catch (_) {}

    var form    = m.element.querySelector('#mp-form');
    var medInp  = m.element.querySelector('#mp-med-search');
    var medHid  = m.element.querySelector('#mp-med-id');
    var medHint = m.element.querySelector('#mp-med-hint');
    var packG   = m.element.querySelector('#mp-pack-g');
    var packN   = m.element.querySelector('#mp-pack-n');
    var qtyG    = m.element.querySelector('#mp-qty-g');
    var costInp = m.element.querySelector('#mp-cost');
    var cpg     = m.element.querySelector('#mp-cost-per-g');

    // When a medicine is picked, resolve its id + show pack metadata
    medInp.addEventListener('input', function () {
      var match = catalog.find(function (x) {
        var label = x.code + '  ·  ' + x.name_zh + '  ·  ' + x.name_pinyin;
        return label === medInp.value;
      });
      if (match) {
        medHid.value = match.id;
        medHint.innerHTML = 'Current stock: <strong>' + (parseFloat(match.stock_grams) || 0).toFixed(1) +
          ' g</strong> · Reference pack: ' + (match.pack_grams || 100) + ' g';
        // Pre-fill pack size if empty
        if (!packG.value) packG.value = match.pack_grams || 100;
      } else {
        medHid.value = '';
        medHint.textContent = '';
      }
    });

    function recalcQty() {
      var pg = parseFloat(packG.value);
      var pn = parseFloat(packN.value);
      // Only auto-fill if user hasn't typed a manual total
      if (!qtyG.dataset.manual && !isNaN(pg) && !isNaN(pn) && pg > 0 && pn > 0) {
        qtyG.value = (pg * pn).toFixed(2);
      }
      recalcCost();
    }
    function recalcCost() {
      var qty = parseFloat(qtyG.value) || 0;
      var cost = parseFloat(costInp.value);
      cpg.value = (qty > 0 && !isNaN(cost) && cost >= 0) ? 'RM ' + (cost / qty).toFixed(4) + ' / g' : '—';
    }
    packG.addEventListener('input', recalcQty);
    packN.addEventListener('input', recalcQty);
    qtyG.addEventListener('input', function () { qtyG.dataset.manual = '1'; recalcCost(); });
    costInp.addEventListener('input', recalcCost);

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var d = HM.form.serialize(form);
      if (!d.medicine_id) {
        HM.form.showGeneralError(form, 'Pick a medicine from the dropdown');
        return;
      }
      d.medicine_id = parseInt(d.medicine_id, 10);
      ['pack_grams', 'pack_count', 'quantity_grams', 'total_cost'].forEach(function (k) {
        if (d[k] === '' || d[k] == null) delete d[k];
        else d[k] = parseFloat(d[k]);
      });
      d.update_unit_price = form.querySelector('[name="update_unit_price"]').checked ? 1 : 0;

      HM.form.setLoading(form, true);
      try {
        var res = await HM.api.admin.createMedicinePurchase(d);
        HM.ui.toast('Purchase logged · stock now ' + (parseFloat(res.new_stock_grams) || 0).toFixed(1) + ' g', 'success', 5000);
        m.close();
        loadPurchases();
        if (state.view === 'stock') loadStock();
      } catch (err) {
        HM.form.setLoading(form, false);
        if (err.data && err.data.errors) HM.form.showErrors(form, err.data.errors);
        else HM.form.showGeneralError(form, (err && err.message) || 'Failed');
      }
    });
  }

  function confirmPurchaseDelete(row) {
    HM.ui.confirm({
      title: 'Delete purchase?',
      message: 'This will reverse the stock increment for ' +
        (row.name_zh || 'this medicine') + ' by ' +
        (parseFloat(row.quantity_grams) || 0).toFixed(1) + ' g. Use only for data-entry mistakes.',
      confirmLabel: '🗑 Delete & reverse stock',
      cancelLabel: 'Cancel',
      onConfirm: async function () {
        try {
          await HM.api.admin.deleteMedicinePurchase(row.id);
          HM.ui.toast('Purchase deleted, stock reversed', 'success');
          loadPurchases();
          if (state.view === 'stock') loadStock();
        } catch (e) { HM.ui.toast(e.message || 'Failed', 'danger'); }
      },
    });
  }

  function debounce(fn, ms) { var t; return function () { var args = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, args); }, ms); }; }

  HM.adminPanels.medicineCatalog = { render: render };
})();
