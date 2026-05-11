# Brief #21 — Custom Domain: hansmedtcm.com

**Priority:** P1 — pre-launch infrastructure
**Estimated effort:** 30-60 min Claude Code + 10-15 min user manual steps
**Depends on:** User has registered hansmedtcm.com on Cloudflare Registrar
**Blocks:** Soft launch (need branded URL before going public)

---

## Goal

Make `hansmedtcm.com` the primary URL for the HansMed Modern TCM website, with
`https://` enabled, `www.hansmedtcm.com` redirecting to apex, and all SEO
metadata pointing to the new canonical domain.

Current state: site is served from `https://hansmedtcm.github.io/Hansmed-system/`.
Target state: `https://hansmedtcm.com/` serves the same content.

## Stack

- **Domain registrar:** Cloudflare Registrar
- **DNS:** Cloudflare (nameservers automatic when registered there)
- **Hosting:** GitHub Pages (repo `hansmedtcm/Hansmed-system`, branch `master`)
- **CDN/SSL:** Cloudflare (orange-cloud proxied)

## Repo facts (read these before editing)

- Repo root has `index.html` that meta-refreshes to `v3/index.html`
- `v3/` is the live marketing site (4 pages: index, about, services, practitioners)
- `v2/` is the patient/doctor portal (still live, still used)
- v3 pages contain `<meta property="og:url">`, `<meta property="og:image">`,
  `<meta name="twitter:image">` tags hardcoded to `hansmedtcm.github.io`.
  All need to be updated to `hansmedtcm.com`.

## Phases

This brief runs in 3 phases. **DO NOT proceed past a phase until its
verification step passes.**

---

### Phase 1 — Repo changes (Claude Code does this)

#### 1.1 Create `CNAME` file at repo root

File: `E:\Hansmed-system\CNAME`

Content (single line, no trailing newline if your editor allows):
```
hansmedtcm.com
```

This file tells GitHub Pages which custom domain to bind. **Do not put
the protocol or trailing slash — GitHub is strict about format.**

#### 1.2 Update OG/Twitter meta tags in v3 pages

Files to update:
- `v3/index.html`
- `v3/about.html`
- `v3/services.html`
- `v3/practitioners.html`

For each file, find and replace:

```
https://hansmedtcm.github.io/Hansmed-system/v3/
```
with:
```
https://hansmedtcm.com/v3/
```

Specifically affects three lines per file:
- `<meta property="og:url" content="...">`
- `<meta property="og:image" content="...">`
- `<meta name="twitter:image" content="...">`

#### 1.3 Update backend CORS config

File: `backend/config/cors.php`

Find:
```php
$allowed = array_values(array_filter([
    'https://hansmedtcm.github.io',
    $frontend,
```

Change to:
```php
$allowed = array_values(array_filter([
    'https://hansmedtcm.com',
    'https://www.hansmedtcm.com',
    'https://hansmedtcm.github.io', // keep as fallback during transition
    $frontend,
```

Keeping the github.io entry during transition lets the old URL still
work in case anyone has it bookmarked. We can remove it after 2-4 weeks
of stable hansmedtcm.com operation.

#### 1.4 Update SecurityHeaders comments (cosmetic but tidy)

File: `backend/app/Http/Middleware/SecurityHeaders.php`

The two comment references to "github.io" should be updated to mention
hansmedtcm.com as the primary frontend host. Pure documentation change —
no functional impact.

#### 1.5 Commit

```
git add CNAME v3/index.html v3/about.html v3/services.html v3/practitioners.html backend/config/cors.php backend/app/Http/Middleware/SecurityHeaders.php
git commit -m "feat(domain): switch primary hostname to hansmedtcm.com

- Add CNAME file for GitHub Pages custom domain binding
- Update OG/Twitter URLs from github.io to hansmedtcm.com on all v3 pages
- Add hansmedtcm.com (apex + www) to backend CORS allowlist
  (keep github.io as transition fallback)
- Update SecurityHeaders comment references

Brief: #21"
git push origin master
```

#### 1.6 Phase 1 verification

After push, GitHub Actions / Pages build will pick up the new CNAME
file. Browse to `https://hansmedtcm.github.io/Hansmed-system/CNAME` and
confirm it shows `hansmedtcm.com` (one line). If it shows the file content,
GitHub recognized it.

**STOP HERE.** Notify user to proceed with Phase 2.

---

### Phase 2 — Cloudflare DNS + GitHub Pages binding (USER does this manually)

⚠️ Claude Code cannot do this — it requires UI clicks in the Cloudflare
and GitHub dashboards. Hand off to user with this checklist.

#### 2.1 Cloudflare DNS records

Go to: https://dash.cloudflare.com → hansmedtcm.com → DNS → Records

Add these records (delete any conflicting ones first):

| Type  | Name | Content                  | Proxy   | TTL  |
|-------|------|--------------------------|---------|------|
| A     | @    | 185.199.108.153          | Proxied | Auto |
| A     | @    | 185.199.109.153          | Proxied | Auto |
| A     | @    | 185.199.110.153          | Proxied | Auto |
| A     | @    | 185.199.111.153          | Proxied | Auto |
| CNAME | www  | hansmedtcm.github.io     | Proxied | Auto |

These four IPs are GitHub Pages' apex-domain endpoints. The CNAME for
www points to your GitHub Pages site directly.

#### 2.2 Cloudflare SSL/TLS settings

Go to: SSL/TLS → Overview

- Set **encryption mode** to **Full** (NOT "Full (Strict)" — GitHub
  Pages's edge cert may not validate cleanly under Strict during the
  initial cutover. Move to Full Strict after a week of stable operation.)

Go to: SSL/TLS → Edge Certificates

- Enable **Always Use HTTPS** ✅
- Enable **Automatic HTTPS Rewrites** ✅
- Enable **Minimum TLS Version: TLS 1.2** (or 1.3 if your audience is
  modern browsers — 1.2 is safer for compatibility)

#### 2.3 Cloudflare Page Rules (apex → www OR www → apex)

Decide direction. **Recommended: apex (hansmedtcm.com) is canonical, www
redirects to apex.** Reason: shorter, cleaner, modern web convention.

Go to: Rules → Page Rules → Create Page Rule

- URL: `www.hansmedtcm.com/*`
- Setting: **Forwarding URL** → 301 Permanent Redirect → `https://hansmedtcm.com/$1`

#### 2.4 GitHub Pages binding

Go to: https://github.com/hansmedtcm/Hansmed-system → Settings → Pages

- **Custom domain:** type `hansmedtcm.com` → Save
- Wait for the green checkmark "Your site is published at https://hansmedtcm.com"
  (can take up to 10 min)
- **Enforce HTTPS:** check the box once it becomes available (greyed out
  until GitHub provisions the cert — usually 5-15 min)

#### 2.5 Phase 2 verification

In a private/incognito window:
- `https://hansmedtcm.com` → should load v3 homepage (after the redirect)
- `https://hansmedtcm.com/v3/about.html` → about page loads
- `https://hansmedtcm.com/v2/index.html` → v2 still accessible (backup)
- `https://www.hansmedtcm.com` → should 301 to `https://hansmedtcm.com`
- DNS check: https://www.whatsmydns.net/#A/hansmedtcm.com → propagation
  spreading globally (can take 5-60 min)

If any test fails: check DNS propagation (still in progress?), GitHub
Pages binding (green checkmark?), Cloudflare proxy enabled (orange cloud)?

**STOP HERE.** Confirm Phase 2 success before Phase 3.

---

### Phase 3 — Smoke test + finalization

#### 3.1 Cross-browser smoke test

Open `https://hansmedtcm.com` in:
- Chrome (desktop)
- Safari (desktop or iPhone)
- Firefox

For each, verify:
- ✅ Page loads, no certificate warning
- ✅ Padlock icon shows valid HTTPS
- ✅ All v3 pages reachable: /, /v3/about.html, /v3/services.html, /v3/practitioners.html
- ✅ v2 portal reachable: /v2/index.html (login screen renders)
- ✅ AI Wellness Assessment page loads (constitution card renders)
- ✅ EN/中 language toggle still works

#### 3.2 Backend API check

The backend (Railway-hosted Laravel app) still uses its existing URL.
After CORS config push, calls from hansmedtcm.com → backend should succeed
without CORS errors.

Open browser console on `https://hansmedtcm.com` and trigger any flow that
makes an API call (login, save assessment, etc.). Watch the Network
tab for any blocked request or CORS error.

If CORS fails: confirm backend was redeployed with the updated
`backend/config/cors.php` (Railway should auto-deploy on push).

#### 3.3 Update README + DEPLOY docs

In a follow-up commit, update:
- `v2/docs/DEPLOY.md` — change live URL references to hansmedtcm.com
- Repo README (if present) — update primary URL

#### 3.4 Update Cloudflare Web Analytics site config

If you've already set up Cloudflare Web Analytics for the github.io URL:
- Go to Analytics & Logs → Web Analytics
- Update the site target to `hansmedtcm.com`
- Snippet stays the same; it picks up the new domain automatically

#### 3.5 Submit to Google Search Console (post-launch follow-up)

After domain is live and stable for ~24 hours:
- Go to https://search.google.com/search-console
- Add property: `https://hansmedtcm.com` (Domain property type for full
  coverage — verifies via Cloudflare DNS TXT record)
- Submit a sitemap.xml when one exists (no sitemap currently — flag as
  follow-up Brief)

---

## Acceptance criteria

After all 3 phases:

1. `https://hansmedtcm.com` loads the v3 homepage with valid HTTPS
2. `https://www.hansmedtcm.com` 301-redirects to `https://hansmedtcm.com`
3. All v3 marketing pages reachable on the new domain
4. v2 portal still works (backup access path preserved)
5. Backend API calls succeed (CORS allows hansmedtcm.com)
6. OG previews on Facebook/Twitter share render correctly with new URLs
   (test with https://www.opengraph.xyz/url/https%3A%2F%2Fhansmedtcm.com)
7. No mixed content warnings in browser DevTools

## Rollback

If anything goes wrong after Phase 2:

1. Cloudflare DNS → set hansmedtcm.com A records to "DNS only" (grey
   cloud) — bypasses the proxy without changing DNS targets
2. GitHub Pages → Settings → Pages → remove the custom domain
3. The site still serves at `https://hansmedtcm.github.io/Hansmed-system/`
4. Optional: `git revert <commit-sha>` of the Phase 1 commit

Rollback is FAST (5-10 min) and SAFE — the github.io URL never goes
away, so traffic still has a valid path.

## Compliance + risk notes

- ✅ No personal data involved in this change
- ✅ No backend logic changes (only CORS allowlist expansion + cosmetic
  comments)
- ⚠️ DNS propagation can take up to 48 hours globally — most regions
  see new IPs within 5-15 min, but some ISPs cache aggressively. Plan
  launch comms accordingly.
- ⚠️ Cloudflare's "Full" SSL mode (vs "Full Strict") accepts any cert
  including invalid ones. This is fine for the initial cutover but
  upgrade to "Full Strict" within 1-2 weeks for proper end-to-end TLS.

## Follow-up briefs (NOT in this brief — note for later)

- `Brief #22` — Email routing setup (hello@hansmedtcm.com via Cloudflare
  Email Routing, free)
- `Brief #23` — sitemap.xml + robots.txt + Google Search Console
- `Brief #24` — Move Cloudflare SSL to "Full Strict" mode
- `Brief #25` — Remove `https://hansmedtcm.github.io` from CORS allowlist
  after 2-4 weeks of stable hansmedtcm.com operation
