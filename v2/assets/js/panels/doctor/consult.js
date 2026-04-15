/**
 * Consultation Workspace — supports both online video and walk-in visits.
 *
 *   ONLINE   : Jitsi iframe (left) + tabbed sidebar (right)
 *   WALK-IN  : Full-width tabbed case-record view (no video)
 *
 * Sidebar tabs: Case Record · Treatments · Prescription.
 * Prescription items are inline-editable — change qty/unit/frequency any
 * time, no need to remove and re-add.
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  // Default treatment types (list is editable by admin via Settings → system_configs)
  var DEFAULT_TREATMENT_TYPES = [
    { key: 'acupuncture', icon: '📍', name: 'Acupuncture', name_zh: '針灸', has_points: true },
    { key: 'moxibustion', icon: '🔥', name: 'Moxibustion', name_zh: '艾灸', has_points: true },
    { key: 'cupping',     icon: '🫙', name: 'Cupping',     name_zh: '拔罐', has_points: true },
    { key: 'tuina',       icon: '👐', name: 'Tuina',       name_zh: '推拿', has_points: false },
    { key: 'guasha',      icon: '🪮', name: 'Gua Sha',     name_zh: '刮痧', has_points: false },
    { key: 'ear_seeds',   icon: '🌰', name: 'Ear Seeds',   name_zh: '耳針', has_points: true },
  ];

  var state = {
    appt: null,
    isWalkIn: false,
    rxItems: [],
    treatments: [],
    caseRecord: {},
    treatmentTypes: DEFAULT_TREATMENT_TYPES,
  };

  async function render(el, appointmentId) {
    HM.state.loading(el);
    try {
      // Load treatment types config (falls back to defaults if unavailable)
      loadTreatmentTypes();

      // 1. Load the appointment. For pool appointments the getAppointment
      //    endpoint may 404 — in that case claim it first.
      var apptRes = null;
      try {
        apptRes = await HM.api.doctor.getAppointment(appointmentId);
      } catch (e) {
        if (e.status === 404) {
          try { await HM.api.post('/doctor/pool/' + appointmentId + '/pick'); } catch (_) {}
          apptRes = await HM.api.doctor.getAppointment(appointmentId);
        } else { throw e; }
      }
      state.appt = apptRes.appointment;
      state.isWalkIn = (state.appt.visit_type === 'walk_in');
      state.rxItems = [];
      state.treatments = [];
      state.caseRecord = {};

      // 2. Start the appointment
      try { await HM.api.doctor.startAppointment(appointmentId); } catch (_) {}

      // 3. Choose view
      if (state.isWalkIn) {
        renderWalkIn(el);
      } else {
        await renderOnline(el, appointmentId);
      }
    } catch (e) { HM.state.error(el, e); }
  }

  // ── ONLINE (video) view ────────────────────────────────────
  async function renderOnline(el, appointmentId) {
    var tokenRes = { rtc: {} };
    try { tokenRes = await HM.api.consultation.joinToken(appointmentId); } catch (_) {}

    var rtc = tokenRes.rtc || {};
    var user = HM.auth.user();
    var displayName = HM.auth.displayName(user);
    var roomName = rtc.channel || ('HansMed-Consult-' + appointmentId);
    var jitsiUrl = 'https://' + HM.config.JITSI_DOMAIN + '/' + encodeURIComponent(roomName) +
      '#userInfo.displayName="' + encodeURIComponent(displayName) + '"&config.prejoinPageEnabled=false';

    el.innerHTML = header() +
      '<div class="consult-layout consult-layout--online">' +
      '<div><div class="consult-video">' +
      '<iframe src="' + HM.format.esc(jitsiUrl) + '" style="width:100%;height:100%;border:none;" allow="camera;microphone;display-capture;autoplay"></iframe>' +
      '</div></div>' +
      '<div id="consult-side">' + sidebarMarkup() + '</div>' +
      '</div>' +
      footerActions();

    injectStyle();
    wireSidebar();
    wireActions();
  }

  // ── WALK-IN view (no video, full-width case record) ────────
  function renderWalkIn(el) {
    el.innerHTML = header() +
      '<div class="alert alert--info mb-3"><div class="alert-icon">🏥</div><div class="alert-body">' +
      '<strong>Walk-in Visit · 臨診</strong> — In-person consultation. Video is not needed; record your findings in the case record below and log any treatments you perform.' +
      '</div></div>' +
      '<div class="consult-layout consult-layout--walkin">' +
      '<div id="consult-side">' + sidebarMarkup() + '</div>' +
      '</div>' +
      footerActions();

    injectStyle();
    wireSidebar();
    wireActions();
  }

  // ── Header ─────────────────────────────────────────────────
  function header() {
    var visitBadge = state.isWalkIn
      ? '<span class="badge" style="background:rgba(184,150,90,.15);color:var(--gold);">🏥 Walk-in · 臨診</span>'
      : '<span class="badge" style="background:rgba(74,144,217,.15);color:#4a90d9;">📹 Online · 線上</span>';
    return '<div class="page-header">' +
      '<button class="btn btn--ghost" onclick="HM.doctorPanels.consult._back()">← Back</button>' +
      '<h1 class="page-title mt-2">Consultation — Patient #' + state.appt.patient_id + '</h1>' +
      '<div class="flex gap-2 mt-1" style="align-items:center;">' +
      visitBadge +
      '<span class="text-sm text-muted">' + HM.format.datetime(state.appt.scheduled_start) + '</span>' +
      '</div></div>';
  }

  // ── Sidebar tabs ───────────────────────────────────────────
  function sidebarMarkup() {
    return '<div class="card" style="padding: var(--s-4);">' +
      '<div class="tabs">' +
      '<button class="tab is-active" data-tab="case">📋 Case Record · 病歷</button>' +
      '<button class="tab" data-tab="tx">💉 Treatments · 治療</button>' +
      '<button class="tab" data-tab="rx">💊 Prescription · 處方</button>' +
      '</div>' +

      // ── CASE RECORD TAB ──
      '<div class="tab-panel is-active" data-panel="case">' +
      caseRecordMarkup() +
      '</div>' +

      // ── TREATMENTS TAB ──
      '<div class="tab-panel" data-panel="tx">' +
      treatmentsMarkup() +
      '</div>' +

      // ── PRESCRIPTION TAB ──
      '<div class="tab-panel" data-panel="rx">' +
      prescriptionMarkup() +
      '</div>' +
      '</div>';
  }

  // ── Case Record template ──────────────────────────────────
  function caseRecordMarkup() {
    return '<div class="field-grid field-grid--2">' +
      '<div class="field"><label class="field-label">Chief Complaint · 主訴</label>' +
      '<textarea id="cr-chief" class="field-input" rows="2" placeholder="Primary reason for visit"></textarea></div>' +
      '<div class="field"><label class="field-label">Duration · 病程</label>' +
      '<input id="cr-duration" class="field-input field-input--boxed" placeholder="e.g. 3 days, 2 weeks"></div>' +
      '</div>' +

      '<div class="field"><label class="field-label">Present Illness · 現病史</label>' +
      '<textarea id="cr-present" class="field-input" rows="3" placeholder="Onset, progression, aggravating/relieving factors"></textarea></div>' +

      '<div class="field"><label class="field-label">Past History · 既往史</label>' +
      '<textarea id="cr-past" class="field-input" rows="2" placeholder="Previous illnesses, surgeries, allergies, current meds"></textarea></div>' +

      '<div class="text-label mt-3 mb-2">四診 · Four Examinations</div>' +
      '<div class="field-grid field-grid--2">' +
      '<div class="field"><label class="field-label">望 Inspection · 望</label>' +
      '<textarea id="cr-inspect" class="field-input" rows="2" placeholder="Tongue, complexion, spirit, body shape"></textarea></div>' +
      '<div class="field"><label class="field-label">聞 Auscultation · 聞</label>' +
      '<textarea id="cr-listen" class="field-input" rows="2" placeholder="Voice, breathing, smells"></textarea></div>' +
      '<div class="field"><label class="field-label">問 Inquiry · 問</label>' +
      '<textarea id="cr-inquiry" class="field-input" rows="2" placeholder="Sleep, appetite, bowels, urination, thirst, sweating"></textarea></div>' +
      '<div class="field"><label class="field-label">切 Pulse · 切 (脈診)</label>' +
      '<input id="cr-pulse" class="field-input field-input--boxed" placeholder="e.g. 左:弦 / 右:滑 Left: wiry / Right: slippery"></div>' +
      '</div>' +

      '<div class="field-grid field-grid--2 mt-3">' +
      '<div class="field"><label class="field-label">Pattern Diagnosis · 辨證</label>' +
      '<input id="cr-pattern" class="field-input field-input--boxed" placeholder="e.g. 氣血兩虛 Qi-Blood Deficiency"></div>' +
      '<div class="field"><label class="field-label">Western Dx (if any) · 西醫診斷</label>' +
      '<input id="cr-western" class="field-input field-input--boxed" placeholder="ICD/clinical diagnosis"></div>' +
      '</div>' +

      '<div class="field"><label class="field-label">Treatment Principle · 治法</label>' +
      '<input id="cr-principle" class="field-input field-input--boxed" placeholder="e.g. 補氣養血 Tonify Qi and nourish Blood"></div>' +

      '<div class="field"><label class="field-label">Doctor\'s Instructions · 醫囑</label>' +
      '<textarea id="cr-inst" class="field-input" rows="2" placeholder="Diet, rest, follow-up timing, warnings"></textarea></div>';
  }

  // ── Treatments panel ─────────────────────────────────────
  function treatmentsMarkup() {
    return '<div class="text-xs text-muted mb-3">Log any treatments you perform today. Add multiple if applicable. ' +
      '<span style="font-family: var(--font-zh);">記錄本次所執行的治療項目，可多項。</span></div>' +

      '<div id="tx-list"></div>' +

      '<div class="flex gap-2 flex-wrap mt-3" id="tx-add-row">' +
      state.treatmentTypes.map(function (t) {
        return '<button type="button" class="btn btn--outline btn--sm" data-tx-add="' + t.key + '">+ ' + t.icon + ' ' + t.name + ' · ' + t.name_zh + '</button>';
      }).join('') +
      '</div>';
  }

  // ── Prescription panel ───────────────────────────────────
  function prescriptionMarkup() {
    return '<div class="field-grid field-grid--2">' +
      '<div class="field"><label class="field-label">Duration (days) · 療程</label>' +
      '<input id="rx-days" class="field-input field-input--boxed" type="number" value="7" min="1" max="90"></div>' +
      '<div class="field"><label class="field-label">Usage · 用法</label>' +
      '<input id="rx-usage" class="field-input field-input--boxed" placeholder="e.g. 每日2次，水煎 Twice daily, decoct"></div>' +
      '</div>' +

      '<div class="text-label mt-3 mb-2">Herb Items · 藥材清單</div>' +
      '<div id="rx-items-list" class="mb-3"></div>' +

      '<button class="btn btn--outline btn--sm" id="rx-add-row">+ Add Herb · 新增藥材</button>';
  }

  // ── Wire sidebar tabs + content ──────────────────────────
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

    // Treatment add buttons
    document.querySelectorAll('[data-tx-add]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        addTreatment(btn.getAttribute('data-tx-add'));
      });
    });

    // Prescription add row
    document.getElementById('rx-add-row').addEventListener('click', function () {
      state.rxItems.push({ drug_name: '', quantity: 10, unit: 'g', frequency: '', specification: '' });
      renderRxList();
    });

    renderRxList();
    renderTreatments();
  }

  // ── Treatment log rendering / editing ────────────────────
  function addTreatment(typeKey) {
    var t = state.treatmentTypes.find(function (x) { return x.key === typeKey; });
    if (!t) return;
    state.treatments.push({
      type: typeKey,
      name: t.name,
      name_zh: t.name_zh,
      icon: t.icon,
      points: '',
      duration_min: 20,
      notes: '',
    });
    renderTreatments();
  }

  function renderTreatments() {
    var host = document.getElementById('tx-list');
    if (!host) return;
    if (!state.treatments.length) {
      host.innerHTML = '<div class="card" style="padding: var(--s-3);"><p class="text-muted text-xs text-center">No treatments logged yet. Click a button below to add. · 尚未記錄治療，請點擊下方按鈕新增。</p></div>';
      return;
    }
    host.innerHTML = '';
    state.treatments.forEach(function (t, idx) {
      var meta = state.treatmentTypes.find(function (x) { return x.key === t.type; }) || {};
      var card = document.createElement('div');
      card.className = 'card mb-2';
      card.style.padding = 'var(--s-3)';
      card.innerHTML = '<div class="flex-between mb-2">' +
        '<strong>' + (t.icon || meta.icon || '💉') + ' ' + HM.format.esc(t.name) + ' · ' + HM.format.esc(t.name_zh || '') + '</strong>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-tx-remove="' + idx + '">✕</button>' +
        '</div>' +
        (meta.has_points ?
          '<div class="field" style="margin-bottom: 6px;"><label class="text-xs text-muted">Points / Sites · 穴位/部位</label>' +
          '<input data-tx-field="points" data-tx-idx="' + idx + '" class="field-input field-input--boxed" value="' + HM.format.esc(t.points || '') + '" placeholder="e.g. ST36 足三里, LI4 合谷, Ren6 氣海" style="margin:0;padding:6px 10px;"></div>'
          : '') +
        '<div class="field-grid field-grid--2" style="gap: 6px;">' +
        '<div><label class="text-xs text-muted">Duration (min) · 時長</label>' +
        '<input data-tx-field="duration_min" data-tx-idx="' + idx + '" type="number" class="field-input field-input--boxed" value="' + (t.duration_min || 20) + '" style="margin:0;padding:6px 10px;"></div>' +
        '<div><label class="text-xs text-muted">Notes · 備註</label>' +
        '<input data-tx-field="notes" data-tx-idx="' + idx + '" class="field-input field-input--boxed" value="' + HM.format.esc(t.notes || '') + '" placeholder="Technique, response, anything noteworthy" style="margin:0;padding:6px 10px;"></div>' +
        '</div>';

      card.querySelector('[data-tx-remove]').addEventListener('click', function () {
        state.treatments.splice(idx, 1);
        renderTreatments();
      });

      card.querySelectorAll('[data-tx-field]').forEach(function (inp) {
        inp.addEventListener('input', function (e) {
          var i = parseInt(inp.getAttribute('data-tx-idx'), 10);
          var field = inp.getAttribute('data-tx-field');
          var val = inp.value;
          if (field === 'duration_min') val = parseInt(val, 10) || 0;
          state.treatments[i][field] = val;
        });
      });

      host.appendChild(card);
    });
  }

  // ── Rx list rendering with INLINE editing ────────────────
  function renderRxList() {
    var container = document.getElementById('rx-items-list');
    if (!container) return;
    if (!state.rxItems.length) {
      container.innerHTML = '<div class="card" style="padding: var(--s-3);"><p class="text-muted text-xs text-center">No herbs added. Click "+ Add Herb" below. · 尚未新增藥材。</p></div>';
      return;
    }
    container.innerHTML = '';
    state.rxItems.forEach(function (it, idx) {
      var row = document.createElement('div');
      row.className = 'card mb-2';
      row.style.padding = 'var(--s-3)';
      row.innerHTML =
        '<div class="flex gap-2" style="align-items:center;">' +
        '<input data-rx-field="drug_name" data-rx-idx="' + idx + '" class="field-input field-input--boxed" placeholder="Drug · 藥名" value="' + HM.format.esc(it.drug_name || '') + '" style="flex:2;margin:0;padding:6px 10px;">' +
        '<input data-rx-field="quantity" data-rx-idx="' + idx + '" type="number" step="0.1" class="field-input field-input--boxed" placeholder="Qty" value="' + (it.quantity || '') + '" style="width:70px;margin:0;padding:6px 10px;">' +
        '<input data-rx-field="unit" data-rx-idx="' + idx + '" class="field-input field-input--boxed" placeholder="Unit" value="' + HM.format.esc(it.unit || 'g') + '" style="width:60px;margin:0;padding:6px 10px;">' +
        '<button type="button" class="btn btn--ghost btn--sm" data-rx-remove="' + idx + '">✕</button>' +
        '</div>' +
        '<div class="flex gap-2 mt-2">' +
        '<input data-rx-field="specification" data-rx-idx="' + idx + '" class="field-input field-input--boxed" placeholder="Specification · 規格 (optional)" value="' + HM.format.esc(it.specification || '') + '" style="flex:1;margin:0;padding:6px 10px;">' +
        '<input data-rx-field="frequency" data-rx-idx="' + idx + '" class="field-input field-input--boxed" placeholder="Frequency · 用法 (optional)" value="' + HM.format.esc(it.frequency || '') + '" style="flex:1;margin:0;padding:6px 10px;">' +
        '</div>';

      row.querySelector('[data-rx-remove]').addEventListener('click', function () {
        state.rxItems.splice(idx, 1);
        renderRxList();
      });

      row.querySelectorAll('[data-rx-field]').forEach(function (inp) {
        inp.addEventListener('input', function () {
          var i = parseInt(inp.getAttribute('data-rx-idx'), 10);
          var field = inp.getAttribute('data-rx-field');
          var val = inp.value;
          if (field === 'quantity') val = parseFloat(val) || 0;
          state.rxItems[i][field] = val;
        });
      });

      container.appendChild(row);
    });
  }

  // ── Footer action buttons ────────────────────────────────
  function footerActions() {
    return '<div class="flex flex-gap-3 mt-4" style="justify-content: flex-end;">' +
      '<button class="btn btn--outline" id="issue-only">Complete (No Rx) · 完成（無處方）</button>' +
      '<button class="btn btn--primary" id="issue-rx">Complete &amp; Issue Rx · 完成並開處方</button>' +
      '</div>';
  }

  function wireActions() {
    document.getElementById('issue-only').addEventListener('click', function () { completeConsult(false); });
    document.getElementById('issue-rx').addEventListener('click', function () { completeConsult(true); });
  }

  // ── Complete ──────────────────────────────────────────────
  async function completeConsult(withRx) {
    var caseRecord = {
      chief_complaint:    val('cr-chief'),
      duration:           val('cr-duration'),
      present_illness:    val('cr-present'),
      past_history:       val('cr-past'),
      inspection:         val('cr-inspect'),
      auscultation:       val('cr-listen'),
      inquiry:            val('cr-inquiry'),
      pulse:              val('cr-pulse'),
      pattern_diagnosis:  val('cr-pattern'),
      western_diagnosis:  val('cr-western'),
      treatment_principle: val('cr-principle'),
      doctor_instructions: val('cr-inst'),
    };

    // Clean up Rx items — drop any row missing drug_name or quantity
    var cleanRx = state.rxItems.filter(function (it) { return it.drug_name && (it.quantity > 0); });
    if (withRx && !cleanRx.length) {
      HM.ui.toast('Add at least one herb (name + quantity) · 至少新增一項藥材', 'warning');
      return;
    }

    var days = parseInt(document.getElementById('rx-days') ? document.getElementById('rx-days').value : '7', 10) || 7;
    var usage = val('rx-usage');

    try {
      await HM.api.consultation.finish(state.appt.id, {
        duration_seconds: 0,
        doctor_notes:     caseRecord.doctor_instructions || '',
        case_record:      caseRecord,
        treatments:       state.treatments,
      });

      if (withRx) {
        await HM.api.doctor.issuePrescription({
          appointment_id: state.appt.id,
          diagnosis:      caseRecord.pattern_diagnosis || '',
          instructions:   (caseRecord.doctor_instructions || '') + (usage ? '\n用法: ' + usage : ''),
          duration_days:  days,
          items:          cleanRx,
        });
      }

      await HM.api.doctor.completeAppointment(state.appt.id);
      HM.ui.toast('Consultation completed · 問診完成', 'success');
      setTimeout(function () { location.hash = '#/queue'; }, 800);
    } catch (e) {
      HM.ui.toast(e.message || 'Failed to complete', 'danger');
    }
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? (el.value || '').trim() : '';
  }

  // ── Load treatment types from admin config (fallback to defaults) ──
  async function loadTreatmentTypes() {
    try {
      var res = await HM.api.get('/public/treatment-types');
      if (res && res.types && res.types.length) {
        state.treatmentTypes = res.types;
      }
    } catch (_) {
      // Use defaults
      state.treatmentTypes = DEFAULT_TREATMENT_TYPES;
    }
  }

  function injectStyle() {
    if (document.getElementById('consult-style')) return;
    var s = document.createElement('style');
    s.id = 'consult-style';
    s.textContent =
      '.consult-layout--online{display:grid;grid-template-columns:1fr 460px;gap:var(--s-4);}' +
      '@media (max-width: 980px){.consult-layout--online{grid-template-columns:1fr;}}' +
      '.consult-layout--walkin{max-width:900px;}' +
      '.consult-video{aspect-ratio:16/9;background:var(--ink);border-radius:var(--r-md);overflow:hidden;}';
    document.head.appendChild(s);
  }

  HM.doctorPanels.consult = {
    render: render,
    _back: function () {
      HM.ui.confirm('Exit consultation without saving? · 未保存就退出？', { danger: true }).then(function (ok) {
        if (ok) location.hash = '#/queue';
      });
    },
  };
})();
