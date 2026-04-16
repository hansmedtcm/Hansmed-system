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
    documents: [],   // [{ name, size, type, data_url }]
    treatmentTypes: DEFAULT_TREATMENT_TYPES,
    drugCatalog: [], // [{ name, specification, unit, total_stock, pharmacy_count }]
  };

  async function render(el, appointmentId) {
    HM.state.loading(el);
    try {
      // Load treatment types + drug catalog in the background
      loadTreatmentTypes();
      loadDrugCatalog();

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
      state.documents = [];

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

  // ── WALK-IN view (no video) ─────────────────────────────
  // Split layout: Case Record (sticky on the left) + Prescription on top-right,
  // Treatments below it. All three panels visible simultaneously — no tabs —
  // so the doctor can refer to the case record while prescribing.
  function renderWalkIn(el) {
    el.innerHTML = header() +
      '<div class="alert alert--info mb-3"><div class="alert-icon">🏥</div><div class="alert-body">' +
      '<strong>Walk-in Visit · 臨診</strong> — In-person consultation. Refer to the case record on the left while prescribing. ' +
      '<span style="font-family: var(--font-zh);">可同時參考左側病歷，於右側開處方並記錄治療。</span>' +
      '</div></div>' +

      '<div class="consult-layout consult-layout--split">' +

      // LEFT — Case Record (sticky)
      '<div class="split-left">' +
      '<div class="card card--pad-lg split-case">' +
      '<div class="split-section-head">📋 Case Record · 病歷</div>' +
      caseRecordMarkup() +
      '</div>' +
      '</div>' +

      // RIGHT — Prescription on top, Treatments below
      '<div class="split-right">' +
      '<div class="card card--pad-lg mb-4">' +
      '<div class="split-section-head">💊 Prescription · 處方</div>' +
      prescriptionMarkup() +
      '</div>' +
      '<div class="card card--pad-lg">' +
      '<div class="split-section-head">💉 Treatments · 治療</div>' +
      treatmentsMarkup() +
      '</div>' +
      '</div>' +

      '</div>' +
      footerActions();

    injectStyle();
    wireSplitPanels();
    wireActions();
  }

  // Wire handlers for the split view (no tabs — everything visible)
  function wireSplitPanels() {
    // Case Record: file upload
    var fileInput = document.getElementById('cr-files');
    if (fileInput) fileInput.addEventListener('change', handleFileUpload);

    // Body diagram
    initBodyDiagram();

    // Treatments: preset add buttons
    document.querySelectorAll('[data-tx-add]').forEach(function (btn) {
      btn.addEventListener('click', function () { addTreatment(btn.getAttribute('data-tx-add')); });
    });

    // Prescription: add-row button
    var addRow = document.getElementById('rx-add-row');
    if (addRow) addRow.addEventListener('click', function () {
      state.rxItems.push({ drug_name: '', quantity: 10, unit: 'g' });
      renderRxList();
    });

    renderRxList();
    renderTreatments();
    renderDocuments();
  }

  // ── Header ─────────────────────────────────────────────────
  function header() {
    var visitBadge = state.isWalkIn
      ? '<span class="badge" style="background:rgba(184,150,90,.15);color:var(--gold);">🏥 Walk-in · 臨診</span>'
      : '<span class="badge" style="background:rgba(74,144,217,.15);color:#4a90d9;">📹 Online · 線上</span>';
    var toggleLabel = state.isWalkIn ? 'Switch to Online · 改為線上' : 'Switch to Walk-in · 改為臨診';
    return '<div class="page-header">' +
      '<button class="btn btn--ghost" onclick="HM.doctorPanels.consult._back()">← Back</button>' +
      '<h1 class="page-title mt-2">Consultation — Patient #' + state.appt.patient_id + '</h1>' +
      '<div class="flex gap-2 mt-1" style="align-items:center;flex-wrap:wrap;">' +
      visitBadge +
      '<span class="text-sm text-muted">' + HM.format.datetime(state.appt.scheduled_start) + '</span>' +
      '<button class="btn btn--ghost btn--sm" id="toggle-visit" style="margin-left:auto;">' + toggleLabel + '</button>' +
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
  // Walk-in visits use a lean template: no duration, no inspection/
  // auscultation/inquiry, but adds vitals + file upload.
  function caseRecordMarkup() {
    var isWalkIn = state.isWalkIn;

    var topRow = isWalkIn
      ? '<div class="field-grid field-grid--3">' +
        '<div class="field" style="grid-column: span 2;"><label class="field-label">Chief Complaint · 主訴</label>' +
        '<textarea id="cr-chief" class="field-input" rows="2" placeholder="Primary reason for visit"></textarea></div>' +
        '<div class="field"><label class="field-label">Blood Pressure · 血壓</label>' +
        '<input id="cr-bp" class="field-input field-input--boxed" placeholder="e.g. 120/80"></div>' +
        '</div>'
      : '<div class="field-grid field-grid--2">' +
        '<div class="field"><label class="field-label">Chief Complaint · 主訴</label>' +
        '<textarea id="cr-chief" class="field-input" rows="2" placeholder="Primary reason for visit"></textarea></div>' +
        '<div class="field"><label class="field-label">Duration · 病程</label>' +
        '<input id="cr-duration" class="field-input field-input--boxed" placeholder="e.g. 3 days, 2 weeks"></div>' +
        '</div>';

    // Online visits get the full 四診 block; walk-ins only get pulse (they're
    // doing inspection/inquiry face-to-face and don't need text echo).
    var fourExam = isWalkIn
      ? '<div class="field"><label class="field-label">切 Pulse · 脈診</label>' +
        '<input id="cr-pulse" class="field-input field-input--boxed" placeholder="e.g. 左:弦 / 右:滑 Left: wiry / Right: slippery"></div>'
      : '<div class="text-label mt-3 mb-2">四診 · Four Examinations</div>' +
        '<div class="field-grid field-grid--2">' +
        '<div class="field"><label class="field-label">望 Inspection · 望</label>' +
        '<textarea id="cr-inspect" class="field-input" rows="2" placeholder="Tongue, complexion, spirit, body shape"></textarea></div>' +
        '<div class="field"><label class="field-label">聞 Auscultation · 聞</label>' +
        '<textarea id="cr-listen" class="field-input" rows="2" placeholder="Voice, breathing, smells"></textarea></div>' +
        '<div class="field"><label class="field-label">問 Inquiry · 問</label>' +
        '<textarea id="cr-inquiry" class="field-input" rows="2" placeholder="Sleep, appetite, bowels, urination, thirst, sweating"></textarea></div>' +
        '<div class="field"><label class="field-label">切 Pulse · 切 (脈診)</label>' +
        '<input id="cr-pulse" class="field-input field-input--boxed" placeholder="e.g. 左:弦 / 右:滑"></div>' +
        '</div>';

    // Document upload only appears for walk-in (in-person you often have
    // paper reports the patient brings in — lab, imaging, BP logs, etc.)
    var uploadBlock = isWalkIn
      ? '<div class="field mt-3">' +
        '<label class="field-label">📎 Medical Documents · 醫療文件</label>' +
        '<div class="text-xs text-muted mb-2">Upload lab reports, imaging, prescriptions from other clinics, etc. Photos or PDFs. ' +
        '<span style="font-family: var(--font-zh);">上傳化驗單、影像、外院處方等。</span></div>' +
        '<input type="file" id="cr-files" class="field-input field-input--boxed" multiple accept="image/*,.pdf,.doc,.docx" style="padding: 6px;">' +
        '<div id="cr-files-list" class="mt-2"></div>' +
        '</div>'
      : '';

    return topRow +

      '<div class="field"><label class="field-label">Present Illness · 現病史</label>' +
      '<textarea id="cr-present" class="field-input" rows="3" placeholder="Onset, progression, aggravating/relieving factors"></textarea></div>' +

      '<div class="field"><label class="field-label">Past History · 既往史</label>' +
      '<textarea id="cr-past" class="field-input" rows="2" placeholder="Previous illnesses, surgeries, allergies, current meds"></textarea></div>' +

      fourExam +

      '<div class="field-grid field-grid--2 mt-3">' +
      '<div class="field"><label class="field-label">Pattern Diagnosis · 辨證</label>' +
      '<input id="cr-pattern" class="field-input field-input--boxed" placeholder="e.g. 氣血兩虛 Qi-Blood Deficiency"></div>' +
      '<div class="field"><label class="field-label">Western Dx (if any) · 西醫診斷</label>' +
      '<input id="cr-western" class="field-input field-input--boxed" placeholder="ICD/clinical diagnosis"></div>' +
      '</div>' +

      '<div class="field"><label class="field-label">Treatment Principle · 治法</label>' +
      '<input id="cr-principle" class="field-input field-input--boxed" placeholder="e.g. 補氣養血 Tonify Qi and nourish Blood"></div>' +

      '<div class="field"><label class="field-label">Doctor\'s Instructions · 醫囑</label>' +
      '<textarea id="cr-inst" class="field-input" rows="2" placeholder="Diet, rest, follow-up timing, warnings"></textarea></div>' +

      uploadBlock +

      // Body diagram with drawing tool
      '<div class="field mt-4">' +
      '<label class="field-label">🖊️ Body Diagram · 人體圖（標記疼痛/瘀青/針灸位置）</label>' +
      '<div class="text-xs text-muted mb-2">Mark pain points, bruising, acupuncture sites, etc. Use coloured pens to differentiate. ' +
      '<span style="font-family: var(--font-zh);">標記疼痛、瘀青、針灸點等。可選擇不同顏色筆。</span></div>' +
      bodyDiagramMarkup() +
      '</div>';
  }

  // ── Body diagram (front + back silhouette + canvas overlay) ──
  function bodyDiagramMarkup() {
    return '<div class="body-diagram-wrap">' +
      '<div class="body-diagram-toolbar">' +
        '<div class="body-tool-group" id="body-pens">' +
          '<button type="button" class="body-pen body-pen--blue is-active" data-color="#1f6fb2" title="Blue pen"></button>' +
          '<button type="button" class="body-pen body-pen--red" data-color="#c0392b" title="Red pen"></button>' +
          '<button type="button" class="body-pen body-pen--green" data-color="#2e8b57" title="Green pen"></button>' +
          '<button type="button" class="body-pen body-pen--erase" data-color="erase" title="Eraser">✎̶</button>' +
        '</div>' +
        '<div class="body-tool-group">' +
          '<label class="body-thickness-label">Thickness · 粗細</label>' +
          '<input type="range" id="body-thickness" min="1" max="12" value="3" step="1">' +
          '<span class="body-thickness-value" id="body-thickness-value">3px</span>' +
        '</div>' +
        '<div class="body-tool-group" style="margin-left:auto;">' +
          '<button type="button" class="btn btn--ghost btn--sm" id="body-clear">🗑 Clear · 清除</button>' +
        '</div>' +
      '</div>' +
      '<div class="body-diagram-stage">' +
        // FRONT view
        '<div class="body-side">' +
          '<div class="body-side-label">Front · 前面</div>' +
          '<div class="body-canvas-wrap" data-side="front">' +
            bodySvg('front') +
            '<canvas class="body-canvas" data-side="front" width="280" height="612"></canvas>' +
          '</div>' +
        '</div>' +
        // BACK view
        '<div class="body-side">' +
          '<div class="body-side-label">Back · 背面</div>' +
          '<div class="body-canvas-wrap" data-side="back">' +
            bodySvg('back') +
            '<canvas class="body-canvas" data-side="back" width="280" height="612"></canvas>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '</div>';
  }

  // Anatomical body silhouette — single continuous outline path per view.
  // Matches the medical-chart reference: smooth shoulders, tapered waist,
  // clear quad/calf separation, anatomically-positioned hands.
  function bodySvg(side) {
    // Front and back share the head/torso/limb silhouette.
    // The back view adds a centre dashed spine line + a subtle gluteal curve.
    var pathFront =
      // Head + neck (rounded oval head, neck taper into trapezius)
      'M140 22 ' +
      'C158 22 173 36 173 56 ' +
      'C173 72 167 84 159 92 ' +
      'L162 105 ' +
      // Right shoulder + arm + hand
      'C190 110 215 125 222 145 ' +
      'L235 220 L240 270 L240 320 ' +
      'L237 360 L235 395 ' +
      // Right hand (thumb + fingers gently curled)
      'C238 405 244 412 244 422 ' +
      'C244 430 240 438 234 440 ' +
      'C228 442 222 438 220 430 ' +
      'L218 410 ' +
      // Right leg (hip → quad → knee → calf → ankle)
      'L210 360 L200 420 L188 510 L182 575 ' +
      'L168 590 L156 590 L150 575 ' +
      'L155 500 L153 410 ' +
      // Crotch
      'L145 365 L135 365 ' +
      'L133 410 L131 500 ' +
      // Left leg (mirror)
      'L136 575 L130 590 L118 590 L104 575 ' +
      'L98 510 L86 420 L76 360 ' +
      // Left arm + hand
      'L73 395 L71 410 ' +
      'L69 430 ' +
      'C67 438 61 442 55 440 ' +
      'C49 438 45 430 45 422 ' +
      'C45 412 51 405 54 395 ' +
      'L52 360 L49 320 ' +
      'L49 270 L54 220 L67 145 ' +
      'C74 125 99 110 127 105 ' +
      'L130 92 ' +
      'C122 84 116 72 116 56 ' +
      'C116 36 130 22 140 22 Z';

    var spine = '';
    var glutealCurve = '';
    if (side === 'back') {
      spine = '<line x1="140" y1="115" x2="140" y2="370" stroke="#aaa" stroke-width="0.7" stroke-dasharray="3 4"/>';
      // Subtle gluteal cleft (the small V at the lower back / top of buttocks in the reference image)
      glutealCurve = '<path d="M132 365 Q140 372 148 365" fill="none" stroke="#aaa" stroke-width="0.7"/>';
    }

    // Subtle facial features only on the front (gentle suggestion of a face)
    var face = side === 'front'
      ? '<g opacity="0.35" stroke="#888" stroke-width="0.5" fill="none">' +
        // Faint jawline / chin shading (skip — keeps it abstract)
        '</g>'
      : '';

    return '<svg viewBox="0 0 280 612" class="body-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="' + pathFront + '" fill="rgba(255,255,255,0.85)" stroke="#2a2a2a" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>' +
      spine +
      glutealCurve +
      face +
      '</svg>';
  }

  // ── Treatments panel ─────────────────────────────────────
  function treatmentsMarkup() {
    return '<div class="text-xs text-muted mb-3">Log any treatments you perform today. Multiple treatments per visit supported, each with adjustable fee. ' +
      '<span style="font-family: var(--font-zh);">記錄本次所執行的治療項目，可多項，每項可設定費用。</span></div>' +

      '<div id="tx-list"></div>' +

      '<div class="text-label mt-4 mb-2">+ Add Treatment · 新增治療</div>' +
      '<div class="flex gap-2 flex-wrap" id="tx-add-row">' +
      state.treatmentTypes.map(function (t) {
        return '<button type="button" class="btn btn--outline btn--sm" data-tx-add="' + t.key + '">' + t.icon + ' ' + t.name + ' · ' + t.name_zh + '</button>';
      }).join('') +
      '</div>' +

      '<div class="text-xs text-muted mt-3">Need a new treatment type? Ask admin to add it in System Settings → Walk-in Treatments. ' +
      '<span style="font-family: var(--font-zh);">需新增治療類型，請聯絡管理員於系統設定中新增。</span></div>';
  }

  // ── Prescription panel ───────────────────────────────────
  function prescriptionMarkup() {
    return '<div class="text-label mb-2">Dosage Pattern · 服用方式</div>' +
      '<div class="rx-dosage-row">' +
      '<input id="rx-packs" class="field-input field-input--boxed rx-dosage-input" type="number" min="1" value="1" title="Packs per dose">' +
      '<span class="rx-dosage-sep">×</span>' +
      '<input id="rx-times" class="field-input field-input--boxed rx-dosage-input" type="number" min="1" value="2" title="Times per day">' +
      '<span class="rx-dosage-sep">×</span>' +
      '<input id="rx-days" class="field-input field-input--boxed rx-dosage-input" type="number" min="1" max="90" value="5" title="Duration in days">' +
      '<span class="rx-dosage-hint" id="rx-dosage-hint">1 pack · 2 × day · 5 days</span>' +
      '</div>' +
      '<div class="text-xs text-muted mt-1">Pack × Times per day × Days — e.g. <code>1 × 2 × 5</code> means 1 pack per dose, twice a day, for 5 days. ' +
      '<span style="font-family: var(--font-zh);">每次服用包數 × 每日次數 × 天數。</span></div>' +

      '<div class="field mt-3"><label class="field-label">Usage Notes · 用法備註</label>' +
      '<input id="rx-usage" class="field-input field-input--boxed" placeholder="e.g. 飯後服用，水煎 After meals, decoct with water"></div>' +

      '<div class="text-label mt-4 mb-2">Herb Items · 藥材清單</div>' +
      '<div class="text-xs text-muted mb-2">Type to search pharmacy stock. ' +
      '<span style="color: var(--sage);">● in stock · 有貨</span> · ' +
      '<span style="color: var(--red-seal);">● out of stock · 缺貨</span> · ' +
      '<span style="color: var(--stone);">? not in catalog · 未上架</span></div>' +
      '<div id="rx-items-list" class="mb-2"></div>' +
      '<datalist id="rx-catalog"></datalist>' +

      '<button class="btn btn--outline btn--sm" id="rx-add-row">+ Add Herb · 新增藥材</button>' +

      // Total summary
      '<div id="rx-total" class="rx-total-box" style="display:none;">' +
      '<div class="flex-between"><span class="text-muted text-sm">Total price · 總金額</span><strong id="rx-total-price">—</strong></div>' +
      '<div class="flex-between mt-1"><span class="text-muted text-sm">Total weight · 總重</span><span id="rx-total-weight">—</span></div>' +
      '</div>';
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

    // Treatment add buttons (presets only — custom is admin-managed)
    document.querySelectorAll('[data-tx-add]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        addTreatment(btn.getAttribute('data-tx-add'));
      });
    });

    // Prescription add row
    document.getElementById('rx-add-row').addEventListener('click', function () {
      state.rxItems.push({ drug_name: '', quantity: 10, unit: 'g' });
      renderRxList();
    });

    // File upload handler (walk-in only)
    var fileInput = document.getElementById('cr-files');
    if (fileInput) {
      fileInput.addEventListener('change', handleFileUpload);
    }

    // Body diagram drawing (always present in case record)
    initBodyDiagram();

    renderRxList();
    renderTreatments();
    renderDocuments();
  }

  // ── Body diagram drawing ─────────────────────────────────
  var bodyDiagramState = { color: '#1f6fb2', thickness: 3, drawing: false, lastX: 0, lastY: 0 };

  function initBodyDiagram() {
    var pens = document.querySelectorAll('#body-pens .body-pen');
    pens.forEach(function (btn) {
      btn.addEventListener('click', function () {
        pens.forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        bodyDiagramState.color = btn.getAttribute('data-color');
      });
    });

    var thickInput = document.getElementById('body-thickness');
    var thickVal   = document.getElementById('body-thickness-value');
    if (thickInput) {
      thickInput.addEventListener('input', function () {
        bodyDiagramState.thickness = parseInt(thickInput.value, 10) || 3;
        if (thickVal) thickVal.textContent = bodyDiagramState.thickness + 'px';
      });
    }

    document.querySelectorAll('canvas.body-canvas').forEach(function (canvas) {
      var ctx = canvas.getContext('2d');
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Restore any saved data for this side (e.g. when toggling visit type)
      var side = canvas.getAttribute('data-side');
      var savedKey = 'body_' + side;
      if (state.caseRecord && state.caseRecord[savedKey]) {
        var img = new Image();
        img.onload = function () { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); };
        img.src = state.caseRecord[savedKey];
      }

      function pos(e) {
        var rect = canvas.getBoundingClientRect();
        var x = (e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX)) - rect.left;
        var y = (e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY)) - rect.top;
        // Scale CSS coords to canvas coords (in case canvas is sized via CSS)
        return [x * (canvas.width / rect.width), y * (canvas.height / rect.height)];
      }
      function start(e) {
        e.preventDefault();
        bodyDiagramState.drawing = true;
        var p = pos(e);
        bodyDiagramState.lastX = p[0]; bodyDiagramState.lastY = p[1];
      }
      function draw(e) {
        if (!bodyDiagramState.drawing) return;
        e.preventDefault();
        var p = pos(e);
        ctx.lineWidth = bodyDiagramState.thickness * (bodyDiagramState.color === 'erase' ? 4 : 1);
        if (bodyDiagramState.color === 'erase') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = 'rgba(0,0,0,1)';
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = bodyDiagramState.color;
        }
        ctx.beginPath();
        ctx.moveTo(bodyDiagramState.lastX, bodyDiagramState.lastY);
        ctx.lineTo(p[0], p[1]);
        ctx.stroke();
        bodyDiagramState.lastX = p[0]; bodyDiagramState.lastY = p[1];
      }
      function end() { bodyDiagramState.drawing = false; }

      canvas.addEventListener('mousedown', start);
      canvas.addEventListener('mousemove', draw);
      canvas.addEventListener('mouseup', end);
      canvas.addEventListener('mouseleave', end);
      canvas.addEventListener('touchstart', start, { passive: false });
      canvas.addEventListener('touchmove',  draw,  { passive: false });
      canvas.addEventListener('touchend',   end);
    });

    var clearBtn = document.getElementById('body-clear');
    if (clearBtn) clearBtn.addEventListener('click', function () {
      if (!confirm('Clear all body markings? · 清除所有標記？')) return;
      document.querySelectorAll('canvas.body-canvas').forEach(function (canvas) {
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
    });
  }

  function captureBodyDiagrams() {
    var out = {};
    document.querySelectorAll('canvas.body-canvas').forEach(function (canvas) {
      var side = canvas.getAttribute('data-side');
      try {
        // Only save if there's anything drawn (cheap check: any non-transparent pixel)
        var ctx = canvas.getContext('2d');
        var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        var hasInk = false;
        for (var i = 3; i < imgData.length; i += 4) { if (imgData[i] > 0) { hasInk = true; break; } }
        if (hasInk) out['body_' + side] = canvas.toDataURL('image/png');
      } catch (_) {}
    });
    return out;
  }

  // ── Medical Document uploads ─────────────────────────────
  function handleFileUpload(e) {
    var files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach(function (f) {
      // Cap per-file size at ~5 MB so the base64 payload stays manageable
      if (f.size > 5 * 1024 * 1024) {
        HM.ui.toast(f.name + ' is too large (max 5MB)', 'warning');
        return;
      }
      var reader = new FileReader();
      reader.onload = function (ev) {
        state.documents.push({
          name: f.name,
          size: f.size,
          type: f.type,
          data_url: ev.target.result,
        });
        renderDocuments();
      };
      reader.readAsDataURL(f);
    });
    e.target.value = ''; // reset so re-uploading same file still fires change
  }

  function renderDocuments() {
    var host = document.getElementById('cr-files-list');
    if (!host) return;
    if (!state.documents.length) {
      host.innerHTML = '<p class="text-xs text-muted" style="margin:6px 0;">No files attached yet.</p>';
      return;
    }
    host.innerHTML = state.documents.map(function (doc, i) {
      var icon = doc.type && doc.type.indexOf('image') === 0 ? '🖼️'
               : doc.type === 'application/pdf' ? '📄'
               : '📎';
      var sizeKb = (doc.size / 1024).toFixed(0);
      return '<div class="flex-between" style="padding:6px 10px;background:var(--washi);border-radius:var(--r-sm);margin-bottom:4px;font-size:var(--text-xs);">' +
        '<span>' + icon + ' ' + HM.format.esc(doc.name) + ' <span class="text-muted">(' + sizeKb + ' KB)</span></span>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-doc-remove="' + i + '" style="padding:2px 8px;">✕</button>' +
        '</div>';
    }).join('');
    host.querySelectorAll('[data-doc-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = parseInt(btn.getAttribute('data-doc-remove'), 10);
        state.documents.splice(i, 1);
        renderDocuments();
      });
    });
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
      has_points: !!t.has_points,
      points: '',
      duration_min: 20,
      fee: 0,
      notes: '',
    });
    renderTreatments();
  }


  function renderTreatments() {
    var host = document.getElementById('tx-list');
    if (!host) return;
    if (!state.treatments.length) {
      host.innerHTML = '<div class="card" style="padding: var(--s-3);"><p class="text-muted text-xs text-center">No treatments logged yet. Add from the presets below or create a custom one. · 尚未記錄治療。</p></div>';
      return;
    }

    // Running total for this visit
    var total = state.treatments.reduce(function (sum, t) { return sum + (parseFloat(t.fee) || 0); }, 0);
    var totalHtml = total > 0
      ? '<div class="flex-between" style="padding: var(--s-2) var(--s-3); background: var(--washi); border-radius: var(--r-sm); margin-bottom: var(--s-3); font-size: var(--text-sm);">' +
        '<span class="text-muted">Treatments total · 治療合計</span>' +
        '<strong style="color: var(--gold);">' + HM.format.money(total) + '</strong>' +
        '</div>'
      : '';

    host.innerHTML = totalHtml;

    state.treatments.forEach(function (t, idx) {
      var card = document.createElement('div');
      card.className = 'card mb-2';
      card.style.padding = 'var(--s-3)';
      card.innerHTML = '<div class="flex-between mb-2" style="align-items:center;">' +
        '<strong>' + (t.icon || '💉') + ' ' + HM.format.esc(t.name) + (t.name_zh ? ' · ' + HM.format.esc(t.name_zh) : '') + '</strong>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-tx-remove="' + idx + '">✕</button>' +
        '</div>' +
        (t.has_points ?
          '<div class="field" style="margin-bottom: 6px;"><label class="text-xs text-muted">Points / Sites · 穴位/部位</label>' +
          '<input data-tx-field="points" data-tx-idx="' + idx + '" class="field-input field-input--boxed" value="' + HM.format.esc(t.points || '') + '" placeholder="e.g. ST36 足三里, LI4 合谷, Ren6 氣海" style="margin:0;padding:6px 10px;"></div>'
          : '') +
        '<div class="field-grid field-grid--3" style="gap: 6px;">' +
        '<div><label class="text-xs text-muted">Duration (min) · 時長</label>' +
        '<input data-tx-field="duration_min" data-tx-idx="' + idx + '" type="number" class="field-input field-input--boxed" value="' + (t.duration_min || 20) + '" style="margin:0;padding:6px 10px;"></div>' +
        '<div><label class="text-xs text-muted">Fee (RM) · 費用</label>' +
        '<input data-tx-field="fee" data-tx-idx="' + idx + '" type="number" step="0.01" min="0" class="field-input field-input--boxed" value="' + (t.fee || 0) + '" style="margin:0;padding:6px 10px;"></div>' +
        '<div><label class="text-xs text-muted">Notes · 備註</label>' +
        '<input data-tx-field="notes" data-tx-idx="' + idx + '" class="field-input field-input--boxed" value="' + HM.format.esc(t.notes || '') + '" placeholder="Technique, response" style="margin:0;padding:6px 10px;"></div>' +
        '</div>';

      card.querySelector('[data-tx-remove]').addEventListener('click', function () {
        state.treatments.splice(idx, 1);
        renderTreatments();
      });

      card.querySelectorAll('[data-tx-field]').forEach(function (inp) {
        inp.addEventListener('input', function () {
          var i = parseInt(inp.getAttribute('data-tx-idx'), 10);
          var field = inp.getAttribute('data-tx-field');
          var val = inp.value;
          if (field === 'duration_min') val = parseInt(val, 10) || 0;
          else if (field === 'fee')     val = parseFloat(val) || 0;
          state.treatments[i][field] = val;
          // Re-render just to update the running total up top
          if (field === 'fee') renderTreatments();
        });
      });

      host.appendChild(card);
    });
  }

  // ── Rx list rendering with INLINE editing (simplified) ──
  function renderRxList() {
    var container = document.getElementById('rx-items-list');
    if (!container) return;
    if (!state.rxItems.length) {
      container.innerHTML = '<div class="card" style="padding: var(--s-3);"><p class="text-muted text-xs text-center">No herbs added. Click "+ Add Herb" below. · 尚未新增藥材。</p></div>';
      return;
    }

    // Read the dosage pattern so we can compute total grams
    var packs = parseFloat(document.getElementById('rx-packs') && document.getElementById('rx-packs').value) || 1;
    var times = parseFloat(document.getElementById('rx-times') && document.getElementById('rx-times').value) || 1;
    var days  = parseFloat(document.getElementById('rx-days') && document.getElementById('rx-days').value) || 1;
    var multiplier = packs * times * days; // total doses over the course

    var totalPrice = 0;
    var totalWeight = 0;
    var totalUnit = '';

    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'rx-list-wrap';
    state.rxItems.forEach(function (it, idx) {
      var match = catalogLookup(it.drug_name);
      var price = match ? (parseFloat(match.min_price) || 0) : 0;
      var perDose = parseFloat(it.quantity) || 0;
      var courseQty = perDose * multiplier;
      var lineTotal = price * courseQty;

      totalPrice += lineTotal;
      if (match && match.unit) {
        if (!totalUnit) totalUnit = match.unit;
        if (match.unit === totalUnit) totalWeight += courseQty;
      } else if (!totalUnit && it.unit) {
        totalUnit = it.unit;
        totalWeight += courseQty;
      }

      var stockPill;
      if (!it.drug_name) {
        stockPill = '<span class="rx-stock" title="Enter drug name" style="color:var(--stone);">—</span>';
      } else if (!match) {
        stockPill = '<span class="rx-stock" title="Not in pharmacy catalog · 未上架" style="color:var(--stone);">?</span>';
      } else {
        var stock = parseFloat(match.total_stock) || 0;
        if (stock <= 0) {
          stockPill = '<span class="rx-stock" title="Out of stock · 缺貨" style="color:var(--red-seal);">●</span>';
        } else if (stock < courseQty) {
          stockPill = '<span class="rx-stock" title="Stock ' + stock + ' ' + match.unit + ' — less than course ' + courseQty.toFixed(1) + '" style="color:var(--gold);">●</span>';
        } else {
          stockPill = '<span class="rx-stock" title="In stock: ' + stock + ' ' + match.unit + ' (' + match.pharmacy_count + ' pharmacies)" style="color:var(--sage);">●</span>';
        }
      }

      // Per-row info: total grams over course + line price
      var infoRow = '';
      if (perDose > 0) {
        var totalStr = courseQty.toFixed(1) + (it.unit || match && match.unit || 'g');
        var priceStr = match ? HM.format.money(lineTotal) : '<span class="text-muted">—</span>';
        infoRow = '<div class="rx-line-info">' +
          'Total · 總量 <strong>' + totalStr + '</strong>' +
          '<span class="rx-line-sep">·</span>' +
          'Price · 金額 <strong>' + priceStr + '</strong>' +
          (match ? '<span class="rx-line-sep">·</span>Unit · 單價 ' + HM.format.money(price) + '/' + match.unit : '') +
          '</div>';
      }

      var row = document.createElement('div');
      row.className = 'rx-line-wrap';
      row.innerHTML = '<div class="rx-line">' +
        '<span class="rx-line-num">' + (idx + 1) + '</span>' +
        '<input data-rx-field="drug_name" data-rx-idx="' + idx + '" class="rx-line-name" placeholder="Drug · 藥名" value="' + HM.format.esc(it.drug_name || '') + '" list="rx-catalog" autocomplete="off">' +
        stockPill +
        '<input data-rx-field="quantity" data-rx-idx="' + idx + '" type="number" step="0.1" class="rx-line-qty" placeholder="Qty" value="' + (it.quantity || '') + '">' +
        '<input data-rx-field="unit" data-rx-idx="' + idx + '" class="rx-line-unit" placeholder="Unit" value="' + HM.format.esc(it.unit || 'g') + '">' +
        '<button type="button" class="rx-line-remove" data-rx-remove="' + idx + '" title="Remove">✕</button>' +
        '</div>' + infoRow;

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
          // Auto-fill unit from catalog when picking a known drug
          if (field === 'drug_name') {
            var m = catalogLookup(val);
            if (m && m.unit) state.rxItems[i].unit = m.unit;
          }
        });
        inp.addEventListener('change', function () { renderRxList(); });
        inp.addEventListener('blur',   function () { renderRxList(); });
      });

      wrap.appendChild(row);
    });
    container.appendChild(wrap);

    // Wire dosage-pattern inputs (once per render so values persist + totals refresh)
    ['rx-packs', 'rx-times', 'rx-days'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el._wiredDosage) {
        el._wiredDosage = true;
        el.addEventListener('input', function () { updateDosageHint(); renderRxList(); });
      }
    });
    updateDosageHint();

    // Summary box
    var totalBox = document.getElementById('rx-total');
    var totalPriceEl = document.getElementById('rx-total-price');
    var totalWeightEl = document.getElementById('rx-total-weight');
    if (totalBox && totalPriceEl && totalWeightEl) {
      if (state.rxItems.length && totalWeight > 0) {
        totalBox.style.display = 'block';
        totalPriceEl.textContent = HM.format.money(totalPrice);
        totalWeightEl.textContent = totalWeight.toFixed(1) + (totalUnit || 'g') +
          ' (over ' + days + ' day' + (days === 1 ? '' : 's') + ')';
      } else {
        totalBox.style.display = 'none';
      }
    }

    // Keep the datalist populated from current catalog
    var dl = document.getElementById('rx-catalog');
    if (dl && state.drugCatalog.length) {
      dl.innerHTML = state.drugCatalog.map(function (d) {
        return '<option value="' + HM.format.esc(d.name) + '">' +
          HM.format.esc((d.specification ? d.specification + ' · ' : '') + 'stock: ' + (parseFloat(d.total_stock) || 0) + d.unit) +
          '</option>';
      }).join('');
    }
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

    var toggleBtn = document.getElementById('toggle-visit');
    if (toggleBtn) toggleBtn.addEventListener('click', function () {
      state.isWalkIn = !state.isWalkIn;
      state.appt.visit_type = state.isWalkIn ? 'walk_in' : 'online';
      var root = document.getElementById('panel-container');
      if (state.isWalkIn) renderWalkIn(root);
      else renderOnline(root, state.appt.id);
    });
  }

  // ── Complete ──────────────────────────────────────────────
  async function completeConsult(withRx) {
    var caseRecord = {
      chief_complaint:     val('cr-chief'),
      present_illness:     val('cr-present'),
      past_history:        val('cr-past'),
      pulse:               val('cr-pulse'),
      pattern_diagnosis:   val('cr-pattern'),
      western_diagnosis:   val('cr-western'),
      treatment_principle: val('cr-principle'),
      doctor_instructions: val('cr-inst'),
    };

    if (state.isWalkIn) {
      // Walk-in-only fields
      caseRecord.blood_pressure = val('cr-bp');
      caseRecord.documents      = state.documents;
    } else {
      // Online-only fields (hidden on walk-in)
      caseRecord.duration     = val('cr-duration');
      caseRecord.inspection   = val('cr-inspect');
      caseRecord.auscultation = val('cr-listen');
      caseRecord.inquiry      = val('cr-inquiry');
    }

    // Body diagrams (front + back) — saved as PNG data URLs only when drawn
    var bodyDiagrams = captureBodyDiagrams();
    Object.keys(bodyDiagrams).forEach(function (k) { caseRecord[k] = bodyDiagrams[k]; });

    // Clean up Rx items — drop any row missing drug_name or quantity
    var cleanRx = state.rxItems.filter(function (it) { return it.drug_name && (it.quantity > 0); });
    if (withRx && !cleanRx.length) {
      HM.ui.toast('Add at least one herb (name + quantity) · 至少新增一項藥材', 'warning');
      return;
    }

    var packs = parseInt(val('rx-packs'), 10) || 1;
    var times = parseInt(val('rx-times'), 10) || 1;
    var days  = parseInt(val('rx-days'),  10) || 7;
    var usage = val('rx-usage');

    // Compose a detailed dosage string for the pharmacy and patient
    var dosageLine = packs + ' pack · ' + times + '× per day · ' + days + ' days · 每次' + packs + '包 每日' + times + '次 共' + days + '天';
    // Expand each row's qty to the course total so the pharmacy dispenses the whole course
    var multiplier = packs * times * days;
    var expandedRx = cleanRx.map(function (it) {
      return Object.assign({}, it, {
        quantity: parseFloat((parseFloat(it.quantity) * multiplier).toFixed(2)),
        notes: (it.notes ? it.notes + ' | ' : '') + 'per dose: ' + it.quantity + (it.unit || 'g'),
      });
    });

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
          instructions:   [dosageLine, usage, caseRecord.doctor_instructions].filter(Boolean).join('\n'),
          duration_days:  days,
          items:          expandedRx,
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

  // ── Load drug catalog (for Rx autocomplete + stock check) ──
  async function loadDrugCatalog() {
    try {
      var res = await HM.api.doctor.drugCatalog();
      state.drugCatalog = res.data || [];
      // Inject the catalog into the <datalist> the moment it's available
      var dl = document.getElementById('rx-catalog');
      if (dl) {
        dl.innerHTML = state.drugCatalog.map(function (d) {
          return '<option value="' + HM.format.esc(d.name) + '">' +
            HM.format.esc((d.specification || '') + ' · stock: ' + (parseFloat(d.total_stock) || 0) + d.unit) +
            '</option>';
        }).join('');
      }
      // If there are already rendered rows, re-render so stock warnings show
      if (document.getElementById('rx-items-list')) renderRxList();
    } catch (_) { state.drugCatalog = []; }
  }

  function catalogLookup(name) {
    if (!name) return null;
    var lc = name.toLowerCase().trim();
    for (var i = 0; i < state.drugCatalog.length; i++) {
      if ((state.drugCatalog[i].name || '').toLowerCase() === lc) return state.drugCatalog[i];
    }
    return null;
  }

  function updateDosageHint() {
    var hint = document.getElementById('rx-dosage-hint');
    if (!hint) return;
    var packs = parseFloat(document.getElementById('rx-packs').value) || 0;
    var times = parseFloat(document.getElementById('rx-times').value) || 0;
    var days  = parseFloat(document.getElementById('rx-days').value)  || 0;
    if (!packs || !times || !days) { hint.textContent = ''; return; }
    hint.textContent =
      packs + ' pack' + (packs === 1 ? '' : 's') +
      ' · ' + times + '× per day · ' +
      days + ' day' + (days === 1 ? '' : 's') +
      ' (' + (packs * times * days) + ' doses)';
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
      // Walk-in split layout: case record left, Rx + treatments right
      '.consult-layout--split{display:grid;grid-template-columns:1fr 1fr;gap:var(--s-4);align-items:start;}' +
      '@media (max-width: 1100px){.consult-layout--split{grid-template-columns:1fr;}}' +
      '.split-left{position:sticky;top:calc(var(--nav-height) + var(--s-3));max-height:calc(100vh - var(--nav-height) - var(--s-6));overflow-y:auto;}' +
      '@media (max-width: 1100px){.split-left{position:static;max-height:none;overflow:visible;}}' +
      '.split-section-head{font-family:var(--font-body);font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold);margin-bottom:var(--s-4);padding-bottom:var(--s-2);border-bottom:1px solid var(--border);}' +
      '.consult-video{aspect-ratio:16/9;background:var(--ink);border-radius:var(--r-md);overflow:hidden;}' +
      // Compact Rx lines — single row each, no extra fields
      '.rx-list-wrap{background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden;}' +
      '.rx-line{display:grid;grid-template-columns:28px 1fr 18px 80px 70px 34px;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid var(--border);}' +
      '.rx-line:last-child{border-bottom:none;}' +
      '.rx-line:hover{background:var(--washi);}' +
      '.rx-line-num{font-family:var(--font-mono);font-size:11px;color:var(--stone);text-align:right;}' +
      '.rx-line-name,.rx-line-qty,.rx-line-unit{border:1px solid transparent;border-radius:var(--r-sm);padding:5px 8px;font-size:var(--text-sm);background:transparent;font-family:inherit;color:var(--ink);}' +
      '.rx-line-name:focus,.rx-line-qty:focus,.rx-line-unit:focus{border-color:var(--gold);background:#fff;outline:none;}' +
      '.rx-line-qty{text-align:right;}' +
      '.rx-line-unit{text-align:center;}' +
      '.rx-stock{font-size:14px;text-align:center;cursor:help;user-select:none;}' +
      '.rx-line-remove{background:none;border:none;color:var(--stone);cursor:pointer;font-size:14px;padding:4px 6px;border-radius:var(--r-sm);}' +
      '.rx-line-remove:hover{color:var(--red-seal);background:rgba(192,57,43,.08);}' +
      '.rx-line-wrap{border-bottom:1px solid var(--border);}' +
      '.rx-line-wrap:last-child{border-bottom:none;}' +
      '.rx-line-info{padding:2px 10px 6px 36px;font-size:11px;color:var(--stone);}' +
      '.rx-line-info strong{color:var(--ink);font-weight:500;}' +
      '.rx-line-sep{margin:0 6px;opacity:.4;}' +
      // Dosage pattern row
      '.rx-dosage-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}' +
      '.rx-dosage-input{width:70px;text-align:center;margin:0;padding:8px 10px;font-size:var(--text-base);}' +
      '.rx-dosage-sep{font-family:var(--font-display);font-size:var(--text-xl);color:var(--gold);font-weight:300;}' +
      '.rx-dosage-hint{margin-left:8px;font-size:var(--text-xs);color:var(--stone);}' +
      // Total summary box
      '.rx-total-box{margin-top:var(--s-4);padding:var(--s-3) var(--s-4);background:var(--washi);border-radius:var(--r-md);border:1px solid var(--border);}' +
      // Body diagram + drawing tool
      '.body-diagram-wrap{border:1px solid var(--border);border-radius:var(--r-md);background:#fff;overflow:hidden;}' +
      '.body-diagram-toolbar{display:flex;align-items:center;gap:var(--s-3);padding:var(--s-2) var(--s-3);background:var(--washi);border-bottom:1px solid var(--border);flex-wrap:wrap;}' +
      '.body-tool-group{display:flex;align-items:center;gap:6px;}' +
      '.body-pen{width:28px;height:28px;border-radius:50%;border:2px solid #ddd;cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:11px;color:#888;background:#fff;}' +
      '.body-pen.is-active{border-color:var(--ink);transform:scale(1.1);box-shadow:0 0 0 2px rgba(184,150,90,.25);}' +
      '.body-pen--blue{background:#1f6fb2;}' +
      '.body-pen--red{background:#c0392b;}' +
      '.body-pen--green{background:#2e8b57;}' +
      '.body-pen--erase{background:#fff;color:#666;}' +
      '.body-thickness-label{font-size:11px;color:var(--stone);letter-spacing:.06em;}' +
      '.body-thickness-value{font-size:11px;color:var(--stone);font-family:var(--font-mono);min-width:32px;}' +
      '.body-diagram-stage{display:flex;gap:var(--s-3);padding:var(--s-3);justify-content:center;flex-wrap:wrap;background:#fafafa;}' +
      '.body-side{display:flex;flex-direction:column;align-items:center;gap:6px;}' +
      '.body-side-label{font-size:11px;color:var(--stone);letter-spacing:.1em;text-transform:uppercase;}' +
      '.body-canvas-wrap{position:relative;width:160px;height:350px;}' +
      '@media (min-width: 768px){.body-canvas-wrap{width:200px;height:430px;}}' +
      '.body-svg{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;}' +
      '.body-canvas{position:absolute;top:0;left:0;width:100%;height:100%;cursor:crosshair;touch-action:none;}';
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
