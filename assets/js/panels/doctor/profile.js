/**
 * Doctor Profile — edit own info
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  async function render(el) {
    HM.state.loading(el);
    try {
      var res = await HM.api.doctor.getProfile();
      var user = res.user || {};
      var dp = user.doctor_profile || {};

      el.innerHTML = '<div class="page-header">' +
        '<div class="page-header-label">My Profile · 個人資料</div>' +
        '<h1 class="page-title">Manage Your Profile</h1>' +
        '</div>' +
        '<form id="dp-form" class="card card--pad-lg mb-6" style="max-width: 800px;">' +
        '<div class="field-grid field-grid--2">' +
        field('full_name', 'Full Name · 姓名', dp.full_name, true) +
        field('email', 'Email · 電郵', user.email, false, true) +
        field('license_no', 'License No · 執照號碼', dp.license_no) +
        field('consultation_fee', 'Consultation Fee (RM) · 診費', dp.consultation_fee, false, false, 'number') +
        '</div>' +
        '<div class="field"><label class="field-label">Specialties · 專長</label><input name="specialties" class="field-input" value="' + HM.format.esc(dp.specialties || '') + '" placeholder="e.g. General TCM, Gynecology, Pain Management"></div>' +
        '<div class="field"><label class="field-label">Bio · 簡介</label><textarea name="bio" class="field-input" rows="5">' + HM.format.esc(dp.bio || '') + '</textarea></div>' +
        '<div class="field"><label class="check"><input type="checkbox" name="accepting_appointments" ' + (dp.accepting_appointments ? 'checked' : '') + '> Accepting new appointments · 接受新預約</label></div>' +
        '<button type="submit" class="btn btn--primary">Save Changes · 儲存</button>' +
        '</form>' +

        // ── Change Password card — same UX pattern as patient settings.
        // Backend endpoint validates current password + enforces strength.
        passwordCard();

      wirePasswordCard();

      document.getElementById('dp-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        var data = HM.form.serialize(e.target);
        data.accepting_appointments = !!data.accepting_appointments;
        delete data.email;
        HM.form.setLoading(e.target, true);
        try {
          await HM.api.doctor.updateProfile(data);
          HM.ui.toast('Profile saved · 已儲存', 'success');
          HM.form.setLoading(e.target, false);
        } catch (err) {
          HM.form.setLoading(e.target, false);
          HM.ui.toast(err.message || 'Failed', 'danger');
        }
      });
    } catch (e) { HM.state.error(el, e); }
  }

  function field(name, label, value, required, disabled, type) {
    return '<div class="field"><label class="field-label"' + (required ? ' data-required' : '') + '>' + label + '</label>' +
      '<input name="' + name + '" type="' + (type || 'text') + '" class="field-input" value="' + HM.format.esc(value || '') + '"' +
      (disabled ? ' disabled' : '') + (required ? ' required' : '') + '></div>';
  }

  // Standalone Change Password card — appended to the profile page so
  // the doctor can rotate their password without leaving the portal.
  // Hits the same /auth/change-password endpoint that patient settings
  // uses; backend validates current password + enforces strength.
  function passwordCard() {
    return '<div class="card card--pad-lg" style="max-width: 800px;">' +
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
  }

  function wirePasswordCard() {
    var form = document.getElementById('pw-form');
    if (! form) return;
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

  HM.doctorPanels.profile = { render: render };
})();
