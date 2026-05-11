# Brief #21c — Hotfix: v3 subpage setLang must delegate to HM.langSwitch

**Priority:** P0 — soft launch blocker
**Estimated effort:** 10-20 min Claude Code
**Depends on:** Brief #21b (shipped — `go()` now defined; this brief
fixes a *separate* bug in `setLang()`)
**Blocks:** Soft launch — clicking EN button on subpages makes
all bilingual text disappear

---

## Problem

After Brief #21b shipped, console errors are gone and login/book buttons
work. **But clicking the EN button on `v3/about.html`,
`v3/services.html`, or `v3/practitioners.html` causes all bilingual
text — nav links, hero text, body content — to disappear** (verified
incognito on `https://hansmedtcm.com/v3/practitioners.html`).

### Root cause

`v2/assets/js/lang-switcher.js` runs on every v3 subpage (it's still
in the includes list, correctly so — it provides `HM.langSwitch`). On
init it does three things:

1. Adds `body.lang-en` or `body.lang-zh` class (from `localStorage.hm-lang-pref`)
2. Walks the DOM and wraps every `"English · 中文"` text node into
   `<span class="hm-lang-en">English</span><span class="hm-lang-sep"> · </span><span class="hm-lang-zh">中文</span>`
3. Injects this CSS:
   ```css
   body.lang-en .hm-lang-zh, body.lang-en [lang="zh"] { display: none !important; }
   body.lang-zh .hm-lang-en, body.lang-zh [lang="en"] { display: none !important; }
   ```

So **visibility depends on the `body.lang-*` class**, not on the
`<html lang>` attribute alone.

The subpage's inline `setLang()` (lines 589-595 on `about.html`,
similar on others) only updates `<html lang>` and toggles the button
highlight. It does NOT update `body.lang-*` and does NOT re-walk the
DOM. So:

- Initial state: lang-switcher init sets `body.lang-zh` (because user's
  stored pref was 'zh' or default).
- User clicks EN on the v3 subpage.
- Subpage `setLang('en')` flips `<html lang>` to `"en"` but does NOT
  remove `body.lang-zh`.
- CSS `body.lang-zh .hm-lang-en` still hides English text.
- CSS `body.lang-zh [lang="en"]` still hides `<span lang="en">` text.
- Net result: every wrapped bilingual span is hidden because at least
  one matching rule fires. Page renders blank.

### Why the homepage works

`v3/index.html` (line 1796-1810) `setLang()` correctly delegates:

```js
function setLang(l) {
  if (l !== 'en' && l !== 'zh') return;
  if (window.HM && HM.langSwitch && HM.langSwitch.set) {
    HM.langSwitch.set(l);  // ← updates body class + rewalks DOM
  }
  ['len', 'mlen'].forEach(function (id) {
    var el = document.getElementById(id); if (el) el.classList.toggle('act', l === 'en');
  });
  ['lzh', 'mlzh'].forEach(function (id) {
    var el = document.getElementById(id); if (el) el.classList.toggle('act', l === 'zh');
  });
}
```

The fix is simply to mirror this delegation pattern on the 3 subpages.

---

## Files to modify

1. `E:\Hansmed-system\v3\about.html`
2. `E:\Hansmed-system\v3\services.html`
3. `E:\Hansmed-system\v3\practitioners.html`

`v3/index.html` is **NOT** modified — it already does this correctly.

---

## Required change (apply to all 3 files)

In `v3/about.html`, find the existing `setLang(l)` function (around
**lines 589-595** post-Brief-#21b — verify line numbers as the file
may have drifted):

### BEFORE

```js
function setLang(l) {
  try { localStorage.setItem('hm-lang-pref', l); } catch (_) {}
  document.documentElement.setAttribute('lang', l);
  document.querySelectorAll('.lang-btn-v4, .mob-lb').forEach(function (b) {
    b.classList.toggle('act', b.getAttribute('data-lang') === l);
  });
}
```

### AFTER

```js
function setLang(l) {
  if (l !== 'en' && l !== 'zh') return;
  /* Brief #21c: delegate canonical state to HM.langSwitch.set(), which
     (a) writes localStorage hm-lang-pref, (b) sets <html lang>, AND
     (c) updates the body.lang-en / body.lang-zh class that the injected
     bilingual-toggle CSS depends on. Without this delegation, body class
     stays stale and EN/中 swap visually hides EVERYTHING. Mirrors
     v3/index.html's setLang pattern. */
  if (window.HM && HM.langSwitch && HM.langSwitch.set) {
    HM.langSwitch.set(l);
  } else {
    /* Fallback if lang-switcher.js failed to load: at least flip the
       html lang attribute and persist the preference, so the next
       page-load re-init picks it up correctly. */
    try { localStorage.setItem('hm-lang-pref', l); } catch (_) {}
    document.documentElement.setAttribute('lang', l);
  }
  /* Always reflect active state on this page's specific .lang-btn-v4
     and .mob-lb buttons — lang-switcher.js's reflect helper only knows
     about the older .lang-btn class, not v4 styling. */
  document.querySelectorAll('.lang-btn-v4, .mob-lb').forEach(function (b) {
    b.classList.toggle('act', b.getAttribute('data-lang') === l);
  });
}
```

Apply the **identical** replacement to `services.html` and `practitioners.html`.

---

## Why not extract to a shared file?

Same reasoning as Brief #21b. We're 10 days from soft launch and the
proper architectural cleanup is Brief #18 (full v3 i18n refactor + shared
nav). A 3-place inline duplication today is acceptable technical debt
for a hotfix; Brief #18 will collapse it later.

---

## Commit

```
git add v3/about.html v3/services.html v3/practitioners.html
git commit -m "fix(v3): subpage setLang must delegate to HM.langSwitch

The subpage inline setLang() only flipped <html lang> but didn't
update the body.lang-en / body.lang-zh class that lang-switcher.js
injected CSS depends on. Result: clicking EN on about/services/
practitioners with stored pref=zh left body.lang-zh stuck, hiding
ALL bilingual content (en hidden by stale body class, zh hidden by
new html attr).

Fix: delegate to HM.langSwitch.set() like v3/index.html does. Keeps
the .lang-btn-v4/.mob-lb button-highlight reflection logic local
since lang-switcher.js's reflect helper only knows .lang-btn.

Brief: #21c
Refs: #21b (added go()), #18 (proper i18n refactor — deferred)"
git push origin master
```

---

## Acceptance criteria

After push + ~2 min GitHub Pages rebuild, in a **fresh incognito window**
(close existing tabs to avoid cached JS):

1. **First visit `https://hansmedtcm.com/v3/practitioners.html`**.
   Page should render with text visible (EN by default for fresh
   incognito since localStorage is empty).
2. **Click 中 button** (Chinese) → page text swaps to Chinese
   characters. EN button highlight clears, 中 button highlights.
3. **Click EN button** → page text swaps back to English. Chinese
   text hides. EN highlights, 中 unhighlights.
4. **Repeat the 中 ↔ EN cycle** 2-3 times — should toggle smoothly
   each time, no blank states.
5. **Repeat all 4 checks on `services.html` and `about.html`**.
6. **Reload the page after selecting 中** — the page should reload
   already in Chinese (preference persists via localStorage).
7. **Homepage regression** — `v3/index.html` toggle still works
   (untouched file).
8. **Login + Book buttons** still work (Brief #21b regression check).

---

## Verification step (final task)

After commit + push + Pages rebuild, take screenshots in incognito:
1. `practitioners.html` rendering in EN (text visible)
2. Same page after clicking 中 (Chinese text visible)
3. Same page after clicking EN again (English text visible again,
   not blank)

Report success or paste screenshots if any toggle still produces
a blank page.

---

## Rollback

```
git revert <commit-sha>
```

Single commit, 3 files, 1 function each — clean rollback. Returns
to current broken state but homepage and v2 portal unaffected.

## Out of scope (still deferred to Brief #18)

- Body content bilingual coverage gaps (some text on subpages may
  not be wrapped at all, since `walkAndWrap` only catches the
  "English · 中文" pattern — pure-English text without a Chinese
  twin stays English in both modes)
- Removing the `lang-switcher.js` dependency in favor of a v3-native
  solution
- Shared v3 nav component

## Compliance + risk notes

- ✅ No personal data, no backend, no new deps
- ✅ Pure delegation change — uses existing HM.langSwitch API
- ⚠️ The fallback branch (`if (! window.HM …)`) only fires if
  lang-switcher.js failed to load. In that case, the body class
  won't update either, so toggle still won't work visually — but
  at least the localStorage write means a refresh will pick up the
  preference correctly. Acceptable degradation.
