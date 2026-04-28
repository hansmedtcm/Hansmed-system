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
      state.existingRxId = null;

      // Pre-fill the Rx pad from any existing issued Rx on this
      // appointment. Lets the doctor re-enter the consult to edit
      // medicines — when they re-submit, the backend supersedes the
      // old Rx (see PrescriptionController::store).
      try {
        var rxRes = await HM.api.doctor.listRxForAppointment(appointmentId);
        var existing = (rxRes && rxRes.data && rxRes.data[0]) || null;
        if (existing) {
          state.existingRxId = existing.id;
          // Stored quantities are full-course totals. When we issued
          // the Rx we stashed the per-dose value in the item's notes
          // field as `per dose: NNg`. Parse it back so the pad shows
          // what the doctor originally typed.
          state.rxItems = (existing.items || []).map(function (it) {
            var perDose = null;
            var m = /per dose:\s*([0-9.]+)/i.exec(it.notes || '');
            if (m) perDose = parseFloat(m[1]);
            return {
              drug_name:   it.drug_name,
              quantity:    (perDose !== null && !isNaN(perDose)) ? perDose : parseFloat(it.quantity),
              unit:        it.unit || 'g',
              dosage:      it.dosage || '',
              frequency:   it.frequency || '',
              usage_method:it.usage_method || '',
            };
          });
          state.caseRecord.pattern_diagnosis = existing.diagnosis || '';
          state.caseRecord.doctor_instructions = existing.instructions || '';
        }
      } catch (_) { /* no existing Rx — fresh pad */ }

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

    // Pick video provider — admin-controlled in System Settings.
    // Default jitsi if anything goes wrong fetching the flag.
    var features = {};
    try { features = await HM.api.publicFeatures(); } catch (_) {}
    var provider = (features && features.video_provider) || 'jitsi';

    var user = HM.auth.user();
    var displayName = HM.auth.displayName(user);
    var rtc = tokenRes.rtc || {};
    var roomName = rtc.channel || ('HansMed-Consult-' + appointmentId);

    var videoBlock;
    if (provider === 'google_meet') {
      // Google Meet doesn't allow iframe embedding (X-Frame-Options
      // DENY). The doctor pastes the meet URL after creating the
      // room in their Google account; both sides then click Join
      // which opens the Meet in a new tab.
      videoBlock = renderMeetSetupBlock(state.appt);
    } else if (provider === 'daily') {
      // Daily.co — backend mints a private room URL + meeting token
      // tied to this user/appointment. Container starts empty and is
      // filled by the Daily SDK in wireDailyConsult() below.
      videoBlock = '<div class="consult-video" id="daily-container"></div>';
    } else {
      // Admin can override the Jitsi domain (self-hosted = no 5-min
      // limit). Falls back to meet.jit.si if not configured. Reject
      // the literal 'null'/'undefined' strings that historically
      // leaked from a corrupt jitsi_domain config row.
      var rawDomain = (features && features.jitsi_domain) || '';
      var bad = ['', 'null', 'undefined', 'NULL'];
      var domain = bad.indexOf(rawDomain) === -1 ? rawDomain
                   : (HM.config.JITSI_DOMAIN || 'meet.jit.si');
      var jitsiUrl = 'https://' + domain + '/' + encodeURIComponent(roomName) +
        '#userInfo.displayName="' + encodeURIComponent(displayName) + '"&config.prejoinPageEnabled=false';
      videoBlock = '<div class="consult-video">' +
        '<iframe src="' + HM.format.esc(jitsiUrl) + '" style="width:100%;height:100%;border:none;" allow="camera;microphone;display-capture;autoplay"></iframe>' +
        '</div>';
    }

    el.innerHTML = header() +
      '<div class="consult-layout consult-layout--online">' +
      '<div>' + videoBlock + '</div>' +
      '<div id="consult-side">' + sidebarMarkup() + '</div>' +
      '</div>' +
      footerActions();

    if (provider === 'google_meet') wireMeetSetup(state.appt);
    if (provider === 'daily')      wireDailyConsult(appointmentId);

    injectStyle();
    wireSidebar();
    wireActions();
  }

  // ── Daily.co bootstrapper ─────────────────────────────
  // Loads the Daily SDK on first use, fetches the room URL + token
  // from the backend, then attaches an iframe inside #daily-container.
  function wireDailyConsult(appointmentId) {
    function ensureSdk(cb) {
      if (window.DailyIframe) return cb();
      var s = document.createElement('script');
      s.src = 'https://unpkg.com/@daily-co/daily-js';
      s.onload = cb;
      s.onerror = function () {
        var box = document.getElementById('daily-container');
        if (box) box.innerHTML = '<div style="color:#fff;padding:1rem;text-align:center;">' +
          'Failed to load Daily.co SDK. Check your internet connection or fall back to Jitsi via Admin → System Settings.' +
          '</div>';
      };
      document.head.appendChild(s);
    }
    ensureSdk(function () {
      HM.api.consultation.dailyRoom(appointmentId).then(function (res) {
        var box = document.getElementById('daily-container');
        if (! box) return;
        if (! res || ! res.room_url) {
          box.innerHTML = '<div style="color:#fff;padding:1rem;text-align:center;">' +
            'Could not create the video room. ' + HM.format.esc(res && res.message ? res.message : '') +
            '</div>';
          return;
        }
        // Reuse existing frame if rerendering
        if (window._dailyFrame) {
          try { window._dailyFrame.destroy(); } catch (_) {}
          window._dailyFrame = null;
        }
        window._dailyFrame = window.DailyIframe.createFrame(box, {
          showLeaveButton: true,
          iframeStyle: { width: '100%', height: '100%', border: '0', borderRadius: '12px' },
        });
        window._dailyFrame.join({
          url: res.room_url,
          token: res.token,
        });
      }).catch(function (e) {
        var box = document.getElementById('daily-container');
        if (box) box.innerHTML = '<div style="color:#fff;padding:1rem;text-align:center;">' +
          'Could not start the video session. ' + HM.format.esc((e && e.message) || '') + '</div>';
      });
    });
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

    // Wuyun Liuqi analysis (practitioner-only clinical aide)
    mountWuyunLiuqi();

    // Clinical assist (red flags / questions / DDx based on
    // chief complaint + vitals). Re-evaluates on every input.
    wireClinicalAssist();

    // Treatments: preset add buttons
    document.querySelectorAll('[data-tx-add]').forEach(function (btn) {
      btn.addEventListener('click', function () { addTreatment(btn.getAttribute('data-tx-add')); });
    });
    wireCustomTreatmentForm();

    // Prescription: add-row button
    var addRow = document.getElementById('rx-add-row');
    if (addRow) addRow.addEventListener('click', function () {
      state.rxItems.push({ drug_name: '', quantity: 10, unit: 'g' });
      renderRxList();
    });

    // Usage-note preset chips in walk-in view (tabbed view wires its own
    // copy inside wireSidebar). Without this, clicking a chip did nothing.
    wireUsagePresets();

    renderRxList();
    renderTreatments();
    renderDocuments();
  }

  // ── Google Meet setup block ───────────────────────────────
  // Used when video_provider = google_meet. Doctor creates a Meet
  // room in their own Google account (free, no API setup), pastes
  // the URL, saves; the patient sees a Join button on their video
  // page. Doctor sees the same Join button + an Edit option.
  function renderMeetSetupBlock(appt) {
    var url = (appt && appt.meeting_url) || '';
    return '<div class="card card--pad-lg" style="text-align:center;background:linear-gradient(135deg,rgba(74,144,217,.05),rgba(255,255,255,.5));">' +
      '<div style="font-size:3rem;margin-bottom:var(--s-2);">📹</div>' +
      '<h3 class="mb-2">Google Meet · Google 視訊會議</h3>' +
      '<p class="text-muted text-sm mb-4">' +
      'Google Meet doesn\'t embed inside other sites — it opens in a new tab. ' +
      '<span style="font-family: var(--font-zh);">Google Meet 不支援嵌入，會於新分頁開啟。</span>' +
      '</p>' +

      // Active meeting URL (if set)
      (url
        ? '<div class="alert alert--success mb-4"><div class="alert-body">' +
          '<div class="text-label mb-1">Meeting URL · 會議連結</div>' +
          '<div style="font-family: var(--font-mono); font-size: var(--text-sm); word-break: break-all;">' + HM.format.esc(url) + '</div>' +
          '</div></div>' +

          '<div class="flex flex-gap-2" style="justify-content:center;">' +
          '<a href="' + HM.format.esc(url) + '" target="_blank" rel="noopener" class="btn btn--primary btn--lg">▶ Join Meeting · 加入會議</a>' +
          '<button type="button" class="btn btn--outline" id="meet-edit">✎ Edit URL · 編輯</button>' +
          '</div>'
        : '<div class="alert alert--info mb-4"><div class="alert-body text-sm">' +
          '<strong>Step 1:</strong> Click "Create New Meet" below — opens Google Meet in a new tab. ' +
          'Sign in with your Google account, click <em>New meeting → Start an instant meeting</em>, ' +
          'and copy the room URL. <br>' +
          '<strong>Step 2:</strong> Paste the URL here and click Save. The patient will see a Join button.' +
          '<br><span style="font-family: var(--font-zh);">第一步：點下方「建立新會議」於 Google 建立會議並複製連結。第二步：貼上後按儲存，患者即可加入。</span>' +
          '</div></div>' +

          '<div class="flex flex-gap-2 mb-3" style="justify-content:center;">' +
          '<a href="https://meet.google.com/new" target="_blank" rel="noopener" class="btn btn--outline">🌐 Create New Meet · 建立新會議</a>' +
          '</div>') +

      // URL editor (hidden when URL is already set, shown via Edit button)
      '<div id="meet-url-form" class="mt-3" style="' + (url ? 'display:none;' : '') + 'max-width:560px;margin:0 auto;">' +
      '<div class="flex flex-gap-2">' +
      '<input id="meet-url-input" class="field-input field-input--boxed" placeholder="https://meet.google.com/xxx-yyyy-zzz" value="' + HM.format.esc(url) + '" style="flex:1;font-family:var(--font-mono);">' +
      '<button type="button" class="btn btn--primary" id="meet-url-save">Save · 儲存</button>' +
      (url ? '<button type="button" class="btn btn--ghost" id="meet-url-clear" title="Remove meeting URL">✕</button>' : '') +
      '</div>' +
      '</div>' +
      '</div>';
  }

  function wireMeetSetup(appt) {
    var saveBtn = document.getElementById('meet-url-save');
    var input   = document.getElementById('meet-url-input');
    var editBtn = document.getElementById('meet-edit');
    var clearBtn = document.getElementById('meet-url-clear');
    var form = document.getElementById('meet-url-form');

    if (editBtn) editBtn.addEventListener('click', function () {
      if (form) form.style.display = '';
      if (input) { input.focus(); input.select(); }
    });

    if (saveBtn) saveBtn.addEventListener('click', async function () {
      var url = (input.value || '').trim();
      if (url && ! /^https?:\/\//i.test(url)) {
        HM.ui.toast('URL must start with https:// · 連結需以 https:// 開頭', 'warning');
        return;
      }
      saveBtn.disabled = true;
      saveBtn.textContent = '…';
      try {
        var res = await HM.api.doctor.setMeetingUrl(appt.id, url || null);
        appt.meeting_url = (res.appointment && res.appointment.meeting_url) || url;
        HM.ui.toast('Meeting URL saved · 會議連結已儲存', 'success');
        // Re-render the block so the patient-side Join button appears.
        var container = document.querySelector('.consult-layout--online > div:first-child');
        if (container) {
          container.innerHTML = renderMeetSetupBlock(appt);
          wireMeetSetup(appt);
        }
      } catch (err) {
        HM.ui.toast(err.message || 'Failed to save', 'danger');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save · 儲存';
      }
    });

    if (clearBtn) clearBtn.addEventListener('click', async function () {
      var ok = await HM.ui.confirm('Remove meeting URL? · 確認移除會議連結？');
      if (! ok) return;
      try {
        await HM.api.doctor.setMeetingUrl(appt.id, null);
        appt.meeting_url = null;
        var container = document.querySelector('.consult-layout--online > div:first-child');
        if (container) {
          container.innerHTML = renderMeetSetupBlock(appt);
          wireMeetSetup(appt);
        }
      } catch (err) { HM.ui.toast(err.message || 'Failed', 'danger'); }
    });
  }

  // ── Header ─────────────────────────────────────────────────
  function header() {
    var visitBadge = state.isWalkIn
      ? '<span class="badge" style="background:rgba(184,150,90,.15);color:var(--gold);">🏥 Walk-in · 臨診</span>'
      : '<span class="badge" style="background:rgba(74,144,217,.15);color:#4a90d9;">📹 Online · 線上</span>';
    var toggleLabel = state.isWalkIn ? 'Switch to Online · 改為線上' : 'Switch to Walk-in · 改為臨診';
    return '<div class="page-header">' +
      '<button class="btn btn--ghost" onclick="HM.doctorPanels.consult._back()">← Back</button>' +
      '<h1 class="page-title mt-2">Consultation — ' + HM.format.esc(HM.format.patientLabel(state.appt)) + '</h1>' +
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
  // Unified template — the same walk-in layout is used for both walk-in
  // and teleconsult visits. The doctor gets a consistent form regardless
  // of visit type: Chief Complaint + BP + Pulse + file upload + body
  // diagram. (Inspection/Auscultation/Inquiry happens face-to-face or
  // via the video call — no need for separate text boxes online.)
  function caseRecordMarkup() {
    var topRow =
      '<div class="field-grid field-grid--3">' +
      '<div class="field" style="grid-column: span 2;"><label class="field-label">Chief Complaint · 主訴</label>' +
      '<textarea id="cr-chief" class="field-input" rows="2" placeholder="Primary reason for visit"></textarea></div>' +
      '<div class="field"><label class="field-label">Blood Pressure · 血壓</label>' +
      '<input id="cr-bp" class="field-input field-input--boxed" placeholder="e.g. 120/80"></div>' +
      '</div>' +

      // Clinical assist panel — populated from chief_complaint + BP +
      // pulse + age via HM.clinicalAssist. Doctor sees red flags,
      // suggested questions, and differentials without leaving the page.
      '<div id="cr-clinical-assist" class="cr-clinical-assist mt-3"></div>';

    var fourExam =
      '<div class="field"><label class="field-label">切 Pulse · 脈診</label>' +
      '<input id="cr-pulse" class="field-input field-input--boxed" placeholder="e.g. 左:弦 / 右:滑 Left: wiry / Right: slippery"></div>';

    // Document upload available for both visit types — teleconsult patients
    // may still share lab reports, imaging, or external prescriptions.
    var uploadBlock =
      '<div class="field mt-3">' +
      '<label class="field-label">📎 Medical Documents · 醫療文件</label>' +
      '<div class="text-xs text-muted mb-2">Upload lab reports, imaging, prescriptions from other clinics, etc. Photos or PDFs. ' +
      '<span style="font-family: var(--font-zh);">上傳化驗單、影像、外院處方等。</span></div>' +
      '<input type="file" id="cr-files" class="field-input field-input--boxed" multiple accept="image/*,.pdf,.doc,.docx" style="padding: 6px;">' +
      '<div id="cr-files-list" class="mt-2"></div>' +
      '</div>';

    // Wuyun Liuqi (五運六氣) analysis slot — populated after render once
    // the patient profile arrives. Doctor-only; patients never see this.
    var wuyunSlot = '<div id="wyl-mount" class="mb-3"></div>';

    return wuyunSlot + topRow +

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

  // ── Body diagram (front + back PNG + single giant canvas overlay) ──
  // One canvas spans the entire card including the margins between and
  // around the two images. Doctors can annotate on the silhouette, in
  // the gap between front & back, or in the whitespace at the edges —
  // anywhere inside the card is drawable. The two images sit behind
  // the canvas via pointer-events:none.
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

      '<div class="body-combined-labels">' +
        '<span>FRONT · 前面</span>' +
        '<span>BACK · 背面</span>' +
      '</div>' +

      '<div class="body-combined-stage" data-side="combined">' +
        '<div class="body-combined-silhouettes">' +
          '<img class="body-combined-img" src="assets/img/front.png" alt="Body chart — front view">' +
          '<img class="body-combined-img" src="assets/img/back.png" alt="Body chart — back view">' +
        '</div>' +
        '<canvas class="body-canvas" data-side="combined" width="1400" height="1600"></canvas>' +
      '</div>' +
      '</div>';
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
      // One-off custom treatment for THIS visit only — opens an inline
      // mini form so the doctor doesn't have to leave the consult.
      // For long-term presets they still use admin Settings.
      '<button type="button" class="btn btn--ghost btn--sm" id="tx-add-custom" style="border:1px dashed var(--gold);color:var(--gold);">+ Custom · 自訂</button>' +
      '</div>' +

      // Inline custom-treatment form (hidden until clicked).
      '<div id="tx-custom-form" class="card mt-3" style="display:none;padding: var(--s-3); background: var(--washi);">' +
      '<div class="text-label mb-2">Custom Treatment for this visit · 本次自訂治療</div>' +
      '<div class="field-grid field-grid--2" style="gap: var(--s-2);">' +
      '<div class="field"><label class="field-label">Icon</label><input id="tx-c-icon" class="field-input field-input--boxed" value="💉" style="text-align:center;"></div>' +
      '<div class="field"><label class="field-label" data-required>Name (EN)</label><input id="tx-c-name" class="field-input field-input--boxed" placeholder="e.g. Ear acupuncture"></div>' +
      '<div class="field"><label class="field-label">中文名稱</label><input id="tx-c-name-zh" class="field-input field-input--boxed" placeholder="例：耳針" style="font-family:var(--font-zh);"></div>' +
      '<div class="field"><label class="field-label">Fee (RM)</label><input id="tx-c-fee" type="number" min="0" step="0.01" class="field-input field-input--boxed" value="0"></div>' +
      '</div>' +
      '<div class="flex gap-2 mt-2">' +
      '<button type="button" class="btn btn--ghost btn--sm" id="tx-c-cancel">Cancel</button>' +
      '<button type="button" class="btn btn--primary btn--sm" id="tx-c-add">+ Add to log</button>' +
      '<span class="text-xs text-muted" style="margin-left:auto;align-self:center;">Tip: ask admin to add it as a preset in System Settings if you use it often. · 常用治療請聯絡管理員加入預設。</span>' +
      '</div>' +
      '</div>';
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
      // Preset chips — click to insert into the notes field so the
      // doctor doesn't retype the same phrases every Rx. Multiple
      // clicks append (comma-separated).
      '<div id="rx-usage-presets" class="rx-usage-presets">' +
      [
        { en: 'After meals',    zh: '飯後服用' },
        { en: 'Before meals',   zh: '飯前服用' },
        { en: 'Empty stomach',  zh: '空腹服用' },
        { en: 'Warm water',     zh: '溫水送服' },
        { en: 'Decoct in water',zh: '水煎服' },
        { en: 'Before sleep',   zh: '睡前服用' },
        { en: 'Morning',        zh: '晨起服用' },
        { en: 'Avoid cold/raw', zh: '忌生冷' },
        { en: 'Avoid spicy',    zh: '忌辛辣' },
      ].map(function (p) {
        return '<button type="button" class="rx-usage-chip" data-usage="' +
          HM.format.esc(p.zh + ' ' + p.en) + '">' +
          '<span style="font-family:var(--font-zh);">' + p.zh + '</span> · ' + p.en +
          '</button>';
      }).join('') +
      '</div>' +
      '<input id="rx-usage" class="field-input field-input--boxed mt-2" placeholder="e.g. 飯後服用，水煎 After meals, decoct with water"></div>' +

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

    // Treatment add buttons (presets) + inline custom-treatment form
    document.querySelectorAll('[data-tx-add]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        addTreatment(btn.getAttribute('data-tx-add'));
      });
    });
    wireCustomTreatmentForm();

    // Prescription add row
    document.getElementById('rx-add-row').addEventListener('click', function () {
      state.rxItems.push({ drug_name: '', quantity: 10, unit: 'g' });
      renderRxList();
    });

    // Usage-note preset chips
    wireUsagePresets();

    // Clinical assist (also wires in the online tabbed view, since
    // the case-record fields appear in the Case Record tab)
    wireClinicalAssist();

    // File upload handler (walk-in only)
    var fileInput = document.getElementById('cr-files');
    if (fileInput) {
      fileInput.addEventListener('change', handleFileUpload);
    }

    // Body diagram drawing (always present in case record)
    initBodyDiagram();

    // Wuyun Liuqi analysis (practitioner-only clinical aide)
    mountWuyunLiuqi();

    renderRxList();
    renderTreatments();
    renderDocuments();
  }

  // Looks up the patient's DOB from the appointment response (if the
  // endpoint already returned patient.patientProfile) or fetches it
  // separately, then hands it to HM.wuyunLiuqi to render. Silent no-op
  // if DOB is missing.
  async function mountWuyunLiuqi() {
    var slot = document.getElementById('wyl-mount');
    if (!slot || !window.HM || !HM.wuyunLiuqi) return;

    // Prefer the DOB embedded in the appointment response
    var dob = null;
    try {
      var appt = state.appt || {};
      dob = (appt.patient && appt.patient.patient_profile && appt.patient.patient_profile.birth_date)
         || (appt.patient_profile && appt.patient_profile.birth_date)
         || appt.patient_birth_date
         || null;
    } catch (_) { dob = null; }

    // Fall back to hitting /doctor/patients/:id so this works even if the
    // appointment payload doesn't embed the profile.
    if (!dob && state.appt && state.appt.patient_id && HM.api.doctor && HM.api.doctor.patientConsults) {
      try {
        var res = await HM.api.doctor.patientConsults(state.appt.patient_id);
        var pp = res && res.patient && res.patient.patient_profile;
        if (pp && pp.birth_date) dob = pp.birth_date;
      } catch (_) { /* ignore — just skip the analysis */ }
    }

    if (!dob) {
      // Still render today's environmental analysis even without DOB —
      // useful context for walk-in patients without complete profiles.
      HM.wuyunLiuqi.mountDual(slot, null);
      return;
    }
    HM.wuyunLiuqi.mountDual(slot, dob);
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

  // ── Clinical assist panel (5MCC-based) ───────────────────
  // Re-evaluates on every change to chief_complaint / BP / pulse +
  // patient age (from the loaded appointment), then renders the
  // panel with red flags, suggested questions, differentials,
  // and vitals alerts. Doctor-only — never shown to the patient.
  function wireClinicalAssist() {
    var slot   = document.getElementById('cr-clinical-assist');
    if (! slot || ! HM.clinicalAssist) return;
    var chiefEl = document.getElementById('cr-chief');
    var bpEl    = document.getElementById('cr-bp');
    var pulseEl = document.getElementById('cr-pulse');

    var pp = (state.appt && state.appt.patient && state.appt.patient.patient_profile) || {};
    var dob = pp.birth_date || pp.dob || null;
    var age = null;
    if (dob) {
      try {
        var d = new Date(String(dob).slice(0, 10));
        age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
      } catch (_) {}
    }

    var refresh = function () {
      var res = HM.clinicalAssist.evaluate({
        chief_complaint: chiefEl ? chiefEl.value : '',
        bp:    bpEl    ? bpEl.value    : '',
        pulse: pulseEl ? pulseEl.value : '',
        age:   age,
      });
      slot.innerHTML = renderClinicalAssist(res);
    };

    // Debounce to avoid re-render thrashing while typing.
    var debounceT;
    var debounced = function () {
      clearTimeout(debounceT);
      debounceT = setTimeout(refresh, 250);
    };
    if (chiefEl) chiefEl.addEventListener('input', debounced);
    if (bpEl)    bpEl.addEventListener('input', debounced);
    if (pulseEl) pulseEl.addEventListener('input', debounced);

    refresh();
  }

  function renderClinicalAssist(res) {
    if (! res) return '';
    // If nothing matched and no vitals alerts, show a single-line
    // baseline note so the doctor knows the panel is alive.
    var hasContent = (res.matched_complaints && res.matched_complaints.length) ||
                     (res.vitals_alerts && res.vitals_alerts.length);
    if (! hasContent) {
      return '<details class="ca-empty"><summary>🩺 Clinical Assist · 臨床提示 — type a chief complaint to see suggestions</summary>' +
        '<div class="ca-tiny">Pulls from <em>The 5-Minute Clinical Consult 2017</em>. Suggestions appear as you type. Try entries like "headache", "chest pain", "abdominal pain", "low back pain", "cough", "insomnia", "fatigue", "menstrual irregularity"…</div></details>';
    }

    injectClinicalAssistStyle();
    var label = res.matched_complaints.length
      ? res.matched_complaints.map(function (m) { return m.label_en + ' · ' + m.label_zh; }).join(', ')
      : 'Vitals review';

    function sevColor(s) {
      return s === 'critical' ? '#a8273a' : s === 'high' ? '#c0651e' : s === 'medium' ? '#b08a2e' : 'var(--stone)';
    }
    function sevIcon(s) {
      return s === 'critical' ? '🚨' : s === 'high' ? '⚠️' : s === 'medium' ? '⚠' : 'ℹ️';
    }

    var redFlagsHtml = '';
    var allFlags = (res.vitals_alerts || []).concat(res.red_flags || []);
    if (allFlags.length) {
      // Sort critical → high → medium → low
      var rank = { critical: 0, high: 1, medium: 2, low: 3 };
      allFlags.sort(function (a, b) { return (rank[a.severity] || 9) - (rank[b.severity] || 9); });
      redFlagsHtml = '<div class="ca-section-head">🚨 Red Flags · 警示</div>' +
        '<ul class="ca-flag-list">' +
        allFlags.map(function (f) {
          return '<li class="ca-flag" style="border-left-color:' + sevColor(f.severity) + ';">' +
            '<div>' + sevIcon(f.severity) + ' ' + HM.format.esc(f.msg_en) + '</div>' +
            (f.msg_zh ? '<div style="font-family:var(--font-zh);color:var(--stone);font-size:11px;margin-top:2px;">' + HM.format.esc(f.msg_zh) + '</div>' : '') +
            '</li>';
        }).join('') +
        '</ul>';
    }

    var qHtml = '';
    if (res.questions && res.questions.length) {
      qHtml = '<details class="ca-block"><summary>❓ Suggested questions to ask · 建議詢問 (' + res.questions.length + ')</summary>' +
        '<ul class="ca-q-list">' +
        res.questions.map(function (q) {
          return '<li><div>' + HM.format.esc(q.q_en) + '</div>' +
            (q.q_zh ? '<div style="font-family:var(--font-zh);color:var(--stone);font-size:11px;">' + HM.format.esc(q.q_zh) + '</div>' : '') +
            (q.why ? '<div class="ca-why">→ ' + HM.format.esc(q.why) + '</div>' : '') +
            '</li>';
        }).join('') + '</ul></details>';
    }

    var dxHtml = '';
    if (res.differentials && res.differentials.length) {
      dxHtml = '<details class="ca-block"><summary>🔎 Differentials to consider · 鑑別診斷 (' + res.differentials.length + ')</summary>' +
        '<ul class="ca-dx-list">' +
        res.differentials.map(function (d) {
          return '<li><strong>' + HM.format.esc(d.name_en) + '</strong>' +
            (d.name_zh ? ' · <span style="font-family:var(--font-zh);color:var(--stone);">' + HM.format.esc(d.name_zh) + '</span>' : '') +
            (d.note ? '<div class="ca-why">' + HM.format.esc(d.note) + '</div>' : '') +
            '</li>';
        }).join('') + '</ul></details>';
    }

    return '<div class="ca-panel">' +
      '<div class="ca-header">' +
      '<div class="ca-title">🩺 Clinical Assist · 臨床提示</div>' +
      '<div class="ca-sub">For: ' + HM.format.esc(label) + '</div>' +
      '</div>' +
      redFlagsHtml +
      qHtml +
      dxHtml +
      '<div class="ca-footnote">Source: <em>The 5-Minute Clinical Consult 2017</em>. Decision support only — your clinical judgement remains primary. ' +
      '<span style="font-family:var(--font-zh);">僅作臨床參考，最終判斷由醫師決定。</span></div>' +
      '</div>';
  }

  function injectClinicalAssistStyle() {
    if (document.getElementById('ca-style')) return;
    var s = document.createElement('style');
    s.id = 'ca-style';
    s.textContent =
      '.cr-clinical-assist{margin-bottom: var(--s-3);}' +
      '.ca-panel{background:#fff;border:1px solid rgba(168,39,58,.25);border-radius:var(--r-md);padding:12px 14px;}' +
      '.ca-empty summary{cursor:pointer;font-size:12px;color:var(--stone);padding:6px 10px;background:var(--washi);border:1px dashed var(--border);border-radius:var(--r-sm);user-select:none;}' +
      '.ca-tiny{font-size:11px;color:var(--stone);padding:8px 10px;}' +
      '.ca-header{border-bottom:1px solid var(--border);padding-bottom:6px;margin-bottom:8px;}' +
      '.ca-title{font-weight:600;color:var(--ink);font-size:13px;}' +
      '.ca-sub{font-size:11px;color:var(--stone);margin-top:2px;}' +
      '.ca-section-head{font-size:11px;letter-spacing:.06em;color:var(--stone);margin-top:4px;margin-bottom:6px;text-transform:uppercase;font-weight:600;}' +
      '.ca-flag-list{list-style:none;padding:0;margin:0 0 8px 0;}' +
      '.ca-flag{padding:6px 10px;border-left:3px solid var(--red-seal);background:rgba(168,39,58,.04);border-radius:0 var(--r-sm) var(--r-sm) 0;margin-bottom:4px;font-size:12px;line-height:1.45;}' +
      '.ca-block{margin-top:8px;}' +
      '.ca-block summary{cursor:pointer;font-size:12px;color:var(--ink);font-weight:500;padding:4px 0;user-select:none;}' +
      '.ca-block summary:hover{color:var(--gold);}' +
      '.ca-q-list,.ca-dx-list{list-style:none;padding:0 0 0 16px;margin:6px 0 0 0;}' +
      '.ca-q-list li,.ca-dx-list li{padding:5px 0;border-bottom:1px dashed var(--border);font-size:12px;}' +
      '.ca-q-list li:last-child,.ca-dx-list li:last-child{border-bottom:none;}' +
      '.ca-why{font-size:10px;color:var(--stone);font-style:italic;margin-top:1px;}' +
      '.ca-footnote{font-size:10px;color:var(--stone);font-style:italic;margin-top:8px;border-top:1px dashed var(--border);padding-top:6px;}' +
      '';
    document.head.appendChild(s);
  }

  // ── Custom (one-off) treatment form ──────────────────────
  // Reveals inline mini-form so the doctor can log a treatment that
  // isn't in the admin preset list, without leaving the consult.
  // Stored only on this consultation — for repeat use, admin should
  // add it to system_configs.treatment_types.
  function wireCustomTreatmentForm() {
    var openBtn = document.getElementById('tx-add-custom');
    var form = document.getElementById('tx-custom-form');
    if (! openBtn || ! form || openBtn._wired) return;
    openBtn._wired = true;

    openBtn.addEventListener('click', function () {
      form.style.display = (form.style.display === 'none' || ! form.style.display) ? '' : 'none';
      if (form.style.display !== 'none') {
        var nm = document.getElementById('tx-c-name'); if (nm) nm.focus();
      }
    });
    document.getElementById('tx-c-cancel').addEventListener('click', function () {
      form.style.display = 'none';
    });
    document.getElementById('tx-c-add').addEventListener('click', function () {
      var name    = (document.getElementById('tx-c-name').value || '').trim();
      var name_zh = (document.getElementById('tx-c-name-zh').value || '').trim();
      var icon    = (document.getElementById('tx-c-icon').value || '').trim() || '💉';
      var fee     = parseFloat(document.getElementById('tx-c-fee').value) || 0;
      if (! name) {
        HM.ui.toast('Please enter the English name · 請輸入英文名稱', 'warning');
        return;
      }
      state.treatments.push({
        type:       'custom_' + Date.now(),
        name:       name,
        name_zh:    name_zh,
        icon:       icon,
        has_points: false,
        points:     '',
        duration_min: 0,
        fee:        fee,
        notes:      '',
      });
      renderTreatments();
      // Reset + collapse the form ready for the next one.
      document.getElementById('tx-c-name').value = '';
      document.getElementById('tx-c-name-zh').value = '';
      document.getElementById('tx-c-icon').value = '💉';
      document.getElementById('tx-c-fee').value = '0';
      form.style.display = 'none';
      HM.ui.toast('Custom treatment added · 已新增自訂治療', 'success');
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

  // Wire usage-note preset chips. Clicking toggles the phrase in the
  // input (comma-separated). Shared between walk-in and tabbed views.
  function wireUsagePresets() {
    var presetsBox = document.getElementById('rx-usage-presets');
    if (! presetsBox) return;
    // Guard against double-wiring if caller runs twice.
    if (presetsBox._hmWired) return;
    presetsBox._hmWired = true;
    presetsBox.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-usage]');
      if (! btn) return;
      ev.preventDefault();
      var piece = btn.getAttribute('data-usage');
      var inp = document.getElementById('rx-usage');
      if (! inp) return;
      var parts = (inp.value || '').split(/[,，、；;]\s*/)
        .map(function (s) { return s.trim(); }).filter(Boolean);
      var idx = parts.indexOf(piece);
      if (idx >= 0) { parts.splice(idx, 1); btn.classList.remove('is-selected'); }
      else          { parts.push(piece);    btn.classList.add('is-selected'); }
      inp.value = parts.join(', ');
    });
  }

  // ── Rx list rendering — table layout with per-gram pricing ──
  // Columns: Herb · Qty (per dose, g) · Cost per 1g (RM) · Total Qty (g) · Total Cost (RM)
  //
  // Pharmacies store unit_price as "RM per 1 g" so Total Cost is simply
  // totalQty × unit_price. totalQty = perDoseQty × packs × times × days.
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

    container.innerHTML = '';

    // Build the table shell once
    var table = document.createElement('table');
    table.className = 'rx-table';
    table.innerHTML =
      '<thead><tr>' +
        '<th class="rx-col-num">#</th>' +
        '<th class="rx-col-herb">Herb · 藥材</th>' +
        '<th class="rx-col-stock" title="Stock status">●</th>' +
        '<th class="rx-col-qty">Qty / dose<div class="rx-col-sub">每次 (g)</div></th>' +
        '<th class="rx-col-price">Cost / 1 g<div class="rx-col-sub">每克 (RM)</div></th>' +
        '<th class="rx-col-total-qty">Total Qty<div class="rx-col-sub">總量 (g)</div></th>' +
        '<th class="rx-col-total">Total Cost<div class="rx-col-sub">總金額</div></th>' +
        '<th class="rx-col-remove"></th>' +
      '</tr></thead><tbody></tbody>';
    var tbody = table.querySelector('tbody');

    state.rxItems.forEach(function (it, idx) {
      var match = catalogLookup(it.drug_name);
      // Backend provides unit_price as cost per 1 g (products.unit_price is
      // stored that way — the pharmacy enters grams-per-unit & pack price
      // and we auto-divide). Catalog min_price is also per-gram now.
      var unitPrice = match ? (parseFloat(match.min_price) || 0) : 0;
      var perDose = parseFloat(it.quantity) || 0;
      var courseQty = perDose * multiplier;
      var lineTotal = unitPrice * courseQty;

      totalPrice += lineTotal;
      totalWeight += courseQty;

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
          stockPill = '<span class="rx-stock" title="Stock ' + stock.toFixed(0) + 'g — less than course ' + courseQty.toFixed(1) + 'g" style="color:var(--gold);">●</span>';
        } else {
          stockPill = '<span class="rx-stock" title="In stock: ' + stock.toFixed(0) + 'g (' + match.pharmacy_count + ' pharmacies)" style="color:var(--sage);">●</span>';
        }
      }

      var priceCell = match && unitPrice > 0
        ? 'RM ' + unitPrice.toFixed(4)
        : '<span class="text-muted">—</span>';
      var totalQtyCell = perDose > 0 ? courseQty.toFixed(1) + ' g' : '<span class="text-muted">—</span>';
      var totalCostCell = (match && perDose > 0)
        ? '<strong>' + HM.format.money(lineTotal) + '</strong>'
        : '<span class="text-muted">—</span>';

      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="rx-col-num">' + (idx + 1) + '</td>' +
        // Custom autocomplete (attached below) replaces the native
        // <datalist> — needed for the 'pick + auto-add-row' keyboard
        // flow. Native datalist's Enter swallows the keypress and
        // doesn't let us hook 'add new row' cleanly across browsers.
        '<td class="rx-col-herb" style="position:relative;"><input data-rx-field="drug_name" data-rx-idx="' + idx + '" class="rx-line-name" placeholder="Drug · 藥名" value="' + HM.format.esc(it.drug_name || '') + '" autocomplete="off" spellcheck="false"></td>' +
        '<td class="rx-col-stock">' + stockPill + '</td>' +
        '<td class="rx-col-qty"><input data-rx-field="quantity" data-rx-idx="' + idx + '" type="number" step="0.1" min="0" class="rx-line-qty" placeholder="0" value="' + (it.quantity || '') + '"></td>' +
        '<td class="rx-col-price">' + priceCell + '</td>' +
        '<td class="rx-col-total-qty">' + totalQtyCell + '</td>' +
        '<td class="rx-col-total">' + totalCostCell + '</td>' +
        '<td class="rx-col-remove"><button type="button" class="rx-line-remove" data-rx-remove="' + idx + '" title="Remove">✕</button></td>';

      tr.querySelector('[data-rx-remove]').addEventListener('click', function () {
        state.rxItems.splice(idx, 1);
        renderRxList();
      });

      tr.querySelectorAll('[data-rx-field]').forEach(function (inp) {
        inp.addEventListener('input', function () {
          var i = parseInt(inp.getAttribute('data-rx-idx'), 10);
          var field = inp.getAttribute('data-rx-field');
          var val = inp.value;
          if (field === 'quantity') val = parseFloat(val) || 0;
          state.rxItems[i][field] = val;
          if (field === 'drug_name') {
            var m = catalogLookup(val);
            if (m && m.unit) state.rxItems[i].unit = m.unit;
          }
        });
        // Re-render only when a drug_name commit might change derived
        // state (unit lookup, stock chip). Re-rendering on every blur
        // destroyed focus targets mid-navigation — killing ↓/↑/Enter
        // jumps between rows.
        inp.addEventListener('change', function () {
          if (inp.getAttribute('data-rx-field') === 'drug_name') renderRxList();
        });

        // Keyboard navigation is handled via a single delegated listener
        // on the container (wired once per container) — see below. Per-
        // input attachment was flaky across re-renders and could miss
        // the ArrowDown keydown, letting the browser scroll the page.

        // Wire custom autocomplete on drug_name fields. Native datalist
        // can't surface 'pick from list + advance to new row' as a
        // single keystroke flow — the custom popup below does.
        if (inp.getAttribute('data-rx-field') === 'drug_name') {
          attachHerbAutocomplete(inp);
        }
      });

      tbody.appendChild(tr);
    });
    container.appendChild(table);
    injectRxTableStyles();

    // Delegated ↑/↓/Enter navigation between rows. Wire once per
    // container — survives every renderRxList re-render. This is what
    // fixes "ArrowDown scrolls the page" when focus is on a qty input:
    // preventDefault always runs, regardless of re-render timing.
    if (! container._hmRxKeyWired) {
      container._hmRxKeyWired = true;
      container.addEventListener('keydown', function (ev) {
        if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp' && ev.key !== 'Enter') return;
        var inp = ev.target.closest('[data-rx-field]');
        if (! inp) return;
        // drug_name inputs have their own custom autocomplete that
        // handles ArrowDown/ArrowUp/Enter — let it run, otherwise
        // the row-jump fires before the suggestion commits.
        if (inp.getAttribute('data-rx-field') === 'drug_name') return;
        ev.preventDefault();
        var field = inp.getAttribute('data-rx-field');
        var i = parseInt(inp.getAttribute('data-rx-idx'), 10);
        var target = i;
        if (ev.key === 'ArrowUp') {
          target = Math.max(0, i - 1);
        } else {
          target = i + 1;
          if (target >= state.rxItems.length) {
            state.rxItems.push({ drug_name: '', quantity: 10, unit: 'g' });
            renderRxList();
            setTimeout(function () {
              var n = document.querySelector('[data-rx-field="' + field + '"][data-rx-idx="' + target + '"]');
              if (n) { n.focus(); if (n.select) n.select(); }
            }, 0);
            return;
          }
        }
        var next = document.querySelector('[data-rx-field="' + field + '"][data-rx-idx="' + target + '"]');
        if (next) { next.focus(); if (next.select) next.select(); }
      });
    }

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
        totalWeightEl.textContent = totalWeight.toFixed(1) + ' g' +
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

    // Unified fields — captured for both walk-in and teleconsult visits.
    caseRecord.blood_pressure = val('cr-bp');
    caseRecord.documents      = state.documents;

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
      // Stock-gate failures get a clear modal listing each problem
      // herb. Other errors (network, auth, validation) fall through
      // to a generic toast.
      if (HM.ui.rxStockError(e)) return;
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
  /**
   * Custom autocomplete for the herb-name input on the prescription
   * pad. Designed for keyboard-only entry:
   *
   *   1. User types → filter state.drugCatalog → render popup
   *      under the input (max 8 matches).
   *   2. ArrowDown / ArrowUp → highlight prev/next match.
   *   3. Enter →
   *        a) commit the highlighted match (or just keep typed text
   *           if nothing is highlighted),
   *        b) if this is the last row, push a new empty row,
   *        c) focus the next row's herb-name input,
   *        d) close the popup.
   *      Net effect: type-Enter-type-Enter-… moves the doctor
   *      through herb names without ever touching the mouse.
   *   4. Escape → close popup, keep input value as-is.
   *   5. Click on suggestion → same as Enter on it.
   *   6. Blur (focus moves elsewhere) → close popup after a tick so
   *      a click on a suggestion still registers.
   */
  function attachHerbAutocomplete(inp) {
    if (inp._hmAcAttached) return; // idempotent across re-renders
    inp._hmAcAttached = true;
    injectHerbAutocompleteStyles();

    var pop = null;          // <ul> popup element while open
    var matches = [];        // current filtered match list
    var hi = -1;             // highlighted index (-1 = none)

    function close(commitTyped) {
      if (pop) { try { pop.remove(); } catch (_) {} pop = null; }
      hi = -1;
    }

    function open(query) {
      var q = (query || '').toLowerCase().trim();
      var cat = state.drugCatalog || [];
      // Score-based filter: exact-prefix beats infix beats pinyin
      // contains. Cap to 8 so the popup never gets unwieldy.
      matches = cat.map(function (d) {
        var n = (d.name || '').toLowerCase();
        var py = (d.pinyin || d.name_pinyin || '').toLowerCase();
        var score = -1;
        if (!q)                 score = 0;
        else if (n === q)       score = 100;
        else if (n.indexOf(q) === 0)  score = 90;
        else if (py.indexOf(q) === 0) score = 80;
        else if (n.indexOf(q) >= 0)   score = 50;
        else if (py.indexOf(q) >= 0)  score = 40;
        return { d: d, s: score };
      }).filter(function (x) { return x.s >= 0; })
        .sort(function (a, b) { return b.s - a.s; })
        .slice(0, 8)
        .map(function (x) { return x.d; });

      if (! matches.length) { close(); return; }

      if (! pop) {
        pop = document.createElement('ul');
        pop.className = 'rx-ac-pop';
        pop.setAttribute('role', 'listbox');
        // Position relative to the wrapping td (which we set
        // position:relative on in the row markup).
        var host = inp.parentNode;
        host.appendChild(pop);
      }
      pop.innerHTML = matches.map(function (d, i) {
        var stock = (parseFloat(d.total_stock) || 0);
        var stockColor = stock <= 0 ? '#9a3a2a' : stock < 50 ? '#a16207' : '#15803d';
        return '<li role="option" data-i="' + i + '" class="rx-ac-item' + (i === hi ? ' is-active' : '') + '">' +
          '<span class="rx-ac-name">' + escapeAcHtml(d.name) + '</span>' +
          (d.specification ? '<span class="rx-ac-spec">' + escapeAcHtml(d.specification) + '</span>' : '') +
          '<span class="rx-ac-stock" style="color:' + stockColor + ';">' + stock + (d.unit || 'g') + '</span>' +
        '</li>';
      }).join('');
      // Click-to-pick (mousedown so it fires before the input's blur)
      pop.querySelectorAll('.rx-ac-item').forEach(function (li) {
        li.addEventListener('mousedown', function (ev) {
          ev.preventDefault();
          hi = parseInt(li.getAttribute('data-i'), 10);
          commitAndAdvance();
        });
      });
    }

    function escapeAcHtml(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function highlight(delta) {
      if (! matches.length) return;
      hi = (hi + delta + matches.length) % matches.length;
      if (! pop) return;
      pop.querySelectorAll('.rx-ac-item').forEach(function (li, i) {
        li.classList.toggle('is-active', i === hi);
      });
    }

    /**
     * Commit the picked herb (or the typed text if nothing highlighted)
     * and advance to the next row's herb-name input — creating a new
     * empty row if we're at the bottom.
     */
    function commitAndAdvance() {
      var idx = parseInt(inp.getAttribute('data-rx-idx'), 10);
      // Commit value
      if (hi >= 0 && matches[hi]) {
        inp.value = matches[hi].name;
        state.rxItems[idx].drug_name = matches[hi].name;
        if (matches[hi].unit) state.rxItems[idx].unit = matches[hi].unit;
      } else {
        // Free-text — keep whatever user typed
        state.rxItems[idx].drug_name = inp.value;
      }
      close();

      // Push a new row if we're at the bottom
      if (idx >= state.rxItems.length - 1) {
        state.rxItems.push({ drug_name: '', quantity: 10, unit: 'g' });
      }
      // Re-render so the stock pill / unit / new row all show
      renderRxList();
      // Focus the NEXT row's herb-name input
      var next = idx + 1;
      setTimeout(function () {
        var n = document.querySelector('[data-rx-field="drug_name"][data-rx-idx="' + next + '"]');
        if (n) { n.focus(); if (n.select) n.select(); }
      }, 0);
    }

    inp.addEventListener('input', function () {
      // Sync state immediately so the existing 'input' handler that
      // mirrors typing into state.rxItems also runs (it's defined
      // earlier in renderRxList for ALL data-rx-field inputs).
      hi = -1;
      open(inp.value);
    });

    inp.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        if (! pop) open(inp.value);
        highlight(1);
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (! pop) open(inp.value);
        highlight(-1);
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        commitAndAdvance();
      } else if (ev.key === 'Escape') {
        close();
      }
    });

    inp.addEventListener('focus', function () {
      // Reopen popup on focus so re-entering the input shows
      // suggestions again. Only opens if there's a value or catalog
      // is non-empty (avoid showing 8 random herbs on empty focus).
      if ((inp.value || '').trim() && state.drugCatalog && state.drugCatalog.length) {
        open(inp.value);
      }
    });
    inp.addEventListener('blur', function () {
      // Close after a short delay so a click on a suggestion can
      // still register before the popup vanishes.
      setTimeout(close, 120);
    });
  }

  function injectHerbAutocompleteStyles() {
    if (document.getElementById('rx-ac-style')) return;
    var s = document.createElement('style');
    s.id = 'rx-ac-style';
    s.textContent =
      '.rx-ac-pop{position:absolute;top:100%;left:0;right:0;z-index:200;' +
        'background:#fff;border:1px solid var(--border,#D8C9AE);border-radius:8px;' +
        'box-shadow:0 8px 20px rgba(36,22,8,0.12);max-height:280px;overflow-y:auto;' +
        'list-style:none;margin:4px 0 0;padding:4px 0;font-size:13px;}' +
      '.rx-ac-item{display:flex;align-items:center;gap:10px;padding:7px 12px;cursor:pointer;}' +
      '.rx-ac-item.is-active,.rx-ac-item:hover{background:var(--washi,#FAF7F2);}' +
      '.rx-ac-name{flex:1;font-weight:500;color:var(--ink,#1a1612);}' +
      '.rx-ac-spec{font-size:11px;color:var(--mu,#7a7468);}' +
      '.rx-ac-stock{font-size:11px;font-weight:600;font-family:var(--font-mono,monospace);}';
    document.head.appendChild(s);
  }

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

  // CSS for the Herb / Qty / Cost-per-g / Total-Qty / Total-Cost table.
  function injectRxTableStyles() {
    if (document.getElementById('rx-table-style')) return;
    var s = document.createElement('style');
    s.id = 'rx-table-style';
    s.textContent =
      '.rx-table{width:100%;border-collapse:collapse;font-size:var(--text-sm);}' +
      '.rx-table thead th{text-align:left;font-weight:600;font-size:var(--text-xs);letter-spacing:.04em;color:var(--stone);padding:6px 4px;border-bottom:1px solid var(--border);vertical-align:bottom;}' +
      '.rx-col-sub{font-family:var(--font-zh);font-weight:400;font-size:10px;color:var(--stone);margin-top:2px;}' +
      '.rx-table tbody td{padding:4px;border-bottom:1px dashed var(--border);vertical-align:middle;}' +
      '.rx-col-num{width:28px;color:var(--stone);font-family:var(--font-mono);font-size:var(--text-xs);text-align:center;}' +
      '.rx-col-herb{min-width:140px;}' +
      '.rx-col-herb input{width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:var(--text-sm);background:#fff;}' +
      '.rx-col-herb input:focus{outline:none;border-color:var(--gold);}' +
      '.rx-col-stock{width:26px;text-align:center;font-size:1rem;}' +
      '.rx-col-qty{width:80px;}' +
      '.rx-col-qty input{width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:var(--text-sm);text-align:right;background:#fff;}' +
      '.rx-col-qty input:focus{outline:none;border-color:var(--gold);}' +
      '.rx-col-price{text-align:right;font-family:var(--font-mono);color:var(--stone);font-size:var(--text-xs);white-space:nowrap;}' +
      '.rx-col-total-qty{text-align:right;font-family:var(--font-mono);font-size:var(--text-xs);white-space:nowrap;}' +
      '.rx-col-total{text-align:right;font-family:var(--font-mono);color:var(--gold);white-space:nowrap;}' +
      '.rx-col-remove{width:32px;text-align:center;}' +
      '.rx-line-remove{background:none;border:none;color:var(--stone);cursor:pointer;padding:4px 6px;border-radius:var(--r-sm);font-size:var(--text-base);}' +
      '.rx-line-remove:hover{background:rgba(192,57,43,0.08);color:var(--red-seal);}' +
      '@media (max-width:640px){' +
        '.rx-col-sub{display:none;}' +
        '.rx-table thead th{padding:4px 2px;font-size:10px;}' +
        '.rx-col-herb{min-width:100px;}' +
        '.rx-col-qty{width:60px;}' +
      '}';
    document.head.appendChild(s);
  }

  function injectStyle() {
    if (document.getElementById('consult-style')) return;
    var s = document.createElement('style');
    s.id = 'consult-style';
    s.textContent =
      // Online (teleconsult) layout: video pinned on the left so the
      // doctor can keep watching the patient, case record scrolls
      // independently on the right. align-items:start so the right
      // column can grow tall without the left column stretching.
      // ── Consult mode chrome ─────────────────────────────────────
      // body.is-consult-mode is toggled by pages/doctor.js when the
      // route enters #/consult/:id. Hides the portal sidebar so the
      // video + case-record rail can use the full window width — the
      // doctor doesn't need portal nav while a patient is in front
      // of them. A small floating button at top-left lets them
      // re-open the sidebar if they really do need to navigate
      // elsewhere mid-consult (rare).
      '@media (min-width: 769px){' +
        'body.is-consult-mode .sidebar{display:none !important;}' +
        'body.is-consult-mode .portal-layout{grid-template-columns:1fr !important;}' +
      '}' +
      '.consult-back{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;' +
        'background:var(--washi);border:1px solid var(--border);color:var(--ink);' +
        'font-size:12px;font-weight:500;text-decoration:none;cursor:pointer;' +
        'font-family:inherit;margin-bottom:var(--s-3);transition:all 0.15s;}' +
      '.consult-back:hover{background:var(--bg);border-color:var(--gold);}' +
      '.consult-back svg{width:12px;height:12px;}' +

      '.consult-layout--online{display:grid;grid-template-columns:1fr 540px;gap:var(--s-4);align-items:start;}' +
      // The video block — sticky to the top of the visible area while
      // the right column scrolls. Calculation accounts for the page
      // nav height + a small buffer.
      '.consult-layout--online > div:first-child{position:sticky;top:calc(var(--nav-height) + var(--s-3));align-self:start;}' +
      // The right column (#consult-side) — scrolls inside itself so
      // the doctor can move through long case-record sections without
      // losing sight of the video.
      '.consult-layout--online #consult-side{max-height:calc(100vh - var(--nav-height) - var(--s-6));overflow-y:auto;overflow-x:hidden;padding-right:6px;scrollbar-width:thin;}' +
      '.consult-layout--online #consult-side::-webkit-scrollbar{width:8px;}' +
      '.consult-layout--online #consult-side::-webkit-scrollbar-thumb{background:rgba(154,122,62,0.35);border-radius:4px;}' +
      '.consult-layout--online #consult-side::-webkit-scrollbar-thumb:hover{background:rgba(154,122,62,0.55);}' +
      '@media (max-width: 980px){.consult-layout--online{grid-template-columns:1fr;}.consult-layout--online > div:first-child{position:static;}.consult-layout--online #consult-side{max-height:none;overflow:visible;}}' +
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
      // Usage-note preset chips
      '.rx-usage-presets{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;}' +
      '.rx-usage-chip{border:1px solid var(--border);background:#fff;color:var(--ink);padding:5px 11px;' +
        'border-radius:999px;font-size:var(--text-xs);cursor:pointer;transition:all .15s;}' +
      '.rx-usage-chip:hover{border-color:var(--gold);background:rgba(201,146,42,.08);}' +
      '.rx-usage-chip:active{transform:scale(.97);}' +
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
