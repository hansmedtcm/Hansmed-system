/**
 * Admin System Configuration — clinic info, fees, hours, etc.
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">System Settings · 系統設定</div>' +
      '<h1 class="page-title">Platform Configuration</h1>' +
      '</div>' +
      '<div id="cfg-body"></div>' +
      // Migrations always render so admins can use them even if getConfigs fails
      '<div id="cfg-migrations"></div>' +
      '<div id="cfg-catalog"></div>';

    renderMigrations();
    renderCatalogImport();

    var body = document.getElementById('cfg-body');
    HM.state.loading(body);
    try {
      var res = await HM.api.admin.getConfigs();
      var c = {};
      (res.data || []).forEach(function (row) {
        c[row.config_key] = row.config_value;
      });

      body.innerHTML = '<form id="cfg-form">' +

        '<div class="card mb-4">' +
        '<div class="card-title">Clinic Information · 診所資訊</div>' +
        '<div class="field-grid field-grid--2">' +
        field('clinic_name', 'Clinic Name · 診所名稱', c.clinic_name || 'HansMed TCM') +
        field('clinic_name_zh', 'Chinese Name · 中文名稱', c.clinic_name_zh || '漢方現代中醫') +
        field('clinic_email', 'Support Email · 客服電郵', c.clinic_email || 'support@hansmed.com', 'email') +
        field('clinic_phone', 'Support Phone · 客服電話', c.clinic_phone || '+60 3-1234 5678') +
        field('clinic_address', 'Address · 地址', c.clinic_address || '', 'text', true) +
        field('license_number', 'License Number · 執照號碼', c.license_number || '') +
        '</div>' +
        '</div>' +

        '<div class="card mb-4">' +
        '<div class="card-title">Platform Fees · 平台費用</div>' +
        '<div class="field-grid field-grid--2">' +
        field('doctor_fee_pct', 'Doctor Fee % · 醫師抽成', c.doctor_fee_pct || '15', 'number') +
        field('pharmacy_fee_pct', 'Pharmacy Fee % · 藥房抽成', c.pharmacy_fee_pct || '8', 'number') +
        field('tax_rate_pct', 'Tax Rate % (SST) · 稅率', c.tax_rate_pct || '6', 'number') +
        field('min_withdrawal', 'Min Withdrawal (RM)', c.min_withdrawal || '100', 'number') +
        '</div>' +
        '</div>' +

        '<div class="card mb-4">' +
        '<div class="card-title">Consultation · 問診設定</div>' +
        '<div class="field-grid field-grid--2">' +
        field('default_consult_fee', 'Default Fee (RM)', c.default_consult_fee || '120', 'number') +
        field('consult_duration_min', 'Duration (minutes)', c.consult_duration_min || '30', 'number') +
        field('booking_advance_days', 'Max Advance Booking (days)', c.booking_advance_days || '30', 'number') +
        field('cancel_hours', 'Cancellation Window (hours)', c.cancel_hours || '24', 'number') +
        '</div>' +
        '</div>' +

        '<div class="card mb-4">' +
        '<div class="card-title">Business Hours · 營業時間</div>' +
        '<div class="field-grid field-grid--2">' +
        field('hours_weekday', 'Weekdays', c.hours_weekday || '09:00 - 21:00') +
        field('hours_weekend', 'Weekends', c.hours_weekend || '10:00 - 18:00') +
        '</div>' +
        '</div>' +

        '<div class="card mb-4">' +
        '<div class="card-title">Payment Methods · 付款方式</div>' +
        '<div class="field"><div class="check-group">' +
        check('payment_card', 'Credit / Debit Card', c.payment_card !== '0') +
        check('payment_fpx', 'FPX (Online Banking)', c.payment_fpx !== '0') +
        check('payment_tng', "Touch 'n Go eWallet", c.payment_tng !== '0') +
        check('payment_grabpay', 'GrabPay', c.payment_grabpay !== '0') +
        check('payment_shopeepay', 'ShopeePay', c.payment_shopeepay !== '0') +
        '</div></div>' +
        '</div>' +

        '<div class="card mb-4">' +
        '<div class="card-title">Walk-in Treatments · 臨診治療項目</div>' +
        '<p class="text-xs text-muted mb-3">Preset treatments that appear as quick-add buttons in the consult panel. Use the form to add new ones, or edit the JSON directly for bulk changes. ' +
        '<span style="font-family: var(--font-zh);">臨診時可快速新增的治療項目清單。</span></p>' +

        // Friendly add form
        '<div class="text-label mb-2">Quick Add · 快速新增</div>' +
        '<div class="field-grid field-grid--4 mb-3" style="align-items: end;">' +
        '<div class="field"><label class="text-xs text-muted">Key (id)</label>' +
        '<input id="tt-add-key" class="field-input field-input--boxed" placeholder="e.g. bloodletting" style="padding:6px 10px;"></div>' +
        '<div class="field"><label class="text-xs text-muted">EN name</label>' +
        '<input id="tt-add-name" class="field-input field-input--boxed" placeholder="Bloodletting" style="padding:6px 10px;"></div>' +
        '<div class="field"><label class="text-xs text-muted">中文名稱</label>' +
        '<input id="tt-add-name-zh" class="field-input field-input--boxed" placeholder="放血" style="padding:6px 10px;"></div>' +
        '<div class="field"><label class="text-xs text-muted">Icon</label>' +
        '<input id="tt-add-icon" class="field-input field-input--boxed" value="💉" style="padding:6px 10px;text-align:center;"></div>' +
        '</div>' +
        '<div class="flex gap-2 mb-3" style="align-items: center;">' +
        '<label class="check-item"><input type="checkbox" id="tt-add-points"> Has points / sites (shows a points field for this treatment)</label>' +
        '<button type="button" class="btn btn--primary btn--sm" id="tt-add-btn" style="margin-left:auto;">+ Add to list</button>' +
        '</div>' +

        '<div class="text-label mb-2 mt-3">Raw JSON · 原始 JSON</div>' +
        '<textarea name="treatment_types" id="tt-json" class="field-input field-input--boxed" rows="10" style="font-family: var(--font-mono); font-size: var(--text-xs);" placeholder="[]">' + HM.format.esc(c.treatment_types || defaultTreatmentTypes()) + '</textarea>' +
        '<div class="text-xs text-muted mt-2">Each preset: <code>{ key, name, name_zh, icon, has_points }</code>. Doctors can still add one-off custom treatments per visit — those don\'t need to be in this list.</div>' +
        '</div>' +

        '<div class="card mb-4">' +
        '<div class="card-title">System · 系統</div>' +
        '<div class="field">' + check('maintenance_mode', 'Maintenance Mode (block logins except admin)', c.maintenance_mode === '1') + '</div>' +
        '<div class="field">' + check('allow_registration', 'Allow new patient registrations', c.allow_registration !== '0') + '</div>' +
        '<div class="field"><label class="field-label">Maintenance Message</label>' +
        '<textarea name="maintenance_message" class="field-input field-input--boxed" rows="2">' + HM.format.esc(c.maintenance_message || '') + '</textarea></div>' +
        '</div>' +

        '<div data-general-error class="alert alert--danger" style="display:none;"></div>' +
        '<button type="submit" class="btn btn--primary">Save All Settings</button>' +
        '</form>';

      // Wire the Walk-in Treatments quick-add form
      var ttAddBtn = document.getElementById('tt-add-btn');
      if (ttAddBtn) {
        ttAddBtn.addEventListener('click', function () {
          var key     = (document.getElementById('tt-add-key').value || '').trim();
          var name    = (document.getElementById('tt-add-name').value || '').trim();
          var name_zh = (document.getElementById('tt-add-name-zh').value || '').trim();
          var icon    = (document.getElementById('tt-add-icon').value || '').trim() || '💉';
          var hasPts  = document.getElementById('tt-add-points').checked;
          if (!key || !name) {
            HM.ui.toast('Please enter at least a key and EN name', 'warning');
            return;
          }
          var textarea = document.getElementById('tt-json');
          var current = [];
          try { current = JSON.parse(textarea.value || '[]'); }
          catch (_) { HM.ui.toast('Current JSON is invalid — fix it first', 'danger'); return; }
          if (!Array.isArray(current)) current = [];
          if (current.find(function (t) { return t.key === key; })) {
            HM.ui.toast('Key "' + key + '" already exists', 'warning');
            return;
          }
          current.push({ key: key, name: name, name_zh: name_zh, icon: icon, has_points: hasPts });
          textarea.value = JSON.stringify(current, null, 2);
          // Clear form
          document.getElementById('tt-add-key').value = '';
          document.getElementById('tt-add-name').value = '';
          document.getElementById('tt-add-name-zh').value = '';
          document.getElementById('tt-add-icon').value = '💉';
          document.getElementById('tt-add-points').checked = false;
          HM.ui.toast('Added — remember to Save All Settings below', 'success');
        });
      }

      var form = document.getElementById('cfg-form');
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var d = HM.form.serialize(form);
        // normalise checkbox-only keys (form.serialize omits unchecked)
        ['payment_card','payment_fpx','payment_tng','payment_grabpay','payment_shopeepay','maintenance_mode','allow_registration'].forEach(function (k) {
          if (!(k in d)) d[k] = '0';
          else d[k] = '1';
        });
        HM.form.setLoading(form, true);
        try {
          await HM.api.admin.setConfigs(d);
          HM.form.setLoading(form, false);
          HM.ui.toast('Settings saved · 設定已保存', 'success');
        } catch (err) {
          HM.form.setLoading(form, false);
          HM.form.showGeneralError(form, err.message || 'Failed');
        }
      });
    } catch (e) { HM.state.error(body, e); }
  }

  function renderMigrations() {
    var host = document.getElementById('cfg-migrations');
    if (!host) return;
    host.innerHTML = '<div class="card mt-6" style="border-left: 3px solid var(--gold);">' +
      '<div class="card-title">🗄️ Database Migrations · 資料庫升級</div>' +
      '<p class="text-sm text-muted mb-3">Run one-time database changes when the platform is upgraded. Each migration is safe to re-run.</p>' +
      '<div class="flex gap-2 flex-wrap">' +
      '<button class="btn btn--outline" data-migration="pool-booking">Run: Pool Booking Schema · 執行候診池升級</button>' +
      '<button class="btn btn--outline" data-migration="tongue-review">Run: Tongue Review Schema · 執行舌診審核升級</button>' +
      '<button class="btn btn--outline" data-migration="doctor-off-days">Run: Doctor Off-Days Schema · 執行醫師假期升級</button>' +
      '<button class="btn btn--outline" data-migration="rx-from-review">Run: Prescribe from AI Review · 執行審核開方升級</button>' +
      '<button class="btn btn--outline" data-migration="walk-in-support">Run: Walk-in Support · 執行臨診支援升級</button>' +
      '<button class="btn btn--outline" data-migration="medicine-catalog">Run: Medicine Catalog Schema · 執行藥材目錄升級</button>' +
      '<button class="btn btn--outline" data-migration="fix-tongue-image-urls">Run: Fix Legacy Tongue Image URLs · 修復舌診圖片連結</button>' +
      '</div>' +
      '<div id="migration-output" class="mt-3" style="display:none; padding: var(--s-3); background: var(--washi); border-radius: var(--r-md); font-family: var(--font-mono); font-size: var(--text-xs); white-space: pre-wrap;"></div>' +
      '</div>';

    host.querySelectorAll('[data-migration]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var key = btn.getAttribute('data-migration');
        var label = btn.textContent;
        var out = document.getElementById('migration-output');
        btn.disabled = true;
        btn.textContent = 'Running… · 執行中…';
        out.style.display = 'block';
        out.textContent = 'Connecting…';
        try {
          var res = await HM.api.post('/admin/migrate/' + key);
          var lines = ['[' + key + ']  ' + (res.success ? '✓ Success' : '⚠ Completed with warnings')];
          (res.log || []).forEach(function (l) { lines.push('  · ' + l); });
          (res.errors || []).forEach(function (e) { lines.push('  ✗ ' + e); });
          out.textContent = lines.join('\n');
          HM.ui.toast(res.success ? 'Migration successful' : 'Migration finished with warnings', res.success ? 'success' : 'warning');
        } catch (e) {
          out.textContent = '✗ ' + (e.message || 'Migration failed');
          HM.ui.toast('Migration failed: ' + (e.message || ''), 'danger');
        } finally {
          btn.disabled = false;
          btn.textContent = label;
        }
      });
    });
  }

  function renderCatalogImport() {
    var host = document.getElementById('cfg-catalog');
    if (!host) return;
    host.innerHTML = '<div class="card mt-6" style="border-left: 3px solid var(--sage);">' +
      '<div class="card-title">🌿 Medicine Catalog · 藥材目錄 <span class="chip chip--sage" style="margin-left:8px;">Timing Herbs Mar-2026</span></div>' +
      '<p class="text-sm text-muted mb-3">Import the Timing Herbs SDN. BHD. monthly price list. Once seeded, every doctor sees these medicines in their prescription autocomplete with current reference prices. Safe to re-run — existing entries are updated in place.</p>' +
      '<div class="flex gap-2 flex-wrap">' +
      '<button class="btn btn--primary" id="cat-import-btn">📥 Import Mar-2026 Price List · 匯入藥材價格表</button>' +
      '<button class="btn btn--outline" id="cat-list-btn">📋 View Catalog · 查看目錄</button>' +
      '</div>' +
      '<div id="cat-output" class="mt-3" style="display:none; padding: var(--s-3); background: var(--washi); border-radius: var(--r-md); font-family: var(--font-mono); font-size: var(--text-xs); white-space: pre-wrap;"></div>' +
      '<div id="cat-list" class="mt-4"></div>' +
      '</div>';

    document.getElementById('cat-import-btn').addEventListener('click', async function () {
      var btn = this;
      var out = document.getElementById('cat-output');
      btn.disabled = true;
      var originalText = btn.textContent;
      btn.textContent = 'Importing… · 匯入中…';
      out.style.display = 'block';
      out.textContent = 'Step 1/2: Creating table if needed…';
      try {
        var mig = await HM.api.admin.migrateMedicineCatalog();
        out.textContent = '[migrate]\n' + (mig.log || []).map(function (l) { return '  · ' + l; }).join('\n');
        out.textContent += '\n\nStep 2/2: Importing price list…';
        var res = await HM.api.admin.seedMedicineCatalog();
        out.textContent += '\n\n[seed]\n' +
          '  · Total rows:       ' + res.total_rows + '\n' +
          '  · Single herbs (单方): ' + res.singles_count + '\n' +
          '  · Compound formulas (复方): ' + res.formulas_count + '\n' +
          '  · Inserted:         ' + res.inserted + '\n' +
          '  · Updated:          ' + res.updated + '\n' +
          '  · Price month:      ' + res.month + '\n' +
          '\n✓ Import complete. Doctors will now see these medicines in their prescription autocomplete.';
        HM.ui.toast('Imported ' + res.total_rows + ' medicines', 'success');
      } catch (e) {
        out.textContent += '\n\n✗ Import failed: ' + (e.message || 'unknown error');
        HM.ui.toast('Import failed: ' + (e.message || ''), 'danger');
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });

    document.getElementById('cat-list-btn').addEventListener('click', async function () {
      var list = document.getElementById('cat-list');
      HM.state.loading(list);
      try {
        var res = await HM.api.admin.listMedicineCatalog('');
        var rows = res.data || [];
        if (!rows.length) {
          list.innerHTML = '<p class="text-sm text-muted">No catalog entries yet. Click "Import Mar-2026 Price List" to populate.</p>';
          return;
        }
        var singles = rows.filter(function (r) { return r.type === 'single'; });
        var compounds = rows.filter(function (r) { return r.type === 'compound'; });
        list.innerHTML =
          '<div class="flex gap-4 text-sm text-muted mb-2">' +
          '<div>📦 Total: <strong>' + rows.length + '</strong></div>' +
          '<div>🌿 单方 Single herbs: <strong>' + singles.length + '</strong></div>' +
          '<div>⚗️ 复方 Compound formulas: <strong>' + compounds.length + '</strong></div>' +
          '</div>' +
          '<div class="table-wrap" style="max-height: 400px; overflow-y: auto;">' +
          '<table class="table table--compact"><thead><tr>' +
          '<th>Code</th><th>中文</th><th>Pinyin</th><th>Type</th><th style="text-align:right;">Price (RM/100g)</th>' +
          '</tr></thead><tbody>' +
          rows.map(function (r) {
            var price = r.unit_price == null
              ? '<span class="text-muted">询价 · inquire</span>'
              : HM.format.money(r.unit_price);
            var typeBadge = r.type === 'compound'
              ? '<span class="chip chip--gold">复方 compound</span>'
              : '<span class="chip chip--sage">单方 single</span>';
            return '<tr>' +
              '<td style="font-family: var(--font-mono); color: var(--stone);">' + HM.format.esc(r.code) + '</td>' +
              '<td><strong>' + HM.format.esc(r.name_zh) + '</strong></td>' +
              '<td>' + HM.format.esc(r.name_pinyin) + '</td>' +
              '<td>' + typeBadge + '</td>' +
              '<td style="text-align:right;">' + price + '</td>' +
              '</tr>';
          }).join('') +
          '</tbody></table></div>';
      } catch (e) { HM.state.error(list, e); }
    });
  }

  function field(name, label, value, type, fullWidth) {
    return '<div class="field"' + (fullWidth ? ' style="grid-column: span 2;"' : '') + '>' +
      '<label class="field-label">' + label + '</label>' +
      '<input name="' + name + '" type="' + (type || 'text') + '" class="field-input field-input--boxed" value="' + HM.format.esc(value || '') + '"></div>';
  }

  function defaultTreatmentTypes() {
    return JSON.stringify([
      { key: 'acupuncture', icon: '📍', name: 'Acupuncture', name_zh: '針灸', has_points: true },
      { key: 'moxibustion', icon: '🔥', name: 'Moxibustion', name_zh: '艾灸', has_points: true },
      { key: 'cupping',     icon: '🫙', name: 'Cupping',     name_zh: '拔罐', has_points: true },
      { key: 'tuina',       icon: '👐', name: 'Tuina',       name_zh: '推拿', has_points: false },
      { key: 'guasha',      icon: '🪮', name: 'Gua Sha',     name_zh: '刮痧', has_points: false },
      { key: 'ear_seeds',   icon: '🌰', name: 'Ear Seeds',   name_zh: '耳針', has_points: true },
    ], null, 2);
  }

  function check(name, label, checked) {
    return '<label class="check-item"><input type="checkbox" name="' + name + '" value="1"' + (checked ? ' checked' : '') + '> ' + label + '</label>';
  }

  HM.adminPanels.config = { render: render };
})();
