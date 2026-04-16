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

      uploadBlock;
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
    return '<div class="field-grid field-grid--2">' +
      '<div class="field"><label class="field-label">Duration (days) · 療程</label>' +
      '<input id="rx-days" class="field-input field-input--boxed" type="number" value="7" min="1" max="90"></div>' +
      '<div class="field"><label class="field-label">Usage · 用法</label>' +
      '<input id="rx-usage" class="field-input field-input--boxed" placeholder="e.g. 每日2次，水煎 Twice daily, decoct"></div>' +
      '</div>' +

      '<div class="text-label mt-3 mb-2">Herb Items · 藥材清單</div>' +
      '<div class="text-xs text-muted mb-2">Start typing — suggestions come from pharmacy stock. ' +
      '<span style="color: var(--sage);">● in stock</span> · ' +
      '<span style="color: var(--red-seal);">● out of stock</span> · ' +
      '<span style="color: var(--stone);">? not in catalog</span></div>' +
      '<div id="rx-items-list" class="mb-3"></div>' +
      '<datalist id="rx-catalog"></datalist>' +

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

    renderRxList();
    renderTreatments();
    renderDocuments();
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

    // Compact one-line rows — just drug · qty · unit · ✕, with stock pill
    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'rx-list-wrap';
    state.rxItems.forEach(function (it, idx) {
      var match = catalogLookup(it.drug_name);
      var stockPill;
      if (!it.drug_name) {
        stockPill = '<span class="rx-stock" title="Enter drug name" style="color:var(--stone);">—</span>';
      } else if (!match) {
        stockPill = '<span class="rx-stock" title="Not in pharmacy catalog — patient may need to source elsewhere" style="color:var(--stone);">?</span>';
      } else {
        var stock = parseFloat(match.total_stock) || 0;
        var need = parseFloat(it.quantity) || 0;
        var shortOfNeed = stock < need;
        if (stock <= 0) {
          stockPill = '<span class="rx-stock" title="Out of stock in all pharmacies" style="color:var(--red-seal);">●</span>';
        } else if (shortOfNeed) {
          stockPill = '<span class="rx-stock" title="Total stock ' + stock + ' ' + match.unit + ' — less than prescribed ' + need + '" style="color:var(--gold);">●</span>';
        } else {
          stockPill = '<span class="rx-stock" title="In stock: ' + stock + ' ' + match.unit + ' across ' + match.pharmacy_count + ' pharmacies" style="color:var(--sage);">●</span>';
        }
      }

      var row = document.createElement('div');
      row.className = 'rx-line';
      row.innerHTML =
        '<span class="rx-line-num">' + (idx + 1) + '</span>' +
        '<input data-rx-field="drug_name" data-rx-idx="' + idx + '" class="rx-line-name" placeholder="Drug · 藥名" value="' + HM.format.esc(it.drug_name || '') + '" list="rx-catalog" autocomplete="off">' +
        stockPill +
        '<input data-rx-field="quantity" data-rx-idx="' + idx + '" type="number" step="0.1" class="rx-line-qty" placeholder="Qty" value="' + (it.quantity || '') + '">' +
        '<input data-rx-field="unit" data-rx-idx="' + idx + '" class="rx-line-unit" placeholder="Unit" value="' + HM.format.esc(it.unit || 'g') + '">' +
        '<button type="button" class="rx-line-remove" data-rx-remove="' + idx + '" title="Remove">✕</button>';

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
        // Re-render on blur to refresh the stock pill / unit cell
        inp.addEventListener('change', function () { renderRxList(); });
        inp.addEventListener('blur',   function () { renderRxList(); });
      });

      wrap.appendChild(row);
    });
    container.appendChild(wrap);

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
      '.rx-line-remove:hover{color:var(--red-seal);background:rgba(192,57,43,.08);}';
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
