/**
 * Documents — generate Medical Certificate (MC) and Referral letters.
 *
 * Originally a top-level sidebar tab where the doctor had to manually
 * type patient_id + appointment_id. Now the entry points live inside
 * the patient detail view (and the per-consultation cards) so the
 * IDs auto-fill from context — no more typing IDs.
 *
 * This module exposes:
 *   HM.doctorPanels.documents.openMc(patient, appointment)
 *   HM.doctorPanels.documents.openReferral(patient)
 *
 * The .render() entry point is preserved (legacy bookmarks of
 * #/documents) but just shows a friendly notice + back link to the
 * patient list — that's where the buttons now live.
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  // ── Legacy panel: only reached via stale bookmarks. Doctor.js now
  //    redirects #/documents → #/patients, so this is just a safety net.
  function render(el) {
    el.innerHTML =
      '<div class="page-header">' +
        '<div class="page-header-label">Documents · 文件</div>' +
        '<h1 class="page-title">Documents have moved</h1>' +
      '</div>' +
      '<div class="card card--pad-lg" style="max-width:560px;">' +
        '<p>To issue a <strong>Medical Certificate</strong> or a <strong>Referral Letter</strong>, open a patient\'s case record — the buttons are pre-filled with their details.</p>' +
        '<p style="margin-top:8px;color:var(--mu);font-size:13px;">' +
          '開立 <strong>病假條</strong> 或 <strong>轉介信</strong>，請進入患者病歷頁面 — 患者資料會自動帶入。' +
        '</p>' +
        '<div style="margin-top:16px;">' +
          '<a class="btn btn--primary" href="#/patients">Go to Patient List · 前往患者列表</a>' +
        '</div>' +
      '</div>';
  }

  // ── MC modal — pre-fills patient + appointment from caller context.
  function openMc(patient, appointment) {
    var p = patient || {};
    var a = appointment || {};
    var pp = p.patient_profile || {};
    var name = pp.full_name || pp.nickname || p.email || ('#' + (p.id || '?'));

    var defaultStart = (function () {
      // Default the MC start date to today (most common case).
      var d = new Date();
      return d.toISOString().slice(0, 10);
    })();

    var visitLine = a.id
      ? 'Appointment #' + a.id + ' · ' + (a.scheduled_start ? HM.format.date(a.scheduled_start) : '')
      : '— select a consultation card to issue against —';

    var m = HM.ui.modal({
      size: 'md',
      title: '📋 Issue Medical Certificate · 開立病假條',
      content:
        '<form id="mc-form">' +
          '<div class="card card--bordered" style="background:var(--washi);padding:var(--s-2) var(--s-3);margin-bottom:var(--s-3);">' +
            '<div class="text-label" style="font-size:10px;">Patient · 患者</div>' +
            '<div class="text-sm"><strong>' + HM.format.esc(name) + '</strong>' +
              (pp.ic_number ? ' · ' + HM.format.esc(pp.ic_number) : '') + '</div>' +
            '<div class="text-xs text-muted">' + HM.format.esc(visitLine) + '</div>' +
          '</div>' +
          '<input type="hidden" name="patient_id" value="' + (p.id || '') + '">' +
          '<input type="hidden" name="appointment_id" value="' + (a.id || '') + '">' +

          '<div class="field-grid field-grid--2">' +
            '<div class="field"><label class="field-label" data-required>Days Off · 請假天數</label>' +
              '<input name="days" type="number" min="1" max="14" class="field-input field-input--boxed" value="1" required></div>' +
            '<div class="field"><label class="field-label" data-required>Start Date · 起始日期</label>' +
              '<input name="start_date" type="date" class="field-input field-input--boxed" value="' + defaultStart + '" required></div>' +
          '</div>' +
          '<div class="field"><label class="field-label" data-required>Diagnosis · 診斷</label>' +
            '<input name="diagnosis" class="field-input field-input--boxed" required ' +
              'value="' + HM.format.esc((a.consultation && a.consultation.case_record && a.consultation.case_record.pattern_diagnosis) || '') + '" ' +
              'placeholder="e.g. Acute viral upper respiratory tract infection"></div>' +
          '<div class="field"><label class="field-label">Remarks · 備註</label>' +
            '<textarea name="remarks" class="field-input field-input--boxed" rows="2"></textarea></div>' +
          '<div data-general-error class="alert alert--danger" style="display:none;"></div>' +
          '<button type="submit" class="btn btn--primary btn--block mt-4">Generate &amp; Open · 生成並開啟</button>' +
        '</form>',
    });

    var form = m.element.querySelector('#mc-form');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!p.id || !a.id) {
        HM.form.showGeneralError(form, 'Patient or appointment missing. Please open the MC button from a consultation card.');
        return;
      }
      var data = HM.form.serialize(form);
      data.patient_id = parseInt(data.patient_id, 10);
      data.appointment_id = parseInt(data.appointment_id, 10);
      data.days = parseInt(data.days, 10);
      HM.form.setLoading(form, true);
      try {
        var html = await HM.api.post('/doctor/documents/mc', data);
        m.close();
        openDocument(html, 'Medical Certificate');
      } catch (err) {
        HM.form.setLoading(form, false);
        HM.form.showGeneralError(form, err.message || 'Failed to generate MC');
      }
    });
  }

  // ── Referral modal — only needs patient context.
  function openReferral(patient) {
    var p = patient || {};
    var pp = p.patient_profile || {};
    var name = pp.full_name || pp.nickname || p.email || ('#' + (p.id || '?'));

    var m = HM.ui.modal({
      size: 'md',
      title: '📨 Issue Referral Letter · 開立轉介信',
      content:
        '<form id="ref-form">' +
          '<div class="card card--bordered" style="background:var(--washi);padding:var(--s-2) var(--s-3);margin-bottom:var(--s-3);">' +
            '<div class="text-label" style="font-size:10px;">Patient · 患者</div>' +
            '<div class="text-sm"><strong>' + HM.format.esc(name) + '</strong>' +
              (pp.ic_number ? ' · ' + HM.format.esc(pp.ic_number) : '') + '</div>' +
          '</div>' +
          '<input type="hidden" name="patient_id" value="' + (p.id || '') + '">' +

          '<div class="field"><label class="field-label" data-required>Refer To · 轉介至</label>' +
            '<input name="referred_to" class="field-input field-input--boxed" required placeholder="Specialist name or hospital"></div>' +
          '<div class="field"><label class="field-label">Specialty · 專科</label>' +
            '<input name="specialty" class="field-input field-input--boxed" placeholder="e.g. Cardiology, Orthopaedic"></div>' +
          '<div class="field"><label class="field-label" data-required>Diagnosis · 診斷</label>' +
            '<input name="diagnosis" class="field-input field-input--boxed" required></div>' +
          '<div class="field"><label class="field-label" data-required>Reason for Referral · 轉介原因</label>' +
            '<textarea name="reason" class="field-input field-input--boxed" rows="3" required></textarea></div>' +
          '<div class="field"><label class="field-label">Clinical Notes · 臨床記錄</label>' +
            '<textarea name="clinical_notes" class="field-input field-input--boxed" rows="3"></textarea></div>' +
          '<div data-general-error class="alert alert--danger" style="display:none;"></div>' +
          '<button type="submit" class="btn btn--primary btn--block mt-4">Generate &amp; Open · 生成並開啟</button>' +
        '</form>',
    });

    var form = m.element.querySelector('#ref-form');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!p.id) {
        HM.form.showGeneralError(form, 'Patient context missing.');
        return;
      }
      var data = HM.form.serialize(form);
      data.patient_id = parseInt(data.patient_id, 10);
      HM.form.setLoading(form, true);
      try {
        var html = await HM.api.post('/doctor/documents/referral', data);
        m.close();
        openDocument(html, 'Referral Letter');
      } catch (err) {
        HM.form.setLoading(form, false);
        HM.form.showGeneralError(form, err.message || 'Failed to generate referral');
      }
    });
  }

  function openDocument(html, label) {
    if (typeof html !== 'string') {
      HM.ui.toast((label || 'Document') + ' generated', 'success');
      return;
    }
    var w = window.open('', '_blank');
    if (!w) {
      HM.ui.toast('Pop-up blocked — allow pop-ups to view the document', 'warn', 6000);
      return;
    }
    w.document.write(html);
    w.document.close();
  }

  HM.doctorPanels.documents = {
    render:        render,
    openMc:        openMc,
    openReferral:  openReferral,
  };
})();
