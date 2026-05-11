# Brief #14a-fix — Constitution card: language separation (EN/中)

**Classification: BUGFIX — scope: make the constitution card show ONE language at a time (EN OR 中) instead of both stacked. Two root causes: (1) the lang-hiding CSS rule isn't loaded on v2 pages — only v3 has it inline; (2) the bilingual splitter for pre-concatenated strings is too simple. Fix both inside the component file so it's self-contained.**

## Background

After Brief #14a ran, CEO confirmed via screenshot that:
- Doctor view modal renders correctly (no more `[object Object]` or raw JSON) — bug fix successful ✅
- BUT both English AND Chinese are showing simultaneously in the chips and lifestyle text — language switcher isn't hiding one ❌

**Root cause analysis:**

**Cause 1 — CSS rule missing on v2.** The rule
```css
html[lang="en"] [lang="zh"] { display: none !important; }
html[lang="zh"] [lang="en"] { display: none !important; }
```
is inline in each v3 page (`v3/index.html`, `v3/services.html`, etc.) but is NOT in `v2/assets/css/base.css`, `tokens.css`, or `components.css`. So when doctor.html or portal.html load the constitution-card component, the lang spans render but nothing hides one.

**Cause 2 — Splitter mangles non-standard strings.** The current splitter in `renderAdvice()` does:
```js
var sp = s.indexOf(' ');
var zh = sp > -1 ? s.slice(0, sp) : s;
var en = sp > -1 ? s.slice(sp + 1) : s;
```

This works for `"枸杞 Gou Qi"` (zh="枸杞", en="Gou Qi") but fails for:
- `"Polished rice & glutinous rice (粳米、糯米)"` — English first, Chinese in brackets → splitter incorrectly takes "Polished" as zh
- `"(less) Iced drinks · ice cream · cold raw foods 冰飲、雪糕、生冷食物"` — English with Chinese at end → mangled
- `"Da Zao"` (no Chinese) → falls through, both en and zh become "Da Zao" (acceptable)

## TASK A — Inject lang-hiding CSS from the component

Edit `v2/assets/js/components/constitution-card.js`. At the very top of the IIFE (right after `window.HM = window.HM || {};`), add a CSS injection block:

```js
(function () {
  'use strict';
  window.HM = window.HM || {};

  // === INJECT LANG-HIDING CSS ===
  // This component uses <span lang="en">/<span lang="zh"> spans for
  // bilingual text. Without the corresponding CSS rule, BOTH languages
  // render simultaneously. v3 pages have this rule inline; v2 pages
  // don't, so we inject it from the component itself. Self-contained.
  // Idempotent: only injects once even if the component loads twice.
  (function injectLangCSS() {
    if (document.getElementById('hm-constitution-card-lang-css')) return;
    var style = document.createElement('style');
    style.id = 'hm-constitution-card-lang-css';
    style.textContent =
      'html[lang="en"] [lang="zh"] { display: none !important; }\n' +
      'html[lang="zh"] [lang="en"] { display: none !important; }\n';
    (document.head || document.documentElement).appendChild(style);
  })();

  // === DICTIONARIES (existing code continues unchanged from here) ===
  // ...
```

This makes the component self-contained — works on doctor.html, portal.html, and any future page that loads it without needing to remember to add CSS elsewhere.

## TASK B — Smarter bilingual splitter for pre-concatenated strings

Find the existing food/herb mapping code in `renderAdvice()`. Currently it does naïve `indexOf(' ')` splitting. Replace with a smarter helper.

Add a new helper near the top of the helpers section (near `bilingual()`):

```js
/**
 * Split a pre-concatenated bilingual string into {en, zh} parts.
 *
 * Handles three formats commonly used in HansMed data:
 *   "枸杞 Gou Qi"                     → { zh: "枸杞", en: "Gou Qi" }
 *   "Ginger tea 薑茶"                  → { en: "Ginger tea", zh: "薑茶" }
 *   "Polished rice (粳米)"             → { en: "Polished rice", zh: "粳米" }
 *
 * For strings that can't be cleanly split (mixed-language phrases,
 * long compound entries with multiple separators), returns the whole
 * string for both languages. The result: when the language switcher
 * hides one span, the whole entry still shows in the other — at the
 * cost of seeing both languages, but never garbled fragments.
 */
function splitBilingual(str) {
  var s = String(str || '').trim();
  if (!s) return { en: '', zh: '' };

  // CJK Unicode ranges (covers Chinese, Japanese, Korean common chars)
  var CJK = '　-鿿＀-￯';

  // Pattern A: starts with CJK chars, has ASCII text after a space
  // e.g., "枸杞 Gou Qi" or "薑茶 Ginger tea"
  var matchZhFirst = s.match(new RegExp('^([' + CJK + '][' + CJK + '\\s、，。；：·]*?)\\s+([A-Za-z].+)$'));
  if (matchZhFirst) {
    return { zh: matchZhFirst[1].trim(), en: matchZhFirst[2].trim() };
  }

  // Pattern B: starts with ASCII, ends with CJK chunk (no parens)
  // e.g., "Ginger tea 薑茶"
  var matchEnFirst = s.match(new RegExp('^([A-Za-z][A-Za-z\\s\\.,&\'-]+?)\\s+([' + CJK + '].+)$'));
  if (matchEnFirst) {
    return { en: matchEnFirst[1].trim(), zh: matchEnFirst[2].trim() };
  }

  // Pattern C: ASCII with CJK in parens at the end
  // e.g., "Polished rice & glutinous rice (粳米、糯米)"
  var matchParenZh = s.match(new RegExp('^(.+?)\\s*\\(([' + CJK + '][^)]*)\\)\\s*$'));
  if (matchParenZh) {
    return { en: matchParenZh[1].trim(), zh: matchParenZh[2].trim() };
  }

  // Couldn't cleanly split — return the whole string for both.
  // Language switcher will show this entry as-is regardless of mode.
  return { en: s, zh: s };
}
```

Then update the food/herb mapping inside `renderAdvice()` to use it:

Find:
```js
    if (Array.isArray(adviceObj.foods) && adviceObj.foods.length) {
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
```

Replace with:
```js
    if (Array.isArray(adviceObj.foods) && adviceObj.foods.length) {
      sections.push('<div style="margin-bottom:12px;">' + sectionHeading('Recommended foods', '建議食材') +
        '<div class="text-sm" style="display:flex;flex-wrap:wrap;gap:6px;">' +
          adviceObj.foods.map(function (f) {
            var parts = splitBilingual(f);
            return '<span class="chip" style="background:var(--washi);border:1px solid var(--border);border-radius:12px;padding:3px 10px;">' +
              bilingual(parts.en, parts.zh) + '</span>';
          }).join('') +
        '</div></div>');
    }

    if (Array.isArray(adviceObj.herbs) && adviceObj.herbs.length) {
      sections.push('<div style="margin-bottom:12px;">' + sectionHeading('Recommended herbs', '建議藥材') +
        '<div class="text-sm" style="display:flex;flex-wrap:wrap;gap:6px;">' +
          adviceObj.herbs.map(function (h) {
            var parts = splitBilingual(h);
            return '<span class="chip" style="background:var(--washi);border:1px solid var(--border);border-radius:12px;padding:3px 10px;">' +
              bilingual(parts.en, parts.zh) + '</span>';
          }).join('') +
        '</div></div>');
    }
```

## TASK C — Update the avoid block to use splitBilingual

Find the existing avoid block in `renderAdvice()`:
```js
    if (adviceObj.avoid) {
      var avoidParts = String(adviceObj.avoid).split(' · ');
      var avoidEn = avoidParts[0] || '';
      var avoidZh = avoidParts[1] || avoidParts[0] || '';
      sections.push('<div style="margin-bottom:12px;">' + sectionHeading('Avoid', '忌') +
        '<div class="text-sm">' + bilingual(avoidEn, avoidZh) + '</div></div>');
    }
```

The avoid string can be a single phrase ("Cold environments & raw foods · 忌受寒及生冷食物") OR a semicolon-joined list ("Overworking & irregular sleep · 忌過勞及作息不規律; Staying up past 11pm 熬夜過11點"). Update to handle both:

Replace with:
```js
    if (adviceObj.avoid) {
      // The 'avoid' field can be a single phrase ("EN · ZH") or a
      // semicolon-joined list of phrases. Split on ';', parse each
      // phrase via splitBilingual, render each on its own line.
      var phrases = String(adviceObj.avoid).split(';').map(function (p) { return p.trim(); }).filter(Boolean);
      var rendered = phrases.map(function (phrase) {
        var parts;
        // If phrase contains ' · ', use the original split-by-separator logic.
        // Otherwise fall back to splitBilingual (for "Staying up past 11pm 熬夜過11點" pattern).
        if (phrase.indexOf(' · ') > -1) {
          var bits = phrase.split(' · ');
          parts = { en: bits[0] || '', zh: bits[1] || bits[0] || '' };
        } else {
          parts = splitBilingual(phrase);
        }
        return '<div>' + bilingual(parts.en, parts.zh) + '</div>';
      }).join('');
      sections.push('<div style="margin-bottom:12px;">' + sectionHeading('Avoid', '忌') +
        '<div class="text-sm">' + rendered + '</div></div>');
    }
```

## TASK D — Audit other pages that load the component

Check `v2/doctor.html` and `v2/portal.html` to confirm:
1. The `<script src="assets/js/components/constitution-card.js">` tag is loaded BEFORE `panels/doctor/patients.js` and `panels/patient/ai-diagnosis.js` respectively
2. The page has a language switcher that sets `<html lang>` (look for the existing nav lang buttons that flip the lang attribute)

If the language switcher in doctor.html / portal.html doesn't set `<html lang>` properly, the new CSS rule won't trigger. Most likely it does (since the rest of the page already uses lang spans for nav items), but verify.

```bash
grep -n "lang" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/doctor.html | head -20
grep -n "lang" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/portal.html | head -20
grep -n "setAttribute.*lang\|hm-lang-pref" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/lang-switcher.js
```

If the language switcher script exists and works on other v2 pages, the constitution card will inherit it correctly via the new CSS rule.

## ACCEPTANCE CRITERIA

- `v2/assets/js/components/constitution-card.js` injects the lang-hiding CSS rule at script-load time (idempotent — no double-injection)
- `splitBilingual()` helper added; handles ZH-first, EN-first, and parens-ZH patterns gracefully
- Food/herb chips use `splitBilingual()` for clean parsing
- Avoid block handles both single phrases and semicolon-joined lists
- After deploy: doctor view modal shows ONE language at a time. Toggle EN/中 in doctor nav → language flips; no stacked content
- Tongue constitution, patterns, dimensions, lifestyle tips already use the `bilingual()` helper directly (no splitting needed) — verify these still work after the CSS injection
- v2 patient view (portal.html → wellness assessment flow) also benefits from the CSS injection — verify EN/中 toggle there flips constitution data cleanly too
- Edge case: if a herb/food entry can't be parsed by `splitBilingual` (returns `{en: original, zh: original}`), the entry shows the original concatenated string in BOTH language modes (acceptable fallback — no garbled text)

## REPORT BACK

```
Files modified:
  - v2/assets/js/components/constitution-card.js

Pushed to: [commit hash]

CSS injection added: [yes/no]
splitBilingual helper added: [yes/no]
Food chips use splitBilingual: [yes/no]
Herb chips use splitBilingual: [yes/no]
Avoid handles semicolon-joined lists: [yes/no]

Post-deploy manual checks:
  Doctor view, EN mode → only English shows: [yes/no]
  Doctor view, 中 mode → only Chinese shows: [yes/no]
  Patient view, EN mode → constitution display only English: [yes/no]
  Patient view, 中 mode → constitution display only Chinese: [yes/no]
  Edge cases (parens-Chinese, ASCII-only, mixed): [list any garbled output]

Anything you noticed that needs CEO attention: [list]
```

## ROLLBACK

If anything breaks, the snapshot at `briefs/snapshots/runsheet-13-and-14a-pre-migration/` from the original Brief #14a run still has the pre-Brief-#14a state. To revert this fix specifically (keep Brief #14a but undo this fix), just remove the CSS injection block, the `splitBilingual` helper, and revert the food/herb/avoid blocks to their previous state — or use `git diff` against the previous commit.

## NOTES

- This is a follow-up patch for Brief #14a, not a re-implementation. Only `constitution-card.js` is touched.
- The CSS injection approach (component injects its own CSS) is preferred over modifying `v2/base.css` because: (1) keeps the component self-contained, (2) doesn't risk affecting other v2 pages, (3) when the component eventually moves to v3 (Brief #15+), no separate CSS migration needed.
- The `splitBilingual` helper is reusable — could later be extracted to `HM.format` if other components need it. For now, scope it to constitution-card only.
