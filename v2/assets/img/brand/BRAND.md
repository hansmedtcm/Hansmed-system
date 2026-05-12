# HansMed Brand Assets — LOCKED

**Last locked:** 2026-05-12 · **Owner:** HansMed (hansmed.moderntcm@gmail.com)

This folder contains the three locked brand assets for HansMed Modern TCM. They are the visual identity of the business. **Do not edit any file in this folder without explicit owner approval.** This document is the contract.

---

## What is locked

### 1. `logo-mark.svg` — header / cream-surface logo
- 3×3 grid mark, 9 tiles, 7 white tiles with `#1a1612` strokes and dots + 2 dark tiles (positions top-middle and bottom-middle) with white dots
- Used in the desktop and mobile nav across all v2 pages
- ViewBox: `0 0 66 66`. Render at 44–56px in typical contexts

### 2. `logo-mark-dark.svg` — footer / warm-dark-surface logo
- **Same 3×3 structure as `logo-mark.svg`** — visually identical design
- Contrast retuned for the warm-dark footer surface (`#1F1812`):
  - 7 light tiles: warm cream `#FEFCF8` fill, no stroke
  - 2 accent tiles (top-middle, bottom-middle): no fill, `#C9A86B` (muted gold) stroke + matching gold dot
  - Cream-tile dots: `#1a1612`
- Treatment B from the 2026-05-12 contrast review (refined two-weight read)

### 3. `wordmark.svg` — bilingual wordmark
- Layout: English `HansMed · TCM` on top, Simplified Chinese `汉方现代中医` below
- English typeface: **IBM Plex Sans Bold (weight 700)**, letter-spacing `-0.012em`
- Chinese typeface: **IBM Plex Sans SC Bold (weight 700)**, letter-spacing `0.10em`
- Both typefaces loaded as web fonts via Google Fonts (link in `v2/index.html` `<head>`)
- Color (cream surface): English `#1a1612`, Chinese `#5A4115`
- Color (dark surface): English `#FEFCF8`, Chinese `#C9A86B`
- The runtime HTML uses an inline `.hm-wordmark` HTML block (see below); this SVG file is the canonical reference document

---

## Runtime usage in v2/index.html

The wordmark is rendered in HTML via a locked CSS class system, not via an `<img>` reference. This is because SVG `<img>` mode does not load external web fonts; HTML does. The structure:

```html
<!-- LOCKED · HansMed bilingual wordmark · DO NOT EDIT -->
<span class="hm-wordmark" role="img" aria-label="HansMed · TCM · 汉方现代中医">
  <span class="hm-wordmark__en">HansMed · TCM</span>
  <span class="hm-wordmark__zh">汉方现代中医</span>
</span>
<!-- /LOCKED HansMed bilingual wordmark -->
```

Add modifier `hm-wordmark--dark` for the footer / dark-surface variant. Add modifier `hm-wordmark--compact` for tight inline contexts.

Styles live in `v2/assets/css/brand-lockup.css` — also locked.

Logos use plain `<img>` tags pointing to the SVG files in this folder.

---

## What changes require owner approval

Any change to any of the following requires explicit owner approval:

- The three SVG files in this folder
- `v2/assets/css/brand-lockup.css`
- The Google Fonts `<link>` in `v2/index.html` that loads IBM Plex Sans + IBM Plex Sans SC at weight 700
- The HTML blocks marked `<!-- LOCKED · HansMed bilingual wordmark ... -->` and `<!-- LOCKED · footer logo ... -->`
- The HTML block marked `<!-- LOCKED brand-wordmark fonts ... -->` in the `<head>`

If you need to change one of these, send a written request to the owner first and document the reason in this file's change log.

---

## Open follow-ups (not yet locked across the site)

The lock currently covers **`v2/index.html` only**. The following other v2 pages still use the older non-locked wordmark structure and should be migrated to the locked block when those pages are updated for the new design:

- `v2/about.html`
- `v2/services.html`
- `v2/practitioners.html`
- `v2/contact.html`
- `v2/faq.html`
- `v2/article.html`
- `v2/blog.html`
- `v2/security.html`
- `v2/shop.html`
- `v2/pharmacy.html`
- `v2/portal.html`
- `v2/doctor.html`
- `v2/admin.html`
- `v2/privacy-policy.html`
- `v2/404.html`

A separate task should migrate each of these to use the same `<link>` font tags, the `brand-lockup.css` stylesheet, and the `.hm-wordmark` HTML block.

Other text mentions of the brand name in body copy (e.g., emergency notice, copyright line) still use the legacy Traditional Chinese form `漢方現代中醫` and were left unchanged in this lock pass. If brand consistency is desired, those should be converted to Simplified `汉方现代中医` in a separate text-content pass — they are not part of the wordmark lock.

---

## Future upgrade path: true outlined-paths wordmark

The current `wordmark.svg` uses `<text>` elements bound to IBM Plex Sans + IBM Plex Sans SC web fonts. This works in 99% of cases. For a truly font-independent lock (renders identically even when web fonts are blocked or fail to load), the wordmark glyphs can be converted to outlined SVG paths using `fontTools`:

1. Place `IBMPlexSans-Bold.ttf` and `IBMPlexSansSC-Bold.otf` in this folder (or wherever convenient)
2. Run a script that uses `fontTools.pens.svgPathPen.SVGPathPen` to extract glyph paths for the exact characters `HansMed · TCM` and `汉方现代中医`
3. Replace the `<text>` elements in `wordmark.svg` with `<path>` elements
4. Update this BRAND.md to note the upgrade

This is a nice-to-have, not a blocker.

---

## Change log

| Date | Change | By |
|---|---|---|
| 2026-05-12 | Initial lock. logo-mark.svg + logo-mark-dark.svg + wordmark.svg + brand-lockup.css all frozen. Three duplicate logo-mark.svg copies in `.design-pkg/` deleted. Wordmark direction: IBM Plex Sans + IBM Plex Sans SC Bold; footer logo: Treatment B (cream + outlined gold). | HansMed (owner) |
