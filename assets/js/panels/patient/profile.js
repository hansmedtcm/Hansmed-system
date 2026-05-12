/**
 * Patient Profile — read-only after registration, admin can edit
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  async function render(el) {
    HM.state.loading(el);
    try {
      var res = await HM.api.patient.getProfile();
      var user = res.user || res;
      var p = user.patient_profile || {};
      var locked = p.registration_completed;

      el.innerHTML = '' +
        '<div class="page-header">' +
        '  <div class="page-header-label">Personal Profile · 個人資料</div>' +
        '  <h1 class="page-title">Your Information</h1>' +
        '</div>' +

        (locked ? lockedBanner() : '') +

        '<div class="card card--pad-lg" style="max-width: 900px;">' +
        section('Personal Information · 個人資料', [
          row('Full Name · 姓名', p.full_name),
          row('IC / ID Number · 身份證', p.ic_number),
          row('Email · 電郵', user.email),
          row('Phone · 電話', HM.format.phone(p.phone)),
          row('Date of Birth · 出生日期', HM.format.date(p.birth_date) + (p.birth_date ? ' (' + HM.format.age(p.birth_date) + ' years)' : '')),
          row('Gender · 性別', p.gender),
          row('Occupation · 職業', p.occupation),
        ]) +
        section('Address · 地址', [
          row('Address', [p.address_line1, p.address_line2].filter(Boolean).join(', ')),
          row('City · 城市', p.city),
          row('State · 州', p.state),
          row('Postal Code · 郵遞區號', p.postal_code),
          row('Country · 國家', p.country),
        ]) +
        section('Emergency Contact · 緊急聯絡人', [
          row('Name · 姓名', p.emergency_contact_name),
          row('Phone · 電話', HM.format.phone(p.emergency_contact_phone)),
          row('Relationship · 關係', p.emergency_contact_relation),
        ]) +
        section('Medical Information · 醫療資訊', [
          row('Blood Type · 血型', p.blood_type),
          row('Height · 身高', p.height_cm ? p.height_cm + ' cm' : '—'),
          row('Weight · 體重', p.weight_kg ? p.weight_kg + ' kg' : '—'),
          row('Allergies · 過敏史', p.allergies),
          row('Medical History · 病史', p.medical_history),
          row('Current Medications · 現用藥物', p.current_medications),
          row('Family History · 家族病史', p.family_history),
        ]) +
        '</div>';
    } catch (e) {
      HM.state.error(el, e);
    }
  }

  function lockedBanner() {
    return '<div class="alert alert--info mb-6">' +
      '  <div class="alert-icon">🔒</div>' +
      '  <div class="alert-body">' +
      '    <div class="alert-title">Profile locked</div>' +
      '    Your profile information is locked for your safety. To make changes, please contact the clinic administrator.' +
      '    <br><span style="font-family: var(--font-zh);">資料已鎖定以確保安全。如需修改，請聯絡診所管理員。</span>' +
      '  </div>' +
      '</div>';
  }

  function section(title, rows) {
    return '<div class="mb-6">' +
      '<div class="text-label mb-3" style="border-bottom: 1px solid var(--border); padding-bottom: var(--s-2);">' + title + '</div>' +
      '<div class="field-grid field-grid--2" style="gap: var(--s-3);">' +
      rows.join('') +
      '</div>' +
      '</div>';
  }

  function row(label, value) {
    return '<div>' +
      '<div class="text-xs text-muted mb-1" style="letter-spacing: 0.08em;">' + label + '</div>' +
      '<div class="text-sm" style="color: var(--ink);">' + HM.format.esc(value || '—') + '</div>' +
      '</div>';
  }

  HM.patientPanels.profile = { render: render };
})();
