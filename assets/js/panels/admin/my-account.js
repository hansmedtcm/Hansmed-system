/**
 * Admin → My Account — change password for the signed-in admin user.
 * Admin doesn't edit their own profile here (no profile fields exist
 * for admins in the schema), so this page is dedicated to security.
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  function render(el) {
    var user = HM.auth && HM.auth.user ? HM.auth.user() : {};
    var email = (user && user.email) || '—';

    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">My Account · 我的帳號</div>' +
      '<h1 class="page-title">Account Security</h1>' +
      '</div>' +

      '<div class="card card--pad-lg mb-6" style="max-width: 640px;">' +
      '<div class="text-label mb-2">Signed in as · 目前帳號</div>' +
      '<div class="card-title">' + HM.format.esc(email) + '</div>' +
      '<div class="text-xs text-muted mt-1">Role: Platform Administrator</div>' +
      '</div>' +

      '<div class="card card--pad-lg" style="max-width: 640px;">' +
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

    var form = document.getElementById('pw-form');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var d = HM.form.serialize(form);
      if (d.new_password !== d.new_password_confirmation) {
        HM.form.showGeneralError(form, 'Passwords do not match · 密碼不一致');
        return;
      }
      HM.form.setLoading(form, true);
      try {
        await HM.api.security.changePassword(d);
        HM.ui.toast('Password updated · 密碼已更改', 'success');
        form.reset();
        HM.form.setLoading(form, false);
      } catch (err) {
        HM.form.setLoading(form, false);
        HM.form.showGeneralError(form, err.message || 'Failed');
      }
    });
  }

  HM.adminPanels.myAccount = { render: render };
})();
