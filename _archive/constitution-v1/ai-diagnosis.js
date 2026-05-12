/**
 * AI Constitution Diagnosis — v2.
 *
 * 10-dimension TCM questionnaire with bilingual prompts, safety
 * follow-ups, radar chart + horizontal bar visualisations, and
 * pattern-based herb / food / lifestyle advice.
 *
 * Results are submitted to the backend questionnaires table so a
 * licensed doctor reviews before any personalised prescription
 * is shown to the patient (consistent with the tongue-review and
 * shop safety-gate workflows).
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  // ── Brief #14a: dictionaries now live in the shared component
  //     v2/assets/js/components/constitution-card.js. This file pulls
  //     them back via the HM.constitutionCard namespace so all the
  //     existing references below (DIMS, QS, FOLLOW_UPS, HERB_MAP) keep
  //     working unchanged. NO behavior change for the patient.
  if (!window.HM || !HM.constitutionCard) {
    console.error('[ai-diagnosis] HM.constitutionCard component is missing — load v2/assets/js/components/constitution-card.js before this file.');
  }
  var DIMS       = (HM.constitutionCard && HM.constitutionCard.DIMS) || {};
  var QS         = (HM.constitutionCard && HM.constitutionCard.QS) || [];
  var FOLLOW_UPS = (HM.constitutionCard && HM.constitutionCard.FOLLOW_UPS) || {};
  var HERB_MAP   = (HM.constitutionCard && HM.constitutionCard.HERB_MAP) || {};

  // (QS / FOLLOW_UPS / HERB_MAP moved to constitution-card.js — see above.)

  // ── State ──────────────────────────────────────────────────
  var state = { answers: {}, dims: {}, followUpAlerts: [], qIndex: 0, healthConcerns: '' };

  async function render(el) {
    state = {
      answers: {}, dims: {}, followUpAlerts: [], qIndex: 0,
      tongueId: null, tongueReport: null, skippedTongue: false,
    };
    renderIntro(el);
  }

  // Single-session intro — no more separate tongue vs quiz buttons.
  // One "Start" button kicks off: tongue photo → 10 questions → combined report.
  function renderIntro(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">AI Wellness Analysis · AI 健康評估</div>' +
      '<h1 class="page-title">Full TCM Wellness Check · 完整體質評估</h1>' +
      '<p class="text-muted mt-1">One guided session covering tongue observation and a 10-dimension constitution questionnaire. ' +
      'Your combined wellness insights go to a licensed TCM practitioner for review and personalised advice. ' +
      '<span style="font-family: var(--font-zh);">一次性完成舌象觀察與 10 維體質問卷，結果送交註冊中醫師審核，獲取個人化建議。</span></p>' +
      '</div>' +

      // Sticky disclaimer — MDA 2012 compliance. Shown on every screen
      // in the AI-wellness flow.
      '<div class="ai-wellness-disclaimer">' +
        '<strong>⚠️ Wellness education, not a medical diagnosis.</strong> This AI tool provides TCM-based wellness insights only. ' +
        'For diagnosis or treatment, please consult a licensed TCM practitioner.' +
        '<br><span style="font-family: var(--font-zh);"><strong>此為健康教育工具，非醫療診斷。</strong>如需診斷或治療，請諮詢註冊中醫師。</span>' +
      '</div>' +

      // Flow explainer
      '<div class="card card--pad-lg mb-4">' +
      '<div class="grid-2" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--s-3);">' +
      aidStepCard('1', '👅', 'Tongue Photo', '舌頭照片', 'Upload a clear photo') +
      aidStepCard('2', '📝', '10 Questions', '10 題問卷', 'Bilingual TCM quiz') +
      aidStepCard('3', '🗺️', 'Constitution Map', '體質地圖', 'Radar + 10 dimensions') +
      aidStepCard('4', '🩺', 'Doctor Review', '醫師審核', 'Personalised plan') +
      '</div>' +
      '<div class="flex gap-2 mt-4 flex-wrap">' +
      '<button class="btn btn--primary btn--lg" id="aid-start-combined">🚀 Start AI Wellness Assessment · 開始 AI 健康評估 →</button>' +
      '</div>' +
      '<p class="text-xs text-muted mt-3">Both the tongue photo AND the 10-question quiz are required for a complete constitution assessment — your reviewing doctor needs both to interpret accurately. Takes about 3–5 minutes. All data stays encrypted. ' +
      '<span style="font-family: var(--font-zh);">舌診與問卷皆為必須，醫師需兩項資料方能完整審核。約 3–5 分鐘，資料加密保護。</span></p>' +
      '</div>' +

      // Combined history
      '<div class="mt-6">' +
      '<div class="text-label mb-3">📜 My Past Records · 過往記錄</div>' +
      '<div id="aid-past">Loading…</div>' +
      '</div>';

    injectStyle();
    document.getElementById('aid-start-combined').addEventListener('click', function () {
      state.skippedTongue = false;
      renderTongueStep(el);
    });
    // Skip-tongue button removed — tongue + quiz are both required.
    // state.skippedTongue is kept on the state object but always false
    // so the rest of the flow (progress counter, submit payload) keeps
    // working without conditional branches.

    // Load combined history
    loadPastReports();
  }

  function aidStepCard(n, icon, en, zh, desc) {
    return '<div class="aid-step-card">' +
      '<div class="aid-step-num">' + n + '</div>' +
      '<div class="aid-step-icon">' + icon + '</div>' +
      '<div class="aid-step-en">' + en + '</div>' +
      '<div class="aid-step-zh">' + zh + '</div>' +
      '<div class="aid-step-desc">' + desc + '</div>' +
      '</div>';
  }

  // ── Step 1/11 — tongue photo ───────────────────────────────
  // Uploads the photo, polls for AI analysis, then transitions to the
  // 10-question quiz. The returned diagnosis id is kept in state so the
  // questionnaire submit can reference it as a single session.
  function renderTongueStep(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Step 1 of 11 · 第 1 / 11 步</div>' +
      '<h1 class="page-title">👅 Tongue Photo · 舌頭照片</h1>' +
      '<div class="aid-progress"><div class="aid-progress-fill" style="width: 9%;"></div></div>' +
      '</div>' +

      '<div class="card card--pad-lg" style="max-width: 700px;">' +
      '<p class="text-sm text-muted mb-4"><strong>Tips for best results · 最佳效果小貼士：</strong><br>' +
      '• Natural lighting, no filter · 自然光線，不使用濾鏡<br>' +
      '• Extend tongue fully, relaxed · 舌頭完全伸出，放鬆<br>' +
      '• Clean tongue (not right after eating) · 乾淨舌面（勿剛進食後）<br>' +
      '• Phone camera, 30–60 cm away · 手機距離 30–60 公分</p>' +

      '<button type="button" class="btn btn--primary btn--lg btn--block" id="aid-tongue-open">' +
      '📷 Open Tongue Camera · 開啟舌頭相機' +
      '</button>' +
      '<p class="text-xs text-muted mt-2" style="text-align:center;">A guided frame will help you align your tongue for the best reading. ' +
      '<span style="font-family: var(--font-zh);">引導框可協助您對準舌頭以獲得最佳分析。</span></p>' +

      '<div id="aid-tongue-status" style="display:none; margin-top: var(--s-4);"></div>' +

      '<div class="flex gap-2 mt-4">' +
      '<button class="btn btn--ghost" id="aid-tongue-back">← Back · 返回</button>' +
      '<button class="btn btn--primary" id="aid-tongue-next" style="margin-left:auto; display:none;">Continue to Questions · 繼續問卷 →</button>' +
      '</div>' +
      '</div>';

    injectStyle();
    document.getElementById('aid-tongue-back').addEventListener('click', function () { renderIntro(el); });
    // Skip-this-step button removed — tongue photo is required to
    // proceed. Continue button only enables after a successful capture
    // (or AI failure where the doctor will review manually).
    document.getElementById('aid-tongue-next').addEventListener('click', function () {
      state.qIndex = 0;
      renderQuestion(el);
    });
    document.getElementById('aid-tongue-open').addEventListener('click', function () {
      HM.tongueCapture.open({
        onCapture: function (file) { handleTongueFile(file); },
      });
    });
  }

  async function handleTongueFile(file) {
    if (!file) return;

    var box = document.getElementById('aid-tongue-status');
    box.style.display = 'block';
    box.innerHTML =
      '<div class="flex gap-3" style="align-items:center;">' +
      '<img id="aid-tongue-preview" style="width:80px;height:80px;object-fit:cover;border-radius:var(--r-md);border:1px solid var(--border);">' +
      '<div><strong>✓ Photo uploaded · 照片已上傳</strong>' +
      '<div class="text-muted text-sm mt-1"><span class="spinner"></span> AI analysing… · AI 分析中…</div></div>' +
      '</div>';

    var reader = new FileReader();
    reader.onload = function (ev) {
      var img = document.getElementById('aid-tongue-preview');
      if (img) img.src = ev.target.result;
    };
    reader.readAsDataURL(file);

    try {
      var res = await HM.api.patient.uploadTongue(file);
      var diag = res.diagnosis;
      state.tongueId = diag.id;

      // The backend now runs analysis synchronously, so the first response
      // usually already has a terminal status. Short-circuit when possible
      // and fall back to polling only if it's still "processing".
      if (diag.status === 'completed') {
        state.tongueReport = diag;
        showTongueComplete(diag, box);
      } else if (diag.status === 'failed') {
        showTongueFailed(box, diag);
      } else {
        pollTongueAnalysis(diag.id, box);
      }
    } catch (err) {
      // Translate the generic browser-level errors into something the
      // patient can act on. Safari's "Load failed" + status 0 means the
      // request never landed (network / CORS / payload too large for the
      // server's body limit). 413 / 422 are size / validation errors.
      var raw = (err && err.message) || 'Upload failed';
      var isNetwork = /load failed|failed to fetch|network|abort/i.test(raw) || err.status === 0;
      var isTooBig  = err.status === 413 || /large|exceeds|max:/i.test(raw);
      var hint, hintZh;
      if (isTooBig) {
        hint   = 'The photo is too large. Try a smaller image (under 8 MB) or use the live camera instead.';
        hintZh = '照片過大，請使用較小的圖片（8 MB 以下），或改用實時拍攝。';
      } else if (isNetwork) {
        hint   = 'Network or upload issue — please check your connection and retry. If you picked a photo from your gallery, try the live camera instead so the photo is auto-compressed.';
        hintZh = '網路或上傳發生問題，請檢查網路後重試。如果是從相簿挑選的照片，請改用實時拍攝（系統會自動壓縮）。';
      } else {
        hint   = 'Please retake the photo and try again.';
        hintZh = '請重新拍攝後再試。';
      }
      box.innerHTML = '<div class="alert alert--danger"><div class="alert-body">' +
        '<strong>' + HM.format.esc(raw) + '</strong><br>' +
        '<span lang="en">' + HM.format.esc(hint) + '</span>' +
        '<span lang="zh" style="font-family: var(--font-zh);">' + HM.format.esc(hintZh) + '</span>' +
        '</div></div>';
      // Don't enable Continue here — patient must succeed at the
      // tongue capture before moving on.
    }
  }

  function showTongueFailed(box, diag) {
    // Surface the actual reason from raw_response so you can see whether
    // the failure was image-fetch, API key, parsing, etc. Generic fallback
    // when no reason is present.
    var reason = '';
    try {
      var raw = diag && diag.raw_response;
      if (typeof raw === 'string') { raw = JSON.parse(raw); }
      if (raw && raw.error) reason = raw.error;
    } catch (_) {}
    box.innerHTML = '<div class="alert alert--warning"><div class="alert-body">' +
      '<strong>AI analysis could not complete.</strong>' +
      (reason
        ? '<div class="text-xs text-muted mt-1" style="font-family: var(--font-mono);">Reason: ' + HM.format.esc(reason) + '</div>'
        : '') +
      '<div class="mt-2">You can still continue — the doctor will see your photo and analyse it manually. ' +
      '<span style="font-family: var(--font-zh);">AI 分析未能完成，醫師會親自審閱您的照片。</span></div>' +
      '</div></div>';
    document.getElementById('aid-tongue-next').style.display = 'inline-flex';
  }

  function pollTongueAnalysis(id, box) {
    var attempts = 0;
    var iv = setInterval(async function () {
      attempts++;
      try {
        var r = await HM.api.patient.getDiagnosis(id);
        var d = r.diagnosis;
        if (d.status === 'completed') {
          clearInterval(iv);
          state.tongueReport = d;
          showTongueComplete(d, box);
        } else if (d.status === 'failed' || attempts > 40) {
          clearInterval(iv);
          showTongueFailed(box, d);
        }
      } catch (_) {}
    }, 3000);
  }

  /**
   * Convert a numeric health_score (0-100) to a qualitative band
   * for patient-facing display. MDA-compliance: patients shouldn't
   * see a numeric "health score" from an AI tool — that looks like
   * a medical measurement. Doctors still see the number in their
   * review modal for clinical reference.
   */
  function healthBand(score) {
    if (score == null) return { key: 'unknown', en: '—', zh: '—', color: 'var(--stone)' };
    if (score >= 80) return { key: 'balanced',    en: 'Balanced · 平和',            zh: '平和', color: 'var(--sage)' };
    if (score >= 60) return { key: 'mild',        en: 'Mildly imbalanced · 輕度失衡', zh: '輕度失衡', color: 'var(--gold)' };
    return               { key: 'attention',    en: 'Needs attention · 需要關注',   zh: '需要關注', color: 'var(--red-seal)' };
  }

  function showTongueComplete(d, box) {
    var report = d.constitution_report || {};
    var c = report.constitution || {};
    var band = healthBand(d.health_score);
    box.innerHTML =
      '<div class="card card--bordered" style="border-left:3px solid var(--sage);">' +
      '<div class="flex-between mb-2"><strong>✓ AI analysis complete · AI 分析完成</strong>' +
      (band.key !== 'unknown' ? '<span style="font-weight:600;color:' + band.color + ';">' + band.en + '</span>' : '') +
      '</div>' +
      (c.name_en
        ? '<div class="text-sm">Initial constitution: <strong>' + HM.format.esc(c.name_en) + '</strong>' +
          (c.name_zh ? ' · <span style="font-family:var(--font-zh);">' + HM.format.esc(c.name_zh) + '</span>' : '') +
          '</div>'
        : '') +
      '<p class="text-xs text-muted mt-2">The quiz below will refine this with symptom-based dimensions. ' +
      '<span style="font-family:var(--font-zh);">下方問卷將進一步補充症狀資訊。</span></p>' +
      '</div>';
    document.getElementById('aid-tongue-next').style.display = 'inline-flex';
  }

  // ── Combined history: tongue scans + constitution reports, chronological ──
  async function loadPastReports() {
    var host = document.getElementById('aid-past');
    if (!host) return;
    try {
      var results = await Promise.all([
        HM.api.patient.listQuestionnaires().catch(function () { return { data: [] }; }),
        HM.api.patient.listDiagnoses().catch(function () { return { data: [] }; }),
      ]);
      var items = [];

      // Brief #14a-fix-7 — collect tongue ids referenced by
      // constitution questionnaires submitted as part of a combined
      // session, so we can hide the duplicate standalone tongue card
      // from the list. The detail view (renderApprovedReport) already
      // inlines the tongue analysis into the constitution report, so
      // showing both as separate cards just confuses the patient.
      // Standalone tongue scans (no paired questionnaire) are NOT
      // affected and continue to render as their own card.
      var linkedTongueIds = new Set();

      // Constitution questionnaires
      var qRows = (results[0] && results[0].data) || [];
      qRows.forEach(function (row) {
        var s = row.symptoms;
        if (typeof s === 'string') { try { s = JSON.parse(s); } catch (_) { s = {}; } }
        s = s || {};
        if (s.kind !== 'ai_constitution_v2') return;
        // Capture the linked tongue id (if this was a combined session).
        // Coerce via Number(...) so the later .has() check matches whether
        // the backend serialised the id as int or string.
        if (s.tongue_assessment_id) {
          linkedTongueIds.add(Number(s.tongue_assessment_id));
        }
        items.push({
          kind: 'constitution',
          // Brief #14a-fix-8 — flag combined sessions so the list card
          // can label them "Tongue + Constitution" rather than just
          // "Constitution". Detail view already inlines the tongue
          // analysis; this just makes the list reflect that.
          has_tongue: !!s.tongue_assessment_id,
          id: row.id,
          created_at: row.created_at,
          review_status: s.review_status || 'pending',
          summary: s.patterns && s.patterns.length
            ? ((s.patterns[0].c || '') + (s.patterns[0].l ? ' · ' + s.patterns[0].l : ''))
            : 'Constitution report',
          has_advice: !!(s.doctor_comment || (s.doctor_advice && (s.doctor_advice.herbs || []).length)),
        });
      });

      // Tongue scans
      var tRows = (results[1] && results[1].data) || [];
      tRows.forEach(function (t) {
        // Brief #14a-fix-7 — hide tongue scans that are already
        // represented by a paired constitution questionnaire above.
        // The patient's combined-detail view (renderApprovedReport)
        // inlines the tongue image + deep analysis into that card.
        if (linkedTongueIds.has(Number(t.id))) return;
        var report = t.constitution_report || {};
        var c = report.constitution || {};
        items.push({
          kind: 'tongue',
          id: t.id,
          created_at: t.created_at,
          review_status: t.review_status || 'pending',
          summary: c.name_en || c.name_zh || 'Tongue scan',
          image_url: t.image_url,
          health_score: t.health_score,
          has_advice: !!(t.doctor_comment || (t.medicine_suggestions || []).length),
        });
      });

      if (!items.length) {
        host.innerHTML = '<div class="card"><p class="text-muted text-center" style="padding: var(--s-4);">No records yet. Start either assessment above. · 尚無記錄，請從上方開始。</p></div>';
        return;
      }

      // Sort newest first
      items.sort(function (a, b) { return (new Date(b.created_at)) - (new Date(a.created_at)); });

      host.innerHTML = '';
      items.forEach(function (it) { host.appendChild(renderHistoryCard(it)); });
    } catch (e) {
      host.innerHTML = '<div class="card"><p class="text-muted text-center" style="padding: var(--s-4);">Could not load records.</p></div>';
    }
  }

  function renderHistoryCard(it) {
    var card = document.createElement('div');
    card.className = 'card card--clickable mb-2';
    card.style.cursor = 'pointer';

    var statusBadge = {
      pending:       '<span class="badge">⏳ Pending review · 待審核</span>',
      approved:      '<span class="badge badge--success">✓ Reviewed · 已審核</span>',
      needs_changes: '<span class="badge badge--danger">⚠ Needs follow-up · 需跟進</span>',
    }[it.review_status] || '';

    var typeBadge;
    if (it.kind === 'tongue') {
      typeBadge = '<span class="badge" style="background:rgba(184,150,90,.15);color:var(--gold);">👅 Tongue · 舌診</span>';
    } else if (it.has_tongue) {
      // Brief #14a-fix-8 — combined session: one card holds both the
      // tongue scan and the constitution quiz, so name both in the badge.
      typeBadge = '<span class="badge" style="background:rgba(122,140,114,.15);color:var(--sage);">👅🧭 Tongue + Constitution · 舌診 + 體質</span>';
    } else {
      typeBadge = '<span class="badge" style="background:rgba(122,140,114,.15);color:var(--sage);">🧭 Constitution · 體質</span>';
    }

    var imgHtml = (it.kind === 'tongue' && it.image_url)
      ? HM.format.img(it.image_url, {
          style: 'width:56px;height:56px;border-radius:var(--r-sm);border:1px solid var(--border);flex-shrink:0;',
          icon: '👅', title: 'Photo unavailable · 圖片已不存在',
        })
      : '<div style="width:56px;height:56px;border-radius:var(--r-sm);background:var(--washi);display:flex;align-items:center;justify-content:center;font-size:1.6rem;flex-shrink:0;">' + (it.kind === 'tongue' ? '👅' : '🧭') + '</div>';

    card.innerHTML = '<div class="flex gap-3" style="align-items:center;">' +
      imgHtml +
      '<div style="flex:1;">' +
      '<div class="flex gap-2 mb-1" style="align-items:center;flex-wrap:wrap;">' + typeBadge + statusBadge + '</div>' +
      '<div class="card-title" style="font-size: var(--text-base);">' + HM.format.esc(it.summary) + '</div>' +
      '<div class="text-xs text-muted mt-1">' + HM.format.datetime(it.created_at) +
      (it.review_status === 'approved' && it.has_advice ? ' · 💬 Doctor has added advice' : '') +
      (it.kind === 'tongue' && it.health_score != null ? ' · ' + healthBand(it.health_score).en : '') +
      '</div>' +
      '</div>' +
      '<div style="text-align:right;">' +
      '<div class="text-xs text-muted">View →</div>' +
      '</div>' +
      '</div>';

    card.addEventListener('click', function () {
      if (it.kind === 'tongue') location.hash = '#/tongue/' + it.id;
      else                      location.hash = '#/wellness-assessment/' + it.id;
    });
    return card;
  }

  function renderQuestion(el) {
    var q = QS[state.qIndex];
    var step = state.qIndex + 1;
    var total = QS.length;
    // Overall progress includes the tongue step (unless skipped) + 10 Qs
    // + concerns + review. +1 for concerns step added after QS.
    var totalSteps = state.skippedTongue ? (total + 2) : (total + 3);
    var currentStep = state.skippedTongue ? step : step + 1;
    var pct = Math.round((currentStep / totalSteps) * 100);

    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">' + q.mod + '</div>' +
      '<div class="flex-between mt-2">' +
      '<div class="text-sm text-muted">Step ' + currentStep + ' of ' + totalSteps + ' · Question ' + step + ' / ' + total + '</div>' +
      '<div class="text-sm text-muted">' + pct + '%</div>' +
      '</div>' +
      '<div class="aid-progress"><div class="aid-progress-fill" style="width: ' + pct + '%;"></div></div>' +
      '</div>' +

      '<div class="grid-2" style="grid-template-columns: 1fr 300px; gap: var(--s-5); align-items: start;">' +

      '<div>' +
      '<h2 class="mb-2">' + HM.format.esc(q.titleEn) + '</h2>' +
      '<p class="text-muted mb-4" style="font-family: var(--font-zh);">' + HM.format.esc(q.titleZh) + '</p>' +
      '<div id="aid-opts"></div>' +

      '<div class="flex gap-2 mt-4">' +
      (state.qIndex > 0 ? '<button class="btn btn--ghost" id="aid-back">← Back · 上一題</button>' : '') +
      '<button class="btn btn--primary" id="aid-next" disabled>' + (state.qIndex === total - 1 ? 'Continue · 繼續' : 'Next · 下一題') + ' →</button>' +
      '</div>' +
      '</div>' +

      '<div class="card" style="padding: var(--s-4); position: sticky; top: var(--s-4);">' +
      '<div class="text-label mb-3">Live Dimensions · 即時體質</div>' +
      '<div id="aid-live"></div>' +
      '</div>' +

      '</div>';

    injectStyle();
    renderOptions(q);
    renderLive();

    if (state.answers[q.id] !== undefined) {
      document.getElementById('aid-next').disabled = false;
    }
    if (state.qIndex > 0) {
      document.getElementById('aid-back').addEventListener('click', function () {
        state.qIndex--;
        renderQuestion(el);
      });
    }
    document.getElementById('aid-next').addEventListener('click', function () {
      if (q.followUp && state.answers[q.id] !== undefined && state.answers[q.id] === q.fuTrigger) {
        renderFollowUp(el, q);
      } else {
        advance(el);
      }
    });
  }

  function renderOptions(q) {
    var host = document.getElementById('aid-opts');
    host.innerHTML = q.opts.map(function (opt, i) {
      var sel = state.answers[q.id] === opt.v ? ' aid-opt--selected' : '';
      return '<button type="button" class="aid-opt' + sel + '" data-idx="' + i + '">' +
        '<div class="aid-opt-en">' + HM.format.esc(opt.t) + '</div>' +
        '<div class="aid-opt-zh">' + HM.format.esc(opt.s) + '</div>' +
        '</button>';
    }).join('');

    host.querySelectorAll('.aid-opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        var opt = q.opts[idx];
        state.answers[q.id] = opt.v;
        state.dims[q.dim] = opt.v;
        host.querySelectorAll('.aid-opt').forEach(function (b) { b.classList.remove('aid-opt--selected'); });
        btn.classList.add('aid-opt--selected');
        document.getElementById('aid-next').disabled = false;
        renderLive();
      });
    });
  }

  function renderLive() {
    var host = document.getElementById('aid-live');
    if (!host) return;
    var keys = Object.keys(state.dims);
    if (!keys.length) {
      host.innerHTML = '<p class="text-xs text-muted">Answers will fill this panel as you go. · 您的答案會即時顯示於此。</p>';
      return;
    }
    host.innerHTML = keys.map(function (k) {
      var v = state.dims[k];
      var meta = DIMS[k];
      var color = v === 0 ? 'var(--sage)' : Math.abs(v) >= 2 ? 'var(--red-seal)' : 'var(--gold)';
      var sign = v > 0 ? '+' + v : v === 0 ? '0' : v;
      return '<div style="padding: 6px 0; border-bottom: 1px solid var(--border);">' +
        '<div class="flex-between" style="font-size: var(--text-xs);">' +
        '<span style="font-weight: 500;">' + meta.enShort + '</span>' +
        '<span style="color: ' + color + '; font-family: var(--font-mono);">[' + sign + ']</span>' +
        '</div>' +
        '<div style="font-family: var(--font-zh); font-size: var(--text-xs); color: var(--stone);">' + meta.zhShort + '</div>' +
        '</div>';
    }).join('');
  }

  // ── Safety follow-ups ──────────────────────────────────────
  function renderFollowUp(el, q) {
    var fu = FOLLOW_UPS[q.id];
    if (!fu) { advance(el); return; }

    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label" style="color: var(--red-seal);">' + fu.title + '</div>' +
      '</div>' +

      '<div class="card card--pad-lg" style="border-left: 3px solid var(--red-seal); max-width: 780px;">' +
      '<h2 class="mb-2">' + HM.format.esc(fu.question) + '</h2>' +
      '<p class="text-muted mb-4" style="font-family: var(--font-zh);">' + HM.format.esc(fu.questionZh) + '</p>' +

      '<div class="alert alert--info mb-4">' +
      '<div class="alert-body text-sm">' +
      '<strong>Why we ask · 為何詢問</strong><br>' +
      HM.format.esc(fu.purpose) + '<br>' +
      '<span style="font-family: var(--font-zh);">' + HM.format.esc(fu.purposeZh) + '</span>' +
      '</div></div>' +

      '<div id="aid-fu-alert" class="alert alert--danger mb-4" style="display: none;">' +
      '<div class="alert-body">' + HM.format.esc(fu.alert) + '</div></div>' +

      '<div class="flex gap-2">' +
      '<button class="btn btn--ghost btn--lg" id="aid-fu-no">No · 否</button>' +
      '<button class="btn btn--danger btn--lg" id="aid-fu-yes">Yes · 是</button>' +
      '<button class="btn btn--primary btn--lg" id="aid-fu-proceed" style="display: none;">I understand, continue · 繼續測評</button>' +
      '</div>' +
      '</div>';

    document.getElementById('aid-fu-no').addEventListener('click', function () { advance(el); });
    document.getElementById('aid-fu-yes').addEventListener('click', function () {
      document.getElementById('aid-fu-alert').style.display = 'block';
      document.getElementById('aid-fu-no').disabled = true;
      document.getElementById('aid-fu-yes').disabled = true;
      document.getElementById('aid-fu-proceed').style.display = 'inline-flex';
      state.followUpAlerts.push({ alert: fu.alert, purposeZh: fu.purposeZh });
    });
    document.getElementById('aid-fu-proceed').addEventListener('click', function () { advance(el); });
  }

  function advance(el) {
    if (state.qIndex < QS.length - 1) {
      state.qIndex++;
      renderQuestion(el);
    } else {
      // After the 10-dim scoring is done, ask the patient if there's
      // anything specific they want the doctor to know. Free-text,
      // optional. Gives the reviewing doctor context the fixed-choice
      // questions can't capture (recent events, medications, goals).
      renderConcerns(el);
    }
  }

  // ── Current health concerns step ───────────────────────────
  // A free-text capture right before the report screen. Kept optional
  // so we don't block patients who just want the AI read-out, but
  // surfaces prominently on the doctor review modal so the reviewer
  // sees it alongside the dimensions.
  function renderConcerns(el) {
    // Update progress: this sits between Q10 and review.
    var totalSteps = state.skippedTongue ? (QS.length + 2) : (QS.length + 3);
    var currentStep = state.skippedTongue ? (QS.length + 1) : (QS.length + 2);
    var pct = Math.round((currentStep / totalSteps) * 100);

    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">🩺 Current Health Concerns · 目前健康狀況</div>' +
      '<div class="flex-between mt-2">' +
      '<div class="text-sm text-muted">Step ' + currentStep + ' of ' + totalSteps + ' · Additional info</div>' +
      '<div class="text-sm text-muted">' + pct + '%</div>' +
      '</div>' +
      '<div class="aid-progress"><div class="aid-progress-fill" style="width: ' + pct + '%;"></div></div>' +
      '</div>' +

      '<div style="max-width: 760px;">' +
      '<h2 class="mb-2">Anything specific you\'d like the doctor to know?</h2>' +
      '<p class="text-muted mb-4" style="font-family: var(--font-zh);">您現在有任何特別想告訴醫師的健康問題嗎？</p>' +

      '<p class="text-sm text-muted mb-3">' +
      'Tell us about your current symptoms, recent events, medications you take, or any goals for this consultation. The doctor sees this alongside your AI report. ' +
      '<span style="font-family: var(--font-zh);">請描述目前的症狀、最近身體變化、正在服用的藥物，或您想解決的健康問題。醫師審核報告時會一併參考。</span>' +
      '</p>' +

      '<textarea id="aid-concerns" class="field-input field-input--boxed" rows="7" ' +
      'placeholder="e.g. Lower back pain for 3 weeks after lifting heavy boxes; taking paracetamol occasionally. Sleep has worsened. ' +
      '例：三週前搬重物後腰痛持續，偶爾服用止痛藥，睡眠變差。" style="width:100%;">' +
      HM.format.esc(state.healthConcerns || '') +
      '</textarea>' +
      '<div class="text-xs text-muted mt-1">Optional — leave blank if you just want the AI read-out. · 非必填，如僅需 AI 報告可留空。</div>' +

      '<div class="flex gap-2 mt-4">' +
      '<button class="btn btn--ghost" id="aid-concerns-back">← Back · 上一題</button>' +
      '<button class="btn btn--primary" id="aid-concerns-next">Generate Report · 生成報告 →</button>' +
      '</div>' +
      '</div>';

    injectStyle();

    var textarea = document.getElementById('aid-concerns');
    textarea.addEventListener('input', function () {
      state.healthConcerns = textarea.value;
    });
    textarea.focus();

    document.getElementById('aid-concerns-back').addEventListener('click', function () {
      state.healthConcerns = textarea.value;
      state.qIndex = QS.length - 1;
      renderQuestion(el);
    });
    document.getElementById('aid-concerns-next').addEventListener('click', function () {
      state.healthConcerns = textarea.value.trim();
      renderReport(el);
    });
  }

  // ── Pattern detection + lifestyle tips ─────────────────────
  // Both helpers now live in the shared HM.constitutionCard component
  // (Brief #14a). Re-bound here so the existing call sites below stay
  // unchanged. NO behavior change.
  var getConstitution     = (HM.constitutionCard && HM.constitutionCard.getConstitution)     || function () { return []; };
  var buildLifestyleTips  = (HM.constitutionCard && HM.constitutionCard.buildLifestyleTips)  || function () { return []; };

  // ── REPORT ─────────────────────────────────────────────────
  // The patient's pre-submit report shows ONLY the dimensions + constitution
  // pills (no herb/food/lifestyle advice). Advice is reserved for the
  // doctor-approved version on the detail page.
  function renderReport(el) {
    var dims = state.dims;
    Object.keys(DIMS).forEach(function (k) { if (!(k in dims)) dims[k] = 0; });

    var types = getConstitution(dims);
    var alerts = state.followUpAlerts || [];

    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Wellness Report · 健康報告</div>' +
      '<h1 class="page-title">Your 10-Dimension Profile</h1>' +
      '<p class="text-muted mt-1">Assessment complete. Submit for TCM practitioner review — your personalised herb, food and lifestyle advice will appear here after approval.</p>' +
      '</div>' +

      // Sticky MDA-compliance disclaimer
      '<div class="ai-wellness-disclaimer">' +
        '<strong>⚠️ Wellness education, not a medical diagnosis.</strong> Insights based on TCM tradition only. ' +
        'For diagnosis or treatment, please consult a licensed TCM practitioner.' +
        '<br><span style="font-family: var(--font-zh);"><strong>此為健康教育工具，非醫療診斷。</strong>如需診斷或治療，請諮詢註冊中醫師。</span>' +
      '</div>' +

      (alerts.length ? renderAlerts(alerts) : '') +

      // Constitution pills
      '<div class="card card--pad-lg mb-4">' +
      '<div class="text-label mb-3">Wellness Constitution · 體質分析</div>' +
      '<div class="flex gap-2 flex-wrap mb-4">' +
      types.map(function (t) {
        var colorMap = { green: 'var(--sage)', yellow: 'var(--gold)', red: 'var(--red-seal)', blue: '#6699bb' };
        var c = colorMap[t.col];
        return '<span class="aid-pill" style="background:' + c + '22; color:' + c + '; border:1px solid ' + c + '66;">' +
          HM.format.esc(t.l) + ' · ' + HM.format.esc(t.c) + '</span>';
      }).join('') +
      '</div>' +
      '<div style="font-size: var(--text-sm); line-height: var(--leading-relaxed); color: var(--stone);">' +
      types.map(function (t) {
        return '<div class="mb-2">' +
          '<strong style="color: var(--ink);">' + HM.format.esc(t.c) + ' · ' + HM.format.esc(t.l) + '</strong>' +
          '<div class="mt-1">' + HM.format.esc(t.d) + '</div>' +
          '<div style="font-family: var(--font-zh); font-size: var(--text-xs); color: var(--stone);">' + HM.format.esc(t.dZh) + '</div>' +
          '</div>';
      }).join('') +
      '</div>' +

      // High-pressure warning for qi_xu >= 2
      (dims.qi_xu >= 2 ? (
        '<div class="alert alert--danger mt-4" style="border-left-width: 4px;">' +
        '<div class="alert-icon">⚠️</div>' +
        '<div class="alert-body">' +
        '<strong>High-Pressure Risk · 高壓風險預警</strong><br>' +
        '氣之盈虧 [+2] — Your body is in <em>high-pressure running mode</em>. Not simply high energy, but upward-surging Qi with excessive systemic pressure. ' +
        '<span style="font-family: var(--font-zh);">氣機上衝、系統壓力過大。若不調降，長期可能耗損元氣，甚至造成血管壓力過大（高血壓風險）。</span>' +
        '</div></div>'
      ) : '') +

      '</div>' +

      // Radar chart + dimension bars
      '<div class="grid-2" style="grid-template-columns: 360px 1fr; gap: var(--s-5); align-items: start; margin-bottom: var(--s-4);">' +
      '<div class="card card--pad-lg">' +
      '<div class="text-label mb-2">Radar Chart · 雷達圖</div>' +
      '<div class="text-xs text-muted mb-3">Distance from centre = severity. Balanced = near centre.</div>' +
      renderRadar(dims) +
      '</div>' +
      '<div class="card card--pad-lg">' +
      '<div class="text-label mb-3">10 Dimensions · 10 維體質</div>' +
      renderDimBars(dims) +
      '</div>' +
      '</div>' +

      // What comes next
      '<div class="alert alert--info mb-4">' +
      '<div class="alert-icon">🩺</div>' +
      '<div class="alert-body">' +
      '<strong>Next step · 下一步</strong><br>' +
      'Submit this report for a licensed TCM doctor to review. They will personalise your herb suggestions, food advice, and lifestyle tips based on your profile — and you will see the approved plan back on this page. ' +
      '<span style="font-family: var(--font-zh);">送出後由持證中醫師審核，您將收到個人化的草藥、飲食與生活建議。</span>' +
      '</div></div>' +

      // PDPA §6 consent — store the event in audit_logs on submit.
      '<div id="aid-consent-box" style="background: var(--washi); padding: var(--s-3); border-radius: var(--r-sm); border-left: 3px solid var(--gold); margin-bottom: var(--s-4);">' +
        '<label style="display: flex; gap: var(--s-2); align-items: flex-start; cursor: pointer;">' +
          '<input type="checkbox" id="aid-consent" style="margin-top: 4px; flex-shrink: 0; width: 16px; height: 16px;">' +
          '<div class="text-sm" style="line-height: 1.5;">' +
            '<strong>I consent to my questionnaire responses being processed for TCM wellness analysis, and reviewed by a licensed TCM practitioner.</strong> ' +
            'My responses are stored securely and used only for this purpose. I can request deletion any time from Settings. ' +
            '<br><span style="font-family: var(--font-zh);">' +
            '<strong>我同意問卷資料用於 TCM 健康分析，並由註冊中醫師審核。</strong>' +
            '資料安全儲存，僅用於此目的，可隨時於設定中要求刪除。' +
            '</span>' +
          '</div>' +
        '</label>' +
      '</div>' +

      '<div class="flex gap-2 flex-wrap">' +
      '<button class="btn btn--primary btn--lg" id="aid-save" disabled>Submit for Doctor Review · 送交醫師</button>' +
      '<button class="btn btn--outline btn--lg" onclick="location.hash=\'#/book\'">Book Consultation · 預約深度問診</button>' +
      '<button class="btn btn--ghost" id="aid-restart">Restart · 重新測評</button>' +
      '</div>';

    injectStyle();

    // Gate Submit on the consent checkbox.
    var consent = document.getElementById('aid-consent');
    var saveBtn = document.getElementById('aid-save');
    consent.addEventListener('change', function () { saveBtn.disabled = ! consent.checked; });

    saveBtn.addEventListener('click', async function () {
      if (! consent.checked) {
        HM.ui.toast('Please tick the consent box first. · 請先勾選同意方塊。', 'warning');
        return;
      }
      // Log consent immediately so the audit row is written BEFORE
      // the report is persisted — meets PDPA §6 "consent at point
      // of collection".
      try { await HM.api.recordConsent('consent.constitution_questionnaire'); } catch (_) {}
      saveReport(types, alerts);
    });
    document.getElementById('aid-restart').addEventListener('click', function () { render(el); });
  }

  // Render a previously-submitted report — same dimensions view, plus the
  // doctor-approved advice block if the doctor has reviewed.
  function renderApprovedReport(el, report) {
    var dims = report.dimensions || {};
    Object.keys(DIMS).forEach(function (k) { if (!(k in dims)) dims[k] = 0; });
    var types = report.patterns || getConstitution(dims);
    var alerts = report.safety_alerts || [];
    var status = report.review_status || 'pending';
    var advice = report.doctor_advice || {};
    var comment = report.doctor_comment || '';
    var reviewedAt = report.reviewed_at || '';
    var concerns = (report.health_concerns || '').trim();

    var banner = '';
    if (status === 'pending') {
      banner = '<div class="alert alert--info mb-4"><div class="alert-icon">⏳</div><div class="alert-body">' +
        '<strong>Awaiting Doctor Review · 等待醫師審核</strong><br>' +
        'Your personalised advice will appear here once a licensed TCM doctor has reviewed your report. ' +
        '<span style="font-family: var(--font-zh);">醫師審核後將顯示個人化建議。</span>' +
        '</div></div>';
    } else if (status === 'approved') {
      banner = '<div class="alert alert--success mb-4"><div class="alert-icon">✓</div><div class="alert-body">' +
        '<strong>Reviewed &amp; Approved by Doctor · 醫師已審核批准</strong>' +
        (reviewedAt ? '<div class="text-xs text-muted mt-1">' + HM.format.datetime(reviewedAt) + '</div>' : '') +
        '</div></div>';
    } else if (status === 'needs_changes') {
      banner = '<div class="alert alert--warning mb-4"><div class="alert-icon">⚠</div><div class="alert-body">' +
        '<strong>Doctor Requested Clarification · 醫師要求補充資料</strong><br>' +
        'Please read the comments below and consider booking a consultation.' +
        '</div></div>';
    }

    // Tongue section — shown when this report was submitted as part of a
    // combined session (tongue photo → questions → one submission).
    // When renderDetail was able to load the full tongue diagnosis
    // (report._tongue_full), the deep 三焦 / 全息圖 / 六經 / 臨床特徵 /
    // 升降 analysis is inlined directly into this card so the patient
    // sees the whole TCM picture together with the constitution quiz,
    // not spread across two pages.
    var tongueSection = '';
    if (report.tongue_assessment_id || report.tongue_image_url || report.tongue_constitution) {
      var tc = report.tongue_constitution || {};
      var tBand = healthBand(report.tongue_health_score);
      var tColor = tBand.color;
      var tFull = report._tongue_full || null;
      var tongueReport = tFull ? (tFull.constitution_report || {}) : {};
      var isReviewed = (status === 'approved' || status === 'needs_changes');

      // Brief #14a-fix-7 — prefer the fresh signed R2 URL from
      // the live tongue assessment fetch (always valid for 1hr from
      // now), not the cached URL inside the questionnaire JSON
      // which was signed at submission time and may have expired.
      // Fall back to the cached tongue_image_url for legacy records
      // (pre-Phase 6 the URL was permanent /api/uploads/... so it
      // still works).
      var tongueImgUrl = (tFull && tFull.image_url) || report.tongue_image_url || null;

      tongueSection =
        '<div class="card card--pad-lg mb-4" style="border-left:3px solid var(--gold);">' +
        '<div class="text-label mb-3">👅 Tongue Diagnosis · 舌診結果</div>' +

        // Header summary — photo + constitution + score
        '<div class="flex gap-4 mb-3" style="align-items:center;flex-wrap:wrap;">' +
        (tongueImgUrl
          ? HM.format.img(tongueImgUrl, {
              style: 'width:110px;height:110px;border-radius:var(--r-md);border:1px solid var(--border);',
              icon: '👅', title: 'Photo unavailable · 圖片已不存在',
            })
          : '<div style="width:110px;height:110px;border-radius:var(--r-md);background:var(--washi);display:flex;align-items:center;justify-content:center;font-size:3rem;">👅</div>') +
        '<div style="flex:1;min-width:200px;">' +
        (tc.name_en
          ? '<div style="font-weight:600;">' + HM.format.esc(tc.name_en) + '</div>'
          : '') +
        (tc.name_zh
          ? '<div style="font-family:var(--font-zh);color:var(--stone);">' + HM.format.esc(tc.name_zh) + '</div>'
          : '') +
        (tBand.key !== 'unknown'
          ? '<div class="mt-2">Wellness band · 健康狀態：<strong style="font-size:1.1rem;color:' + tColor + ';">' + tBand.en + '</strong></div>'
          : '') +
        '</div>' +
        '</div>' +

        // Inline deep analysis (三焦 / 全息圖 / 六經 / 臨床特徵 / 升降)
        renderInlineTongueDeepAnalysis(tongueReport, isReviewed) +

        '</div>';
    }

    el.innerHTML = '<div class="page-header">' +
      '<button class="btn btn--ghost" onclick="location.hash=\'#/wellness-assessment\'">← New Assessment · 新測評</button>' +
      '<h1 class="page-title mt-2">Full TCM Wellness Report · 完整體質評估報告</h1>' +
      '<p class="text-muted mt-1">Combined tongue observation and 10-dimension constitution assessment · 舌象與體質問卷綜合報告</p>' +
      '</div>' +

      // Sticky MDA-compliance disclaimer
      '<div class="ai-wellness-disclaimer">' +
        '<strong>⚠️ Wellness education, not a medical diagnosis.</strong> This TCM wellness analysis is reviewed by a licensed TCM practitioner. ' +
        'For any clinical diagnosis or treatment, please consult a licensed TCM practitioner in person.' +
        '<br><span style="font-family: var(--font-zh);"><strong>此為健康教育，非醫療診斷。</strong>如需臨床診斷或治療，請親自諮詢註冊中醫師。</span>' +
      '</div>' +

      banner +

      (alerts.length ? renderAlerts(alerts) : '') +

      // Patient's own concerns — echoed back so they can confirm what
      // they told the doctor. Gold border so it's visually grouped
      // with the doctor's response that comes later on the page.
      (concerns
        ? '<div class="card card--pad-lg mb-4" style="border-left:3px solid var(--gold);background:rgba(201,146,42,.04);">' +
          '<div class="text-label mb-2">🩺 Your Concerns · 您的主訴</div>' +
          '<div class="text-sm" style="white-space:pre-wrap;">' + HM.format.esc(concerns) + '</div>' +
          '</div>'
        : '') +

      tongueSection +

      // Constitution pills — always shown
      '<div class="card card--pad-lg mb-4">' +
      '<div class="text-label mb-3">Diagnosed Constitution · 體質診斷</div>' +
      '<div class="flex gap-2 flex-wrap mb-4">' +
      types.map(function (t) {
        var colorMap = { green:'var(--sage)', yellow:'var(--gold)', red:'var(--red-seal)', blue:'#6699bb' };
        var c = colorMap[t.col] || 'var(--stone)';
        return '<span class="aid-pill" style="background:' + c + '22; color:' + c + '; border:1px solid ' + c + '66;">' +
          HM.format.esc(t.l || '') + (t.c ? ' · ' + HM.format.esc(t.c) : '') + '</span>';
      }).join('') +
      '</div>' +
      '</div>' +

      // Radar + bars — always shown
      '<div class="grid-2" style="grid-template-columns: 360px 1fr; gap: var(--s-5); align-items: start; margin-bottom: var(--s-4);">' +
      '<div class="card card--pad-lg">' +
      '<div class="text-label mb-2">Radar Chart · 雷達圖</div>' +
      renderRadar(dims) +
      '</div>' +
      '<div class="card card--pad-lg">' +
      '<div class="text-label mb-3">10 Dimensions · 10 維體質</div>' +
      renderDimBars(dims) +
      '</div>' +
      '</div>' +

      // Doctor advice — ONLY after approval
      (status === 'approved' || status === 'needs_changes' ? renderDoctorAdvice(comment, advice) : '') +

      '<div class="flex gap-2 mt-4 flex-wrap">' +
      '<button class="btn btn--primary" onclick="location.hash=\'#/book\'">Book Consultation · 預約問診</button>' +
      '<button class="btn btn--outline" onclick="location.hash=\'#/wellness-assessment\'">New Assessment · 新測評</button>' +
      '</div>';

    injectStyle();
  }

  /**
   * Inline deep tongue analysis for the combined final report.
   * Mirrors renderPatientDeepAnalysis() in tongue.js but is designed
   * to sit *inside* the existing Tongue Diagnosis card (no outer
   * wrapper card — the parent already provides one).
   *
   * Gating rule (same as tongue.js):
   *   • Diagnostic observations (三焦 / 全息圖 / 六經) — always visible
   *   • Formula directions + ascending/descending cautions — only
   *     after doctor has reviewed the report (isReviewed=true).
   */
  function renderInlineTongueDeepAnalysis(report, isReviewed) {
    if (! report) return '';
    var tb = report.three_burner || {};
    var holo = report.holographic_map || {};
    var meridians = report.six_meridians || [];
    var patterns = report.clinical_patterns || [];
    var ascDesc = report.ascending_descending || {};

    var hasDeep = (tb && (tb.upper_jiao || tb.middle_jiao || tb.lower_jiao))
               || (holo && (holo.affected || []).length)
               || meridians.length
               || patterns.length
               || (ascDesc && ascDesc.direction && ascDesc.direction !== 'balanced');
    if (! hasDeep) return '';

    var html = '<div class="mt-4"><div class="text-label mb-3" style="border-top:1px dashed var(--border);padding-top:var(--s-3);">🔬 Deep Analysis · 深度分析</div>';

    // Three Burners
    if (tb.upper_jiao || tb.middle_jiao || tb.lower_jiao) {
      html += '<div style="background:var(--washi);padding:var(--s-3);border-radius:var(--r-sm);margin-bottom:var(--s-3);">' +
        '<div class="text-label mb-2">三焦辨證 · Three Burners</div>';
      ['upper_jiao', 'middle_jiao', 'lower_jiao'].forEach(function (k) {
        var z = tb[k];
        if (! z) return;
        var statusColor = {
          heat: 'var(--red-seal)', damp_heat: '#c04545', dampness: 'var(--gold)',
          cold_damp: '#4a90b8', deficiency_cold: '#4a90b8', stasis: '#6b2d88',
          yin_deficiency: '#c04545', normal: 'var(--sage)',
        }[z.status] || 'var(--stone)';
        html += '<div style="padding:6px 0;border-bottom:1px dashed var(--border);">' +
          '<div style="font-size:var(--text-sm);">' +
          '<strong style="font-family:var(--font-zh);color:' + statusColor + ';">' + HM.format.esc(z.name_zh || '') + '</strong> ' +
          '<span class="text-muted">(' + HM.format.esc(z.name_en || '') + ')</span> · ' +
          '<span style="color:' + statusColor + ';font-weight:600;">' + HM.format.esc(z.status || 'normal').replace(/_/g, ' ') + '</span>' +
          '</div>' +
          '<div class="text-xs text-muted mt-1">' + HM.format.esc(z.explanation || '') + '</div>' +
          '</div>';
      });
      html += '</div>';
    }

    // Holographic map
    var affected = (holo && holo.affected) || [];
    if (affected.length) {
      html += '<div style="background:var(--washi);padding:var(--s-3);border-radius:var(--r-sm);margin-bottom:var(--s-3);">' +
        '<div class="text-label mb-2">全息圖 · Body Regions to Watch</div>' +
        '<ul style="list-style:none;padding:0;margin:0;">' +
        affected.map(function (f) {
          return '<li style="padding:4px 0;font-size:var(--text-sm);">' +
            '<strong>' + HM.format.esc(f.region || '') + '</strong>' +
            '<div class="text-xs text-muted">' + HM.format.esc(f.reason || '') + '</div>' +
            '</li>';
        }).join('') +
        '</ul></div>';
    }

    // Six meridians
    if (meridians.length) {
      html += '<div style="background:var(--washi);padding:var(--s-3);border-radius:var(--r-sm);margin-bottom:var(--s-3);">' +
        '<div class="text-label mb-2">六經辨證 · Six-Meridian Differentiation</div>' +
        meridians.map(function (m) {
          return '<div style="padding:4px 0;border-bottom:1px dashed var(--border);">' +
            '<div style="font-size:var(--text-sm);font-weight:600;">' + HM.format.esc(m.meridian || '') + '</div>' +
            '<div class="text-xs text-muted">' + HM.format.esc(m.zone || '') + ' — ' + HM.format.esc(m.note || '') + '</div>' +
            '</div>';
        }).join('') +
        '</div>';
    }

    // Clinical patterns — indication always visible, formula gated
    if (patterns.length) {
      html += '<div style="background:var(--washi);padding:var(--s-3);border-radius:var(--r-sm);margin-bottom:var(--s-3);border-left:3px solid var(--gold);">' +
        '<div class="text-label mb-2">臨床特徵 · Clinical Patterns</div>';
      patterns.forEach(function (p) {
        html += '<div style="padding:6px 0;border-bottom:1px dashed var(--border);">' +
          '<div style="font-size:var(--text-sm);">' +
          '<strong style="font-family:var(--font-zh);">' + HM.format.esc(p.name_zh || '') + '</strong> · ' +
          HM.format.esc(p.name_en || '') +
          '</div>' +
          (p.description ? '<div class="text-xs text-muted mt-1">' + HM.format.esc(p.description) + '</div>' : '') +
          (p.indication  ? '<div class="text-xs mt-1" style="color:#6b4413;">→ ' + HM.format.esc(p.indication)  + '</div>' : '') +
          (isReviewed && p.formula
            ? '<div class="text-xs mt-2" style="background:rgba(201,146,42,0.1);padding:6px 10px;border-radius:3px;border-left:2px solid var(--gold);">' +
              '<strong>💊 Formula direction (doctor-approved):</strong> ' + HM.format.esc(p.formula) + '</div>'
            : (p.formula ? '<div class="text-xs text-muted mt-2" style="font-style:italic;">(Formula suggestion hidden until doctor review)</div>' : '')) +
          '</div>';
      });
      html += '</div>';
    }

    // Ascending / descending — caution + treatment gated
    if (ascDesc && ascDesc.direction && ascDesc.direction !== 'balanced') {
      var isAsc = ascDesc.direction === 'ascending_excess';
      var borderCol = isAsc ? 'var(--red-seal)' : '#4a90b8';
      html += '<div style="background:var(--washi);padding:var(--s-3);border-radius:var(--r-sm);margin-bottom:var(--s-3);border-left:3px solid ' + borderCol + ';">' +
        '<div class="text-label mb-2">升降辨證 · Ascending / Descending</div>' +
        '<div style="font-size:var(--text-sm);">' +
        '<strong style="color:' + borderCol + ';font-family:var(--font-zh);">' + HM.format.esc(ascDesc.name_zh || '') + '</strong> · ' +
        HM.format.esc(ascDesc.name_en || '') +
        '</div>' +
        (ascDesc.signs ? '<div class="text-xs text-muted mt-1">' + HM.format.esc(ascDesc.signs) + '</div>' : '') +
        (isReviewed && ascDesc.caution
          ? '<div class="text-xs mt-2" style="background:rgba(192,57,43,0.08);padding:6px 10px;border-radius:3px;border-left:2px solid var(--red-seal);color:var(--red-seal);"><strong>⚠ Caution:</strong> ' + HM.format.esc(ascDesc.caution) + '</div>'
          : '') +
        (isReviewed && ascDesc.treatment
          ? '<div class="text-xs mt-2" style="background:rgba(74,144,184,0.1);padding:6px 10px;border-radius:3px;border-left:2px solid #4a90b8;"><strong>💡 Direction:</strong> ' + HM.format.esc(ascDesc.treatment) + '</div>'
          : '') +
        '</div>';
    }

    if (! isReviewed) {
      html += '<div class="text-xs text-muted" style="font-style:italic;padding:var(--s-2) 0;">' +
        'Formula suggestions and treatment cautions appear here once a doctor has reviewed this report. · 處方方向與用藥禁忌於醫師審核後顯示。' +
        '</div>';
    }

    html += '</div>';
    return html;
  }

  function renderDoctorAdvice(comment, advice) {
    advice = advice || {};
    var herbs = advice.herbs || [];
    var foods = advice.foods || [];
    var avoid = advice.avoid || '';
    var tips  = advice.tips  || [];

    // Brief #14a-fix-5 - prefer explicit beneficial / limit fields if
    // present (new doctor UI sends them). Fall back to sticky-reduce
    // parsing on the legacy combined `foods` array for older reviews.
    var REDUCE_PATTERNS = /^\s*\(\s*(less|reduce|limit|avoid|no|skip|moderate|少|減|忌|避|限)\s*\)\s*/i;
    function splitReduce(arr) {
      var regular = [], reduce = [];
      var sticky = false;
      (arr || []).forEach(function (item) {
        var s = String(item == null ? '' : item);
        var m = s.match(REDUCE_PATTERNS);
        if (m) { sticky = true; reduce.push(s.slice(m[0].length).trim()); }
        else if (sticky) { reduce.push(s); }
        else { regular.push(s); }
      });
      return { regular: regular, reduce: reduce };
    }
    var splitFoods = (advice.foods_beneficial || advice.foods_limit)
      ? { regular: (advice.foods_beneficial || []).slice(),
          reduce:  (advice.foods_limit      || []).slice() }
      : splitReduce(foods);
    var splitHerbs = (advice.herbs_beneficial || advice.herbs_limit)
      ? { regular: (advice.herbs_beneficial || []).slice(),
          reduce:  (advice.herbs_limit      || []).slice() }
      : splitReduce(herbs);

    var REDUCE_CHIP_STYLE = 'background:#FFF3CD;border:1px dashed #B5881A;border-radius:12px;padding:3px 10px;color:#6F5510;display:inline-block;margin-right:6px;margin-bottom:6px;';

    var out = '<div class="card card--pad-lg mb-4" style="border-left: 3px solid var(--sage);">' +
      '<div class="text-label mb-3">💬 Doctor\'s Plan · 醫師審核建議</div>';

    if (comment) {
      out += '<p style="white-space: pre-wrap; margin-bottom: var(--s-4); line-height: var(--leading-relaxed);">' + HM.format.esc(comment) + '</p>';
    }

    if (splitHerbs.regular.length) {
      out += '<div class="text-label mb-2">🌿 Herbs · 建議草藥</div>' +
        '<div class="flex gap-2 flex-wrap mb-4">' +
        splitHerbs.regular.map(function (h) { return '<span class="aid-tag aid-tag--sage">' + HM.format.esc(h) + '</span>'; }).join('') +
        '</div>';
    }
    if (splitHerbs.reduce.length) {
      out += '<div class="text-label mb-2" style="color:#6F5510;">⚠️ Use Sparingly · 慎用</div>' +
        '<div class="mb-4">' +
        splitHerbs.reduce.map(function (h) { return '<span style="' + REDUCE_CHIP_STYLE + '">' + HM.format.esc(h) + '</span>'; }).join('') +
        '</div>';
    }
    if (splitFoods.regular.length) {
      out += '<div class="text-label mb-2">🍱 Beneficial Foods · 有益食療</div>' +
        '<div class="flex gap-2 flex-wrap mb-4">' +
        splitFoods.regular.map(function (f) { return '<span class="aid-tag aid-tag--gold">' + HM.format.esc(f) + '</span>'; }).join('') +
        '</div>';
    }
    if (splitFoods.reduce.length) {
      out += '<div class="text-label mb-2" style="color:#6F5510;">⚠️ Limit · 少量 <span style="font-weight:normal;font-size:var(--text-xs);color:var(--stone);">— consume in smaller amounts</span></div>' +
        '<div class="mb-4">' +
        splitFoods.reduce.map(function (f) { return '<span style="' + REDUCE_CHIP_STYLE + '">' + HM.format.esc(f) + '</span>'; }).join('') +
        '</div>';
    }
    if (avoid) {
      out += '<div class="alert alert--warning mb-4"><div class="alert-icon">❌</div><div class="alert-body">' +
        '<strong>Avoid · 飲食禁忌</strong><br>' + HM.format.esc(avoid) +
        '</div></div>';
    }
    if (tips.length) {
      out += '<div class="text-label mb-2">💡 Lifestyle Advice · 生活建議</div>' +
        '<div class="aid-tips">' +
        tips.map(function (t) {
          return '<div class="aid-tip">' +
            '<span class="aid-tip-icon">' + (t.icon || '💡') + '</span>' +
            '<div>' +
            (t.en ? '<div>' + HM.format.esc(t.en) + '</div>' : '') +
            (t.zh ? '<div style="font-family: var(--font-zh); font-size: var(--text-xs); color: var(--stone); margin-top: 2px;">' + HM.format.esc(t.zh) + '</div>' : '') +
            '</div></div>';
        }).join('') +
        '</div>';
    }
    if (!herbs.length && !foods.length && !avoid && !tips.length && !comment) {
      out += '<p class="text-muted">Doctor has not yet added personalised advice.</p>';
    }

    out += '<div class="alert alert--warning mt-4"><div class="alert-body text-xs">' +
      'This plan is based on your constitution profile and the reviewing doctor\'s judgment. For complex or multi-herb prescriptions, book a follow-up consultation. ' +
      '<span style="font-family: var(--font-zh);">複方處方請預約深入問診。</span>' +
      '</div></div>';

    out += '</div>';
    return out;
  }

  function renderAlerts(alerts) {
    return '<div class="alert alert--danger mb-4" style="border-width: 2px;">' +
      '<div class="alert-icon">⚠️</div>' +
      '<div class="alert-body">' +
      '<strong>Urgent Medical Alerts · 醫療警示（重要提示）</strong>' +
      '<div class="mt-3">' +
      alerts.map(function (a) {
        return '<div style="padding: var(--s-2) 0; border-bottom: 1px solid rgba(192,57,43,.2); font-size: var(--text-sm);">' +
          HM.format.esc(a.alert) +
          '<div class="text-xs text-muted mt-1" style="font-family: var(--font-zh);">' + HM.format.esc(a.purposeZh) + '</div>' +
          '</div>';
      }).join('') +
      '</div>' +
      '<div class="mt-3 text-sm" style="font-weight: 500;">Please consult a licensed physician before starting any herbal treatment. · 開始任何中藥前請先諮詢持牌醫師。</div>' +
      '</div></div>';
  }

  // ── Radar chart (SVG) ──────────────────────────────────────
  function renderRadar(dims) {
    var keys = Object.keys(DIMS);
    var cx = 150, cy = 150, r = 110;
    var N = keys.length;

    // Severity = |value| / 2 ( normalised 0..1 )
    function severity(k) {
      var v = dims[k] || 0;
      var m = DIMS[k];
      var range = Math.max(Math.abs(m.min), Math.abs(m.max));
      return Math.min(1, Math.abs(v) / range);
    }

    // Compute point for each axis
    function pt(i, rr) {
      var angle = (-Math.PI / 2) + i * (2 * Math.PI / N);
      return [cx + rr * Math.cos(angle), cy + rr * Math.sin(angle)];
    }

    var svg = '<svg viewBox="0 0 300 300" style="width:100%;max-width:300px;height:auto;display:block;margin:0 auto;" xmlns="http://www.w3.org/2000/svg">';

    // Grid circles
    [0.25, 0.5, 0.75, 1].forEach(function (s) {
      svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * s) + '" fill="none" stroke="#e8e2d6" stroke-width="1"/>';
    });

    // Axes
    keys.forEach(function (k, i) {
      var p = pt(i, r);
      svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0] + '" y2="' + p[1] + '" stroke="#e8e2d6" stroke-width="1"/>';
    });

    // Severity polygon (filled)
    var pts = keys.map(function (k, i) {
      var s = severity(k);
      var p = pt(i, r * s);
      return p[0] + ',' + p[1];
    }).join(' ');
    svg += '<polygon points="' + pts + '" fill="rgba(184,150,90,0.25)" stroke="#b8965a" stroke-width="2" stroke-linejoin="round"/>';

    // Dots
    keys.forEach(function (k, i) {
      var v = dims[k] || 0;
      var s = severity(k);
      var p = pt(i, r * s);
      var color = v === 0 ? '#7a8c72' : Math.abs(v) >= 2 ? '#c0392b' : '#b8965a';
      svg += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" fill="' + color + '" stroke="#fff" stroke-width="1.5"/>';
    });

    // Labels (place just outside radius)
    keys.forEach(function (k, i) {
      var meta = DIMS[k];
      var p = pt(i, r + 22);
      var anchor = p[0] < cx - 5 ? 'end' : p[0] > cx + 5 ? 'start' : 'middle';
      svg += '<text x="' + p[0] + '" y="' + p[1] + '" text-anchor="' + anchor + '" alignment-baseline="middle" ' +
        'font-family="var(--font-body)" font-size="9" fill="#1a1612">' + meta.enShort + '</text>';
      svg += '<text x="' + p[0] + '" y="' + (p[1] + 10) + '" text-anchor="' + anchor + '" alignment-baseline="middle" ' +
        'font-family="Noto Serif SC,serif" font-size="9" fill="#7a7068">' + meta.zhShort + '</text>';
    });

    svg += '</svg>';

    // Small legend
    svg += '<div class="flex gap-3 flex-wrap mt-3" style="font-size: var(--text-xs); color: var(--stone); justify-content: center;">' +
      '<span><span style="display:inline-block;width:8px;height:8px;background:#7a8c72;border-radius:50%;margin-right:4px;"></span>Balanced</span>' +
      '<span><span style="display:inline-block;width:8px;height:8px;background:#b8965a;border-radius:50%;margin-right:4px;"></span>Mild</span>' +
      '<span><span style="display:inline-block;width:8px;height:8px;background:#c0392b;border-radius:50%;margin-right:4px;"></span>Strong</span>' +
      '</div>';

    return svg;
  }

  // ── Horizontal dimension bars (grouped) ────────────────────
  function renderDimBars(dims) {
    var groups = [
      { title: '🔋 Energy · 氣與脾胃',       keys: ['qi_xu','qi_zhi','pi_wei'] },
      { title: '🩸 Circulation · 血',        keys: ['xue_xu','xue_yu'] },
      { title: '❄️🔥 Temperature · 寒熱',    keys: ['ti_re','ti_han'] },
      { title: '💧 Moisture · 濕燥',         keys: ['shi_qi'] },
      { title: '🌙 Sleep & Immunity · 睡眠免疫', keys: ['shui_mian','min_li'] },
    ];
    return groups.map(function (g) {
      return '<div class="aid-group">' +
        '<div class="aid-group-title">' + g.title + '</div>' +
        g.keys.map(function (k) { return renderDimBar(k, dims[k] || 0); }).join('') +
        '</div>';
    }).join('');
  }

  function renderDimBar(key, val) {
    var meta = DIMS[key];
    var isCtr = meta.min < 0;
    var range = meta.max - meta.min;
    var pct = ((val - meta.min) / range) * 100;

    // Tag colour/text by value
    var tag, tagCol;
    if (val === 0)       { tag = 'Balanced · 平衡';         tagCol = '#7a8c72'; }
    else if (val === -1) { tag = 'Mild Deficiency · 輕度不足'; tagCol = '#5588bb'; }
    else if (val === -2) { tag = 'Severe Deficiency · 嚴重不足'; tagCol = '#3366aa'; }
    else if (val === 1)  { tag = 'Mild Excess · 輕度偏高';   tagCol = '#b8965a'; }
    else                 { tag = 'Elevated · 明顯偏高';     tagCol = '#c0392b'; }

    var bar;
    if (isCtr) {
      var w = Math.abs(pct - 50);
      var left = val < 0 ? pct : 50;
      bar = '<div class="aid-bar-track">' +
        '<div class="aid-bar-center"></div>' +
        '<div class="aid-bar-fill" style="left:' + left + '%;width:' + w + '%;background:' + tagCol + ';"></div>' +
        '</div>';
    } else {
      bar = '<div class="aid-bar-track">' +
        '<div class="aid-bar-fill" style="left:0;width:' + pct + '%;background:' + tagCol + ';"></div>' +
        '</div>';
    }

    var sign = val > 0 ? '+' + val : val === 0 ? '0' : val;
    var scale = isCtr
      ? '<div class="aid-bar-scale" style="grid-template-columns:1fr 1fr 1fr;"><span style="text-align:left;">← ' + meta.minLbl + '</span><span style="text-align:center;color:#7a8c72;">0 · 平衡</span><span style="text-align:right;">' + meta.maxLbl + ' →</span></div>'
      : '<div class="aid-bar-scale" style="grid-template-columns:1fr 1fr;"><span style="text-align:left;">← ' + meta.minLbl + '</span><span style="text-align:right;">' + meta.maxLbl + ' →</span></div>';

    return '<div class="aid-dim-row">' +
      '<div class="flex-between mb-1" style="align-items:flex-end;">' +
      '<div><div class="aid-dim-label-en">' + meta.enShort + '</div>' +
      '<div class="aid-dim-label-zh">' + meta.zhShort + '</div></div>' +
      '<div style="text-align:right;">' +
      '<div class="aid-dim-score" style="color:' + tagCol + ';">[' + sign + ']</div>' +
      '<div class="aid-dim-tag" style="background:' + tagCol + '22; color:' + tagCol + '; border-color:' + tagCol + '66;">' + tag + '</div>' +
      '</div>' +
      '</div>' +
      bar + scale +
      '</div>';
  }

  async function saveReport(types, alerts) {
    var btn = document.getElementById('aid-save');
    btn.disabled = true;
    btn.textContent = 'Submitting… · 送出中…';
    var payload = {
      symptoms: {
        kind:             'ai_constitution_v2',
        review_status:    'pending',
        answers:          state.answers,
        dimensions:       state.dims,
        patterns:         types,
        safety_alerts:    alerts,
        health_concerns:  (state.healthConcerns || '').trim() || null,
        submitted_at:     new Date().toISOString(),
        // Link this questionnaire to the tongue scan from the same session
        // so the reviewing doctor sees both sides of the assessment together.
        tongue_assessment_id:     state.tongueId || null,
        tongue_health_score:     state.tongueReport ? state.tongueReport.health_score : null,
        tongue_constitution:     state.tongueReport && state.tongueReport.constitution_report
          ? state.tongueReport.constitution_report.constitution || null
          : null,
        tongue_image_url:        state.tongueReport ? state.tongueReport.image_url : null,
      },
    };
    try {
      var res = await HM.api.patient.saveQuestionnaire(payload);
      HM.ui.toast('Submitted · 已送交醫師審核', 'success', 4000);
      // Navigate to the report detail page so the patient sees their
      // in-review view (dimensions only + pending banner).
      var qId = res && res.questionnaire ? res.questionnaire.id : null;
      if (qId) {
        location.hash = '#/wellness-assessment/' + qId;
      } else {
        btn.textContent = '✓ Submitted · 已送出';
      }
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Submit for Doctor Review · 送交醫師';
      HM.ui.toast('Could not submit: ' + (e.message || 'Error'), 'danger');
    }
  }

  // Load a previously-submitted report by ID (from a route like #/ai-diagnosis/123).
  async function renderDetail(el, id) {
    el.innerHTML = '<div class="state state--loading"><div class="state-icon"></div></div>';
    try {
      var res = await HM.api.patient.getQuestionnaire(id);
      var row = res.questionnaire || {};
      var s = row.symptoms;
      if (typeof s === 'string') { try { s = JSON.parse(s); } catch (_) { s = {}; } }
      s = s || {};
      if (s.kind !== 'ai_constitution_v2') {
        el.innerHTML = '<p class="text-muted">This report is not an AI constitution report.</p>';
        return;
      }

      // If the session included a tongue scan, pull its full diagnosis
      // (including the deep 三焦 / 全息圖 / 六經 / 臨床特徵 / 升降 analysis)
      // and inline it into the combined report so the patient sees tongue
      // + constitution together in one view.
      if (s.tongue_assessment_id) {
        try {
          var tr = await HM.api.patient.getDiagnosis(s.tongue_assessment_id);
          s._tongue_full = tr && tr.diagnosis ? tr.diagnosis : null;
        } catch (_) { s._tongue_full = null; }
      }

      renderApprovedReport(el, s);
    } catch (e) { HM.state.error(el, e); }
  }

  // ── Styles ─────────────────────────────────────────────────
  function injectStyle() {
    if (document.getElementById('aid-style')) return;
    var s = document.createElement('style');
    s.id = 'aid-style';
    // Sticky top disclaimer — MDA 2012 compliance. Sits at the top of
    // every AI-wellness screen and can't be scrolled past easily.
    var disclaimerCss =
      '.ai-wellness-disclaimer{' +
        'position:sticky;top:0;z-index:50;' +
        'background:linear-gradient(135deg, rgba(168,39,58,.08), rgba(201,146,42,.08));' +
        'border:1px solid rgba(168,39,58,.3);' +
        'border-left:4px solid var(--red-seal);' +
        'border-radius:var(--r-sm);' +
        'padding:10px 14px;' +
        'font-size:13px;line-height:1.45;' +
        'color:var(--ink);' +
        'margin-bottom:var(--s-3);' +
        'box-shadow:0 1px 3px rgba(0,0,0,.05);' +
      '}';
    s.textContent =
      disclaimerCss +
      // Progress
      '.aid-progress{height:4px;background:var(--border);border-radius:2px;margin-top:var(--s-2);overflow:hidden;}' +
      '.aid-progress-fill{height:100%;background:var(--gold);transition:width .3s ease;}' +
      // Options
      '.aid-opt{display:block;width:100%;text-align:left;padding:var(--s-4);margin-bottom:var(--s-2);border:1px solid var(--border);background:var(--bg);border-radius:var(--r-md);cursor:pointer;transition:all .15s ease;font-family:inherit;}' +
      '.aid-opt:hover{border-color:var(--gold);background:var(--washi);}' +
      '.aid-opt--selected{border-color:var(--gold);background:var(--washi);border-width:2px;padding:calc(var(--s-4) - 1px);}' +
      '.aid-opt-en{font-size:var(--text-sm);color:var(--ink);line-height:1.5;margin-bottom:4px;}' +
      '.aid-opt-zh{font-family:var(--font-zh);font-size:var(--text-xs);color:var(--stone);line-height:1.5;}' +
      // Pills
      '.aid-pill{padding:6px 14px;border-radius:999px;font-size:var(--text-xs);font-weight:500;letter-spacing:.04em;}' +
      // Tags
      '.aid-tag{padding:5px 12px;font-size:var(--text-xs);border-radius:2px;font-family:var(--font-zh);border:1px solid;}' +
      '.aid-tag--sage{color:var(--sage);background:rgba(122,140,114,.12);border-color:rgba(122,140,114,.35);}' +
      '.aid-tag--gold{color:var(--gold);background:rgba(184,150,90,.1);border-color:rgba(184,150,90,.35);}' +
      // Dimension group
      '.aid-group{margin-bottom:var(--s-4);}' +
      '.aid-group-title{font-size:var(--text-xs);font-weight:600;letter-spacing:.08em;color:var(--stone);margin-bottom:var(--s-2);padding-bottom:4px;border-bottom:1px solid var(--border);}' +
      '.aid-dim-row{padding:var(--s-2) 0;margin-bottom:var(--s-2);}' +
      '.aid-dim-label-en{font-size:var(--text-sm);color:var(--ink);}' +
      '.aid-dim-label-zh{font-family:var(--font-zh);font-size:var(--text-xs);color:var(--stone);}' +
      '.aid-dim-score{font-family:var(--font-mono);font-size:var(--text-lg);font-weight:500;line-height:1;}' +
      '.aid-dim-tag{display:inline-block;margin-top:2px;padding:2px 8px;font-size:10px;border:1px solid;border-radius:2px;white-space:nowrap;}' +
      '.aid-bar-track{position:relative;height:10px;background:var(--border);border-radius:5px;margin:6px 0 4px;overflow:hidden;}' +
      '.aid-bar-fill{position:absolute;top:0;bottom:0;border-radius:5px;}' +
      '.aid-bar-center{position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(0,0,0,.2);}' +
      '.aid-bar-scale{display:grid;font-size:10px;color:var(--stone);margin-bottom:4px;}' +
      // Tips
      '.aid-tips{display:flex;flex-direction:column;gap:var(--s-2);}' +
      '.aid-tip{display:flex;gap:var(--s-3);align-items:flex-start;background:var(--washi);padding:var(--s-3) var(--s-4);border:1px solid var(--border);border-radius:var(--r-md);font-size:var(--text-sm);line-height:1.5;}' +
      '.aid-tip-icon{font-size:1.3rem;flex-shrink:0;}' +
      // Step cards (intro flow)
      '.aid-step-card{position:relative;padding:var(--s-4);border:1px solid var(--border);border-radius:var(--r-md);background:var(--washi);text-align:center;}' +
      '.aid-step-num{position:absolute;top:-10px;left:var(--s-3);background:var(--gold);color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;}' +
      '.aid-step-icon{font-size:2.2rem;margin-bottom:var(--s-2);}' +
      '.aid-step-en{font-weight:600;font-size:var(--text-sm);color:var(--ink);}' +
      '.aid-step-zh{font-family:var(--font-zh);font-size:var(--text-xs);color:var(--stone);margin-bottom:4px;}' +
      '.aid-step-desc{font-size:var(--text-xs);color:var(--stone);}';
    document.head.appendChild(s);
  }

  HM.patientPanels.aiDiagnosis = { render: render, renderDetail: renderDetail };
})();
