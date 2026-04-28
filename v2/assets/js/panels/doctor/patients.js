/**
 * Doctor Patient List + Patient Detail
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  // Cache of last-rendered patient detail data, keyed by patient id —
  // lets inline onclick handlers (referral / MC) hand the full patient
  // and appointment objects back to documents.js without re-fetching.
  var _ctx = { byPatient: {} };

  async function render(el) {
    el.innerHTML = '<div class="page-header flex-between">' +
      '<div><div class="page-header-label">My Patients · 我的患者</div>' +
      '<h1 class="page-title">Patient List</h1></div>' +
      '<button class="btn btn--primary" id="pt-book-any">+ New Appointment · 新建預約</button>' +
      '</div>' +
      '<input id="pt-search" type="text" class="field-input field-input--boxed mb-4" placeholder="Search by name, IC, phone… · 搜尋" style="max-width: 400px;">' +
      '<div id="pt-list"></div>';

    document.getElementById('pt-book-any').addEventListener('click', function () { showBookModal(null, null); });
    await load();
    document.getElementById('pt-search').addEventListener('input', debounce(load, 300));
  }

  async function load() {
    var container = document.getElementById('pt-list');
    if (!container) return;
    var search = document.getElementById('pt-search') ? document.getElementById('pt-search').value : '';
    HM.state.loading(container);
    try {
      var res = await HM.api.doctor.listPatients(search ? 'search=' + encodeURIComponent(search) : '');
      var items = res.data || [];

      if (!items.length) {
        HM.state.empty(container, {
          icon: '👥',
          title: 'No patients yet',
          text: 'Patients will appear here after their first consultation with you',
        });
        return;
      }

      container.innerHTML = '';
      items.forEach(function (p) {
        var pp = p.patient_profile || {};
        var name = pp.full_name || pp.nickname || p.email;
        var data = {
          id: p.id,
          initial: name.charAt(0).toUpperCase(),
          name: name,
          contact: [pp.ic_number, pp.phone].filter(Boolean).join(' · '),
          visits_text: (p.appointment_count || 0) + ' visits',
          last_visit_text: p.last_visit ? 'Last: ' + HM.format.date(p.last_visit) : '',
        };
        var node = HM.render.fromTemplate('tpl-patient-card', data);
        node.querySelector('[data-action="view"]').addEventListener('click', function () {
          location.hash = '#/patients/' + p.id;
        });
        container.appendChild(node);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  async function renderDetail(el, id) {
    HM.state.loading(el);
    try {
      var results = await Promise.all([
        HM.api.doctor.patientConsults(id),
        HM.api.doctor.patientTongue(id),
      ]);
      var consultRes = results[0];
      var tongueRes = results[1];

      var patient = consultRes.patient || {};
      var pp = patient.patient_profile || {};
      var name = pp.full_name || pp.nickname || patient.email;
      var appts = consultRes.appointments || [];
      var tongues = tongueRes.data || [];

      // Stash patient + appointments so the inline button handlers
      // (referral / MC) can read full objects back without round-tripping
      // the API. Keyed on patient id so multiple detail renders don't
      // clobber each other.
      _ctx.byPatient[patient.id] = { patient: patient, appts: appts };

      var html = '<div class="page-header">' +
        '<button class="btn btn--ghost" onclick="location.hash=\'#/patients\'">← Back to Patients</button>' +
        '</div>' +
        '<div class="card card--pad-lg mb-6">' +
        '<div class="flex flex-gap-4">' +
        '<div class="avatar avatar--lg" style="background: var(--ink); color: var(--gold);">' + name.charAt(0).toUpperCase() + '</div>' +
        '<div style="flex:1;">' +
        '<h2>' + HM.format.esc(name) + '</h2>' +
        '<p class="text-muted">' + (pp.ic_number || '') + ' · ' + (pp.phone || '') + ' · ' + (pp.gender || '') + '</p>' +
        '</div>' +
        '<div class="flex gap-2" style="flex-wrap:wrap;">' +
        '<button class="btn btn--primary btn--sm" onclick="HM.doctorPanels.patients._book(' + patient.id + ', \'' + HM.format.esc(name).replace(/'/g, "\\'") + '\')">+ Book Appointment · 預約</button>' +
        '<button class="btn btn--outline btn--sm" onclick="HM.doctorPanels.patients._chat(' + patient.id + ')">💬 Chat</button>' +
        '<button class="btn btn--outline btn--sm" onclick="HM.doctorPanels.patients._referral(' + patient.id + ')">📨 Referral · 轉介信</button>' +
        '</div>' +
        '</div>' +
        '<div class="grid-4 grid-auto mt-4" style="gap: var(--s-3);">' +
        summaryCell('Date of Birth', pp.birth_date ? String(pp.birth_date).substring(0, 10) : '—') +
        summaryCell('Blood Type', pp.blood_type || '—') +
        summaryCell('Height / Weight', (pp.height_cm ? pp.height_cm + 'cm' : '—') + ' / ' + (pp.weight_kg ? pp.weight_kg + 'kg' : '—')) +
        summaryCell('Allergies', pp.allergies || 'None') +
        summaryCell('Medical History', HM.format.truncate(pp.medical_history || 'None', 50)) +
        '</div></div>' +

        // Wuyun Liuqi clinical analysis (doctor-only aide, hidden from patient).
        // Renders only when patient has a birth_date on file.
        '<div id="wyl-mount-patient" class="mb-6"></div>';

      // Tongue scans
      if (tongues.length) {
        html += '<div class="text-label mb-3">Tongue Diagnoses · 舌診記錄 (' + tongues.length + ')</div>';
        html += '<div class="grid-auto mb-6" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--s-3);">';
        tongues.slice(0, 3).forEach(function (t) {
          var c = (t.constitution_report && t.constitution_report.constitution) || {};
          // image_url null = the photo was lost in the pre-volume era
          // (see clearTongueOrphans migration). Show a friendly
          // placeholder so the card still reads as a real diagnostic
          // record instead of a broken-image icon.
          var thumb = t.image_url
            ? '<img src="' + HM.format.esc(t.image_url) + '" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--r-md);border:1px solid var(--border);margin-bottom:var(--s-2);">'
            : '<div style="width:100%;aspect-ratio:1;background:var(--washi);border:1px dashed var(--border);border-radius:var(--r-md);display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--mu);margin-bottom:var(--s-2);text-align:center;padding:var(--s-2);">' +
                '<div style="font-size:28px;opacity:0.5;margin-bottom:4px;">📷</div>' +
                '<div style="font-size:11px;line-height:1.4;"><span lang="en">Photo no longer available</span><span lang="zh">照片已不可用</span></div>' +
              '</div>';
          html += '<div class="card">' +
            thumb +
            '<div class="text-label">' + HM.format.date(t.created_at) + '</div>' +
            '<div class="text-sm mt-1">' + HM.format.esc(c.name_en || 'Analysis') + '</div>' +
            '<div class="text-xs text-muted">Score: ' + (t.health_score || '—') + '/100</div>' +
            '</div>';
        });
        html += '</div>';
      }

      // Pool-review access banner — backend sets pool_review_access=true
      // on the response when (a) this patient is in the shared review
      // queue AND (b) the response includes consults from doctors other
      // than the current viewer. Surface that explicitly so the
      // reviewing doctor knows they're seeing extra clinical history
      // they wouldn't normally have access to.
      if (consultRes.pool_review_access) {
        html +=
          '<div class="alert alert--info mb-4" style="border-left:3px solid var(--gold,#B8965A);">' +
            '<div class="alert-body" style="font-size:13px;">' +
              '<strong>🔓 Pool Review Access · 共享審核權限</strong><br>' +
              '<span lang="en">You are viewing this patient\'s consultation history from other practitioners because they currently have a pending review in the AI Reviews queue. Access closes once the review is approved or rejected.</span>' +
              '<span lang="zh" style="font-family:var(--font-zh);">由於此患者目前有待審核的 AI 報告，您可暫時查看其他中醫師的問診記錄。審核完成後該權限將自動關閉。</span>' +
            '</div>' +
          '</div>';
      }

      // Consultations — expanded card shows the full case record
      // (chief complaint, BP, pulse, body diagram findings, doctor's
      // notes), treatments performed, and the full prescription.
      // This is the doctor's clinical record for the patient.
      html += '<div class="text-label mb-3">Consultation History · 問診記錄 (' + appts.length + ')</div>';
      if (!appts.length) {
        html += '<div class="card"><p class="text-muted text-center">No consultations yet · 暫無問診記錄</p></div>';
      } else {
        // Used below to decide whether to label a consultation card
        // with the treating doctor's name. Only shown when the treater
        // is someone other than the current viewer (i.e. when this
        // doctor is reviewing the patient via the shared pool).
        var viewer = (HM.api && HM.api.getUser && HM.api.getUser()) || {};
        var viewerId = viewer.id;

        appts.forEach(function (a) {
          var c = a.consultation || {};
          // case_record + treatments are JSON-casted on the model but
          // can come back as null / string / object on legacy rows.
          // Coerce defensively so neither .forEach nor .length blows
          // up the whole patient detail render.
          var cr = (c.case_record && typeof c.case_record === 'object') ? c.case_record : {};
          var rx = a.prescription || {};
          var treatments = Array.isArray(c.treatments) ? c.treatments : [];
          var bodyMarks  = Array.isArray(cr.body_marks) ? cr.body_marks : [];
          var rxItems    = Array.isArray(rx.items) ? rx.items : [];
          var visitBadge = (a.visit_type === 'walk_in')
            ? '<span class="badge" style="background:rgba(184,150,90,.15);color:var(--gold);font-size:10px;">🏥 Walk-in</span>'
            : '<span class="badge" style="background:rgba(74,144,217,.15);color:#4a90d9;font-size:10px;">📹 Online</span>';

          // If the consult was conducted by a doctor other than the
          // current viewer (only ever happens in pool-review access
          // mode), label the card so the reviewer knows it's not their
          // own note. Backend tags treating_doctor_name on each row.
          var treatingLabel = '';
          if (a.treating_doctor_name && a.doctor_id && a.doctor_id !== viewerId) {
            treatingLabel =
              '<div class="text-xs mt-1" style="color:var(--wd-md,#9A6035);font-weight:500;">' +
                '<span lang="en">Treated by: ' + HM.format.esc(a.treating_doctor_name) + '</span>' +
                '<span lang="zh" style="font-family:var(--font-zh);">主治醫師：' + HM.format.esc(a.treating_doctor_name) + '</span>' +
              '</div>';
          }

          html += '<div class="card card--bordered mb-3" style="border-left-color: ' +
            (a.status === 'completed' ? 'var(--sage)' : 'var(--gold)') + ';">' +
            '<div class="flex-between mb-2" style="align-items:flex-start;gap:var(--s-2);">' +
              '<div>' +
                '<strong>' + HM.format.datetime(a.scheduled_start) + '</strong> ' + visitBadge +
                (a.concern_label ? '<div class="text-xs text-muted mt-1">Concern: ' + HM.format.esc(a.concern_label) + '</div>' : '') +
                treatingLabel +
              '</div>' +
              '<div class="flex gap-2" style="align-items:center;flex-wrap:wrap;justify-content:flex-end;">' +
                HM.format.statusBadge(a.status) +
                // MC issuance is offered for completed visits — that's
                // where a real diagnosis exists to write into the cert.
                (a.status === 'completed'
                  ? '<button class="btn btn--ghost btn--sm" style="padding:4px 10px;font-size:11px;" onclick="HM.doctorPanels.patients._mc(' + patient.id + ',' + a.id + ')">📋 Issue MC</button>'
                  : '') +
              '</div>' +
            '</div>';

          // ── Case Record block — chief complaint, BP, pulse, body marks
          var hasCR = cr.chief_complaint || cr.bp || cr.pulse || cr.pattern_diagnosis || cr.doctor_instructions || bodyMarks.length;
          if (hasCR) {
            html += '<div class="mt-2" style="background:var(--washi);padding:var(--s-2) var(--s-3);border-radius:var(--r-sm);border-left:2px solid var(--gold);">' +
              '<div class="text-label" style="font-size:10px;">📋 Case Record · 病歷</div>';
            if (cr.chief_complaint) html += '<div class="text-sm mt-1"><strong>Chief Complaint · 主訴:</strong> ' + HM.format.esc(cr.chief_complaint) + '</div>';
            if (cr.bp || cr.pulse) {
              html += '<div class="text-sm mt-1">';
              if (cr.bp)    html += '<strong>BP · 血壓:</strong> ' + HM.format.esc(cr.bp);
              if (cr.bp && cr.pulse) html += ' · ';
              if (cr.pulse) html += '<strong>Pulse · 脈診:</strong> ' + HM.format.esc(cr.pulse);
              html += '</div>';
            }
            if (cr.pattern_diagnosis)   html += '<div class="text-sm mt-1"><strong>Pattern · 證型:</strong> ' + HM.format.esc(cr.pattern_diagnosis) + '</div>';
            if (cr.doctor_instructions) html += '<div class="text-sm mt-1"><strong>Notes · 醫囑:</strong> ' + HM.format.esc(cr.doctor_instructions) + '</div>';
            if (bodyMarks.length) {
              html += '<div class="text-xs text-muted mt-1">Body marks: ' + bodyMarks.length + ' point(s) recorded</div>';
            }
            html += '</div>';
          }

          // ── Doctor notes from consultation (separate from case_record)
          if (c.doctor_notes) {
            html += '<div class="text-sm text-muted mt-2"><em>' + HM.format.esc(c.doctor_notes) + '</em></div>';
          }

          // ── Treatments performed
          if (treatments.length) {
            html += '<div class="mt-2" style="background:rgba(122,140,114,.08);padding:var(--s-2) var(--s-3);border-radius:var(--r-sm);border-left:2px solid var(--sage);">' +
              '<div class="text-label" style="font-size:10px;">💉 Treatments · 治療 (' + treatments.length + ')</div>';
            treatments.forEach(function (t) {
              html += '<div class="text-sm mt-1">' +
                (t.icon || '•') + ' <strong>' + HM.format.esc(t.name || t.key || '—') + '</strong>' +
                (t.name_zh ? ' · <span style="font-family:var(--font-zh);">' + HM.format.esc(t.name_zh) + '</span>' : '') +
                (t.points && t.points.length ? '<div class="text-xs text-muted">Points · 穴位: ' + t.points.map(HM.format.esc).join(', ') + '</div>' : '') +
                (t.notes ? '<div class="text-xs text-muted">' + HM.format.esc(t.notes) + '</div>' : '') +
                '</div>';
            });
            html += '</div>';
          }

          // ── Prescription with full items
          if (rx && (rx.diagnosis || rxItems.length)) {
            html += '<div class="mt-2" style="background:#fff;border:1px solid var(--border);border-radius:var(--r-sm);padding:var(--s-2) var(--s-3);">' +
              '<div class="text-label" style="font-size:10px;">💊 Prescription · 處方</div>';
            if (rx.diagnosis)    html += '<div class="text-sm mt-1"><strong>Dx · 診斷:</strong> ' + HM.format.esc(rx.diagnosis) + '</div>';
            if (rx.instructions) html += '<div class="text-sm mt-1"><strong>Instructions · 醫囑:</strong> ' + HM.format.esc(rx.instructions) + '</div>';
            if (rxItems.length) {
              html += '<div class="text-xs text-muted mt-2" style="display:flex;flex-wrap:wrap;gap:6px;">';
              rxItems.forEach(function (it) {
                html += '<span style="background:var(--washi);padding:2px 8px;border-radius:999px;border:1px solid var(--border);">' +
                  HM.format.esc(it.drug_name || '') + ' ' + (it.quantity || '') + (it.unit || 'g') +
                  '</span>';
              });
              html += '</div>';
            }
            html += '</div>';
          }

          html += '</div>';
        });
      }

      el.innerHTML = html;

      // Mount dual Wuyun Liuqi card — innate constitution from DOB plus
      // today's environmental qi so the doctor can weigh both at review time.
      if (window.HM && HM.wuyunLiuqi) {
        HM.wuyunLiuqi.mountDual(document.getElementById('wyl-mount-patient'), pp.birth_date || null);
      }
    } catch (e) { HM.state.error(el, e); }
  }

  function summaryCell(label, val) {
    return '<div><div class="text-label" style="font-size: 0.6rem;">' + label + '</div><div class="text-sm mt-1">' + HM.format.esc(val) + '</div></div>';
  }

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function showBookModal(prefilledId, prefilledName) {
    var todayStr = new Date().toISOString().slice(0, 10);
    var nowTime = new Date();
    nowTime.setMinutes(0, 0, 0);
    nowTime.setHours(nowTime.getHours() + 1);
    var defaultTime = String(nowTime.getHours()).padStart(2, '0') + ':00';

    var content = '<form id="dbook-form">' +
      '<div class="field"><label class="field-label" data-required>Patient</label>';

    if (prefilledId) {
      content += '<input type="hidden" name="patient_id" value="' + prefilledId + '">' +
        '<input type="text" class="field-input field-input--boxed" value="' + HM.format.esc(prefilledName) + ' (#' + prefilledId + ')" readonly>';
    } else {
      content += '<select name="patient_id" id="dbook-patient" class="field-input field-input--boxed" required>' +
        '<option value="">Loading patients…</option>' +
        '</select>';
    }

    content += '</div>' +

      '<div class="field">' +
      '<label class="field-label" data-required>Visit Type · 就診方式</label>' +
      '<div class="flex gap-2 flex-wrap">' +
      '<label class="radio-option"><input type="radio" name="visit_type" value="walk_in" checked> 🏥 Walk-in · 臨診 (in-person)</label>' +
      '<label class="radio-option"><input type="radio" name="visit_type" value="online"> 📹 Online · 線上 (video)</label>' +
      '</div>' +
      '<div class="text-xs text-muted mt-1">Walk-in visits skip video and focus on the case record / treatments log. · 臨診無需視訊，直接記錄病歷與治療。</div>' +
      '</div>' +

      '<div class="field-grid field-grid--2">' +
      '<div class="field"><label class="field-label" data-required>Date · 日期</label>' +
      '<input type="date" name="date" class="field-input field-input--boxed" required min="' + todayStr + '" value="' + todayStr + '"></div>' +
      '<div class="field"><label class="field-label" data-required>Time · 時段</label>' +
      '<input type="time" name="time" class="field-input field-input--boxed" required value="' + defaultTime + '" step="900"></div>' +
      '</div>' +

      '<div class="field-grid field-grid--2">' +
      '<div class="field"><label class="field-label">Duration (min)</label>' +
      '<select name="duration" class="field-input field-input--boxed">' +
      '<option value="30">30 minutes</option><option value="45">45 minutes</option>' +
      '<option value="60" selected>60 minutes</option><option value="90">90 minutes</option>' +
      '</select></div>' +
      '<div class="field"><label class="field-label">Fee (RM)</label>' +
      '<input type="number" name="fee" min="0" step="0.01" class="field-input field-input--boxed" value="0" placeholder="0 = no charge"></div>' +
      '</div>' +

      '<div class="field"><label class="field-label">Concern · 主訴</label>' +
      '<input type="text" name="concern_label" class="field-input field-input--boxed" placeholder="e.g. Follow-up, Headache, Cold"></div>' +

      '<div class="field"><label class="field-label">Notes · 備註</label>' +
      '<textarea name="notes" class="field-input field-input--boxed" rows="3" placeholder="Reason for booking, anything to prepare…"></textarea></div>' +

      '<div data-general-error class="alert alert--danger" style="display:none;"></div>' +
      '<button type="submit" class="btn btn--primary btn--block mt-4">Create Appointment · 建立預約</button>' +
      '</form>';

    var m = HM.ui.modal({
      size: 'md',
      title: 'New Appointment for Patient · 為患者新建預約',
      content: content,
    });

    var form = m.element.querySelector('#dbook-form');

    if (!prefilledId) {
      // Populate the patient dropdown
      HM.api.doctor.listPatients('').then(function (res) {
        var select = m.element.querySelector('#dbook-patient');
        var items = res.data || [];
        if (!items.length) {
          select.innerHTML = '<option value="">No patients on file yet</option>';
          return;
        }
        select.innerHTML = '<option value="">— Select a patient —</option>' +
          items.map(function (p) {
            var pp = p.patient_profile || {};
            var name = pp.full_name || pp.nickname || p.email;
            return '<option value="' + p.id + '">' + HM.format.esc(name) + ' (#' + p.id + ')</option>';
          }).join('');
      }).catch(function () {
        m.element.querySelector('#dbook-patient').innerHTML = '<option value="">Failed to load patients</option>';
      });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var data = HM.form.serialize(form);
      var startStr = data.date + 'T' + data.time + ':00';
      var endDate = new Date(startStr);
      endDate.setMinutes(endDate.getMinutes() + parseInt(data.duration || '60', 10));
      var endIso = endDate.getFullYear() + '-' +
        String(endDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(endDate.getDate()).padStart(2, '0') + 'T' +
        String(endDate.getHours()).padStart(2, '0') + ':' +
        String(endDate.getMinutes()).padStart(2, '0') + ':00';

      var payload = {
        patient_id: parseInt(data.patient_id, 10),
        scheduled_start: startStr,
        scheduled_end: endIso,
        fee: parseFloat(data.fee || '0'),
        concern_label: data.concern_label || null,
        notes: data.notes || null,
        visit_type: data.visit_type || 'walk_in',
      };

      HM.form.setLoading(form, true);
      try {
        var res = await HM.api.doctor.createAppointment(payload);
        m.close();
        HM.ui.toast('Appointment created · 預約已建立', 'success');
        // Refresh the patient list / detail view
        if (location.hash.indexOf('#/patients/') === 0) {
          renderDetail(document.getElementById('panel-container'), payload.patient_id);
        } else {
          load();
        }
      } catch (err) {
        HM.form.setLoading(form, false);
        HM.form.showGeneralError(form, err.message || 'Could not create appointment');
      }
    });
  }

  HM.doctorPanels.patients = {
    render: render,
    renderDetail: renderDetail,
    _chat: async function (patientId) {
      try {
        var r = await HM.api.chat.openThread({ patient_id: patientId });
        location.hash = '#/messages/' + r.thread.id;
      } catch (e) { HM.ui.toast('Could not open chat', 'danger'); }
    },
    _book: function (patientId, patientName) {
      showBookModal(patientId, patientName);
    },
    _referral: function (patientId) {
      var c = _ctx.byPatient[patientId];
      if (!c) { HM.ui.toast('Patient context lost — please reopen this page', 'warn'); return; }
      HM.doctorPanels.documents.openReferral(c.patient);
    },
    _mc: function (patientId, appointmentId) {
      var c = _ctx.byPatient[patientId];
      if (!c) { HM.ui.toast('Patient context lost — please reopen this page', 'warn'); return; }
      var appt = (c.appts || []).find(function (a) { return a.id === appointmentId; });
      if (!appt) { HM.ui.toast('Could not find that appointment in this patient\'s history', 'warn'); return; }
      HM.doctorPanels.documents.openMc(c.patient, appt);
    },
  };
})();
