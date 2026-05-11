# Brief #12 — v3 cutover: make v3 the live site, v2 the backup, add analytics + rollback

**Classification: INFRA + DESIGN/CONTENT — scope: NEW root redirect + remove preview banner from all 4 v3 pages + add analytics + rollback documentation. v2/ stays untouched (intentional fallback).**

## Background

CEO has decided v3 is good enough to be the new primary site. The plan:
- v3 (currently preview) becomes the live experience for new visitors
- v2 (currently live) stays at `/v2/` URLs as a backup in case v3 has issues
- Open-ended testing period begins now
- Test goals: visual feedback, clarity, conversion funnel, and technical QA — all of the above
- Testers: a mix of CEO + business advisor + friends/family + maybe public

This brief flips the switch.

## TASK A — Remove preview banner from all 4 v3 pages

The gold sticky "Preview version" banner exists on:
- `v3/index.html`
- `v3/about.html`
- `v3/services.html`
- `v3/practitioners.html`

Each starts with a block like:
```html
<div id="preview-banner" style="...">
  <span lang="en">⚠️ Preview version — this is a draft of the new homepage. </span>
  <span lang="zh">⚠️ 预览版 — 这是新版首页的草稿。</span>
  <a href="../v2/index.html" style="...">View current live homepage →</a>
</div>
```

Remove the entire `#preview-banner` div from all four pages. Replace it with a small HTML comment marker so we know where it WAS (in case we want to re-add for a future preview):

```html
<!-- (Preview banner removed 2026-05-03 at v3 cutover. v3 is now
     the live site; v2 stays at /v2/ as backup. To re-enable a
     preview banner here for a future redesign, restore the
     #preview-banner block from git history.) -->
```

Same change applied identically to all 4 pages.

## TASK B — Add a root redirect: `/` → `/v3/index.html`

Currently the GitHub Pages root URL `https://hansmedtcm.github.io/Hansmed-system/` either 404s or shows whatever is at the repo root. We need it to land visitors on v3.

First, **check what currently exists** at the repo root. Run `ls /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/ | grep -E '(index|README|html)$'` and look at what's there. If there's already an `index.html` or other HTML at root, do NOT overwrite without checking — back it up to a git-friendly name first.

Then create or update `/index.html` (at the repo root, NOT inside v2/ or v3/) with this content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- v3 cutover 2026-05-03: this file makes the bare repo URL
     redirect to the v3 homepage. v2 stays accessible at /v2/ as
     backup. To rollback, change "v3/index.html" below to
     "v2/index.html" and re-deploy. -->
<meta http-equiv="refresh" content="0; url=v3/index.html">
<title>HansMed Modern TCM · 漢方現代中醫</title>
<link rel="canonical" href="v3/index.html">
<style>
  body { font-family: 'DM Sans', sans-serif; padding: 40px 20px; text-align: center; color: #2C2620; background: #F5F1EA; }
  a { color: #B5881A; }
</style>
</head>
<body>
<p>Redirecting to HansMed Modern TCM…</p>
<p>If you are not redirected automatically, <a href="v3/index.html">click here</a>.</p>
<p style="margin-top: 32px; font-size: 12px; color: #6B645C;">
  Looking for the previous version?
  <a href="v2/index.html">View v2 site →</a>
</p>
<script>
  // JS fallback — fires before the meta-refresh in modern browsers.
  location.replace('v3/index.html');
</script>
</body>
</html>
```

Three layers of redirect (meta-refresh + JS replace + visible link) so it works in every browser including JS-disabled.

## TASK C — Add Cloudflare Web Analytics to all 4 v3 pages

Cloudflare Web Analytics is free, privacy-friendly (no cookies, no personal data tracking, PDPA-compatible), and gives you page views, unique visitors, top pages, top referrers, browsers, countries. Sufficient for the test phase.

**CEO has already set this up. Token is provided below — embed directly, no placeholder needed.**

Add this exact snippet to all 4 v3 pages (`v3/index.html`, `v3/about.html`, `v3/services.html`, `v3/practitioners.html`) at the BOTTOM of the `<body>`, just before the closing `</body>` tag:

```html
<!-- Cloudflare Web Analytics -->
<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "b22decee5e7940658a78263e5e8b9fb6"}'></script>
<!-- End Cloudflare Web Analytics -->
```

Same snippet, same token, all four pages — paste it identically.

After deploy, analytics will start collecting on the next page load. CEO will see data in the Cloudflare Web Analytics dashboard within 5-10 minutes of first real visit.

## TASK D — Document the rollback plan

Create a NEW file at the repo root: `ROLLBACK.md`

Content:

```markdown
# v3 → v2 Rollback Plan

## When to use this

If v3 (the new live site) breaks in a way that's hurting real visitors,
follow these steps to revert to v2 in under 5 minutes.

## Symptoms that warrant rollback

- Homepage doesn't load at all
- Booking flow breaks for a meaningful number of users
- A critical bug surfaces that can't be hot-fixed within 30 minutes
- Performance degrades severely

## Rollback steps (5 minutes total)

1. Open `index.html` at the repo root.
2. Find this line:
   ```html
   <meta http-equiv="refresh" content="0; url=v3/index.html">
   ```
   Change `v3/index.html` to `v2/index.html`.
3. Find this line:
   ```js
   location.replace('v3/index.html');
   ```
   Change `v3/index.html` to `v2/index.html`.
4. Commit and push:
   ```
   git add index.html
   git commit -m "Rollback: redirect root to v2 instead of v3"
   git push
   ```
5. GitHub Pages rebuilds in 30-60 seconds. Root URL now lands on v2.
6. Tell anyone testing v3 that v3 is temporarily off; they can still
   visit v3 directly at /v3/index.html if needed.

## Re-enabling v3 after fix

Reverse the same steps — change `v2/index.html` back to `v3/index.html`,
commit, push.

## Notes

- v2 and v3 are both kept on disk. Neither is deleted.
- All v2 URLs (e.g., /v2/about.html) keep working throughout — the
  rollback only changes which version the bare repo URL routes to.
- Bookmark / search-engine-indexed v3 URLs (/v3/index.html etc.) keep
  working; they're not affected by the rollback.
```

## TASK E — Update v3 nav to remove "v3-relative dropdown items" since v3 is now primary

After cutover, when a user is on v3 and clicks a v3 page (about / services / practitioners), the dropdown link `href="about.html"` already works (relative to current v3 page). Same for cross-v3-page links. No change needed there.

For dropdown items pointing to pages that DON'T exist in v3 yet (`dd-blog`, `dd-faq`, `dd-contact`), the existing `href="../v2/blog.html"` etc. still works. Don't change them — they correctly route to the v2 pages that still exist.

So Task E is just verification: confirm that all dropdown links in all 4 v3 pages still resolve correctly. Document any links that need updating.

## TASK F — Update social meta tags on v3 pages

Currently each v3 page has a `<meta name="description">` and a `<title>`. Add Open Graph + Twitter Card meta tags so when v3 URLs are shared on WhatsApp, Facebook, social media, etc., the preview looks correct.

Add to the `<head>` of each v3 page (with page-appropriate text):

```html
<!-- Open Graph (Facebook, WhatsApp, LinkedIn) -->
<meta property="og:type" content="website">
<meta property="og:url" content="https://hansmedtcm.github.io/Hansmed-system/v3/[PAGE].html">
<meta property="og:title" content="[PAGE-SPECIFIC TITLE]">
<meta property="og:description" content="[PAGE-SPECIFIC DESCRIPTION — same as meta description]">
<meta property="og:image" content="https://hansmedtcm.github.io/Hansmed-system/v3/assets/img/hero-bg.webp">
<meta property="og:locale" content="en_US">
<meta property="og:locale:alternate" content="zh_TW">
<meta property="og:site_name" content="HansMed Modern TCM">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="[PAGE-SPECIFIC TITLE]">
<meta name="twitter:description" content="[PAGE-SPECIFIC DESCRIPTION]">
<meta name="twitter:image" content="https://hansmedtcm.github.io/Hansmed-system/v3/assets/img/hero-bg.webp">
```

For each page:
- index: title "HansMed Modern TCM · 漢方現代中醫"; description from existing meta
- about: title "About HansMed · Where Tradition Meets Modern Care"; description from existing meta
- services: title "Our Services · TCM consultations, AI Wellness, Herb Shop"; description from existing meta
- practitioners: title "Our Practitioners · Licensed by Malaysia's T&CM Council"; description from existing meta

Keep the og:image as `hero-bg.webp` for now; later we can generate a custom OG-card image per page (1200x630).

## ACCEPTANCE CRITERIA

- Preview banner removed from all 4 v3 pages (index, about, services, practitioners). Replaced with the HTML comment marker.
- New `/index.html` at repo root redirects to v3/index.html via meta-refresh + JS + visible link.
- `/index.html` also includes a small footer link "View v2 site →" so visitors can manually access the backup.
- Cloudflare Web Analytics script added to all 4 v3 pages (or placeholder comment if CEO hasn't provided token yet — flag this in report).
- New `ROLLBACK.md` at repo root documents the 5-minute revert procedure.
- All existing v3 dropdown links verified working (no change needed but confirm in report).
- Open Graph + Twitter Card meta tags added to all 4 v3 pages with page-appropriate text.
- v2 untouched — no v2 file modified.
- All v2 URLs (e.g., /v2/index.html, /v2/about.html, /v2/portal.html) still work.
- After deploy, `https://hansmedtcm.github.io/Hansmed-system/` (bare URL) redirects to v3/index.html.

## REPORT BACK

```
Files modified: [list]
Files created: index.html, ROLLBACK.md
Pushed to: [commit hash]
Preview banner removed from all 4 v3 pages: [yes/no]
Root index.html redirect created: [yes/no]
ROLLBACK.md created with 5-minute revert procedure: [yes/no]
Cloudflare Web Analytics: [added with token / placeholder pending CEO]
Open Graph + Twitter Card meta on all 4 v3 pages: [yes/no]
v2 files modified: [should be 'none']
After deploy, bare URL hansmedtcm.github.io/Hansmed-system/ lands on v3 home: [confirm by visiting after deploy]
Anything you noticed that needs CEO attention: [list]
```

If during implementation you find that a file already exists at the repo root that conflicts (e.g., an existing `index.html`), back it up to `index-pre-cutover-backup.html` before overwriting — don't lose it.
