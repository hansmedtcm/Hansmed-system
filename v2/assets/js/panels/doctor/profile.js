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
        '<form id="dp-form" class="card card--pad-lg" style="max-width: 800px;">' +
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
        '</form>';

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

  HM.doctorPanels.profile = { render: render };
})();
