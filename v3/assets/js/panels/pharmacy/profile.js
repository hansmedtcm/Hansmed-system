/**
 * Pharmacy Profile
 */
(function () {
  'use strict';
  HM.pharmPanels = HM.pharmPanels || {};

  async function render(el) {
    HM.state.loading(el);
    try {
      var res = await HM.api.pharmacy.getProfile();
      var user = res.user || {};
      var pp = user.pharmacy_profile || {};

      el.innerHTML = '<div class="page-header">' +
        '<div class="page-header-label">Profile · 個人資料</div>' +
        '<h1 class="page-title">Pharmacy Profile</h1>' +
        '</div>' +
        '<form id="pp-form" class="card card--pad-lg" style="max-width: 800px;">' +
        '<div class="field-grid field-grid--2">' +
        input('name', 'Pharmacy Name · 藥房名稱', pp.name, true) +
        input('email', 'Email · 電郵', user.email, false, true) +
        input('license_no', 'License No · 執照號碼', pp.license_no) +
        input('phone', 'Phone · 電話', pp.phone) +
        input('city', 'City · 城市', pp.city) +
        input('state', 'State · 州', pp.state) +
        input('country', 'Country · 國家', pp.country) +
        input('postal_code', 'Postal Code · 郵遞區號', pp.postal_code) +
        '</div>' +
        '<div class="field"><label class="field-label">Address · 地址</label><input name="address_line" class="field-input" value="' + HM.format.esc(pp.address_line || '') + '"></div>' +
        '<div class="field"><label class="field-label">Business Hours · 營業時間</label><input name="business_hours" class="field-input" value="' + HM.format.esc(pp.business_hours || '') + '" placeholder="e.g. Mon-Sat 9am-9pm"></div>' +
        '<div class="field"><label class="field-label">Delivery Radius (km) · 配送範圍</label><input name="delivery_radius_km" type="number" step="0.1" class="field-input" value="' + (pp.delivery_radius_km || '') + '"></div>' +
        '<button type="submit" class="btn btn--primary">Save Changes · 儲存</button>' +
        '</form>' +

        // Change Password card — appended below the profile form.
        '<div class="card card--pad-lg mt-6" style="max-width: 800px;">' +
        '<h3 class="mb-3">🔒 Change Password · 更改密碼</h3>' +
        '<form id="pw-form">' +
        '<div class="field"><label class="field-label" data-required>Current Password · 目前密碼</label>' +
        '<input type="password" name="current_password" class="field-input" required></div>' +
        '<div class="field"><label class="field-label" data-required>New Password · 新密碼</label>' +
        '<input type="password" name="new_password" class="field-input" required minlength="8">' +
        '<div class="field-hint">Min 8 characters · at least 1 uppercase + 1 number · 至少8字元，含大寫字母及數字</div></div>' +
        '<div class="field"><label class="field-label" data-required>Confirm New Password · 確認新密碼</label>' +
        '<input type="password" name="new_password_confirmation" class="field-input" required></div>' +
        '<div data-general-error class="alert alert--danger" style="display:none;"></div>' +
        '<button type="submit" class="btn btn--primary">Update Password · 更新密碼</button>' +
        '</form></div>';

      var pwForm = document.getElementById('pw-form');
      if (pwForm) pwForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var d = HM.form.serialize(pwForm);
        if (d.new_password !== d.new_password_confirmation) {
          HM.form.showGeneralError(pwForm, 'Passwords do not match · 密碼不一致');
          return;
        }
        HM.form.setLoading(pwForm, true);
        try {
          await HM.api.security.changePassword(d);
          HM.ui.toast('Password updated · 密碼已更改', 'success');
          pwForm.reset();
          HM.form.setLoading(pwForm, false);
        } catch (err) {
          HM.form.setLoading(pwForm, false);
          HM.form.showGeneralError(pwForm, err.message || 'Failed');
        }
      });

      document.getElementById('pp-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        var data = HM.form.serialize(e.target);
        delete data.email;
        if (data.delivery_radius_km === '') data.delivery_radius_km = null;
        HM.form.setLoading(e.target, true);
        try {
          await HM.api.pharmacy.updateProfile(data);
          HM.ui.toast('Profile saved · 已儲存', 'success');
          HM.form.setLoading(e.target, false);
        } catch (err) {
          HM.form.setLoading(e.target, false);
          HM.ui.toast(err.message || 'Failed', 'danger');
        }
      });
    } catch (e) { HM.state.error(el, e); }
  }

  function input(name, label, value, required, disabled) {
    return '<div class="field"><label class="field-label"' + (required ? ' data-required' : '') + '>' + label + '</label>' +
      '<input name="' + name + '" class="field-input" value="' + HM.format.esc(value || '') + '"' +
      (disabled ? ' disabled' : '') + '></div>';
  }

  HM.pharmPanels.profile = { render: render };
})();
