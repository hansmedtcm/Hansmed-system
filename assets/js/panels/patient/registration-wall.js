/**
 * Registration Wall — mandatory profile completion before patient can use portal
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  function html() {
    return '' +
      '<div class="page-header">' +
      '  <div class="page-header-label">Complete Your Profile · 完成註冊</div>' +
      '  <h1 class="page-title">Welcome to HansMed</h1>' +
      '  <p class="page-subtitle">Please complete your health profile to access the portal. · 請完成健康檔案以使用平台。</p>' +
      '</div>' +
      '<div class="alert alert--warning">' +
      '  <div class="alert-icon">⚠</div>' +
      '  <div class="alert-body">' +
      '    <div class="alert-title">Important · 重要</div>' +
      '    Once submitted, your profile cannot be edited by you. Only administrators can make corrections. Please double-check all information before submitting.' +
      '    <br><span style="font-family: var(--font-zh);">提交後您將無法自行修改，如需更正請聯絡管理員。</span>' +
      '  </div>' +
      '</div>' +
      '<form id="reg-wall-form" class="card card--pad-lg" style="max-width: 900px;">' +
      '  <h3 style="margin-bottom: var(--s-4);">Personal Information · 個人資料</h3>' +
      '  <div class="field-grid field-grid--2">' +
      '    <div class="field"><label class="field-label" data-required>Full Name · 姓名</label><input name="full_name" class="field-input" required><div class="field-error"></div></div>' +
      '    <div class="field"><label class="field-label" data-required>IC / ID Number · 身份證號碼</label><input name="ic_number" class="field-input" required><div class="field-error"></div></div>' +
      '    <div class="field"><label class="field-label" data-required>Phone · 電話</label><input type="tel" name="phone" class="field-input" required><div class="field-error"></div></div>' +
      '    <div class="field"><label class="field-label" data-required>Date of Birth · 出生日期</label><input type="date" name="birth_date" class="field-input" required><div class="field-error"></div></div>' +
      '    <div class="field"><label class="field-label" data-required>Gender · 性別</label><select name="gender" class="field-input" required><option value="">Select…</option><option value="male">Male · 男</option><option value="female">Female · 女</option><option value="other">Other · 其他</option></select><div class="field-error"></div></div>' +
      '    <div class="field"><label class="field-label">Occupation · 職業</label><input name="occupation" class="field-input"><div class="field-error"></div></div>' +
      '  </div>' +

      '  <h3 style="margin: var(--s-6) 0 var(--s-4);">Address · 地址</h3>' +
      '  <div class="field-grid field-grid--2">' +
      '    <div class="field" style="grid-column: span 2;"><label class="field-label" data-required>Address Line 1 · 地址</label><input name="address_line1" class="field-input" required></div>' +
      '    <div class="field" style="grid-column: span 2;"><label class="field-label">Address Line 2</label><input name="address_line2" class="field-input"></div>' +
      '    <div class="field"><label class="field-label" data-required>City · 城市</label><input name="city" class="field-input" required></div>' +
      '    <div class="field"><label class="field-label" data-required>State · 州</label><input name="state" class="field-input" required></div>' +
      '    <div class="field"><label class="field-label" data-required>Postal Code · 郵遞區號</label><input name="postal_code" class="field-input" required></div>' +
      '    <div class="field"><label class="field-label" data-required>Country · 國家</label><input name="country" class="field-input" value="Malaysia" required></div>' +
      '  </div>' +

      '  <h3 style="margin: var(--s-6) 0 var(--s-4);">Emergency Contact · 緊急聯絡人</h3>' +
      '  <div class="field-grid field-grid--3">' +
      '    <div class="field"><label class="field-label" data-required>Name · 姓名</label><input name="emergency_contact_name" class="field-input" required></div>' +
      '    <div class="field"><label class="field-label" data-required>Phone · 電話</label><input type="tel" name="emergency_contact_phone" class="field-input" required></div>' +
      '    <div class="field"><label class="field-label" data-required>Relationship · 關係</label><input name="emergency_contact_relation" class="field-input" required placeholder="e.g. Parent, Spouse"></div>' +
      '  </div>' +

      '  <h3 style="margin: var(--s-6) 0 var(--s-4);">Medical Information · 醫療資訊</h3>' +
      '  <div class="field-grid field-grid--3">' +
      '    <div class="field"><label class="field-label" data-required>Blood Type · 血型</label><select name="blood_type" class="field-input" required><option value="">Select…</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option><option>O+</option><option>O-</option><option value="unknown">Unknown · 不明</option></select></div>' +
      '    <div class="field"><label class="field-label">Height (cm) · 身高</label><input type="number" step="0.1" name="height_cm" class="field-input"></div>' +
      '    <div class="field"><label class="field-label">Weight (kg) · 體重</label><input type="number" step="0.1" name="weight_kg" class="field-input"></div>' +
      '  </div>' +
      '  <div class="field"><label class="field-label" data-required>Allergies · 過敏史</label><textarea name="allergies" class="field-input" rows="2" placeholder="Enter None if no allergies" required></textarea></div>' +
      '  <div class="field"><label class="field-label">Medical History · 病史</label><textarea name="medical_history" class="field-input" rows="2" placeholder="Past illnesses, surgeries"></textarea></div>' +
      '  <div class="field"><label class="field-label">Current Medications · 現用藥物</label><textarea name="current_medications" class="field-input" rows="2"></textarea></div>' +
      '  <div class="field"><label class="field-label">Family History · 家族病史</label><textarea name="family_history" class="field-input" rows="2"></textarea></div>' +

      '  <div data-general-error class="alert alert--danger" style="display:none; margin-top: var(--s-4);"></div>' +
      '  <button type="submit" class="btn btn--primary btn--block btn--lg" style="margin-top: var(--s-6);">Complete Registration · 完成註冊</button>' +
      '  <p class="text-center text-xs text-muted mt-4">Fields marked * are required · 標記 * 為必填</p>' +
      '</form>';
  }

  function show(user) {
    var overlay = document.createElement('div');
    overlay.id = 'reg-wall-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:var(--cream);z-index:500;overflow-y:auto;padding:var(--s-6);';
    overlay.innerHTML = '<div class="container">' + html() + '</div>';
    document.body.appendChild(overlay);

    var formEl = overlay.querySelector('#reg-wall-form');
    formEl.addEventListener('submit', async function (e) {
      e.preventDefault();
      HM.form.clearErrors(formEl);
      HM.form.setLoading(formEl, true);
      try {
        var data = HM.form.serialize(formEl);
        await HM.api.patient.completeRegistration(data);
        HM.ui.toast('Registration completed · 註冊完成', 'success');
        overlay.remove();
        await HM.auth.refresh();
        location.hash = '#/';
        location.reload();
      } catch (err) {
        HM.form.setLoading(formEl, false);
        if (err.data && err.data.errors) {
          HM.form.showErrors(formEl, err.data.errors);
          HM.ui.toast('Please check the highlighted fields', 'danger');
        } else {
          HM.form.showGeneralError(formEl, err.message || 'Submission failed');
        }
      }
    });
  }

  HM.patientPanels.registrationWall = { show: show };
})();
