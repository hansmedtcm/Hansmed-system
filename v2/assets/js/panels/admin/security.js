/**
 * Admin → Security
 *
 * Emergency platform-wide security actions. Flagship action:
 *   "Revoke All Sessions" — nukes every row in personal_access_tokens,
 *   forcing all users (including this admin, unless preserved) to
 *   sign in again.
 *
 * Built 2026-05-14 (Day 1) for the .claude/settings.local.json
 * leaked-token cleanup. Permanent infrastructure — same path used
 * for future incidents.
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Security · 安全</div>' +
      '<h1 class="page-title">Security Actions</h1>' +
      '</div>' +

      '<div class="card card--pad-lg mb-6" style="max-width: 720px;">' +
      '<h3 class="mb-2">🛡️ Revoke All Sessions · 撤銷所有登入</h3>' +
      '<p class="text-muted mb-4">' +
        'Deletes every Sanctum personal access token. Use when a token ' +
        'has leaked, a device is lost, or every active user must be ' +
        'force-logged-out at once. Logged-out users will need to sign ' +
        'in again. There is no undo.' +
      '</p>' +

      '<div class="alert alert--warning mb-4">' +
        '<strong>⚠️ This is irreversible.</strong> Every signed-in user ' +
        'will receive a 401 on their next API call and be sent to the ' +
        'login screen. Use deliberately.' +
      '</div>' +

      '<form id="revoke-form" autocomplete="off">' +
        '<div class="field">' +
          '<label class="field-label" data-required>' +
            'Type <code>REVOKE-ALL</code> to confirm · 輸入 <code>REVOKE-ALL</code> 以確認' +
          '</label>' +
          '<input type="text" name="confirm" class="field-input" required ' +
            'autocomplete="off" placeholder="REVOKE-ALL">' +
        '</div>' +

        '<div class="field">' +
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;">' +
            '<input type="checkbox" name="exclude_self" checked> ' +
            '<span>Preserve my current session (recommended)</span>' +
          '</label>' +
          '<div class="field-hint">' +
            'Unchecked: you will also be logged out immediately and ' +
            'redirected to the sign-in page.' +
          '</div>' +
        '</div>' +

        '<div data-general-error class="alert alert--danger" style="display:none;"></div>' +
        '<div data-success class="alert alert--success" style="display:none;"></div>' +

        '<button type="submit" class="btn" ' +
          'style="background:#9a3a2a;color:#fff;border-color:#7a2a1f;">' +
          'Revoke All Sessions · 撤銷所有登入' +
        '</button>' +
      '</form>' +
      '</div>';

    var form = document.getElementById('revoke-form');
    var successBox = form.querySelector('[data-success]');

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      successBox.style.display = 'none';

      var raw = HM.form.serialize(form);
      var payload = {
        confirm: (raw.confirm || '').trim(),
        exclude_self: !!form.querySelector('[name=exclude_self]').checked,
      };

      if (payload.confirm !== 'REVOKE-ALL') {
        HM.form.showGeneralError(form, 'Confirmation must be exactly REVOKE-ALL · 確認文字必須為 REVOKE-ALL');
        return;
      }

      var ok = window.confirm(
        'Final confirmation: revoke EVERY active session now?\n\n' +
        '最終確認：撤銷每個正在進行的登入嗎？'
      );
      if (! ok) return;

      HM.form.setLoading(form, true);
      try {
        var res = await HM.api.admin.revokeAllTokens(payload);
        successBox.style.display = 'block';
        successBox.textContent =
          (res.message || 'Done.') +
          '  (Revoked ' + (res.revoked || 0) + ' of ' + (res.total_before || 0) + ' tokens.)';
        form.reset();
        // If we didn't preserve our own session, the backend deleted the
        // calling token too — log out cleanly + bounce to sign-in.
        if (! res.kept_self_token) {
          setTimeout(function () {
            HM.auth.logout().then(function () { location.href = 'index.html'; });
          }, 2500);
        }
      } catch (err) {
        HM.form.showGeneralError(form, err.message || 'Failed to revoke sessions.');
      } finally {
        HM.form.setLoading(form, false);
      }
    });
  }

  HM.adminPanels.security = { render: render };
})();
