# Brief #6 — v3 hero pivot + interactive AI Tongue Analysis widget

**Classification: DESIGN / CONTENT — scope: v3/index.html only. Do NOT touch v2/.**

## Background

Brand strategy update from CEO: AI Tongue Analysis becomes HansMed's primary brand hero. The constitution questionnaire is now framed as "a doctor's tool" (helps the practitioner review faster, accurately) rather than a marketing front door. Tongue analysis is the public-facing wow.

Current v3/index.html (from Brief #4) has the AI Wellness Assessment generic flow as the primary CTA. This brief sharpens it specifically to AI Tongue Analysis, and adds an interactive widget (combining options 1 and 2 from the CEO's brainstorm) that pairs visually with the existing live organ clock.

This is for v3 only — v2 stays live and untouched.

---

## TASK A — Pivot v3 hero copy + CTAs to AI Tongue Analysis

In `v3/index.html`, in the hero section, update:

- **Subhead** (currently something like "Modern technology, traditional wisdom — TCM that fits the way you live now."): change to:
  ```
  EN: AI tongue analysis, reviewed by licensed practitioners. The first step to understanding your TCM constitution.
  ZH: AI 舌診 + 持牌中醫師審核 —— 了解您體質的第一步。
  ```

- **Primary CTA button** (currently "Try the Wellness Assessment · 试一试体质评估"): change to:
  ```
  EN: Try AI Tongue Analysis · 試試 AI 舌診
  ZH: 試試 AI 舌診 · Try AI Tongue Analysis
  → links to portal.html#/wellness-assessment (same destination — that's the entry point to the tongue flow)
  ```

- **Secondary CTA text-link** (currently "Or book a consultation"): keep as-is, no change.

- Keep the three-line brand spine block exactly as-is (it's the brand identity, do not modify).

## TASK B — Build the interactive Tongue Map widget

Add a NEW section to `v3/index.html` immediately AFTER the hero (before the brand story section). The widget has two tabs/panels:

**Tab 1: "Tongue Map · 舌診地圖" (default tab)**
A stylized SVG tongue with TCM organ zones overlaid. User hovers or clicks each zone to see what that area reveals in TCM.

Standard TCM tongue mapping (use these exact zones + organs):
- **Tip (前端)** → Heart 心, Lung 肺
- **Front-center (前部)** → Lung 肺
- **Mid-sides (兩側)** → Liver 肝, Gallbladder 膽
- **Mid-center (中部)** → Stomach 胃, Spleen 脾
- **Root (根部)** → Kidney 腎, Bladder 膀胱, Intestines 腸

Starter SVG (paste this verbatim, then add zone overlays):

```html
<svg id="tongue-map-svg" viewBox="0 0 220 320" xmlns="http://www.w3.org/2000/svg" style="width:100%; max-width:280px; height:auto; display:block; margin:0 auto;">
  <!-- Stylized tongue body -->
  <path d="M 110 12
           C 70 12, 38 42, 38 100
           C 38 160, 42 210, 58 260
           C 72 295, 92 310, 110 310
           C 128 310, 148 295, 162 260
           C 178 210, 182 160, 182 100
           C 182 42, 150 12, 110 12 Z"
        fill="#F5C6C6" stroke="#9E5E5E" stroke-width="2.5"/>
  <!-- Center vertical groove -->
  <path d="M 110 35 L 110 285"
        stroke="#9E5E5E" stroke-width="1.5" fill="none" opacity="0.35" stroke-dasharray="4 6"/>
  <!-- Zone overlays — invisible by default, hover/click highlights -->
  <!-- Tip (Heart/Lung) -->
  <ellipse class="tongue-zone" data-zone="tip" cx="110" cy="40" rx="38" ry="22"
           fill="rgba(181,136,26,0)" stroke="rgba(181,136,26,0)" stroke-width="2" style="cursor:pointer;"/>
  <!-- Front-center (Lung) -->
  <ellipse class="tongue-zone" data-zone="front" cx="110" cy="90" rx="32" ry="22"
           fill="rgba(181,136,26,0)" stroke="rgba(181,136,26,0)" stroke-width="2" style="cursor:pointer;"/>
  <!-- Left side mid (Liver) -->
  <ellipse class="tongue-zone" data-zone="left-side" cx="60" cy="155" rx="22" ry="50"
           fill="rgba(181,136,26,0)" stroke="rgba(181,136,26,0)" stroke-width="2" style="cursor:pointer;"/>
  <!-- Right side mid (Gallbladder) -->
  <ellipse class="tongue-zone" data-zone="right-side" cx="160" cy="155" rx="22" ry="50"
           fill="rgba(181,136,26,0)" stroke="rgba(181,136,26,0)" stroke-width="2" style="cursor:pointer;"/>
  <!-- Mid-center (Stomach/Spleen) -->
  <ellipse class="tongue-zone" data-zone="center" cx="110" cy="160" rx="32" ry="50"
           fill="rgba(181,136,26,0)" stroke="rgba(181,136,26,0)" stroke-width="2" style="cursor:pointer;"/>
  <!-- Root (Kidney/Bladder/Intestines) -->
  <ellipse class="tongue-zone" data-zone="root" cx="110" cy="265" rx="50" ry="32"
           fill="rgba(181,136,26,0)" stroke="rgba(181,136,26,0)" stroke-width="2" style="cursor:pointer;"/>
</svg>
```

CSS for the zone hover/active states (add to a `<style>` block scoped to the widget):
```css
.tongue-zone { transition: fill 0.2s ease, stroke 0.2s ease; }
.tongue-zone:hover { fill: rgba(181,136,26,0.18) !important; stroke: rgba(181,136,26,0.6) !important; }
.tongue-zone.active { fill: rgba(181,136,26,0.28) !important; stroke: rgba(181,136,26,0.9) !important; }
```

To the RIGHT (or below, on mobile) of the SVG, render an **info card** that updates on hover/click. Default state when nothing is selected: a gentle invitation to interact.

Default info card content:
```
Eyebrow: Hover any region · 將鼠標移到任意區域
Heading: Each zone of your tongue reveals a different organ system.
ZH:      舌頭的每個部位反映不同的臟腑狀態。
```

Per-zone info content (six zones, each gets its own info block — switch via JS based on which zone is hovered/clicked):

```
TIP (前端):
  Heading EN: Heart · Lung
  Heading ZH: 心 · 肺
  Body EN: A red or purple tip can suggest heart heat or stress.
           Cracks here may relate to emotional strain.
  Body ZH: 舌尖偏紅或偏紫，可能反映心火或情志壓力。
           裂紋常與情志有關。

FRONT-CENTER (前部):
  Heading EN: Lung
  Heading ZH: 肺
  Body EN: A pale or coated front-center area can suggest lung qi
           weakness or recent respiratory strain.
  Body ZH: 舌前中部偏白或苔厚，可能反映肺氣虛弱或近期呼吸系統不適。

LEFT-SIDE (左側):
  Heading EN: Liver
  Heading ZH: 肝
  Body EN: Swelling or red edges on the left can suggest liver qi
           stagnation — often linked to stress or sleep disturbance.
  Body ZH: 舌左側腫脹或邊緣偏紅，可能反映肝氣鬱結 ——
           多與壓力或睡眠不安有關。

RIGHT-SIDE (右側):
  Heading EN: Gallbladder
  Heading ZH: 膽
  Body EN: Yellow coating on the right can indicate damp-heat
           in the gallbladder — common with rich diets.
  Body ZH: 舌右側苔黃，可能反映膽腑濕熱 —— 多與飲食肥膩有關。

CENTER (中部):
  Heading EN: Stomach · Spleen
  Heading ZH: 胃 · 脾
  Body EN: This is the digestion zone. A thick coating, scalloped
           edges, or pale color can indicate spleen qi deficiency
           or damp accumulation.
  Body ZH: 此為消化中樞。苔厚、齒痕、或舌色偏白，
           常反映脾氣虛或濕氣滯留。

ROOT (根部):
  Heading EN: Kidney · Bladder · Intestines
  Heading ZH: 腎 · 膀胱 · 腸
  Body EN: A thick coating at the back can reflect lower jiao
           dampness. A peeled root may suggest kidney yin deficiency.
  Body ZH: 舌根苔厚，常反映下焦濕滯。
           舌根剝落可能反映腎陰不足。
```

JS behavior:
- On `mouseenter` over a `.tongue-zone`, swap info card content + add `.active` class to the zone.
- On `mouseleave` from the SVG entirely, revert info card to the default state.
- On `click` of a zone, "lock" the info card to that zone (active stays even after mouseleave) until another zone is clicked or the user clicks outside the SVG.
- Touch devices (no hover): tap = same as click.

After the info card, a small CTA line:
```
Want a real analysis of your tongue? · 想體驗 AI 分析您的舌頭？
[Try AI Tongue Analysis · 試試 AI 舌診] (links to portal.html#/wellness-assessment)
```

**Tab 2: "Common Tongue Types · 常見舌象"**
A horizontal scrolling strip (or 2-row grid on mobile) of 8 stylized tongue cards. Each card has:
- A simple stylized tongue SVG colored to represent that type
- The tongue type name (EN + ZH)
- A 1-line teaser
- Click → opens a modal with the full TCM interpretation

The 8 tongue types (use exactly these — content already drafted):

```
1. Pale tongue · 淡白舌
   Color: very light pink, almost white
   Teaser EN: May indicate Qi or Blood deficiency
   Teaser ZH: 可能反映氣虛或血虛
   Full EN: A pale tongue often suggests insufficient Qi (vital
            energy) or blood. People with this presentation may feel
            tired easily, have a soft voice, or feel cold often.
            Diet and gentle herbal support can help build reserves.
   Full ZH: 淡白舌常見於氣血不足。多有疲倦、聲音低弱、畏寒等表現。
            可透過飲食調理與溫補中藥幫助身體建立儲備。

2. Red tongue · 紅舌
   Color: bright red, no swelling
   Teaser EN: Heat in the body
   Teaser ZH: 體內有熱
   Full EN: A red tongue without coating typically signals internal
            heat — often from stress, spicy foods, or insufficient
            sleep. Cooling foods and stress reduction are common
            recommendations.
   Full ZH: 紅舌少苔常反映體內陰虛火旺，多與壓力大、嗜辣、熬夜有關。
            飲食宜清涼，作息應調整。

3. Purple tongue · 紫舌
   Color: dark red-purple
   Teaser EN: Blood circulation may be sluggish
   Teaser ZH: 可能血液循環不暢
   Full EN: A purple tongue often indicates blood stasis — sluggish
            circulation that may correlate with cold extremities,
            chronic pain, or menstrual irregularities. Movement
            and warming herbs are commonly used to support flow.
   Full ZH: 紫舌常反映血瘀，多與手足冰冷、慢性疼痛、月經不調相關。
            適度運動與活血溫經中藥有助改善。

4. Fissured tongue · 裂紋舌
   Color: normal pink with deep grooves
   Teaser EN: Possible Yin deficiency
   Teaser ZH: 可能陰虛
   Full EN: Cracks or fissures often suggest Yin (the body's
            cooling, moistening fluids) is depleted. Common with
            long-term stress, dehydration, or aging. Hydration
            and Yin-nourishing foods are typical first steps.
   Full ZH: 裂紋舌常反映陰液虧虛，多見於長期壓力、脫水、年長者。
            充足飲水與滋陰食物是基本調理方向。

5. Scalloped tongue · 齒痕舌
   Color: pale, with teeth marks on edges
   Teaser EN: Spleen Qi may be weak
   Teaser ZH: 可能脾氣虛弱
   Full EN: Teeth marks on the sides of the tongue typically signal
            spleen Qi deficiency — the spleen in TCM governs
            digestion. Bloating, fatigue after meals, and loose
            stools are common companions.
   Full ZH: 舌邊齒痕常反映脾氣虛弱。脾主運化，多伴有飯後易倦、
            腹脹、便溏等。

6. White coating · 白苔
   Color: thin or thick white film over the tongue
   Teaser EN: Cold or damp accumulation
   Teaser ZH: 寒象或濕氣積聚
   Full EN: A thin white coating is normal. A thick white coating
            often suggests cold or damp accumulation, common in
            humid weather or after heavy meals. Light, warming
            foods help disperse it.
   Full ZH: 薄白苔屬正常。厚白苔常反映寒濕積聚，
            多見於潮濕氣候或飲食肥膩後。清淡溫熱飲食有助化解。

7. Yellow coating · 黃苔
   Color: yellow film over the tongue
   Teaser EN: Heat, often in the digestive system
   Teaser ZH: 多反映胃熱
   Full EN: Yellow coating typically indicates heat — often in the
            stomach. Common with acid reflux, bad breath, or
            irritability. Cooling, light foods are commonly
            recommended; reduce fried and spicy intake.
   Full ZH: 黃苔多反映胃中有熱。常見胃酸、口臭、易煩躁。
            飲食宜清涼，減少油炸與辛辣。

8. Geographic tongue · 地圖舌
   Color: patches of peeled, smooth areas alternating with coated
   Teaser EN: Stomach Yin deficiency
   Teaser ZH: 胃陰不足
   Full EN: Patchy "geographic" patterns often signal stomach Yin
            deficiency. May correlate with hunger pains, dry mouth,
            or trouble gaining weight. Yin-nourishing diet plus
            avoiding very hot foods can help.
   Full ZH: 舌面地圖樣剝落常反映胃陰不足。多伴飢餓痛、口乾、
            體重難增。滋陰飲食、避免過燙食物有助改善。
```

For the 8 stylized tongue SVGs in this tab, write a single reusable inline SVG template and pass parameters (fill color, coating color, edge style) so each card variant looks visually distinct without 8 separate SVGs. Example variants to render:
- Pale: very light pink fill, thin coating
- Red: bright red fill, no coating
- Purple: dusky red-purple fill
- Fissured: normal pink with subtle horizontal cracks (use SVG <line>s)
- Scalloped: pale fill with wavy edge instead of smooth
- White coating: pink fill with semi-opaque white overlay
- Yellow coating: pink fill with semi-opaque yellow overlay
- Geographic: pink fill with patches of darker red and lighter pink

Modal for each card (opens on click): full content from the table above (Full EN + Full ZH), styled like the existing `case-record-modal` modal pattern in patients.js for visual consistency. Close button + click-outside dismisses.

After the strip, the same CTA line as Tab 1:
```
Ready to see what YOUR tongue says? · 想知道您的舌頭告訴我們什麼？
[Try AI Tongue Analysis · 試試 AI 舌診] (portal.html#/wellness-assessment)
```

## TASK C — Wire it into v3 homepage

The widget section structure:
```
<section class="tongue-widget" id="tongue-widget">
  <div class="container">
    <div class="eyebrow">AI Tongue Analysis · AI 舌診</div>
    <h2>Your tongue tells a story · 舌頭 · 內在的訊號</h2>
    <p class="lead">Modern AI meets a 2,000-year-old diagnostic tradition.
                    Explore how TCM reads the tongue, then try yours.</p>
                 <!-- ZH: 現代 AI 結合兩千年中醫舌診智慧。
                          先了解中醫如何看舌，再體驗您自己的。 -->

    <div class="tongue-tabs">
      <button class="tongue-tab active" data-tab="map">Tongue Map · 舌診地圖</button>
      <button class="tongue-tab"        data-tab="types">Common Tongue Types · 常見舌象</button>
    </div>

    <div class="tongue-panel" data-panel="map">[ Tongue map SVG + info card ]</div>
    <div class="tongue-panel" data-panel="types" hidden>[ 8 tongue type cards ]</div>
  </div>
</section>
```

Visual treatment:
- Section background: subtle washi/parchment color (matches the existing `--washi` token)
- Generous whitespace top and bottom
- Tabs: minimal, gold underline on active (matches existing brand color)
- SVG tongue: elegant but warm, not clinical
- Info card: warm cream background, traditional border, Cormorant for headings
- Tongue type cards: square aspect, hover lift, subtle shadow
- Modal: existing modal style from elsewhere in v2/

## ACCEPTANCE CRITERIA

- v3/index.html hero now shows "Try AI Tongue Analysis · 試試 AI 舌診" as primary CTA.
- New tongue widget section renders directly below hero, before brand story.
- Tab 1 (Tongue Map): SVG tongue displays, hovering each of the 6 zones updates the info card; clicking locks the selection; touch devices work via tap.
- Tab 2 (Common Tongue Types): 8 stylized tongue cards render in a horizontal strip (or grid on mobile); clicking any card opens a modal with full TCM interpretation in EN + ZH.
- Both tabs end with a "Try AI Tongue Analysis" CTA pointing to `portal.html#/wellness-assessment`.
- All copy renders correctly in both EN and ZH language modes (existing lang-switcher handles this).
- Widget is responsive: SVG scales on mobile, info card stacks below SVG, type strip becomes 2-column grid below 640px.
- No regressions on the rest of v3/index.html (brand story, services, how it works, practitioner placeholder, footer, etc.).
- v2/ is NOT modified at all.
- All asset paths still resolve via ../v2/ (no new asset directories needed).

## REPORT BACK

```
Files changed: [paths + line numbers]
Pushed to: [commit hash]
Hero pivot complete: [yes/no]
Tongue map renders + 6 zones interactive: [yes/no]
Tongue types tab renders all 8 cards + modal works: [yes/no]
Mobile responsive (≤640px) tested: [yes/no]
v2/ files touched: [should be 'none']
Anything left as TODO: [list]
```

If any zone hover content reads awkward in either language, polish it lightly within the tone — but don't change any of the TCM organ mappings. The TCM tongue map is canonical; copy can be polished, mappings cannot.
