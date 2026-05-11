# Brief #4 — Homepage refactor: warm + wellness-led, preserving existing content

## Background

Business advisor reviewed the current public landing pages and flagged four issues:
1. Site reads like a tool for *existing* patients, not for prospective customers.
2. Information architecture is fragmented — no clear "what is HansMed in 5 seconds."
3. Target audience unclear — feels too doctor-/product-centric.
4. No human warmth — feels mechanical, like a booking system rather than a healthcare relationship.

User has approved direction: refactor the homepage with **warmer, patient-centric copy** AND **lead with the AI Wellness Assessment** as the primary entry point. Critical constraint: **do NOT delete existing content** — reorder, rewrite copy in place, add new sections. Preserve the existing visual aesthetic (Cormorant Garamond, Noto Serif SC, warm palette, traditional motifs).

User has provided the brand spine — use it verbatim or near-verbatim:

> 现代化的科技平台，
> 传统式的中医智慧，
> 造就了现代与传统不再有代沟。

> Modern technology platform,
> Traditional TCM wisdom,
> Bridging the generation gap between modern and traditional.

User's "why" statement (paraphrase or quote selectively):

> 为了方便大众在忙碌的生活节奏中可以安心看上合格中医。我们利用了AI科技平台让中医师不需要为了繁杂的手续而耽误了专心看病治病。

Translated: To make it easy for everyone to see qualified TCM doctors with peace of mind, even in a busy life. We use AI to free our practitioners from administrative burden so they can focus on diagnosis and treatment.

**Practitioner constraint:** the user does NOT yet have practitioner photos, bios, or video intros. Any "Our Practitioners" section must be a structural placeholder — visually present, with a "Profiles coming soon · 即将推出" treatment, NOT a hero element with empty cards.

## TASK — Refactor `v2/index.html` only

(About / Services / Practitioners / Contact / FAQ / Blog pages stay as-is for now — they're the next round.)

### New structural order (top to bottom)

Keep every existing section. Reorder + add:

1. **Nav** — unchanged.
2. **NEW: Hero** — replace current hero. Brand spine line as the main heading, with founder-voice subtitle. Single primary CTA: *"Try the Wellness Assessment · 试一试体质评估"* (free, 5 min). Secondary text-link CTA: *"Or book a consultation · 或预约问诊"*.
3. **NEW: Brand story (1 short section)** — 2-3 sentences in the founder's voice (adapted from their statement). Honest, warm, no marketing fluff.
4. **REORDERED: Our Services** — same three cards (AI Wellness, Consultations, Herb Shop), but reorder to put **AI Wellness Assessment first**, Consultations second, Herb Shop third. Rewrite each card's copy to be patient-centric (see copy below).
5. **NEW: How it works (3 steps)** — for a brand-new visitor who has never heard of TCM telemedicine. Three icon + label + 1-sentence cards. "1. Discover your constitution → 2. Talk to a licensed practitioner → 3. Get a personalised plan or prescription."
6. **NEW: Our Practitioners — placeholder block** — Card row with "Licensed by Malaysia's T&CM Council · 马来西亚卫生部 T&CM 局注册" trust line, plus 2-3 placeholder cards reading "Practitioner profile coming soon · 医师介绍即将推出." Subtle, doesn't need to be the hero — but it acknowledges the question "who are these doctors?" for skeptical visitors.
7. **NEW: What patients say — placeholder** — heading "What patients say · 患者反馈". Single muted block: "Real stories coming soon. We're collecting permission to share." Just architecture for later.
8. **EXISTING: Explore section** — keep as is.
9. **EXISTING: Footer** — keep as is.

### Copy specifics

Use these exact strings (English + 中文 inline span pattern, matching the rest of the site).

**Hero — replace current hero block:**

```
Eyebrow:    HansMed Modern TCM · 汉方现代中医

Headline (3-line stack, large Cormorant + Noto Serif SC):
  现代化的科技平台
  传统式的中医智慧
  现代与传统不再有代沟

Subhead (single line in DM Sans, muted, lighter weight):
  Modern technology, traditional wisdom — TCM that fits the way you live now.

Primary CTA (filled button):
  Try the Wellness Assessment · 试一试体质评估
  → links to portal.html#/wellness-assessment

Secondary CTA (text link below button):
  Or book a consultation · 或预约问诊
  → links to portal.html#/book

Hero treatment: keep the existing aesthetic but soften the framing — generous whitespace, the three Chinese lines treated typographically with reverence (slight letter-spacing, balanced line height), bilingual subhead in a quieter weight underneath.
```

**Brand story — new section between hero and Services:**

```
Eyebrow:    Our story · 缘起

Heading:    Why HansMed exists · 为什么有汉方

Body (founder voice, 2 short paragraphs):
  EN: We started HansMed because too many people skip seeing a TCM
      doctor — not because they don't want to, but because life is busy
      and clinic visits don't fit. We thought: if we can use technology
      to handle the queueing, the paperwork, the prescription pickup,
      then our practitioners can focus on what they trained for —
      listening to you, feeling your pulse, understanding your
      constitution.

  ZH: 我们创立汉方，是因为太多人想看中医，却被忙碌的生活拦在门外。
      我们想：如果科技可以处理排队、文书、取药，那中医师就能专心做他
      们一辈子在做的事 —— 听您说，把您的脉，了解您的体质。

Tone: warm, first-person plural ("we"), no marketing claims, no "industry-leading" / "revolutionary" language. Sounds like the founder talking, not a brochure.
```

**Our Services — keep all 3 cards but reorder + rewrite copy:**

Card 1 (now first) — AI Wellness Assessment:

```
Icon: 👅 (keep)
Heading: AI Wellness Assessment · AI 体质评估

Copy:
  EN: Start with a free 5-minute assessment. Upload a tongue photo or
      answer a short questionnaire — every AI report is reviewed by a
      licensed practitioner before it reaches you.

  ZH: 5 分钟免费评估。拍一张舌头照片或回答几道问题 —— 每一份 AI 分析都
      经持牌中医师审核才呈交给您。

Card subtext (small, italic): AI 体质分析 · 非医疗诊断
CTA button: Start free assessment · 免费评估 → portal.html#/wellness-assessment
```

Card 2 (now second) — TCM Consultations:

```
Icon: 🩺 (keep)
Heading: TCM Consultations · 中医问诊

Copy:
  EN: Book a video or in-person session with a licensed TCM
      practitioner. Your doctor reviews your case, talks through the
      diagnosis with you, and can issue herbs delivered to your door.

  ZH: 预约视频或亲诊问诊。您的医师会和您仔细谈过病情，写下治疗方案，
      并可直接开方，药材送到家门。

Card subtext: 持牌中医师 · 视诊或亲诊
CTA button: Book a consultation · 预约问诊 → portal.html#/book
```

Card 3 (now third) — Herb Shop:

```
Icon: 🌿 (keep)
Heading: Herb Shop · 中药商店

Copy:
  EN: Quality single herbs and classical formulas from verified
      Malaysian suppliers. Prescription-linked orders are double-checked
      by your practitioner before they ship.

  ZH: 来自马来西亚验证供应商的优质单味药材与传统药方。处方药材在出货前
      由您的医师再次确认。

Card subtext: 品质验证 · 药师审核
CTA: keep the existing two-state CTA from Brief #3 (data-home-shop-cta wrapper). Live label: "Browse herbs · 瀏覽藥材". Coming-soon label: "Coming Soon · 即将推出".
```

**How it works — new section after Our Services:**

```
Eyebrow:    Your first visit · 第一次的体验

Heading:    Three steps to start · 三步开始

3 columns, each with an icon + step number + title + 1-sentence body:

Step 1 — Discover · 了解
  EN: Take the free wellness assessment to understand your TCM
      constitution. No appointment needed.
  ZH: 先做免费体质评估，了解自己的体质。无需预约。

Step 2 — Talk · 对话
  EN: Book a consultation when you're ready. Your practitioner reviews
      your assessment with you and answers your questions.
  ZH: 准备好就预约问诊。您的中医师会和您一起看评估结果、回答您的问题。

Step 3 — Receive · 调理
  EN: If herbs are needed, your prescription is dispensed by our partner
      pharmacy and delivered. Follow-ups happen on the same platform.
  ZH: 若需要药材，由我们的合作药房调配并送上门。复诊也在同一平台。
```

**Our Practitioners — placeholder section:**

```
Eyebrow:    Our practitioners · 我们的医师

Heading:    Licensed. Experienced. Approachable. · 持牌 · 经验 · 平易近人

Trust line (large, centered, single line):
  EN: Every practitioner on HansMed is registered with the Traditional
      and Complementary Medicine Council under Malaysia's Ministry of
      Health (T&CM Act 2016).
  ZH: 汉方所有中医师皆于马来西亚卫生部传统与辅助医药局注册（T&CM Act 2016）。

Below the trust line, 3 placeholder cards in a row:
  Each card: muted gold border, square aspect, light background.
  Inside: a small calligraphic seal icon (reuse existing 'seal' element),
          line "Practitioner profile · 医师介绍",
          subtext in muted color: "Coming soon · 即将推出".
  No fake names, no stock photos.

Subtle line below the cards (very small, muted):
  EN: Want to know who you'll be seeing before you book? Email us at
      hansmed.moderntcm@gmail.com — we'll match you and share the
      practitioner's background.
  ZH: 想在预约前先了解您的中医师？欢迎邮件 hansmed.moderntcm@gmail.com，
      我们会为您匹配并介绍。
```

**What patients say — placeholder:**

```
Eyebrow:    Patient stories · 患者反馈

Heading:    Real stories, coming soon · 真实故事 · 即将分享

Body (single muted paragraph, italic):
  EN: We're collecting permission from our early patients to share
      their stories. If HansMed has helped you and you'd like to
      contribute, please reach out — your words help others find care.
  ZH: 我们正在征集早期患者的授权，分享他们的故事。如果汉方帮到了您，
      欢迎联系我们 —— 您的分享会帮助更多人找到合适的照护。

Visually: subtle, NOT a focal section. Single column, generous padding,
muted background. Don't make this look broken — make it look intentional.
```

### Tone rules (apply across all rewritten copy)

- Use **"you"** (EN) and **"您"** (ZH) — formal/respectful.
- Avoid: "industry-leading", "revolutionary", "cutting-edge", "AI-powered" as headlines, "transformative", "seamless".
- Prefer: concrete actions ("listening to you", "feeling your pulse"), sensory details, plain language.
- First-person plural ("we") in brand-voice sections — sounds like the team, not a corporation.
- Bilingual pattern: keep the existing `<span lang="en">…</span><span lang="zh">…</span>` structure throughout.
- **Don't translate the brand spine literally word-for-word.** The Chinese version is poetic; the English is allowed to be slightly looser to flow well.

### Visual treatment

- Keep all existing CSS variables, typography, and palette. Don't introduce new fonts or colors.
- Hero: more whitespace than current; the three Chinese lines should breathe.
- Spacing rhythm: aim for slightly more vertical breathing room throughout — currently feels cramped in some sections.
- Buttons: keep existing `btn-v4` styles.
- For the placeholder cards (Practitioners, Patient stories), use a muted variant of the existing card style — same border radius, same padding, but lighter shadow and lower opacity content. Should look intentional, not broken.

### What NOT to change

- Nav, About dropdown, mobile drawer — leave alone.
- Footer — leave alone (footer copy can be a future polish).
- Existing CSS files — don't restructure. Add new rules only if necessary, scoped to new sections.
- The shop CTA two-state wrapper from Brief #3 — keep it intact, just wrapped with the new copy.
- All existing SEO meta tags, structured data, font preconnects — unchanged.

## ACCEPTANCE CRITERIA

- New homepage loads on hard-refresh of `hansmedtcm.github.io/Hansmed-system/v2/index.html`.
- Hero displays the three-line brand spine prominently in both EN and ZH.
- Brand story section reads in the founder's voice (warm, first-person plural, no marketing fluff).
- AI Wellness Assessment is the FIRST service card, with "Start free assessment" as its CTA.
- "How it works" section (3 steps) sits between Services and Practitioners.
- Practitioner placeholder section is visually intentional — not empty boxes that look broken.
- Patient stories placeholder is muted but present.
- Existing Explore section and Footer are unchanged.
- Shop card CTA still flips Coming Soon when shop_disabled (Brief #3 behavior preserved).
- Page renders cleanly in both EN and ZH language modes.
- No regressions on existing nav, dropdown, mobile drawer, or scrolling behavior.

## REPORT BACK

```
Files changed: [paths + line numbers]
Pushed to: [commit hash]
Sections in new order (top to bottom): [list]
Tone check (read 3 random copy blocks aloud — do they sound like a person or a brochure?): [your call]
Bilingual pattern preserved on every new block: [yes/no]
Existing Brief #3 shop CTA still works: [yes/no]
Mobile breakpoint tested (≤640px): [yes/no — sections still readable, cards stack cleanly]
Anything you had to change beyond what the brief specified: [list — even minor]
```

If during implementation you find a copy line that you genuinely think reads better in a different way than the brief specifies — STOP and ask the CEO before changing the user-supplied brand spine or founder voice text. Other copy you can polish lightly within the tone rules.
