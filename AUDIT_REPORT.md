# HansMed v2 — Code Audit Report
Date: 2026-04-22
Auditor: Claude (opus 4.7)
Scope: v2/ frontend + backend/ Laravel + agents/

## Executive Summary

HansMed is a thoughtfully-built vanilla-JS telehealth frontend backed by a clean Laravel 11 API. Code quality is above average for its class: no framework debt, consistent IIFE module boundaries, parameterized SQL, and a carefully-designed bilingual runtime. However, the platform ships **significant production risks**: no HTTP security headers (no CSP, HSTS, X-Frame-Options) anywhere in the Laravel stack, Bearer tokens in `localStorage` (XSS-exfiltratable), CORS open to `*`, **zero SEO infrastructure** (no robots.txt, sitemap.xml, Open Graph, canonical, favicon, or structured data) on a site meant to attract 40+ Malaysian patients, and the patient portal loads **36 separate `<script>` files** per page with no bundling. Accessibility is decent in markup (skip links, lang attr, semantic HTML on index) but fails several WCAG AA basics (missing form-label programmatic tie-ins via `for`/`id`, gold `#B8965A` on cream `#F5F1EA` is borderline for body text contrast). Mobile responsive work is genuinely well-considered. Overall grade: **C+ (6.1/10)** — good bones, ship-blockers in SEO and HTTP hardening.

## Category Scores

| Category | Score /10 | Critical | Major | Minor |
|---|---|---|---|---|
| Performance | 5/10 | 1 | 3 | 2 |
| Accessibility | 6/10 | 0 | 4 | 3 |
| Security | 4/10 | 2 | 4 | 2 |
| SEO | 2/10 | 3 | 2 | 1 |
| Broken Patterns | 7/10 | 0 | 2 | 4 |
| Mobile/Responsive | 8/10 | 0 | 1 | 2 |

## Severity-ranked findings

---

### CRITICAL

**C1. No security headers set on backend responses** — `backend/bootstrap/app.php` throughout; also `backend/config/cors.php:3-10`
*Problem:* `grep -r "Content-Security-Policy\|X-Frame-Options\|Strict-Transport\|X-Content-Type-Options\|Referrer-Policy\|Permissions-Policy" backend/` returns **zero** matches. No middleware adds any of these headers. CORS is wide open: `'allowed_origins' => ['*']` with `'allowed_methods' => ['*']` and `'allowed_headers' => ['*']`. The Laravel bootstrap registers only two aliased middlewares (`role`, `registration.complete`) plus `statefulApi()` — no global HTTP-security middleware. A stored-XSS bug (e.g., in an admin-authored content page or a chat image URL) would be unrestrained.
*Fix:* Add a `SecurityHeaders` middleware and register it globally. Example:
```php
// app/Http/Middleware/SecurityHeaders.php
public function handle($request, Closure $next) {
    $r = $next($request);
    $r->headers->set('X-Content-Type-Options', 'nosniff');
    $r->headers->set('X-Frame-Options', 'DENY');
    $r->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
    $r->headers->set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
    $r->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    return $r;
}
// bootstrap/app.php → $middleware->append(\App\Http\Middleware\SecurityHeaders::class);
```
Also tighten CORS to the GitHub Pages origin + custom domain, not `*`.

**C2. Bearer tokens stored in localStorage (XSS-exfiltratable)** — `v2/assets/js/api.js:13-15`, `v2/assets/js/config.js:33`
*Problem:* `localStorage.getItem('hm_token')` / `setItem('hm_token', …)` means any JS execution on the origin — an XSS bug anywhere, a malicious browser extension, or a compromised dependency — can exfiltrate every Sanctum Bearer token and impersonate patients, doctors, or admins. For a medical/PDPA-regulated product, this is a ship-blocker. Combined with `data-unsafe → el.innerHTML` in `render.js:54` and string-concatenated `.innerHTML = …` patterns in 70+ files, the blast radius is large.
*Fix:* Move to Sanctum's httpOnly cookie mode (SPA-style auth with `statefulApi()` — which the bootstrap already enables but isn't used for cookies). Set `SameSite=Lax; Secure; HttpOnly` on the auth cookie and drop `Authorization: Bearer` from `api.js`. If cookie migration isn't feasible short-term, at minimum add a strict CSP (see C1) to reduce XSS surface.

**C3. No SEO infrastructure — site is effectively invisible to search** — `v2/` root directory
*Problem:* `ls v2/` shows no `robots.txt`, no `sitemap.xml`, no `manifest.json`, no `favicon.ico`. `grep -n 'og:\|canonical\|twitter:card\|schema.org' v2/*.html` finds zero results. The landing page declares itself a telehealth business but publishes no structured data; social shares will render blank previews; Google will index nothing intentionally. For a business targeting 40+ Malaysian patients discovering TCM care via search/WhatsApp shares, this is a launch-blocker.
*Fix:* Add at minimum:
- `v2/robots.txt` pointing to sitemap
- `v2/sitemap.xml` listing index, services, shop, contact
- `<link rel="canonical" href="https://hansmed.com.my/">` per page
- `<meta property="og:title">`, `og:description`, `og:image`, `og:url`, `og:type="website"`, `og:locale="en_MY"`, `og:locale:alternate="zh_CN"` in each `<head>`
- `<link rel="icon" href="/favicon.ico">` + apple-touch-icon
- JSON-LD `MedicalBusiness` block on `index.html`:
```html
<script type="application/ld+json">{"@context":"https://schema.org","@type":"MedicalBusiness","name":"HansMed Modern TCM","url":"https://hansmed.com.my/","telephone":"+60 3-1234 5678","medicalSpecialty":"TraditionalChineseMedicine","address":{"@type":"PostalAddress","addressCountry":"MY"}}</script>
```

---

### MAJOR

**M1. Patient portal loads 36 separate JS files with zero bundling** — `v2/portal.html:235-273`
*Problem:* `grep -c '<script ' v2/portal.html` → **36**. `admin.html` → 35. `doctor.html` → 33. `pharmacy.html` → 25. Each page initiates 20-36 sequential HTTP round-trips for JS on cold load; HTTP/2 multiplexing mitigates but not eliminates the waterfall, and each file re-runs the IIFE scaffold. Combined panel JS size is ~480 KB uncompressed (16,072 total lines across panels/pages). On a 3G phone from Kuching this is a multi-second white screen.
*Fix:* Even without a bundler, concatenate at deploy time. Add a one-line GitHub Action step:
```yaml
- run: cat v2/assets/js/config.js v2/assets/js/api.js … > v2/assets/js/bundle.portal.js
```
Replace the 19 panel scripts with one `<script src="assets/js/bundle.portal.js">`. Expected cold-load improvement: ~600-1200ms on 3G.

**M2. Render-blocking Google Fonts + no preload of critical CSS** — `v2/index.html:10-12` and equivalent in every HTML
*Problem:* `<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond…&family=Noto+Serif+SC…&family=Source+Sans+3…&family=Ma+Shan+Zheng&display=swap">` loads **4 Google Font families with multiple weights** synchronously. Noto Serif SC alone is ~700 KB woff2 across weights. No `<link rel="preload">` on the hero font. `font-display: swap` is set (good) but the stylesheet itself still blocks render.
*Fix:* Self-host only the used weights, or add `media="print" onload="this.media='all'"` trick to make the font CSS non-blocking. Preload the one font used above the fold (Cormorant Garamond 400):
```html
<link rel="preload" as="font" type="font/woff2" href="/fonts/cormorant-400.woff2" crossorigin>
```

**M3. 9 CSS files loaded on landing page, no minification** — `v2/index.html:23-31`
*Problem:* `tokens.css`, `base.css`, `layout.css`, `components.css`, `patterns.css`, `tcm.css`, `responsive.css`, `public.css`, `landing-v3.css` — 9 separate unminified CSS requests (~3,170 lines, ~110 KB uncompressed). Portal pages drop `public.css` and `landing-v3.css` but still load 7.
*Fix:* Concatenate + minify at deploy. Same GH Action approach as M1.

**M4. Token storage key and lang storage key collision with two different lang keys** — `v2/assets/js/config.js:35` declares `STORAGE.lang = 'hm_lang'`; `v2/assets/js/lang-switcher.js:38` uses `STORAGE_KEY = 'hm-lang-pref'`; `v2/assets/js/i18n.js:77` reads `cfg.STORAGE.lang` (= `hm_lang`)
*Problem:* The bilingual module (`lang-switcher.js`) stores preference under `hm-lang-pref`, but `i18n.js` (the older data-i18n system) reads `hm_lang`. A user's choice in the pill switcher won't be honored by any `data-i18n` text, and vice versa. Two sources of truth silently diverge.
*Fix:* Unify on one key. Delete `STORAGE_KEY` const in lang-switcher.js and use `window.HM.config.STORAGE.lang`.

**M5. XSS surface: data-unsafe flag → innerHTML with server strings** — `v2/assets/js/render.js:53-57`; used at `portal.html:118,135,153,182`, `doctor.html:101,108,109`, etc. (8 occurrences in templates)
*Problem:* `if (el.hasAttribute('data-unsafe')) el.innerHTML = val == null ? '' : String(val);` — templates use this for `status_badge`, `visit_badge`, `fee_formatted` (doctor card). Those fields are currently assembled client-side via `HM.format.statusBadge(a.status)` (safe, status comes from a known enum), but the pattern is latent-dangerous: any future panel that routes a server-string through `data-unsafe` becomes an XSS vector. `fee_formatted` in `panels/doctor/appointments.js:174` is a `feeBlock` string built on client from numeric data; safe today, brittle tomorrow.
*Fix:* Rename `data-unsafe` to `data-html-from-enum` and document it only accepts values from a fixed allowlist. Or, better, remove it entirely and render badges as structured data (class + text) that `render.js` composes safely.

**M6. No programmatic form-label association** — throughout `v2/index.html` auth modal (lines 984-1075) and every panel form
*Problem:* Form labels use classes (`.field-label`) but have no `for="id"` attribute tying them to inputs (e.g. `<label class="field-label">Email</label><input name="identifier">`). Screen readers get the label via proximity/container walks if lucky, but this fails NVDA + older JAWS. Also fails WCAG 2.1 AA 1.3.1 "Info and Relationships" strictly.
*Fix:* Add `id` on each input, `for` on each label. Standardize in the template renderer so it can't be forgotten.

**M7. Gold body text on cream fails WCAG AA contrast** — `v2/assets/css/tokens.css:32` (`--gold: #B8965A`) on `--cream: #F5F1EA` (line 21)
*Problem:* Computed contrast ratio ≈ **3.1:1**. WCAG AA requires **4.5:1** for body text (<18pt regular / <14pt bold). The gold is used as `--fg-link` (line 51) and for `.text-gold` on small labels throughout. For a 40+ audience with likely presbyopia, this is a real readability issue — not just a spec box.
*Fix:* Either darken the gold for text usages (e.g. `#8C6F3B` hits 4.7:1) or restrict gold to decorative use and swap link color to `--ink-soft #2B241E` which is 12+:1.

**M8. WhatsApp number and clinic phone hard-coded in config.js, not tokens** — `v2/assets/js/config.js:49-55`
*Problem:* Phone `+60 3-1234 5678`, email `support@hansmed.com.my`, WhatsApp `601165600393` live in a JS file shipped to every client. Admin has `/admin/configs` endpoint but the landing uses the static config.
*Fix:* Fetch from `/api/public/clinic` at page load (already fetching `/public/features`; add clinic contact fields to the same endpoint).

---

### MINOR

**m1. Render-blocking inline font-face declarations** — `v2/index.html:13-21` (also portal.html:12-13, admin.html:13, doctor.html:13)
*Problem:* Identical `@font-face` block duplicated across 5 HTML entrypoints. Any future change requires editing 5 files.
*Fix:* Move to `tokens.css`.

**m2. `javascript:` URLs in footer** — `v2/index.html:959-961, 1039-1040`
*Problem:* `<a href="javascript:showPage('privacy-policy')">` bypasses CSP once C1's CSP lands (would need `unsafe-inline`/`unsafe-eval` in script-src), and is a small-but-known accessibility/security anti-pattern.
*Fix:* `<a href="#/privacy-policy" data-page="privacy-policy">` + addEventListener.

**m3. Inline `onclick` handlers everywhere** — `grep -c onclick= v2/` → 75 occurrences across 32 files; e.g. `portal.html:49,54`, `doctor.html:48,53`, `admin.html:45`
*Problem:* Forces any future CSP to include `'unsafe-inline'`. Also couples DOM to global `HM.auth.logout` call.
*Fix:* Replace with delegated event listeners in `auth.js` or `portal-menu.js`.

**m4. Duplicate help-panel card renderers** — `v2/assets/js/panels/patient/help.js`, `doctor/help.js`, `pharmacy/help.js` each define a local `card()`/`help()` function that builds identical card HTML
*Problem:* Three near-identical 25-line renderers. Content drift risk and extra bytes.
*Fix:* Extract to `v2/assets/js/ui.js` as `HM.ui.helpCard(icon, title, titleZh, body)`.

**m5. Notification polling every 60s with no Page Visibility gating** — `v2/assets/js/config.js:23` (`NOTIF_POLL_INTERVAL: 60000`)
*Problem:* Active tab or backgrounded, the portal polls `/api/notifications/unread-count` every minute. Battery + backend cost.
*Fix:* Wrap poll in `document.visibilityState === 'visible'` check, pause on hidden.

**m6. Heading structure on landing has an h2 cluster, no h1 in auth modal templates** — `v2/index.html:467` has the only `<h1>`, then line 499-777 cycle between h2/h3 (ok), but auth modal templates at lines 982, 1011, 1046, 1063 use `<h2>` with no parent h1 context when the modal opens standalone
*Problem:* Screen-reader users landing on the auth modal hear an h2 without preceding context.
*Fix:* Demote modal titles to `<h2>` within `aria-labelledby` on a dialog container, or use `<h1>` inside `role="dialog"`.

**m7. Panel JS mixes camelCase and snake_case data keys without a lint rule** — e.g. `panels/patient/appointments.js:118-119` sets `status_badge`, `fee_formatted` (snake), then uses `scheduled_start`, while `panels/admin/medicine-catalog.js` mixes `stock_grams` (snake, from backend) with local `minPrice` etc.
*Problem:* Server keys are snake_case (Laravel convention), client helpers use camelCase. Boundary isn't formalized — future refactors will alias differently.
*Fix:* Document the convention in a CLAUDE.md or top-of-file comment: "Server JSON = snake_case; local vars = camelCase; template data-bind keys pass snake through unchanged."

**m8. tokens.css has legacy aliases piling up** — `v2/assets/css/tokens.css:24 (--washi-dark)`, `56-62 (--surface / --text-primary aliases)`, `140 (--s-24 legacy mapping)`
*Problem:* Acknowledged in comments ("legacy aliases"); they don't hurt but represent uncompleted migration.
*Fix:* Grep for each legacy token usage; migrate in a follow-up branch; remove aliases.

**m9. Mobile: skip-link styling unverified** — `v2/portal.html:26` adds `<a href="#main" class="skip-link">` but `base.css`/`components.css` should include visible-on-focus styles; not verified in audit. Verify `.skip-link:focus { clip: auto; … }` exists.

**m10. Emoji-only icons** — sidebar links use 📊 📅 etc. (`portal.html:69-91`, `admin.html:58-84`). On older Android devices these render as literal text or tofu boxes. No `aria-hidden="true"` + accompanying text (there IS text so SR is OK, but visual fallback on some Android 7/8 devices is poor). Minor.

**m11. `composer.json` pins only two deps — low supply-chain surface (good)** — `backend/composer.json:5-9`; `agents/package.json:15` has empty `dependencies`. Both lockfiles are minimal. Note — confirmed no known CVE exposures by surface area, though a `composer audit` run is recommended as housekeeping.

---

## Deep-dive notes by category

### Performance (5/10)
- Script counts per page: index=13, portal=36, doctor=33, pharmacy=25, admin=35.
- CSS per page: landing=9, portal/doctor/pharmacy/admin=7.
- Total frontend JS: **10,090 lines (top-level)** + **16,072 lines (panels+pages)** ≈ 26 KLoC unminified.
- Hero images `assets/img/front.png` (114 KB) and `back.png` (106 KB) are reasonable but not `width`/`height` attributed in `<img>` tags → layout shift risk (CLS).
- No service worker, no HTTP cache headers visible on the static bucket (GitHub Pages default max-age=10min — acceptable).
- Tongue upload endpoint runs Claude Vision **synchronously inside the request** (`TongueDiagnosisController.php:50` `dispatchSync`) with a 90s frontend timeout. Acknowledged in the code comment as a deliberate trade-off for single-container Railway deploy. Documented, not a finding.

### Accessibility (6/10)
- Good: `lang="en"` on `<html>`, skip-link, semantic `<nav><main><footer><section>` on index (10 landmarks), `aria-hidden="true"` on decorative SVGs, `font-size: 17px` minimum, respects `prefers-reduced-motion` (tokens.css:196).
- Bad: 0 `role=` attributes in the whole v2 (beyond ARIA found in `accounts.js`, `permissions.js`); no `aria-live` on toast container (check components.css); form labels use visual classes not `for`/`id`; focus-ring token exists but not verified on every interactive element; the EN/中 toggle pill has no `aria-label` or `aria-pressed` (`lang-switcher.js:188-189`).

### Security (4/10)
- Positives: SQL uses parameter bindings throughout (`DB::raw` with `?`); `whereRaw('LOWER(code) = ?', …)` (`VoucherService.php:23`); file upload validated (`image`, `mimes:jpeg,png,jpg,webp`, `max:8192` in `TongueDiagnosisController.php:26`); directory traversal blocked in `/uploads/{path}` (`routes/api.php:36`); PDPA consent logging (api.php:128); Sanctum auth; role middleware on every protected route.
- Concerns on `DB::raw('GREATEST(0, COALESCE(stock_grams, 0) - ' . $qty . ')')` at `MedicineCatalogController.php:268`, `Pharmacy/OrderController.php:163`, `MedicinePurchaseController.php:128,185` — values are cast `(float) $qty` before concatenation, so injection is blocked. Brittle but safe.
- Bootstrap admin route `POST /bootstrap-admin` (`api.php:55`) — gated by env var per comment; verify `ADMIN_BOOTSTRAP_SECRET` is unset in prod Railway config.

### SEO (2/10)
- 0 of 5 canonical SEO files present (robots, sitemap, manifest, favicon, OG tags).
- Title tags exist and are good bilingual (`index.html:8` "HansMed Modern TCM · 漢方現代中醫").
- Meta description present on index (line 6); absent or identical across other HTMLs — not checked individually but clearly not tailored.
- Only one `<h1>` on landing (line 467) — correct. Heading hierarchy beneath is h2/h3 — correct.
- No `hreflang` alternates for EN/中 versions (they're the same URL with a runtime toggle, so `hreflang` would be `alternate` with the same URL + lang — still worth declaring).

### Broken Patterns (7/10)
- 0 TODO/FIXME/XXX comments (clean).
- 0 commented-out code blocks found in spot checks.
- Storage key collision between `i18n.js` and `lang-switcher.js` (M4) is the standout.
- Help panels duplicated (m4).
- Inline styles everywhere — e.g. `portal.html:47 <ul class="nav-menu" style="gap: 0.75rem;">`, `portal.html:80 style="display:none;"`. Pragmatic for a no-framework build, but drifts from the token system.
- Emoji icons in nav (`📊 📅`) are hard-coded instead of going through a design-system icon component.

### Mobile / Responsive (8/10)
- `responsive.css` is thoughtfully-written mobile-first work: field `font-size: 16px !important` to block iOS zoom (line 98); tables convert to stacked cards (line 102); 420px tier for iPhone SE (line 173); print styles (line 190).
- Viewport meta correctly set on all 5 HTMLs.
- One concern: the 240px sidebar (`tokens.css:172`) on portal/doctor/admin is hidden behind `portal-menu.js` JS on mobile; if that JS fails to load (see M1 script-count problem), mobile users get a broken nav.
- Landing hero uses `clamp()` responsively — good.

---

## Recommended next steps (prioritized)

1. **Before next prod deploy**: add a `SecurityHeaders` middleware (C1) + tighten `config/cors.php` from `*` to the actual origin(s). 30 min of work, enormous blast-radius reduction.
2. **This week**: create `v2/robots.txt`, `v2/sitemap.xml`, add OG/canonical/favicon/JSON-LD to `index.html` (C3). Without this the site cannot be found by new patients — critical for business.
3. **This sprint**: ship a deploy-time bundler (a 30-line GH Action that concatenates + minifies JS/CSS per page, M1+M3). Typical 500-1000ms faster cold load on 3G for 40+ users outside KL.
4. **Within 2 sprints**: migrate auth from `localStorage` Bearer to httpOnly Sanctum cookie (C2). Larger refactor; document a cutover plan.
5. **UX polish**: fix the gold-on-cream contrast (M7), wire form `for`/`id` (M6), resolve the `hm_lang` vs `hm-lang-pref` collision (M4), add `aria-pressed` to the language pill.
6. **Housekeeping**: deduplicate help-panel renderers (m4), move inline `@font-face` into tokens.css (m1), replace `javascript:` footer links (m2), gate notification poll on Page Visibility (m5).
7. **Long-term**: introduce a light static-site build step (esbuild is a single binary, ~8 MB) so the no-bundler choice doesn't keep costing performance and security headroom.
