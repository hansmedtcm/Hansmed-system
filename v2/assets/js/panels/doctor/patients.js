/**
 * Doctor Patient List + Patient Detail
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">My Patients · 我的患者</div>' +
      '<h1 class="page-title">Patient List</h1>' +
      '</div>' +
      '<input id="pt-search" type="text" class="field-input field-input--boxed mb-4" placeholder="Search by name, IC, phone… · 搜尋" style="max-width: 400px;">' +
      '<div id="pt-list"></div>';

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
        '<button class="btn btn--outline btn--sm" onclick="HM.doctorPanels.patients._chat(' + patient.id + ')">💬 Chat</button>' +
        '</div>' +
        '<div class="grid-4 grid-auto mt-4" style="gap: var(--s-3);">' +
        summaryCell('Blood Type', pp.blood_type || '—') +
        summaryCell('Height / Weight', (pp.height_cm ? pp.height_cm + 'cm' : '—') + ' / ' + (pp.weight_kg ? pp.weight_kg + 'kg' : '—')) +
        summaryCell('Allergies', pp.allergies || 'None') +
        summaryCell('Medical History', HM.format.truncate(pp.medical_history || 'None', 50)) +
        '</div></div>';

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
    } catch (e) { HM.state.error(el, e); }
  }

  function summaryCell(label, val) {
    return '<div><div class="text-label" style="font-size: 0.6rem;">' + label + '</div><div class="text-sm mt-1">' + HM.format.esc(val) + '</div></div>';
  }

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
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
  };
})();
