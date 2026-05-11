# Brief #7 — Organ clock: contextual intro + interactive 12-organ education

**Classification: DESIGN / CONTENT — scope: v3/index.html only. Do NOT touch v2/.**

## Background

The Live TCM Organ Clock is one of HansMed's strongest brand assets — beautiful, animated, time-aware. But on v3/index.html it currently appears mid-page with only a small eyebrow ("Live TCM Organ Clock · 子午流注 · 当令时段") for context. First-time visitors think "wait, why is there a clock here?" instead of "oh, interesting." We need to frame it educationally and make it interactive.

CEO has approved:
- **Layout: Option C** — eyebrow + 1-line intriguing question above clock, clock as visual focal point, "Why this matters" explanation below.
- **Interaction: Option C** — only the currently-active organ is clickable by default (the ritual / be-present moment). A small "Explore all organs · 探索所有臟腑" toggle near the clock unlocks all 12 organs for free exploration. Either way, clicking an organ opens a modal with TCM theory, function, common imbalances, and when to seek care.

The clock pairs as the second pillar of HansMed's "interactive TCM education widget" duo (with the Tongue Map widget from Brief #6). Together they create a recognizable signature.

Clock lives at `v3/index.html:824-879`. SVG generator function `drawClock` at line 1612, called at line 1770. The 12 TCM organs and their time windows are presumably defined in that inline script.

---

## TASK A — Add contextual framing around the clock (Option C layout)

In `v3/index.html`, the clock section currently starts at line 828 with just a centered eyebrow. Restructure so all the explanation sits ABOVE the clock — reader gets full context first, clock then visualizes the concept:

```html
<section class="sec sec-white organ-clock-section" style="padding-top:48px;padding-bottom:48px;">
  <!-- Intro block: eyebrow + question + heading + explanation, all ABOVE clock -->
  <div class="organ-clock-intro" style="max-width:680px;margin:0 auto 36px;padding:0 var(--s-3);text-align:center;">
    <div class="eyebrow" style="margin-bottom:12px;">
      <span lang="en">Body wisdom</span>
      <span lang="zh">身體智慧</span>
    </div>
    <p class="organ-clock-question" style="margin-bottom:22px;">
      <span lang="en">Did you know your liver peaks at 2 AM?</span>
      <span lang="zh">您知道您的肝經高峰是凌晨兩點嗎？</span>
    </p>
    <h3 class="organ-clock-h" style="font-family:'Cormorant Garamond',serif;font-weight:400;font-size:clamp(22px,3vw,30px);color:var(--v4-ink);letter-spacing:-0.01em;margin-bottom:18px;">
      <span lang="en">Your body has a <em>24-hour rhythm</em></span>
      <span lang="zh">您的身體有 <em>24小時的節律</em></span>
    </h3>
    <p style="font-size:15px;line-height:1.78;color:var(--v4-mu);font-weight:300;margin-bottom:0;">
      <span lang="en">For 2,000 years, TCM has mapped how vital energy flows through 12 organ meridians — each with a 2-hour peak window. Knowing which organ is at its strongest right now helps you read your symptoms, plan your day, and time your care.</span>
      <span lang="zh">兩千年來，中醫觀察到生命能量在十二經絡間循環流動，每個臟腑都有兩小時的高峰時段。了解此刻哪個臟腑最活躍，有助於理解身體訊號、安排作息、規劃調理。</span>
    </p>
  </div>

  [ existing clock markup at lines 835-878 stays here, untouched except for the
    addition of the "Explore all organs" toggle and the View-info CTA change
    described in Task B ]

  <!-- Below the clock: just a short click instruction (the heading + main
       paragraph are now above the clock, not here) -->
  <p class="organ-clock-click-hint" style="max-width:560px;margin:24px auto 0;padding:0 var(--s-3);font-size:13px;line-height:1.7;color:var(--v4-mu);font-weight:300;font-style:italic;text-align:center;">
    <span lang="en">Click the active organ above to learn its TCM theory, modern function, and what symptoms might suggest care during its window.</span>
    <span lang="zh">點擊上方正在當令的臟腑，了解它的中醫理論、現代生理功能、以及在它當令時可能需要關注的症狀。</span>
  </p>
</section>
```

CSS for the new question line (add to existing `<style>` block in v3/index.html, scoped to `.organ-clock-section`):

```css
.organ-clock-question {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-size: clamp(18px, 2.4vw, 24px);
  font-weight: 400;
  color: var(--v4-tc);
  margin-top: 14px;
  margin-bottom: 0;
  letter-spacing: 0.01em;
}
```

Keep the eyebrow color/treatment matching the rest of the page. The question should feel like a museum caption — quietly intriguing, not loud.

---

## TASK B — Make organs clickable (Option C interaction)

In the inline script that draws the clock (around line 1612-1770), the 12 organ wedges are currently rendered as SVG paths. Add `data-organ` attributes (e.g., `data-organ="lung"`, `data-organ="liver"`) and a CSS class like `clock-organ-wedge` to each so they can be targeted for interaction.

Add a small toggle UI just above the clock SVG (inside the existing clock container):

```html
<div class="organ-clock-toggle" style="display:flex;justify-content:center;align-items:center;gap:10px;margin-bottom:14px;font-size:12px;color:var(--v4-mu);">
  <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
    <input type="checkbox" id="organ-explore-all" style="cursor:pointer;">
    <span lang="en">Explore all organs · </span>
    <span lang="zh">探索所有臟腑</span>
  </label>
  <span style="opacity:0.5;font-size:11px;" id="organ-explore-hint">
    <span lang="en">(default: only the active organ is clickable)</span>
    <span lang="zh">（預設：只可點擊正在當令的臟腑）</span>
  </span>
</div>
```

JS behavior:
- On page load, only the currently-active wedge has `cursor: pointer` and a click handler attached. All other wedges are visually slightly muted (e.g., 60% opacity) and `cursor: default`.
- When the user toggles "Explore all organs" ON: every wedge becomes clickable, opacity returns to 100%, hint text changes to "(all organs unlocked)".
- When toggled OFF: revert to default (only active organ clickable).
- When the active organ changes (every 2 hours, hour boundary), the click eligibility automatically updates.
- Clicking any clickable wedge opens the organ-detail modal (Task C) with that organ's content.

A subtle `:hover` highlight on clickable wedges (slight glow / outline, not a colour shift that fights the existing color palette).

### Sub-task: change the existing CTA below the clock from "Book consult" to "View info"

The existing markup at `v3/index.html:874` contains:

```html
<a id="hm-book-cta" class="btn-v4 btn-dark" ... href="../v2/portal.html#/book">
  <span lang="en" id="hm-book-cta-en">Book a TCM Consultation →</span>
  <span lang="zh" id="hm-book-cta-zh">預約中醫問診 →</span>
</a>
```

The inline clock-update script (around line 1610-1770) dynamically rewrites this button label to "Book a [Pericardium]-window consult →" based on the current active organ.

Replace this button with one that OPENS THE ORGAN-DETAIL MODAL for the currently-active organ instead of routing to booking. New markup:

```html
<button id="hm-info-cta" class="btn-v4 btn-dark" type="button"
        style="width:100%;padding:14px;font-size:13px;font-weight:500;border-radius:10px;justify-content:center;cursor:pointer;border:none;font-family:inherit;">
  <span lang="en" id="hm-info-cta-en">View Pericardium info →</span>
  <span lang="zh" id="hm-info-cta-zh">了解心包詳情 →</span>
</button>
```

Wire its click handler to `openOrganDetailModal(currentActiveOrganKey)` — the same modal opened by clicking the active wedge. The label updates dynamically with the currently-active organ name, mirroring how `hm-book-cta-en/zh` were updated previously (just swap the verb from "Book a [X]-window consult" to "View [X] info" / "了解[X]詳情").

Booking is still possible from inside the modal — the modal's bottom CTA ("Book a [Organ]-window consult →") preserves the path to booking. The flow becomes: see clock → click "View info" → read the educational modal → book if it resonates. Education-led conversion rather than blunt CTA.

Also remove or comment out the previous booking-related JS hook that updates `hm-book-cta-en/zh`. Replace it with the equivalent updater for `hm-info-cta-en/zh`. Don't break anything else the inline script does (time updates, progress bar, tip line all stay).

---

## TASK C — Organ-detail modal with content for all 12 organs

Add a new modal function `openOrganDetailModal(organKey)` that renders a centered modal with the following structure for each organ:

```
[ Organ Chinese character — large, centered ]
[ Organ name EN · ZH ]
[ Pills row: Element · Peak window · Paired meridian ]
[ "TCM theory · 中醫理論" section — what this organ governs ]
[ "Function · 功能" section — what it does (TCM + modern parallel) ]
[ "When out of balance · 失調時" section — common pathogenic conditions ]
[ "When to seek care · 何時就診" section — symptoms suggesting consultation ]
[ CTA: "Book a [Organ]-window consult →" — links to portal.html#/book ]
[ Subtle disclaimer: "Educational content. Not a medical diagnosis." ]
```

Use the same modal pattern as elsewhere in the codebase (centered, dim backdrop, close on backdrop click + Esc + close button). Modal should be reusable — same structure, content varies by organ.

### Educational content for all 12 organs

Add this data structure to the inline script (alongside the existing organ definitions):

```js
var ORGAN_EDU = {
  gallbladder: {
    zh: '膽', enName: 'Gallbladder', element: 'Wood · 木', window: '23:00 – 01:00', paired: 'Liver · 肝',
    theory_en: 'In TCM, the Gallbladder governs decisive judgement and the courage to act. It works in close partnership with the Liver, helping turn intention into decision.',
    theory_zh: '中醫認為，膽主決斷，與肝相表裡。膽氣足則決斷有力，遇事不疑。',
    function_en: 'Stores and releases bile to aid the digestion of fats. In TCM theory, also supports clear thinking and confident decision-making.',
    function_zh: '儲存與排放膽汁，幫助消化脂肪。中醫認為亦主決斷力與清晰思考。',
    imbalance_en: 'Indecisiveness, timidity, bitter taste in the mouth on waking, headaches at the temples, restless sleep between 11 PM and 1 AM.',
    imbalance_zh: '優柔寡斷、易驚膽怯、晨起口苦、太陽穴頭痛、夜半11點至1點難以入睡。',
    seek_care_en: 'Persistent right upper abdominal discomfort, recurring bitter taste, chronic indecisiveness affecting daily life, or sleep disruption around midnight.',
    seek_care_zh: '右上腹持續不適、反覆口苦、長期優柔寡斷影響生活、或半夜時段持續睡眠困擾。',
  },
  liver: {
    zh: '肝', enName: 'Liver', element: 'Wood · 木', window: '01:00 – 03:00', paired: 'Gallbladder · 膽',
    theory_en: 'The Liver governs the smooth flow of qi and blood, stores blood, and houses the ethereal soul (魂). It is the body\'s great strategist — holding plans and direction.',
    theory_zh: '肝主疏泄，藏血，藏魂。中醫稱肝為將軍之官，主謀慮，掌人體氣機之通暢。',
    function_en: 'Detoxifies blood, regulates emotional flow, supports tendon and eye health. Modern parallel: liver metabolism + emotional regulation systems.',
    function_zh: '解毒、藏血、調節情緒、養筋明目。對應現代醫學：肝臟代謝與情緒調節系統。',
    imbalance_en: 'Irritability, frustration, sighing, tight neck and shoulders, menstrual irregularities, dry or bloodshot eyes, waking around 1–3 AM.',
    imbalance_zh: '易怒、鬱悶、嘆息、頸肩緊繃、月經不調、目乾或紅赤、凌晨1至3點易醒。',
    seek_care_en: 'Chronic irritability or low mood, persistent right-side pain, eye problems, menstrual irregularities, or repeatedly waking 1–3 AM.',
    seek_care_zh: '長期煩躁或情緒低落、右側持續疼痛、目疾、月經不調、或反覆於凌晨1至3點驚醒。',
  },
  lung: {
    zh: '肺', enName: 'Lung', element: 'Metal · 金', window: '03:00 – 05:00', paired: 'Large Intestine · 大腸',
    theory_en: 'The Lung governs qi and respiration, controls the skin and body hair, and houses the corporeal soul (魄). It is the prime minister of organs — distributing qi throughout the body.',
    theory_zh: '肺主氣，司呼吸，主皮毛，藏魄。中醫稱肺為相傅之官，朝百脈，輸布氣血津液。',
    function_en: 'Gas exchange, oxygenation, immune defence at the body surface. Modern parallel: respiratory + skin barrier + frontline immunity.',
    function_zh: '氣體交換、供氧、體表免疫防護。對應現代醫學：呼吸系統、皮膚屏障、第一線免疫。',
    imbalance_en: 'Shortness of breath, weak voice, frequent colds, dry or sensitive skin, grief or melancholy that lingers, waking around 3–5 AM.',
    imbalance_zh: '氣短、聲音低弱、易感冒、皮膚乾燥或敏感、悲憂難解、凌晨3至5點易醒。',
    seek_care_en: 'Chronic cough, persistent shortness of breath, recurring respiratory infections, unresolved grief affecting wellbeing, or skin conditions that won\'t settle.',
    seek_care_zh: '慢性咳嗽、持續氣短、反覆呼吸道感染、長期悲傷影響身心、或久治不癒之皮膚問題。',
  },
  large_intestine: {
    zh: '大腸', enName: 'Large Intestine', element: 'Metal · 金', window: '05:00 – 07:00', paired: 'Lung · 肺',
    theory_en: 'The Large Intestine governs the elimination of waste — both physical and metaphorical. In TCM theory, it also supports the ability to "let go" emotionally.',
    theory_zh: '大腸主傳導，將廢物排出體外。中醫認為亦助於情志的「放下」與更新。',
    function_en: 'Reabsorbs water and forms stool. Modern parallel: colon function, microbiome health, regular elimination.',
    function_zh: '吸收水分、形成糞便。對應現代醫學：大腸功能、腸道菌群、規律排便。',
    imbalance_en: 'Constipation or loose stools, bloating, difficulty letting go of past hurts, abdominal cramping, skin breakouts (TCM links skin to large intestine).',
    imbalance_zh: '便秘或便溏、腹脹、難以放下舊事、腹部絞痛、皮膚痘瘡（中醫認為肺與大腸相表裡，影響皮膚）。',
    seek_care_en: 'Chronic constipation or diarrhoea, blood in stool, persistent abdominal pain, or recurring skin issues alongside digestive problems.',
    seek_care_zh: '長期便秘或腹瀉、便血、持續腹痛、或皮膚問題與消化問題並存反覆發作。',
  },
  stomach: {
    zh: '胃', enName: 'Stomach', element: 'Earth · 土', window: '07:00 – 09:00', paired: 'Spleen · 脾',
    theory_en: 'The Stomach is the "sea of grain and water" — receiving food and beginning digestion. It works in close partnership with the Spleen as the centre of post-natal qi.',
    theory_zh: '胃為水穀之海，主受納腐熟。與脾相表裡，共為後天之本。',
    function_en: 'Mechanical and chemical breakdown of food. Modern parallel: gastric digestion, acid production, gastric emptying.',
    function_zh: '對食物進行機械與化學的初步消化。對應現代醫學：胃部消化、胃酸分泌、胃排空。',
    imbalance_en: 'Acid reflux, bad breath, hunger pangs without appetite, mouth ulcers, bloating after meals, irregular eating disrupting the 7–9 AM window.',
    imbalance_zh: '胃酸逆流、口臭、飢而不欲食、口瘡、餐後腹脹、不按時進餐影響晨間7至9點吸收。',
    seek_care_en: 'Persistent reflux, recurring mouth ulcers, unexplained weight loss, blood in vomit or stool, or chronic loss of appetite.',
    seek_care_zh: '持續胃酸逆流、反覆口瘡、不明原因消瘦、嘔吐物或糞便帶血、或長期食慾不振。',
  },
  spleen: {
    zh: '脾', enName: 'Spleen', element: 'Earth · 土', window: '09:00 – 11:00', paired: 'Stomach · 胃',
    theory_en: 'The Spleen governs transformation and transport — turning food into qi and blood. It also "holds" the blood in vessels and supports the muscles and limbs.',
    theory_zh: '脾主運化，化生氣血，統血，主肌肉四肢。為氣血生化之源。',
    function_en: 'In TCM the "spleen" is closer to the modern understanding of pancreas + small intestine + lymphatic absorption, not just the anatomical spleen organ.',
    function_zh: '中醫所稱「脾」涵蓋現代醫學的胰臟、小腸、淋巴吸收等多個系統，並非僅指脾臟本身。',
    imbalance_en: 'Fatigue (especially after meals), poor appetite, loose stools, easy bruising, heavy or foggy thinking, swollen tongue with teeth marks.',
    imbalance_zh: '疲倦（餐後尤甚）、食慾不振、便溏、易瘀青、頭重思緒不清、舌胖有齒痕。',
    seek_care_en: 'Chronic fatigue with digestive symptoms, unexplained bruising, persistent loose stools, or significant appetite loss affecting nutrition.',
    seek_care_zh: '慢性疲勞伴消化不良、不明原因瘀青、持續便溏、或食慾顯著下降影響營養。',
  },
  heart: {
    zh: '心', enName: 'Heart', element: 'Fire · 火', window: '11:00 – 13:00', paired: 'Small Intestine · 小腸',
    theory_en: 'The Heart governs blood and houses the spirit (神). It is the emperor of organs — when the Heart is settled, all other organs follow in harmony.',
    theory_zh: '心主血脈，藏神。中醫稱心為君主之官，心定則五臟和。',
    function_en: 'Pumps blood throughout the body. Modern parallel: cardiovascular function + the broader nervous-system seat of consciousness and emotional clarity.',
    function_zh: '推動血液循環全身。對應現代醫學：心血管功能、以及神經系統所主之意識與情志清明。',
    imbalance_en: 'Palpitations, anxiety, insomnia (especially difficulty falling asleep), tongue tip redness, vivid or disturbing dreams, easily startled.',
    imbalance_zh: '心悸、焦慮、入睡困難、舌尖紅赤、多夢易驚、稍受刺激即受驚。',
    seek_care_en: 'Persistent chest pain or palpitations, severe insomnia, sudden anxiety attacks, or any cardiovascular symptom — please also see a Western doctor for any chest symptom.',
    seek_care_zh: '持續胸悶心悸、嚴重失眠、突發焦慮、或任何心血管症狀 —— 任何胸部症狀亦請同時就診西醫。',
  },
  small_intestine: {
    zh: '小腸', enName: 'Small Intestine', element: 'Fire · 火', window: '13:00 – 15:00', paired: 'Heart · 心',
    theory_en: 'The Small Intestine separates the pure from the impure — clear nutrients ascend to nourish, turbid waste descends. It also helps the mind discern what to keep and what to release.',
    theory_zh: '小腸主分清泌濁 —— 清者上升以養身，濁者下降以排出。亦助心神辨明取捨。',
    function_en: 'Major site of nutrient absorption. Modern parallel: small bowel absorption, microbiome diversity in the upper intestine.',
    function_zh: '主要吸收養分之處。對應現代醫學：小腸吸收、上段腸道菌群多樣性。',
    imbalance_en: 'Lower abdominal discomfort after lunch, difficulty discerning priorities, urinary symptoms (TCM links small intestine and bladder), painful or scant urination.',
    imbalance_zh: '午餐後下腹不適、難以判斷輕重緩急、小便異常（中醫認為小腸與膀胱相關）、小便短赤或刺痛。',
    seek_care_en: 'Chronic lower abdominal pain, persistent malabsorption symptoms (weight loss, nutritional deficiency), or recurring urinary tract symptoms.',
    seek_care_zh: '慢性下腹疼痛、持續吸收不良（體重下降、營養缺乏）、或反覆泌尿道症狀。',
  },
  bladder: {
    zh: '膀胱', enName: 'Bladder', element: 'Water · 水', window: '15:00 – 17:00', paired: 'Kidney · 腎',
    theory_en: 'The Bladder stores and releases water. The Bladder meridian is the longest in the body, running from the head down the back to the feet — it carries the body\'s defensive qi along the spine.',
    theory_zh: '膀胱主藏津液。足太陽膀胱經為人體最長之經，自頭沿背走足，行衛氣於背部。',
    function_en: 'Stores urine until release. Modern parallel: urinary bladder function plus the broader autonomic regulation along the spine.',
    function_zh: '儲存與排放尿液。對應現代醫學：膀胱功能、以及沿脊柱之自主神經調節。',
    imbalance_en: 'Frequent or scant urination, urinary urgency, lower back pain, neck and shoulder tension along the bladder meridian, late-afternoon energy slump.',
    imbalance_zh: '小便頻數或短少、尿急、腰痛、頸肩沿膀胱經緊繃、午後體力下降。',
    seek_care_en: 'Persistent urinary frequency or urgency, blood in urine, recurring back or neck pain, or unexplained late-afternoon fatigue affecting daily life.',
    seek_care_zh: '持續尿頻或尿急、尿血、反覆腰頸疼痛、或不明原因午後疲憊影響生活。',
  },
  kidney: {
    zh: '腎', enName: 'Kidney', element: 'Water · 水', window: '17:00 – 19:00', paired: 'Bladder · 膀胱',
    theory_en: 'The Kidney stores Essence (精) — the foundation of constitution, growth, reproduction, and longevity. In TCM, the Kidney is "the root of pre-natal qi" — what your parents gave you.',
    theory_zh: '腎藏精，主生殖、生長、發育、壽命。腎為先天之本 —— 來自父母之根本能量。',
    function_en: 'Filters blood, regulates fluid balance, governs the adrenal-reproductive axis. Modern parallel: renal function plus endocrine systems including adrenal and gonadal hormones.',
    function_zh: '過濾血液、調節水液、主導腎上腺與生殖軸。對應現代醫學：腎臟功能、腎上腺與性腺內分泌。',
    imbalance_en: 'Low back pain, weak knees, ringing in the ears, hair loss or premature greying, low libido, fearfulness, dark circles under the eyes.',
    imbalance_zh: '腰痠膝軟、耳鳴、脫髮或早白、性欲低下、易恐懼、目下黑暈。',
    seek_care_en: 'Persistent lower back or knee pain, swelling in legs/feet, changes in urination, hearing problems, or fertility/hormonal concerns.',
    seek_care_zh: '持續腰膝疼痛、下肢水腫、小便異常、聽力問題、或生殖與荷爾蒙相關之困擾。',
  },
  pericardium: {
    zh: '心包', enName: 'Pericardium', element: 'Fire · 火', window: '19:00 – 21:00', paired: 'Triple Warmer · 三焦',
    theory_en: 'The Pericardium is the Heart\'s protector — it shields the emperor (Heart) from external pathogens and emotional shock. It governs the warmth of intimate connection.',
    theory_zh: '心包為心之外衛，代心受邪。中醫稱之為臣使之官，主喜樂、人際溫情之傳達。',
    function_en: 'Anatomically the membrane around the heart. In TCM, also the seat of emotional warmth and intimate connection — chest tightness from heartbreak lives here.',
    function_zh: '解剖上為心臟外膜。中醫認為亦主情感溫度與親密連結 —— 失戀之胸悶即與心包相關。',
    imbalance_en: 'Chest tightness, palpitations linked to emotional stress, difficulty in close relationships, evening anxiety, hot palms.',
    imbalance_zh: '胸悶、情緒壓力引發之心悸、人際親密困難、晚間焦慮、手心發熱。',
    seek_care_en: 'Persistent chest tightness, panic attacks at night, palpitations linked to emotional triggers, or chronic difficulty in close relationships affecting wellbeing.',
    seek_care_zh: '持續胸悶、夜間恐慌發作、情緒觸發之心悸、或親密關係困擾長期影響身心。',
  },
  triple_warmer: {
    zh: '三焦', enName: 'Triple Warmer', element: 'Fire · 火', window: '21:00 – 23:00', paired: 'Pericardium · 心包',
    theory_en: 'The Triple Warmer (San Jiao) is the unique TCM organ with no Western anatomical equivalent. It coordinates the upper, middle, and lower body cavities — governing fluid metabolism, temperature regulation, and overall qi flow.',
    theory_zh: '三焦為中醫特有之腑，無西醫對應實體。統管上中下三焦，主水液代謝、體溫調節、氣機通暢。',
    function_en: 'A "functional system" rather than a single organ — coordinates how qi and fluids move between body cavities. Modern parallel: lymphatic system + autonomic temperature regulation + interstitial fluid network.',
    function_zh: '功能性系統，非單一臟器 —— 協調氣血津液在三焦間流動。對應現代醫學：淋巴系統、體溫自主調節、組織間液網絡。',
    imbalance_en: 'Difficulty regulating temperature (always hot or always cold), edema, metabolic sluggishness, evening restlessness, trouble winding down for sleep.',
    imbalance_zh: '體溫調節失常（常熱或常冷）、水腫、代謝遲緩、晚間躁動、難以放鬆入睡。',
    seek_care_en: 'Persistent edema, severe temperature dysregulation, chronic insomnia in the 9–11 PM window, or metabolic concerns alongside fluid retention.',
    seek_care_zh: '持續水腫、嚴重體溫失調、晚間9至11點長期失眠、或代謝問題伴水液滯留。',
  },
};
```

The modal opens with content rendered from the matching `ORGAN_EDU` entry, in the user's current language (EN or ZH).

---

## ACCEPTANCE CRITERIA

- v3/index.html organ clock section now has: eyebrow + intriguing question above clock + clock + "Why this matters" 2-paragraph explanation below.
- "Explore all organs" toggle visible just above the clock SVG.
- By default (toggle OFF), only the currently-active organ wedge is clickable; others are slightly muted and cursor:default.
- Toggling ON unlocks all 12 organs for clicking; toggling OFF re-locks them.
- Clicking any clickable wedge opens a modal with the full educational content for that organ (TCM theory, function, common imbalances, when to seek care) in the active language.
- The "View [Organ] info →" button below the clock opens the SAME modal for the currently-active organ. Booking CTA inside the modal preserves the path to a consultation.
- Old "Book a [Organ]-window consult →" button is GONE from the visible clock area. Booking is reached via: clock → View info → read modal → book.
- Modal closes on backdrop click, Esc key, and the close button.
- All 12 organs from `ORGAN_EDU` render correctly when their modal is opened.
- The clock continues to update every minute as before — the active organ change automatically updates click eligibility.
- Bilingual: all new copy renders in both EN and ZH modes via the existing `<span lang>` switching.
- Mobile: layout stacks cleanly; modal is scrollable if content exceeds viewport.
- v2/ files are NOT modified.
- No regressions on the rest of v3/index.html (hero, brand story, services, tongue widget if Brief #6 already shipped, footer).

## REPORT BACK

```
Files changed: [paths + line numbers]
Pushed to: [commit hash]
Intro question + "Why this matters" rendered: [yes/no]
Toggle works: [default locks all but active / ON unlocks all]
Modal opens for currently-active organ: [yes/no]
Modal opens for arbitrary organ when toggle ON: [yes/no]
All 12 organs have content rendered correctly: [yes/no]
Active organ click-eligibility updates when the clock advances: [yes/no — say what test you did]
Mobile layout (≤640px) tested: [yes/no]
v2/ files touched: [should be 'none']
Anything left as TODO: [list]
```

If the inline `drawClock` script's data structure makes it hard to add `data-organ` attributes per wedge, STOP and report — don't refactor the clock script just to add interaction; we'd want to scope that as a separate task.
