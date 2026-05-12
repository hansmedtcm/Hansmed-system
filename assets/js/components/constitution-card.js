/**
 * v2/assets/js/components/constitution-card.js
 *
 * Single source of truth for rendering TCM constitution data.
 * Used by:
 *   - v2/assets/js/panels/doctor/patients.js  (doctor view)
 *   - v2/assets/js/panels/patient/ai-diagnosis.js  (patient view)
 *
 * MIGRATION NOTE: This file currently lives in v2 because v2 is still
 * the live app. When v3 portal is built (future Brief #15+), move this
 * file to v3/assets/js/components/constitution-card.js and update the
 * <script src> tags in v2/doctor.html and v2/portal.html to point at
 * the new path. No code changes inside the component will be needed.
 *
 * Public API (all renderers return HTML strings):
 *   HM.constitutionCard.renderAnswers(symObj)        — q1-q10 with question text + answer label
 *   HM.constitutionCard.renderDimensions(dimsObj)    — labelled dimension scores
 *   HM.constitutionCard.renderPatterns(patternsArr)  — derived constitution patterns
 *   HM.constitutionCard.renderAdvice(adviceObj)      — tips/foods/herbs/avoid grouped
 *   HM.constitutionCard.renderTongue(tongueObj)      — tongue constitution + confidence
 *   HM.constitutionCard.renderFull(data)             — convenience: all of the above
 *
 * Public dictionaries (read-only, exposed for callers that need raw labels):
 *   HM.constitutionCard.DIMS
 *   HM.constitutionCard.QS
 *   HM.constitutionCard.FOLLOW_UPS
 *   HM.constitutionCard.HERB_MAP
 *
 * Helpers:
 *   HM.constitutionCard.getConstitution(dims)
 *   HM.constitutionCard.getTips(dims)                — alias for buildLifestyleTips
 *   HM.constitutionCard.buildLifestyleTips(dims)     — original name, also exposed
 *   HM.constitutionCard.answerLabel(qId, value)
 *   HM.constitutionCard.scoreLabel(value, dimKey)
 *   HM.constitutionCard.findQuestion(qId)
 */
(function () {
  'use strict';
  window.HM = window.HM || {};

  // === INJECT LANG-HIDING CSS (Brief #14a-fix) ===
  // This component uses <span lang="en">/<span lang="zh"> spans for
  // bilingual text. Without the corresponding CSS rule, BOTH languages
  // render simultaneously. v3 pages have this rule inline; v2 pages
  // (doctor.html, portal.html) don't, so we inject it from the
  // component itself. Self-contained — when the component eventually
  // moves to v3, this still works there too. Idempotent.
  (function injectLangCSS() {
    if (document.getElementById('hm-constitution-card-lang-css')) return;
    var style = document.createElement('style');
    style.id = 'hm-constitution-card-lang-css';
    style.textContent =
      'html[lang="en"] [lang="zh"] { display: none !important; }\n' +
      'html[lang="zh"] [lang="en"] { display: none !important; }\n';
    (document.head || document.documentElement).appendChild(style);
  })();

  // === DICTIONARIES (moved verbatim from v2/assets/js/panels/patient/ai-diagnosis.js) ===

  var DIMS = {
    qi_xu:     { enShort: 'Qi Level',          zhShort: '氣之盈虧', group: 'energy',   min: -2, max: 2, minLbl: '虧 Deficient',     maxLbl: '盈 Excess' },
    qi_zhi:    { enShort: 'Qi Stagnation',     zhShort: '氣滯度',   group: 'energy',   min:  0, max: 2, minLbl: 'Smooth',           maxLbl: 'Stagnant' },
    pi_wei:    { enShort: 'Digestion',         zhShort: '脾胃虛實', group: 'energy',   min: -2, max: 2, minLbl: '虛 Deficient',     maxLbl: '實 Excess' },
    xue_xu:    { enShort: 'Blood Level',       zhShort: '血之盈虧', group: 'blood',    min: -2, max: 2, minLbl: '虧 Deficient',     maxLbl: '盈 Excess' },
    xue_yu:    { enShort: 'Blood Stasis',      zhShort: '血瘀度',   group: 'blood',    min:  0, max: 2, minLbl: 'Smooth',           maxLbl: 'Stasis' },
    ti_re:     { enShort: 'Heat',              zhShort: '體熱虛實', group: 'temp',     min: -2, max: 2, minLbl: '虛熱 Def.Heat',    maxLbl: '實熱 Exc.Heat' },
    ti_han:    { enShort: 'Cold',              zhShort: '體寒虛實', group: 'temp',     min: -2, max: 2, minLbl: '虛寒 Def.Cold',    maxLbl: '實寒 Exc.Cold' },
    shi_qi:    { enShort: 'Moisture',          zhShort: '濕氣度',   group: 'moisture', min: -2, max: 2, minLbl: '乾燥 Dry',         maxLbl: '濕氣 Damp' },
    shui_mian: { enShort: 'Sleep',             zhShort: '睡眠品質', group: 'mind',     min: -2, max: 0, minLbl: 'Insomnia',         maxLbl: 'Restful' },
    min_li:    { enShort: 'Immunity',          zhShort: '免疫敏感', group: 'mind',     min:  0, max: 2, minLbl: 'Normal',           maxLbl: 'Hypersensitive' },
  };

  var QS = [
    { id:'q1', dim:'qi_xu', followUp:true, fuTrigger:-2,
      mod:'🔋 Energy · 能量（氣）',
      titleEn:'How often do you feel fatigued, weak-voiced, or breathless?',
      titleZh:'你常覺得疲勞、說話沒力氣、爬樓梯容易喘嗎？',
      opts:[
        {t:'Always exhausted — no energy to speak, extremely breathless', s:'總是疲勞、說話沒力、容易喘', v:-2},
        {t:'Often tired and lacking energy', s:'偶爾覺得累、沒力氣', v:-1},
        {t:'Full of energy, calm and breathing smoothly', s:'體力充沛，心平氣和', v:0},
        {t:'Excess energy — cannot stop, easily irritable, face feels hot', s:'精力過剩、停不下來，心煩、臉部發熱', v:1},
        {t:'Very loud voice, craving cold water, red face, head pressure', s:'氣粗口乾，臉紅，頭目脹痛', v:2},
      ]},
    { id:'q2', dim:'qi_zhi', followUp:false,
      mod:'🔋 Energy · 能量（氣）',
      titleEn:'Do you often feel chest tightness, high stress, or urge to sigh?',
      titleZh:'你常覺得胸口悶、壓力大，或常常想嘆氣？',
      opts:[
        {t:'No chest tightness at all — completely relaxed', s:'完全不會悶', v:0},
        {t:'Occasional chest heaviness, especially when emotional', s:'偶爾胸悶，情緒波動時明顯', v:1},
        {t:'Whole body bound tight; must sigh frequently to feel relief', s:'全身緊繃，必須頻繁嘆氣才舒緩', v:2},
      ]},
    { id:'q3', dim:'pi_wei', followUp:false,
      mod:'🍚 Digestion · 消化（脾胃）',
      titleEn:'How is your appetite and digestion?',
      titleZh:'你常覺得胃口不好、吃一點就飽、飯後容易脹氣嗎？',
      opts:[
        {t:'Extreme loss of appetite, cannot digest', s:'極度厭食、胃脹痛', v:-2},
        {t:'Often poor appetite, feel full very quickly', s:'胃口不佳，吃一點就飽', v:-1},
        {t:'Good appetite, smooth digestion', s:'胃口好，消化順暢', v:0},
        {t:'Frequently hungry, larger than normal appetite', s:'容易餓，食量偏大', v:1},
        {t:'Always hungry even after eating, bad breath', s:'極度易餓、吃多不飽、口臭', v:2},
      ]},
    { id:'q4', dim:'xue_xu', followUp:true, fuTrigger:-2,
      mod:'🩸 Circulation · 循環（血）',
      titleEn:'Do you experience dizziness or changes in complexion?',
      titleZh:'你常覺得頭暈、臉色蒼白，或常臉紅流鼻血？',
      opts:[
        {t:'Constant dizziness, extremely pale face and lips', s:'總是頭暈，臉色極度蒼白', v:-2},
        {t:'Occasional dizziness, dull complexion', s:'偶爾頭暈，氣色偏淡', v:-1},
        {t:'Rarely dizzy, healthy rosy complexion', s:'很少頭暈，氣色紅潤', v:0},
        {t:'No dizziness but often flushed and feel body heat', s:'不易頭暈，但常臉紅、身體燥熱', v:1},
        {t:'Frequently flushed, overheated, prone to nosebleeds', s:'常臉紅發熱，易流鼻血或紅疹', v:2},
      ]},
    { id:'q5', dim:'xue_yu', followUp:true, fuTrigger:2,
      mod:'🩸 Circulation · 循環（血）',
      titleEn:'Numbness, painful periods with clots, or fixed stabbing pain?',
      titleZh:'您常覺得手腳發麻、生理期痛經有血塊，或身上固定位置刺痛？',
      opts:[
        {t:'None of these — circulation feels smooth', s:'完全沒有（順暢）', v:0},
        {t:'Occasional numbness, mild clots during periods', s:'偶爾麻，經期有小血塊', v:1},
        {t:'Frequent fixed stabbing pain, persistent numbness, heavy clots', s:'定點刺痛、持續麻木、經血塊多', v:2},
      ]},
    { id:'q6', dim:'ti_re', followUp:true, fuTrigger:-2,
      mod:'🔥 Temperature · 溫度（熱）',
      titleEn:'Do you feel palm/sole heat, night sweats, or internal heat?',
      titleZh:'你常手腳心發熱、夜間盜汗，或口臭、便秘、紅腫痘痘？',
      opts:[
        {t:'Burning palms and soles, significant night sweats', s:'常手腳心發熱、夜間盜汗', v:-2},
        {t:'Mild afternoon heat or occasional flushing', s:'偶爾午後燥熱', v:-1},
        {t:'No heat sensations at all', s:'完全沒有燥熱感', v:0},
        {t:'Occasional bitter mouth, mild constipation or small pimples', s:'偶爾口苦、便秘或長痘', v:1},
        {t:'Frequent bad breath, constipation, large inflamed acne', s:'常口臭、便秘、紅腫大痘', v:2},
      ]},
    { id:'q7', dim:'ti_han', followUp:false,
      mod:'❄️ Temperature · 溫度（寒）',
      titleEn:'Are you sensitive to cold? Does cold food cause discomfort?',
      titleZh:'你是不是特別怕冷、手腳冰冷，或一吃冰就不適？',
      opts:[
        {t:'Cold extremities all year; diarrhoea from cold food', s:'四季手腳冰冷，吃冰就拉', v:-2},
        {t:'Slightly cold-sensitive, prone to colds', s:'稍微怕冷，容易感冒', v:-1},
        {t:'Balanced — warm hands and feet', s:'完全不怕冷，手足溫暖', v:0},
        {t:'Cold wind causes neck/back stiffness and headache', s:'吹冷風即脖子背痛', v:1},
        {t:'Cold food causes severe cramping that resists touch', s:'受寒後腹部劇烈絞痛拒按', v:2},
      ]},
    { id:'q8', dim:'shi_qi', followUp:true, fuTrigger:-2,
      mod:'💧 Moisture · 水分（濕燥）',
      titleEn:'How would you describe your skin and body moisture?',
      titleZh:'你的身體皮膚與水分狀況如何？',
      opts:[
        {t:'Extremely dry skin, persistent dry mouth', s:'皮膚極乾、口乾舌燥', v:-2},
        {t:'Often thirsty, skin tends to be dry', s:'常口渴、皮膚偏乾', v:-1},
        {t:'Balanced moisture — not dry, not puffy', s:'水潤適中，不乾不腫', v:0},
        {t:'Body feels heavy, prone to water retention', s:'身體沉重、容易水腫', v:1},
        {t:'Always heavy and sluggish, bloated, sticky stools', s:'全身沉重、整天昏沉、大便黏', v:2},
      ]},
    { id:'q9', dim:'shui_mian', followUp:false,
      mod:'🌙 Sleep & Emotions · 睡眠情緒',
      titleEn:'How is your sleep quality and emotional well-being?',
      titleZh:'您的睡眠品質和情緒狀況如何？',
      opts:[
        {t:'Severe insomnia — cannot fall asleep or wake repeatedly, constant anxiety or low mood', s:'嚴重失眠、反覆驚醒、情緒持續低落或焦慮', v:-2},
        {t:'Light sleeper, often disturbed; frequently stressed, irritable or melancholic', s:'睡眠淺、易驚醒、常感壓力大、煩躁或悶悶不樂', v:-1},
        {t:'Generally sleep well and maintain emotional balance', s:'睡眠尚可，情緒大致平穩', v:0},
      ]},
    { id:'q10', dim:'min_li', followUp:false,
      mod:'🤧 Immunity & Allergy · 免疫過敏',
      titleEn:'Do you have allergies, sensitivities, or low immunity?',
      titleZh:'您有過敏反應、敏感體質或免疫力偏低的問題嗎？',
      opts:[
        {t:'No allergies — rarely fall sick, good immune resilience', s:'沒有過敏，很少生病，免疫力良好', v:0},
        {t:'Frequent colds or mild seasonal allergies (sneezing, itchy eyes)', s:'容易感冒，或輕度季節性過敏（打噴嚏、眼癢）', v:1},
        {t:'Chronic allergic rhinitis, eczema, asthma, or food/drug hypersensitivity', s:'長期過敏性鼻炎、濕疹、哮喘，或食物/藥物嚴重過敏', v:2},
      ]},
  ];

  var FOLLOW_UPS = {
    q1: { title:'🚨 Medical Safety Check · 醫療安全確認',
      question:'Is your breathlessness worsened when lying flat (must sit up) or accompanied by noticeable ankle swelling?',
      questionZh:'您的喘，是否平躺時加重（必須坐起來），或伴隨腳踝明顯水腫？',
      purpose:'Distinguishes simple Qi deficiency from possible Heart Failure. If yes, please seek urgent medical attention.',
      purposeZh:'目的：區分單純氣虛與心臟衰竭。如答「是」，請儘快就醫。',
      alert:'⚠️ These symptoms may indicate Heart Failure · 可能提示心臟衰竭。Please seek urgent medical evaluation · 請立即就醫。' },
    q4: { title:'🚨 Medical Safety Check · 醫療安全確認',
      question:'Is your stool recently black and tar-like, or do you have frequent stomach pain or vomiting of blood?',
      questionZh:'您最近的大便是否像柏油一樣的黑色？或常胃痛、吐血？',
      purpose:'Distinguishes Blood deficiency from possible upper GI bleeding.',
      purposeZh:'目的：區分單純血虛與上消化道出血。如答「是」，請儘快就醫。',
      alert:'⚠️ Black tarry stools may indicate serious GI bleeding · 可能提示嚴重消化道出血。Seek urgent medical attention · 請緊急就醫。' },
    q5: { title:'🚨 Medical Safety Check · 醫療安全確認',
      question:'Is the stabbing pain accompanied by any stroke-like symptoms — one-sided weakness, facial droop, or sudden speech difficulty?',
      questionZh:'定點刺痛是否伴隨中風症狀（單側無力、口角歪斜、說話困難）？',
      purpose:'Blood stasis with neuro signs needs emergency evaluation.',
      purposeZh:'目的：排除急性腦血管事件。如答「是」，請立即就醫。',
      alert:'⚠️ These symptoms suggest a possible stroke · 可能是中風徵兆。CALL 999 immediately · 請立即撥打 999。' },
    q6: { title:'🚨 Medical Safety Check · 醫療安全確認',
      question:'Has your night sweating been accompanied by rapid weight loss without dieting, or unexplained lumps in the neck or armpits?',
      questionZh:'您的夜間盜汗，是否伴隨體重快速減輕或頸部/腋下有不明腫塊？',
      purpose:'Distinguishes Yin deficiency from possible TB or lymphoma.',
      purposeZh:'目的：區分單純陰虛與肺結核或淋巴腫瘤。如答「是」，請就醫檢查。',
      alert:'⚠️ These symptoms with night sweats require medical investigation · 盜汗伴隨此症狀需就醫排除嚴重疾病。' },
    q8: { title:'🚨 Medical Safety Check · 醫療安全確認',
      question:'Besides persistent thirst, have you noticed increased urination AND increased appetite while losing weight without trying?',
      questionZh:'除了口渴，您是否出現尿多、食量變大卻體重減輕？',
      purpose:'These are classic diabetes symptoms — please check blood glucose.',
      purposeZh:'目的：這是糖尿病典型「三多一少」症狀，請就醫檢查血糖。',
      alert:'⚠️ Classic diabetes symptoms · 糖尿病典型症狀 — please consult a doctor for blood glucose testing · 請就醫檢測血糖。' },
  };

  // Brief #14a-fix-2: HERB_MAP restructured — herbs/foods are now
  // arrays of {en, zh} objects and avoid is a single {en, zh} object.
  // Eliminates the need for runtime string parsing (splitBilingual)
  // for HERB_MAP entries. All Chinese is traditional throughout, all
  // translations rewritten for clarity + EN/ZH parity.
  // renderAdvice() handles BOTH this format AND legacy concatenated
  // strings so historical doctor_advice rows in the DB still render.
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

  // === HELPERS LIFTED VERBATIM FROM ai-diagnosis.js ===

  // Pattern detection — derives constitution patterns from dimension
  // scores. Brief #14a-fix-2: Chinese converted to traditional
  // throughout; constitution names refined to canonical TCM 9-type
  // names where applicable (氣虛質, 平和質, etc.).
  function getConstitution(d) {
    var types = [];
    if (d.qi_xu <= -1)     types.push({ l: 'Qi Deficiency',              c: '氣虛質',     col: 'blue',   d: 'Low energy, easily fatigued, weak immunity, short of breath.',                  dZh: '體力不足、容易疲倦、免疫力偏低、呼吸容易感到氣短。' });
    if (d.qi_xu >= 1)      types.push({ l: 'Qi Excess',                  c: '氣盛質',     col: 'red',    d: 'Overactive energy, prone to irritability and agitation.',                       dZh: '精力過旺、容易煩躁不安、情緒激動、難以靜下來。' });
    if (d.qi_zhi >= 1)     types.push({ l: 'Qi Stagnation',              c: '氣鬱質',     col: 'yellow', d: 'Mood swings, chest tightness, frequent sighing, sensitive to stress.',          dZh: '情緒起伏、胸悶、常嘆氣、對壓力敏感。' });
    if (d.pi_wei <= -1)    types.push({ l: 'Spleen-Stomach Deficiency',  c: '脾胃虛弱',   col: 'blue',   d: 'Poor appetite, bloating after meals, soft stools, low energy after eating.',     dZh: '胃口不佳、飯後脹氣、大便偏軟、餐後疲倦。' });
    if (d.pi_wei >= 1)     types.push({ l: 'Spleen-Stomach Excess',      c: '脾胃實熱',   col: 'red',    d: 'Strong appetite, bad breath, constipation, easily hungry.',                     dZh: '食慾旺盛、口臭、便秘、容易飢餓。' });
    if (d.xue_xu <= -1)    types.push({ l: 'Blood Deficiency',           c: '血虛質',     col: 'blue',   d: 'Pale complexion, dizziness, dry hair and nails, insomnia.',                     dZh: '面色蒼白、頭暈目眩、頭髮指甲乾脆、睡眠質素差。' });
    if (d.xue_xu >= 1)     types.push({ l: 'Blood Heat',                 c: '血熱質',     col: 'red',    d: 'Flushed face, nosebleeds, inflamed skin conditions.',                           dZh: '面色偏紅、容易流鼻血、皮膚易發炎。' });
    if (d.xue_yu >= 1)     types.push({ l: 'Blood Stasis',               c: '血瘀質',     col: 'red',    d: 'Fixed stabbing pain, dark spots on skin, painful periods with clots.',          dZh: '定點刺痛、皮膚有暗斑、經期疼痛伴血塊。' });
    if (d.ti_re <= -1)     types.push({ l: 'Yin Deficiency Heat',        c: '陰虛內熱',   col: 'red',    d: 'Warm palms and soles, night sweats, afternoon flushing, dry mouth.',            dZh: '手腳心發熱、夜間盜汗、午後潮熱、口乾舌燥。' });
    if (d.ti_re >= 1)      types.push({ l: 'Excess Heat (Shi Re)',       c: '實熱質',     col: 'red',    d: 'Bad breath, constipation, inflamed acne, irritability.',                        dZh: '口氣重、便秘、紅腫痘痘、體內實火旺盛。' });
    if (d.ti_han <= -1)    types.push({ l: 'Yang Deficiency Cold',       c: '陽虛體寒',   col: 'blue',   d: 'Cold extremities, loose stools, low metabolism.',                               dZh: '四季手腳冰冷、大便偏軟、代謝偏低。' });
    if (d.ti_han >= 1)     types.push({ l: 'Excess Cold (Shi Han)',      c: '實寒質',     col: 'blue',   d: 'Severe cramping from cold exposure, chills.',                                   dZh: '受寒後腹部劇烈絞痛、畏寒明顯。' });
    if (d.shi_qi <= -1)    types.push({ l: 'Yin Dryness',                c: '陰燥質',     col: 'yellow', d: 'Dry skin, persistent thirst, dryness unrelieved by water.',                     dZh: '皮膚乾燥、持續口渴、津液虧損。' });
    if (d.shi_qi >= 1)     types.push({ l: 'Dampness / Phlegm',          c: '痰濕質',     col: 'blue',   d: 'Heavy body, sluggish digestion, water retention, sticky stools.',               dZh: '身體沉重、消化遲緩、容易水腫、大便黏膩。' });
    if (d.shui_mian <= -1) types.push({ l: 'Poor Sleep',                 c: '睡眠不安',   col: 'yellow', d: 'Light sleeper, frequent waking, difficulty falling asleep.',                    dZh: '睡眠淺、容易驚醒、入睡困難。' });
    if (d.min_li >= 1)     types.push({ l: 'Allergic Constitution',      c: '特稟質',     col: 'yellow', d: 'Sensitive to allergens, prone to seasonal reactions.',                          dZh: '對過敏原敏感、易出現季節性過敏反應。' });
    if (!types.length)     types.push({ l: 'Balanced Constitution',      c: '平和質',     col: 'green',  d: 'Strong qi, smooth blood, balanced yin and yang. Maintain your healthy habits.',  dZh: '氣血充盈、陰陽平衡。請繼續保持健康的生活習慣。' });
    return types;
  }

  // Lifestyle tips. Original name in ai-diagnosis.js was
  // buildLifestyleTips; exposed under both names so existing
  // callers and the brief's documented HM.constitutionCard.getTips
  // alias both work. Brief #14a-fix-2: each tip's Chinese rewritten
  // for clarity + EN/ZH parity, all simplified→traditional.
  function buildLifestyleTips(d) {
    var tips = [];
    if (d.qi_xu <= -1)   tips.push({ icon: '😴', en: 'Rest adequately. Avoid overexertion. Light exercise like Tai Chi or walking helps build energy gently.',          zh: '充分休息，避免過勞。練太極或散步等輕度運動，可溫和地補益元氣。' });
    if (d.qi_xu >= 1)    tips.push({ icon: '🧘', en: 'Channel excess energy into calming practices — meditation, deep breathing, gentle yoga.',                          zh: '透過冥想、深呼吸、和緩瑜伽等練習，平和地疏導旺盛的能量。' });
    if (d.xue_xu <= -1)  tips.push({ icon: '💤', en: 'Sleep before 11pm. Iron-rich foods (dark leafy greens, liver, red dates) help replenish blood.',                   zh: '晚上11點前入睡。多吃深綠色蔬菜、豬肝、紅棗等補血食物。' });
    if (d.xue_xu >= 1)   tips.push({ icon: '🌿', en: 'Cool and calm — avoid spicy heating foods. Drink chrysanthemum or green tea.',                                     zh: '清涼安神 —— 避免辛辣燥熱食物，可飲菊花茶或綠茶。' });
    if (d.ti_re <= -1)   tips.push({ icon: '💧', en: 'Drink at least 8 glasses of water daily. Sleep early. Avoid spicy and grilled foods.',                              zh: '每天至少喝8杯水，早睡，避免辛辣燒烤食物。' });
    if (d.ti_re >= 1)    tips.push({ icon: '🥒', en: 'Cool the system — drink mung bean soup, eat cucumber, watermelon, bitter melon.',                                  zh: '清熱降火 —— 飲綠豆湯，多吃黃瓜、西瓜、苦瓜等清涼食物。' });
    if (d.ti_han <= -1)  tips.push({ icon: '🧣', en: 'Keep your waist and knees warm. Drink ginger tea daily. Moxibustion is recommended.',                               zh: '注意腰腿保暖，每天飲薑茶。建議搭配艾灸調理。' });
    if (d.ti_han >= 1)   tips.push({ icon: '☀️', en: 'Get sunshine and gentle warmth — but avoid overheating. Layer clothing for changing temperatures.',                zh: '適當曬太陽，溫和保暖 —— 但避免過熱。穿著分層以應對溫度變化。' });
    if (d.shi_qi >= 1)   tips.push({ icon: '🏃', en: 'Regular aerobic exercise. Low-sugar diet. Avoid sitting more than 1 hour at a time.',                              zh: '定期有氧運動，低糖飲食，避免連續久坐超過1小時。' });
    if (d.shi_qi <= -1)  tips.push({ icon: '🫧', en: 'Increase fluid intake with warm drinks. Avoid drying foods like chips, crackers, and instant noodles.',             zh: '多飲溫熱飲品補充水分，避免餅乾、薯片、泡麵等燥熱食物。' });
    if (d.qi_zhi >= 1)   tips.push({ icon: '🌸', en: 'Move and connect — daily walks in nature, social time with friends, gentle stretching.',                            zh: '多活動、多交流 —— 每日到戶外散步，與朋友相聚，做和緩伸展。' });
    if (d.xue_yu >= 1)   tips.push({ icon: '🌹', en: 'Move blood gently — daily walking, warm hawthorn tea, avoid prolonged sitting.',                                    zh: '溫和活血 —— 每日散步，飲溫熱山楂茶，避免久坐。' });
    if (d.pi_wei <= -1)  tips.push({ icon: '🍚', en: 'Eat warm cooked foods. Smaller, more frequent meals. Chew thoroughly.',                                              zh: '吃溫熱熟食，少量多餐，細嚼慢嚥。' });
    if (d.pi_wei >= 1)   tips.push({ icon: '🥗', en: 'Eat at regular times. Stop at 80% full. Lighter dinner.',                                                            zh: '定時用餐，吃八分飽，晚餐宜清淡。' });
    if (d.shui_mian <= -1) tips.push({ icon: '🌙', en: 'Wind down 1 hour before bed: dim lights, no screens, warm bath or reading.',                                       zh: '睡前1小時放鬆 —— 調暗燈光，遠離電子產品，泡溫水澡或閱讀。' });
    if (d.min_li >= 1)   tips.push({ icon: '🌾', en: 'Strengthen immunity gradually — moderate exercise, balanced sleep, avoid known triggers.',                          zh: '循序漸進地增強免疫力 —— 適度運動、規律睡眠、避免已知過敏原。' });
    if (!tips.length)    tips.push({ icon: '⚖️', en: 'Maintain your healthy routine — balanced diet, regular exercise, sufficient sleep.',                                zh: '保持健康作息 —— 均衡飲食、定期運動、睡眠充足。' });
    return tips;
  }

  // === RENDER HELPERS ===

  function esc(s) {
    return (window.HM && HM.format && HM.format.esc) ? HM.format.esc(s) : String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /**
   * Wrap an EN+ZH pair as paired lang spans. The lang-hiding CSS
   * injected above shows only one of the two in any given mode.
   */
  function bilingual(en, zh) {
    return '<span lang="en">' + esc(en) + '</span>' +
           '<span lang="zh">' + esc(zh) + '</span>';
  }

  /**
   * Split a pre-concatenated bilingual string into {en, zh} parts.
   * Handles three formats commonly used in HansMed data:
   *   "枸杞 Gou Qi"           → { zh: "枸杞", en: "Gou Qi" }
   *   "Ginger tea 薑茶"        → { en: "Ginger tea", zh: "薑茶" }
   *   "Polished rice (粳米)"   → { en: "Polished rice", zh: "粳米" }
   * For strings that can't be cleanly split, returns the whole
   * string for both languages — the entry then shows in both modes
   * uncut, never garbled. Better to leak one language than show
   * a mangled fragment.
   */
  function splitBilingual(str) {
    var s = String(str || '').trim();
    if (!s) return { en: '', zh: '' };
    // CJK Unicode range — Chinese chars common in HansMed copy.
    var CJK = '一-鿿';
    // Pattern A: starts with CJK chars, ASCII text after a space.
    //   "枸杞 Gou Qi"  /  "薑茶 Ginger tea"
    var mA = s.match(new RegExp('^([' + CJK + '][' + CJK + '\\s、，。；：·]*?)\\s+([A-Za-z].+)$'));
    if (mA) return { zh: mA[1].trim(), en: mA[2].trim() };
    // Pattern B: starts with anything (incl. digits/parens/punct),
    // ends with a pure CJK chunk preceded by whitespace. We require
    // the EN side to contain at least one ASCII letter so we don't
    // accidentally split a string that's ZH+ZH.
    //   "Ginger tea 薑茶"
    //   "Staying up past 11pm 熬夜過11點"
    //   "(less) Iced drinks · ice cream · cold raw foods 冰飲、雪糕、生冷食物"
    var mB = s.match(new RegExp('^(.+?)\\s+([' + CJK + '][' + CJK + '\\s、，。；：·0-9]*?)$'));
    if (mB && /[A-Za-z]/.test(mB[1])) {
      return { en: mB[1].trim(), zh: mB[2].trim() };
    }
    // Pattern C: ASCII with CJK in trailing parens (half- or full-width).
    //   "Polished rice & glutinous rice (粳米、糯米)"
    //   "白米（粳米）"
    var mC = s.match(new RegExp('^(.+?)\\s*[(（]([' + CJK + '][^)）]*)[)）]\\s*$'));
    if (mC) return { en: mC[1].trim(), zh: mC[2].trim() };
    // Couldn't cleanly split — return the whole string for both
    // modes. In language-switcher mode the user sees the whole
    // string regardless of active language; better than a
    // mangled fragment.
    return { en: s, zh: s };
  }

  /**
   * Brief #14a-fix-3: detect "(less)" / "(reduce)" / "(limit)" /
   * "(avoid)" / "(no)" prefixes (and CJK equivalents 少 / 減 /
   * 忌 / 避 / 限) on food / herb items so they can be routed to a
   * "Limit" or "Use sparingly" bucket instead of being shown as
   * recommended. Historical doctor_advice.foods arrays sometimes
   * contain "(less) ice cream" entries — the renderer faithfully
   * showed them as "Recommended foods: ice cream", which read
   * the wrong way. Now they get a separate amber-tinted section.
   *
   *   "(less) ice cream"   → { isReduce: true,  cleaned: "ice cream" }
   *   "(LESS) ice cream"   → { isReduce: true,  cleaned: "ice cream" }
   *   "Balanced diet"      → { isReduce: false, cleaned: "Balanced diet" }
   *   "(粳米、糯米)"       → { isReduce: false, cleaned: "(粳米、糯米)" }
   *
   * Object format ({en, zh}) is checked on both halves; if either
   * carries the prefix, the item is treated as reduce and BOTH
   * halves get cleaned. String format is processed directly.
   * Non-matching items are returned unchanged so the caller can
   * keep a stable reference for the regular bucket.
   */
  function detectReducePrefix(item) {
    var REDUCE_PATTERNS = /^\s*\(\s*(less|reduce|limit|avoid|no|skip|moderate|少|減|忌|避|限)\s*\)\s*/i;

    function process(str) {
      var s = String(str == null ? '' : str);
      var m = s.match(REDUCE_PATTERNS);
      if (m) return { isReduce: true, cleaned: s.slice(m[0].length).trim() };
      return { isReduce: false, cleaned: s };
    }

    if (item && typeof item === 'object' && (item.en || item.zh)) {
      var en = process(item.en);
      var zh = process(item.zh);
      var isReduce = en.isReduce || zh.isReduce;
      return {
        isReduce: isReduce,
        cleaned: isReduce
          ? { en: en.cleaned, zh: zh.cleaned }
          : item,
      };
    }

    var r = process(item);
    return {
      isReduce: r.isReduce,
      cleaned: r.isReduce ? r.cleaned : item,
    };
  }

  /** Find the question definition (with title/options) for a given q-id. */
  function findQuestion(qId) {
    return QS.find(function (q) { return q.id === qId; }) || null;
  }

  /** Convert a numeric answer value to its option label using QS metadata. */
  function answerLabel(qId, value) {
    var q = findQuestion(qId);
    if (!q) return { en: '(unknown)', zh: '（未知）' };
    var opt = (q.opts || []).find(function (o) { return o.v === value; });
    if (!opt) return { en: 'Score: ' + value, zh: '分數：' + value };
    return { en: opt.t, zh: opt.s };
  }

  /** Convert a dimension code + score to a human-readable label. */
  function scoreLabel(value, dimKey) {
    if (value == null) return { en: '—', zh: '—' };
    var dim = DIMS[dimKey];
    if (!dim) return { en: String(value), zh: String(value) };
    if (value <= dim.min) return { en: dim.minLbl, zh: dim.minLbl };
    if (value >= dim.max) return { en: dim.maxLbl, zh: dim.maxLbl };
    if (value === 0) return { en: 'Balanced', zh: '平衡' };
    if (value < 0) return { en: 'Tends toward ' + dim.minLbl, zh: '偏 ' + dim.minLbl };
    return { en: 'Tends toward ' + dim.maxLbl, zh: '偏 ' + dim.maxLbl };
  }

  // === RENDERERS (return HTML strings) ===

  function renderAnswers(symObj) {
    if (!symObj || typeof symObj !== 'object') return '<p class="text-muted text-sm"><span lang="en">No answers recorded</span><span lang="zh">無答案記錄</span></p>';
    var qIds = QS.map(function (q) { return q.id; });
    var rows = qIds.map(function (qId) {
      if (!(qId in symObj)) return '';
      var q = findQuestion(qId);
      var label = answerLabel(qId, symObj[qId]);
      // Every EN block needs lang="en" so the ZH-mode lang-switcher
      // CSS (html[lang="zh"] [lang="en"]{display:none}) hides it.
      // Without the wrapper, both languages stack in ZH mode.
      return '<div style="padding:8px 0;border-bottom:1px solid var(--border);">' +
        '<div class="text-xs text-muted" lang="en" style="margin-bottom:2px;">' + esc(qId.toUpperCase()) + ' · ' + esc(q ? q.titleEn : '') + '</div>' +
        '<div class="text-xs text-muted" lang="zh" style="margin-bottom:4px;">' + esc(qId.toUpperCase()) + ' · ' + esc(q ? q.titleZh : '') + '</div>' +
        '<div class="text-sm" lang="en" style="font-weight:600;color:var(--ink);">' + esc(label.en) + '</div>' +
        '<div class="text-sm" lang="zh" style="font-weight:600;color:var(--ink);">' + esc(label.zh) + '</div>' +
        '</div>';
    }).filter(Boolean).join('');
    return rows || '<p class="text-muted text-sm"><span lang="en">No matching answers</span><span lang="zh">無對應答案</span></p>';
  }

  function renderDimensions(dimsObj) {
    if (!dimsObj || typeof dimsObj !== 'object') return '<p class="text-muted text-sm"><span lang="en">No dimensions recorded</span><span lang="zh">無維度資料</span></p>';
    var keys = Object.keys(DIMS);
    var rows = keys.map(function (k) {
      if (!(k in dimsObj)) return '';
      var dim = DIMS[k];
      var v = dimsObj[k];
      var lbl = scoreLabel(v, k);
      // Visual bar — width is the score normalized to 0-100% across the dim's [min, max] range.
      var pct = ((v - dim.min) / (dim.max - dim.min)) * 100;
      if (pct < 0)   pct = 0;
      if (pct > 100) pct = 100;
      return '<div style="display:flex;align-items:center;gap:12px;padding:6px 0;">' +
        '<div style="flex:0 0 180px;">' +
          '<div class="text-xs" lang="en" style="font-weight:600;">' + esc(dim.enShort) + '</div>' +
          '<div class="text-xs" lang="zh" style="font-weight:600;">' + esc(dim.zhShort) + '</div>' +
        '</div>' +
        '<div style="flex:1;height:8px;background:var(--washi);border-radius:4px;overflow:hidden;">' +
          '<div style="width:' + pct + '%;height:100%;background:var(--gold,#B8965A);"></div>' +
        '</div>' +
        '<div style="flex:0 0 110px;text-align:right;">' +
          '<div class="text-xs" lang="en" style="font-weight:600;">' + esc(lbl.en) + '</div>' +
          '<div class="text-xs" lang="zh" style="font-weight:600;">' + esc(lbl.zh) + '</div>' +
        '</div>' +
      '</div>';
    }).filter(Boolean).join('');
    return rows || '<p class="text-muted text-sm"><span lang="en">No matching dimensions</span><span lang="zh">無對應維度</span></p>';
  }

  function renderPatterns(patternsArr) {
    if (!Array.isArray(patternsArr) || !patternsArr.length) return '<p class="text-muted text-sm"><span lang="en">No patterns derived</span><span lang="zh">未判定體質</span></p>';
    return patternsArr.map(function (p) {
      // p is shape { l, c, col, d, dZh } as produced by getConstitution().
      var color = p.col === 'red'    ? '#c44a3e'
                : p.col === 'blue'   ? '#3a6e9b'
                : p.col === 'yellow' ? '#b5881a'
                : p.col === 'green'  ? '#5a8a5a'
                : 'var(--ink)';
      // Pattern title: EN + (optional) ZH char wrapped in lang spans
      // so each language renders only in its own mode.
      var titleEn = '<span lang="en">' + esc(p.l || '(pattern)') + '</span>';
      var titleZh = p.c ? '<span lang="zh">' + esc(p.c) + '</span>' : '';
      return '<div style="padding:10px;border-left:3px solid ' + color + ';background:#fff;margin-bottom:8px;">' +
        '<div class="text-sm" style="font-weight:600;color:' + color + ';">' + titleEn + titleZh + '</div>' +
        (p.d ? '<div class="text-xs" lang="en" style="margin-top:4px;color:var(--ink);">' + esc(p.d) + '</div>' : '') +
        (p.dZh ? '<div class="text-xs" lang="zh" style="margin-top:2px;color:var(--ink);">' + esc(p.dZh) + '</div>' : '') +
      '</div>';
    }).join('');
  }

  function renderAdvice(adviceObj) {
    if (!adviceObj || typeof adviceObj !== 'object') return '<p class="text-muted text-sm"><span lang="en">No advice recorded</span><span lang="zh">無建議</span></p>';
    var sections = [];

    // Section heading helper — emits EN + ZH spans so the lang-switcher
    // CSS shows only one in each mode (no stacked-bilingual headings).
    function head(en, zh) {
      return '<div class="text-xs text-muted" style="font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">' +
        '<span lang="en">' + esc(en) + '</span>' +
        '<span lang="zh">' + esc(zh) + '</span>' +
        '</div>';
    }

    if (Array.isArray(adviceObj.tips) && adviceObj.tips.length) {
      sections.push('<div style="margin-bottom:12px;">' + head('Lifestyle tips', '生活建議') +
        adviceObj.tips.map(function (t) {
          return '<div style="padding:6px 0;display:flex;gap:8px;">' +
            '<span style="flex-shrink:0;">' + esc(t.icon || '·') + '</span>' +
            '<div>' +
              '<div class="text-sm" lang="en">' + esc(t.en || '') + '</div>' +
              (t.zh ? '<div class="text-sm" lang="zh">' + esc(t.zh) + '</div>' : '') +
            '</div>' +
          '</div>';
        }).join('') + '</div>');
    }

    if (adviceObj.avoid) {
      // Brief #14a-fix-2: handle BOTH the new {en, zh} object format
      // (from the restructured HERB_MAP) AND the legacy concatenated
      // string format (still in historical doctor_advice DB rows).
      if (typeof adviceObj.avoid === 'object' && (adviceObj.avoid.en || adviceObj.avoid.zh)) {
        sections.push('<div style="margin-bottom:12px;">' + head('Avoid', '忌') +
          '<div class="text-sm">' +
            bilingual(adviceObj.avoid.en || '', adviceObj.avoid.zh || adviceObj.avoid.en || '') +
          '</div></div>');
      } else {
        // Legacy: concatenated string, optionally semicolon-joined
        // for multiple phrases. Per phrase: prefer the explicit
        // " · " separator if present; else splitBilingual.
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
        sections.push('<div style="margin-bottom:12px;">' + head('Avoid', '忌') +
          '<div class="text-sm">' + rendered + '</div></div>');
      }
    }

    // Brief #14a-fix-3: split foods + herbs into REGULAR and REDUCE
    // buckets so "(less) ice cream" doesn't read as a recommended
    // food. Each item passes through detectReducePrefix; reduce
    // items get a separate amber-tinted "Limit · 少量" section
    // (or "Use sparingly · 慎用" for herbs) immediately after the
    // recommended list. Sections render only when their bucket
    // has items — empty buckets emit nothing.
    function chipFor(item, extraClass, extraStyle) {
      var parts = (item && typeof item === 'object' && (item.en || item.zh))
        ? { en: item.en || item.zh || '', zh: item.zh || item.en || '' }
        : splitBilingual(item);
      return '<span class="chip' + (extraClass ? ' ' + extraClass : '') + '" style="' +
        (extraStyle || 'background:var(--washi);border:1px solid var(--border);border-radius:12px;padding:3px 10px;') +
        '">' + bilingual(parts.en, parts.zh) + '</span>';
    }
    var REDUCE_CHIP_STYLE = 'background:#FFF3CD;border:1px dashed #B5881A;border-radius:12px;padding:3px 10px;color:#6F5510;';

    // ── Foods: split into regular vs reduce ────────────────────────
    // Brief #14a-fix-4: sticky reduce context. Once a reduce prefix
    // is detected during iteration, ALL subsequent items in the same
    // array inherit the reduce classification. Matches the real-world
    // doctor data-entry pattern where comma-grouped reduce items get
    // the prefix only on the first member, e.g.
    //   ["Yam", "(less) ice cream", "cold drinks"]
    //   → "Yam" recommended, "ice cream" + "cold drinks" both reduce.
    // Trade-off: an interleaved "(less) X" + "Y recommended" array
    // would mis-route Y to reduce, but that pattern is much rarer
    // and far less harmful than the original bug (reduce items
    // showing up as recommendations).
    var regularFoods = [];
    var reduceFoods  = [];
    if (Array.isArray(adviceObj.foods)) {
      var stickyReduce = false;
      adviceObj.foods.forEach(function (f) {
        var d = detectReducePrefix(f);
        if (d.isReduce) {
          stickyReduce = true;
          reduceFoods.push(d.cleaned);
        } else if (stickyReduce) {
          // No explicit prefix on this item but we're in sticky-
          // reduce mode — inherit the classification, push as-is
          // (no cleaning needed since there was nothing to strip).
          reduceFoods.push(f);
        } else {
          regularFoods.push(f);
        }
      });
    }
    if (regularFoods.length) {
      sections.push('<div style="margin-bottom:12px;">' + head('Recommended foods', '建議食材') +
        '<div class="text-sm" style="display:flex;flex-wrap:wrap;gap:6px;">' +
          regularFoods.map(function (f) { return chipFor(f); }).join('') +
        '</div></div>');
    }
    if (reduceFoods.length) {
      sections.push('<div style="margin-bottom:12px;">' + head('Limit · 少量', 'Limit · 少量') +
        '<div class="text-xs" style="margin-bottom:6px;color:var(--muted);font-style:italic;">' +
          bilingual('Consume in smaller amounts', '建議減量食用') +
        '</div>' +
        '<div class="text-sm" style="display:flex;flex-wrap:wrap;gap:6px;">' +
          reduceFoods.map(function (f) { return chipFor(f, 'chip-reduce', REDUCE_CHIP_STYLE); }).join('') +
        '</div></div>');
    }

    // ── Herbs: same split + same sticky logic (defensive) ──────────
    var regularHerbs = [];
    var reduceHerbs  = [];
    if (Array.isArray(adviceObj.herbs)) {
      var stickyReduceH = false;
      adviceObj.herbs.forEach(function (h) {
        var d = detectReducePrefix(h);
        if (d.isReduce) {
          stickyReduceH = true;
          reduceHerbs.push(d.cleaned);
        } else if (stickyReduceH) {
          reduceHerbs.push(h);
        } else {
          regularHerbs.push(h);
        }
      });
    }
    if (regularHerbs.length) {
      sections.push('<div style="margin-bottom:12px;">' + head('Recommended herbs', '建議藥材') +
        '<div class="text-sm" style="display:flex;flex-wrap:wrap;gap:6px;">' +
          regularHerbs.map(function (h) { return chipFor(h); }).join('') +
        '</div></div>');
    }
    if (reduceHerbs.length) {
      sections.push('<div style="margin-bottom:12px;">' + head('Use sparingly · 慎用', 'Use sparingly · 慎用') +
        '<div class="text-xs" style="margin-bottom:6px;color:var(--muted);font-style:italic;">' +
          bilingual('Use in smaller doses or under guidance', '建議少量或在指導下使用') +
        '</div>' +
        '<div class="text-sm" style="display:flex;flex-wrap:wrap;gap:6px;">' +
          reduceHerbs.map(function (h) { return chipFor(h, 'chip-reduce', REDUCE_CHIP_STYLE); }).join('') +
        '</div></div>');
    }

    return sections.length ? sections.join('') : '<p class="text-muted text-sm"><span lang="en">No advice content</span><span lang="zh">無建議內容</span></p>';
  }

  function renderTongue(tongueObj) {
    if (!tongueObj || typeof tongueObj !== 'object') return '<p class="text-muted text-sm"><span lang="en">No tongue assessment</span><span lang="zh">無舌診</span></p>';
    var nameEn = tongueObj.name_en || '(unnamed)';
    var nameZh = tongueObj.name_zh || '';
    var conf = tongueObj.confidence != null ? Math.round(tongueObj.confidence * 100) + '%' : '—';
    return '<div style="padding:12px;background:var(--washi);border-radius:6px;">' +
      '<div class="text-sm" style="font-weight:600;color:var(--ink);">' +
        '<span lang="en">' + esc(nameEn) + '</span>' +
        (nameZh ? '<span lang="zh">' + esc(nameZh) + '</span>' : '') +
      '</div>' +
      '<div class="text-xs text-muted" style="margin-top:4px;">' +
        '<span lang="en">Confidence: ' + esc(conf) + '</span>' +
        '<span lang="zh">信心度: ' + esc(conf) + '</span>' +
      '</div>' +
      '</div>';
  }

  function renderFull(data) {
    data = data || {};
    var html = '';
    if (data.symptoms)             html += '<div class="text-label mt-4 mb-2">🧭 <span lang="en">Constitution answers</span><span lang="zh">體質問答</span></div>' + renderAnswers(data.symptoms);
    if (data.dimensions)           html += '<div class="text-label mt-4 mb-2">📊 <span lang="en">Dimensions</span><span lang="zh">維度</span></div>' + renderDimensions(data.dimensions);
    if (data.patterns)             html += '<div class="text-label mt-4 mb-2">🎯 <span lang="en">Patterns</span><span lang="zh">體質判定</span></div>' + renderPatterns(data.patterns);
    if (data.doctor_advice)        html += '<div class="text-label mt-4 mb-2">💡 <span lang="en">Doctor\'s advice</span><span lang="zh">醫師建議</span></div>' + renderAdvice(data.doctor_advice);
    if (data.tongue_constitution)  html += '<div class="text-label mt-4 mb-2">👅 <span lang="en">Tongue constitution</span><span lang="zh">舌診體質</span></div>' + renderTongue(data.tongue_constitution);
    return html || '<p class="text-muted text-sm"><span lang="en">No constitution data</span><span lang="zh">無體質資料</span></p>';
  }

  // === EXPOSE PUBLIC API ===
  HM.constitutionCard = {
    DIMS: DIMS,
    QS: QS,
    FOLLOW_UPS: FOLLOW_UPS,
    HERB_MAP: HERB_MAP,
    renderAnswers: renderAnswers,
    renderDimensions: renderDimensions,
    renderPatterns: renderPatterns,
    renderAdvice: renderAdvice,
    renderTongue: renderTongue,
    renderFull: renderFull,
    answerLabel: answerLabel,
    scoreLabel: scoreLabel,
    findQuestion: findQuestion,
    getConstitution: getConstitution,
    getTips: buildLifestyleTips,           // brief's documented alias
    buildLifestyleTips: buildLifestyleTips,// original name preserved
  };
})();
