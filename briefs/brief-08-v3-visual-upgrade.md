# Brief #8 — v3 visual upgrade: imagery + smooth scroll + scroll reveals + parallax + tilt

**Classification: DESIGN / CONTENT — scope: v3/index.html + v3/assets/img/ + new v3/assets/css and v3/assets/js if needed. Do NOT touch v2/.**

## Background

User has generated 10 imagery files for v3 (in `v3/assets/img/`). This brief slots them into the homepage and adds the modest motion layer that addresses the advisor's "too monotonous, all text" critique. Stays within HansMed's "Modern East Asian Lifestyle Medicine" brand register — subtle, warm, trustworthy. NOT Gucci-style spectacle.

Existing assets (PNG format, ~1600px wide):
```
v3/assets/img/hero-bg.png
v3/assets/img/brand-story.png
v3/assets/img/service-wellness.png
v3/assets/img/service-consultation.png
v3/assets/img/service-shop.png
v3/assets/img/step1-discover.png
v3/assets/img/step2-talk.png
v3/assets/img/step3-receive.png
v3/assets/img/practitioner-placeholder.png
v3/assets/img/patient-stories-placeholder.png
```

This brief preserves: existing color tokens (`--v4-*`), typography (Cormorant + Noto Serif SC + DM Sans), brand spine, bilingual `<span lang>` pattern, all section structures, the tongue widget (if Brief #6 has shipped), the organ clock (if Brief #7 has shipped). It only ADDS imagery and motion — does not restructure.

---

## TASK A — Slot the imagery into v3/index.html

For each image, insert it at the section indicated, using `<img>` tags with `loading="lazy"` for everything below the fold and `loading="eager"` only for the hero.

### A1. Hero — `hero-bg.png`

The hero currently has the brand spine block. Add `hero-bg.png` as a background image with a gradient overlay so text remains readable.

```css
.hero-v3 {
  position: relative;
  min-height: 88vh;
  display: flex;
  align-items: center;
  padding: 0 8vw;
  background-image: url('assets/img/hero-bg.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  overflow: hidden;
}
.hero-v3::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to right,
    rgba(245, 241, 234, 0.92) 0%,
    rgba(245, 241, 234, 0.65) 40%,
    rgba(245, 241, 234, 0.20) 75%,
    rgba(245, 241, 234, 0.05) 100%
  );
  pointer-events: none;
  z-index: 1;
}
.hero-v3 > * { position: relative; z-index: 2; }
@media (max-width: 768px) {
  .hero-v3::before {
    background: linear-gradient(to bottom,
      rgba(245, 241, 234, 0.92) 0%,
      rgba(245, 241, 234, 0.55) 100%);
  }
}
```

Apply the `hero-v3` class to the existing hero `<section>`. The brand spine three lines + CTA stack stay on the LEFT half of the hero on desktop; the imagery shows through on the right. On mobile, the gradient covers more of the image so text stays readable.

### A2. Brand story — `brand-story.png`

The brand-story section currently renders as a single column of text. Convert to a 2-column layout on desktop with the image on the left and text on the right; on mobile, image stacks above text.

```html
<div class="brand-story-grid">
  <div class="brand-story-img">
    <img src="assets/img/brand-story.png" alt="Practitioner taking pulse" loading="lazy">
  </div>
  <div class="brand-story-text">
    [ existing eyebrow + heading + 2 paragraphs ]
  </div>
</div>
```

```css
.brand-story-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  align-items: center;
  max-width: 1100px;
  margin: 0 auto;
}
.brand-story-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 16px;
  aspect-ratio: 4 / 5;
  display: block;
}
@media (max-width: 768px) {
  .brand-story-grid { grid-template-columns: 1fr; gap: 32px; }
  .brand-story-img img { aspect-ratio: 4 / 3; }
}
```

### A3. Service cards — `service-wellness.png`, `service-consultation.png`, `service-shop.png`

The current `.card-v4` service cards have an icon emoji + heading + body + CTA. Add the corresponding image at the TOP of each card, replacing or sitting above the emoji icon.

For each `.card-v4`, prepend:

```html
<div class="card-v4-img">
  <img src="assets/img/service-wellness.png" alt="" loading="lazy">
</div>
```

(Use `service-wellness.png` for the AI Wellness card, `service-consultation.png` for Consultations, `service-shop.png` for Herb Shop.)

```css
.card-v4-img {
  margin: -22px -22px 18px;  /* bleed to card edges */
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: 12px 12px 0 0;
}
.card-v4-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.6s ease;
}
.card-v4:hover .card-v4-img img {
  transform: scale(1.04);  /* gentle zoom on hover */
}
```

The decorative `.card-icon` emoji can stay below the image (smaller) or be removed entirely if it now feels redundant. Designer's call — default: keep at smaller size as a subtle accent.

### A4. How it works steps — `step1-discover.png`, `step2-talk.png`, `step3-receive.png`

Each step card currently has icon + label + description. Add the corresponding image at top of each step:

```html
<div class="step-card">
  <div class="step-card-img">
    <img src="assets/img/step1-discover.png" alt="" loading="lazy">
  </div>
  [ existing step number + title + description ]
</div>
```

```css
.step-card-img {
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 12px;
  margin-bottom: 20px;
}
.step-card-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
```

### A5. Practitioner placeholder — `practitioner-placeholder.png`

The placeholder section currently has 3 muted cards saying "Practitioner profile · Coming soon." Use `practitioner-placeholder.png` (the empty TCM clinic interior) as the SAME image inside all 3 placeholder cards. When real practitioner photos arrive later, each card's image swaps independently.

```html
<div class="practitioner-card">
  <div class="practitioner-card-img">
    <img src="assets/img/practitioner-placeholder.png" alt="" loading="lazy">
  </div>
  [ existing "Practitioner profile · 医师介绍" + "Coming soon · 即将推出" content ]
</div>
```

```css
.practitioner-card-img {
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 12px;
  margin-bottom: 16px;
}
.practitioner-card-img img {
  width: 100%; height: 100%; object-fit: cover; display: block;
  filter: grayscale(20%);  /* subtly muted to signal "placeholder" */
  transition: filter 0.4s ease;
}
.practitioner-card:hover .practitioner-card-img img {
  filter: grayscale(0%);
}
```

### A6. Patient stories — `patient-stories-placeholder.png`

The patient stories placeholder is currently a muted text-only block. Convert to a full-width background image with text overlay.

```html
<section class="patient-stories-section">
  <div class="patient-stories-bg" style="background-image:url('assets/img/patient-stories-placeholder.png');"></div>
  <div class="patient-stories-overlay">
    [ existing eyebrow + heading + body paragraph ]
  </div>
</section>
```

```css
.patient-stories-section {
  position: relative;
  min-height: 360px;
  overflow: hidden;
  margin: 64px 0;
}
.patient-stories-bg {
  position: absolute; inset: 0;
  background-size: cover;
  background-position: center;
}
.patient-stories-overlay {
  position: relative;
  background: rgba(245, 241, 234, 0.78);
  backdrop-filter: blur(2px);
  padding: 64px 8vw;
  text-align: center;
}
```

---

## TASK B — Add Lenis smooth scroll

Add Lenis library via CDN at the bottom of `v3/index.html` body:

```html
<script src="https://cdn.jsdelivr.net/npm/lenis@1.0.42/dist/lenis.min.js"></script>
<script>
(function () {
  // Respect users who have prefers-reduced-motion enabled — no smooth
  // scroll for them. Accessibility + epileptic-trigger safety.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Skip on touch-only devices where native scrolling is preferred.
  if ('ontouchstart' in window && window.matchMedia('(max-width: 768px)').matches) return;

  var lenis = new Lenis({
    duration: 1.05,
    easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
    smoothWheel: true,
  });
  function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);
})();
</script>
```

---

## TASK C — Add scroll-reveal animations (IntersectionObserver, no library)

Add this CSS once, then apply `.reveal` to any element you want to animate-in on scroll:

```css
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.8s ease, transform 0.8s ease;
  will-change: opacity, transform;
}
.reveal.is-visible {
  opacity: 1;
  transform: translateY(0);
}
@media (prefers-reduced-motion: reduce) {
  .reveal { opacity: 1; transform: none; transition: none; }
}
```

Add the JS observer:

```html
<script>
(function () {
  if (!('IntersectionObserver' in window)) {
    // Fallback: just show everything immediately
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
})();
</script>
```

Apply `.reveal` to:
- Brand story heading + paragraphs
- Each service card (stagger by 100ms each via inline `style="transition-delay: 0.1s"` etc.)
- Each how-it-works step (stagger 100ms, 200ms, 300ms)
- Practitioner section heading + cards
- Patient stories overlay
- The tongue widget section if Brief #6 shipped (apply to the section heading + the tab content blocks)
- The organ clock section if Brief #7 shipped (apply to the intro question + heading + paragraph)

DO NOT apply `.reveal` to the hero — it should be visible immediately.

---

## TASK D — Add hero parallax (subtle)

Add to the existing hero script block:

```html
<script>
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(max-width: 768px)').matches) return; // skip on mobile

  var hero = document.querySelector('.hero-v3');
  if (!hero) return;
  var ticking = false;

  function update() {
    var y = window.scrollY;
    if (y > window.innerHeight) { ticking = false; return; } // only while hero in view
    var offset = y * 0.20;
    hero.style.backgroundPosition = 'center calc(50% + ' + offset + 'px)';
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
})();
</script>
```

---

## TASK E — Card tilt on hover (CSS only, subtle)

Add to `.card-v4` and `.step-card` and `.practitioner-card`:

```css
.card-v4, .step-card, .practitioner-card {
  transform-style: preserve-3d;
  transform: perspective(1000px) rotateX(0) rotateY(0);
  transition: transform 0.5s ease, box-shadow 0.4s ease;
}
.card-v4:hover, .step-card:hover, .practitioner-card:hover {
  transform: perspective(1000px) translateY(-6px) rotateX(1.5deg) rotateY(-1.5deg);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
}
@media (prefers-reduced-motion: reduce) {
  .card-v4:hover, .step-card:hover, .practitioner-card:hover {
    transform: translateY(-6px); /* keep the lift, drop the tilt */
  }
}
```

The tilt is intentionally subtle (1.5deg). Aggressive tilt looks gimmicky.

---

## TASK F — Image fade-in on load

Apply to all `<img>` tags inside content sections (skip the hero bg):

```css
img.fade-in-load {
  opacity: 0;
  transition: opacity 0.8s ease;
}
img.fade-in-load.loaded {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  img.fade-in-load { opacity: 1; transition: none; }
}
```

```html
<script>
document.querySelectorAll('img.fade-in-load').forEach(function (img) {
  if (img.complete) { img.classList.add('loaded'); }
  else { img.addEventListener('load', function () { img.classList.add('loaded'); }); }
});
</script>
```

Add `class="fade-in-load"` to all the new `<img>` tags from Task A.

---

## TASK H — Section divider textures (rice paper + ink wash)

Two new texture assets are now in `v3/assets/img/`:
- `texture-rice-paper.png` — warm cream rice-paper macro
- `texture-ink-wash.png` — single horizontal Chinese ink brushstroke

Use them as quiet section transitions to add visual rhythm without competing with the photography. Apply to the BACKGROUND of major section transitions, not as standalone visible images.

### H1. Rice paper as a subtle background pattern on alternating sections

Apply to alternating text-heavy sections (brand story, how-it-works) so adjacent imagery sections feel separated:

```css
.has-rice-bg {
  position: relative;
}
.has-rice-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('assets/img/texture-rice-paper.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  opacity: 0.08;
  mix-blend-mode: multiply;
  pointer-events: none;
  z-index: 0;
}
.has-rice-bg > * { position: relative; z-index: 1; }
```

Apply `.has-rice-bg` class to:
- Brand story section
- How-it-works section

### H2. Ink wash as a section-divider band between major sections

Insert as a thin horizontal divider band BETWEEN major sections (not inside them). Acts as a visual breath / page punctuation:

```html
<div class="ink-divider" aria-hidden="true">
  <img src="assets/img/texture-ink-wash.png" alt="" loading="lazy">
</div>
```

```css
.ink-divider {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  overflow: hidden;
  pointer-events: none;
}
.ink-divider img {
  max-width: 320px;
  width: 60%;
  height: auto;
  opacity: 0.25;
  filter: grayscale(100%) brightness(0.4);
  display: block;
}
@media (max-width: 768px) {
  .ink-divider { height: 40px; }
  .ink-divider img { max-width: 220px; width: 70%; opacity: 0.20; }
}
```

Place ONE `.ink-divider` between each pair of these adjacent sections (NOT after every section — sparingly is the point):
- Between Hero and Brand story
- Between Services and How-it-works
- Between How-it-works and Practitioner placeholder
- Between Patient stories and the Explore section (or whatever closes the page)

Do NOT add ink dividers between the tongue widget (Brief #6) and adjacent sections, or around the organ clock — those sections are already visually distinctive and another divider near them would clutter.

### H3. Reveal the ink dividers on scroll

Add the `.reveal` class to each `.ink-divider` so it fades in like other content blocks. This also subtly draws the eye, signaling "section change."

```html
<div class="ink-divider reveal" aria-hidden="true">...</div>
```

### Acceptance for Task H

- Brand story and How-it-works sections have a subtle rice-paper texture in the background (visible as warmth, not as a distracting image).
- Ink-wash dividers appear sparingly between major sections — quiet visual punctuation, not loud.
- Dividers reveal on scroll like other elements.
- Mobile dividers are smaller and even more muted.
- No ink divider appears next to the tongue widget or organ clock sections.

---

## TASK G — Spacing reverence

Audit the v3 section paddings. Currently many sections use `padding: 36px` or `48px` vertically. Bump the vertical breathing room on key sections:

- Hero: keep as-is (full viewport)
- Brand story: `padding: 96px 0`
- Services: `padding: 96px 0`
- How-it-works: `padding: 80px 0`
- Practitioner placeholder: `padding: 80px 0`
- Patient stories: `padding: 96px 0`
- Organ clock section (if shipped): `padding: 80px 0`
- Tongue widget section (if shipped): `padding: 80px 0`

Mobile: halve the vertical paddings (use `clamp()` or media queries).

---

## MANDATORY SAFEGUARDS

1. **prefers-reduced-motion** respected on every animation — the snippets above already include this. Don't strip it. People with vestibular disorders rely on it.
2. **Mobile parallax disabled** — `background-attachment: fixed` and parallax effects don't work well on iOS Safari and cause performance issues. Tasks B, D and the tilt logic explicitly skip mobile.
3. **Image lazy loading** — every below-the-fold image uses `loading="lazy"`. Hero image uses `loading="eager"` with `fetchpriority="high"`.
4. **No layout shift** — every image element has explicit `aspect-ratio` set in CSS so the browser reserves space before the image loads. Prevents CLS (Cumulative Layout Shift).
5. **Performance budget** — total added JavaScript should be under 25KB minified. Lenis is ~10KB; the inline observer + parallax + load handlers are <2KB. Stay under budget.
6. **Image format note** — PNGs are fine for now but bigger than necessary. After the brief lands and you confirm visual correctness, we can run a follow-up to convert PNGs to WebP at 85% quality, which would shave ~50% off image weight. Out of scope for this brief.

---

## ACCEPTANCE CRITERIA

- v3/index.html hero shows `hero-bg.png` as background with the gradient overlay; brand spine + CTAs remain readable on top.
- Brand story section is now 2-column on desktop with `brand-story.png` on the left.
- Each service card has its corresponding image at the top.
- Each how-it-works step has its corresponding image.
- Practitioner placeholder cards each show the empty-clinic image, slightly desaturated, full-color on hover.
- Patient stories section is now full-width with the placeholder image as background and text overlay on top.
- Smooth scroll active on desktop (Lenis); touch + reduced-motion users get default scroll.
- Sections fade-up as they enter view (scroll reveal); hero is visible immediately.
- Hero background subtly parallax-scrolls on desktop only.
- Cards subtly tilt on hover (desktop); reduced-motion users get translateY only.
- All images fade in as they finish loading.
- Increased vertical breathing room on major sections.
- Brand story and How-it-works sections show subtle rice-paper texture in background (opacity 0.08, blend multiply).
- Ink-wash dividers appear between Hero/Brand story, Services/How-it-works, How-it-works/Practitioner, Patient stories/Explore. NOT around the tongue widget or organ clock.
- Mobile (≤768px): no parallax, no tilt, but reveals + smooth scroll OFF (native scroll), images stack cleanly.
- All bilingual content unchanged.
- v2/ files NOT modified.
- No regressions on the brand spine, founder story, services structure, organ clock, tongue widget (if shipped).
- Lighthouse Performance score on v3 should remain ≥85 (PNG image weight is the variable; if it dips below, flag it and we'll convert to WebP in follow-up).

---

## REPORT BACK

```
Files changed: [paths + line numbers]
Pushed to: [commit hash]
Hero with bg image + gradient overlay: [yes/no]
Brand story 2-column with image: [yes/no]
Service cards with images + tilt: [yes/no]
How-it-works steps with images: [yes/no]
Practitioner cards with placeholder image: [yes/no]
Patient stories with bg + overlay: [yes/no]
Lenis smooth scroll active (desktop only): [yes/no]
Scroll reveals firing on each section: [yes/no — list which ones]
Parallax on hero (desktop only): [yes/no]
Card hover tilt (subtle): [yes/no]
Image fade-in on load: [yes/no]
Vertical spacing increased on major sections: [yes/no]
prefers-reduced-motion respected on all animations: [yes/no]
Mobile renders cleanly (≤768px): [yes/no]
v2/ files touched: [should be 'none']
Lighthouse Performance score on v3 (rough estimate): [number]
Anything left as TODO: [list]
```

If any animation or image addition would break the brand spine layout, the founder story rendering, or the existing tongue/clock widgets — STOP and report. The visual upgrade should ADD to the existing v3, not replace anything.
