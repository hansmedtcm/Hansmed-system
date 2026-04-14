/**
 * Health Records — clinical history at this clinic
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  async function render(el) {
    HM.state.loading(el);
    try {
      var results = await Promise.allSettled([
        HM.api.patient.listAppointments(),
        HM.api.patient.listPrescriptions(),
        HM.api.patient.getProfile(),
      ]);
      var appts = results[0].status === 'fulfilled' ? (results[0].value.data || []) : [];
      var rxs = results[1].status === 'fulfilled' ? (results[1].value.data || []) : [];
      var profileRes = results[2].status === 'fulfilled' ? results[2].value : null;
      var p = (profileRes && profileRes.user && profileRes.user.patient_profile) || {};

      var completed = appts.filter(function (a) { return a.status === 'completed'; });

      var html = '<div class="page-header">' +
        '<div class="page-header-label">Health Records · 健康檔案</div>' +
        '<h1 class="page-title">Your Clinical History</h1>' +
        '<p class="page-subtitle">Your consultations and treatments at HansMed</p>' +
        '</div>';

      // Quick medical summary
      html += '<div class="card card--pad-lg mb-6">' +
        '<div class="text-label mb-3">Medical Summary · 醫療摘要</div>' +
        '<div class="grid-4 grid-auto" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">' +
        summaryCell('Blood Type', p.blood_type || '—') +
        summaryCell('Height / Weight', (p.height_cm ? p.height_cm + 'cm' : '—') + ' / ' + (p.weight_kg ? p.weight_kg + 'kg' : '—')) +
        summaryCell('Allergies', p.allergies || 'None') +
        summaryCell('Current Medications', p.current_medications || 'None') +
        '</div></div>';

      // Consultation history
      html += '<div class="text-label mb-3">Consultation History · 就診記錄</div>';

      if (!completed.length && !rxs.length) {
        html += '<div class="card"><div class="state state--empty">' +
          '<div class="state-icon">📋</div>' +
          '<div class="state-title">No clinical records yet</div>' +
          '<div class="state-text">Your consultation history will appear here after your first visit.</div>' +
          '<div class="state-actions"><a href="#/book" class="btn btn--primary">Book First Consultation</a></div>' +
          '</div></div>';
      } else {
        completed.forEach(function (a) {
          var matchedRx = rxs.filter(function (r) { return r.appointment_id === a.id; });
          html += '<div class="card card--bordered mb-3" style="border-left-color: var(--sage);">' +
            '<div class="flex-between mb-2">' +
            '<div><strong>' + HM.format.datetime(a.scheduled_start) + '</strong>' +
            '<div class="text-xs text-muted">Doctor #' + a.doctor_id + '</div></div>' +
            HM.format.statusBadge(a.status) +
            '</div>';
          if (a.notes) html += '<p class="text-sm text-muted">' + HM.format.esc(a.notes) + '</p>';

          if (matchedRx.length) {
            matchedRx.forEach(function (rx) {
              html += '<div class="mt-3" style="padding-top: var(--s-3); border-top: 1px solid var(--border);">';
              if (rx.diagnosis) html += '<div class="text-label" style="color: var(--gold);">Diagnosis · 診斷</div><p class="text-sm">' + HM.format.esc(rx.diagnosis) + '</p>';
              if (rx.items && rx.items.length) {
                var items = rx.items.map(function (i) { return i.drug_name + ' ' + i.quantity + i.unit; }).join(', ');
                html += '<div class="text-label mt-2" style="color: var(--gold);">Prescription · 處方</div><p class="text-sm text-muted">' + HM.format.esc(items) + '</p>';
              }
              if (rx.instructions) html += '<div class="text-label mt-2" style="color: var(--gold);">Instructions · 醫囑</div><p class="text-sm text-muted">' + HM.format.esc(rx.instructions) + '</p>';
              html += '</div>';
            });
          }
          html += '</div>';
        });
      }

      el.innerHTML = html;
    } catch (e) {
      HM.state.error(el, e);
    }
  }

  function summaryCell(label, value) {
    return '<div>' +
      '<div class="text-label" style="letter-spacing: 0.08em; font-size: 0.65rem;">' + label + '</div>' +
      '<div class="text-sm" style="color: var(--ink); margin-top: var(--s-1);">' + HM.format.esc(value) + '</div>' +
      '</div>';
  }

  HM.patientPanels.health = { render: render };
})();
