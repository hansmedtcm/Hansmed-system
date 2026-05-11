# Brief #11 — v3/practitioners.html clean rebuild (placeholder-driven)

**Classification: DESIGN / CONTENT — scope: NEW file `v3/practitioners.html`. v2/practitioners.html stays untouched. v3/index.html stays untouched.**

## Background

`v2/practitioners.html` is 2017 lines with the same duplication pattern (home + about + services content all stitched into one page). Per CEO's Path A + Option 1 IA decision, build a clean v3 dedicated page from scratch with depth content, but with a key constraint: **CEO doesn't yet have practitioner content** (photos, names, bios, video intros). So this page must be:

- Fully built and structurally complete
- Treats the missing content as an INTENTIONAL placeholder, not a gap
- Establishes the trust signal even without faces (T&CM Council registration, contact us for matching, what to expect)
- Easy to drop real practitioner content into later (just swap placeholder cards for real ones)

## Reference: existing v3 patterns to mirror

`v3/about.html` and `v3/services.html` are the structural templates. Match their:
- Head + preview banner
- Nav (active dropdown item = Practitioners, dd-prac)
- Bilingual `<span lang>` pattern
- WebP imagery, neutralized reveals, smooth scroll
- Footer
- All shared scripts including `about-dropdown.js`

## Imagery available in `v3/assets/img/` (reuse)

- `practitioner-placeholder.webp` — empty TCM clinic interior. The HERO and PLACEHOLDER CARDS image.
- `brand-story.webp` — practitioner hands taking pulse. Could anchor a "How we examine you" section.

---

## TASK — Build `v3/practitioners.html`

### 1. `<head>`
```
<title>Our Practitioners · 醫師 · HansMed Modern TCM</title>
<meta name="description" content="Our TCM practitioners are licensed by Malaysia's T&CM Council. Profiles coming soon — email us for matching and we'll introduce the right practitioner for your concern.">
```

### 2. Preview banner — link back to `../v2/practitioners.html`

### 3. Nav — copy from v3/services.html. Update active state:
- Remove `is-current` from dd-svc
- Add `is-current` to dd-prac
- `dd-prac href="practitioners.html"` (v3-relative — this very page)
- `dd-about href="about.html"` and `dd-svc href="services.html"` (v3-relative — those exist)
- Other dropdown items still go to `../v2/...`

### 4. Hero — image-led
Use `practitioner-placeholder.webp` as background. Honest framing acknowledging that profiles are coming soon, but the trust signal lives in licensing and the matching process.

```html
<section class="hero-v3 practitioners-hero" style="background-image: url('assets/img/practitioner-placeholder.webp');">
  <div class="hero-bg"></div>
  <div class="hero-content">
    <div class="eyebrow">
      <span lang="en">Our practitioners</span>
      <span lang="zh">我們的醫師</span>
    </div>
    <h1 class="hero-h1">
      <span lang="en">Licensed. Experienced. <em>Approachable.</em></span>
      <span lang="zh">持牌 · 經驗 · <em>平易近人</em></span>
    </h1>
    <p class="hero-sub">
      <span lang="en">Every TCM practitioner on HansMed is registered with Malaysia's T&CM Council. Individual profiles are coming soon — for now, contact us and we'll match you with the right practitioner for your concern.</span>
      <span lang="zh">HansMed 所有中醫師均於馬來西亞傳統與輔助醫藥局註冊。個人介紹即將推出 —— 目前請聯絡我們，我們會為您匹配適合的中醫師。</span>
    </p>
  </div>
</section>
```

### 5. Trust + licensing section — what "registered with T&CM Council" means
Single section explaining the Malaysian regulatory framework so visitors trust the platform even without seeing individual faces.

```html
<section class="sec sec-white practitioners-trust">
  <div class="sh center" style="margin-bottom:36px;">
    <div class="eyebrow">
      <span lang="en">Licensing & standards</span>
      <span lang="zh">執照與標準</span>
    </div>
    <h2>
      <span lang="en">What "<em>licensed</em>" actually means</span>
      <span lang="zh">"<em>持牌</em>" 究竟意味著什麼</span>
    </h2>
  </div>

  <div class="trust-grid">
    <div class="trust-item">
      <div class="trust-num">01</div>
      <h3>
        <span lang="en">T&CM Council registration</span>
        <span lang="zh">T&CM 局註冊</span>
      </h3>
      <p>
        <span lang="en">Every practitioner is registered with Malaysia's Traditional and Complementary Medicine Council under the T&CM Act 2016. Their registration number is verifiable through the Council's public register.</span>
        <span lang="zh">每位醫師均依 2016 年 T&CM 法令於馬來西亞傳統與輔助醫藥局註冊，註冊號碼可於 T&CM 局公開名冊查詢。</span>
      </p>
    </div>
    <div class="trust-item">
      <div class="trust-num">02</div>
      <h3>
        <span lang="en">Verified credentials</span>
        <span lang="zh">學歷驗證</span>
      </h3>
      <p>
        <span lang="en">We check each practitioner's TCM degree (typically a 5-year programme from a recognised TCM university), clinical training records, and continuing professional development before they join the platform.</span>
        <span lang="zh">每位醫師加入前，我們會驗證其中醫學歷（通常為認可中醫大學的五年制課程）、臨床訓練記錄、以及持續進修證明。</span>
      </p>
    </div>
    <div class="trust-item">
      <div class="trust-num">03</div>
      <h3>
        <span lang="en">Annual re-verification</span>
        <span lang="zh">每年複核</span>
      </h3>
      <p>
        <span lang="en">Registration is re-checked annually. If a practitioner's registration lapses or is suspended, they are removed from HansMed immediately.</span>
        <span lang="zh">註冊每年複核。若醫師註冊失效或被暫停，將立即從 HansMed 移除。</span>
      </p>
    </div>
    <div class="trust-item">
      <div class="trust-num">04</div>
      <h3>
        <span lang="en">Professional indemnity</span>
        <span lang="zh">專業責任保險</span>
      </h3>
      <p>
        <span lang="en">All practising practitioners carry professional indemnity insurance, in line with T&CM Council guidance and best practice for telemedicine.</span>
        <span lang="zh">所有執業醫師均持有專業責任保險，符合 T&CM 局指引與遠程醫療最佳做法。</span>
      </p>
    </div>
  </div>
</section>
```

### 6. "Meet our practitioners" — placeholder cards section
Three placeholder cards using `practitioner-placeholder.webp`. Designed to be visually intentional, not broken-looking. When real practitioners are added later, these become real profile cards.

```html
<section class="sec sec-alt practitioners-grid-section has-rice-bg">
  <div class="sh center" style="margin-bottom:36px;">
    <div class="eyebrow">
      <span lang="en">Meet our team</span>
      <span lang="zh">認識我們的團隊</span>
    </div>
    <h2>
      <span lang="en">Profiles <em>coming soon</em></span>
      <span lang="zh">醫師介紹 <em>即將推出</em></span>
    </h2>
    <p class="practitioners-intro">
      <span lang="en">We're collecting permission and writing each practitioner's profile right now. In the meantime, the contact form below puts you in touch with our team — tell us your concern and we'll introduce you to the practitioner who fits best.</span>
      <span lang="zh">我們正在收集授權並撰寫每位醫師的介紹。在此期間，下方的聯絡表格會將您與我們的團隊連繫 —— 告訴我們您的健康關注，我們會為您介紹最適合的醫師。</span>
    </p>
  </div>

  <div class="practitioners-card-grid">
    <div class="practitioner-card-placeholder">
      <div class="practitioner-card-img">
        <img src="assets/img/practitioner-placeholder.webp" alt="" loading="lazy">
      </div>
      <div class="practitioner-card-meta">
        <div class="practitioner-card-tag">
          <span lang="en">Practitioner profile</span>
          <span lang="zh">醫師介紹</span>
        </div>
        <div class="practitioner-card-soon">
          <span lang="en">Coming soon · 即將推出</span>
          <span lang="zh">即將推出 · Coming soon</span>
        </div>
      </div>
    </div>
    <div class="practitioner-card-placeholder">
      <div class="practitioner-card-img">
        <img src="assets/img/practitioner-placeholder.webp" alt="" loading="lazy">
      </div>
      <div class="practitioner-card-meta">
        <div class="practitioner-card-tag">
          <span lang="en">Practitioner profile</span>
          <span lang="zh">醫師介紹</span>
        </div>
        <div class="practitioner-card-soon">
          <span lang="en">Coming soon · 即將推出</span>
          <span lang="zh">即將推出 · Coming soon</span>
        </div>
      </div>
    </div>
    <div class="practitioner-card-placeholder">
      <div class="practitioner-card-img">
        <img src="assets/img/practitioner-placeholder.webp" alt="" loading="lazy">
      </div>
      <div class="practitioner-card-meta">
        <div class="practitioner-card-tag">
          <span lang="en">Practitioner profile</span>
          <span lang="zh">醫師介紹</span>
        </div>
        <div class="practitioner-card-soon">
          <span lang="en">Coming soon · 即將推出</span>
          <span lang="zh">即將推出 · Coming soon</span>
        </div>
      </div>
    </div>
  </div>
</section>
```

### 7. "How we examine you" — TCM diagnostic methods section
Reuse `brand-story.webp` (practitioner pulse-taking). Educational section about the four TCM diagnostic methods so visitors know what a real consultation involves regardless of which practitioner they see.

```html
<section class="sec sec-white practitioners-method">
  <div class="practitioners-method-inner">
    <div class="practitioners-method-img">
      <img src="assets/img/brand-story.webp" alt="A practitioner taking a patient's pulse" loading="lazy" width="1200" height="1500">
    </div>
    <div class="practitioners-method-text">
      <div class="eyebrow">
        <span lang="en">How we examine you</span>
        <span lang="zh">如何為您診察</span>
      </div>
      <h2>
        <span lang="en">The four classical methods, <em>still the foundation</em></span>
        <span lang="zh">四診合參 · <em>始終是根本</em></span>
      </h2>
      <p class="practitioners-method-lead">
        <span lang="en">No matter which HansMed practitioner you see, every consultation follows the four classical TCM methods of examination — refined over 2,000 years of clinical practice.</span>
        <span lang="zh">無論您見的是哪位 HansMed 中醫師，每次問診都依循中醫四診合參 —— 經兩千年臨床實踐淬鍊而成。</span>
      </p>

      <ul class="four-methods">
        <li>
          <span class="fm-zh">望</span>
          <div>
            <strong><span lang="en">Observe</span><span lang="zh">望</span></strong>
            <p><span lang="en">The practitioner looks at your overall complexion, posture, demeanor, and tongue. Tongue observation alone reveals constitutional patterns and acute imbalances.</span><span lang="zh">醫師觀察您整體面色、神態、姿勢、舌象。單舌診即可反映體質傾向與當前失衡。</span></p>
          </div>
        </li>
        <li>
          <span class="fm-zh">聞</span>
          <div>
            <strong><span lang="en">Listen + smell</span><span lang="zh">聞</span></strong>
            <p><span lang="en">Voice tone, breathing patterns, cough quality. In TCM "聞" covers both listening and (when relevant) smell — both reveal organ system imbalances.</span><span lang="zh">聲音、呼吸、咳嗽性質。中醫"聞"涵蓋聽聲與嗅味，皆反映臟腑失調。</span></p>
          </div>
        </li>
        <li>
          <span class="fm-zh">問</span>
          <div>
            <strong><span lang="en">Ask</span><span lang="zh">問</span></strong>
            <p><span lang="en">Detailed history-taking: chief complaint, symptom timing, sleep, appetite, digestion, energy, emotions, menstrual cycle (if applicable). The conversation is the longest part of any TCM consultation.</span><span lang="zh">詳細問診：主訴、症狀時程、睡眠、食慾、消化、體力、情志、月經（如適用）。對話是每次中醫問診中最長的部分。</span></p>
          </div>
        </li>
        <li>
          <span class="fm-zh">切</span>
          <div>
            <strong><span lang="en">Palpate (pulse)</span><span lang="zh">切</span></strong>
            <p><span lang="en">Pulse-taking at the wrist (six positions, three depths). Each position reflects an organ system. For video consultations, the practitioner may ask you to describe pulse-related symptoms in lieu of physical palpation.</span><span lang="zh">寸口脈診（三部九候）。每個部位反映一個臟腑。視訊問診時，醫師可能會請您描述脈相相關症狀以代替親自切脈。</span></p>
          </div>
        </li>
      </ul>
    </div>
  </div>
</section>
```

### 8. Match-me CTA — "How to find your practitioner"
Practical section telling visitors how to actually get matched with a practitioner today (since profiles aren't browseable yet).

```html
<section class="sec sec-white practitioners-match">
  <div class="match-inner">
    <div class="eyebrow center">
      <span lang="en">Find your practitioner</span>
      <span lang="zh">為您匹配醫師</span>
    </div>
    <h2 class="match-h">
      <span lang="en">Three ways to <em>get matched today</em></span>
      <span lang="zh">三種方式 <em>立即為您匹配</em></span>
    </h2>

    <div class="match-grid">
      <div class="match-card">
        <div class="match-num">01</div>
        <h3><span lang="en">Email us your concern</span><span lang="zh">將您的健康關注寄給我們</span></h3>
        <p><span lang="en">Send us a brief note describing what brings you in. We respond within one business day with a practitioner suggestion and available consultation slots.</span><span lang="zh">簡短說明您的健康關注，我們會於一個工作日內回覆，並提供醫師建議與可預約時段。</span></p>
        <a class="match-link" href="mailto:hansmed.moderntcm@gmail.com">hansmed.moderntcm@gmail.com →</a>
      </div>
      <div class="match-card">
        <div class="match-num">02</div>
        <h3><span lang="en">Take the wellness assessment first</span><span lang="zh">先做體質評估</span></h3>
        <p><span lang="en">If you're not sure where to start, complete the free AI Wellness Assessment. The reviewing practitioner can recommend whether to book a consultation and which type.</span><span lang="zh">若不確定從何開始，先完成免費 AI 體質評估。審核醫師可建議是否需要預約問診以及哪一種。</span></p>
        <a class="match-link" href="../v2/portal.html#/wellness-assessment">
          <span lang="en">Start free assessment →</span>
          <span lang="zh">免費開始評估 →</span>
        </a>
      </div>
      <div class="match-card">
        <div class="match-num">03</div>
        <h3><span lang="en">Just book — we'll match</span><span lang="zh">直接預約 · 由我們匹配</span></h3>
        <p><span lang="en">Skip the matching step and book directly. Tell us your concern in the booking form; we route you to the practitioner whose specialty fits.</span><span lang="zh">略過匹配步驟，直接預約。在預約表格中說明您的關注，我們會將您安排給最合適的醫師。</span></p>
        <a class="match-link" href="../v2/portal.html#/book">
          <span lang="en">Book a consultation →</span>
          <span lang="zh">預約問診 →</span>
        </a>
      </div>
    </div>
  </div>
</section>
```

### 9. CTA section + footer
Same dark CTA as v3/about.html and v3/services.html. Footer copied verbatim from those pages.

### 10. Inline scripts at bottom
Same set as v3/services.html. Don't forget `about-dropdown.js`.

## CSS additions to `v3/assets/css/visual-upgrade.css`

```css
/* ════════════ Brief #11 — Practitioners page ══════════════════════ */

body.landing-v4 .practitioners-hero { min-height: 60vh; }

body.landing-v4 .practitioners-trust {
  padding: clamp(56px, 7vw, 96px) 24px;
}
body.landing-v4 .trust-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 32px;
  max-width: 1000px; margin: 0 auto;
}
body.landing-v4 .trust-item {
  background: var(--v4-bg-2);
  border: 1px solid var(--v4-bdr-l);
  border-radius: 14px;
  padding: 32px;
}
body.landing-v4 .trust-num {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic; font-size: 22px; font-weight: 500;
  color: var(--v4-go);
  margin-bottom: 12px;
}
body.landing-v4 .trust-item h3 {
  font-family: 'Cormorant Garamond', serif;
  font-size: 22px; font-weight: 500; color: var(--v4-ink);
  margin: 0 0 10px;
}
body.landing-v4 .trust-item p {
  font-size: 14px; line-height: 1.7; color: var(--v4-mu); font-weight: 300; margin: 0;
}
@media (max-width: 768px) {
  body.landing-v4 .trust-grid { grid-template-columns: 1fr; }
}

body.landing-v4 .practitioners-grid-section {
  padding: clamp(56px, 7vw, 96px) 24px;
}
body.landing-v4 .practitioners-intro {
  max-width: 680px; margin: 18px auto 0; text-align: center;
  font-size: 15px; line-height: 1.78; color: var(--v4-mu); font-weight: 300;
}
body.landing-v4 .practitioners-card-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px;
  max-width: 1100px; margin: 0 auto;
}
body.landing-v4 .practitioner-card-placeholder {
  background: var(--v4-bg-2);
  border: 1px solid var(--v4-bdr-l);
  border-radius: 16px; overflow: hidden;
}
body.landing-v4 .practitioner-card-placeholder .practitioner-card-img {
  aspect-ratio: 4 / 5; overflow: hidden; background: var(--v4-bg-3);
}
body.landing-v4 .practitioner-card-placeholder .practitioner-card-img img {
  width: 100%; height: 100%; object-fit: cover; display: block;
  filter: grayscale(35%) brightness(1.02);
  transition: filter 0.4s ease;
}
body.landing-v4 .practitioner-card-placeholder:hover .practitioner-card-img img {
  filter: grayscale(0%) brightness(1);
}
body.landing-v4 .practitioner-card-meta {
  padding: 22px;
}
body.landing-v4 .practitioner-card-tag {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic; font-size: 18px; color: var(--v4-ink);
  margin-bottom: 6px;
}
body.landing-v4 .practitioner-card-soon {
  font-family: 'DM Sans', sans-serif;
  font-size: 11px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--v4-go);
}
@media (max-width: 768px) {
  body.landing-v4 .practitioners-card-grid { grid-template-columns: 1fr; max-width: 380px; }
}

body.landing-v4 .practitioners-method {
  padding: clamp(56px, 7vw, 96px) 24px;
}
body.landing-v4 .practitioners-method-inner {
  display: grid; grid-template-columns: 1fr 1.2fr; gap: 64px;
  align-items: start; max-width: 1100px; margin: 0 auto;
}
body.landing-v4 .practitioners-method-img {
  aspect-ratio: 4 / 5; overflow: hidden; border-radius: 16px;
  position: sticky; top: 96px;
}
body.landing-v4 .practitioners-method-img img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
body.landing-v4 .practitioners-method-text h2 {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(28px, 3.6vw, 38px); font-weight: 400;
  letter-spacing: -0.02em; color: var(--v4-ink); margin: 14px 0 18px;
}
body.landing-v4 .practitioners-method-text h2 em { font-style: italic; color: var(--v4-wd-md); }
body.landing-v4 .practitioners-method-lead {
  font-size: 15px; line-height: 1.78; color: var(--v4-mu); font-weight: 300;
  margin: 0 0 28px;
}
body.landing-v4 .four-methods {
  list-style: none; padding: 0; margin: 0;
}
body.landing-v4 .four-methods li {
  display: grid; grid-template-columns: 60px 1fr; gap: 20px;
  padding: 22px 0; border-top: 1px solid var(--v4-bdr-l);
  align-items: start;
}
body.landing-v4 .four-methods li:last-child { border-bottom: 1px solid var(--v4-bdr-l); }
body.landing-v4 .fm-zh {
  font-family: 'Noto Serif SC', serif;
  font-size: 38px; font-weight: 400; color: var(--v4-go);
  text-align: center; line-height: 1;
}
body.landing-v4 .four-methods li strong {
  display: block; font-family: 'Cormorant Garamond', serif;
  font-size: 18px; font-weight: 500; color: var(--v4-ink);
  margin-bottom: 6px;
}
body.landing-v4 .four-methods li p {
  font-size: 14px; line-height: 1.7; color: var(--v4-mu); font-weight: 300;
  margin: 0;
}
@media (max-width: 768px) {
  body.landing-v4 .practitioners-method-inner { grid-template-columns: 1fr; gap: 32px; }
  body.landing-v4 .practitioners-method-img { position: static; aspect-ratio: 4 / 3; }
}

body.landing-v4 .practitioners-match {
  padding: clamp(56px, 7vw, 96px) 24px;
  background: var(--v4-bg-2);
}
body.landing-v4 .match-inner { max-width: 1100px; margin: 0 auto; text-align: center; }
body.landing-v4 .match-h {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(26px, 3.4vw, 36px); font-weight: 400;
  letter-spacing: -0.02em; color: var(--v4-ink);
  margin: 14px 0 36px;
}
body.landing-v4 .match-h em { font-style: italic; color: var(--v4-wd-md); }
body.landing-v4 .match-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;
  text-align: left;
}
body.landing-v4 .match-card {
  background: #fff;
  border: 1px solid var(--v4-bdr-l); border-radius: 14px;
  padding: 28px;
}
body.landing-v4 .match-num {
  font-family: 'Cormorant Garamond', serif; font-style: italic;
  font-size: 22px; font-weight: 500; color: var(--v4-go);
  margin-bottom: 10px;
}
body.landing-v4 .match-card h3 {
  font-family: 'Cormorant Garamond', serif;
  font-size: 19px; font-weight: 500; color: var(--v4-ink);
  margin: 0 0 10px;
}
body.landing-v4 .match-card p {
  font-size: 14px; line-height: 1.7; color: var(--v4-mu); font-weight: 300;
  margin: 0 0 16px;
}
body.landing-v4 .match-link {
  font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
  color: var(--v4-ink); text-decoration: none;
  border-bottom: 1.5px solid var(--v4-go); padding-bottom: 2px;
  transition: color 0.2s, border-color 0.2s;
}
body.landing-v4 .match-link:hover { color: var(--v4-wd-dk); border-color: var(--v4-wd-dk); }
@media (max-width: 768px) {
  body.landing-v4 .match-grid { grid-template-columns: 1fr; }
}
```

## ACCEPTANCE CRITERIA

- New file `v3/practitioners.html` renders cleanly at `hansmedtcm.github.io/Hansmed-system/v3/practitioners.html`.
- Preview banner with link back to `../v2/practitioners.html`.
- Hero with `practitioner-placeholder.webp` background + centered text overlay.
- Trust + licensing section: 4 cards explaining T&CM Council registration, credentials check, annual re-verification, professional indemnity.
- "Meet our team" section: 3 placeholder cards using `practitioner-placeholder.webp`, each labeled "Practitioner profile · Coming soon."
- "How we examine you" section: pulse-taking image + bilingual explanation of the four classical TCM methods (望聞問切) with calligraphic Chinese character display.
- "Three ways to get matched" section: email / wellness assessment first / direct booking with three numbered cards.
- Bottom dark CTA section.
- Footer matches v3/index.html / about.html / services.html exactly.
- Bilingual via `<span lang>` pattern.
- Nav has Practitioners dropdown item marked `is-current`. About link → `about.html` (v3). Services link → `services.html` (v3). Practitioners link → `practitioners.html` (v3 self). Other dropdown items still `../v2/...`.
- WebP imagery only.
- Reveals neutralized via existing CSS.
- `about-dropdown.js` script included.
- Mobile (≤768px) layout stacks cleanly.
- v2/practitioners.html NOT modified.
- v3/index.html NOT modified.

## REPORT BACK

```
Files created: v3/practitioners.html
Files modified: v3/assets/css/visual-upgrade.css (added practitioners-page styles)
Pushed to: [commit hash]
Hero with practitioner-placeholder.webp + centered text: [yes/no]
Trust+licensing 4-card grid: [yes/no]
3 placeholder cards "coming soon": [yes/no]
Four-methods (望聞問切) section with brand-story.webp: [yes/no]
Three-ways-to-get-matched section: [yes/no]
Bottom dark CTA: [yes/no]
Bilingual rendering confirmed: [yes/no]
Nav active state on dd-prac, sibling links updated: [yes/no — list which]
about-dropdown.js included: [yes/no]
Mobile layout (≤768px) stacks cleanly: [yes/no]
v2/ files touched: [should be 'none']
v3/index.html touched: [should be 'none']
Anything left as TODO: [list]
```

If a copy line reads awkwardly in either language, polish lightly within the established tone. The four-methods Chinese characters (望聞問切) are CANONICAL TCM terminology — DO NOT change them.
