/**
 * HansMed Doctor Workspace Wiring
 * --------------------------------
 * Replaces demo data in doctor page with real API data.
 * Wires: appointment queue, consultation form, prescription issuance, earnings.
 */
(function () {
  'use strict';
  var A = window.HansMedAPI;
  if (!A) return;

  // ── Override doctor panel switching ──
  var _orig = window.showDoctorPanel;
  window.showDoctorPanel = function (id, btn) {
    if (typeof _orig === 'function') _orig(id, btn);
    if (id === 'doc-dash' || id === 'doc-dashboard') loadDocDashboard();
    if (id === 'doc-queue') loadDocQueue();
    if (id === 'doc-earnings') loadDocEarnings();
  };

  // ── Auto-load on doctor page ──
  var _origShowPage = window.showPage;
  window.showPage = function (p) {
    if (typeof _origShowPage === 'function') _origShowPage(p);
    if (p === 'doctor') loadDocDashboard();
  };

  // ── Dashboard ──
  async function loadDocDashboard() {
    try {
      var res = await A.doctor.listAppointments();
      var appts = res.data || [];
      var today = new Date().toDateString();
      var todayAppts = appts.filter(function (a) { return new Date(a.scheduled_start).toDateString() === today; });
      var confirmed = appts.filter(function (a) { return a.status === 'confirmed'; }).length;
      var completed = appts.filter(function (a) { return a.status === 'completed'; }).length;

      // Update stat cards if they exist
      var statCards = document.querySelectorAll('#page-doctor .stat-card-num, #page-doctor .ph-stat-num');
      if (statCards.length >= 3) {
        statCards[0].textContent = todayAppts.length;
        statCards[1].textContent = confirmed;
        statCards[2].textContent = completed;
      }
    } catch {}
  }

  // ── Patient Queue ──
  async function loadDocQueue() {
    try {
      var res = await A.doctor.listAppointments('status=confirmed');
      var items = res.data || [];
      var el = document.querySelector('#doc-queue .queue-list, #doc-queue');
      if (!el) return;

      if (!items.length) return; // Keep prototype data if no real data

      var html = '<h3>Patient Queue · 候診名單</h3>'
        + '<div class="sub-label">Today\'s confirmed appointments · 今日已確認預約</div>';
      html += items.map(function (a) {
        var d = new Date(a.scheduled_start);
        var time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        return '<div class="health-record-card">'
          + '<div class="hrc-icon">👤</div>'
          + '<div><div class="hrc-title">Patient #' + a.patient_id + '</div>'
          + '<div class="hrc-val">' + time + ' · RM ' + parseFloat(a.fee).toFixed(0) + ' · ' + a.status + '</div></div>'
          + '<div style="display:flex;gap:.5rem;">'
          + '<button class="ph-btn" onclick="startConsultation(' + a.id + ')">Start · 開始</button>'
          + '</div></div>';
      }).join('');
      el.innerHTML = html;
    } catch {}
  }

  // ── Start Consultation ──
  window.startConsultation = async function (appointmentId) {
    try {
      await A.doctor.startAppointment(appointmentId);
      showToast('Consultation started · 問診已開始');
      // Open consultation modal or workspace
      window._currentConsultApptId = appointmentId;
      showConsultForm(appointmentId);
    } catch (e) { showToast(e.message || 'Failed to start'); }
  };

  function showConsultForm(appointmentId) {
    // Create a simple consultation form modal
    var existing = document.getElementById('consult-form-modal');
    if (existing) existing.remove();

    var html = ''
      + '<div id="consult-form-modal" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:998;display:flex;align-items:center;justify-content:center;">'
      + '<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);" onclick="closeConsultForm()"></div>'
      + '<div style="position:relative;background:var(--cream);max-width:700px;width:95%;padding:2.5rem;border:1px solid var(--mist);max-height:90vh;overflow-y:auto;">'
      + '<button onclick="closeConsultForm()" style="position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--stone);">✕</button>'
      + '<h3>Consultation · 問診</h3>'
      + '<div class="sub-label">Appointment #' + appointmentId + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin:1.5rem 0;">'
      + '  <div><label style="font-size:.68rem;letter-spacing:.12em;color:var(--gold);text-transform:uppercase;">TCM Diagnosis · 中醫診斷</label><textarea id="cf-diagnosis" rows="3" style="width:100%;padding:.5rem;border:1px solid var(--mist);background:var(--washi);outline:none;font-size:.9rem;" placeholder="e.g. Qi-Blood Deficiency · 氣血兩虛"></textarea></div>'
      + '  <div><label style="font-size:.68rem;letter-spacing:.12em;color:var(--gold);text-transform:uppercase;">Instructions · 醫囑</label><textarea id="cf-instructions" rows="3" style="width:100%;padding:.5rem;border:1px solid var(--mist);background:var(--washi);outline:none;font-size:.9rem;" placeholder="e.g. Avoid cold foods, rest adequately · 忌生冷，充分休息"></textarea></div>'
      + '</div>'
      + '<div style="font-size:.68rem;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);margin-bottom:.5rem;">Prescription Items · 處方藥材</div>'
      + '<div id="cf-rx-items">'
      + rxItemRow(0)
      + '</div>'
      + '<button class="ph-btn-outline" style="margin:.5rem 0 1.5rem;" onclick="addRxItem()">+ Add Item · 新增藥材</button>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;">'
      + '  <div><label style="font-size:.68rem;letter-spacing:.12em;color:var(--gold);text-transform:uppercase;">Duration (days) · 療程天數</label><input id="cf-duration" type="number" value="7" style="width:100%;padding:.5rem;border:1px solid var(--mist);background:var(--washi);outline:none;"></div>'
      + '</div>'
      + '<div style="display:flex;gap:.8rem;">'
      + '  <button class="btn-primary" onclick="submitConsultForm(' + appointmentId + ')">Complete & Issue Prescription · 完成並開立處方</button>'
      + '  <button class="btn-outline" onclick="completeWithoutRx(' + appointmentId + ')">Complete (No Rx) · 完成（無處方）</button>'
      + '</div>'
      + '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
  }

  var _rxItemCount = 1;
  function rxItemRow(idx) {
    return '<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:.5rem;margin-bottom:.5rem;">'
      + '<input class="cf-drug" placeholder="Drug name · 藥名 (e.g. 黃芪 Astragalus)" style="padding:.5rem;border:1px solid var(--mist);background:var(--washi);outline:none;font-size:.85rem;">'
      + '<input class="cf-qty" type="number" placeholder="Qty · 劑量" value="10" style="padding:.5rem;border:1px solid var(--mist);background:var(--washi);outline:none;">'
      + '<input class="cf-unit" placeholder="Unit · 單位" value="g" style="padding:.5rem;border:1px solid var(--mist);background:var(--washi);outline:none;">'
      + '</div>';
  }

  window.addRxItem = function () {
    var container = document.getElementById('cf-rx-items');
    if (container) container.insertAdjacentHTML('beforeend', rxItemRow(_rxItemCount++));
  };

  window.closeConsultForm = function () {
    var el = document.getElementById('consult-form-modal');
    if (el) el.remove();
  };

  window.submitConsultForm = async function (appointmentId) {
    var diagnosis = document.getElementById('cf-diagnosis').value;
    var instructions = document.getElementById('cf-instructions').value;
    var duration = parseInt(document.getElementById('cf-duration').value) || 7;

    var drugs = document.querySelectorAll('.cf-drug');
    var qtys = document.querySelectorAll('.cf-qty');
    var units = document.querySelectorAll('.cf-unit');
    var items = [];
    for (var i = 0; i < drugs.length; i++) {
      var name = drugs[i].value.trim();
      if (name) {
        items.push({ drug_name: name, quantity: parseFloat(qtys[i].value) || 1, unit: units[i].value || 'g' });
      }
    }

    if (!items.length) { showToast('Add at least one prescription item · 請至少新增一項藥材'); return; }

    try {
      await A.doctor.issuePrescription({
        appointment_id: appointmentId,
        diagnosis: diagnosis,
        instructions: instructions,
        duration_days: duration,
        items: items,
      });
      await A.doctor.completeAppointment(appointmentId);
      showToast('Consultation completed & prescription issued! · 問診完成，處方已開立 ✓');
      closeConsultForm();
      loadDocQueue();
    } catch (e) { showToast(e.message || 'Failed to submit'); }
  };

  window.completeWithoutRx = async function (appointmentId) {
    try {
      await A.doctor.completeAppointment(appointmentId);
      showToast('Consultation completed · 問診已完成 ✓');
      closeConsultForm();
      loadDocQueue();
    } catch (e) { showToast(e.message || 'Failed to complete'); }
  };

  // ── Earnings ──
  async function loadDocEarnings() {
    try {
      var res = await A.doctor.getEarnings();
      // Update earnings display if panel exists
      var el = document.querySelector('#doc-earnings, [data-panel="doc-earnings"]');
      if (!el) return;
      el.innerHTML = ''
        + '<h3>Earnings · 收入</h3>'
        + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:1.5rem 0;">'
        + '<div class="ph-stat"><div class="ph-stat-num">RM ' + parseFloat(res.gross_revenue || 0).toFixed(2) + '</div><div class="ph-stat-label">Gross · 總收入</div></div>'
        + '<div class="ph-stat"><div class="ph-stat-num">RM ' + parseFloat(res.net_earnings || 0).toFixed(2) + '</div><div class="ph-stat-label">Net · 淨收入</div></div>'
        + '<div class="ph-stat"><div class="ph-stat-num">RM ' + parseFloat(res.available_balance || 0).toFixed(2) + '</div><div class="ph-stat-label">Available · 可提取</div></div>'
        + '</div>';
    } catch {}
  }

  console.log('[HansMed] Doctor wire loaded');
})();
