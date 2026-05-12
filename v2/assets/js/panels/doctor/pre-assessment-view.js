/**
 * Brief #22 · Doctor handoff view for pre-assessment.
 *
 * HM.preAssessmentView.render(hostEl, preAssessmentId)
 *
 * Pulls GET /api/doctor/pre-assessment/:id and renders 6 sections:
 *   1. CRITICAL FLAGS (vitals_alerts + critical Western red_flags)
 *   2. Chief complaint + Western differentials + history answers
 *   3. Tongue findings + TCM hypothesis + confirmation answers
 *   4. Suggested treatment starting point (§11 spec)
 *   5. Prescribing contraindications (RedFlags)
 *   6. Suggested verification questions (Western + TCM)
 *
 * Plus action buttons: Confirm / Amend / Override.
 * Each is logged via POST /api/doctor/pre-assessment/:id/decision.
 *
 * Intended to be embedded inside the existing patient-detail panel
 * (doctor portal). Caller provides the host element; we render into it.
 */
(function () {
  'use strict';
  window.HM = window.HM || {};
  HM.preAssessmentView = HM.preAssessmentView || {};

  HM.preAssessmentView.render = function (hostEl, id) {
    if (!hostEl) return;
    hostEl.innerHTML = '<div class="pav-loading">Loading pre-assessment…</div>';
    HM.api.get('/doctor/pre-assessment/' + id).then(function (r) {
      var pa = r.pre_assessment || {};
      hostEl.innerHTML = '';
      hostEl.appendChild(buildHandoff(pa));
    }).catch(function (err) {
      hostEl.innerHTML = '<div class="pav-error">Couldn\'t load pre-assessment</div>';
      console.error(err);
    });
  };

  function buildHandoff(pa) {
    var root = h('div', 'pav-root');

    // 1. CRITICAL FLAGS
    var criticalFlags = collectCriticalFlags(pa);
    if (criticalFlags.length > 0) {
      var crit = section('🚨 Critical flags', 'pav-section pav-section--critical');
      criticalFlags.forEach(function (f) {
        crit.appendChild(h('div', 'pav-flag pav-flag--critical', f.msg_en + (f.msg_zh ? ' · ' + f.msg_zh : '')));
      });
      root.appendChild(crit);
    }

    // 2. Chief complaint + Western differentials
    var sec2 = section('Chief complaint · Western differentials', 'pav-section');
    sec2.appendChild(kv('Chief complaint', pa.chief_complaint || '—'));
    if (pa.symptom_timeline) sec2.appendChild(kv('Timeline', pa.symptom_timeline));
    var ca = pa.clinical_assist_output || {};
    if (ca.differentials && ca.differentials.length > 0) {
      sec2.appendChild(h('h4', 'pav-subhead', 'Differentials'));
      var ul = h('ul', 'pav-list');
      ca.differentials.forEach(function (d) {
        ul.appendChild(h('li', '', (d.name_en || '') + (d.name_zh ? ' / ' + d.name_zh : '') + (d.note ? ' — ' + d.note : '')));
      });
      sec2.appendChild(ul);
    }
    if (pa.western_history_answers && Object.keys(pa.western_history_answers).length > 0) {
      sec2.appendChild(h('h4', 'pav-subhead', 'Patient history answers'));
      Object.keys(pa.western_history_answers).forEach(function (q) {
        sec2.appendChild(h('div', 'pav-qa', [
          h('div', 'pav-qa-q', q),
          h('div', 'pav-qa-a', pa.western_history_answers[q] || '(no answer)'),
        ]));
      });
    }
    if (pa.vitals && (pa.vitals.bp_systolic || pa.vitals.pulse)) {
      sec2.appendChild(h('div', 'pav-vitals', 'BP: '
        + (pa.vitals.bp_systolic || '?') + '/' + (pa.vitals.bp_diastolic || '?')
        + '   ·   Pulse: ' + (pa.vitals.pulse || '?')
        + '   ·   Age: ' + (pa.vitals.age_at_assessment || '?')));
    }
    root.appendChild(sec2);

    // 3. Tongue + TCM hypothesis
    var sec3 = section('Tongue findings · TCM pattern hypothesis', 'pav-section');
    var ta = pa.tongue_assessment;
    if (ta) {
      if (ta.image_url) sec3.appendChild(h('img', 'pav-tongue-img', null)).src = ta.image_url;
    }
    if (pa.tcm_top_patterns && pa.tcm_top_patterns.length > 0) {
      sec3.appendChild(h('h4', 'pav-subhead', 'AI pattern hypothesis'));
      pa.tcm_top_patterns.forEach(function (p, i) {
        var label = (i === 0 ? 'Primary' : 'Secondary');
        sec3.appendChild(h('div', 'pav-pattern',
          label + ': ' + (p.pattern || '') +
          (p.confidence ? ' — confidence ' + Math.round(p.confidence * 100) + '%' : '')));
      });
    }
    if (pa.tcm_answers && Object.keys(pa.tcm_answers).length > 0) {
      sec3.appendChild(h('h4', 'pav-subhead', 'Patient\'s TCM answers'));
      var qLookup = {};
      (pa.tcm_selected_questions || []).forEach(function (sel) {
        (sel.questions || []).forEach(function (q) { qLookup[q.id] = q; });
      });
      Object.keys(pa.tcm_answers).forEach(function (qid) {
        var q = qLookup[qid];
        sec3.appendChild(h('div', 'pav-qa', [
          h('div', 'pav-qa-q', q ? (q.text_en || qid) : qid),
          h('div', 'pav-qa-a', String(pa.tcm_answers[qid])),
        ]));
      });
    }
    root.appendChild(sec3);

    // 4. Suggested treatment (§11)
    var sug = pa.suggested_treatments;
    if (sug && sug.primary) {
      var sec4 = section('💊 Suggested treatment starting point', 'pav-section pav-section--treatment');
      var p = sug.primary;
      sec4.appendChild(h('div', 'pav-treat-headline',
        'Primary: ' + (p.syndrome_name_zh || '') + ' / ' + (p.syndrome_name_en || '') +
        (p.confidence ? '  (' + Math.round(p.confidence * 100) + '%)' : '')));
      sec4.appendChild(h('div', 'pav-formula-line',
        '▸ ' + (p.formula_zh || '') +
        (p.formula_pinyin ? '  ' + p.formula_pinyin : '')));
      if (p.treatment_principle) sec4.appendChild(h('div', 'pav-principle', 'Principle: ' + p.treatment_principle));
      if (p.source) sec4.appendChild(h('div', 'pav-source', 'Source: ' + p.source));
      if (p.composition) sec4.appendChild(h('div', 'pav-composition', 'Composition: ' + (typeof p.composition === 'string' ? p.composition : JSON.stringify(p.composition))));
      if (p.modifications && p.modifications.length > 0) {
        sec4.appendChild(h('h4', 'pav-subhead', '⚠ Required modifications'));
        var modUl = h('ul', 'pav-list');
        p.modifications.forEach(function (m) {
          modUl.appendChild(h('li', '', m.rf_id + ' — ' + (m.trigger || '') + ' → ' + (m.suggested_change || '') +
            (m.affected_herbs_zh ? '   (affects: ' + m.affected_herbs_zh.join(', ') + ')' : '')));
        });
        sec4.appendChild(modUl);
      }
      if (sug.secondary_consideration) {
        var s = sug.secondary_consideration;
        sec4.appendChild(h('div', 'pav-secondary',
          'Secondary consideration: ' + (s.syndrome_name_zh || '') + ' — only if confirmed during consult. Options: ' +
          ((s.formula_options || []).join(' or ') || '—')));
      }
      sec4.appendChild(h('div', 'pav-actions', [
        btn('Start prescription from this', function () { startPrescription(pa, p); }, 'btn--primary'),
        btn('Build from blank', function () { location.hash = '#/consult/' + (pa.appointment_id || pa.id); }, 'btn--secondary'),
      ]));
      root.appendChild(sec4);
    }

    // 5. Prescribing contraindications
    var rf = pa.red_flags_detected || [];
    if (rf.length > 0) {
      var sec5 = section('⚠ Prescribing contraindications', 'pav-section pav-section--warn');
      var ul5 = h('ul', 'pav-list');
      rf.forEach(function (f) {
        ul5.appendChild(h('li', '',
          (f.id || '') + ' — ' + (f.triggered_by || f.condition || '') +
          (f.avoid_herbs && f.avoid_herbs.length > 0 ? ' → avoid: ' + f.avoid_herbs.join(', ') : '') +
          (f.severity ? '  (' + f.severity + ')' : '')));
      });
      sec5.appendChild(ul5);
      root.appendChild(sec5);
    }

    // 6. Suggested verification questions
    var verifyW = (ca.questions || []).map(function (q) { return q.q_en; });
    var verifyT = collectTcmVerifyQs(pa);
    if (verifyW.length + verifyT.length > 0) {
      var sec6 = section('Suggested verification questions', 'pav-section');
      if (verifyW.length > 0) {
        sec6.appendChild(h('h4', 'pav-subhead', 'From Western differentials'));
        var ulW = h('ul', 'pav-list');
        verifyW.slice(0, 6).forEach(function (q) { ulW.appendChild(h('li', '', q)); });
        sec6.appendChild(ulW);
      }
      if (verifyT.length > 0) {
        sec6.appendChild(h('h4', 'pav-subhead', 'From TCM hypothesis'));
        var ulT = h('ul', 'pav-list');
        verifyT.slice(0, 4).forEach(function (q) { ulT.appendChild(h('li', '', q)); });
        sec6.appendChild(ulT);
      }
      root.appendChild(sec6);
    }

    // Action row — Confirm / Amend / Override
    root.appendChild(h('div', 'pav-decision-row', [
      btn('Confirm AI hypothesis', function () { decide(pa.id, 'confirmed'); }, 'btn--primary'),
      btn('Amend', function () { decide(pa.id, 'amended'); }, 'btn--secondary'),
      btn('Override', function () { decide(pa.id, 'overridden'); }, 'btn--secondary'),
    ]));

    return root;
  }

  function decide(id, decision) {
    var notes = prompt('Notes (optional):') || '';
    HM.api.post('/doctor/pre-assessment/' + id + '/decision', {
      decision: decision, notes: notes,
    }).then(function () {
      HM.ui.toast('Decision recorded: ' + decision, 'success');
    }).catch(function (err) {
      HM.ui.toast('Couldn\'t record decision', 'danger');
      console.error(err);
    });
  }

  function startPrescription(pa, primary) {
    // Hand off to the existing prescription pad (in consult.js) with
    // pre-fill data. The consult page reads window.HM.preAssessment.handoff
    // on init and pre-fills the prescription form if present.
    HM.preAssessment.handoff = {
      formula_zh: primary.formula_zh,
      formula_pinyin: primary.formula_pinyin,
      composition: primary.composition,
      treatment_principle: primary.treatment_principle,
      modifications: primary.modifications,
      pre_assessment_id: pa.id,
    };
    location.hash = '#/consult/' + (pa.appointment_id || pa.id);
  }

  function collectCriticalFlags(pa) {
    var ca = pa.clinical_assist_output || {};
    var flags = [];
    (ca.vitals_alerts || []).forEach(function (a) {
      if (a.severity === 'critical') flags.push(a);
    });
    (ca.red_flags || []).forEach(function (a) {
      if (a.severity === 'critical') flags.push(a);
    });
    return flags;
  }

  function collectTcmVerifyQs(pa) {
    // For each top syndrome, find the highest-weighted question NOT
    // already answered → that\'s a good doctor verification question.
    var asked = pa.tcm_answers || {};
    var verify = [];
    (pa.tcm_selected_questions || []).forEach(function (sel) {
      (sel.questions || []).forEach(function (q) {
        if (!(q.id in asked) && q.clinical_weight === 'high') {
          verify.push(q.text_en);
        }
      });
    });
    return verify;
  }

  // helpers
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
  function section(title, cls) {
    var s = h('div', cls);
    s.appendChild(h('h3', 'pav-section-title', title));
    return s;
  }
  function kv(k, v) {
    return h('div', 'pav-kv', [
      h('span', 'pav-kv-k', k + ': '),
      h('span', 'pav-kv-v', String(v)),
    ]);
  }
})();
