# Brief #14a-fix-2 — Constitution card: data restructure + improved Chinese translations

**Classification: REFACTOR + CONTENT QUALITY — scope: restructure HERB_MAP from concatenated bilingual strings to clean `{en, zh}` objects in `v2/assets/js/components/constitution-card.js`. Rewrite all Chinese translations for quality and standardize on traditional characters. Update renderAdvice() to use the new structure. Keep splitBilingual as fallback for legacy patient records still saved with old format.**

## Background

After Brief #14a-fix ran, CEO confirmed the language switcher mostly works BUT some entries still show both languages stacked (screenshot 2026-05-04):
- "Polished rice & glutinous rice (粳米、糯米) 粳米、糯米" — splitBilingual regex couldn't parse parens-format and fell through to "show full string in both languages"
- "(less) Iced drinks · ice cream · cold raw foods 冰飲、雪糕、生冷食物" — same fallback issue (regex doesn't allow parens, `·` separator, or non-letter chars in EN)
- "Staying up past 11pm 熬夜過11點" — fails because regex doesn't allow digits in EN portion
- "平和体质" — simplified Chinese (体) instead of traditional (體)
- Translations are abrupt / don't match English meaning (e.g., 中: "維持健康作息" is shorter than EN: "Maintain your healthy routine — balanced diet, regular exercise, sleep.")

**Root cause:** the `HERB_MAP` data in the component stores bilingual content as concatenated strings (e.g., `'薑茶 Ginger tea'`). This is inherently fragile — splitBilingual can only parse simple "ZH SPACE EN" patterns. Anything more complex breaks.

**The real fix:** restructure the data itself to use `{en, zh}` objects, eliminating the need for runtime string parsing entirely. While we're in there, audit all Chinese for:
1. Simplified → traditional conversion (体→體, 视→視, 师→師, 质→質, 验→驗, etc.)
2. Translation quality (Chinese should match English meaning, not be abruptly truncated)
3. Punctuation consistency (use full-width Chinese punctuation 「」、 not ASCII)

Patient view (`ai-diagnosis.js`) consumes the same HERB_MAP via `HM.constitutionCard.HERB_MAP` after Brief #14a refactor — so this fix benefits BOTH views.

## TASK A — Pre-flight snapshot

```bash
SNAP=/sessions/lucid-gallant-goldberg/mnt/Hansmed-system/briefs/snapshots/brief-14a-fix-2-pre-migration
mkdir -p $SNAP
cp /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/components/constitution-card.js $SNAP/constitution-card.js
```

Create `$SNAP/README.md`:
```markdown
# Brief #14a-fix-2 snapshot
Pre-migration backup of constitution-card.js. To rollback:
cp constitution-card.js → /v2/assets/js/components/constitution-card.js
git add -A && git commit -m "Rollback Brief #14a-fix-2"
git push
```

## TASK B — Restructure HERB_MAP to use {en, zh} objects

Open `v2/assets/js/components/constitution-card.js`. Find the `HERB_MAP` object (moved here from ai-diagnosis.js by Brief #14a). Replace the entire HERB_MAP definition with the new structured version below.

**OLD format:**
```js
'Balanced Constitution': { herbs: ['枸杞 Gou Qi','菊花 Ju Hua','靈芝 Ling Zhi','大棗 Da Zao'], foods: ['均衡飲食 Balanced diet','時令蔬果 Seasonal vegetables & fruit'], avoid: 'Overworking & irregular sleep · 忌過勞及作息不規律' },
```

**NEW format (replace HERB_MAP entirely with this):**

```js
var HERB_MAP = {
  'Qi Deficiency': {
    herbs: [
      { en: 'Huang Qi',     zh: '黃耆' },
      { en: 'Dang Shen',    zh: '黨參' },
      { en: 'Bai Zhu',      zh: '白朮' },
      { en: 'Da Zao',       zh: '大棗' },
      { en: 'Zhi Gan Cao',  zh: '炙甘草' },
    ],
    foods: [
      { en: 'Yam',                  zh: '山藥' },
      { en: 'Red dates',            zh: '紅棗' },
      { en: 'Millet congee',        zh: '小米粥' },
      { en: 'Chicken broth',        zh: '雞湯' },
    ],
    avoid: {
      en: 'Raw & cold foods; avoid excessive sweating',
      zh: '忌生冷食物，避免過度出汗',
    },
  },
  'Blood Deficiency': {
    herbs: [
      { en: 'Shu Di Huang', zh: '熟地黃' },
      { en: 'Dang Gui',     zh: '當歸' },
      { en: 'Bai Shao',     zh: '白芍' },
      { en: 'E Jiao',       zh: '阿膠' },
      { en: 'Long Yan Rou', zh: '龍眼肉' },
    ],
    foods: [
      { en: 'Pork liver',           zh: '豬肝' },
      { en: 'Black sesame',         zh: '黑芝麻' },
      { en: 'Spinach',              zh: '菠菜' },
      { en: 'Wolfberry',            zh: '枸杞' },
    ],
    avoid: {
      en: 'Spicy and drying foods; avoid late nights',
      zh: '忌辛辣燥熱食物，避免熬夜',
    },
  },
  'Blood Stasis': {
    herbs: [
      { en: 'Dan Shen',     zh: '丹參' },
      { en: 'Chuan Xiong',  zh: '川芎' },
      { en: 'Tao Ren',      zh: '桃仁' },
      { en: 'Hong Hua',     zh: '紅花' },
      { en: 'Yi Mu Cao',    zh: '益母草' },
    ],
    foods: [
      { en: 'Hawthorn',             zh: '山楂' },
      { en: 'Black fungus',         zh: '黑木耳' },
      { en: 'Vinegar',              zh: '醋' },
      { en: 'Rose tea',             zh: '玫瑰花茶' },
    ],
    avoid: {
      en: 'Cold foods and prolonged sitting; keep moving',
      zh: '忌生冷食物，避免久坐，保持活動',
    },
  },
  'Qi Stagnation': {
    herbs: [
      { en: 'Chai Hu',      zh: '柴胡' },
      { en: 'Xiang Fu',     zh: '香附' },
      { en: 'Mei Gui Hua',  zh: '玫瑰花' },
      { en: 'He Huan Pi',   zh: '合歡皮' },
      { en: 'Yu Jin',       zh: '鬱金' },
    ],
    foods: [
      { en: 'Citrus fruits',        zh: '柑橘類' },
      { en: 'Jasmine tea',          zh: '茉莉花茶' },
      { en: 'Mint',                 zh: '薄荷' },
      { en: 'Hawthorn',             zh: '山楂' },
    ],
    avoid: {
      en: 'Isolation and overthinking; seek social connection',
      zh: '避免獨處及過度思慮，多與人交流',
    },
  },
  'Spleen Deficiency': {
    herbs: [
      { en: 'Fu Ling',      zh: '茯苓' },
      { en: 'Bai Zhu',      zh: '白朮' },
      { en: 'Shan Yao',     zh: '山藥' },
      { en: 'Yi Yi Ren',    zh: '薏苡仁' },
      { en: 'Lian Zi',      zh: '蓮子' },
    ],
    foods: [
      { en: 'Pumpkin',              zh: '南瓜' },
      { en: 'Millet',               zh: '小米' },
      { en: 'Lotus root',           zh: '蓮藕' },
      { en: 'Tofu',                 zh: '豆腐' },
    ],
    avoid: {
      en: 'Cold foods and irregular meals; eat at consistent times',
      zh: '忌生冷食物，三餐定時定量',
    },
  },
  'Deficiency Heat (Yin Xu)': {
    herbs: [
      { en: 'Mai Dong',     zh: '麥冬' },
      { en: 'Shi Hu',       zh: '石斛' },
      { en: 'Yu Zhu',       zh: '玉竹' },
      { en: 'Bai He',       zh: '百合' },
      { en: 'Gou Qi Zi',    zh: '枸杞子' },
    ],
    foods: [
      { en: 'Pear',                 zh: '雪梨' },
      { en: 'White fungus',         zh: '銀耳' },
      { en: 'Honey',                zh: '蜂蜜' },
      { en: 'Soy milk',             zh: '豆漿' },
    ],
    avoid: {
      en: 'Spicy and fried foods; avoid staying up late',
      zh: '忌辛辣煎炸食物，避免熬夜',
    },
  },
  'Deficiency Cold (Yang Xu)': {
    herbs: [
      { en: 'Fu Zi',        zh: '附子' },
      { en: 'Rou Gui',      zh: '肉桂' },
      { en: 'Gan Jiang',    zh: '乾薑' },
      { en: 'Du Zhong',     zh: '杜仲' },
      { en: 'Yin Yang Huo', zh: '淫羊藿' },
    ],
    foods: [
      { en: 'Ginger tea',           zh: '薑茶' },
      { en: 'Walnut',               zh: '核桃' },
      { en: 'Chives',               zh: '韭菜' },
      { en: 'Lamb',                 zh: '羊肉' },
    ],
    avoid: {
      en: 'Cold environments and raw foods; keep warm',
      zh: '避免受寒，忌生冷食物，注意保暖',
    },
  },
  'Dampness / Phlegm': {
    herbs: [
      { en: 'Cang Zhu',     zh: '蒼朮' },
      { en: 'Fu Ling',      zh: '茯苓' },
      { en: 'Ban Xia',      zh: '半夏' },
      { en: 'Chen Pi',      zh: '陳皮' },
      { en: 'Yi Yi Ren',    zh: '薏苡仁' },
    ],
    foods: [
      { en: "Job's tears soup",     zh: '薏仁湯' },
      { en: 'Winter melon',         zh: '冬瓜' },
      { en: 'Corn silk tea',        zh: '玉米鬚茶' },
      { en: 'Mung bean',            zh: '綠豆' },
    ],
    avoid: {
      en: 'Dairy, fried food, and alcohol; reduce sweet drinks',
      zh: '忌奶製品、煎炸食物及酒精，少喝甜飲',
    },
  },
  'Allergic Constitution': {
    herbs: [
      { en: 'Huang Qi',     zh: '黃耆' },
      { en: 'Fang Feng',    zh: '防風' },
      { en: 'Bai Zhu',      zh: '白朮' },
      { en: 'Chan Tui',     zh: '蟬蛻' },
      { en: 'Wu Mei',       zh: '烏梅' },
    ],
    foods: [
      { en: 'Honey water',          zh: '蜂蜜水' },
      { en: 'Ginger tea',           zh: '生薑茶' },
      { en: 'Red dates',            zh: '紅棗' },
    ],
    avoid: {
      en: 'Known allergens, cold and dusty environments',
      zh: '避免已知過敏原，遠離寒冷及多塵環境',
    },
  },
  'Poor Sleep': {
    herbs: [
      { en: 'Suan Zao Ren', zh: '酸棗仁' },
      { en: 'Bai Zi Ren',   zh: '柏子仁' },
      { en: 'Ye Jiao Teng', zh: '夜交藤' },
      { en: 'He Huan Hua',  zh: '合歡花' },
      { en: 'Long Yan Rou', zh: '龍眼肉' },
    ],
    foods: [
      { en: 'Lily and lotus seed soup', zh: '百合蓮子湯' },
      { en: 'Warm milk',                zh: '熱牛奶' },
      { en: 'Walnut',                   zh: '核桃' },
    ],
    avoid: {
      en: 'Caffeine after 2pm; no screens 1 hour before bed',
      zh: '下午2點後忌咖啡因，睡前1小時遠離電子產品',
    },
  },
  'Balanced Constitution': {
    herbs: [
      { en: 'Gou Qi',       zh: '枸杞' },
      { en: 'Ju Hua',       zh: '菊花' },
      { en: 'Ling Zhi',     zh: '靈芝' },
      { en: 'Da Zao',       zh: '大棗' },
    ],
    foods: [
      { en: 'Balanced diet',                    zh: '均衡飲食' },
      { en: 'Seasonal vegetables and fruits',   zh: '時令蔬果' },
    ],
    avoid: {
      en: 'Overworking and irregular sleep; maintain a regular routine',
      zh: '忌過勞，保持規律作息',
    },
  },
};
```

## TASK C — Standardize getTips() Chinese to traditional + improve quality

Find the `getTips()` function in constitution-card.js (moved from ai-diagnosis.js around line 802). Update each tip's Chinese to use traditional characters and rewrite for clarity:

Replace the entire getTips function body with:

```js
function getTips(d) {
  var tips = [];
  if (d.qi_xu <= -1) tips.push({
    icon: '😴',
    en: 'Rest adequately. Avoid overexertion. Light exercise like Tai Chi or walking helps build energy gently.',
    zh: '充分休息，避免過勞。練太極或散步等輕度運動，可溫和地補益元氣。',
  });
  if (d.qi_xu >= 1) tips.push({
    icon: '🧘',
    en: 'Channel excess energy into calming practices — meditation, deep breathing, gentle yoga.',
    zh: '透過冥想、深呼吸、和緩瑜伽等練習，平和地疏導旺盛的能量。',
  });
  if (d.xue_xu <= -1) tips.push({
    icon: '💤',
    en: 'Sleep before 11pm. Iron-rich foods (dark leafy greens, liver, red dates) help replenish blood.',
    zh: '晚上11點前入睡。多吃深綠色蔬菜、豬肝、紅棗等補血食物。',
  });
  if (d.xue_xu >= 1) tips.push({
    icon: '🌿',
    en: 'Cool and calm — avoid spicy heating foods. Drink chrysanthemum or green tea.',
    zh: '清涼安神 —— 避免辛辣燥熱食物，可飲菊花茶或綠茶。',
  });
  if (d.ti_re <= -1) tips.push({
    icon: '💧',
    en: 'Drink at least 8 glasses of water daily. Sleep early. Avoid spicy and grilled foods.',
    zh: '每天至少喝8杯水，早睡，避免辛辣燒烤食物。',
  });
  if (d.ti_re >= 1) tips.push({
    icon: '🥒',
    en: 'Cool the system — drink mung bean soup, eat cucumber, watermelon, bitter melon.',
    zh: '清熱降火 —— 飲綠豆湯，多吃黃瓜、西瓜、苦瓜等清涼食物。',
  });
  if (d.ti_han <= -1) tips.push({
    icon: '🧣',
    en: 'Keep your waist and knees warm. Drink ginger tea daily. Moxibustion is recommended.',
    zh: '注意腰腿保暖，每天飲薑茶。建議搭配艾灸調理。',
  });
  if (d.ti_han >= 1) tips.push({
    icon: '☀️',
    en: 'Get sunshine and gentle warmth — but avoid overheating. Layer clothing for changing temperatures.',
    zh: '適當曬太陽，溫和保暖 —— 但避免過熱。穿著分層以應對溫度變化。',
  });
  if (d.shi_qi >= 1) tips.push({
    icon: '🏃',
    en: 'Regular aerobic exercise. Low-sugar diet. Avoid sitting more than 1 hour at a time.',
    zh: '定期有氧運動，低糖飲食，避免連續久坐超過1小時。',
  });
  if (d.shi_qi <= -1) tips.push({
    icon: '🫧',
    en: 'Increase fluid intake with warm drinks. Avoid drying foods like chips, crackers, and instant noodles.',
    zh: '多飲溫熱飲品補充水分，避免餅乾、薯片、泡麵等燥熱食物。',
  });
  if (d.qi_zhi >= 1) tips.push({
    icon: '🌸',
    en: 'Move and connect — daily walks in nature, social time with friends, gentle stretching.',
    zh: '多活動、多交流 —— 每日到戶外散步，與朋友相聚，做和緩伸展。',
  });
  if (d.xue_yu >= 1) tips.push({
    icon: '🌹',
    en: 'Move blood gently — daily walking, warm hawthorn tea, avoid prolonged sitting.',
    zh: '溫和活血 —— 每日散步，飲溫熱山楂茶，避免久坐。',
  });
  if (d.pi_wei <= -1) tips.push({
    icon: '🍚',
    en: 'Eat warm cooked foods. Smaller, more frequent meals. Chew thoroughly.',
    zh: '吃溫熱熟食，少量多餐，細嚼慢嚥。',
  });
  if (d.pi_wei >= 1) tips.push({
    icon: '🥗',
    en: 'Eat at regular times. Stop at 80% full. Lighter dinner.',
    zh: '定時用餐，吃八分飽，晚餐宜清淡。',
  });
  if (d.shui_mian <= -1) tips.push({
    icon: '🌙',
    en: 'Wind down 1 hour before bed: dim lights, no screens, warm bath or reading.',
    zh: '睡前1小時放鬆 —— 調暗燈光，遠離電子產品，泡溫水澡或閱讀。',
  });
  if (d.min_li >= 1) tips.push({
    icon: '🌾',
    en: 'Strengthen immunity gradually — moderate exercise, balanced sleep, avoid known triggers.',
    zh: '循序漸進地增強免疫力 —— 適度運動、規律睡眠、避免已知過敏原。',
  });
  return tips;
}
```

## TASK D — Standardize getConstitution() Chinese to traditional

Find the `getConstitution()` function (around line 779 in original ai-diagnosis.js, now in constitution-card.js). Audit every Chinese string and convert simplified characters to traditional. Below is the full updated version — replace the entire function:

```js
function getConstitution(d) {
  var types = [];
  if (d.qi_xu <= -1) types.push({ l: 'Qi Deficiency',           c: '氣虛質',   col: 'blue',   d: 'Low energy, easily fatigued, weak immunity, short of breath.', dZh: '體力不足、容易疲倦、免疫力偏低、呼吸容易感到氣短。' });
  if (d.qi_xu >= 1)  types.push({ l: 'Qi Excess',               c: '氣盛質',   col: 'red',    d: 'Overactive energy, prone to irritability and agitation.',       dZh: '精力過旺、容易煩躁不安、情緒激動、難以靜下來。' });
  if (d.qi_zhi >= 1) types.push({ l: 'Qi Stagnation',           c: '氣鬱質',   col: 'yellow', d: 'Mood swings, chest tightness, frequent sighing, sensitive to stress.', dZh: '情緒起伏、胸悶、常嘆氣、對壓力敏感。' });
  if (d.pi_wei <= -1) types.push({ l: 'Spleen-Stomach Deficiency', c: '脾胃虛弱', col: 'blue',  d: 'Poor appetite, bloating after meals, soft stools, low energy after eating.', dZh: '胃口不佳、飯後脹氣、大便偏軟、餐後疲倦。' });
  if (d.pi_wei >= 1) types.push({ l: 'Spleen-Stomach Excess',   c: '脾胃實熱', col: 'red',    d: 'Strong appetite, bad breath, constipation, easily hungry.',     dZh: '食慾旺盛、口臭、便秘、容易飢餓。' });
  if (d.xue_xu <= -1) types.push({ l: 'Blood Deficiency',       c: '血虛質',   col: 'blue',   d: 'Pale complexion, dizziness, dry hair and nails, insomnia.',     dZh: '面色蒼白、頭暈目眩、頭髮指甲乾脆、睡眠質素差。' });
  if (d.xue_xu >= 1) types.push({ l: 'Blood Heat',              c: '血熱質',   col: 'red',    d: 'Flushed face, nosebleeds, inflamed skin conditions.',           dZh: '面色偏紅、容易流鼻血、皮膚易發炎。' });
  if (d.xue_yu >= 1) types.push({ l: 'Blood Stasis',            c: '血瘀質',   col: 'red',    d: 'Fixed stabbing pain, dark spots on skin, painful periods with clots.', dZh: '定點刺痛、皮膚有暗斑、經期疼痛伴血塊。' });
  if (d.ti_re <= -1) types.push({ l: 'Yin Deficiency Heat',     c: '陰虛內熱', col: 'red',    d: 'Warm palms and soles, night sweats, afternoon flushing, dry mouth.', dZh: '手腳心發熱、夜間盜汗、午後潮熱、口乾舌燥。' });
  if (d.ti_re >= 1)  types.push({ l: 'Excess Heat (Shi Re)',    c: '實熱質',   col: 'red',    d: 'Bad breath, constipation, inflamed acne, irritability.',       dZh: '口氣重、便秘、紅腫痘痘、體內實火旺盛。' });
  if (d.ti_han <= -1) types.push({ l: 'Yang Deficiency Cold',   c: '陽虛體寒', col: 'blue',   d: 'Cold extremities, loose stools, low metabolism.',               dZh: '四季手腳冰冷、大便偏軟、代謝偏低。' });
  if (d.ti_han >= 1) types.push({ l: 'Excess Cold (Shi Han)',   c: '實寒質',   col: 'blue',   d: 'Severe cramping from cold exposure, chills.',                    dZh: '受寒後腹部劇烈絞痛、畏寒明顯。' });
  if (d.shi_qi <= -1) types.push({ l: 'Yin Dryness',            c: '陰燥質',   col: 'yellow', d: 'Dry skin, persistent thirst, dryness unrelieved by water.',     dZh: '皮膚乾燥、持續口渴、津液虧損。' });
  if (d.shi_qi >= 1) types.push({ l: 'Dampness / Phlegm',       c: '痰濕質',   col: 'blue',   d: 'Heavy body, sluggish digestion, water retention, sticky stools.', dZh: '身體沉重、消化遲緩、容易水腫、大便黏膩。' });
  if (d.shui_mian <= -1) types.push({ l: 'Poor Sleep',          c: '睡眠不安', col: 'yellow', d: 'Light sleeper, frequent waking, difficulty falling asleep.',  dZh: '睡眠淺、容易驚醒、入睡困難。' });
  if (d.min_li >= 1) types.push({ l: 'Allergic Constitution',   c: '特稟質',   col: 'yellow', d: 'Sensitive to allergens, prone to seasonal reactions.',           dZh: '對過敏原敏感、易出現季節性過敏反應。' });
  if (! types.length) types.push({ l: 'Balanced Constitution',  c: '平和質',   col: 'green',  d: 'Strong qi, smooth blood, balanced yin and yang. Maintain your healthy habits.', dZh: '氣血充盈、陰陽平衡。請繼續保持健康的生活習慣。' });
  return types;
}
```

**Critical:** notice the Balanced Constitution case (`平和質` not `平和體質` or `平和体质`). The official TCM 9-constitution naming uses `平和質`. If you see references to 平和體質 elsewhere in the codebase, those are the same thing — just use `平和質` consistently here.

## TASK E — Update renderAdvice() to handle BOTH new and legacy formats

Find `renderAdvice()` in constitution-card.js. Replace the food/herb mapping logic. The new logic detects: if input is an object with `{en, zh}`, use directly; if string, fall back to splitBilingual.

Replace the existing food block:

```js
    if (Array.isArray(adviceObj.foods) && adviceObj.foods.length) {
      sections.push('<div style="margin-bottom:12px;">' + sectionHeading('Recommended foods', '建議食材') +
        '<div class="text-sm" style="display:flex;flex-wrap:wrap;gap:6px;">' +
          adviceObj.foods.map(function (f) {
            // NEW: handle both {en, zh} object format and legacy concatenated string
            var parts = (f && typeof f === 'object' && (f.en || f.zh))
              ? { en: f.en || f.zh || '', zh: f.zh || f.en || '' }
              : splitBilingual(f);
            return '<span class="chip" style="background:var(--washi);border:1px solid var(--border);border-radius:12px;padding:3px 10px;">' +
              bilingual(parts.en, parts.zh) + '</span>';
          }).join('') +
        '</div></div>');
    }
```

Same change for herbs:
```js
    if (Array.isArray(adviceObj.herbs) && adviceObj.herbs.length) {
      sections.push('<div style="margin-bottom:12px;">' + sectionHeading('Recommended herbs', '建議藥材') +
        '<div class="text-sm" style="display:flex;flex-wrap:wrap;gap:6px;">' +
          adviceObj.herbs.map(function (h) {
            var parts = (h && typeof h === 'object' && (h.en || h.zh))
              ? { en: h.en || h.zh || '', zh: h.zh || h.en || '' }
              : splitBilingual(h);
            return '<span class="chip" style="background:var(--washi);border:1px solid var(--border);border-radius:12px;padding:3px 10px;">' +
              bilingual(parts.en, parts.zh) + '</span>';
          }).join('') +
        '</div></div>');
    }
```

Update the avoid block to handle both `{en, zh}` object AND legacy string formats:
```js
    if (adviceObj.avoid) {
      // NEW: handle {en, zh} object format
      if (typeof adviceObj.avoid === 'object' && (adviceObj.avoid.en || adviceObj.avoid.zh)) {
        sections.push('<div style="margin-bottom:12px;">' + sectionHeading('Avoid', '忌') +
          '<div class="text-sm">' + bilingual(adviceObj.avoid.en || '', adviceObj.avoid.zh || adviceObj.avoid.en || '') + '</div></div>');
      } else {
        // LEGACY: concatenated string with optional ; separator
        var phrases = String(adviceObj.avoid).split(';').map(function (p) { return p.trim(); }).filter(Boolean);
        var rendered = phrases.map(function (phrase) {
          var parts;
          if (phrase.indexOf(' · ') > -1) {
            var bits = phrase.split(' · ');
            parts = { en: bits[0] || '', zh: bits[1] || bits[0] || '' };
          } else {
            parts = splitBilingual(phrase);
          }
          return '<div>' + bilingual(parts.en, parts.zh) + '</div>';
        }).join('');
        sections.push('<div style="margin-bottom:12px;">' + sectionHeading('Avoid', '忌') +
          '<div class="text-sm">' + rendered + '</div></div>');
      }
    }
```

The tips block already uses `t.en` and `t.zh` directly — no changes needed there since getTips() always returns structured objects.

## TASK F — Improve splitBilingual fallback (still needed for legacy data)

Even with HERB_MAP restructured, old patient records in the database might have doctor_advice saved with the old concatenated string format. Keep splitBilingual as a fallback but make it more permissive so legacy data renders cleanly.

Replace the existing splitBilingual helper with this more robust version:

```js
function splitBilingual(str) {
  var s = String(str || '').trim();
  if (!s) return { en: '', zh: '' };

  // CJK Unicode ranges
  var CJK = '　-鿿＀-￯';

  // Pattern A: starts with CJK, has ASCII text after
  // e.g., "枸杞 Gou Qi"
  var matchZhFirst = s.match(new RegExp('^([' + CJK + '][' + CJK + '\\s、，。；：·]*?)\\s+([A-Za-z].+)$'));
  if (matchZhFirst) {
    return { zh: matchZhFirst[1].trim(), en: matchZhFirst[2].trim() };
  }

  // Pattern B: starts with ASCII (incl. digits/punctuation), ends with pure CJK chunk
  // e.g., "Staying up past 11pm 熬夜過11點"
  // Allow digits, parens, & in EN portion. Find last whitespace before pure CJK.
  var matchEnFirst = s.match(new RegExp('^(.+?)\\s+([' + CJK + '][' + CJK + '\\s、，。；：·]*?)$'));
  if (matchEnFirst && /[A-Za-z]/.test(matchEnFirst[1])) {
    return { en: matchEnFirst[1].trim(), zh: matchEnFirst[2].trim() };
  }

  // Pattern C: ASCII with CJK in trailing parens
  // e.g., "Polished rice & glutinous rice (粳米、糯米)"
  var matchParenZh = s.match(new RegExp('^(.+?)\\s*[(（]([' + CJK + '][^)）]*)[)）]\\s*$'));
  if (matchParenZh) {
    return { en: matchParenZh[1].trim(), zh: matchParenZh[2].trim() };
  }

  // Couldn't split — return whole string for both. In language-switcher
  // mode, the user will see the whole string regardless of active lang.
  // Acceptable fallback.
  return { en: s, zh: s };
}
```

## TASK G — Verify nothing else in v2 expected the old HERB_MAP string format

```bash
# Check for callers that might be expecting the old string format
grep -rn "HERB_MAP\[" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/
grep -rn "HM\.constitutionCard\.HERB_MAP" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/

# Check ai-diagnosis.js for any direct iteration over HERB_MAP that might break
grep -n "\.foods\|\.herbs" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/panels/patient/ai-diagnosis.js
```

If `ai-diagnosis.js` (patient view) iterates over `HERB_MAP['Constitution Name'].foods` expecting strings, those callers need updating to handle `{en, zh}` objects too. Use the same pattern as the renderAdvice() update in Task E.

## ACCEPTANCE CRITERIA

- HERB_MAP fully restructured: every food, herb, and avoid entry uses `{en, zh}` object format (no concatenated strings)
- All Chinese in HERB_MAP, getTips(), getConstitution() uses TRADITIONAL characters (體 not 体, 視 not 视, 師 not 师, 質 not 质, 驗 not 验, etc.)
- All translations rewritten so Chinese matches English meaning (no abrupt truncations)
- renderAdvice() handles BOTH new structured format AND legacy strings (backward compat)
- splitBilingual improved to handle digits, parens, full-width punctuation
- Doctor view (constitution modal): toggle EN/中 → only one language shows in foods, herbs, avoid sections (no stacked bilingual)
- Patient view (wellness assessment): same improvement, no regressions
- Snapshot saved at `briefs/snapshots/brief-14a-fix-2-pre-migration/`
- No runtime errors in browser console

## REPORT BACK

```
Files modified:
  - v2/assets/js/components/constitution-card.js

Pushed to: [commit hash]

HERB_MAP restructured: [yes/no]
All 11 constitutions have {en, zh} format herbs/foods/avoid: [yes/no]
getTips() Chinese is traditional + improved quality: [yes/no]
getConstitution() Chinese is traditional: [yes/no]
renderAdvice() handles new + legacy formats: [yes/no]
splitBilingual improved (digits/parens supported): [yes/no]

Post-deploy manual verification:
  Doctor view EN mode: only English in chips/avoid: [yes/no]
  Doctor view 中 mode: only traditional Chinese, no stacked bilingual: [yes/no]
  Patient view EN mode: same: [yes/no]
  Patient view 中 mode: same: [yes/no]
  Old saved patient records still render (legacy fallback): [yes/no]
  No browser console errors: [yes/no]

Anything that needs CEO attention: [list]
```

## ROLLBACK

```bash
SNAP=/sessions/lucid-gallant-goldberg/mnt/Hansmed-system/briefs/snapshots/brief-14a-fix-2-pre-migration
cp $SNAP/constitution-card.js /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/components/constitution-card.js
git add -A
git commit -m "Rollback Brief #14a-fix-2"
git push
```

## NOTES

- **Tongue constitution `平和体质`** (simplified) seen in the screenshot is from the BACKEND tongue analysis API, not from this component. It's saved in the database with the patient's tongue assessment record. To fix, the tongue analysis endpoint needs updating to return `平和質` (traditional). That's part of the Day 2 tongue AI upgrade in your 10-day sprint, NOT this brief.
- **Tips rendered for the screenshot's Balanced Constitution patient** appeared to come from saved doctor_advice (not getTips). Those translations live in the database as historical data and can't be rewritten by this brief. Going forward, NEW tongue assessments will use updated translations once the tongue AI upgrade ships.
- **HERB_MAP keys are constitution names** (e.g., 'Balanced Constitution', 'Qi Deficiency'). These match the values returned by getConstitution() and the tongue analysis backend. If backend ever returns a different key (e.g., '平和質' instead of 'Balanced Constitution'), HERB_MAP lookup fails. Verify backend always returns English names; if not, add a normalization layer.
- **Future improvement (out of scope):** add a `pinyin` field to herbs (e.g., `{en: 'Huang Qi', zh: '黃耆', pinyin: 'huáng qí'}`) for educational value — could power future "What does this herb do?" tooltips.
- **Translation philosophy:** Chinese translations should be CLINICAL but APPROACHABLE — same tone as the English. Avoid overly classical/wenyanwen language; aim for what a modern Malaysian/Singaporean Chinese reader would expect from a quality TCM clinic.
