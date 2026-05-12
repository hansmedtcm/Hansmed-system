/**
 * Brief #22 · Patient-facing pre-assessment panel.
 *
 * 5-stage flow at #/pre-assessment[/:appointmentId]:
 *   Stage 1 — Chief complaint + symptom timeline
 *   Stage 2 — Western history questions (from HM.clinicalAssist) + vitals
 *   Stage 3 — Tongue photo (reuses existing tongue capture)
 *   Stage 4 — TCM confirmation questions (returned by backend after tongue)
 *   Stage 5 — Safety screen for prescribing
 *
 * Patient sees NO diagnostic content. Backend strips it via
 * PreAssessment::patientSafePayload(). Final screen is just:
 *   "Thank you, your doctor will review this before your consult."
 */
(function () {
  'use strict';
  window.HM = window.HM || {};
  HM.preAssessment = HM.preAssessment || {};

  var state = {
    id: null,
    appointmentId: null,
    stage: 1,
    baseline: {},
    chiefComplaint: '',
    symptomTimeline: '',
    westernAnswers: {},
    vitals: {},
    tongueAssessmentId: null,
    tcmQuestions: [],
    tcmAnswers: {},
    safetyAnswers: {},
  };

  // ───────── Routing entry ─────────
  HM.preAssessment.open = function (appointmentId) {
    state.appointmentId = appointmentId ? parseInt(appointmentId, 10) : null;
    state.stage = 1;
    render();
    bootstrap();
  };

  function bootstrap() {
    HM.api.post('/patient/pre-assessment/start', {
      appointment_id: state.appointmentId,
    }).then(function (r) {
      var pa = r.pre_assessment;
      state.id = pa.id;
      state.stage = pa.current_stage || 1;
      state.baseline = r.profile_baseline || {};
      // Restore any partial data the patient already entered
      state.chiefComplaint = pa.chief_complaint || '';
      state.symptomTimeline = pa.symptom_timeline || '';
      state.westernAnswers = pa.western_history_answers || {};
      state.vitals = pa.vitals || {};
      state.tongueAssessmentId = pa.tongue_assessment_id || null;
      state.tcmAnswers = pa.tcm_answers || {};
      state.safetyAnswers = pa.safety_screen_answers || {};
      render();
    }).catch(function (err) {
      HM.ui.toast('Couldn\'t start the pre-assessment — please refresh.', 'danger');
      console.error(err);
    });
  }

  // ───────── Stage submission ─────────
  function submitStage(payload) {
    return HM.api.patch(
      '/patient/pre-assessment/' + state.id + '/stage/' + state.stage,
      payload
    );
  }

  // ───────── Render ─────────
  function render() {
    var el = document.getElementById('hm-pre-assessment-root');
    if (!el) return;
    el.innerHTML = '';
    el.appendChild(renderProgress());
    el.appendChild(renderStage(state.stage));
  }

  function renderProgress() {
    var wrap = document.createElement('div');
    wrap.className = 'pa-progress';
    [1,2,3,4,5].forEach(function (n) {
      var dot = document.createElement('div');
      dot.className = 'pa-dot' + (n < state.stage ? ' pa-dot--done'
                                  : n === state.stage ? ' pa-dot--active' : '');
      dot.textContent = n;
      wrap.appendChild(dot);
    });
    var label = document.createElement('div');
    label.className = 'pa-progress-label';
    label.textContent = 'Step ' + state.stage + ' of 5';
    wrap.appendChild(label);
    return wrap;
  }

  function renderStage(n) {
    if (n === 1) return renderStage1();
    if (n === 2) return renderStage2();
    if (n === 3) return renderStage3();
    if (n === 4) return renderStage4();
    if (n === 5) return renderStage5();
    return renderComplete();
  }

  // ── Stage 1 · chief complaint ──
  function renderStage1() {
    var box = h('div', 'pa-stage', [
      h('h2', '', 'What brings you in today?'),
      h('p', 'pa-help', 'Tell us your main concern. Be specific — the more we know, the better your doctor can prepare.'),
      input('textarea', 'pa-chief', 'Main concern', state.chiefComplaint, function (v) { state.chiefComplaint = v; }),
      h('p', 'pa-help', 'When did this start? What makes it better or worse?'),
      input('textarea', 'pa-timeline', 'Symptom timeline', state.symptomTimeline, function (v) { state.symptomTimeline = v; }),
      btn('Continue →', function () {
        if (state.chiefComplaint.trim().length < 2) {
          HM.ui.toast('Please describe your main concern', 'warning'); return;
        }
        submitStage({
          chief_complaint: state.chiefComplaint,
          symptom_timeline: state.symptomTimeline,
        }).then(function () { state.stage = 2; render(); });
      }),
    ]);
    return box;
  }

  // ── Stage 2 · Western history + vitals ──
  function renderStage2() {
    var caResult = null;
    try {
      caResult = HM.clinicalAssist && HM.clinicalAssist.evaluate({
        chief_complaint: state.chiefComplaint,
        age: ageFromBaseline(),
      });
    } catch (e) { console.warn('clinicalAssist failed', e); }

    var questions = (caResult && caResult.questions) || [];

    var box = h('div', 'pa-stage', [
      h('h2', '', 'A few history questions'),
      h('p', 'pa-help', 'These help your doctor focus on what matters for your concern.'),
    ]);

    questions.forEach(function (q, i) {
      var qid = 'wq' + i;
      box.appendChild(h('div', 'pa-q', [
        h('label', 'pa-q-label', q.q_en),
        input('text', qid, '', state.westernAnswers[q.q_en] || '', function (v) {
          state.westernAnswers[q.q_en] = v;
        }),
      ]));
    });

    // Optional vitals row
    box.appendChild(h('h3', 'pa-subhead', 'Vitals (optional — skip if you don\'t have a BP cuff)'));
    box.appendChild(h('div', 'pa-vitals-row', [
      input('text', 'pa-bp-sys', 'BP systolic', state.vitals.bp_systolic || '', function (v) { state.vitals.bp_systolic = v; }),
      input('text', 'pa-bp-dia', 'BP diastolic', state.vitals.bp_diastolic || '', function (v) { state.vitals.bp_diastolic = v; }),
      input('text', 'pa-pulse', 'Pulse / min', state.vitals.pulse || '', function (v) { state.vitals.pulse = v; }),
    ]));

    box.appendChild(h('div', 'pa-actions', [
      btn('← Back', function () { state.stage = 1; render(); }, 'pa-btn-secondary'),
      btn('Continue →', function () {
        state.vitals.age_at_assessment = ageFromBaseline();
        submitStage({
          western_history_answers: state.westernAnswers,
          clinical_assist_output:  caResult,
          vitals: state.vitals,
        }).then(function () { state.stage = 3; render(); });
      }),
    ]));
    return box;
  }

  // ── Stage 3 · tongue photo ──
  function renderStage3() {
    var box = h('div', 'pa-stage', [
      h('h2', '', 'Your tongue'),
      h('p', 'pa-help', 'Stick out your tongue, take a photo in good lighting. This is the single most useful thing for your doctor.'),
      h('div', 'pa-tongue-host', []),
      h('p', 'pa-help pa-help--small', 'After the photo is analyzed, we\'ll ask a few targeted follow-up questions.'),
    ]);

    // Mount the existing tongue capture widget. It posts to
    // /api/patient/tongue-assessments and emits a 'tongue:assessed'
    // event with the resulting assessment object.
    setTimeout(function () {
      if (HM.tongue && HM.tongue.mount) {
        HM.tongue.mount('.pa-tongue-host', {
          context: 'pre-assessment',
          onAssessed: function (ta) {
            state.tongueAssessmentId = ta.id;
            // Submit stage 3 — backend extracts top patterns + selects
            // TCM questions for stage 4.
            submitStage({ tongue_assessment_id: ta.id }).then(function (r) {
              state.tcmQuestions = r.tcm_questions || [];
              state.stage = 4;
              render();
            });
          },
        });
      } else {
        box.appendChild(h('p', 'pa-error', 'Tongue widget not available. Refresh the page.'));
      }
    }, 50);

    return box;
  }

  // ── Stage 4 · TCM confirmation questions ──
  function renderStage4() {
    var box = h('div', 'pa-stage', [
      h('h2', '', 'A few questions about how you\'ve been feeling'),
      h('p', 'pa-help', 'Based on your tongue, please answer these. Be honest — there are no right or wrong answers.'),
    ]);

    if (!state.tcmQuestions || state.tcmQuestions.length === 0) {
      box.appendChild(h('p', 'pa-help', 'No follow-up questions needed. Click Continue.'));
    } else {
      state.tcmQuestions.forEach(function (sel) {
        (sel.questions || []).forEach(function (q) {
          var row = h('div', 'pa-q', [h('label', 'pa-q-label', q.text_en)]);
          if (q.response_type === 'scale_1_5') {
            row.appendChild(scaleInput(q.id, function (v) { state.tcmAnswers[q.id] = v; }, state.tcmAnswers[q.id]));
          } else {
            row.appendChild(yesNoInput(q.id, function (v) { state.tcmAnswers[q.id] = v; }, state.tcmAnswers[q.id]));
          }
          box.appendChild(row);
        });
      });
    }

    box.appendChild(h('div', 'pa-actions', [
      btn('← Back', function () { state.stage = 3; render(); }, 'pa-btn-secondary'),
      btn('Continue →', function () {
        submitStage({ tcm_answers: state.tcmAnswers }).then(function () {
          state.stage = 5; render();
        });
      }),
    ]));
    return box;
  }

  // ── Stage 5 · safety screen ──
  function renderStage5() {
    var box = h('div', 'pa-stage', [
      h('h2', '', 'Final safety check'),
      h('p', 'pa-help', 'For your doctor to prescribe safely. We\'ll only ask what\'s changed since last time.'),
    ]);

    var ans = state.safetyAnswers;
    var bl = state.baseline;

    // Pregnancy (women 15-50)
    box.appendChild(h('h3', 'pa-subhead', 'Pregnancy / breastfeeding'));
    box.appendChild(selectInput('preg', [
      ['not_applicable','Not applicable / male'],
      ['not_pregnant','Not pregnant'],
      ['trying_to_conceive','Trying to conceive'],
      ['pregnant_1st_tri','Pregnant — first trimester'],
      ['pregnant_2nd_tri','Pregnant — second trimester'],
      ['pregnant_3rd_tri','Pregnant — third trimester'],
      ['breastfeeding','Breastfeeding'],
    ], function (v) { ans.pregnancy_status = v; }, ans.pregnancy_status || bl.pregnancy_status));

    box.appendChild(h('h3', 'pa-subhead', 'Current medications'));
    box.appendChild(h('p', 'pa-help pa-help--small', 'List any prescription medication you take regularly. Be especially clear about blood thinners, antidepressants, BP medications.'));
    box.appendChild(input('textarea', 'pa-meds', '', formatList(ans.current_medications || bl.current_medications), function (v) {
      ans.current_medications = parseList(v);
    }));

    box.appendChild(h('h3', 'pa-subhead', 'Chronic conditions'));
    box.appendChild(input('textarea', 'pa-conds', '', formatList(ans.chronic_conditions || bl.chronic_conditions), function (v) {
      ans.chronic_conditions = parseList(v);
    }));

    box.appendChild(h('h3', 'pa-subhead', 'Known allergies'));
    box.appendChild(input('text', 'pa-allergies', '', ans.allergies || bl.allergies || '', function (v) { ans.allergies = v; }));

    box.appendChild(h('h3', 'pa-subhead', 'Halal-only preference?'));
    box.appendChild(yesNoInput('halal', function (v) { ans.halal_only = v === 'yes'; },
        (ans.halal_only === true || bl.halal_only === true) ? 'yes'
      : (ans.halal_only === false || bl.halal_only === false) ? 'no' : null));

    box.appendChild(h('div', 'pa-actions', [
      btn('← Back', function () { state.stage = 4; render(); }, 'pa-btn-secondary'),
      btn('Finish', function () {
        submitStage({ safety_screen_answers: ans }).then(function () {
          state.stage = 6;
          render();
        });
      }, 'pa-btn-primary'),
    ]));
    return box;
  }

  // ── Completion ──
  function renderComplete() {
    return h('div', 'pa-complete', [
      h('div', 'pa-complete-icon', '✓'),
      h('h2', '', 'Thank you'),
      h('p', '', 'Your doctor will review this before your consultation.'),
      h('p', 'pa-help', 'You can close this window or return to your dashboard.'),
      btn('Go to dashboard', function () { location.hash = '#/dashboard'; }),
    ]);
  }

  // ───────── small helpers ─────────
  function h(tag, cls, content) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (typeof content === 'string') el.textContent = content;
    else if (Array.isArray(content)) content.forEach(function (c) { el.appendChild(c); });
    return el;
  }
  function btn(label, onclick, cls) {
    var b = document.createElement('button');
    b.className = 'btn ' + (cls || 'btn--primary');
    b.textContent = label;
    b.addEventListener('click', onclick);
    return b;
  }
  function input(type, id, placeholder, value, onInput) {
    var el = document.createElement(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') el.type = type;
    el.id = id;
    el.className = 'pa-input';
    if (placeholder) el.placeholder = placeholder;
    if (value) el.value = value;
    el.addEventListener('input', function () { onInput(el.value); });
    return el;
  }
  function yesNoInput(name, onChange, current) {
    var wrap = h('div', 'pa-yn');
    ['yes','sometimes','no'].forEach(function (v) {
      var lab = h('label', 'pa-yn-opt' + (current === v ? ' pa-yn-opt--on' : ''));
      var r = document.createElement('input');
      r.type = 'radio'; r.name = name; r.value = v;
      if (current === v) r.checked = true;
      r.addEventListener('change', function () {
        onChange(v);
        Array.prototype.forEach.call(wrap.querySelectorAll('.pa-yn-opt'), function (n) { n.classList.remove('pa-yn-opt--on'); });
        lab.classList.add('pa-yn-opt--on');
      });
      lab.appendChild(r);
      lab.appendChild(document.createTextNode(' ' + (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : 'Sometimes')));
      wrap.appendChild(lab);
    });
    return wrap;
  }
  function scaleInput(name, onChange, current) {
    var wrap = h('div', 'pa-scale');
    [1,2,3,4,5].forEach(function (n) {
      var lab = h('label', 'pa-scale-opt' + (current === n ? ' pa-scale-opt--on' : ''));
      var r = document.createElement('input');
      r.type = 'radio'; r.name = name; r.value = n;
      if (current === n) r.checked = true;
      r.addEventListener('change', function () {
        onChange(n);
        Array.prototype.forEach.call(wrap.querySelectorAll('.pa-scale-opt'), function (q) { q.classList.remove('pa-scale-opt--on'); });
        lab.classList.add('pa-scale-opt--on');
      });
      lab.appendChild(r);
      lab.appendChild(document.createTextNode(' ' + n));
      wrap.appendChild(lab);
    });
    return wrap;
  }
  function selectInput(name, options, onChange, current) {
    var sel = document.createElement('select');
    sel.className = 'pa-input';
    options.forEach(function (opt) {
      var o = document.createElement('option');
      o.value = opt[0]; o.textContent = opt[1];
      if (current === opt[0]) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () { onChange(sel.value); });
    return sel;
  }
  function ageFromBaseline() {
    var bd = state.baseline.birth_date;
    if (!bd) return null;
    var b = new Date(bd);
    return Math.floor((Date.now() - b.getTime()) / (365.25 * 24 * 3600 * 1000));
  }
  function formatList(arr) {
    if (!arr) return '';
    if (Array.isArray(arr)) {
      return arr.map(function (x) {
        return typeof x === 'string' ? x : (x.name || '');
      }).filter(Boolean).join(', ');
    }
    return String(arr || '');
  }
  function parseList(txt) {
    if (!txt) return [];
    return txt.split(/[,;]+/).map(function (s) { return { name: s.trim() }; }).filter(function (x) { return x.name; });
  }
})();
