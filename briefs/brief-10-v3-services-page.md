# Brief #10 — v3/services.html clean rebuild with full service-depth content

**Classification: DESIGN / CONTENT — scope: NEW file `v3/services.html`. v2/services.html stays untouched (will be replaced when v3 cuts over). v3/index.html stays untouched (still has services teasers per Option 1 IA).**

## Background

`v2/services.html` is 1648 lines but most of it is duplicated home/about/contact content. The actual services material is concentrated in lines 1012-1051 (a few service blocks). Per CEO decision (Path A + Option 1 IA):

- **v3/index.html** keeps short service teasers (3 cards) with CTAs to v3/services.html
- **v3/services.html** = NEW dedicated page with FULL depth content not on home: pricing, FAQ, comparison table, detailed "how it works" per service

## Reference: existing v3 patterns to mirror

`v3/about.html` is the closest structural template (clean v3 dedicated page with image hero, bilingual, scroll reveals neutralized for v2-natural feel, footer matches index). Match its:
- Head block + preview banner (link banner back to `../v2/services.html`)
- Nav (active dropdown item = Services, dd-svc)
- Bilingual `<span lang>` pattern throughout
- `.reveal` class on sections (currently neutralized — leave as-is, hooks for future)
- WebP imagery via `assets/img/...`
- Footer
- Inline scripts at bottom (Lenis, IntersectionObserver, plus the `about-dropdown.js` script — DO NOT FORGET this — without it, the About nav button doesn't work)

CSS file: `v3/assets/css/visual-upgrade.css`. Add new section at the bottom for services-page-specific styles. Reuse existing tokens (`--v4-*`).

## Imagery available in `v3/assets/img/` (reuse, don't generate new)

- `service-wellness.webp` — woman with phone for wellness scan
- `service-consultation.webp` — over-shoulder video consultation
- `service-shop.webp` — herbs flat-lay on linen
- `hero-bg.webp` — atmospheric tea ceremony (could anchor services hero)
- `step1-discover.webp`, `step2-talk.webp`, `step3-receive.webp` — process imagery (optional reuse)

## Important: pricing content

User has approved including pricing but the actual numbers haven't been finalized. Use **`[PRICE: TBD]`** as a literal placeholder in the markup wherever a price would go. The placeholders will be filled in by the user once they decide. Do NOT invent specific prices.

---

## TASK — Build `v3/services.html`

Create the file at `v3/services.html`. Structure top to bottom:

### 1. `<head>` block
Copy structure from `v3/about.html`. Update:
```
<title>Services · 服務 · HansMed Modern TCM</title>
<meta name="description" content="HansMed services — AI tongue analysis, video and in-person TCM consultations with licensed practitioners, prescription-linked herb shop. Pricing, FAQ, and how each works.">
```

### 2. Preview banner
Same gold banner as v3/about.html. "View live homepage →" link points to `../v2/services.html`.

### 3. Nav
Copy from v3/about.html. Update active state:
- Remove `is-current` from `dd-about`
- Add `is-current` to `dd-svc`
- Make sure `dd-svc` href is `services.html` (v3-relative — this very page)
- All other dropdown items still go to `../v2/<page>.html`

### 4. Hero — image-led, services framing
Use `hero-bg.webp` (tea ceremony) since service-* imagery is reserved for the per-service blocks below.

```html
<section class="hero-v3 services-hero" style="background-image: url('assets/img/hero-bg.webp');">
  <div class="hero-bg"></div>
  <div class="hero-content">
    <div class="eyebrow">
      <span lang="en">Our services</span>
      <span lang="zh">我們的服務</span>
    </div>
    <h1 class="hero-h1">
      <span lang="en">Everything you need, <em>in one place</em></span>
      <span lang="zh">一站式中醫服務 · <em>在這裡都有</em></span>
    </h1>
    <p class="hero-sub">
      <span lang="en">From your first wellness scan to herbs delivered to your door — three connected services, one trusted platform.</span>
      <span lang="zh">從首次體質評估到藥材送上門 —— 三項相連的服務，一個值得信賴的平台。</span>
    </p>
  </div>
</section>
```

Hero same height as about (60vh).

### 5. Comparison table — "Which service do you need?"
Helps a first-time visitor pick. Place immediately after hero so it answers the "what should I start with" question.

```html
<section class="sec sec-white services-compare">
  <div class="sh center" style="margin-bottom:36px;">
    <div class="eyebrow">
      <span lang="en">Where to start</span>
      <span lang="zh">從哪裡開始</span>
    </div>
    <h2>
      <span lang="en">Which service is <em>right for you</em>?</span>
      <span lang="zh">哪項服務 <em>最適合您</em>?</span>
    </h2>
  </div>

  <div class="compare-table-wrap">
    <table class="compare-table">
      <thead>
        <tr>
          <th></th>
          <th>
            <span lang="en">AI Wellness Assessment</span>
            <span lang="zh">AI 體質評估</span>
          </th>
          <th>
            <span lang="en">TCM Consultation</span>
            <span lang="zh">中醫問診</span>
          </th>
          <th>
            <span lang="en">Herb Shop</span>
            <span lang="zh">中藥商店</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th><span lang="en">Best for</span><span lang="zh">適合</span></th>
          <td><span lang="en">Curious about your TCM constitution; first-time TCM exploration</span><span lang="zh">想了解體質；初次接觸中醫</span></td>
          <td><span lang="en">Active health concern; prescription needed; ongoing care</span><span lang="zh">當下健康問題；需要處方；持續調理</span></td>
          <td><span lang="en">Existing prescription refills; over-the-counter herbal supplements</span><span lang="zh">處方續配；非處方草本補充品</span></td>
        </tr>
        <tr>
          <th><span lang="en">Time</span><span lang="zh">時間</span></th>
          <td><span lang="en">5–10 minutes</span><span lang="zh">5–10 分鐘</span></td>
          <td><span lang="en">30–45 minutes</span><span lang="zh">30–45 分鐘</span></td>
          <td><span lang="en">Browse anytime</span><span lang="zh">隨時瀏覽</span></td>
        </tr>
        <tr>
          <th><span lang="en">Practitioner involvement</span><span lang="zh">醫師參與</span></th>
          <td><span lang="en">AI generates report → reviewed by licensed practitioner before you see it</span><span lang="zh">AI 生成報告 → 持牌中醫師審核後呈交</span></td>
          <td><span lang="en">Direct video or in-person session with the practitioner</span><span lang="zh">與中醫師視訊或親診</span></td>
          <td><span lang="en">Pharmacist double-checks every prescription order before dispatch</span><span lang="zh">藥師於出貨前再次核對處方</span></td>
        </tr>
        <tr>
          <th><span lang="en">Output</span><span lang="zh">產出</span></th>
          <td><span lang="en">Wellness insight + practitioner notes</span><span lang="zh">健康洞察 + 醫師批註</span></td>
          <td><span lang="en">Diagnosis + treatment plan + (if needed) prescription</span><span lang="zh">辨證 + 治療方案 + (如需)處方</span></td>
          <td><span lang="en">Herbs delivered to your door</span><span lang="zh">藥材送上門</span></td>
        </tr>
        <tr>
          <th><span lang="en">Pricing</span><span lang="zh">收費</span></th>
          <td><span lang="en">Free (currently)</span><span lang="zh">免費（目前）</span></td>
          <td><span lang="en">[PRICE: TBD] / session</span><span lang="zh">[PRICE: TBD] / 次</span></td>
          <td><span lang="en">From [PRICE: TBD]</span><span lang="zh">[PRICE: TBD] 起</span></td>
        </tr>
      </tbody>
    </table>
  </div>

  <p class="compare-note">
    <span lang="en">Not sure? Start with the free wellness assessment — your practitioner can recommend the next step.</span>
    <span lang="zh">不確定？從免費的體質評估開始，您的中醫師會為您推薦下一步。</span>
  </p>
</section>
```

### 6. Three detailed service sections
One per service. Each section follows the same template: image (left or right alternating) + heading + description + "how it works" + pricing + FAQ + CTA.

#### 6a. AI Wellness Assessment — detail section

```html
<section id="service-wellness" class="sec sec-alt service-detail has-rice-bg">
  <div class="service-detail-inner">
    <div class="service-detail-img">
      <img src="assets/img/service-wellness.webp" alt="A young woman taking a wellness assessment on her phone" loading="lazy" class="fade-in-load" width="1200" height="900">
    </div>
    <div class="service-detail-text">
      <div class="eyebrow">
        <span lang="en">AI Wellness Assessment</span>
        <span lang="zh">AI 體質評估</span>
      </div>
      <h2>
        <span lang="en">Discover your <em>TCM constitution</em></span>
        <span lang="zh">了解您的 <em>體質</em></span>
      </h2>
      <p class="service-lead">
        <span lang="en">Upload a tongue photo or answer a short questionnaire. AI generates a TCM wellness insight, then a licensed practitioner reviews it before it reaches you. Educational guidance, not a medical diagnosis.</span>
        <span lang="zh">拍張舌頭照片或回答簡短問卷。AI 生成中醫體質洞察，再經持牌中醫師審核才呈交給您。健康教育指引，非醫療診斷。</span>
      </p>

      <h3 class="how-h">
        <span lang="en">How it works</span>
        <span lang="zh">流程</span>
      </h3>
      <ol class="how-list">
        <li>
          <span lang="en">Take a tongue photo OR complete a 10-question constitution quiz (your choice — or do both for a fuller picture).</span>
          <span lang="zh">拍一張舌頭照片，或完成 10 題體質問卷（任選其一，或兩者都做以獲得更完整的分析）。</span>
        </li>
        <li>
          <span lang="en">Our AI generates a wellness insight describing your TCM constitution and any patterns it detects.</span>
          <span lang="zh">AI 生成健康洞察，描述您的中醫體質與所觀察到的徵象。</span>
        </li>
        <li>
          <span lang="en">A licensed TCM practitioner reviews the AI output and adds their own clinical notes before publishing it to you.</span>
          <span lang="zh">持牌中醫師審核 AI 報告，加上臨床批註後才呈交給您。</span>
        </li>
        <li>
          <span lang="en">You receive the wellness report in your portal — typically within 24 hours of submission.</span>
          <span lang="zh">您於入口收到健康報告，通常在提交後 24 小時內。</span>
        </li>
      </ol>

      <h3 class="pricing-h">
        <span lang="en">Pricing</span>
        <span lang="zh">收費</span>
      </h3>
      <p class="pricing-line">
        <span lang="en">Free during early access. <span class="pricing-note">Future pricing: [PRICE: TBD] per assessment after [DATE: TBD].</span></span>
        <span lang="zh">早期使用期免費。<span class="pricing-note">未來收費：[PRICE: TBD] / 次（於 [DATE: TBD] 後生效）。</span></span>
      </p>

      <details class="service-faq">
        <summary>
          <span lang="en">Common questions</span>
          <span lang="zh">常見問題</span>
        </summary>

        <div class="faq-item">
          <h4><span lang="en">Is this a medical diagnosis?</span><span lang="zh">這是醫療診斷嗎？</span></h4>
          <p><span lang="en">No. The AI Wellness Assessment is wellness education only — it identifies TCM constitutional patterns. For any clinical diagnosis or treatment, please book a consultation with one of our licensed practitioners.</span><span lang="zh">不是。AI 體質評估僅為健康教育，識別中醫體質徵象。任何臨床診斷或治療，請預約我們的持牌中醫師。</span></p>
        </div>

        <div class="faq-item">
          <h4><span lang="en">How accurate is the AI?</span><span lang="zh">AI 的準確度如何？</span></h4>
          <p><span lang="en">AI provides pattern recognition based on TCM principles. Every report is reviewed by a licensed practitioner before reaching you — they catch errors, adjust language, and add clinical context. The combination is more reliable than either alone.</span><span lang="zh">AI 基於中醫原理進行模式識別。每份報告都經持牌中醫師審核才呈交 —— 醫師會修正錯誤、調整用詞、加入臨床判斷。AI + 醫師的組合比任一單獨使用更可靠。</span></p>
        </div>

        <div class="faq-item">
          <h4><span lang="en">Can I share the report with my Western doctor?</span><span lang="zh">我可以把報告分享給我的西醫嗎？</span></h4>
          <p><span lang="en">Yes — you own your data. You can download the report from your portal as a PDF and share it with any healthcare provider. Note that TCM constitutional patterns don't always map directly to Western diagnostic categories, so additional explanation may help.</span><span lang="zh">可以 —— 您擁有您的資料。您可從入口下載 PDF 並與任何醫療專業人員分享。注意：中醫體質徵象未必對應西醫診斷分類，可能需要額外解釋。</span></p>
        </div>

        <div class="faq-item">
          <h4><span lang="en">What happens to my tongue photo?</span><span lang="zh">我的舌頭照片如何處理？</span></h4>
          <p><span lang="en">Encrypted at rest, processed only for your AI report, never used for marketing or shared with third parties (except the AI provider, Anthropic, which doesn't retain images for training). You can delete the photo from your portal at any time.</span><span lang="zh">資料加密儲存，僅用於生成您的 AI 報告，絕不用於行銷或分享給第三方（除 AI 服務商 Anthropic 外，且 Anthropic 不會保留照片用於訓練）。您可隨時於入口刪除照片。</span></p>
        </div>
      </details>

      <a class="btn-v4 btn-dark service-cta" href="../v2/portal.html#/wellness-assessment">
        <span lang="en">Start free assessment</span>
        <span lang="zh">免費開始評估</span>
      </a>
    </div>
  </div>
</section>
```

#### 6b. TCM Consultations — detail section

Same template, image on the OPPOSITE side (right instead of left) for visual rhythm. Use `service-consultation.webp`.

Content:
- Eyebrow: TCM Consultations · 中醫問診
- Heading: "Sit with a real TCM practitioner · 與真正的中醫師對話"
- Lead: "Video or in-person consultations with licensed TCM practitioners. Pulse, tongue, voice, observation — the four classical methods, applied to your concern. Practitioner can issue herbal prescriptions if needed, dispensed by our partner pharmacy."
- ZH: "視訊或親診中醫問診。望聞問切四診合參，由持牌中醫師依您的情況進行。如需要，醫師可開立中藥處方，由合作藥房調配。"
- How it works (4 steps): book → arrive (video link or clinic) → consultation (45 min) → receive case record + (if applicable) prescription
- Pricing: [PRICE: TBD] per session for video, [PRICE: TBD] for in-person. Follow-up consultations [PRICE: TBD].
- 4 FAQ items:
  - "What's the difference between video and in-person?" — explain pulse-taking limits over video, both work for follow-ups, in-person better for first visit.
  - "How long is a consultation?" — typically 30-45 min for first visit, 20-30 min for follow-ups.
  - "What if I need to cancel?" — refund policy from compliance/terms-of-service.md (>24h full refund, etc.)
  - "Can I bring previous medical reports?" — yes, upload them to your portal before the appointment.
- CTA: "Book a consultation · 預約問診" → portal.html#/book

#### 6c. Herb Shop — detail section

Same template, image on the LEFT side (alternating again). Use `service-shop.webp`.

**IMPORTANT — shop is currently disabled per the existing `shop_enabled` flag.** This section needs to wrap the CTA in the same `[data-home-shop-cta]` two-state pattern from Brief #3 so the CTA shows "Coming Soon" when shop is disabled and "Browse herbs" when enabled. Re-use the existing `.home-shop-cta` CSS.

Content:
- Eyebrow: Herb Shop · 中藥商店
- Heading: "Quality herbs, dispensed with care · 品質藥材 · 用心調配"
- Lead: "Two paths: prescription-linked orders dispensed exactly as your practitioner specified, and over-the-counter herbal supplements for everyday wellness. Both sourced from verified Malaysian and international suppliers."
- ZH: "兩種選擇：依您的醫師處方精確調配的藥方，以及日常養生的非處方草本補充品。皆來自馬來西亞與國際認證供應商。"
- How it works (3 steps): browse OR receive prescription → pharmacist double-checks → delivery to your door (Klang Valley same-day, rest of Malaysia 2-3 days)
- Pricing: Prescription orders priced per ingredient, total shown at checkout. OTC supplements from [PRICE: TBD]. Delivery fees: [INSERT].
- 4 FAQ items:
  - "Are these herbs safe to take with Western medication?" — always tell your practitioner about all medications/supplements; some interactions exist; we flag known ones.
  - "How do I take prescribed herbs?" — instructions on each pouch, video guide in your portal, WhatsApp support if unclear.
  - "How should I store the herbs?" — cool, dry place; specific notes on each prescription.
  - "Can I return herbs?" — dispensed prescriptions cannot be returned for safety reasons; sealed OTC products within 7 days. (From compliance/terms-of-service.md section 9.)
- CTA: two-state per `[data-home-shop-cta]` — "Browse herbs · 瀏覽藥材" when shop_enabled, "Coming Soon · 即將推出" when off.

### 7. Combined "Frequently asked, across services" — short cross-service FAQ
Five questions that span multiple services (not specific to one):

```html
<section class="sec sec-white services-cross-faq">
  <div class="sh center" style="margin-bottom:32px;">
    <div class="eyebrow">
      <span lang="en">Across all services</span>
      <span lang="zh">所有服務通用</span>
    </div>
    <h2>
      <span lang="en">Common <em>questions</em></span>
      <span lang="zh">常見 <em>問題</em></span>
    </h2>
  </div>

  <div class="cross-faq-list">
    <details>
      <summary><span lang="en">Are HansMed practitioners properly licensed?</span><span lang="zh">HansMed 的中醫師都有合法執照嗎？</span></summary>
      <p><span lang="en">Yes — every practitioner on HansMed is registered with Malaysia's Traditional and Complementary Medicine Council (T&CM Council) under the T&CM Act 2016. Licensing is verified before they join the platform and re-checked annually.</span><span lang="zh">是的 —— HansMed 所有中醫師均於馬來西亞傳統與輔助醫藥局（T&CM Council）註冊（依 2016 年 T&CM 法令）。執照在加入平台前驗證，並每年複核。</span></p>
    </details>

    <details>
      <summary><span lang="en">How is my data protected?</span><span lang="zh">我的資料如何受保護？</span></summary>
      <p><span lang="en">Fully PDPA 2010 compliant. Encrypted in transit (HTTPS) and at rest. Explicit consent before any AI processing. You can export or delete your data from your portal at any time. See our <a href="../v2/privacy.html">Privacy Policy</a> for details.</span><span lang="zh">完全符合 2010 年個人資料保護法。傳輸（HTTPS）與儲存皆加密。AI 處理前必須取得明確同意。您可隨時於入口匯出或刪除個人資料。詳見<a href="../v2/privacy.html">隱私政策</a>。</span></p>
    </details>

    <details>
      <summary><span lang="en">Do you accept insurance?</span><span lang="zh">你們接受保險嗎？</span></summary>
      <p><span lang="en">Not yet. We're working on partnerships with major Malaysian insurers. For now, payments are out-of-pocket via Stripe (cards, FPX, e-wallets). You'll receive an itemized invoice for any reimbursement claims.</span><span lang="zh">暫時還沒有。我們正在與馬來西亞主要保險公司洽談合作。目前付款方式為自費，透過 Stripe 支援信用卡、FPX、電子錢包。您將收到明細收據可用於報銷申請。</span></p>
    </details>

    <details>
      <summary><span lang="en">What languages do practitioners speak?</span><span lang="zh">中醫師會說哪些語言？</span></summary>
      <p><span lang="en">Mandarin, Cantonese, Hokkien, English, and Malay. You can specify your preferred language when booking; we match you with a practitioner accordingly.</span><span lang="zh">普通話、廣東話、福建話、英語、馬來語。預約時可指定偏好語言，我們會為您匹配適合的醫師。</span></p>
    </details>

    <details>
      <summary><span lang="en">Where is HansMed based?</span><span lang="zh">HansMed 的地點？</span></summary>
      <p><span lang="en">Our team and partner clinics are in the Klang Valley (Kuala Lumpur and surrounding areas). Video consultations serve patients across Malaysia. Herb delivery covers all of Peninsular Malaysia (East Malaysia coming soon).</span><span lang="zh">我們的團隊與合作診所位於巴生谷（吉隆坡及周邊）。視訊問診服務馬來西亞全境患者。藥材配送涵蓋西馬全境（東馬即將推出）。</span></p>
    </details>
  </div>
</section>
```

### 8. CTA section — "Ready to begin?"
Same dark CTA section as v3/about.html, two buttons (Book / Try Wellness Assessment).

### 9. Footer
Copy from v3/about.html / v3/index.html exactly. Page links resolve to v2/* via existing pattern.

### 10. Inline scripts at bottom
Same set as v3/about.html:
- All shared v2 scripts (config, api, auth, etc.)
- `about-dropdown.js` (don't forget!)
- Lenis (with desktop-only guard)
- IntersectionObserver scroll-reveal observer (still runs but reveals neutralized via CSS)
- Image fade-in handler
- DO NOT include hero parallax (services hero is shorter, doesn't need it)

## CSS additions to `v3/assets/css/visual-upgrade.css`

Add a new section at the bottom for services-page styles. Key new classes:

```css
/* ════════════ Brief #10 — Services page ═══════════════════════════ */

body.landing-v4 .services-hero { min-height: 60vh; }

/* Comparison table */
body.landing-v4 .services-compare {
  padding: clamp(56px, 7vw, 96px) 24px;
}
body.landing-v4 .compare-table-wrap {
  max-width: 1100px; margin: 0 auto; overflow-x: auto;
}
body.landing-v4 .compare-table {
  width: 100%; border-collapse: collapse;
  font-family: 'DM Sans', sans-serif; font-size: 14px;
  background: var(--v4-bg-2);
  border-radius: 14px; overflow: hidden;
}
body.landing-v4 .compare-table th,
body.landing-v4 .compare-table td {
  padding: 18px 16px; text-align: left; vertical-align: top;
  border-bottom: 1px solid var(--v4-bdr-l);
  line-height: 1.55;
}
body.landing-v4 .compare-table thead th {
  background: var(--v4-bg-3);
  font-family: 'Cormorant Garamond', serif; font-style: italic;
  font-size: 18px; font-weight: 500; color: var(--v4-ink);
}
body.landing-v4 .compare-table tbody th {
  font-family: 'DM Sans', sans-serif; font-weight: 500;
  text-transform: uppercase; letter-spacing: 0.06em;
  font-size: 11px; color: var(--v4-mu);
  width: 22%;
}
body.landing-v4 .compare-table tbody td { color: var(--v4-mu); font-weight: 300; }
body.landing-v4 .compare-table tbody tr:last-child th,
body.landing-v4 .compare-table tbody tr:last-child td { border-bottom: none; }
body.landing-v4 .compare-note {
  max-width: 680px; margin: 28px auto 0; text-align: center;
  font-size: 14px; color: var(--v4-mu); font-style: italic; font-weight: 300;
}
@media (max-width: 768px) {
  body.landing-v4 .compare-table { font-size: 12px; }
  body.landing-v4 .compare-table th, body.landing-v4 .compare-table td { padding: 12px 10px; }
}

/* Service detail sections */
body.landing-v4 .service-detail { padding: clamp(64px, 8vw, 112px) 24px; }
body.landing-v4 .service-detail-inner {
  display: grid; grid-template-columns: 1fr 1.1fr; gap: 64px;
  align-items: start; max-width: 1100px; margin: 0 auto;
}
body.landing-v4 .service-detail:nth-of-type(even) .service-detail-inner {
  /* image on right for alternating rhythm */
  grid-template-columns: 1.1fr 1fr;
}
body.landing-v4 .service-detail:nth-of-type(even) .service-detail-img { order: 2; }
body.landing-v4 .service-detail:nth-of-type(even) .service-detail-text { order: 1; }
body.landing-v4 .service-detail-img {
  aspect-ratio: 4 / 3; overflow: hidden; border-radius: 16px;
  background: var(--v4-bg-3); position: sticky; top: 96px;
}
body.landing-v4 .service-detail-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
body.landing-v4 .service-detail-text h2 {
  font-family: 'Cormorant Garamond', serif; font-size: clamp(28px, 3.5vw, 38px);
  font-weight: 400; letter-spacing: -0.02em; color: var(--v4-ink); margin: 0 0 18px;
}
body.landing-v4 .service-detail-text h2 em { font-style: italic; color: var(--v4-wd-md); }
body.landing-v4 .service-lead { font-size: 16px; line-height: 1.78; color: var(--v4-mu); font-weight: 300; margin: 0 0 32px; }
body.landing-v4 .service-detail .how-h,
body.landing-v4 .service-detail .pricing-h {
  font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.12em; color: var(--v4-tc);
  margin: 28px 0 14px;
}
body.landing-v4 .how-list {
  list-style: none; padding: 0; margin: 0 0 28px;
  counter-reset: how-step;
}
body.landing-v4 .how-list li {
  counter-increment: how-step; padding: 14px 0 14px 44px; position: relative;
  border-top: 1px solid var(--v4-bdr-l);
  font-size: 14px; line-height: 1.7; color: var(--v4-mu); font-weight: 300;
}
body.landing-v4 .how-list li:last-child { border-bottom: 1px solid var(--v4-bdr-l); }
body.landing-v4 .how-list li::before {
  content: counter(how-step, decimal-leading-zero);
  position: absolute; left: 0; top: 14px;
  font-family: 'Cormorant Garamond', serif; font-style: italic;
  font-size: 18px; color: var(--v4-go); font-weight: 500;
}
body.landing-v4 .pricing-line { font-size: 15px; color: var(--v4-ink); margin: 0 0 28px; font-weight: 400; }
body.landing-v4 .pricing-line .pricing-note { display: block; font-size: 12px; color: var(--v4-mu); margin-top: 4px; font-weight: 300; font-style: italic; }
body.landing-v4 .service-faq { margin-bottom: 28px; }
body.landing-v4 .service-faq summary {
  cursor: pointer; padding: 14px 0;
  font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
  color: var(--v4-tc); text-transform: uppercase; letter-spacing: 0.08em;
  border-top: 1px solid var(--v4-bdr-l);
  list-style: none;
}
body.landing-v4 .service-faq summary::after {
  content: '+'; float: right; font-size: 18px; color: var(--v4-go); transition: transform 0.2s;
}
body.landing-v4 .service-faq[open] summary::after { content: '−'; }
body.landing-v4 .faq-item { padding: 16px 0; border-top: 1px solid var(--v4-bdr-l); }
body.landing-v4 .faq-item h4 { font-family: 'Cormorant Garamond', serif; font-size: 18px; font-weight: 500; color: var(--v4-ink); margin: 0 0 6px; }
body.landing-v4 .faq-item p { font-size: 14px; line-height: 1.7; color: var(--v4-mu); font-weight: 300; margin: 0; }
body.landing-v4 .service-cta { margin-top: 8px; }

@media (max-width: 768px) {
  body.landing-v4 .service-detail-inner,
  body.landing-v4 .service-detail:nth-of-type(even) .service-detail-inner {
    grid-template-columns: 1fr; gap: 32px;
  }
  body.landing-v4 .service-detail-img { position: static; }
  body.landing-v4 .service-detail:nth-of-type(even) .service-detail-img { order: 1; }
  body.landing-v4 .service-detail:nth-of-type(even) .service-detail-text { order: 2; }
}

/* Cross-service FAQ */
body.landing-v4 .services-cross-faq { padding: clamp(56px, 7vw, 96px) 24px; }
body.landing-v4 .cross-faq-list { max-width: 800px; margin: 0 auto; }
body.landing-v4 .cross-faq-list details {
  border-top: 1px solid var(--v4-bdr-l); padding: 18px 0;
}
body.landing-v4 .cross-faq-list details:last-child { border-bottom: 1px solid var(--v4-bdr-l); }
body.landing-v4 .cross-faq-list summary {
  cursor: pointer; font-family: 'Cormorant Garamond', serif;
  font-size: 19px; font-weight: 500; color: var(--v4-ink);
  list-style: none; padding-right: 32px; position: relative;
}
body.landing-v4 .cross-faq-list summary::after {
  content: '+'; position: absolute; right: 0; top: 0;
  font-size: 22px; color: var(--v4-go); transition: transform 0.2s;
}
body.landing-v4 .cross-faq-list details[open] summary::after { content: '−'; }
body.landing-v4 .cross-faq-list details p {
  font-size: 14px; line-height: 1.78; color: var(--v4-mu); font-weight: 300;
  margin: 12px 0 0;
}
```

## ACCEPTANCE CRITERIA

- New file `v3/services.html` renders cleanly at `hansmedtcm.github.io/Hansmed-system/v3/services.html`.
- Preview banner with link back to `../v2/services.html`.
- Hero with `hero-bg.webp` background + gradient overlay (60vh height).
- Comparison table renders cleanly on desktop AND mobile (table scrolls horizontally on narrow screens).
- Three detail sections render with alternating image left/right pattern on desktop. Each has: lead description, "how it works" 3-4 step list, pricing line with `[PRICE: TBD]` placeholders, expandable per-service FAQ (4 items each), CTA button.
- Herb Shop section's CTA uses the `[data-home-shop-cta]` two-state pattern so it shows "Coming Soon" when shop is disabled.
- Cross-service FAQ section with 5 expandable questions.
- Bottom CTA section with two buttons (Book / Try Assessment).
- Footer matches v3/index.html and v3/about.html exactly.
- All bilingual via `<span lang>` pattern.
- Nav has Services dropdown item marked `is-current`; About link still goes to `about.html` (v3); Practitioners link still goes to `../v2/practitioners.html` (v3 not built yet).
- WebP imagery only — no PNGs.
- Lenis smooth scroll on desktop, native scroll on mobile/touch.
- Reveals neutralized (no animation, content visible immediately).
- `about-dropdown.js` script included (verify About nav button works).
- Mobile (≤768px) layout stacks cleanly.
- v2/services.html NOT modified.
- v3/index.html NOT modified.

## REPORT BACK

```
Files created: v3/services.html
Files modified: v3/assets/css/visual-upgrade.css (added services-page styles)
Pushed to: [commit hash]
Hero: [yes/no]
Comparison table renders responsively: [yes/no]
Three detail sections with alternating image position: [yes/no]
Per-service FAQ (4 items each) collapsible: [yes/no]
Herb Shop CTA two-state (Coming Soon when shop_disabled): [yes/no]
Cross-service FAQ (5 items) collapsible: [yes/no]
Bottom dark CTA section: [yes/no]
about-dropdown.js included: [yes/no]
Bilingual rendering confirmed: [yes/no]
Mobile layout (≤768px) stacks cleanly: [yes/no]
v2/ files touched: [should be 'none']
v3/index.html touched: [should be 'none']
PRICE / DATE placeholders left as-is for user to fill in: [yes/no — list the exact placeholders inserted]
Anything left as TODO: [list]
```

If during implementation a copy line reads awkwardly in either language, polish lightly within the established tone. The only things you must NOT change without asking: the brand spine line, founder voice in the about page, TCM technical content (e.g., "望聞問切" — these are canonical TCM terms).
