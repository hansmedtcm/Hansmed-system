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

  var HERB_MAP = {
    'Qi Deficiency':         { herbs: ['黃耆 Huang Qi','黨參 Dang Shen','白朮 Bai Zhu','大棗 Da Zao','炙甘草 Zhi Gan Cao'], foods: ['山藥 Yam','紅棗 Red dates','小米粥 Millet congee','雞湯 Chicken broth'], avoid: 'Raw & cold foods, excessive sweating · 忌生冷食物' },
    'Blood Deficiency':      { herbs: ['熟地黃 Shu Di','當歸 Dang Gui','白芍 Bai Shao','阿膠 E Jiao','龍眼肉 Long Yan'], foods: ['豬肝 Pork liver','黑芝麻 Black sesame','菠菜 Spinach','枸杞 Wolfberry'], avoid: 'Spicy & drying foods · 忌辛辣燥熱' },
    'Blood Stasis':          { herbs: ['丹參 Dan Shen','川芎 Chuan Xiong','桃仁 Tao Ren','紅花 Hong Hua','益母草 Yi Mu Cao'], foods: ['山楂 Hawthorn','黑木耳 Black fungus','醋 Vinegar','玫瑰花茶 Rose tea'], avoid: 'Cold food & prolonged sitting · 忌生冷久坐' },
    'Qi Stagnation':         { herbs: ['柴胡 Chai Hu','香附 Xiang Fu','玫瑰花 Mei Gui','合歡皮 He Huan','鬱金 Yu Jin'], foods: ['柑橘 Citrus','茉莉花茶 Jasmine tea','薄荷 Mint','山楂 Hawthorn'], avoid: 'Isolation & overthinking · 避免獨處及過度思慮' },
    'Spleen Deficiency':     { herbs: ['茯苓 Fu Ling','白朮 Bai Zhu','山藥 Shan Yao','薏苡仁 Yi Yi Ren','蓮子 Lian Zi'], foods: ['南瓜 Pumpkin','小米 Millet','蓮藕 Lotus root','豆腐 Tofu'], avoid: 'Cold food & irregular meals · 忌生冷及飲食不規律' },
    'Deficiency Heat (Yin Xu)': { herbs: ['麥冬 Mai Dong','石斛 Shi Hu','玉竹 Yu Zhu','百合 Bai He','枸杞 Gou Qi'], foods: ['雪梨 Pear','銀耳 White fungus','蜂蜜 Honey','豆漿 Soy milk'], avoid: 'Spicy & fried foods, staying up late · 忌辛辣煎炸及熬夜' },
    'Deficiency Cold (Yang Xu)': { herbs: ['附子 Fu Zi','肉桂 Rou Gui','乾薑 Gan Jiang','杜仲 Du Zhong','淫羊藿 Yin Yang Huo'], foods: ['薑茶 Ginger tea','核桃 Walnut','韭菜 Chives','羊肉 Lamb'], avoid: 'Cold environments & raw foods · 忌受寒及生冷食物' },
    'Dampness / Phlegm':     { herbs: ['蒼朮 Cang Zhu','茯苓 Fu Ling','半夏 Ban Xia','陳皮 Chen Pi','薏苡仁 Yi Yi Ren'], foods: ["薏仁湯 Job's tears soup",'冬瓜 Winter melon','玉米鬚茶 Corn silk tea','綠豆 Mung bean'], avoid: 'Dairy, fried food & alcohol · 忌奶製品、煎炸及酒精' },
    'Allergic Constitution': { herbs: ['黃耆 Huang Qi','防風 Fang Feng','白朮 Bai Zhu','蟬蛻 Chan Tui','烏梅 Wu Mei'], foods: ['蜂蜜水 Honey water','生薑茶 Ginger tea','紅棗 Red dates'], avoid: 'Known allergens, cold & dusty environments · 忌已知過敏原' },
    'Poor Sleep':            { herbs: ['酸棗仁 Suan Zao Ren','柏子仁 Bai Zi Ren','夜交藤 Ye Jiao Teng','合歡花 He Huan Hua','龍眼肉 Long Yan'], foods: ['百合蓮子湯 Lily & lotus soup','牛奶 Warm milk','核桃 Walnut'], avoid: 'Caffeine after 2pm, screen time before bed · 忌下午後咖啡因及睡前使用電子設備' },
    'Balanced Constitution': { herbs: ['枸杞 Gou Qi','菊花 Ju Hua','靈芝 Ling Zhi','大棗 Da Zao'], foods: ['均衡飲食 Balanced diet','時令蔬果 Seasonal vegetables & fruit'], avoid: 'Overworking & irregular sleep · 忌過勞及作息不規律' },
  };

  // === HELPERS LIFTED VERBATIM FROM ai-diagnosis.js ===

  // Pattern detection — derives constitution patterns from dimension scores.
  function getConstitution(d) {
    var types = [];
    if (d.qi_xu <= -1) types.push({ l: 'Qi Deficiency',            c: '氣虧質',       col: 'blue',   d: 'Low energy, easily fatigued, weak immunity, short of breath.', dZh: '體力不足、容易疲倦、免疫力偏低、呼吸容易感到氣短。' });
    if (d.qi_xu >= 1) types.push({ l: 'Qi Excess',                c: '氣盛質',       col: 'red',    d: 'Overactive energy, prone to irritability and agitation.',       dZh: '精力過旺、容易煩躁不安、情緒激動、難以靜下來。' });
    if (d.qi_zhi >= 1) types.push({ l: 'Qi Stagnation',           c: '氣鬱質',       col: 'yellow', d: 'Emotional tension, chest oppression, frequent sighing.',         dZh: '情緒容易緊繃、胸口悶脹、常有嘆氣衝動、氣機不暢。' });
    if (d.pi_wei <= -1) types.push({ l: 'Spleen Deficiency',      c: '脾虛質',       col: 'yellow', d: 'Poor appetite, easy fullness, bloating after meals.',            dZh: '食慾不佳、稍食即飽、餐後容易腹脹。' });
    if (d.pi_wei >= 1) types.push({ l: 'Stomach Excess',          c: '胃實熱質',     col: 'red',    d: 'Overly strong appetite, stomach heat, bad breath.',              dZh: '食慾亢進、胃中燥熱、容易飢餓、易口臭。' });
    if (d.xue_xu <= -1) types.push({ l: 'Blood Deficiency',       c: '血虧質',       col: 'blue',   d: 'Pale complexion, dizziness, dry hair & nails, insomnia.',        dZh: '面色蒼白、頭暈目眩、頭髮指甲乾脆、睡眠質素差。' });
    if (d.xue_xu >= 1) types.push({ l: 'Blood Heat',              c: '血熱質',       col: 'red',    d: 'Flushed face, nosebleeds, inflamed skin conditions.',            dZh: '面色偏紅、容易流鼻血、皮膚易發炎。' });
    if (d.xue_yu >= 1) types.push({ l: 'Blood Stasis',            c: '血瘀質',       col: 'red',    d: 'Bruising, sharp stabbing pains, clotted menstruation.',          dZh: '容易瘀青、固定位置刺痛、經期血塊較多。' });
    if (d.ti_re <= -1) types.push({ l: 'Deficiency Heat (Yin Xu)',c: '陰虛內熱',     col: 'red',    d: 'Warm palms & soles, night sweats, afternoon flushing, dry mouth.', dZh: '手腳心發熱、夜間盜汗、午後潮熱、口乾舌燥。' });
    if (d.ti_re >= 1) types.push({ l: 'Excess Heat (Shi Re)',     c: '實熱質',       col: 'red',    d: 'Bad breath, constipation, inflamed acne, irritability.',        dZh: '口氣重、便秘、紅腫痘痘、體內實火旺盛。' });
    if (d.ti_han <= -1) types.push({ l: 'Deficiency Cold (Yang Xu)', c: '陽虛虛寒',  col: 'blue',   d: 'Cold extremities, loose stools, low metabolism.',               dZh: '四季手腳冰冷、大便偏軟、代謝偏低。' });
    if (d.ti_han >= 1) types.push({ l: 'Excess Cold (Shi Han)',   c: '實寒質',       col: 'blue',   d: 'Severe cramping from cold exposure, chills.',                    dZh: '受寒後腹部劇烈絞痛、畏寒明顯。' });
    if (d.shi_qi <= -1) types.push({ l: 'Yin Dryness',            c: '陰燥質',       col: 'yellow', d: 'Dry skin, persistent thirst, dryness unrelieved by water.',     dZh: '皮膚乾燥、持續口渴、津液虧損。' });
    if (d.shi_qi >= 1) types.push({ l: 'Dampness / Phlegm',       c: '痰濕質',       col: 'blue',   d: 'Heavy body, sluggish digestion, water retention, sticky stools.', dZh: '身體沉重、消化遲緩、容易水腫。' });
    if (d.shui_mian <= -1) types.push({ l: 'Poor Sleep',          c: '睡眠障礙',     col: 'yellow', d: 'Difficulty falling asleep, frequent waking, daytime fatigue.',  dZh: '入睡困難、容易驚醒、日間精神不佳。' });
    if (d.min_li >= 1) types.push({ l: 'Allergic Constitution',   c: '特稟質',       col: 'yellow', d: 'Hypersensitive immune response — rhinitis, eczema, asthma.',     dZh: '免疫過敏，易患鼻炎、濕疹、哮喘。' });
    if (!types.length) types.push({ l: 'Balanced Constitution',   c: '平和質',       col: 'green',  d: 'Harmonious Qi, Blood & fluids — excellent foundational health.', dZh: '氣血調和、整體體質良好。' });
    return types;
  }

  // Lifestyle tips. Original name in ai-diagnosis.js was buildLifestyleTips;
  // exposed here under both names so existing callers and the brief's
  // documented HM.constitutionCard.getTips alias both work.
  function buildLifestyleTips(d) {
    var tips = [];
    if (d.qi_xu <= -1)   tips.push({ icon:'😴', en:'Rest adequately. Avoid overexertion. Light exercise like Tai Chi or walking.',            zh:'適當休息，避免過勞，可練太極拳或散步。' });
    if (d.qi_zhi >= 1)   tips.push({ icon:'🧘', en:'Practise deep breathing, meditation or journaling daily. Social activities help.',         zh:'每日練習深呼吸、冥想或寫日記，多參與社交活動。' });
    if (d.pi_wei <= -1)  tips.push({ icon:'🍚', en:'Eat warm, cooked meals at regular times. Do not skip breakfast.',                          zh:'定時進食溫熱食物，避免不吃早餐。' });
    if (d.xue_xu <= -1)  tips.push({ icon:'💤', en:'Sleep before 11pm. Iron-rich foods (dark leafy greens, liver) replenish blood.',           zh:'晚上11點前入睡，多吃深綠色蔬菜及豬肝等補血食物。' });
    if (d.xue_yu >= 1)   tips.push({ icon:'🚶', en:'Walk 30 min/day to improve circulation. Avoid prolonged sitting.',                         zh:'每天步行30分鐘，改善血液循環，避免久坐。' });
    if (d.ti_re <= -1)   tips.push({ icon:'💧', en:'Drink 8 glasses of water. Sleep early. Avoid spicy and grilled foods.',                    zh:'每天喝足8杯水，早睡，避免辛辣燒烤。' });
    if (d.ti_han <= -1)  tips.push({ icon:'🧣', en:'Keep waist and knees warm. Drink ginger tea. Moxibustion recommended.',                    zh:'注意腰腿保暖，常飲薑茶，建議艾灸調理。' });
    if (d.shi_qi >= 1)   tips.push({ icon:'🏃', en:'Regular aerobic exercise. Low-sugar diet. Avoid sitting > 1 hour at a time.',              zh:'定期有氧運動，低糖飲食，避免連續久坐超過1小時。' });
    if (d.shi_qi <= -1)  tips.push({ icon:'🫧', en:'Increase fluid intake with warm drinks. Avoid drying foods like chips or crackers.',       zh:'多飲溫熱飲品補充水分，避免餅乾等燥熱食物。' });
    if (d.shui_mian <= -1) tips.push({ icon:'🌙', en:'Set a consistent sleep schedule. Avoid screens 1hr before bed. Try 酸棗仁 tea.',         zh:'固定作息時間，睡前1小時遠離電子設備，可嘗試酸棗仁茶。' });
    if (d.min_li >= 1)   tips.push({ icon:'🛡️', en:'Identify and avoid triggers. Strengthen immunity gradually with moderate exercise.',      zh:'找出並避免過敏原，透過適量運動提高免疫力。' });
    if (!tips.length)    tips.push({ icon:'⚖️', en:'Maintain your healthy routine — balanced diet, regular exercise, sufficient sleep.',      zh:'保持健康生活規律：均衡飲食、定期運動、充足睡眠。' });
    return tips;
  }

  // === RENDER HELPERS ===

  function esc(s) {
    return (window.HM && HM.format && HM.format.esc) ? HM.format.esc(s) : String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
      // adviceObj.avoid is a free-form string (often already bilingual
      // with a · separator); leave as-is — no good way to split here
      // without breaking caller-supplied strings.
      sections.push('<div style="margin-bottom:12px;">' + head('Avoid', '忌') +
        '<div class="text-sm">' + esc(adviceObj.avoid) + '</div></div>');
    }

    if (Array.isArray(adviceObj.foods) && adviceObj.foods.length) {
      // Food / herb names already carry their own bilingual form
      // (e.g. '山藥 Yam'); render as-is in a single line, language-
      // neutral so they show in both modes.
      sections.push('<div style="margin-bottom:12px;">' + head('Recommended foods', '建議食材') +
        '<div class="text-sm">' + adviceObj.foods.map(esc).join(' · ') + '</div></div>');
    }

    if (Array.isArray(adviceObj.herbs) && adviceObj.herbs.length) {
      sections.push('<div style="margin-bottom:12px;">' + head('Recommended herbs', '建議藥材') +
        '<div class="text-sm">' + adviceObj.herbs.map(esc).join(' · ') + '</div></div>');
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
