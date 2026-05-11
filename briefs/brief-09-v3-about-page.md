# Brief #9 — v3/about.html clean rebuild with warmth treatment

**Classification: DESIGN / CONTENT — scope: NEW file `v3/about.html`. v2/about.html stays untouched (will be replaced when v3 cuts over).**

## Background

`v2/about.html` is 1632 lines but the actual about-page content is only lines 957-1021 (~65 lines). The remaining ~1500 lines are copy-pasted from home (lines 687-955), services (1024-1051), contact (1055-1083), book (1084-1129), and register (1130+) pages — likely from when each page was created by copy-pasting the home as a starting template and content was never trimmed.

Real visitors landing on services.html / about.html / practitioners.html scroll through ~1000 lines of unrelated content before reaching the actual page material. CEO has approved Path A: build clean v3 versions of these pages from scratch rather than try to clean up v2's mess. v2 stays live in its current state until v3 cuts over.

This brief rebuilds the about page only. Preserves all the SOLID copy from the v2 about section (lines 957-1021) but applies the v3 warmth treatment (image hero, bilingual structure, scroll reveals, rice-paper texture, snappy timing) and clean single-purpose information architecture.

## Reference: existing v3 patterns to mirror

`v3/index.html` is the visual+structural template. Match its:
- Nav structure + dropdown
- Color tokens (`--v4-*`), typography (Cormorant + Noto Serif SC + DM Sans)
- Bilingual `<span lang="en">` / `<span lang="zh">` pattern throughout
- `.reveal` class + IntersectionObserver pattern
- WebP imagery via `assets/img/...`
- Footer
- Preview banner at top (gold sticky, with link back to v2/about.html — adapted from v3/index.html's banner)

CSS file used: `v3/assets/css/visual-upgrade.css` (don't add new CSS files; reuse + extend this one if needed).

## Imagery available in `v3/assets/img/` (reuse what fits)

- `hero-bg.webp` — atmospheric tea-ceremony overhead. Could double as about hero background.
- `brand-story.webp` — practitioner hands taking pulse. **Best fit for about hero or "Why we built HansMed" section.**
- `practitioner-placeholder.webp` — empty TCM clinic interior. Could anchor an "Our space" or stats section.
- `patient-stories-placeholder.webp` — quiet still life of notebook + tea. Could anchor a contemplative section or footer area.

No need to generate new imagery for about page yet — reuse what exists.

---

## TASK — Build `v3/about.html`

Create the file at `v3/about.html`. Structure top to bottom:

### 1. `<head>` block
Copy the exact head structure from `v3/index.html`. Update `<title>` to:
```
About · 關於 · HansMed Modern TCM
```
And `<meta name="description">` to:
```
HansMed Modern TCM — bridging traditional Chinese medicine wisdom with modern technology. Licensed practitioners, AI-assisted assessment, herbs delivered. Serving Malaysia.
```

Preserve all the inline pre-paint scripts (auth, shop-disabled, lang, language CSS hide rules) verbatim from v3/index.html. They're sync-loaded and need to be there before paint.

### 2. Preview banner
Same gold sticky banner as v3/index.html, but the "View live homepage →" link should point to `../v2/about.html` (not index.html).

### 3. Nav
Copy the nav block from v3/index.html exactly. Update the active state — change `class="nl act"` to be on the About dropdown item rather than Home.

### 4. Hero section — image-led
Bigger and more atmospheric than the v2 hero. Uses `brand-story.webp` as the hero image (the practitioner-pulse photo) with text overlay.

```html
<section class="hero-v3 about-hero" style="background-image: url('assets/img/brand-story.webp');">
  <div class="hero-bg"></div>
  <div class="hero-content">
    <div class="eyebrow">
      <span lang="en">About HansMed</span>
      <span lang="zh">關於 漢方</span>
    </div>
    <h1 class="hero-h1">
      <span lang="en">Where tradition meets <em>modern care</em></span>
      <span lang="zh">傳統智慧 · <em>現代中醫</em></span>
    </h1>
    <p class="hero-sub">
      <span lang="en">Quality TCM, made accessible to every Malaysian.</span>
      <span lang="zh">傳統中醫智慧 · 讓每位馬來西亞人都能輕鬆獲得優質中醫服務。</span>
    </p>
  </div>
</section>
```

Reuse the `.hero-v3` background-image + gradient overlay treatment from `visual-upgrade.css`. Hero shorter than home (60vh, not 88vh) so user scrolls into content faster.

### 5. Origin section — "Why we built HansMed"
Two-column on desktop: text on left, brand-story image on right (or stats grid on right — see option B below). Bilingual.

```html
<section class="sec sec-white about-origin reveal">
  <div class="origin-grid">
    <div class="origin-text">
      <div class="eyebrow">
        <span lang="en">Our origin</span>
        <span lang="zh">緣起</span>
      </div>
      <h2 class="origin-h">
        <span lang="en">Why we built <em>HansMed</em></span>
        <span lang="zh">為何創辦 <em>HansMed</em></span>
      </h2>
      <p class="origin-body">
        <span lang="en">HansMed was born from a simple idea — to help busy Malaysians see a qualified TCM practitioner with peace of mind, while freeing doctors from paperwork so they can focus on what they trained for: listening, feeling the pulse, understanding your constitution.</span>
        <span lang="zh">為了方便大眾在忙碌的生活節奏中可以安心看上合格中醫，讓中醫師專心做他們一輩子在做的事 —— 聽您說，把您的脈，了解您的體質。</span>
      </p>
      <p class="origin-spine">
        <span lang="en">Modern technology, traditional wisdom — bridging the generations.</span>
        <span lang="zh">現代化的科技平台，傳統式的中醫智慧 — 造就了現代與傳統不再有代溝。</span>
      </p>
    </div>
    <div class="origin-stats">
      <div class="stat-b">
        <div class="stat-n">2</div>
        <div class="stat-l"><span lang="en">Licensed Doctors</span><span lang="zh">持證醫師</span></div>
      </div>
      <div class="stat-b">
        <div class="stat-n"><span lang="en">New</span><span lang="zh">全新</span></div>
        <div class="stat-l"><span lang="en">Modern Platform</span><span lang="zh">現代化平台</span></div>
      </div>
      <div class="stat-b">
        <div class="stat-n">10+</div>
        <div class="stat-l"><span lang="en">TCM Specialties</span><span lang="zh">專科類別</span></div>
      </div>
      <div class="stat-b">
        <div class="stat-n">24/7</div>
        <div class="stat-l"><span lang="en">Chat Support</span><span lang="zh">線上支援</span></div>
      </div>
    </div>
  </div>
</section>
```

Style the brand spine paragraph (`.origin-spine`) in italic Cormorant Garamond, slightly larger, gold accent — make it visually distinct as the brand-defining line.

### 6. Practitioner space section — "How we practice"
Use `practitioner-placeholder.webp` as the visual. Single-column with image on top, copy below. This section isn't in v2's about — it's a new section that adds visual interest and reinforces the "real clinic, real practice" trust signal.

```html
<section class="sec sec-alt about-space has-rice-bg reveal">
  <div class="about-space-inner">
    <div class="about-space-img">
      <img src="assets/img/practitioner-placeholder.webp" alt="A quiet TCM consultation room" loading="lazy" class="fade-in-load" width="1000" height="1000">
    </div>
    <div class="about-space-text">
      <div class="eyebrow">
        <span lang="en">Our practice</span>
        <span lang="zh">診室</span>
      </div>
      <h2>
        <span lang="en">A space for <em>quiet listening</em></span>
        <span lang="zh">為您 <em>專注傾聽</em></span>
      </h2>
      <p>
        <span lang="en">Our practitioners work in a calm, traditional setting designed for the time-honored craft of TCM diagnosis — pulse, tongue, voice, observation. The technology is invisible; what you experience is care.</span>
        <span lang="zh">我們的中醫師在一個寧靜、傳統的環境中工作，專為望聞問切而設。科技在背後運作，您所體驗的是照護本身。</span>
      </p>
    </div>
  </div>
</section>
```

### 7. Three principles — "Three things we never compromise on"
Preserve the v2 content (Clinical Integrity / Privacy First / Quality Herbs) but restyle as the v3 service-card pattern. Use the existing 醫 / 私 / 質 Chinese characters as typographic seals — these are NOT emojis (per the recent emoji-removal pass). Style them as elegant calligraphic accents in deep red or gold, like a traditional Chinese seal.

```html
<section class="sec sec-white about-principles reveal">
  <div class="sh center">
    <div class="eyebrow">
      <span lang="en">Our approach</span>
      <span lang="zh">原則</span>
    </div>
    <h2>
      <span lang="en">Three things we <em>never compromise</em> on</span>
      <span lang="zh">我們絕不妥協的 <em>三件事</em></span>
    </h2>
  </div>
  <div class="g3 principles-grid">
    <div class="card-v4 principle-card reveal">
      <div class="principle-seal" aria-hidden="true">醫</div>
      <h3>
        <span lang="en">Clinical integrity</span>
        <span lang="zh">臨床誠信</span>
      </h3>
      <p>
        <span lang="en">Every AI output and wellness report is reviewed by a licensed TCM practitioner before it reaches you. All practitioners are registered with Malaysia's T&CM Council and undergo continuous education.</span>
        <span lang="zh">所有 AI 健康報告均由持牌中醫師審核後才呈現給您。所有醫師均於馬來西亞傳統與輔助醫藥局註冊，並持續進修中醫學識。</span>
      </p>
    </div>
    <div class="card-v4 principle-card reveal" style="transition-delay:0.04s;">
      <div class="principle-seal" aria-hidden="true">私</div>
      <h3>
        <span lang="en">Privacy first</span>
        <span lang="zh">私隱優先</span>
      </h3>
      <p>
        <span lang="en">Fully PDPA 2010 compliant. Explicit consent before any AI processing. Encrypted storage — export or delete your data at any time from settings.</span>
        <span lang="zh">完全符合 2010 年個人資料保護法（PDPA）。AI 處理前必須取得明確同意。資料加密儲存 — 您可隨時於設定中匯出或刪除個人資料。</span>
      </p>
    </div>
    <div class="card-v4 principle-card reveal" style="transition-delay:0.08s;">
      <div class="principle-seal" aria-hidden="true">質</div>
      <h3>
        <span lang="en">Quality herbs</span>
        <span lang="zh">品質藥材</span>
      </h3>
      <p>
        <span lang="en">Only verified Malaysian and international suppliers. Every product labelled with Chinese name, pinyin, and transparent sourcing details.</span>
        <span lang="zh">只與經認證的本地及國際供應商合作。每款藥材均附上中文名稱、拼音及完整的來源資訊，公開透明。</span>
      </p>
    </div>
  </div>
</section>
```

CSS for `.principle-seal` — make it look like a Chinese seal stamp:
```css
body.landing-v4 .principle-seal {
  display: inline-block;
  width: 56px;
  height: 56px;
  line-height: 56px;
  text-align: center;
  font-family: 'Noto Serif SC', serif;
  font-size: 32px;
  font-weight: 500;
  color: var(--v4-go);
  background: rgba(181, 136, 26, 0.08);
  border: 1px solid rgba(181, 136, 26, 0.25);
  border-radius: 6px;
  margin-bottom: 18px;
}
```

This keeps the cultural typographic accent without falling into the emoji trap.

### 8. CTA section — "Ready to begin?"
End with the existing v2 CTA, restyled to match v3.

```html
<section class="sec about-cta reveal">
  <div class="cta-inner">
    <h2>
      <span lang="en">Ready to begin?</span>
      <span lang="zh">準備好了嗎？</span>
    </h2>
    <p>
      <span lang="en">Book your first consultation, or try the free wellness assessment.</span>
      <span lang="zh">立即預約您的首次問診，或先試試免費的體質評估。</span>
    </p>
    <div class="cta-row">
      <a class="btn-v4 btn-dark" href="../v2/portal.html#/book">
        <span lang="en">Book a consultation · 預約問診</span>
        <span lang="zh">預約問診 · Book a consultation</span>
      </a>
      <a class="btn-v4 btn-outline" href="../v2/portal.html#/wellness-assessment">
        <span lang="en">Try wellness assessment · 體質評估</span>
        <span lang="zh">體質評估 · Try wellness assessment</span>
      </a>
    </div>
  </div>
</section>
```

### 9. Footer
Copy the footer block from v3/index.html exactly. All footer page links should already resolve back to v2/* via the existing pattern.

### 10. Inline scripts at bottom
Copy the same script blocks from v3/index.html:
- Lenis smooth scroll (with the desktop-only guard)
- IntersectionObserver scroll-reveal observer
- Image fade-in handler
- DO NOT include the hero parallax script — about page hero doesn't need parallax (shorter hero, less benefit)

## CSS additions to `v3/assets/css/visual-upgrade.css`

Add a new section at the bottom for about-page-specific styles. Reuse existing tokens.

```css
/* ════════════ Brief #9 — About page ═══════════════════════════════ */

body.landing-v4 .about-hero {
  min-height: 60vh; /* shorter than home hero (88vh) */
}

body.landing-v4 .origin-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 64px;
  align-items: center;
  max-width: 1100px;
  margin: 0 auto;
}
body.landing-v4 .origin-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
body.landing-v4 .origin-spine {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-size: 19px;
  color: var(--v4-tc);
  border-left: 2px solid var(--v4-go);
  padding-left: 16px;
  margin-top: 18px;
}
@media (max-width: 768px) {
  body.landing-v4 .origin-grid {
    grid-template-columns: 1fr;
    gap: 36px;
  }
}

body.landing-v4 .about-space-inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  align-items: center;
  max-width: 1100px;
  margin: 0 auto;
}
body.landing-v4 .about-space-img {
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: 16px;
}
body.landing-v4 .about-space-img img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
@media (max-width: 768px) {
  body.landing-v4 .about-space-inner {
    grid-template-columns: 1fr;
    gap: 32px;
  }
}

body.landing-v4 .principle-card {
  text-align: left;
  padding: 32px;
}
body.landing-v4 .principle-seal {
  display: inline-block;
  width: 56px;
  height: 56px;
  line-height: 56px;
  text-align: center;
  font-family: 'Noto Serif SC', serif;
  font-size: 32px;
  font-weight: 500;
  color: var(--v4-go);
  background: rgba(181, 136, 26, 0.08);
  border: 1px solid rgba(181, 136, 26, 0.25);
  border-radius: 6px;
  margin-bottom: 18px;
}

body.landing-v4 .about-cta {
  background: var(--v4-ink);
  text-align: center;
  padding: 80px 8vw;
  color: #fff;
}
body.landing-v4 .about-cta h2 {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(28px, 4vw, 38px);
  font-weight: 400;
  margin-bottom: 14px;
  color: #fff;
}
body.landing-v4 .about-cta p {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 30px;
  font-weight: 300;
}
body.landing-v4 .cta-row {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
```

## ACCEPTANCE CRITERIA

- New file `v3/about.html` exists and renders cleanly at `hansmedtcm.github.io/Hansmed-system/v3/about.html`.
- Preview banner at top with link back to `../v2/about.html`.
- Hero uses `brand-story.webp` as background, with the gradient overlay so text remains readable. Shorter hero than home (60vh).
- Origin section is 2-column desktop (text + stats grid), single column mobile.
- Brand spine line is visually distinct (italic Cormorant, gold left-border).
- "Our practice" section (NEW vs v2) uses `practitioner-placeholder.webp` and reinforces the human/clinical trust signal.
- "Three principles" section preserves the v2 copy verbatim, restyled with calligraphic seal characters (醫 / 私 / 質) as elegant typography NOT emoji.
- CTA section ends the page with two clear paths (book consult / try wellness).
- Footer matches v3/index.html.
- All bilingual via `<span lang>` pattern.
- Scroll reveals fire smoothly (uses the corrected timing from the recent fix).
- WebP imagery throughout — no PNGs.
- Lenis smooth scroll on desktop, native scroll on mobile/touch.
- v2/about.html NOT modified.
- Page validates as proper HTML5 with no broken nav/dropdown/footer references.

## REPORT BACK

```
Files created: v3/about.html
Files modified: v3/assets/css/visual-upgrade.css (added about-page styles)
Pushed to: [commit hash]
Hero with brand-story.webp + gradient overlay: [yes/no]
Origin section 2-col desktop / 1-col mobile: [yes/no]
"Our practice" new section using practitioner-placeholder.webp: [yes/no]
Three principles section with seal characters (醫/私/質) styled as typography (not emoji): [yes/no]
CTA section dark background with two buttons: [yes/no]
Bilingual rendering (EN + ZH) confirmed: [yes/no]
Scroll reveals firing snappy (no "wait then roll" feel): [yes/no]
Mobile (≤768px) layout stacks cleanly: [yes/no]
v2/about.html touched: [should be 'no']
Anything left as TODO: [list]
```

If you find a copy line that reads awkwardly in either language while implementing, flag it but don't change the founder's brand spine line ("現代化的科技平台，傳統式的中醫智慧 — 造就了現代與傳統不再有代溝") — that's the canonical brand voice.
