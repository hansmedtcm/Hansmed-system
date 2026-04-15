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
      '</div><div id="cfg-body"></div>';

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
        '<div class="card-title">System · 系統</div>' +
        '<div class="field">' + check('maintenance_mode', 'Maintenance Mode (block logins except admin)', c.maintenance_mode === '1') + '</div>' +
        '<div class="field">' + check('allow_registration', 'Allow new patient registrations', c.allow_registration !== '0') + '</div>' +
        '<div class="field"><label class="field-label">Maintenance Message</label>' +
        '<textarea name="maintenance_message" class="field-input field-input--boxed" rows="2">' + HM.format.esc(c.maintenance_message || '') + '</textarea></div>' +
        '</div>' +

        '<div data-general-error class="alert alert--danger" style="display:none;"></div>' +
        '<button type="submit" class="btn btn--primary">Save All Settings</button>' +
        '</form>' +

        '<div class="card mt-6" style="border-left: 3px solid var(--gold);">' +
        '<div class="card-title">🗄️ Database Migrations · 資料庫升級</div>' +
        '<p class="text-sm text-muted mb-3">Run one-time database changes when the platform is upgraded. Each migration is safe to re-run.</p>' +
        '<div class="flex gap-2 flex-wrap">' +
        '<button class="btn btn--outline" data-migration="pool-booking">Run: Pool Booking Schema · 執行候診池升級</button>' +
        '<button class="btn btn--outline" data-migration="tongue-review">Run: Tongue Review Schema · 執行舌診審核升級</button>' +
        '</div>' +
        '<div id="migration-output" class="mt-3" style="display:none; padding: var(--s-3); background: var(--washi); border-radius: var(--r-md); font-family: var(--font-mono); font-size: var(--text-xs); white-space: pre-wrap;"></div>' +
        '</div>';

      // Migration handler (one handler for all migration buttons)
      document.querySelectorAll('[data-migration]').forEach(function (btn) {
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

  function field(name, label, value, type, fullWidth) {
    return '<div class="field"' + (fullWidth ? ' style="grid-column: span 2;"' : '') + '>' +
      '<label class="field-label">' + label + '</label>' +
      '<input name="' + name + '" type="' + (type || 'text') + '" class="field-input field-input--boxed" value="' + HM.format.esc(value || '') + '"></div>';
  }

  function check(name, label, checked) {
    return '<label class="check-item"><input type="checkbox" name="' + name + '" value="1"' + (checked ? ' checked' : '') + '> ' + label + '</label>';
  }

  HM.adminPanels.config = { render: render };
})();
