/**
 * Doctor Patient List + Patient Detail
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

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
        '<div class="flex gap-2">' +
        '<button class="btn btn--primary btn--sm" onclick="HM.doctorPanels.patients._book(' + patient.id + ', \'' + HM.format.esc(name).replace(/'/g, "\\'") + '\')">+ Book Appointment · 預約</button>' +
        '<button class="btn btn--outline btn--sm" onclick="HM.doctorPanels.patients._chat(' + patient.id + ')">💬 Chat</button>' +
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
          html += '<div class="card">' +
            '<img src="' + HM.format.esc(t.image_url) + '" style="width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: var(--r-md); border: 1px solid var(--border); margin-bottom: var(--s-2);">' +
            '<div class="text-label">' + HM.format.date(t.created_at) + '</div>' +
            '<div class="text-sm mt-1">' + HM.format.esc(c.name_en || 'Analysis') + '</div>' +
            '<div class="text-xs text-muted">Score: ' + (t.health_score || '—') + '/100</div>' +
            '</div>';
        });
        html += '</div>';
      }

      // Consultations
      html += '<div class="text-label mb-3">Consultation History · 問診記錄</div>';
      if (!appts.length) {
        html += '<div class="card"><p class="text-muted text-center">No consultations yet</p></div>';
      } else {
        appts.forEach(function (a) {
          var c = a.consultation || {};
          var rx = a.prescription || {};
          html += '<div class="card card--bordered mb-3" style="border-left-color: ' + (a.status === 'completed' ? 'var(--sage)' : 'var(--gold)') + ';">' +
            '<div class="flex-between">' +
            '<strong>' + HM.format.datetime(a.scheduled_start) + '</strong>' +
            HM.format.statusBadge(a.status) + '</div>';
          if (c.doctor_notes) html += '<p class="text-sm text-muted mt-2"><em>' + HM.format.esc(c.doctor_notes) + '</em></p>';
          if (rx.diagnosis) html += '<div class="text-sm mt-2">Dx: ' + HM.format.esc(rx.diagnosis) + '</div>';
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
  };
})();
