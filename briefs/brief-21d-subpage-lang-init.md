# Brief #21d — Hotfix: v3 subpage initial language reflection

**Priority:** P1 — pre-launch polish (cosmetic, not functional blocker)
**Estimated effort:** 5-10 min Claude Code
**Depends on:** Brief #21c (shipped — `setLang()` delegates to `HM.langSwitch`)
**Closes:** Brief #21 cluster (after this, moves on to Brief 1A)

---

## Problem

Surfaced by post-#21c audit. When a user with stored language
preference `'zh'` lands **directly** on a v3 subpage URL (e.g. from
a search result for "HansMed about us"):

- The early inline script at the top of every page (line 7) reads
  `localStorage.getItem('hm-lang-pref')` and sets `<html lang="zh">`
  → CSS hides English content, shows Chinese ✓
- `lang-switcher.js` init runs and sets `body.lang-zh` class
  → bilingual text wrappers render Chinese ✓
- BUT — the v3-specific `.lang-btn-v4` (EN/中) and `.mob-lb`
  (mobile EN/中) buttons stay with EN highlighted, because
  nothing called `setLang('zh')` on the subpage to reflect the
  active state on those v4-styled buttons. ✗

Result: page text is in Chinese, but the toggle widget shows EN
as active. Looks broken / confusing. Won't crash anything but
costs trust at first impression.

### Why this doesn't affect index.html

`v3/index.html` has an IIFE at the bottom (lines 1812-1816) that
reads the stored pref and calls `setLang(stored)` on load:

```js
/* Initial reflect — read stored pref */
(function () {
  var stored = (window.HM && HM.langSwitch && HM.langSwitch.get) ? HM.langSwitch.get() : 'en';
  setLang(stored);
})();
```

The 3 subpages don't have this IIFE — they were copy-pasted from
the homepage but this final initialization block was omitted.

---

## Files to modify

1. `E:\Hansmed-system\v3\about.html`
2. `E:\Hansmed-system\v3\services.html`
3. `E:\Hansmed-system\v3\practitioners.html`

---

## Required change (apply to all 3 files)

In each subpage, find the inline `<script>` block that contains the
`setLang(l)` function (just patched in Brief #21c). It also contains
the `LANDING_ROUTES`, `go()`, and `window.go = go` block from
Brief #21b. Find the closing `</script>` tag of that block.

**Immediately BEFORE** that closing `</script>` (i.e. after the
`window.setLang = setLang` line OR after the last function def in
the block), insert:

```js

/* ── Brief #21d: initial language reflection.
      lang-switcher.js handles body class + DOM walking on init,
      but the v3-specific .lang-btn-v4 and .mob-lb button highlights
      need a call to our local setLang() to reflect the stored
      preference. Without this, a user landing directly on this
      subpage with stored pref=zh sees Chinese content but EN
      button highlighted. Mirrors v3/index.html lines 1812-1816. ── */
(function () {
  var stored = (window.HM && HM.langSwitch && HM.langSwitch.get) ? HM.langSwitch.get() : 'en';
  setLang(stored);
})();
```

Also: the homepage version has `window.setLang = setLang;` exposed.
The subpage versions currently don't expose it (because the
buttons call `setLang()` directly via `onclick`, no `window.` prefix
needed). **Do NOT add `window.setLang = setLang`** — keep scope
local to the subpage to avoid clobbering the homepage's `setLang`
if someone ever loads both pages in iframes / shared windows.

---

## Commit

```
git add v3/about.html v3/services.html v3/practitioners.html
git commit -m "fix(v3): subpage initial language reflection on load

Subpages were missing the IIFE that index.html uses to reflect
stored hm-lang-pref onto the .lang-btn-v4 / .mob-lb button highlight.
Result: user with stored pref=zh landing directly on a subpage saw
Chinese content but EN button highlighted (mismatch).

Adds the same init IIFE to all 3 subpages, scoped local (no
window.setLang assignment, since subpages call setLang() directly
without the window prefix).

Brief: #21d
Closes: Brief #21 cluster (#21 + #21b + #21c + #21d)"
git push origin master
```

---

## Acceptance criteria

After push + ~2 min Pages rebuild, in **fresh incognito**:

1. Open `https://hansmedtcm.com/v3/index.html`. Click 中 button.
   Page renders Chinese. 中 button highlighted, EN unhighlighted.
2. **Without using nav** (i.e. open a new tab and paste URL),
   visit `https://hansmedtcm.com/v3/practitioners.html`.
3. Verify: page renders in Chinese AND 中 button is highlighted
   (was the bug — previously EN would be highlighted).
4. Repeat for `about.html` and `services.html` — same behavior.
5. Click EN button on a subpage. Text swaps to English, EN
   highlights, 中 unhighlights. (Brief #21c regression check.)
6. Reload — page comes back in EN, EN button highlighted.

---

## Verification step

Take screenshots of:
1. `practitioners.html` directly-loaded with stored pref=zh,
   showing Chinese content AND 中 button highlighted
2. Same after clicking EN button (English content, EN highlighted)

Report success or paste screenshots if mismatch persists.

---

## Rollback

```
git revert <commit-sha>
```

3 files, 1 IIFE each — clean rollback.

## Closes Brief #21 cluster

After this ships and verifies, the Brief #21 domain-switch cluster
is complete:
- #21  — domain bind + DNS + SSL ✓
- #21b — subpage `go()` definition ✓
- #21c — subpage `setLang` delegation ✓
- #21d — subpage initial lang reflection ✓ (this brief)

Ready to move on to Brief 1A (R2 tongue uploads).
