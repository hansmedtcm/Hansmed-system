/**
 * Settings — language, change password, delete account
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Settings · 設定</div>' +
      '<h1 class="page-title">Account Settings</h1>' +
      '</div>' +

      '<div class="card card--pad-lg mb-6" style="max-width: 600px;">' +
      '<h3 class="mb-3">Language · 語言</h3>' +
      '<div class="lang-switcher" style="width: fit-content;">' +
      '<button class="lang-btn" data-lang="en">English</button>' +
      '<button class="lang-btn" data-lang="zh">中文</button>' +
      '</div>' +
      '</div>' +

      '<div class="card card--pad-lg mb-6" style="max-width: 600px;">' +
      '<h3 class="mb-3">Change Password · 更改密碼</h3>' +
      '<form id="pw-form">' +
      '<div class="field"><label class="field-label" data-required>Current Password · 目前密碼</label><input type="password" name="current_password" class="field-input" required><div class="field-error"></div></div>' +
      '<div class="field"><label class="field-label" data-required>New Password · 新密碼</label><input type="password" name="new_password" class="field-input" required minlength="8"><div class="field-hint">Min 8 characters · 至少8字元</div><div class="field-error"></div></div>' +
      '<div class="field"><label class="field-label" data-required>Confirm · 確認</label><input type="password" name="new_password_confirmation" class="field-input" required><div class="field-error"></div></div>' +
      '<div data-general-error class="alert alert--danger" style="display:none;"></div>' +
      '<button type="submit" class="btn btn--primary">Update Password · 更新</button>' +
      '</form></div>' +

      '<div class="card card--pad-lg" style="max-width: 600px; border-color: var(--red-seal);">' +
      '<h3 class="mb-2" style="color: var(--red-seal);">Danger Zone · 危險區域</h3>' +
      '<p class="text-muted text-sm mb-4">Deleting your account is permanent. All your data will be removed.<br><span style="font-family: var(--font-zh);">刪除帳號為永久操作，所有資料將被移除。</span></p>' +
      '<button class="btn btn--danger" id="delete-btn">Delete Account · 刪除帳號</button>' +
      '</div>';

    // Lang switcher
    var currentLang = HM.i18n.currentLang();
    document.querySelectorAll('.lang-btn').forEach(function (b) {
      if (b.getAttribute('data-lang') === currentLang) b.classList.add('is-active');
      b.addEventListener('click', function () {
        document.querySelectorAll('.lang-btn').forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        HM.i18n.setLang(b.getAttribute('data-lang'));
        HM.ui.toast('Language changed · 語言已更改', 'success');
      });
    });

    // Password form
    document.getElementById('pw-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var formEl = e.target;
      var d = HM.form.serialize(formEl);
      if (d.new_password !== d.new_password_confirmation) {
        HM.form.showGeneralError(formEl, 'Passwords do not match');
        return;
      }
      HM.form.setLoading(formEl, true);
      try {
        await HM.api.security.changePassword(d);
        HM.ui.toast('Password updated · 密碼已更改', 'success');
        formEl.reset();
        HM.form.setLoading(formEl, false);
      } catch (err) {
        HM.form.setLoading(formEl, false);
        HM.form.showGeneralError(formEl, err.message || 'Failed');
      }
    });

    // Delete account
    document.getElementById('delete-btn').addEventListener('click', async function () {
      var ok = await HM.ui.confirm(
        'Are you absolutely sure? This action cannot be undone. All your records will be removed.',
        { title: 'Delete Account', danger: true, confirmText: 'Yes, delete my account' }
      );
      if (!ok) return;
      var pw = await HM.ui.prompt('Enter your password to confirm:', {
        title: 'Confirm Deletion',
        type: 'password',
        required: true,
      });
      if (!pw) return;
      try {
        await HM.api.security.deleteAccount({ password: pw, confirm: 'DELETE' });
        HM.ui.toast('Account deleted', 'success');
        await HM.api.authLogout();
        setTimeout(function () { location.href = 'index.html'; }, 1500);
      } catch (err) { HM.ui.toast(err.message || 'Failed', 'danger'); }
    });
  }

  HM.patientPanels.settings = { render: render };
})();
