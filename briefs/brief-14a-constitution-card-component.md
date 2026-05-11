# Brief #14a — Constitution Card component (in v2) + clean portal URL

**Classification: REFACTOR + BUGFIX + INFRA — scope: extract a reusable constitution-card component within v2, refactor doctor + patient views to use it (fixes the JSON-dump bug), add root-level /portal.html redirect for clean URLs. v2 stays the live app; component is structured for easy future migration to v3.**

## Background

CEO noticed that the doctor's "Constitution Questionnaire" detail modal renders raw JSON / `[object Object]` instead of human-readable labels. Screenshot shared on 2026-05-04.

**Root cause** (verified by code read):
- `v2/assets/js/panels/doctor/patients.js` line 1255-1256 calls a generic `renderJsonAsRows(dims)` that has no idea what `q1`, `qi_xu`, `pi_wei` etc. mean.
- The patient view (`v2/assets/js/panels/patient/ai-diagnosis.js`) has all the dictionaries needed — `DIMS` (lines 18-29), `QS` (lines 32-135), `FOLLOW_UPS` (lines 138-169), `HERB_MAP` (lines 172-184) — but they're scoped to that file only. The doctor module can't reach them.

**Strategic context:** CEO chose to keep the new component in v2 for now (v2 is still the live app; v3 only has marketing pages). The component is built so that when v3 portal eventually gets created (future Brief #15+), moving it to v3 is a one-line path change.

**Bonus:** Address CEO's URL concern (the portal URL currently shows `/v2/portal.html` which looks bad to partner referrals from BIG Caring + HeyDoc) by adding a clean `/portal.html` redirect at repo root.

## Architecture decision

```
v2/assets/js/components/constitution-card.js   ← NEW (single source of truth, lives in v2 for now)
                ▲                       ▲
                │                       │
v2/assets/js/panels/doctor/patients.js  v2/assets/js/panels/patient/ai-diagnosis.js
   (doctor view — fixes the bug)        (patient view — refactored to consume from new component)
```

- The component is at `v2/assets/js/components/constitution-card.js`. v2 is self-contained — no cross-folder imports.
- Doctor and patient panels both import from the same file via relative path `../../components/constitution-card.js`.
- A header comment in the component documents that it's expected to move to `v3/assets/js/components/` when v3 portal is built (future Brief #15+). The move is one path change + grep-and-replace across two `<script src>` lines.

## TASK A — Create the new component

Create the file: `v2/assets/js/components/constitution-card.js`

**i18n pattern (CRITICAL — read first):**
All user-facing text in the component must wrap the English version in `<span lang="en">...</span>` and the Chinese version in `<span lang="zh">...</span>`. The existing CSS in v2 (look in `v2/assets/css/base.css` or `tokens.css` — same rules as v3 pages) hides whichever doesn't match the active `<html lang>` attribute. The doctor sees ONE language at a time, controlled by the EN/中 language switcher in the nav. **Do NOT stack both languages visually.** A `bilingual(en, zh)` helper is provided in the component to keep this clean — use it everywhere. CEO confirmed this preference 2026-05-04.

**Source the dictionaries from `v2/assets/js/panels/patient/ai-diagnosis.js`:**
- `DIMS` object (lines 18-29 of the source file)
- `QS` array (lines 32-135)
- `FOLLOW_UPS` object (lines 138-169)
- `HERB_MAP` object (lines 172-184)
- The `getConstitution(dims)` function (search for it in ai-diagnosis.js — it derives constitution patterns from dimension scores, around line 779)
- The `getTips(dims)` function if present (around line 802)

**Move them into the new component file** (don't copy — move; the patient file imports them back via the new namespace, see Task C). Wrap everything in an IIFE that exposes a single namespace `HM.constitutionCard`:

```js
/**
 * v2/assets/js/components/constitution-card.js
 *
 * Single source of truth for rendering TCM constitution data.
 * Used by:
 *   - v2/assets/js/panels/doctor/patients.js  (doctor view)
 *   - v2/assets/js/panels/patient/ai-diagnosis.js  (patient view)
 *
 * MIGRATION NOTE: This file currently lives in v2 because v2 is still
 * the live app. When v3 portal is built (future Brief #15+), move this
 * file to v3/assets/js/components/constitution-card.js and update the
 * <script src> tags in v2/doctor.html and v2/portal.html to point at
 * the new path. No code changes inside the component will be needed.
 *
 * Public API (all functions return HTML strings):
 *   HM.constitutionCard.renderAnswers(symObj)        — q1-q10 with question text + answer label
 *   HM.constitutionCard.renderDimensions(dimsObj)    — labelled dimension scores
 *   HM.constitutionCard.renderPatterns(patternsArr)  — derived constitution patterns
 *   HM.constitutionCard.renderAdvice(adviceObj)      — tips/foods/herbs/avoid grouped
 *   HM.constitutionCard.renderTongue(tongueObj)      — tongue constitution + confidence
 *   HM.constitutionCard.renderFull(data)             — convenience: all of the above
 *
 * Public dictionaries (read-only, exposed for callers that need raw labels):
 *   HM.constitutionCard.DIMS
 *   HM.constitutionCard.QS
 *   HM.constitutionCard.FOLLOW_UPS
 *   HM.constitutionCard.HERB_MAP
 *
 * Helpers:
 *   HM.constitutionCard.getConstitution(dims)
 *   HM.constitutionCard.getTips(dims)
 *   HM.constitutionCard.scoreLabel(value, dimKey)    — turns -2/-1/0/1/2 into bilingual text
 */
(function () {
  'use strict';
  window.HM = window.HM || {};

  // === DICTIONARIES (moved from v2/assets/js/panels/patient/ai-diagnosis.js) ===
  var DIMS = { /* ... copy the entire DIMS object verbatim ... */ };
  var QS = [ /* ... copy the entire QS array verbatim ... */ ];
  var FOLLOW_UPS = { /* ... */ };
  var HERB_MAP = { /* ... */ };

  // === HELPERS ===

  function esc(s) {
    return (HM.format && HM.format.esc) ? HM.format.esc(s) : String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /**
   * Bilingual wrapper — emits BOTH languages wrapped in lang spans.
   * The existing CSS in v2 base.css (html[lang="en"] [lang="zh"] { display:none })
   * hides whichever doesn't match the active language. Doctor sees EN OR ZH,
   * never both stacked. Same pattern as v3 pages.
   *
   * Usage: bilingual('Energy', '能量') →
   *   '<span lang="en">Energy</span><span lang="zh">能量</span>'
   */
  function bilingual(en, zh) {
    return '<span lang="en">' + esc(en || '') + '</span>' +
           '<span lang="zh">' + esc(zh || en || '') + '</span>';
  }

  /** Find the question definition (with title/options) for a given q-id. */
  function findQuestion(qId) {
    return QS.find(function (q) { return q.id === qId; }) || null;
  }

  /** Convert a numeric answer value to its option label using QS metadata. */
  function answerLabel(qId, value) {
    var q = findQuestion(qId);
    if (!q) return { en: '(unknown)', zh: '（未知）' };
    var opt = (q.opts || []).find(function (o) { return o.v === value; });
    if (!opt) return { en: 'Score: ' + value, zh: '分數：' + value };
    return { en: opt.t, zh: opt.s };
  }

  /** Convert a dimension code + score to a human-readable label. */
  function scoreLabel(value, dimKey) {
    if (value == null) return { en: '—', zh: '—' };
    var dim = DIMS[dimKey];
    if (!dim) return { en: String(value), zh: String(value) };
    if (value <= dim.min) return { en: dim.minLbl, zh: dim.minLbl };
    if (value >= dim.max) return { en: dim.maxLbl, zh: dim.maxLbl };
    if (value === 0) return { en: 'Balanced', zh: '平衡' };
    if (value < 0) return { en: 'Tends toward ' + dim.minLbl, zh: '偏 ' + dim.minLbl };
    return { en: 'Tends toward ' + dim.maxLbl, zh: '偏 ' + dim.maxLbl };
  }

  // === RENDERERS (return HTML strings) ===

  function renderAnswers(symObj) {
    if (!symObj || typeof symObj !== 'object') {
      return '<p class="text-muted text-sm">' + bilingual('No answers recorded', '無答案記錄') + '</p>';
    }
    var qIds = QS.map(function (q) { return q.id; });
    var rows = qIds.map(function (qId) {
      if (!(qId in symObj)) return '';
      var q = findQuestion(qId);
      var label = answerLabel(qId, symObj[qId]);
      return '<div style="padding:8px 0;border-bottom:1px solid var(--border);">' +
        '<div class="text-xs text-muted" style="margin-bottom:4px;">' +
          '<strong>' + esc(qId.toUpperCase()) + '</strong> · ' +
          bilingual(q ? q.titleEn : '', q ? q.titleZh : '') +
        '</div>' +
        '<div class="text-sm" style="font-weight:600;color:var(--ink);">' +
          bilingual(label.en, label.zh) +
        '</div>' +
      '</div>';
    }).filter(Boolean).join('');
    return rows || '<p class="text-muted text-sm">' + bilingual('No matching answers', '無對應答案') + '</p>';
  }

  function renderDimensions(dimsObj) {
    if (!dimsObj || typeof dimsObj !== 'object') {
      return '<p class="text-muted text-sm">' + bilingual('No dimensions recorded', '無維度資料') + '</p>';
    }
    var keys = Object.keys(DIMS);
    var rows = keys.map(function (k) {
      if (!(k in dimsObj)) return '';
      var dim = DIMS[k];
      var v = dimsObj[k];
      var lbl = scoreLabel(v, k);
      // Simple visual bar — width based on score normalized to 0-100%
      var pct = ((v - dim.min) / (dim.max - dim.min)) * 100;
      return '<div style="display:flex;align-items:center;gap:12px;padding:6px 0;">' +
        '<div style="flex:0 0 180px;" class="text-xs" style="font-weight:600;">' +
          bilingual(dim.enShort, dim.zhShort) +
        '</div>' +
        '<div style="flex:1;height:8px;background:var(--washi);border-radius:4px;overflow:hidden;">' +
          '<div style="width:' + pct + '%;height:100%;background:var(--gold,#B8965A);"></div>' +
        '</div>' +
        '<div style="flex:0 0 110px;text-align:right;" class="text-xs" style="font-weight:600;">' +
          bilingual(lbl.en, lbl.zh) +
        '</div>' +
      '</div>';
    }).filter(Boolean).join('');
    return rows || '<p class="text-muted text-sm">' + bilingual('No matching dimensions', '無對應維度') + '</p>';
  }

  function renderPatterns(patternsArr) {
    if (!Array.isArray(patternsArr) || !patternsArr.length) {
      return '<p class="text-muted text-sm">' + bilingual('No patterns derived', '未判定體質') + '</p>';
    }
    return patternsArr.map(function (p) {
      // p is expected shape: { l: 'Qi Deficiency', c: '氣虧質', col: 'blue', d: '...', dZh: '...' }
      var color = p.col === 'red' ? '#c44a3e' : p.col === 'blue' ? '#3a6e9b' : p.col === 'yellow' ? '#b5881a' : 'var(--ink)';
      return '<div style="padding:10px;border-left:3px solid ' + color + ';background:#fff;margin-bottom:8px;">' +
        '<div class="text-sm" style="font-weight:600;color:' + color + ';">' +
          bilingual(p.l || '(pattern)', p.c || p.l || '(pattern)') +
        '</div>' +
        (p.d || p.dZh ? '<div class="text-xs" style="margin-top:4px;color:var(--ink);">' +
          bilingual(p.d || '', p.dZh || p.d || '') +
        '</div>' : '') +
      '</div>';
    }).join('');
  }

  function renderAdvice(adviceObj) {
    if (!adviceObj || typeof adviceObj !== 'object') {
      return '<p class="text-muted text-sm">' + bilingual('No advice recorded', '無建議') + '</p>';
    }
    var sections = [];

    function sectionHeading(en, zh) {
      return '<div class="text-xs text-muted" style="font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">' +
        bilingual(en, zh) +
      '</div>';
    }

    if (Array.isArray(adviceObj.tips) && adviceObj.tips.length) {
      sections.push('<div style="margin-bottom:12px;">' + sectionHeading('Lifestyle tips', '生活建議') +
        adviceObj.tips.map(function (t) {
          return '<div style="padding:6px 0;display:flex;gap:8px;">' +
            '<span style="flex-shrink:0;">' + esc(t.icon || '·') + '</span>' +
            '<div class="text-sm">' + bilingual(t.en || '', t.zh || t.en || '') + '</div>' +
          '</div>';
        }).join('') + '</div>');
    }

    if (adviceObj.avoid) {
      // The 'avoid' field in the existing data is a single string with both
      // languages joined by ' · '. Split on it and treat first half as EN,
      // second as ZH so the language switcher works correctly.
      var avoidParts = String(adviceObj.avoid).split(' · ');
      var avoidEn = avoidParts[0] || '';
      var avoidZh = avoidParts[1] || avoidParts[0] || '';
      sections.push('<div style="margin-bottom:12px;">' + sectionHeading('Avoid', '忌') +
        '<div class="text-sm">' + bilingual(avoidEn, avoidZh) + '</div></div>');
    }

    if (Array.isArray(adviceObj.foods) && adviceObj.foods.length) {
      // Each food item is typically formatted as "薑茶 Ginger tea" (zh + en).
      // Split on first space; first part = zh, rest = en.
      sections.push('<div style="margin-bottom:12px;">' + sectionHeading('Recommended foods', '建議食材') +
        '<div class="text-sm" style="display:flex;flex-wrap:wrap;gap:6px;">' +
          adviceObj.foods.map(function (f) {
            var s = String(f);
            var sp = s.indexOf(' ');
            var zh = sp > -1 ? s.slice(0, sp) : s;
            var en = sp > -1 ? s.slice(sp + 1) : s;
            return '<span class="chip" style="background:var(--washi);border:1px solid var(--border);border-radius:12px;padding:3px 10px;">' +
              bilingual(en, zh) + '</span>';
          }).join('') +
        '</div></div>');
    }

    if (Array.isArray(adviceObj.herbs) && adviceObj.herbs.length) {
      sections.push('<div style="margin-bottom:12px;">' + sectionHeading('Recommended herbs', '建議藥材') +
        '<div class="text-sm" style="display:flex;flex-wrap:wrap;gap:6px;">' +
          adviceObj.herbs.map(function (h) {
            var s = String(h);
            var sp = s.indexOf(' ');
            var zh = sp > -1 ? s.slice(0, sp) : s;
            var en = sp > -1 ? s.slice(sp + 1) : s;
            return '<span class="chip" style="background:var(--washi);border:1px solid var(--border);border-radius:12px;padding:3px 10px;">' +
              bilingual(en, zh) + '</span>';
          }).join('') +
        '</div></div>');
    }

    return sections.length ? sections.join('') : '<p class="text-muted text-sm">' + bilingual('No advice content', '無建議內容') + '</p>';
  }

  function renderTongue(tongueObj) {
    if (!tongueObj || typeof tongueObj !== 'object') {
      return '<p class="text-muted text-sm">' + bilingual('No tongue assessment', '無舌診') + '</p>';
    }
    var nameEn = tongueObj.name_en || '(unnamed)';
    var nameZh = tongueObj.name_zh || nameEn;
    var conf = tongueObj.confidence != null ? Math.round(tongueObj.confidence * 100) + '%' : '—';
    return '<div style="padding:12px;background:var(--washi);border-radius:6px;">' +
      '<div class="text-sm" style="font-weight:600;color:var(--ink);">' + bilingual(nameEn, nameZh) + '</div>' +
      '<div class="text-xs text-muted" style="margin-top:4px;">' + bilingual('Confidence: ' + conf, '信心度：' + conf) + '</div>' +
    '</div>';
  }

  function renderFull(data) {
    data = data || {};
    var html = '';
    function sectionLabel(en, zh) {
      return '<div class="text-label mt-4 mb-2">' + bilingual(en, zh) + '</div>';
    }
    if (data.symptoms)            html += sectionLabel('🧭 Constitution answers', '🧭 體質問答')   + renderAnswers(data.symptoms);
    if (data.dimensions)          html += sectionLabel('📊 Dimensions', '📊 維度')                 + renderDimensions(data.dimensions);
    if (data.patterns)            html += sectionLabel('🎯 Patterns', '🎯 體質判定')              + renderPatterns(data.patterns);
    if (data.doctor_advice)       html += sectionLabel('💡 Doctor\'s advice', '💡 醫師建議')      + renderAdvice(data.doctor_advice);
    if (data.tongue_constitution) html += sectionLabel('👅 Tongue constitution', '👅 舌診體質')   + renderTongue(data.tongue_constitution);
    return html || '<p class="text-muted text-sm">' + bilingual('No constitution data', '無體質資料') + '</p>';
  }

  // === HELPERS LIFTED FROM ai-diagnosis.js ===

  function getConstitution(d) {
    // Copy the function body verbatim from ai-diagnosis.js (around line 779).
    // Returns array of pattern objects with {l, c, col, d, dZh}.
    /* ... */
  }

  function getTips(d) {
    // Copy from ai-diagnosis.js (around line 802).
    /* ... */
  }

  // === EXPOSE PUBLIC API ===
  HM.constitutionCard = {
    DIMS: DIMS,
    QS: QS,
    FOLLOW_UPS: FOLLOW_UPS,
    HERB_MAP: HERB_MAP,
    renderAnswers: renderAnswers,
    renderDimensions: renderDimensions,
    renderPatterns: renderPatterns,
    renderAdvice: renderAdvice,
    renderTongue: renderTongue,
    renderFull: renderFull,
    answerLabel: answerLabel,
    scoreLabel: scoreLabel,
    findQuestion: findQuestion,
    getConstitution: getConstitution,
    getTips: getTips,
  };
})();
```

**Important:** the bracketed `/* ... */` placeholders need to be filled with the actual code copied verbatim from `v2/assets/js/panels/patient/ai-diagnosis.js`. Read that file thoroughly before writing — copy `DIMS`, `QS`, `FOLLOW_UPS`, `HERB_MAP`, `getConstitution()`, and `getTips()` exactly. No modifications to the data; only re-housing.

## TASK B — Patch v2 doctor view to use the new component

Edit `v2/assets/js/panels/doctor/patients.js`:

### B1 — Replace the buggy block at lines 1245-1257

Find:
```js
    // ── 10-dimension constitution answers (everything in symptoms
    //     except the metadata keys). ──
    var META_KEYS = ['kind','review_status','reviewed_by','reviewed_at','review_note','chief_concern'];
    var dims = {};
    Object.keys(sym).forEach(function (k) {
      if (META_KEYS.indexOf(k) === -1) dims[k] = sym[k];
    });
    var dimsBlock = '';
    if (Object.keys(dims).length) {
      dimsBlock =
        '<div class="text-label mt-4 mb-2">🧭 Constitution answers · 體質問答</div>' +
        '<div class="card" style="padding:var(--s-3);">' + renderJsonAsRows(dims) + '</div>';
    }
```

Replace with:
```js
    // ── Constitution answers + dimensions + patterns + advice + tongue
    //     Rendered via shared component HM.constitutionCard (lives in
    //     v2/assets/js/components/constitution-card.js — see Brief #14a).
    //     The component knows the q1-q10 question text, dimension labels,
    //     and herb/food/avoid mappings; previously this section dumped
    //     raw JSON because the doctor module couldn't reach those
    //     dictionaries (they were scoped to ai-diagnosis.js).
    var META_KEYS = ['kind','review_status','reviewed_by','reviewed_at','review_note','chief_concern','lifestyle','diet','discomfort_areas','dimensions','patterns','doctor_advice','tongue_constitution','tongue_assessment_id','tongue_image_url'];
    var qAnswers = {};
    Object.keys(sym).forEach(function (k) {
      if (META_KEYS.indexOf(k) === -1) qAnswers[k] = sym[k];
    });

    // Helper for language-switcher-aware section labels.
    function sectionLabel(en, zh) {
      return '<div class="text-label mt-4 mb-2">' +
        '<span lang="en">' + en + '</span><span lang="zh">' + zh + '</span>' +
      '</div>';
    }

    var dimsBlock = '';
    if (window.HM && HM.constitutionCard) {
      var sections = '';
      if (Object.keys(qAnswers).length) {
        sections += sectionLabel('🧭 Constitution answers', '🧭 體質問答') +
          '<div class="card" style="padding:var(--s-3);">' + HM.constitutionCard.renderAnswers(qAnswers) + '</div>';
      }
      if (sym.dimensions) {
        sections += sectionLabel('📊 Dimensions', '📊 維度') +
          '<div class="card" style="padding:var(--s-3);">' + HM.constitutionCard.renderDimensions(sym.dimensions) + '</div>';
      }
      if (sym.patterns) {
        sections += sectionLabel('🎯 Patterns', '🎯 體質判定') +
          '<div class="card" style="padding:var(--s-3);">' + HM.constitutionCard.renderPatterns(sym.patterns) + '</div>';
      }
      if (sym.doctor_advice) {
        sections += sectionLabel('💡 Doctor\'s advice', '💡 醫師建議') +
          '<div class="card" style="padding:var(--s-3);">' + HM.constitutionCard.renderAdvice(sym.doctor_advice) + '</div>';
      }
      if (sym.tongue_constitution) {
        sections += sectionLabel('👅 Tongue constitution', '👅 舌診體質') +
          '<div class="card" style="padding:var(--s-3);">' + HM.constitutionCard.renderTongue(sym.tongue_constitution) + '</div>';
      }
      dimsBlock = sections;
    } else {
      // Fallback if the component fails to load — keeps the page from breaking.
      dimsBlock = sectionLabel('🧭 Constitution data', '🧭 體質資料') +
        '<div class="card" style="padding:var(--s-3);">' +
          '<p class="text-xs text-muted">' +
            '<span lang="en">Constitution component failed to load. Please refresh the page.</span>' +
            '<span lang="zh">體質卡元件載入失敗，請重新整理頁面。</span>' +
          '</p>' +
        '</div>';
    }
```

### B2 — Add the script include to v2/doctor.html

Find `v2/doctor.html` and locate the `<script>` block where panel files are loaded (search for `panels/doctor/patients.js`). Add this line BEFORE that script tag:

```html
<!-- Brief #14a: shared Constitution Card component.
     Used by both doctor and patient panels. Will eventually move to
     v3/assets/js/components/ when v3 portal is built (Brief #15+). -->
<script src="assets/js/components/constitution-card.js"></script>
```

Path is relative to `v2/doctor.html` — the file lives at `v2/assets/js/components/constitution-card.js`, so the relative include is `assets/js/components/constitution-card.js`. Verify by opening v2/doctor.html in a browser after deploy and checking the network tab.

## TASK C — Refactor v2 patient view to use the new component (no behavior change)

Edit `v2/assets/js/panels/patient/ai-diagnosis.js`:

### C1 — Remove the now-duplicated dictionaries

Delete the local definitions of `DIMS`, `QS`, `FOLLOW_UPS`, `HERB_MAP` (lines 18-184 approximately). These are now in the shared component.

### C2 — Replace local references with `HM.constitutionCard.*`

After the IIFE opens, add a reference shortcut:
```js
(function () {
  // Pull dictionaries from the shared component (loaded by portal.html).
  var DIMS       = HM.constitutionCard.DIMS;
  var QS         = HM.constitutionCard.QS;
  var FOLLOW_UPS = HM.constitutionCard.FOLLOW_UPS;
  var HERB_MAP   = HM.constitutionCard.HERB_MAP;
  var getConstitution = HM.constitutionCard.getConstitution;
  var getTips         = HM.constitutionCard.getTips;
  // ... rest of file unchanged
```

This is a NO-OP refactor — no behavior change for the patient. Just re-routing the data source.

### C3 — Add the script include to v2/portal.html

Same as Task B2 but for `v2/portal.html`. Add BEFORE the `panels/patient/ai-diagnosis.js` script tag:

```html
<!-- Brief #14a: shared Constitution Card component.
     Used by both doctor and patient panels. Will eventually move to
     v3/assets/js/components/ when v3 portal is built (Brief #15+). -->
<script src="assets/js/components/constitution-card.js"></script>
```

## TASK D — Backup snapshot script

Before running Tasks A-C, create a snapshot of the current files for rollback insurance.

Create `briefs/snapshots/brief-14a-pre-migration/` directory and save:
- A copy of `v2/assets/js/panels/doctor/patients.js` (full file)
- A copy of `v2/assets/js/panels/patient/ai-diagnosis.js` (full file)
- A README explaining how to revert

```bash
mkdir -p /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/briefs/snapshots/brief-14a-pre-migration
cp /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/panels/doctor/patients.js \
   /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/briefs/snapshots/brief-14a-pre-migration/patients.js
cp /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/panels/patient/ai-diagnosis.js \
   /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/briefs/snapshots/brief-14a-pre-migration/ai-diagnosis.js
```

Create the README at the same location:
```markdown
# Brief #14a — Pre-migration snapshot

These files are the working state of the doctor and patient views BEFORE
the constitution-card component refactor. If the new component breaks
something:

1. Copy `patients.js` back to `v2/assets/js/panels/doctor/patients.js`
2. Copy `ai-diagnosis.js` back to `v2/assets/js/panels/patient/ai-diagnosis.js`
3. Remove the `<script src="assets/js/components/constitution-card.js"></script>` line from `v2/doctor.html` and `v2/portal.html`
4. Optionally delete `v2/assets/js/components/constitution-card.js`
5. Commit, push.

Date: 2026-05-04
Brief: #14a
```

## TASK E — Repo-wide audit / grep

After all edits, verify nothing else in v2 still uses `renderJsonAsRows` for constitution data, and verify no other v2 page renders constitution data without going through the new component.

```bash
# Find all uses of renderJsonAsRows
grep -rn "renderJsonAsRows" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/

# Find any other places rendering constitution data raw
grep -rn "JSON.stringify.*constitution\|constitution.*JSON.stringify" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/
grep -rn "tongue_constitution\b" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/

# Confirm the new component file exists and is non-empty
ls -la /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/components/constitution-card.js
wc -l /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/components/constitution-card.js
```

**Acceptable results:**
- `renderJsonAsRows` may still appear in other panels (lifestyle/diet/discomfort areas in the doctor view still use it for non-constitution data — that's fine).
- Any uses in CONSTITUTION context (search results showing "constitution" or "qi_xu" near the call) need to be flagged — they're additional bug sites we missed.

Report any unexpected matches in the final report.

## TASK F — Clean portal URL (root-level redirect)

CEO noticed that clicking "Sign In" / "My Portal" on v3 sends users to `https://hansmedtcm.github.io/Hansmed-system/v2/portal.html`, which exposes the v2 path. With BIG Caring + HeyDoc partnership coming, this looks unprofessional.

Solution: add a root-level `portal.html` that redirects to v2/portal.html (same trick as the root index.html from Brief #12). When v3 portal is eventually built, just change the redirect target.

Create `/portal.html` (at the repo root, NOT inside v2/ or v3/):

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Brief #14a 2026-05-04: clean URL for the patient portal.
     Currently redirects to v2/portal.html. When v3 portal is built,
     change the redirect target below to v3/portal.html. -->
<meta http-equiv="refresh" content="0; url=v2/portal.html">
<title>Patient Portal · HansMed Modern TCM</title>
<link rel="canonical" href="v2/portal.html">
<style>
  body { font-family: 'DM Sans', sans-serif; padding: 40px 20px; text-align: center; color: #2C2620; background: #F5F1EA; }
  a { color: #B5881A; }
</style>
</head>
<body>
<p>Opening your patient portal…</p>
<p>If you are not redirected automatically, <a href="v2/portal.html">click here</a>.</p>
<script>
  location.replace('v2/portal.html');
</script>
</body>
</html>
```

Same pattern for the staff app pages — create the following at repo root:
- `/doctor.html` → redirects to `v2/doctor.html`
- `/pharmacy.html` → redirects to `v2/pharmacy.html`
- `/admin.html` → redirects to `v2/admin.html`

Each one identical to portal.html with the URL and `<title>` adjusted appropriately.

### F2 — Update v3 nav links to use the clean URLs

In each of the 4 v3 pages (`v3/index.html`, `v3/about.html`, `v3/services.html`, `v3/practitioners.html`), find references to `../v2/portal.html`, `../v2/doctor.html`, etc. in:
- The Sign In / My Portal button (search for `PORTAL_URL` and `nav-signin`)
- Any other anchor tags pointing to v2 portal/doctor/pharmacy/admin

Replace with a relative path to the root: `../portal.html` (from a v3 page, going up one level reaches the repo root, then `portal.html` is the new redirect).

**Be careful:** GitHub Pages serves the repo at `/Hansmed-system/`, so the bare URL `/portal.html` would NOT resolve correctly (it'd hit github.io's root, not the repo root). Use the relative path `../portal.html` from v3 pages. Test by clicking through after deploy.

## TASK G — Update TASKS.md

Find `E:\Hansmed-system\TASKS.md` and:

1. Mark Brief #5 (paused — patient questionnaire history) as **superseded by Brief #14a**:
   ```markdown
   - [SUPERSEDED] Brief #5: Patient Questionnaire History
     → Replaced by Brief #14a (Constitution Card component) which solves the underlying issue more comprehensively.
   ```

2. Add Brief #14a as completed:
   ```markdown
   - [DONE] Brief #14a: Constitution Card component (in v2) + clean portal URL [2026-05-04]
   ```

3. Add a follow-up for Brief #14b (the bigger constitution card / shareable marketing card work) as planned, since #14a unblocks it:
   ```markdown
   - [PLANNED] Brief #14b: Shareable Constitution Card (marketing) — uses HM.constitutionCard component built in #14a
   ```

4. Add a follow-up note for the eventual v3 portal migration:
   ```markdown
   - [PLANNED] Brief #15+: v3 portal migration (move HM.constitutionCard to v3, build v3 portal/doctor/pharmacy/admin pages)
   ```

If TASKS.md doesn't have the exact format above, adapt to match the existing style — preserve the file's conventions.

## ACCEPTANCE CRITERIA

- New file `v2/assets/js/components/constitution-card.js` exists, contains `DIMS`, `QS`, `FOLLOW_UPS`, `HERB_MAP`, `getConstitution`, `getTips`, and the 6 render functions, exposed via `HM.constitutionCard`.
- `v2/assets/js/panels/doctor/patients.js` no longer calls `renderJsonAsRows(dims)` for constitution data; it uses `HM.constitutionCard.renderAnswers/Dimensions/Patterns/Advice/Tongue` instead.
- `v2/doctor.html` includes the new component script BEFORE the doctor panels load.
- `v2/assets/js/panels/patient/ai-diagnosis.js` no longer has local copies of `DIMS`, `QS`, `FOLLOW_UPS`, `HERB_MAP`; it pulls from `HM.constitutionCard`.
- `v2/portal.html` includes the new component script BEFORE ai-diagnosis.js loads.
- Patient view behavior is unchanged (verify by clicking through the wellness assessment flow after deploy).
- Doctor view "Constitution Questionnaire" detail modal now shows readable labels (q1: full question text + answer label, dimensions: bilingual short labels with score bar, patterns: colored cards, advice: grouped sections, tongue: name + confidence).
- Snapshot files exist at `briefs/snapshots/brief-14a-pre-migration/` with README.
- Audit grep run, results documented (no orphan `renderJsonAsRows` calls in constitution context).
- Root-level `/portal.html`, `/doctor.html`, `/pharmacy.html`, `/admin.html` exist and redirect correctly to `/v2/portal.html` etc.
- v3 nav links in all 4 v3 pages updated to use clean URLs (`../portal.html` not `../v2/portal.html`).
- Migration note in component header explains the future move to v3.
- All user-facing text wrapped in `<span lang="en">`/`<span lang="zh">` — no stacked bilingual display. Toggling EN/中 in the nav language switcher hides one and shows the other (verify by clicking the switcher after deploy).
- After deploy:
  - `https://hansmedtcm.github.io/Hansmed-system/portal.html` lands on v2 portal with the v2 URL hidden in the address bar (until redirect completes — the URL DOES change to v2/portal.html after the meta-refresh fires; that's expected for now, will be solved when v3 portal exists or custom domain is set up).
  - Doctor sees readable constitution data, no `[object Object]`, no raw JSON.
  - Patient assessment flow works end-to-end with no regressions.
- TASKS.md updated.

## REPORT BACK

```
Files created:
  - v2/assets/js/components/constitution-card.js  (lines: ?)
  - /portal.html
  - /doctor.html
  - /pharmacy.html
  - /admin.html
  - briefs/snapshots/brief-14a-pre-migration/patients.js
  - briefs/snapshots/brief-14a-pre-migration/ai-diagnosis.js
  - briefs/snapshots/brief-14a-pre-migration/README.md

Files modified:
  - v2/assets/js/panels/doctor/patients.js
  - v2/assets/js/panels/patient/ai-diagnosis.js
  - v2/doctor.html
  - v2/portal.html
  - v3/index.html
  - v3/about.html
  - v3/services.html
  - v3/practitioners.html
  - TASKS.md

Pushed to: [commit hash]

Component dictionaries successfully moved from ai-diagnosis.js to new component: [yes/no]
Doctor view JSON-dump bug fixed: [yes/no — verify by manual check after deploy]
Patient view refactor is no-op (behavior unchanged): [yes/no — verify by clicking through assessment]
Snapshot files saved for rollback: [yes/no]
Audit grep results:
  - renderJsonAsRows calls remaining (non-constitution): [list]
  - Orphan constitution rendering found: [should be 'none']

Clean URLs deployed:
  - /portal.html → v2/portal.html: [tested, works/broken]
  - /doctor.html → v2/doctor.html: [tested, works/broken]
  - /pharmacy.html → v2/pharmacy.html: [tested, works/broken]
  - /admin.html → v2/admin.html: [tested, works/broken]

v3 nav links updated to clean URLs: [yes/no]

TASKS.md updated: [yes/no]

Anything you noticed that needs CEO attention: [list]
```

## ROLLBACK PROCEDURE

If anything breaks:
1. Copy `briefs/snapshots/brief-14a-pre-migration/patients.js` back to `v2/assets/js/panels/doctor/patients.js`
2. Copy `briefs/snapshots/brief-14a-pre-migration/ai-diagnosis.js` back to `v2/assets/js/panels/patient/ai-diagnosis.js`
3. Remove the `<script src="assets/js/components/constitution-card.js"></script>` lines from `v2/doctor.html` and `v2/portal.html`
4. Optionally delete `v2/assets/js/components/constitution-card.js` and the root-level `*.html` redirect files (they're harmless if left in place)
5. Revert v3 nav links to `../v2/portal.html` etc.
6. Commit, push. Patient + doctor views revert to pre-Brief-14a state.

## NOTES

- This brief does NOT migrate any portal logic to v3. The component lives in v2. The portal itself stays at v2 — that's a future Brief #15+.
- The `HM.constitutionCard` component is designed to be called from anywhere in the codebase. When Brief #14b ships (shareable constitution card for marketing), it'll use the same component — no duplication.
- The fallback in Task B1 (the `else` branch that shows "Component failed to load") protects against the component file being missing or blocked. Keeps v2 functional even in edge cases.
- Bilingual EN/ZH parity is preserved throughout — every label has both languages.
- No backend changes. All data shapes stay the same. This is purely a frontend refactor.
- Future v3 migration (Brief #15+) is now a 3-step move: (1) move the component file to v3/assets/js/components/, (2) update the two `<script src>` lines in v2/doctor.html and v2/portal.html, (3) update the migration note in the component header. No code changes inside the component.
