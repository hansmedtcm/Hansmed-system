/**
 * Consultation Workspace — split view with Jitsi + notes + prescription pad
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  var rxItems = [];
  var currentAppt = null;

  async function render(el, appointmentId) {
    HM.state.loading(el);
    try {
      var apptRes = await HM.api.doctor.getAppointment(appointmentId);
      currentAppt = apptRes.appointment;
      // Start appointment if confirmed
      if (currentAppt.status === 'confirmed') {
        try { await HM.api.doctor.startAppointment(appointmentId); } catch {}
      }

      // Build Jitsi URL
      var tokenRes = await HM.api.consultation.joinToken(appointmentId);
      var rtc = tokenRes.rtc;
      var user = HM.auth.user();
      var displayName = HM.auth.displayName(user);
      var roomName = rtc.channel || ('HansMed-Consult-' + appointmentId);
      var jitsiUrl = 'https://' + HM.config.JITSI_DOMAIN + '/' + encodeURIComponent(roomName) +
        '#userInfo.displayName="' + encodeURIComponent(displayName) + '"&config.prejoinPageEnabled=false';

      rxItems = [];

      el.innerHTML = '<div class="page-header">' +
        '<button class="btn btn--ghost" onclick="HM.doctorPanels.consult._back()">← Back</button>' +
        '<h1 class="page-title mt-2">Consultation — Patient #' + currentAppt.patient_id + '</h1>' +
        '<p class="page-subtitle">' + HM.format.datetime(currentAppt.scheduled_start) + '</p>' +
        '</div>' +
        '<div class="grid-2" style="grid-template-columns: 1fr 420px; gap: var(--s-4);">' +
        '<div><div style="aspect-ratio: 16/9; background: var(--ink); border-radius: var(--r-md); overflow: hidden;">' +
        '<iframe src="' + HM.format.esc(jitsiUrl) + '" style="width:100%;height:100%;border:none;" allow="camera;microphone;display-capture;autoplay"></iframe>' +
        '</div></div>' +
        '<div id="consult-side">' + sidebar() + '</div>' +
        '</div>' +
        '<div class="flex flex-gap-3 mt-4" style="justify-content: flex-end;">' +
        '<button class="btn btn--outline" id="issue-only">Complete (No Rx) · 完成（無處方）</button>' +
        '<button class="btn btn--primary" id="issue-rx">Complete & Issue Rx · 完成並開處方</button>' +
        '</div>';

      wireSidebar();
      document.getElementById('issue-only').addEventListener('click', function () { completeConsult(false); });
      document.getElementById('issue-rx').addEventListener('click', function () { completeConsult(true); });
    } catch (e) { HM.state.error(el, e); }
  }

  function sidebar() {
    return '<div class="card" style="padding: var(--s-4); height: 100%;">' +
      '<div class="tabs">' +
      '<button class="tab is-active" data-tab="notes">Notes · 記錄</button>' +
      '<button class="tab" data-tab="rx">Prescription · 處方</button>' +
      '</div>' +
      '<div class="tab-panel is-active" data-panel="notes">' +
      '<div class="field"><label class="field-label">Diagnosis · 診斷</label><textarea id="cs-dx" class="field-input" rows="2" placeholder="e.g. Qi-Blood Deficiency · 氣血兩虛"></textarea></div>' +
      '<div class="field"><label class="field-label">Clinical Notes · 臨床記錄</label><textarea id="cs-notes" class="field-input" rows="6"></textarea></div>' +
      '<div class="field"><label class="field-label">Instructions · 醫囑</label><textarea id="cs-inst" class="field-input" rows="3"></textarea></div>' +
      '</div>' +
      '<div class="tab-panel" data-panel="rx">' +
      '<div id="rx-items-list" class="mb-3"></div>' +
      '<div class="card" style="padding: var(--s-3);">' +
      '<div class="text-label mb-2">Add Item · 新增藥材</div>' +
      '<div class="grid-2" style="gap: var(--s-2);">' +
      '<input id="rx-drug" class="field-input field-input--boxed" placeholder="Drug name · 藥名">' +
      '<input id="rx-qty" class="field-input field-input--boxed" type="number" placeholder="Qty" value="10">' +
      '</div>' +
      '<div class="grid-2 mt-2" style="gap: var(--s-2);">' +
      '<input id="rx-unit" class="field-input field-input--boxed" placeholder="Unit" value="g">' +
      '<input id="rx-freq" class="field-input field-input--boxed" placeholder="Frequency · 用法">' +
      '</div>' +
      '<button class="btn btn--outline btn--sm btn--block mt-2" id="rx-add">+ Add</button>' +
      '</div>' +
      '<div class="field mt-3"><label class="field-label">Duration (days) · 療程</label><input id="rx-days" class="field-input field-input--boxed" type="number" value="7"></div>' +
      '</div></div>';
  }

  function wireSidebar() {
    var tabs = document.querySelectorAll('#consult-side .tab');
    var panels = document.querySelectorAll('#consult-side .tab-panel');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { x.classList.remove('is-active'); });
        panels.forEach(function (p) { p.classList.remove('is-active'); });
        t.classList.add('is-active');
        document.querySelector('#consult-side [data-panel="' + t.getAttribute('data-tab') + '"]').classList.add('is-active');
      });
    });
    document.getElementById('rx-add').addEventListener('click', addRxItem);
    renderRxList();
  }

  function addRxItem() {
    var name = document.getElementById('rx-drug').value.trim();
    var qty = parseFloat(document.getElementById('rx-qty').value) || 0;
    var unit = document.getElementById('rx-unit').value.trim() || 'g';
    var freq = document.getElementById('rx-freq').value.trim();
    if (!name || !qty) { HM.ui.toast('Enter drug name and quantity', 'warning'); return; }
    rxItems.push({ drug_name: name, quantity: qty, unit: unit, frequency: freq });
    document.getElementById('rx-drug').value = '';
    document.getElementById('rx-freq').value = '';
    renderRxList();
  }

  function renderRxList() {
    var container = document.getElementById('rx-items-list');
    if (!container) return;
    if (!rxItems.length) {
      container.innerHTML = '<p class="text-muted text-sm text-center" style="padding: var(--s-3);">No items added yet</p>';
      return;
    }
    container.innerHTML = rxItems.map(function (it, i) {
      return '<div class="flex-between mb-2" style="padding: var(--s-2); background: var(--washi); border-radius: var(--r-sm);">' +
        '<div><strong>' + HM.format.esc(it.drug_name) + '</strong> · ' + it.quantity + it.unit + (it.frequency ? ' · ' + HM.format.esc(it.frequency) : '') + '</div>' +
        '<button class="btn btn--ghost btn--sm" onclick="HM.doctorPanels.consult._removeItem(' + i + ')">✕</button>' +
        '</div>';
    }).join('');
  }

  async function completeConsult(withRx) {
    var diagnosis = document.getElementById('cs-dx').value;
    var notes = document.getElementById('cs-notes').value;
    var instructions = document.getElementById('cs-inst').value;
    var days = parseInt(document.getElementById('rx-days').value) || 7;

    if (withRx && !rxItems.length) {
      HM.ui.toast('Add at least one prescription item', 'warning');
      return;
    }

    try {
      // Save consultation notes
      try {
        await HM.api.consultation.finish(currentAppt.id, {
          duration_seconds: 0,
          doctor_notes: notes,
        });
      } catch {}

      // Issue prescription if requested
      if (withRx) {
        await HM.api.doctor.issuePrescription({
          appointment_id: currentAppt.id,
          diagnosis: diagnosis,
          instructions: instructions,
          duration_days: days,
          items: rxItems,
        });
      }

      // Complete appointment
      await HM.api.doctor.completeAppointment(currentAppt.id);

      HM.ui.toast('Consultation completed · 問診完成', 'success');
      setTimeout(function () { location.hash = '#/queue'; }, 800);
    } catch (e) {
      HM.ui.toast(e.message || 'Failed to complete', 'danger');
    }
  }

  HM.doctorPanels.consult = {
    render: render,
    _removeItem: function (i) { rxItems.splice(i, 1); renderRxList(); },
    _back: function () {
      HM.ui.confirm('Exit consultation without saving? · 未保存就退出？', { danger: true }).then(function (ok) {
        if (ok) location.hash = '#/queue';
      });
    },
  };
})();
