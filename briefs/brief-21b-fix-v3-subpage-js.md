# Brief #21b — Hotfix: v3 subpage broken JS (login + booking + lang toggle)

**Priority:** P0 — soft launch blocker
**Estimated effort:** 25-40 min Claude Code
**Depends on:** Brief #21 (domain switch — done)
**Defers:** Brief #18 full v3 i18n refactor (post-launch)
**Blocks:** Soft launch — every subpage currently has broken Sign-In + Book buttons

---

## Problem

In Brief #21 phase 3 smoke test on `https://hansmedtcm.com/v3/about.html`,
DevTools console shows:

```
landing.js:446  Uncaught TypeError: Cannot read properties of null
                (reading 'addEventListener')
landing.js:54   Cannot read properties of null (reading 'classList')
landing.js:55   Cannot read properties of null (reading 'classList')
landing.js:66   Cannot read properties of null (reading 'classList')
about.html:124  Uncaught ReferenceError: go is not defined
                  at HTMLButtonElement.onclick (about.html:124)
[…14 more identical "go is not defined" errors as user mouses over nav]
```

### Root cause

Three v3 subpages — `about.html`, `services.html`, `practitioners.html` —
include this script tag:

```html
<script src="../v2/assets/js/pages/landing.js"></script>
```

But `v2/assets/js/pages/landing.js` was written for the **old v2 landing
page DOM**. Specifically, it does (line 446):

```js
document.getElementById('contact-form').addEventListener('submit', ...)
```

The v3 subpages have no `#contact-form` element → `null.addEventListener`
throws → script halts mid-execution → any global functions it would have
defined never get registered.

The earlier classList errors at lines 54/55/66 are the same cause —
`document.getElementById('nav')` returns null on subpages because v3 uses
a different nav structure than v2's landing page.

### Why login is broken

The v3 subpages have inline button handlers:
```html
<button onclick="go('login')">Sign In</button>
<button onclick="go('book')">Book</button>
```

Neither `landing.js` (v2) nor the subpages themselves define a global
`go(id)` function. Only `v3/index.html` defines it inline (lines 1748-1764).
So on subpages, clicking either button throws `ReferenceError: go is not defined`.

### Why language toggle "feels broken"

The `setLang(l)` function IS defined inline on each subpage (lines 589-595)
and DOES toggle the `<html lang="…">` attribute correctly. The visible
"broken" symptom is that the subpage **body content is mostly hardcoded
in one language** — only the nav header and footer wrap text in
`<span lang="en">/<span lang="zh">` pairs. So the toggle works for the
header but the body text doesn't visibly change.

This second issue is the proper fix scope of **Brief #18 (v3 i18n
refactor)**, deferred to post-launch. This brief #21b only fixes the
JavaScript crashes so that:
- Login button works
- Book button works
- Header EN/中 toggle no longer reports console errors (already worked
  silently — now it'll be the only visible text change, matching what
  homepage already ships)

---

## Files to modify

1. `E:\Hansmed-system\v3\about.html`
2. `E:\Hansmed-system\v3\services.html`
3. `E:\Hansmed-system\v3\practitioners.html`

`v3/index.html` is **NOT** modified — it already has all required
inline JS and works correctly.

---

## Required changes (apply to all 3 files)

### Change 1 — Remove the broken script include

In `v3/about.html`, the line is at **line 521**:

```html
<script src="../v2/assets/js/pages/landing.js"></script>
```

In `v3/services.html` and `v3/practitioners.html` find the same line (it
will be near the same position, look for the exact string). **Delete the
entire line.**

Do **NOT** remove the other v2 script includes on the surrounding lines
(`config.js`, `api.js`, `auth.js`, `bus.js`, `format.js`, `empty.js`,
`ui.js`, `form.js`, `render.js`, `router.js`, `i18n.js`,
`lang-switcher.js`, `about-dropdown.js`). Those define `HM.auth`, `HM.api`,
`HM.config`, `HM.langSwitch` etc. that the inline subpage handlers
legitimately depend on.

### Change 2 — Add `go()` and `LANDING_ROUTES` to the inline script

In `v3/about.html`, find the `setLang(l)` function around **line 589-595**.
Immediately AFTER the closing `}` of `setLang` (line 595) but BEFORE the
closing `</script>` (line 596), insert this block:

```js

/* ── Brief #21b: v3 subpage navigation routes.
      Mirrors v3/index.html lines 1748-1764 so onclick="go('login')"
      and onclick="go('book')" buttons work on subpages too.
      Subpage-specific tweaks vs index.html:
        - home  → navigate to index.html (subpages can't scroll-to-top
                  to reach the homepage, they need a real navigation)
        - login/register → navigate to index.html with hash so the
                  homepage's hash handler picks it up. Otherwise the
                  hash would just stick to the current subpage URL
                  and nothing would happen.
      All other routes match index.html exactly. ── */
var LANDING_ROUTES = {
  home:     function () { location.href = 'index.html'; },
  about:    function () { location.href = 'about.html'; },
  services: function () { location.href = 'services.html'; },
  shop:     function () { location.href = '../v2/shop.html'; },
  book:     function () { location.href = '../portal.html#/book'; },
  wellness: function () { location.href = '../portal.html#/wellness-assessment'; },
  register: function () { location.href = 'index.html#/register'; },
  login:    function () { location.href = 'index.html#/login'; },
  contact:  function () { location.href = '../v2/contact.html'; },
};
function go(id) {
  var fn = LANDING_ROUTES[id] || LANDING_ROUTES.home;
  closeMob();
  fn();
}
window.go = go;
```

Apply the **identical** insertion to `services.html` and `practitioners.html`
(both have the same `setLang` function in the same position).

The `closeMob()` call inside `go()` is safe — `closeMob` is already
inline-defined on each subpage (lines 568-574) before `go()` would be
called.

---

## Why inline duplication instead of a shared file?

A cleaner design would extract `LANDING_ROUTES` + `go()` + `setLang()` +
`closeMob()` etc. into a single `v3/assets/js/v3-nav.js` and include it
on all 4 v3 pages.

**We're not doing that in this brief** because:

1. **Risk**: it would also touch `v3/index.html` which currently works.
   Soft-launch is in 10 days; minimizing files changed = minimizing
   regression surface.
2. **Scope**: the proper architectural cleanup (shared nav component +
   shared i18n + body content bilingual coverage) is the entire point of
   Brief #18. Doing a half-measure here just adds work for the eventual
   refactor.
3. **Speed**: this brief is meant to be a 30-min hotfix. Extraction +
   testing on all 4 pages would take 60-90 min.

The accepted technical debt is logged in Brief #18's scope.

---

## Commit

```
git add v3/about.html v3/services.html v3/practitioners.html
git commit -m "fix(v3): remove broken landing.js include + define go() on subpages

About/services/practitioners loaded v2/assets/js/pages/landing.js
which crashed on document.getElementById('contact-form').addEventListener
(no contact-form on these pages), halting the script before global
go() could be defined. Result: every onclick='go(...)' threw
ReferenceError, breaking the Sign In and Book buttons.

This commit:
- Removes the broken landing.js include from all 3 subpages
- Adds inline LANDING_ROUTES + go() definition (copied from index.html
  with subpage-appropriate routing tweaks for home/login/register)
- Leaves Brief #18 (full v3 i18n refactor) as the proper post-launch fix
  for body-content bilingual coverage

Brief: #21b
Refs: #21 (domain switch), #18 (deferred i18n refactor)"
git push origin master
```

---

## Acceptance criteria

After push, GitHub Pages will rebuild in 1-3 min. Then in a **private/
incognito window** at `https://hansmedtcm.com/v3/about.html`:

1. **Console clean of red errors** related to `landing.js` and
   `go is not defined`. (Other warnings/info logs are fine.)
2. **Sign In button** (top-right) navigates to `index.html#/login`
   (you'll see URL change, then login flow trigger on homepage).
3. **Book button** (top-right, dark) navigates to `../portal.html#/book`
   (portal SPA opens to booking screen).
4. **EN/中 header toggle** swaps the active button highlight (中 turns
   highlighted when clicked) AND `<html lang>` attribute changes
   (verify in DevTools Elements panel).
5. **Repeat tests on** `https://hansmedtcm.com/v3/services.html` and
   `https://hansmedtcm.com/v3/practitioners.html` — same 4 checks pass.
6. **Homepage regression check** — `https://hansmedtcm.com/v3/index.html`
   still works (login button, book button, lang toggle, hash routing for
   #/login and #/register all behave as before).

---

## Verification step (final task)

After the change is committed and pushed, take screenshots of:
1. `https://hansmedtcm.com/v3/about.html` with DevTools Console open
   showing NO red errors (other than pre-existing unrelated ones)
2. The browser URL bar after clicking Sign In on the same page
   (should show `index.html#/login`)
3. The browser URL bar after clicking Book on the same page
   (should show `portal.html#/book` or whatever portal route renders)

Report success or paste screenshots if anything still looks wrong.

---

## Rollback

```
git revert <commit-sha>
```

Single commit, 3 files, mechanical change — clean rollback. Subpages
return to current broken state but homepage and v2 portal continue working.

## Out of scope (NOT in this brief)

- Body content bilingual coverage on subpages → **Brief #18**
- Shared nav component extraction (`v3-nav.js`) → **Brief #18**
- Removing other v2 script dependencies from v3 subpages → **Brief #18**
- About-page contact form (currently absent from about.html — was on
  the v2 landing page) → product decision, not a bug

## Compliance + risk notes

- ✅ No personal data involved
- ✅ No backend changes
- ✅ No new dependencies (uses existing inline JS pattern)
- ⚠️ The hash routes (`index.html#/login`) assume the homepage's hash
  handler triggers on cross-page navigation arrival, not just on
  hashchange event. If the login modal doesn't open after navigation,
  that's a separate bug in the homepage's hash listener (use
  `window.addEventListener('hashchange', ...)` AND check
  `location.hash` on `DOMContentLoaded`). Flag for follow-up if seen.
