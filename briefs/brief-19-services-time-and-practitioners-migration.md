# Brief #19 — Services consultation time update + practitioner profiles migration (v2 → v3)

**Classification: CONTENT — scope: (A) update consultation time on v3/services.html from "30-45 minutes" to "15-20 minutes" everywhere it appears; (B) replace the placeholder practitioner cards in v3/practitioners.html with the real founder profiles (Mr. Siew + Mr. Lim) from v2/practitioners.html, adapted to v3's design tokens.**

## Background

CEO confirmed:
1. Brief #13, #14a, #16 all ran successfully. Site is in good shape.
2. Consultation duration should be **15-20 minutes** (not 30-45 mins as currently shown). This reflects HansMed's actual video consultation pacing.
3. v3/practitioners.html currently shows 3 placeholder cards saying "Coming soon". v2/practitioners.html has REAL founder profiles for Mr. Siew Kuen Xian (蕭坤賢) and Mr. Lim Gao Hong (林高鴻). Migrate the real data to v3.

**Coordination note:** Brief #18 (i18n refactor) is planned but not yet run. This brief uses the current `<span lang="en">/<span lang="zh">` pattern. When Brief #18 Phase 4 (services.html) and Phase 5 (practitioners.html) eventually run, the new content from this brief will be migrated to the i18n dictionary.

## TASK A — Update consultation time on v3/services.html

### A1 — Comparison table "Time" row (line ~225)

Find:
```html
          <td><span lang="en">30–45 minutes</span><span lang="zh">30–45 分鐘</span></td>
```

Replace with:
```html
          <td><span lang="en">15–20 minutes</span><span lang="zh">15–20 分鐘</span></td>
```

### A2 — "How it works" step 3 description (line ~379-380)

Find:
```html
          <span lang="en">The practitioner conducts the consultation — typically 30–45 minutes for a first visit, 20–30 minutes for follow-ups.</span>
          <span lang="zh">中醫師進行問診 —— 初診通常 30–45 分鐘，複診 20–30 分鐘。</span>
```

Replace with:
```html
          <span lang="en">The practitioner conducts the consultation — typically 15–20 minutes per session.</span>
          <span lang="zh">中醫師進行問診 —— 每次問診通常 15–20 分鐘。</span>
```

### A3 — FAQ "How long is a consultation?" (line ~410)

Find:
```html
          <p><span lang="en">First visits typically run 30–45 minutes — the practitioner needs time to take a complete history. Follow-ups are usually 20–30 minutes. If your concern is complex, the practitioner may suggest a longer initial slot when you book.</span><span lang="zh">初診通常 30–45 分鐘 —— 醫師需要時間記錄完整病史。複診通常 20–30 分鐘。若情況較複雜，醫師可能建議您預約較長的初診時段。</span></p>
```

Replace with:
```html
          <p><span lang="en">Each consultation runs about 15–20 minutes — focused, efficient, and led by a licensed TCM practitioner. If your concern is complex and needs more time, the practitioner may suggest extending the session or booking a follow-up.</span><span lang="zh">每次問診約 15–20 分鐘 —— 專注、高效，由持牌中醫師親自進行。若情況較複雜需要更多時間，醫師會建議延長時段或預約複診。</span></p>
```

### A4 — Verification grep

```bash
# Should return ZERO matches after the edits above
grep -n "30.{1,2}45\|20.{1,2}30" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html
grep -n "30 minutes\|45 minutes" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html

# Confirm new times are present
grep -n "15.{1,2}20" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html
```

The first two greps must return zero matches. The third should return at least 3 matches (one per location updated above).

## TASK B — Migrate practitioner profiles from v2 to v3

### B1 — Source data (already extracted from v2/practitioners.html)

**Mr. Siew Kuen Xian (蕭坤賢)** — Co-Founder · Head Practitioner
- Avatar: Chinese character 蕭 in calligraphic style
- Credentials:
  - BSc (Hons) TCM — First Class Honours
  - International Medical University (IMU)
  - T&CM Act 2016 Registered · MOH Licensed
  - Co-Founder, HansMed Modern TCM
- Areas of Practice: Internal Pain (內科), External Pain (外科), Acupuncture (針灸), Manipulation (推拿), Herbal Medicine (中藥)
- Quote (EN): "Mr. Siew graduated with First Class Honours and brings deep clinical rigour to every consultation — from complex internal conditions to musculoskeletal pain and rehabilitation."
- Quote (ZH): 「蕭醫師以一級榮譽畢業，臨床功底深厚，從複雜的內科病症到肌肉骨骼疼痛及復健，皆能細心應對。」

**Mr. Lim Gao Hong (林高鴻)** — Co-Founder · Head Practitioner
- Avatar: Chinese character 林 in calligraphic style
- Credentials:
  - BSc (Hons) TCM — Honours
  - International Medical University (IMU)
  - T&CM Act 2016 Registered · MOH Licensed
  - Co-Founder, HansMed Modern TCM
- Areas of Practice: Internal Pain (內科), External Pain (外科), Acupuncture (針灸), Manipulation (推拿), Herbal Medicine (中藥)
- Quote (EN): "Mr. Lim brings a holistic and patient-centred approach to practice, excelling in pain management — both internal and external — through acupuncture, manipulation, and carefully prescribed herbal formulas."
- Quote (ZH): 「林醫師秉持全人及以患者為本的理念，擅長以針灸、推拿及精準的中藥處方治療內外科疼痛。」

### B2 — Read v3/practitioners.html to find the placeholder section

```bash
grep -n "practitioner-card-placeholder\|practitioners-card-grid\|practitioners-intro\|We're collecting permission" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/practitioners.html
```

The 3 placeholder cards live inside `<div class="practitioners-card-grid">` starting around line 259. They use the v3 class names `practitioner-card-placeholder`, `practitioner-card-img`, `practitioner-card-meta`, `practitioner-card-tag`, `practitioner-card-soon`. Reuse the v3 styling pattern but add real content.

### B3 — Update the practitioners-intro paragraph (line ~253-255)

Find:
```html
    <p class="practitioners-intro">
      <span lang="en">We're collecting permission and writing each practitioner's profile right now. In the meantime, the contact form below puts you in touch with our team — tell us your concern and we'll introduce you to the practitioner who fits best.</span>
      ...
    </p>
```

Replace with:
```html
    <p class="practitioners-intro">
      <span lang="en">Founders, head practitioners, and the clinical heart of HansMed. Every AI report, every treatment plan passes through their hands.</span>
      <span lang="zh">創辦人、首席醫師，以及 HansMed 臨床的核心。每一份 AI 報告、每一份治療方案，皆由他們親自審核。</span>
    </p>
```

### B4 — Replace the 3 placeholder cards with 2 real practitioner cards

Find the entire block from `<div class="practitioners-card-grid">` to the closing `</div>` of that block (3 placeholder cards inside). Replace the inner content (3 cards) with the 2 real cards below.

**Important:** Keep the wrapping `<div class="practitioners-card-grid">` tag and its layout/animation classes (`reveal`, transition-delay attributes). Just replace the cards INSIDE.

If v3's CSS doesn't have classes specifically for "real" practitioner cards (only placeholders), add inline styling that matches the v3 design tokens. Below is the markup to use; adjust class names if v3 has more specific equivalents discoverable via:

```bash
grep -n "practitioner-card\|practitioner-bio\|practitioner-credentials" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/assets/css/visual-upgrade.css
grep -n "practitioner-card\|practitioner" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/css/landing-v4.css
```

**Card markup (use this as the new content inside `<div class="practitioners-card-grid">`):**

```html
    <!-- Mr. Siew Kuen Xian -->
    <div class="practitioner-card reveal" style="background:#fff;border:1px solid var(--border);border-radius:14px;padding:32px 28px;display:flex;flex-direction:column;gap:18px;">
      <!-- Avatar (calligraphic Chinese character) -->
      <div style="width:88px;height:88px;border-radius:50%;background:var(--washi);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;align-self:flex-start;">
        <span style="font-family:'Ma Shan Zheng','Noto Serif SC',serif;font-size:32px;font-weight:400;color:var(--gold);">蕭</span>
      </div>

      <!-- Name + Chinese name -->
      <div>
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
          <h3 style="font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:500;color:var(--ink);letter-spacing:-0.01em;margin:0;">Mr. Siew Kuen Xian</h3>
          <span style="font-family:'Noto Serif SC',serif;font-size:14px;color:var(--muted);font-weight:300;">蕭坤賢</span>
        </div>
        <div style="font-size:12px;color:var(--gold);font-weight:500;letter-spacing:0.06em;text-transform:uppercase;">
          <span lang="en">Co-Founder · Head Practitioner</span>
          <span lang="zh">共同創辦人 · 首席醫師</span>
        </div>
      </div>

      <!-- Credentials -->
      <div style="background:var(--washi);border:1px solid var(--border);border-radius:10px;padding:14px 16px;">
        <div style="font-size:10px;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;font-weight:600;">
          <span lang="en">Credentials</span>
          <span lang="zh">資歷</span>
        </div>
        <ul style="list-style:none;padding:0;margin:0;font-size:13px;color:var(--ink);line-height:1.8;">
          <li>· <span lang="en">BSc (Hons) TCM — First Class Honours</span><span lang="zh">中醫學士 (一級榮譽)</span></li>
          <li>· <span lang="en">International Medical University (IMU)</span><span lang="zh">國際醫藥大學 (IMU)</span></li>
          <li>· <span lang="en">T&amp;CM Act 2016 Registered · MOH Licensed</span><span lang="zh">T&amp;CM 法令 2016 註冊 · 衛生部認可</span></li>
          <li>· <span lang="en">Co-Founder, HansMed Modern TCM</span><span lang="zh">HansMed 現代中醫共同創辦人</span></li>
        </ul>
      </div>

      <!-- Areas of Practice -->
      <div>
        <div style="font-size:10px;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;font-weight:600;">
          <span lang="en">Areas of Practice</span>
          <span lang="zh">專科</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          <span class="cert-pill" style="background:var(--washi);border:1px solid var(--border);border-radius:12px;padding:4px 12px;font-size:12px;"><span lang="en">Internal Pain</span><span lang="zh">內科</span></span>
          <span class="cert-pill" style="background:var(--washi);border:1px solid var(--border);border-radius:12px;padding:4px 12px;font-size:12px;"><span lang="en">External Pain</span><span lang="zh">外科</span></span>
          <span class="cert-pill" style="background:var(--washi);border:1px solid var(--border);border-radius:12px;padding:4px 12px;font-size:12px;"><span lang="en">Acupuncture</span><span lang="zh">針灸</span></span>
          <span class="cert-pill" style="background:var(--washi);border:1px solid var(--border);border-radius:12px;padding:4px 12px;font-size:12px;"><span lang="en">Manipulation</span><span lang="zh">推拿</span></span>
          <span class="cert-pill" style="background:var(--washi);border:1px solid var(--border);border-radius:12px;padding:4px 12px;font-size:12px;"><span lang="en">Herbal Medicine</span><span lang="zh">中藥</span></span>
        </div>
      </div>

      <!-- Quote -->
      <blockquote style="border-left:3px solid var(--gold);padding-left:14px;margin:0;font-style:italic;font-size:14px;color:var(--muted);line-height:1.7;font-weight:300;">
        <span lang="en">"Mr. Siew graduated with First Class Honours and brings deep clinical rigour to every consultation — from complex internal conditions to musculoskeletal pain and rehabilitation."</span>
        <span lang="zh">「蕭醫師以一級榮譽畢業，臨床功底深厚，從複雜的內科病症到肌肉骨骼疼痛及復健，皆能細心應對。」</span>
      </blockquote>

      <!-- CTA -->
      <a class="btn-v4 btn-dark" href="../portal.html#/book?practitioner=siew" style="align-self:flex-start;">
        <span lang="en">Book with Mr. Siew →</span>
        <span lang="zh">預約蕭醫師 →</span>
      </a>
    </div>

    <!-- Mr. Lim Gao Hong -->
    <div class="practitioner-card reveal" style="transition-delay:0.04s;background:#fff;border:1px solid var(--border);border-radius:14px;padding:32px 28px;display:flex;flex-direction:column;gap:18px;">
      <!-- Avatar -->
      <div style="width:88px;height:88px;border-radius:50%;background:var(--washi);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;align-self:flex-start;">
        <span style="font-family:'Ma Shan Zheng','Noto Serif SC',serif;font-size:32px;font-weight:400;color:var(--gold);">林</span>
      </div>

      <!-- Name + Chinese name -->
      <div>
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
          <h3 style="font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:500;color:var(--ink);letter-spacing:-0.01em;margin:0;">Mr. Lim Gao Hong</h3>
          <span style="font-family:'Noto Serif SC',serif;font-size:14px;color:var(--muted);font-weight:300;">林高鴻</span>
        </div>
        <div style="font-size:12px;color:var(--gold);font-weight:500;letter-spacing:0.06em;text-transform:uppercase;">
          <span lang="en">Co-Founder · Head Practitioner</span>
          <span lang="zh">共同創辦人 · 首席醫師</span>
        </div>
      </div>

      <!-- Credentials -->
      <div style="background:var(--washi);border:1px solid var(--border);border-radius:10px;padding:14px 16px;">
        <div style="font-size:10px;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;font-weight:600;">
          <span lang="en">Credentials</span>
          <span lang="zh">資歷</span>
        </div>
        <ul style="list-style:none;padding:0;margin:0;font-size:13px;color:var(--ink);line-height:1.8;">
          <li>· <span lang="en">BSc (Hons) TCM — Honours</span><span lang="zh">中醫學士 (榮譽)</span></li>
          <li>· <span lang="en">International Medical University (IMU)</span><span lang="zh">國際醫藥大學 (IMU)</span></li>
          <li>· <span lang="en">T&amp;CM Act 2016 Registered · MOH Licensed</span><span lang="zh">T&amp;CM 法令 2016 註冊 · 衛生部認可</span></li>
          <li>· <span lang="en">Co-Founder, HansMed Modern TCM</span><span lang="zh">HansMed 現代中醫共同創辦人</span></li>
        </ul>
      </div>

      <!-- Areas of Practice -->
      <div>
        <div style="font-size:10px;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;font-weight:600;">
          <span lang="en">Areas of Practice</span>
          <span lang="zh">專科</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          <span class="cert-pill" style="background:var(--washi);border:1px solid var(--border);border-radius:12px;padding:4px 12px;font-size:12px;"><span lang="en">Internal Pain</span><span lang="zh">內科</span></span>
          <span class="cert-pill" style="background:var(--washi);border:1px solid var(--border);border-radius:12px;padding:4px 12px;font-size:12px;"><span lang="en">External Pain</span><span lang="zh">外科</span></span>
          <span class="cert-pill" style="background:var(--washi);border:1px solid var(--border);border-radius:12px;padding:4px 12px;font-size:12px;"><span lang="en">Acupuncture</span><span lang="zh">針灸</span></span>
          <span class="cert-pill" style="background:var(--washi);border:1px solid var(--border);border-radius:12px;padding:4px 12px;font-size:12px;"><span lang="en">Manipulation</span><span lang="zh">推拿</span></span>
          <span class="cert-pill" style="background:var(--washi);border:1px solid var(--border);border-radius:12px;padding:4px 12px;font-size:12px;"><span lang="en">Herbal Medicine</span><span lang="zh">中藥</span></span>
        </div>
      </div>

      <!-- Quote -->
      <blockquote style="border-left:3px solid var(--gold);padding-left:14px;margin:0;font-style:italic;font-size:14px;color:var(--muted);line-height:1.7;font-weight:300;">
        <span lang="en">"Mr. Lim brings a holistic and patient-centred approach to practice, excelling in pain management — both internal and external — through acupuncture, manipulation, and carefully prescribed herbal formulas."</span>
        <span lang="zh">「林醫師秉持全人及以患者為本的理念，擅長以針灸、推拿及精準的中藥處方治療內外科疼痛。」</span>
      </blockquote>

      <!-- CTA -->
      <a class="btn-v4 btn-dark" href="../portal.html#/book?practitioner=lim" style="align-self:flex-start;">
        <span lang="en">Book with Mr. Lim →</span>
        <span lang="zh">預約林醫師 →</span>
      </a>
    </div>
```

### B5 — Update the section heading and intro to reflect "real practitioners" instead of "coming soon"

Find the section heading above the cards (around line 245-255). Likely contains:
```html
  <div class="sh center reveal">
    <div class="eyebrow">
      <span lang="en">Our practitioners</span>
      ...
```

Update or verify the eyebrow says "Founders & Head Practitioners · 創辦人及首席醫師" (or similar). If the existing eyebrow is generic ("Our practitioners"), add a more specific subheading:

```html
  <div class="sh center reveal" style="margin-bottom:36px;">
    <div class="eyebrow">
      <span lang="en">Founders &amp; Head Practitioners</span>
      <span lang="zh">創辦人及首席醫師</span>
    </div>
    <h2>
      <span lang="en">Practitioners you can <em>trust</em></span>
      <span lang="zh">值得信賴的 <em>中醫師</em></span>
    </h2>
  </div>
```

### B6 — Update Open Graph + Twitter description on practitioners.html

The current meta description says profiles are "coming soon". Update it now that real profiles are live.

Find (around line 21):
```html
<meta name="description" content="Our TCM practitioners are licensed by Malaysia's T&CM Council. Profiles coming soon — email us for matching and we'll introduce the right practitioner for your concern.">
```

Replace with:
```html
<meta name="description" content="Meet HansMed's founder practitioners — Mr. Siew Kuen Xian and Mr. Lim Gao Hong. Both are T&CM Act 2016 registered, MOH-licensed, IMU graduates. Book a video consultation today.">
```

Apply the same update to the OG description (line ~29) and Twitter description (line ~38).

### B7 — Update the section that describes the practitioners list

Search for and update any text that still says "coming soon" or "We're collecting permission":

```bash
grep -in "coming soon\|collecting permission\|placeholder\|profile.*soon" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/practitioners.html
```

Any remaining references should be removed or updated to reflect that profiles are NOW live.

## TASK C — Verification gate

After Tasks A and B complete:

```bash
# Confirm no old time references remain
grep -n "30.{1,2}45\|20.{1,2}30\|30 minutes\|45 minutes" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html

# Confirm new time appears in all 3 locations
grep -c "15.{1,2}20" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html
# Expected: 3 or more

# Confirm practitioner profiles are present
grep -c "Mr. Siew\|Mr. Lim\|蕭坤賢\|林高鴻" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/practitioners.html
# Expected: 4+ matches (each name + Chinese names)

# Confirm placeholders removed
grep -n "practitioner-card-placeholder\|practitioner-card-soon\|coming soon" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/practitioners.html
# Expected: zero or only references inside HTML comments
```

Open both pages in a browser:
1. `v3/services.html` — verify time shows "15-20 minutes" in the comparison table, How it works step 3, and FAQ
2. `v3/practitioners.html` — verify Mr. Siew and Mr. Lim cards appear with credentials, areas of practice, quote, and Book CTA. Toggle EN/中 — both languages render correctly. No placeholder cards remain.

## ACCEPTANCE CRITERIA

- v3/services.html consultation time shows 15-20 minutes (comparison table, How it works, FAQ — all 3 locations)
- v3/practitioners.html shows 2 real practitioner cards (Mr. Siew, Mr. Lim) replacing the 3 placeholders
- Each practitioner card has: Chinese-character avatar, English name + Chinese name, role label, credentials block, areas of practice chips, italic quote, "Book with [Name]" CTA button
- Both languages (EN + 中) render correctly via the existing `<span lang>` pattern
- Meta description, OG description, Twitter description on practitioners.html updated (no longer says "coming soon")
- All "coming soon" / "collecting permission" text removed from practitioners.html visible content
- No regression on other parts of services.html or practitioners.html
- Snapshot saved at `briefs/snapshots/brief-19-pre-migration/` (both files)

## REPORT BACK

```
Files modified:
  - v3/services.html (consultation time: 30-45 → 15-20 minutes)
  - v3/practitioners.html (practitioner cards + intro + meta tags)

Pushed to: [commit hash]

Time updates verified:
  Old time references remaining: [count, should be 0]
  New "15-20 minutes" appears: [count, should be 3+]

Practitioner migration verified:
  Mr. Siew card present: [yes/no]
  Mr. Lim card present: [yes/no]
  Placeholder cards removed: [yes/no]
  Meta tags updated (no more "coming soon"): [yes/no]

Bilingual EN/中 verified in both pages: [yes/no]

Anything that needs CEO attention: [list]
```

## ROLLBACK

```bash
SNAP=/sessions/lucid-gallant-goldberg/mnt/Hansmed-system/briefs/snapshots/brief-19-pre-migration
mkdir -p $SNAP  # if not exists
# (Done at start of brief execution)

# To rollback after completion:
cp $SNAP/services.html      /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html
cp $SNAP/practitioners.html /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/practitioners.html
git add -A
git commit -m "Rollback: revert Brief #19"
git push
```

## NOTES

- The Book CTA links use `../portal.html#/book?practitioner=siew|lim` — this assumes the portal booking page reads the `practitioner` query parameter to pre-select the practitioner. If it doesn't, the link still works (just lands on the booking page without pre-selection). Backend enhancement is out of scope for this brief.
- The avatar uses calligraphic Chinese characters (蕭, 林) instead of photos. CEO can later swap these for real photos when available — just replace the `<span style="font-family:'Ma Shan Zheng'...">蕭</span>` with `<img src="..." alt="Mr. Siew">`.
- After Brief #18 (i18n refactor) eventually runs, all the EN/ZH content added by this brief will be migrated into the dictionary. The structure is friendly for this — every text already has clear EN + ZH counterparts.
- The CSS classes used (`btn-v4`, `btn-dark`, `cert-pill`, `reveal`) come from v3's existing stylesheet (`v3/assets/css/visual-upgrade.css` + inherited from v2). Verify they render as expected after deploy; if any class is missing, fall back to inline styles.
