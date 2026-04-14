/**
 * Documents — generate MC & Referral letters
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Documents · 文件</div>' +
      '<h1 class="page-title">Generate Medical Documents</h1>' +
      '</div>' +
      '<div class="grid-2">' +
      '<div class="card card--pad-lg">' +
      '<h3 class="mb-3">📋 Medical Certificate (MC) · 病假條</h3>' +
      '<form id="mc-form">' +
      '<div class="field"><label class="field-label" data-required>Patient ID</label><input name="patient_id" type="number" class="field-input field-input--boxed" required></div>' +
      '<div class="field"><label class="field-label" data-required>Appointment ID</label><input name="appointment_id" type="number" class="field-input field-input--boxed" required></div>' +
      '<div class="field"><label class="field-label" data-required>Days Off · 請假天數</label><input name="days" type="number" min="1" max="14" class="field-input field-input--boxed" value="1" required></div>' +
      '<div class="field"><label class="field-label" data-required>Start Date · 起始日期</label><input name="start_date" type="date" class="field-input field-input--boxed" required></div>' +
      '<div class="field"><label class="field-label" data-required>Diagnosis · 診斷</label><input name="diagnosis" class="field-input" required></div>' +
      '<div class="field"><label class="field-label">Remarks · 備註</label><textarea name="remarks" class="field-input" rows="2"></textarea></div>' +
      '<button type="submit" class="btn btn--primary btn--block">Generate MC · 開立</button>' +
      '</form></div>' +

      '<div class="card card--pad-lg">' +
      '<h3 class="mb-3">📨 Referral Letter · 轉介信</h3>' +
      '<form id="ref-form">' +
      '<div class="field"><label class="field-label" data-required>Patient ID</label><input name="patient_id" type="number" class="field-input field-input--boxed" required></div>' +
      '<div class="field"><label class="field-label" data-required>Refer To · 轉介至</label><input name="referred_to" class="field-input" required placeholder="Specialist name / Hospital"></div>' +
      '<div class="field"><label class="field-label">Specialty · 專科</label><input name="specialty" class="field-input field-input--boxed"></div>' +
      '<div class="field"><label class="field-label" data-required>Diagnosis · 診斷</label><input name="diagnosis" class="field-input" required></div>' +
      '<div class="field"><label class="field-label" data-required>Reason · 轉介原因</label><textarea name="reason" class="field-input" rows="3" required></textarea></div>' +
      '<div class="field"><label class="field-label">Clinical Notes · 臨床記錄</label><textarea name="clinical_notes" class="field-input" rows="3"></textarea></div>' +
      '<button type="submit" class="btn btn--primary btn--block">Generate Letter · 開立</button>' +
      '</form></div>' +
      '</div>';

    document.getElementById('mc-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var data = HM.form.serialize(e.target);
      try {
        var html = await HM.api.post('/doctor/documents/mc', data);
        openDocument(html);
      } catch (err) { HM.ui.toast(err.message || 'Failed', 'danger'); }
    });

    document.getElementById('ref-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var data = HM.form.serialize(e.target);
      try {
        var html = await HM.api.post('/doctor/documents/referral', data);
        openDocument(html);
      } catch (err) { HM.ui.toast(err.message || 'Failed', 'danger'); }
    });
  }

  function openDocument(html) {
    if (typeof html !== 'string') {
      HM.ui.toast('Document generated', 'success');
      return;
    }
    var w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  }

  HM.doctorPanels.documents = { render: render };
})();
