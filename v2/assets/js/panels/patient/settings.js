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

      // PDPA §30 — right to receive a copy of your own data.
      '<div class="card card--pad-lg mb-6" style="max-width: 600px;">' +
      '<h3 class="mb-2">📥 Download My Data · 下載我的資料</h3>' +
      '<p class="text-muted text-sm mb-4">Get a copy of everything we hold about you — profile, appointments, prescriptions, orders, tongue scans, constitution reports, addresses, and chat history. Downloads as a JSON file you can save, share, or review.' +
      '<br><span style="font-family: var(--font-zh);">下載所有關於您的個人資料（PDPA §30），包括個人檔案、預約記錄、處方、訂單、舌診、體質報告、地址與對話。將以 JSON 檔下載。</span></p>' +
      '<button type="button" class="btn btn--outline" id="data-export-btn">📥 Download My Data · 下載</button>' +
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

      // Legal notices — link to CMS pages.
      '<div class="card card--pad-lg mb-6" style="max-width: 600px;">' +
      '<h3 class="mb-3">📋 Legal · 法律資訊</h3>' +
      '<div class="flex flex-gap-2 flex-wrap">' +
      '<button class="btn btn--outline btn--sm" id="legal-privacy">Privacy Notice · 私隱條款</button>' +
      '<button class="btn btn--outline btn--sm" id="legal-retention">Data Retention · 資料保存期限</button>' +
      '</div>' +
      '<p class="text-xs text-muted mt-2">How we collect, store, and protect your data under PDPA 2010. ' +
      '<span style="font-family: var(--font-zh);">依 2010 年個人資料保護法令說明資料收集、儲存與保護方式。</span></p>' +
      '</div>' +

      '<div class="card card--pad-lg" style="max-width: 600px; border-color: var(--red-seal);">' +
      '<h3 class="mb-2" style="color: var(--red-seal);">Danger Zone · 危險區域</h3>' +
      '<p class="text-muted text-sm mb-4">Deleting your account is permanent. All your data will be removed.<br><span style="font-family: var(--font-zh);">刪除帳號為永久操作，所有資料將被移除。</span></p>' +
      '<button class="btn btn--danger" id="delete-btn">Delete Account · 刪除帳號</button>' +
      '</div>';

    // Lang switcher — wire via HM.langSwitch so the body class +
    // DOM wrapping updates immediately (not just via localStorage).
    // Also reflects the nav pill selection on the next render.
    var currentLang = (HM.langSwitch && HM.langSwitch.get)
      ? HM.langSwitch.get()
      : (HM.i18n ? HM.i18n.currentLang() : 'en');
    document.querySelectorAll('.lang-btn').forEach(function (b) {
      if (b.getAttribute('data-lang') === currentLang) b.classList.add('is-active');
      b.addEventListener('click', function () {
        document.querySelectorAll('.lang-btn').forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        var lang = b.getAttribute('data-lang');
        if (HM.langSwitch && HM.langSwitch.set) HM.langSwitch.set(lang);
        else if (HM.i18n && HM.i18n.setLang) HM.i18n.setLang(lang);
        HM.ui.toast(lang === 'zh' ? '語言已更改為中文' : 'Language changed to English', 'success');
      });
    });

    // Legal page viewers — fetch from public CMS endpoint and render
    // in a modal. Both /privacy and /retention must be seeded by
    // admin first (Admin → Content → Seed Compliance Pages).
    async function showLegalPage(slug, fallbackTitle) {
      var m = HM.ui.modal({
        size: 'lg',
        title: fallbackTitle,
        content: '<div class="state state--loading"><div class="state-icon"></div></div>',
      });
      try {
        var res = await HM.api.pages.show(slug);
        var p = res.page || res;
        m.body.innerHTML = '<div style="max-height: 70vh; overflow-y: auto;">' + (p.body_html || '<p class="text-muted">No content yet.</p>') + '</div>';
      } catch (err) {
        m.body.innerHTML = '<p class="text-muted">This page hasn\'t been published yet. Ask the admin to seed compliance pages in <em>Admin → Content</em>.</p>';
      }
    }
    document.getElementById('legal-privacy').addEventListener('click', function () {
      showLegalPage('privacy', 'Privacy Notice · 私隱條款');
    });
    document.getElementById('legal-retention').addEventListener('click', function () {
      showLegalPage('retention', 'Data Retention · 資料保存期限');
    });

    // Data export — uses authedFile helper to attach the Bearer token
    // on the download request. Browser-native download via blob URL.
    document.getElementById('data-export-btn').addEventListener('click', async function () {
      var btn = this;
      btn.disabled = true;
      btn.textContent = 'Preparing… · 準備中';
      try {
        var slug = (HM.auth.user && HM.auth.user().email || 'patient').split('@')[0];
        var filename = 'hansmed-export-' + slug + '-' + new Date().toISOString().slice(0, 10) + '.json';
        await HM.api.openAuthedFile('/patient/data-export', filename);
        HM.ui.toast('Data export ready · 資料已下載', 'success');
      } catch (err) {
        HM.ui.toast(err.message || 'Export failed', 'danger');
      } finally {
        btn.disabled = false;
        btn.textContent = '📥 Download My Data · 下載';
      }
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
