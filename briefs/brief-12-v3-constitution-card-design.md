# Brief #12 — Constitution Card design preview (Phase 1 of freemium AI Wellness)

**Classification: DESIGN / CONTENT — scope: NEW file `v3/wellness-card-preview.html` (standalone visual demo). Does NOT modify the existing patient-portal AI Wellness flow yet. Brief #13 will wire the approved design into the real assessment.**

## Background

CEO has approved the freemium strategy for AI Wellness Assessment:
- **Free tier:** beautiful "constitution card" — type name, 1-paragraph description, 3 wellness tips, shareable + PDF-exportable. NO practitioner review (clearly labeled "AI wellness insight, not medical diagnosis"). The marketing-driven top of funnel.
- **Paid tier (later, Brief #13):** full multi-page report with food/lifestyle/herb specifics + practitioner-reviewed clinical notes. Bundled with consultation OR standalone purchase.

Visual direction:
- **Style:** luxury editorial + traditional Chinese hybrid. Aesop-meets-Eslite — refined typography, generous negative space, premium materials feel, NOT MBTI-playful or fun-quiz vibes.
- **Constitution typology:** Wang Qi 9-constitution standard (王琦中医体质分类).
- **Email capture:** at the end of the assessment, before showing the result. (Not relevant to this brief — Brief #13.)

This brief builds the visual design as a standalone preview so you can review and refine before we touch the live assessment flow. After approval, Brief #13 integrates into `portal.html#/wellness-assessment`.

## TASK — Build `v3/wellness-card-preview.html`

A single page that demos all 9 constitution cards as static visual examples. CEO reviews the design, asks for refinements, signs off. No real assessment data — hardcoded sample content per card.

### 1. Page structure (top to bottom)

- Standard v3 head + preview banner + nav (copy from `v3/about.html`)
- Hero block at top of page:
  - Eyebrow: "Design preview · 設計預覽"
  - Heading: "Your TCM constitution, beautifully rendered · 您的中醫體質 · 優雅呈現"
  - Subhead: "Nine cards, one per Wang Qi constitution type. This is the free-tier output users see after taking the AI Wellness Assessment. Review the design, then we wire it into the real flow."
- A grid showing all 9 constitution cards rendered side-by-side (3-column on desktop, 1-column on mobile)
- A "card detail" section below that shows ONE card at full intended display size (1080×1350px portrait, scaled to fit viewport) so the design is reviewable at the share-export size
- Footer copied from `v3/about.html`

### 2. The Constitution Card — visual specification

Each card is a self-contained visual unit, designed as a 1080×1350px portrait (Instagram story ratio). Same template, parameterized per type. Layout:

```
┌─────────────────────────────────┐
│ HansMed seal mark · top left    │ ← brand strip
│                                 │
│           平 和                  │ ← LARGE Chinese type characters
│        Píng Hé                  │ ← Pinyin (Cormorant italic)
│        Balanced                 │ ← English
│                                 │
│   ─────────────                 │ ← gold accent rule
│                                 │
│   "Quiet steadiness."           │ ← essence line (italic)
│                                 │
│   (decorative element —         │ ← element/seal/brushstroke
│    type-specific glyph)         │
│                                 │
│   Key characteristics           │ ← small label
│   · Even temperament            │ ← 3 bullets
│   · Strong adaptive capacity    │
│   · Restful sleep               │
│                                 │
│   Tendency                      │ ← small label
│   "Maintain balance through     │ ← 1-line tendency
│    seasonal adjustment."        │
│                                 │
│   Three gentle starts           │ ← small label
│   · Drink warm water mornings   │ ← 3 wellness tips
│   · Walk after meals            │
│   · Sleep before 11 PM          │
│                                 │
│  ─────────────                  │ ← bottom rule
│  hansmed.my · AI Wellness       │ ← footer + URL
└─────────────────────────────────┘
```

### 3. Per-type visual identity

Each of the 9 types has its own subtle color accent and decorative glyph. Use the existing v3 palette — these are **secondary accents on top of cream/ink**, NOT primary background colors. The card is always cream-bg + ink-text + ONE accent color per type.

| # | Type (CN · Pinyin · EN) | Accent color (hex) | Decorative glyph (use SVG) | Essence line (EN) | Essence (ZH) |
|---|---|---|---|---|---|
| 1 | 平和質 · Píng Hé · Balanced | `#B5881A` (gold) | A simple yin-yang circle | Quiet steadiness. | 安穩平衡。 |
| 2 | 氣虛質 · Qì Xū · Qi Deficient | `#C7B98F` (soft beige) | A wisp of rising steam (3 curved lines) | Energy seeks rest. | 元氣需養。 |
| 3 | 陽虛質 · Yáng Xū · Yang Deficient | `#7A8FA6` (muted slate) | A small flame, low and quiet | Warmth wants kindling. | 陽氣須溫。 |
| 4 | 陰虛質 · Yīn Xū · Yin Deficient | `#C97B5C` (dusty terracotta) | A water droplet | Inner moisture is precious. | 陰液宜潤。 |
| 5 | 痰濕質 · Tán Shī · Phlegm-Damp | `#9A7A4B` (clay brown) | A spiral cloud | Channels need clearing. | 通達需理。 |
| 6 | 濕熱質 · Shī Rè · Damp-Heat | `#C45A2E` (burnt orange) | A flame within a droplet | Cool and clear. | 清熱化濕。 |
| 7 | 血瘀質 · Xuè Yū · Blood Stasis | `#7A2E3D` (deep maroon) | A flowing line that breaks and resumes | Movement restores flow. | 通則不痛。 |
| 8 | 氣鬱質 · Qì Yù · Qi Stagnation | `#5C7A5B` (sage green) | A bird in flight (simple silhouette) | Breath softens tension. | 疏肝解鬱。 |
| 9 | 特稟質 · Tè Bǐng · Special | `#8C8C9E` (neutral grey) | A single delicate leaf | Sensitivity asks for care. | 敏感需護。 |

For each glyph, use a **simple inline SVG** (15-25 lines). Don't require external image files. Render at ~72×72px, gold-or-accent-stroke, no fill.

### 4. Per-type content (full sample data)

Use this exact content for the 9 cards. Don't translate or rewrite — these are reviewed defaults. The user can refine before Phase 2 ships.

**Card 1 — 平和質 Píng Hé · Balanced**
- Essence: "Quiet steadiness. · 安穩平衡。"
- Characteristics:
  - EN: Even temperament · Strong adaptive capacity · Restful sleep
  - ZH: 性情平和 · 適應力強 · 睡眠安穩
- Tendency: "Maintain balance through seasonal adjustment. · 隨四季而調，穩中有變。"
- 3 gentle starts:
  - EN: Drink warm water in the morning · Walk after meals · Sleep before 11 PM
  - ZH: 晨起溫水 · 餐後散步 · 亥時前入睡

**Card 2 — 氣虛質 Qì Xū · Qi Deficient**
- Essence: "Energy seeks rest. · 元氣需養。"
- Characteristics:
  - EN: Easy fatigue · Soft voice · Spontaneous sweating
  - ZH: 易疲勞 · 聲音低弱 · 易自汗
- Tendency: "Avoid overexertion; restore through quiet, warm meals and steady rhythm. · 忌過勞，宜溫食緩動。"
- 3 gentle starts:
  - EN: Eat warm rice porridge for breakfast · Take 8-hour rests · Avoid raw cold foods
  - ZH: 早餐溫粥 · 充足睡眠八小時 · 避生冷

**Card 3 — 陽虛質 Yáng Xū · Yang Deficient**
- Essence: "Warmth wants kindling. · 陽氣須溫。"
- Characteristics:
  - EN: Cold extremities · Pale complexion · Aversion to cold
  - ZH: 手足偏冷 · 面色蒼白 · 畏寒怕冷
- Tendency: "Build inner warmth through cooked food, gentle movement, and morning sun. · 溫養為要，得日光則安。"
- 3 gentle starts:
  - EN: Ginger and red date tea · Sun exposure 15 minutes daily · Cooked vegetables, no salads
  - ZH: 薑棗茶 · 每日曬太陽十五分鐘 · 熟食為主

**Card 4 — 陰虛質 Yīn Xū · Yin Deficient**
- Essence: "Inner moisture is precious. · 陰液宜潤。"
- Characteristics:
  - EN: Dry mouth and throat · Hot palms and soles · Restless sleep
  - ZH: 口乾咽燥 · 手足心熱 · 睡眠不安
- Tendency: "Nourish yin with cooling, hydrating foods and quiet evenings. · 滋陰潤燥，靜以養之。"
- 3 gentle starts:
  - EN: Pear and white fungus soup · Avoid spicy foods · Sleep early to nourish yin
  - ZH: 雪梨銀耳湯 · 忌辛辣 · 早睡養陰

**Card 5 — 痰濕質 Tán Shī · Phlegm-Damp**
- Essence: "Channels need clearing. · 通達需理。"
- Characteristics:
  - EN: Heavy limbs · Greasy skin and tongue coating · Easy weight gain
  - ZH: 肢體沉重 · 面油苔膩 · 易胖
- Tendency: "Move daily; eat lightly. Damp dissolves with warmth and movement. · 動則濕散，輕食為宜。"
- 3 gentle starts:
  - EN: 30-minute walk after dinner · Reduce dairy and fried food · Job's tears (薏仁) congee
  - ZH: 飯後散步三十分鐘 · 少奶製、少油炸 · 薏仁粥

**Card 6 — 濕熱質 Shī Rè · Damp-Heat**
- Essence: "Cool and clear. · 清熱化濕。"
- Characteristics:
  - EN: Yellow tongue coating · Acne or oily skin · Bitter taste in mouth
  - ZH: 苔黃膩 · 易長痘油皮 · 口苦
- Tendency: "Cool the system; reduce alcohol, fried, and rich foods. · 清淡為主，忌酒忌油膩。"
- 3 gentle starts:
  - EN: Mung bean and lily soup · Reduce coffee and alcohol · Sleep before midnight
  - ZH: 綠豆百合湯 · 少咖啡少酒 · 子時前入睡

**Card 7 — 血瘀質 Xuè Yū · Blood Stasis**
- Essence: "Movement restores flow. · 通則不痛。"
- Characteristics:
  - EN: Dark complexion patches · Dull menstrual pain (if applicable) · Cold extremities with purple-tinged tongue
  - ZH: 面有暗斑 · 經期暗痛（若適用）· 手足冷、舌偏紫
- Tendency: "Stagnation needs movement and warmth. Stretch, walk, breathe. · 動而疏之，溫以行之。"
- 3 gentle starts:
  - EN: Daily 20-minute walk · Hawthorn and brown sugar tea · Warm baths in the evening
  - ZH: 每日散步二十分鐘 · 山楂紅糖茶 · 晚間溫浴

**Card 8 — 氣鬱質 Qì Yù · Qi Stagnation**
- Essence: "Breath softens tension. · 疏肝解鬱。"
- Characteristics:
  - EN: Frequent sighing · Tight chest · Mood swings, sleep difficulty
  - ZH: 經常嘆息 · 胸悶 · 情緒起伏、難入睡
- Tendency: "Move the qi through walking, breathing, and gentle conversation. · 疏氣於行走、呼吸、傾訴之間。"
- 3 gentle starts:
  - EN: Breathing exercise 5 minutes morning and evening · Rose tea (玫瑰茶) · Walk in nature once a week
  - ZH: 早晚呼吸練習五分鐘 · 玫瑰茶 · 每週親近自然一次

**Card 9 — 特稟質 Tè Bǐng · Special / Allergic-prone**
- Essence: "Sensitivity asks for care. · 敏感需護。"
- Characteristics:
  - EN: Easy allergies · Skin reactions to seasonal changes · Sensitive to certain foods
  - ZH: 易過敏 · 換季易皮膚反應 · 對特定食物敏感
- Tendency: "Avoid known triggers; build constitution slowly with warming, gentle foods. · 避開已知過敏源，溫養為要。"
- 3 gentle starts:
  - EN: Keep an allergy diary · Avoid known triggers · Astragalus (黃耆) tea (consult practitioner first)
  - ZH: 紀錄過敏反應 · 避開已知過敏源 · 黃耆茶（請先諮詢中醫師）

### 5. CSS for the constitution card

Add a new section to `v3/assets/css/visual-upgrade.css`. The card uses CSS custom properties for the per-type accent color so all 9 cards share one stylesheet, parameterized.

```css
/* ════════════ Brief #12 — Constitution Card ══════════════════════ */

body.landing-v4 .wellness-card {
  /* Default accent — overridden per type via inline style or class */
  --card-accent: #B5881A;

  width: 100%;
  max-width: 360px;
  aspect-ratio: 4 / 5;     /* matches 1080×1350 share format */
  background:
    /* subtle paper texture overlay */
    url('assets/img/texture-rice-paper.webp'),
    var(--v4-bg);
  background-size: cover;
  background-blend-mode: multiply;
  border: 1px solid var(--v4-bdr-l);
  border-radius: 18px;
  box-shadow: 0 12px 36px rgba(36, 22, 8, 0.06);
  padding: 36px 32px 28px;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  font-family: 'DM Sans', sans-serif;
  color: var(--v4-ink);
}

/* Top brand strip */
body.landing-v4 .wellness-card-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-size: 13px;
  color: var(--card-accent);
  margin-bottom: 28px;
}
body.landing-v4 .wellness-card-brand-mark {
  font-family: 'Noto Serif SC', serif;
  font-style: normal;
  font-weight: 500;
  font-size: 16px;
}

/* Type characters — large, calligraphic */
body.landing-v4 .wellness-card-type-zh {
  font-family: 'Noto Serif SC', serif;
  font-size: 76px;
  font-weight: 400;
  line-height: 1;
  color: var(--v4-ink);
  letter-spacing: 0.08em;
  margin-bottom: 12px;
  text-align: center;
}
body.landing-v4 .wellness-card-type-pinyin {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-size: 22px;
  color: var(--card-accent);
  text-align: center;
  margin-bottom: 4px;
}
body.landing-v4 .wellness-card-type-en {
  font-family: 'Cormorant Garamond', serif;
  font-size: 18px;
  color: var(--v4-mu);
  text-align: center;
  margin-bottom: 22px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* Gold rule */
body.landing-v4 .wellness-card-rule {
  width: 60px;
  height: 1px;
  background: var(--card-accent);
  margin: 0 auto 22px;
}

/* Essence line */
body.landing-v4 .wellness-card-essence {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-size: 19px;
  color: var(--v4-ink);
  text-align: center;
  margin-bottom: 18px;
  line-height: 1.4;
}
body.landing-v4 .wellness-card-essence span[lang="zh"] {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-style: normal;
  font-size: 16px;
  color: var(--v4-mu);
  margin-top: 4px;
}

/* Decorative SVG glyph */
body.landing-v4 .wellness-card-glyph {
  width: 72px;
  height: 72px;
  margin: 0 auto 26px;
  color: var(--card-accent);
  opacity: 0.85;
}
body.landing-v4 .wellness-card-glyph svg { width: 100%; height: 100%; }

/* Per-section labels */
body.landing-v4 .wellness-card-label {
  font-family: 'DM Sans', sans-serif;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--card-accent);
  margin-bottom: 8px;
  font-weight: 500;
}

/* Bullet lists */
body.landing-v4 .wellness-card-list {
  list-style: none;
  padding: 0;
  margin: 0 0 18px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--v4-ink);
  font-weight: 300;
}
body.landing-v4 .wellness-card-list li {
  padding-left: 14px;
  position: relative;
}
body.landing-v4 .wellness-card-list li::before {
  content: '·';
  position: absolute;
  left: 0;
  color: var(--card-accent);
  font-size: 16px;
  font-weight: 600;
}
body.landing-v4 .wellness-card-list span[lang="zh"] {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-size: 12px;
  color: var(--v4-mu);
}

/* Tendency block — italic single line */
body.landing-v4 .wellness-card-tendency {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-size: 14px;
  color: var(--v4-mu);
  margin-bottom: 18px;
  line-height: 1.5;
}
body.landing-v4 .wellness-card-tendency span[lang="zh"] {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-style: normal;
  font-size: 13px;
  margin-top: 4px;
}

/* Footer rule + URL */
body.landing-v4 .wellness-card-footer {
  margin-top: auto;
  padding-top: 18px;
  border-top: 1px solid rgba(0,0,0,0.06);
  font-family: 'DM Sans', sans-serif;
  font-size: 10px;
  color: var(--v4-mu);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  text-align: center;
}

/* Grid view of all 9 cards */
body.landing-v4 .wellness-cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 28px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}
@media (max-width: 1024px) {
  body.landing-v4 .wellness-cards-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  body.landing-v4 .wellness-cards-grid { grid-template-columns: 1fr; max-width: 380px; }
}

/* "Detail" view — single card at full intended display size */
body.landing-v4 .wellness-card-detail-wrap {
  max-width: 540px;
  margin: 64px auto 0;
  padding: 0 24px;
  text-align: center;
}
body.landing-v4 .wellness-card-detail-wrap .wellness-card {
  max-width: 100%;
}
```

### 6. Sample card markup (for the FIRST type — Píng Hé / Balanced)

Use this exact structure, parameterized per type for the other 8:

```html
<div class="wellness-card" style="--card-accent: #B5881A;">
  <div class="wellness-card-brand">
    <span class="wellness-card-brand-mark">漢方</span>
    <span>HansMed Modern TCM</span>
  </div>

  <div class="wellness-card-type-zh">平和</div>
  <div class="wellness-card-type-pinyin">Píng Hé</div>
  <div class="wellness-card-type-en">Balanced</div>

  <div class="wellness-card-rule"></div>

  <div class="wellness-card-essence">
    <span lang="en">"Quiet steadiness."</span>
    <span lang="zh">「安穩平衡。」</span>
  </div>

  <div class="wellness-card-glyph" aria-hidden="true">
    <!-- yin-yang glyph (24-line SVG) — gold stroke, no fill -->
    <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.2">
      <circle cx="36" cy="36" r="30"/>
      <path d="M36 6 a15 15 0 0 1 0 30 a15 15 0 0 0 0 30 a30 30 0 0 1 0 -60 z" fill="currentColor" fill-opacity="0.18" stroke="none"/>
      <circle cx="36" cy="21" r="3" fill="currentColor"/>
      <circle cx="36" cy="51" r="3" fill="currentColor" fill-opacity="0.4"/>
    </svg>
  </div>

  <div class="wellness-card-label">
    <span lang="en">Key characteristics</span>
    <span lang="zh">主要特徵</span>
  </div>
  <ul class="wellness-card-list">
    <li><span lang="en">Even temperament</span><span lang="zh">性情平和</span></li>
    <li><span lang="en">Strong adaptive capacity</span><span lang="zh">適應力強</span></li>
    <li><span lang="en">Restful sleep</span><span lang="zh">睡眠安穩</span></li>
  </ul>

  <div class="wellness-card-label">
    <span lang="en">Tendency</span>
    <span lang="zh">傾向</span>
  </div>
  <p class="wellness-card-tendency">
    <span lang="en">"Maintain balance through seasonal adjustment."</span>
    <span lang="zh">「隨四季而調，穩中有變。」</span>
  </p>

  <div class="wellness-card-label">
    <span lang="en">Three gentle starts</span>
    <span lang="zh">三個溫柔的開始</span>
  </div>
  <ul class="wellness-card-list">
    <li><span lang="en">Drink warm water in the morning</span><span lang="zh">晨起溫水</span></li>
    <li><span lang="en">Walk after meals</span><span lang="zh">餐後散步</span></li>
    <li><span lang="en">Sleep before 11 PM</span><span lang="zh">亥時前入睡</span></li>
  </ul>

  <div class="wellness-card-footer">
    hansmedtcm.github.io · AI Wellness · 體質評估
  </div>
</div>
```

For each of the other 8 types, copy this template and parameterize: `--card-accent`, ZH/Pinyin/EN type names, essence line (both langs), glyph SVG, characteristics list, tendency text, three gentle starts list. All content from section 4 above.

For the 8 other glyphs: spec the geometry briefly in code comments — small inline SVGs, currentColor stroke, ~72px square. Use simple shapes (steam wisp = 3 curved lines; flame = teardrop with peak; water droplet = teardrop; etc.). Don't over-engineer; keep them iconic and minimal.

## ACCEPTANCE CRITERIA

- New file `v3/wellness-card-preview.html` exists and renders cleanly at `hansmedtcm.github.io/Hansmed-system/v3/wellness-card-preview.html`.
- Standard v3 nav + preview banner + footer.
- Page hero explains: this is the design preview for the free constitution card.
- Grid view shows all 9 cards (3-col desktop, 2-col tablet, 1-col mobile).
- Detail view shows ONE card (Card #1, Píng Hé) at full intended display size below the grid.
- Each card uses the per-type accent color from the table in section 3.
- Each card has its decorative glyph rendered as inline SVG (no external images).
- Each card displays bilingual content via the existing `<span lang>` pattern.
- Card layout matches the visual spec (brand strip → big ZH characters → pinyin → EN → rule → essence → glyph → characteristics → tendency → three gentle starts → footer).
- Rice-paper texture is subtly visible as card background (multiply blend at low opacity).
- Mobile (≤640px): cards stack to 1 column; layout still readable.
- v2/ files NOT modified.
- v3/index.html, v3/about.html, v3/services.html, v3/practitioners.html NOT modified.
- `about-dropdown.js` script included.

## REPORT BACK

```
Files created: v3/wellness-card-preview.html
Files modified: v3/assets/css/visual-upgrade.css (added Brief #12 wellness-card styles)
Pushed to: [commit hash]
All 9 cards render in grid: [yes/no]
Detail view of card #1 at full size: [yes/no]
Per-type accent colors applied: [yes/no — list any not visually distinct enough]
SVG glyphs rendered for all 9 types: [yes/no — list any that look weak / need redo]
Bilingual rendering on every card: [yes/no]
Rice-paper texture subtly visible: [yes/no]
Mobile (≤640px) cards stack cleanly: [yes/no]
v2/ touched: [should be 'none']
Other v3 pages touched: [should be 'none']
Anything you noticed that needs CEO attention: [list]
```

After this ships, CEO reviews the design. If approved, Brief #13 wires it into the real assessment flow + builds the paid full report + adds payment integration. If the design needs refinement, we iterate on this preview page first.

If during implementation a glyph design genuinely doesn't work in 72×72 SVG, simplify to an even more minimal mark (a single circle, a single brushstroke). Don't draw something that looks weak or amateur — better to be MORE minimal.
