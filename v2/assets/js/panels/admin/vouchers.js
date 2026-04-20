/**
 * Admin → Vouchers / Discount Codes
 *
 * CRUD page for promo codes the admin shares with patients.
 * Each voucher = code + percentage discount + optional caps + scope.
 * Patient enters the code at payment; backend applies the discount.
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Vouchers · 優惠券</div>' +
      '<h1 class="page-title">Discount Codes</h1>' +
      '<p class="page-subtitle">Create promo codes patients enter at checkout for a percentage discount. ' +
      '<span style="font-family: var(--font-zh);">建立優惠碼，患者付款時輸入即可享折扣。</span></p>' +
      '</div>' +

      '<div class="flex-between mb-3">' +
      '<div id="v-summary" class="text-sm text-muted"></div>' +
      '<button class="btn btn--primary" id="v-add">+ New Voucher · 新增優惠券</button>' +
      '</div>' +

      '<div id="v-list"></div>';

    document.getElementById('v-add').addEventListener('click', function () { openEditModal(null); });
    await load();
  }

  async function load() {
    var container = document.getElementById('v-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.admin.listVouchers();
      var rows = res.data || [];
      var summary = document.getElementById('v-summary');
      summary.textContent = rows.length + ' voucher' + (rows.length === 1 ? '' : 's');

      if (! rows.length) {
        HM.state.empty(container, {
          icon: '🎟️',
          title: 'No vouchers yet · 尚無優惠券',
          text: 'Click "+ New Voucher" to create your first discount code.',
        });
        return;
      }

      container.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Code</th><th>Discount</th><th>Scope</th><th>Valid</th>' +
        '<th>Used / Cap</th><th>Status</th><th></th>' +
        '</tr></thead><tbody></tbody></table></div>';
      var tbody = container.querySelector('tbody');

      rows.forEach(function (v) {
        var validRange = (v.valid_from || '—') + ' → ' + (v.valid_until || '—');
        if (!v.valid_from && !v.valid_until) validRange = '<span class="text-muted">always</span>';
        var usage = v.redemption_count + ' / ' + (v.max_redemptions || '∞');
        var statusBadge = v.is_active
          ? '<span class="badge badge--success">Active</span>'
          : '<span class="badge">Inactive</span>';
        var scopeLabel = { all: 'All', appointment: 'Appointment', order: 'Order' }[v.applies_to] || v.applies_to;

        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td><strong style="font-family:var(--font-mono);font-size:13px;">' + HM.format.esc(v.code) + '</strong>' +
          (v.description ? '<div class="text-xs text-muted">' + HM.format.esc(v.description) + '</div>' : '') + '</td>' +
          '<td><strong style="color:var(--gold);">' + parseFloat(v.discount_pct) + '%</strong></td>' +
          '<td>' + scopeLabel + '</td>' +
          '<td class="text-xs">' + validRange + '</td>' +
          '<td>' + usage + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td style="text-align:right;">' +
          '<button class="btn btn--ghost btn--sm" data-edit>Edit</button> ' +
          '<button class="btn btn--ghost btn--sm" data-del style="color:var(--red-seal);">Delete</button>' +
          '</td>';
        tr.querySelector('[data-edit]').addEventListener('click', function () { openEditModal(v); });
        tr.querySelector('[data-del]').addEventListener('click', async function () {
          var ok = await HM.ui.confirm('Delete voucher ' + v.code + '? · 確認刪除？', { danger: true });
          if (! ok) return;
          try { await HM.api.admin.deleteVoucher(v.id); HM.ui.toast('Deleted · 已刪除', 'success'); load(); }
          catch (e) { HM.ui.toast(e.message || 'Failed', 'danger'); }
        });
        tbody.appendChild(tr);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  function openEditModal(v) {
    var isEdit = !!v;
    var d = v || {};
    var html =
      '<form id="v-form">' +
      '<div class="field"><label class="field-label" data-required>Code · 優惠碼</label>' +
      '<input name="code" class="field-input field-input--boxed" value="' + HM.format.esc(d.code || '') + '" ' +
      (isEdit ? 'disabled' : 'required') +
      ' style="font-family:var(--font-mono);text-transform:uppercase;" placeholder="e.g. NEWYEAR2026"></div>' +
      (isEdit ? '<div class="text-xs text-muted" style="margin-top:-8px;margin-bottom:8px;">Code is fixed once created.</div>' : '') +

      '<div class="field"><label class="field-label">Description · 說明</label>' +
      '<input name="description" class="field-input field-input--boxed" value="' + HM.format.esc(d.description || '') + '" placeholder="e.g. Chinese New Year 10% off"></div>' +

      '<div class="field-grid field-grid--2">' +
      '<div class="field"><label class="field-label" data-required>Discount % · 折扣百分比</label>' +
      '<input name="discount_pct" type="number" min="0.01" max="100" step="0.01" class="field-input field-input--boxed" value="' + (d.discount_pct || '10') + '" required></div>' +
      '<div class="field"><label class="field-label">Max Redemptions · 使用上限</label>' +
      '<input name="max_redemptions" type="number" min="1" class="field-input field-input--boxed" value="' + (d.max_redemptions || '') + '" placeholder="Leave blank = unlimited"></div>' +
      '</div>' +

      '<div class="field-grid field-grid--2">' +
      '<div class="field"><label class="field-label">Valid From · 起始日期</label>' +
      '<input name="valid_from" type="date" class="field-input field-input--boxed" value="' + (d.valid_from || '') + '"></div>' +
      '<div class="field"><label class="field-label">Valid Until · 結束日期</label>' +
      '<input name="valid_until" type="date" class="field-input field-input--boxed" value="' + (d.valid_until || '') + '"></div>' +
      '</div>' +

      '<div class="field"><label class="field-label">Applies To · 適用範圍</label>' +
      '<select name="applies_to" class="field-input field-input--boxed">' +
      ['all','appointment','order'].map(function (s) {
        var lbl = { all: 'All purchases · 全部', appointment: 'Appointments only · 僅問診', order: 'Medicine orders only · 僅購藥' }[s];
        return '<option value="' + s + '"' + ((d.applies_to || 'all') === s ? ' selected' : '') + '>' + lbl + '</option>';
      }).join('') +
      '</select></div>' +

      '<div class="field"><label class="check"><input type="checkbox" name="is_active" ' +
      ((d.is_active === undefined || d.is_active) ? 'checked' : '') +
      '> Active · 啟用</label></div>' +

      '<div data-general-error class="alert alert--danger" style="display:none;"></div>' +

      '<div class="flex gap-2 mt-4">' +
      '<button type="button" class="btn btn--ghost" id="v-cancel">Cancel</button>' +
      '<button type="submit" class="btn btn--primary btn--block">' + (isEdit ? 'Save Changes · 儲存' : 'Create Voucher · 新增') + '</button>' +
      '</div>' +
      '</form>';

    var m = HM.ui.modal({ size: 'md', title: isEdit ? 'Edit Voucher · 編輯' : 'New Voucher · 新增優惠券', content: html });
    m.element.querySelector('#v-cancel').addEventListener('click', function () { m.close(); });

    var form = m.element.querySelector('#v-form');
    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var data = HM.form.serialize(form);
      data.is_active = !!data.is_active;
      if (data.code) data.code = data.code.toUpperCase().trim();
      if (! data.max_redemptions) data.max_redemptions = null;
      if (! data.valid_from)      data.valid_from = null;
      if (! data.valid_until)     data.valid_until = null;
      HM.form.setLoading(form, true);
      try {
        if (isEdit) await HM.api.admin.updateVoucher(v.id, data);
        else        await HM.api.admin.createVoucher(data);
        HM.ui.toast(isEdit ? 'Voucher updated · 已更新' : 'Voucher created · 已新增', 'success');
        m.close();
        load();
      } catch (err) {
        HM.form.setLoading(form, false);
        HM.form.showGeneralError(form, err.message || 'Failed');
      }
    });
  }

  HM.adminPanels.vouchers = { render: render };
})();
