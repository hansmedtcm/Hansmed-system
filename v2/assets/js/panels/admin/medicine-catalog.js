/**
 * Admin Medicine Catalog — full list + search + edit + delete.
 *
 * Previously the only way to view imported medicines was via the System
 * Settings "View Catalog" button, which lacked editing. This panel is
 * a first-class admin tab with:
 *   - live search by Chinese name / pinyin / code
 *   - filter by type (single 单方 / compound 复方)
 *   - show/hide inactive (soft-deleted) rows
 *   - inline "Edit" modal for each row
 *   - "Delete" (soft / hard) per row
 *   - "+ Add Medicine" for manual additions
 *   - Re-import Timing Herbs Mar-2026 price list
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  var state = { q: '', type: '', activeOnly: true };

  async function render(el) {
    el.innerHTML =
      '<div class="page-header flex-between" style="align-items:center;flex-wrap:wrap;gap:var(--s-2);">' +
        '<div><div class="page-header-label">Medicine Catalog · 藥材目錄</div>' +
        '<h1 class="page-title">Master Medicine List</h1>' +
        '<p class="text-muted text-sm mt-1">Timing Herbs Mar-2026 price list. Used for doctor prescription autocomplete. ' +
        '<span style="font-family: var(--font-zh);">中藥材主目錄，用於醫師開方。</span></p></div>' +
        '<div class="flex gap-2 flex-wrap">' +
          '<button class="btn btn--outline" id="mc-reimport">📥 Re-import Mar-2026</button>' +
          '<button class="btn btn--primary" id="mc-add">+ Add Medicine · 新增</button>' +
        '</div>' +
      '</div>' +

      '<div class="card mb-4" style="padding: var(--s-3);">' +
        '<div class="flex gap-3 flex-wrap" style="align-items:center;">' +
          '<input type="text" id="mc-search" class="field-input field-input--boxed" placeholder="🔍 Search Chinese name, Pinyin, or code…" style="flex:1;min-width:260px;">' +
          '<select id="mc-type" class="field-input field-input--boxed" style="min-width:160px;">' +
            '<option value="">All types</option>' +
            '<option value="single">单方 Single herbs</option>' +
            '<option value="compound">复方 Compound formulas</option>' +
          '</select>' +
          '<label class="flex gap-1" style="align-items:center;font-size:var(--text-sm);color:var(--stone);">' +
            '<input type="checkbox" id="mc-active" checked>' +
            'Active only · 僅顯示有效' +
          '</label>' +
        '</div>' +
      '</div>' +

      '<div id="mc-summary" class="text-sm text-muted mb-2"></div>' +
      '<div id="mc-list"></div>';

    document.getElementById('mc-search').addEventListener('input', debounce(function (e) {
      state.q = e.target.value; load();
    }, 250));
    document.getElementById('mc-type').addEventListener('change', function (e) {
      state.type = e.target.value; load();
    });
    document.getElementById('mc-active').addEventListener('change', function (e) {
      state.activeOnly = e.target.checked; load();
    });
    document.getElementById('mc-add').addEventListener('click', function () { showEditModal(null); });
    document.getElementById('mc-reimport').addEventListener('click', reimport);

    await load();
  }

  async function load() {
    var host = document.getElementById('mc-list');
    var summaryEl = document.getElementById('mc-summary');
    HM.state.loading(host);
    try {
      var qs = [];
      if (state.q)    qs.push('q=' + encodeURIComponent(state.q));
      if (state.type) qs.push('type=' + state.type);
      if (state.activeOnly) qs.push('active_only=1');
      var res = await HM.api.admin.listMedicineCatalog(qs.join('&'));
      var rows = res.data || [];

      if (!rows.length) {
        if (state.q || state.type) {
          HM.state.empty(host, { icon: '🔍', title: 'No matches', text: 'Try a different search' });
        } else {
          HM.state.empty(host, {
            icon: '🌿',
            title: 'No medicines yet',
            text: 'Click "Re-import Mar-2026" to load the Timing Herbs price list, or "+ Add Medicine" to create one manually.',
          });
        }
        summaryEl.textContent = '';
        return;
      }

      var singleN = rows.filter(function (r) { return r.type === 'single'; }).length;
      var compoundN = rows.filter(function (r) { return r.type === 'compound'; }).length;
      summaryEl.innerHTML =
        '📦 <strong>' + rows.length + '</strong> total · ' +
        '🌿 <strong>' + singleN + '</strong> single herbs (单方) · ' +
        '⚗️ <strong>' + compoundN + '</strong> compound formulas (复方)';

      host.innerHTML = '<div class="table-wrap"><table class="table">' +
        '<thead><tr>' +
          '<th>Code</th><th>中文</th><th>Pinyin</th><th>Type</th>' +
          '<th style="text-align:right;">Price (RM/100g)</th>' +
          '<th>Status</th><th></th>' +
        '</tr></thead><tbody></tbody></table></div>';
      var tbody = host.querySelector('tbody');

      rows.forEach(function (r) {
        var priceCell = r.unit_price == null
          ? '<span class="text-muted">询价 inquire</span>'
          : HM.format.money(r.unit_price);
        var typeBadge = r.type === 'compound'
          ? '<span class="chip chip--gold">复方</span>'
          : '<span class="chip chip--sage">单方</span>';
        var statusBadge = r.is_active
          ? '<span class="badge badge--success">Active</span>'
          : '<span class="badge">Inactive</span>';

        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td style="font-family: var(--font-mono); color: var(--stone);">' + HM.format.esc(r.code) + '</td>' +
          '<td><strong>' + HM.format.esc(r.name_zh) + '</strong></td>' +
          '<td>' + HM.format.esc(r.name_pinyin) + '</td>' +
          '<td>' + typeBadge + '</td>' +
          '<td style="text-align:right;">' + priceCell + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td style="white-space:nowrap;">' +
            '<button class="btn btn--ghost btn--sm" data-act="edit">✎ Edit</button> ' +
            '<button class="btn btn--ghost btn--sm" data-act="del" style="color:var(--red-seal);">🗑 Delete</button>' +
          '</td>';
        tr.querySelector('[data-act="edit"]').addEventListener('click', function () { showEditModal(r); });
        tr.querySelector('[data-act="del"]').addEventListener('click', function () { confirmDelete(r); });
        tbody.appendChild(tr);
      });
    } catch (e) { HM.state.error(host, e); }
  }

  function showEditModal(row) {
    var isNew = !row;
    row = row || { code: '', name_zh: '', name_pinyin: '', type: 'single', unit_price: '', unit: 'per 100g', notes: '', is_active: 1 };

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
          '<div class="field"><label class="field-label" data-required>中文 · Chinese</label>' +
          '<input name="name_zh" class="field-input field-input--boxed" required value="' + HM.format.esc(row.name_zh || '') + '"></div>' +
          '<div class="field"><label class="field-label" data-required>Pinyin · 拼音</label>' +
          '<input name="name_pinyin" class="field-input field-input--boxed" required value="' + HM.format.esc(row.name_pinyin || '') + '"></div>' +
          '<div class="field"><label class="field-label">Price (RM / 100g)</label>' +
          '<input name="unit_price" type="number" step="0.01" class="field-input field-input--boxed" value="' + HM.format.esc(row.unit_price != null ? row.unit_price : '') + '" placeholder="Leave blank for 询价"></div>' +
          '<div class="field"><label class="field-label">Unit · 單位</label>' +
          '<input name="unit" class="field-input field-input--boxed" value="' + HM.format.esc(row.unit || 'per 100g') + '"></div>' +
          '<div class="field" style="grid-column: span 2;"><label class="field-label">Notes · 備註</label>' +
          '<textarea name="notes" class="field-input field-input--boxed" rows="2">' + HM.format.esc(row.notes || '') + '</textarea></div>' +
          '<div class="field" style="grid-column: span 2;"><label class="flex gap-2" style="align-items:center;">' +
          '<input type="checkbox" name="is_active" ' + (row.is_active ? 'checked' : '') + '> Active · 有效 (show to doctors in prescription autocomplete)</label></div>' +
        '</div>' +
        '<div data-general-error class="alert alert--danger mt-3" style="display:none;"></div>' +
        '<div class="flex gap-2 mt-4">' +
        '<button type="submit" class="btn btn--primary" style="margin-left:auto;">' + (isNew ? 'Create' : 'Save') + '</button>' +
        '</div>' +
        '</form>',
    });

    var form = m.element.querySelector('#mc-form');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var d = HM.form.serialize(form);
      // Normalise: empty price → null; checkbox → 1/0
      if (d.unit_price === '' || d.unit_price === undefined) d.unit_price = null;
      else d.unit_price = parseFloat(d.unit_price);
      d.is_active = form.querySelector('[name="is_active"]').checked ? 1 : 0;

      HM.form.setLoading(form, true);
      try {
        if (isNew) {
          await HM.api.admin.createMedicine(d);
          HM.ui.toast('Medicine added', 'success');
        } else {
          await HM.api.admin.updateMedicine(row.id, d);
          HM.ui.toast('Medicine updated', 'success');
        }
        m.close();
        load();
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
      message:
        'Soft-delete hides this medicine from prescription autocomplete but keeps historical records intact. ' +
        'You can "Active only" → uncheck to find and restore it later. ' +
        '<span style="font-family: var(--font-zh);">軟刪除：隱藏於開方，但歷史紀錄保留。</span>',
      confirmLabel: '🗑 Soft-delete · 停用',
      cancelLabel: 'Cancel',
      onConfirm: async function () {
        try {
          await HM.api.admin.deleteMedicine(row.id);
          HM.ui.toast('Medicine deactivated', 'success');
          load();
        } catch (e) { HM.ui.toast(e.message || 'Failed', 'danger'); }
      },
    });
  }

  async function reimport() {
    var btn = document.getElementById('mc-reimport');
    var orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Importing…';
    try {
      await HM.api.admin.migrateMedicineCatalog();
      var res = await HM.api.admin.seedMedicineCatalog();
      HM.ui.toast('Imported ' + res.total_rows + ' rows (' + res.inserted + ' new, ' + res.updated + ' updated)', 'success', 5000);
      load();
    } catch (e) {
      HM.ui.toast('Import failed: ' + (e.message || ''), 'danger');
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  function debounce(fn, ms) { var t; return function () { var args = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, args); }, ms); }; }

  HM.adminPanels.medicineCatalog = { render: render };
})();
