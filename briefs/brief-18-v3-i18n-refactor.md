# Brief #18 — v3 pages: full i18n dictionary refactor

**Classification: ARCHITECTURE / REFACTOR — scope: replace the inline `<span lang="en">/<span lang="zh">` pattern across all 4 v3 pages with a centralised i18n dictionary + runtime loader. Standardize on traditional Chinese throughout. Fix all orphan text identified in the language audit. Phased over 6 checkpoints so verification happens between pages.**

**⚠️ IMPORTANT TIMING CONTEXT:** This is a 2-3 day refactor running during the soft launch sprint. CEO chose this path with eyes open to the trade-off. Each phase below has its own commit + verification gate so rollback is possible at any checkpoint. Do NOT skip a phase or batch them. If Phase 1 verification fails, STOP and report — don't move to Phase 2.

## Pre-requisites (verify before starting)

- Brief #13 (v3/services.html pricing update) MUST be deployed before this brief runs. Otherwise services.html will be in a transitional state and migrating it to i18n will conflict with #13's edits.
- Brief #14a (constitution-card component) and Brief #14a-fix can be in any state; they don't touch v3 pages directly.
- Brief #16 (voucher per-user limit) can run before, during, or after this brief; no conflicts.

If Brief #13 hasn't run, STOP and run Brief #13 first. Confirm with CEO.

## Background

CEO requested all v3 pages use a centralised i18n dictionary so:
1. One source of truth for every piece of UI text (EN + ZH)
2. Easier to add Bahasa Malaysia later
3. Easier for translators to maintain
4. Decouples content from markup

**Audit findings the i18n migration must also fix:**
- index.html: `+18` ZH/EN imbalance — mostly simplified Chinese mixed with traditional (汉方 vs 漢方). Standardize on traditional throughout.
- All 4 pages: orphan text (visible in BOTH EN and 中 modes regardless of toggle):
  - index.html (lines ~1204, 1205, 1230, 1231, 1237, 1238, 1253, 1254, 1262)
  - All pages: footer certification labels "Malaysia", "Approved", "Registered TCM"
- Two ZH-only paragraphs in index.html (lines 1321, 1338) need English equivalents

## Architecture

```
v3/assets/js/i18n/
  ├── dict.js        ← single dictionary, both languages
  └── i18n.js        ← runtime loader: walks DOM, replaces text, handles language switching

v3/index.html        ← uses <span data-i18n="home.hero.title"></span> instead of inline EN/ZH spans
v3/about.html        ← same pattern
v3/services.html     ← same pattern (after Brief #13)
v3/practitioners.html ← same pattern
```

**Design choices:**
1. **Single dict file** (not split into `dict.en.js` + `dict.zh.js`) — simpler to maintain, both languages travel together
2. **Synchronous load in `<head>`** — prevents FOUC. Dict + loader inlined or loaded with `defer="false"` blocking
3. **Data-attribute driven** — `<span data-i18n="key.path"></span>` is the migration target
4. **Backward compatible fallback** — if a `data-i18n` key is missing from dict, the loader logs a warning and leaves the element's existing text alone (so the migration can be partial without breaking the page)
5. **Existing language switcher works unchanged** — the EN/中 buttons in nav still call `setLang('en'|'zh')` which sets `<html lang>` — the i18n loader listens to this and re-renders text

---

## PHASE 1 — Build i18n infrastructure (commit + verify)

**Goal:** Create the dictionary + loader files. Test on a SINGLE element in index.html (not a full migration). Confirm the runtime works before touching the rest of the pages.

### P1.1 — Pre-flight snapshot

```bash
SNAP=/sessions/lucid-gallant-goldberg/mnt/Hansmed-system/briefs/snapshots/brief-18-i18n-pre-migration
mkdir -p $SNAP
cp /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/index.html $SNAP/index.html
cp /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/about.html $SNAP/about.html
cp /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html $SNAP/services.html
cp /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/practitioners.html $SNAP/practitioners.html
```

Create `$SNAP/README.md` with rollback instructions.

### P1.2 — Create dictionary skeleton

Create `v3/assets/js/i18n/dict.js`:

```js
/**
 * v3/assets/js/i18n/dict.js
 *
 * Single source of truth for all UI text on v3 marketing pages.
 *
 * Structure:
 *   HM_DICT[<page>][<section>][<key>] = { en: '...', zh: '...' }
 *
 * Usage from HTML:
 *   <span data-i18n="home.hero.title"></span>
 *
 * The runtime loader (i18n.js) walks the DOM and replaces innerText
 * based on the current <html lang> attribute.
 *
 * Chinese standard: TRADITIONAL (e.g., 漢方, 體質, 視診)
 * — matches HansMed logo and Malaysia/Singapore/Taiwan/HK Chinese norms.
 */
window.HM_DICT = {
  // === SHARED across all pages (nav, footer, common buttons) ===
  shared: {
    nav: {
      home:        { en: 'Home',         zh: '首頁' },
      about:       { en: 'About',        zh: '關於' },
      services:    { en: 'Services',     zh: '服務' },
      shop:        { en: 'Shop',         zh: '商店' },
      ai_wellness: { en: 'AI Wellness',  zh: 'AI 健康評估' },
      sign_in:     { en: 'Sign In',      zh: '登入' },
      my_portal:   { en: 'My Portal',    zh: '我的入口' },
      book:        { en: 'Book',         zh: '預約' },
      // … add ALL nav items here
    },
    dropdown: {
      about_hansmed: { en: 'About HansMed',     zh: '關於我們' },
      practitioners: { en: 'Our Practitioners', zh: '醫師' },
      our_services:  { en: 'Our Services',      zh: '服務' },
      blog:          { en: 'Blog',              zh: '部落格' },
      faq:           { en: 'FAQ',               zh: '常見問題' },
      contact:       { en: 'Contact Us',        zh: '聯絡' },
    },
    footer: {
      // FIX from audit: certification labels were orphan text
      kkm_top:           { en: 'KKM',          zh: 'KKM' },           // proper noun, both same
      kkm_bot:           { en: 'Malaysia',     zh: '馬來西亞' },
      halal_top:         { en: 'HALAL',        zh: 'HALAL' },
      halal_bot:         { en: 'JAKIM',        zh: 'JAKIM' },
      npra_top:          { en: 'NPRA',         zh: 'NPRA' },
      npra_bot:          { en: 'Approved',     zh: '已認證' },
      moh_top:           { en: 'MOH',          zh: '衛生部' },
      moh_bot:           { en: 'Registered TCM', zh: '註冊中醫' },
      tcm_act_top:       { en: 'T&CM Act',     zh: 'T&CM 法令' },
      tcm_act_bot:       { en: '2016',         zh: '2016' },
      compliance_label:  { en: 'Compliance · 合規', zh: 'Compliance · 合規' },
      // ... etc
    },
    bottom_bar: {
      whatsapp: { en: 'WhatsApp',           zh: 'WhatsApp' },
      book_cta: { en: '📅 Book',            zh: '📅 預約' },
    },
    a11y: {
      // Accessibility labels — keep English for screen readers per WCAG
      menu:    { en: 'Menu',                  zh: '選單' },
      skip:    { en: 'Skip to main content',  zh: '跳到主要內容' },
    },
  },

  // === HOME PAGE (v3/index.html) ===
  home: {
    hero: {
      eyebrow:  { en: 'Modern Traditional Chinese Medicine', zh: '現代中醫' },
      title:    { en: '...',  zh: '...' },   // fill from current index.html line ~180
      subtitle: { en: '...',  zh: '...' },
      cta_primary:   { en: 'Book a Consultation',  zh: '預約問診' },
      cta_secondary: { en: 'Learn More',           zh: '了解更多' },
    },
    steps: {
      // FIX from audit: these were orphan text in the original
      step1_label:    { en: 'AI Wellness Assessment',     zh: 'AI 體質評估' },
      step1_desc:     { en: 'Tongue photo + 10-question quiz reviewed by a licensed practitioner.', zh: '舌頭照片 + 10 題問卷，由持牌中醫師審核。' },
      step2_label:    { en: 'Online Consultation',         zh: '線上問診' },
      step2_desc:     { en: 'Licensed TCM doctor sees you by video.', zh: '持牌中醫師視訊問診。' },
      step3_label:    { en: 'Delivery / Home Visit',       zh: '配送 / 上門' },
      step3_desc:     { en: 'Herbs delivered to your door, or a home visit.', zh: '藥材送上門，或上門服務。' },
      cta_italic:     { en: 'Three simple steps to feel better — the modern way.', zh: '三步驟調理身體 —— 現代的方式。' },
      cta_button:     { en: 'START NOW',                   zh: '立即開始' },
    },
    quote: {
      attribution: { en: 'HansMed · PDPA Compliant · T&CM Act 2016 · MOH Registered', zh: 'HansMed · 符合 PDPA · T&CM 法令 2016 · 衛生部註冊' },
      cta:         { en: 'About our approach →',           zh: '我們的理念 →' },
    },
    compliance: {
      eyebrow: { en: '認證與監管 · Certified & Regulated', zh: '認證與監管 · Certified & Regulated' },
      heading: { en: 'Practising with full regulatory compliance', zh: '完全符合法規的執業' },
    },
    // ZH-only paragraphs from audit (lines 1321, 1338) — add English equivalents:
    extra: {
      practitioners_summary: { en: 'Licensed TCM practitioners · Video or in-clinic consultation', zh: '持牌中醫師 · 視診或親診' },
      quality_summary:       { en: 'Quality verified · Pharmacist-reviewed prescriptions', zh: '品質驗證 · 藥師審核' },
    },
    // Continue for every section — full mapping needed.
  },

  // === ABOUT PAGE (v3/about.html) ===
  about: {
    hero:     { /* fill from current about.html */ },
    mission:  { /* ... */ },
    values:   { /* ... */ },
    team:     { /* ... */ },
    cta:      { /* ... */ },
  },

  // === SERVICES PAGE (v3/services.html) ===
  services: {
    // NOTE: this page was just updated by Brief #13 (RM 35 / RM 55 pricing,
    // remove in-person mentions). Use the POST-#13 content as the source.
    hero:           { /* fill */ },
    compare_table:  { /* fill */ },
    consultation:   { /* fill */ },
    herb_shop:      { /* fill */ },
    cross_faq:      { /* fill */ },
    cta:            { /* fill */ },
  },

  // === PRACTITIONERS PAGE (v3/practitioners.html) ===
  practitioners: {
    hero:        { /* fill */ },
    intro:       { /* fill */ },
    list:        { /* fill */ },
    licensing:   { /* fill */ },
    cta:         { /* fill */ },
  },
};
```

**Critical:** the dict above is a SKELETON showing the structure. Phase 2 onwards fills it in by walking each page section and extracting every text pair. Do NOT auto-generate keys via heuristics — name them semantically (`home.hero.title`, not `home.line_180`).

### P1.3 — Create the runtime loader

Create `v3/assets/js/i18n/i18n.js`:

```js
/**
 * v3/assets/js/i18n/i18n.js
 *
 * Runtime i18n loader. Walks the DOM looking for [data-i18n] elements,
 * replaces their innerText with the value from HM_DICT for the current
 * <html lang>. Re-runs whenever the language switcher fires.
 *
 * Usage in HTML:
 *   <span data-i18n="home.hero.title"></span>
 *
 * Public API:
 *   HM.i18n.apply()           — walk the DOM and apply current lang
 *   HM.i18n.t(key, lang?)     — fetch a single string (utility)
 *   HM.i18n.getLang()         — read current <html lang>
 *
 * Auto-runs on DOMContentLoaded and on lang change events.
 */
(function () {
  'use strict';
  window.HM = window.HM || {};

  function getLang() {
    return document.documentElement.getAttribute('lang') || 'en';
  }

  function lookup(key, lang) {
    if (!window.HM_DICT) return null;
    var parts = String(key || '').split('.');
    var node = window.HM_DICT;
    for (var i = 0; i < parts.length; i++) {
      if (!node || typeof node !== 'object') return null;
      node = node[parts[i]];
    }
    if (!node || typeof node !== 'object') return null;
    return node[lang] != null ? node[lang] : (node.en != null ? node.en : null);
  }

  function apply(root) {
    root = root || document;
    var lang = getLang();
    var nodes = root.querySelectorAll('[data-i18n]');
    var missingKeys = [];
    nodes.forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var val = lookup(key, lang);
      if (val == null) {
        missingKeys.push(key);
        return; // Leave existing text in place; don't blank out the element
      }
      // Use textContent (not innerHTML) to prevent XSS via dict values
      el.textContent = val;
    });
    if (missingKeys.length && window.console && console.warn) {
      console.warn('[HM.i18n] Missing dict keys:', missingKeys.slice(0, 10), missingKeys.length > 10 ? '…+' + (missingKeys.length - 10) + ' more' : '');
    }
  }

  function t(key, lang) {
    return lookup(key, lang || getLang());
  }

  HM.i18n = { apply: apply, t: t, getLang: getLang };

  // Auto-apply on initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { apply(); });
  } else {
    apply();
  }

  // Re-apply when language switcher fires.
  // The existing setLang() function in v3 pages writes localStorage.hm-lang-pref
  // and updates <html lang>. We listen for a custom event 'hm:lang-changed' that
  // the existing lang-switcher.js (or the inline setLang() function) emits.
  window.addEventListener('hm:lang-changed', function () { apply(); });

  // Belt-and-suspenders: also listen for storage events (lang change in another tab)
  window.addEventListener('storage', function (e) {
    if (e.key === 'hm-lang-pref') apply();
  });
})();
```

### P1.4 — Update the existing setLang() to fire a custom event

In each v3 page, find the existing `function setLang(l)` block. Add an event dispatch at the end:

Find:
```js
function setLang(l) {
  try { localStorage.setItem('hm-lang-pref', l); } catch (_) {}
  document.documentElement.setAttribute('lang', l);
  document.querySelectorAll('.lang-btn-v4, .mob-lb').forEach(function (b) {
    b.classList.toggle('act', b.getAttribute('data-lang') === l);
  });
}
```

Add at the end of the function body:
```js
  // Notify i18n loader to re-render
  window.dispatchEvent(new CustomEvent('hm:lang-changed', { detail: { lang: l } }));
```

(Same change in all 4 v3 pages.)

### P1.5 — Wire dict + loader into index.html (head section)

In `v3/index.html` `<head>`, BEFORE the existing inline lang-detection script:

```html
<!-- Brief #18: i18n dictionary + runtime loader.
     Loaded synchronously to prevent FOUC. Dict must precede loader. -->
<script src="assets/js/i18n/dict.js"></script>
<script src="assets/js/i18n/i18n.js"></script>
```

(Note: paths are relative to v3/, so `assets/js/i18n/dict.js` resolves to `v3/assets/js/i18n/dict.js`.)

### P1.6 — Test on ONE element only

Pick a single, low-risk element in `v3/index.html`. Suggestion: the page `<title>` is risky (search-visible); use the Home nav link instead.

Find:
```html
<a class="nl" href="index.html"><span lang="en">Home</span><span lang="zh">首頁</span></a>
```

Replace with:
```html
<a class="nl" href="index.html"><span data-i18n="shared.nav.home"></span></a>
```

Make sure `HM_DICT.shared.nav.home = { en: 'Home', zh: '首頁' }` is in dict.js (it should be from the skeleton above).

### P1.7 — Verification gate (HARD STOP)

Open `v3/index.html` in a browser:
1. Page loads → "Home" text appears in the nav (no FOUC, no blank, no `{{...}}`)
2. Click 中 in the nav → "Home" flips to "首頁" instantly
3. Click EN → flips back
4. Open browser DevTools console → no errors, no missing-key warnings related to `shared.nav.home`
5. Check that ALL OTHER text on the page still works as before (the `<span lang>` pattern still functions for non-migrated text — they coexist)

**If all 5 pass:** commit with message `Brief #18 Phase 1: i18n infrastructure (dict + loader + 1 test element)` and proceed to Phase 2.

**If ANY fail:** STOP. Report the exact failure. Use snapshot to revert. Do not proceed.

---

## PHASE 2 — Migrate index.html (full)

**Goal:** Convert every `<span lang="en">/<span lang="zh">` pair AND every orphan text in index.html to `data-i18n` keys. Standardize all Chinese to TRADITIONAL.

### P2.1 — Build the index.html section of dict.js

Walk `v3/index.html` from top to bottom. For each `<span lang="en">X</span><span lang="zh">Y</span>` pair:
1. Decide a semantic key (e.g., `home.hero.title`, `home.steps.step1_label`)
2. Add `HM_DICT.home.<section>.<key> = { en: 'X', zh: 'Y_TRADITIONAL' }` to dict.js
3. Convert any simplified Chinese in `Y` to traditional using this mapping (incomplete — add as encountered):
   - 体 → 體
   - 视 → 視
   - 师 → 師
   - 验 → 驗
   - 问 → 問
   - 诊 → 診
   - 质 → 質
   - 评 → 評
   - 议 → 議
   - 计 → 計
   - 数 → 數
   - 业 → 業
   - 标 → 標
   - 准 → 準
   - 长 → 長
   - 当 → 當
   - 国 → 國
   - 现 → 現
   - 实 → 實
   - 简 → 簡
   - 写 → 寫
   - 系 → 系  (no change)
   - 统 → 統
   - 时 → 時
   - 间 → 間
   - 经 → 經
   - 验 → 驗
   - (continue case-by-case as encountered)

### P2.2 — Replace markup in index.html

For each pair, replace:
```html
<span lang="en">X</span><span lang="zh">Y</span>
```
with:
```html
<span data-i18n="home.<section>.<key>"></span>
```

For each orphan text identified in audit (e.g., line 1204 `Online Consultation`), find its container and add a `data-i18n` span around it. Add the key to dict.js.

### P2.3 — Index.html-specific orphan fixes

These were identified in the language audit; ALL must be migrated to data-i18n keys:

| Line | Orphan text | Suggested key | EN | ZH (traditional) |
|---|---|---|---|---|
| 1204 | "Online Consultation" | `home.steps.step2_label` | Online Consultation | 線上問診 |
| 1205 | "Licensed TCM doctor sees you by video." | `home.steps.step2_desc` | Licensed TCM doctor sees you by video. | 持牌中醫師視訊問診。 |
| 1230 | "Delivery / Home Visit" | `home.steps.step3_label` | Delivery / Home Visit | 配送 / 上門 |
| 1231 | "Herbs delivered to your door, or a home visit." | `home.steps.step3_desc` | Herbs delivered to your door, or a home visit. | 藥材送上門，或上門服務。 |
| 1237 | "Three simple steps to feel better — the modern way." | `home.steps.cta_italic` | Three simple steps to feel better — the modern way. | 三步驟調理身體 —— 現代的方式。 |
| 1238 | "START NOW" | `home.steps.cta_button` | START NOW | 立即開始 |
| 1253 | "HansMed · PDPA Compliant · T&CM Act 2016 · MOH Registered" | `home.quote.attribution` | (as-is) | HansMed · 符合 PDPA · T&CM 法令 2016 · 衛生部註冊 |
| 1254 | "About our approach →" | `home.quote.cta` | About our approach → | 我們的理念 → |
| 1262 | "Practising with full regulatory compliance" | `home.compliance.heading` | Practising with full regulatory compliance | 完全符合法規的執業 |
| 1321 (ZH-only) | "持牌中医师 · 视诊或亲诊" | `home.extra.practitioners_summary` | Licensed TCM practitioners · Video or in-clinic consultation | 持牌中醫師 · 視診或親診 |
| 1338 (ZH-only) | "品质验证 · 药师审核" | `home.extra.quality_summary` | Quality verified · Pharmacist-reviewed prescriptions | 品質驗證 · 藥師審核 |

### P2.4 — Verify index.html

Open in browser:
1. Default load (EN) → page renders fully in English. No `{{}}`, no blank elements.
2. Click 中 → every previously-bilingual element flips to traditional Chinese.
3. Click EN → flips back to English.
4. DevTools console: no missing-key warnings for index.html. No JS errors.
5. Visually scan the entire page in BOTH languages — confirm no text appears in both languages stacked, no untranslated English in 中 mode, no untranslated Chinese in EN mode.
6. Check the orphans (table above) are now language-switching correctly.
7. Mobile drawer: confirm hamburger menu items also switch languages.

**If all 7 pass:** commit `Brief #18 Phase 2: migrate index.html to i18n + traditional Chinese standardization`. Proceed to Phase 3.

**If ANY fail:** STOP. The snapshot at `$SNAP/index.html` is the rollback. Do not proceed to about.html until this is clean.

---

## PHASE 3 — Migrate about.html

Same process as Phase 2, scoped to `v3/about.html`:
1. Walk file top to bottom, build `HM_DICT.about.*` entries
2. Replace each `<span lang>` pair with `<span data-i18n>`
3. Standardize any simplified Chinese to traditional
4. Fix orphans (footer certification labels mainly — re-use `shared.footer.*` keys created in Phase 1)
5. Verify in browser (5-step check)
6. Commit `Brief #18 Phase 3: migrate about.html`

---

## PHASE 4 — Migrate services.html

**REMINDER:** Brief #13 must have run first. Use the POST-#13 file content as source.

Same process as Phase 2, scoped to `v3/services.html`:
1. Walk file, build `HM_DICT.services.*`
2. Pay special attention to the pricing copy added by Brief #13 (RM 35 / RM 55 launch promo, herb shop "speak to your practitioner", etc.)
3. Replace inline spans with data-i18n
4. Verify
5. Commit `Brief #18 Phase 4: migrate services.html`

---

## PHASE 5 — Migrate practitioners.html

Same as Phase 3 / 4. Verify. Commit `Brief #18 Phase 5: migrate practitioners.html`.

---

## PHASE 6 — Final cleanup + verification

### P6.1 — Repo-wide audit

```bash
# Confirm no orphan text remains in v3 pages (excluding accessibility labels)
cd /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3
grep -P '<(h[1-6]|p|button|a|li|td|th)[^>]*>[A-Za-z0-9 ][^<{]*</' index.html about.html services.html practitioners.html | grep -v "data-i18n" | head -30

# Confirm no inline lang spans remain (they're all migrated)
grep -c 'lang="en"' index.html about.html services.html practitioners.html
grep -c 'lang="zh"' index.html about.html services.html practitioners.html
# Acceptable: a small number for things like decorative brand calligraphy
# wrapped in lang spans (e.g., logo Chinese characters). Should be < 10 per file.

# Confirm dict.js has no missing keys referenced by HTML
grep -roh 'data-i18n="[^"]*"' index.html about.html services.html practitioners.html | sort -u | wc -l
# Compare against keys in dict.js — they should match
```

### P6.2 — Cross-page verification

Open each v3 page in a browser, toggle EN ↔ 中 several times. Confirm:
- All text flips on every page
- No FOUC (text doesn't flash English then change to Chinese, or vice versa)
- No orphan text in either mode
- Mobile drawer + bottom-bar work
- All Chinese is consistent (traditional only)
- Browser console has zero missing-key warnings across all 4 pages

### P6.3 — Lighthouse / performance check

```bash
# Optional: Run a quick PageSpeed check on the deployed pages
# to confirm the 2 extra script loads (dict.js + i18n.js) don't
# regress performance. Both should be < 50KB combined; gzip helps.
```

If gzipped dict + loader > 100KB total, consider splitting dict by page (lazy-load per page). Likely not needed for the current size.

### P6.4 — Update TASKS.md

Mark Brief #18 as complete. Add a follow-up note:
```markdown
- [DONE] Brief #18: v3 i18n dictionary refactor + traditional Chinese standardization [2026-05-XX]
- [PLANNED] Brief #18 follow-up: migrate v2 portal pages to same i18n pattern (do AFTER v3 portal migration in Brief #15+; not urgent)
```

### P6.5 — Final commit

```bash
git add v3/assets/js/i18n/
git add v3/index.html v3/about.html v3/services.html v3/practitioners.html
git add briefs/snapshots/brief-18-i18n-pre-migration/
git add TASKS.md
git commit -m "Brief #18 Phase 6: final cleanup, verification, traditional Chinese standardized across all v3 pages"
git push
```

## ACCEPTANCE CRITERIA

- New files: `v3/assets/js/i18n/dict.js`, `v3/assets/js/i18n/i18n.js`
- All 4 v3 pages use `data-i18n` attributes for every piece of UI text (except a small number of acceptable inline lang spans for decorative brand calligraphy)
- All Chinese throughout v3 pages uses TRADITIONAL characters (no 体/视/师/验/etc. — only 體/視/師/驗/etc.)
- All orphan text identified in the language audit is now data-i18n driven
- The 2 ZH-only paragraphs in index.html now have English equivalents
- Page loads have no FOUC (text appears in correct language immediately, no flash)
- EN/中 toggle works on all 4 pages, all elements
- DevTools console: zero missing-key warnings, zero JS errors
- Snapshot saved at `briefs/snapshots/brief-18-i18n-pre-migration/`
- Each phase committed separately so rollback granularity is per-page if needed

## REPORT BACK (per phase)

For EACH phase, report:
```
=== PHASE N ===
Files modified: [list]
Commit hash: ___________
Verification gate: [PASSED / FAILED]
Manual checks done: [list]
Anything that needs CEO attention: [list]
```

For Phase 6, additional summary:
```
=== FINAL SUMMARY ===
Total dict keys: ___
Total data-i18n attributes across 4 pages: ___
Inline lang spans remaining (acceptable count): ___
Orphan text remaining (should be 0 visible UI text): ___
Lighthouse performance regression vs pre-Brief-18: [acceptable / regression]
Bilingual / EN-only / ZH-only check across all pages: [pass / fail per page]
Browser console clean across all pages: [yes / no]
TASKS.md updated: [yes / no]
```

## ROLLBACK

### Roll back a single phase
- Phase 1 (infrastructure): delete `v3/assets/js/i18n/`, revert the index.html changes from snapshot
- Phase 2 (index.html): `cp $SNAP/index.html v3/index.html`, commit, push
- Phase 3 (about.html): `cp $SNAP/about.html v3/about.html`, commit, push
- Phase 4 (services.html): `cp $SNAP/services.html v3/services.html` — but ALSO reapply Brief #13 manually (since this snapshot is pre-#13 state)
- Phase 5 (practitioners.html): `cp $SNAP/practitioners.html v3/practitioners.html`, commit, push

### Roll back ALL phases
```bash
SNAP=/sessions/lucid-gallant-goldberg/mnt/Hansmed-system/briefs/snapshots/brief-18-i18n-pre-migration
cp $SNAP/index.html        /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/index.html
cp $SNAP/about.html        /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/about.html
cp $SNAP/services.html     /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html
cp $SNAP/practitioners.html /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/practitioners.html
rm -rf /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/assets/js/i18n/
git add -A
git commit -m "Rollback: revert Brief #18 i18n refactor"
git push
```

**WARNING:** Rolling back to the snapshot reverts services.html to PRE-Brief-#13 state. If you've run #13 before this brief and need to keep #13's changes, manually re-apply Brief #13 to services.html after the rollback, or use git revert to undo only Brief #18 commits while keeping #13.

## NOTES

- This brief assumes synchronous loading of dict.js (it's small enough that the network cost is negligible). If dict.js grows >100KB later, switch to per-page lazy loading.
- The runtime walks all `[data-i18n]` elements on language change. For pages with thousands of elements this could be slow; current v3 pages have <300 each, so no perf concern.
- The `data-i18n` attribute uses dot-notation paths. Avoid keys with dots in them (use underscores instead).
- Dictionary editing in the future: edit `v3/assets/js/i18n/dict.js`, deploy. No HTML changes needed for copy updates.
- Future enhancement (out of scope): admin UI for non-technical editing of dict.js. Could integrate with existing admin panel.
- Brand calligraphy "漢方現代中醫" can stay as inline lang spans if it's used as a logo/decorative — these aren't typical "UI text". Document in Phase 6 audit which inline lang spans are intentionally kept.
