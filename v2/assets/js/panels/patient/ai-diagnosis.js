/**
 * AI Constitution Diagnosis — v2.
 *
 * 10-dimension TCM questionnaire with bilingual prompts, safety
 * follow-ups, radar chart + horizontal bar visualisations, and
 * pattern-based herb / food / lifestyle advice.
 *
 * Results are submitted to the backend questionnaires table so a
 * licensed doctor reviews before any personalised prescription
 * is shown to the patient (consistent with the tongue-review and
 * shop safety-gate workflows).
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  // ── Dimension metadata ─────────────────────────────────────
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

  // ── Questions ──────────────────────────────────────────────
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

  // ── Safety follow-ups ──────────────────────────────────────
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

  // ── Herb / food / avoid map by primary constitution ────────
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

  // ── State ──────────────────────────────────────────────────
  var state = { answers: {}, dims: {}, followUpAlerts: [], qIndex: 0 };

  async function render(el) {
    state = {
      answers: {}, dims: {}, followUpAlerts: [], qIndex: 0,
      tongueId: null, tongueReport: null, skippedTongue: false,
    };
    renderIntro(el);
  }

  // Single-session intro — no more separate tongue vs quiz buttons.
  // One "Start" button kicks off: tongue photo → 10 questions → combined report.
  function renderIntro(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">AI Diagnosis · AI 智能診斷</div>' +
      '<h1 class="page-title">Full TCM Assessment · 完整體質評估</h1>' +
      '<p class="text-muted mt-1">One guided session covering both tongue diagnosis and the 10-dimension constitution quiz. ' +
      'Your combined results go to a licensed TCM doctor for review and personalised advice. ' +
      '<span style="font-family: var(--font-zh);">一次性完成舌診與 10 維體質問卷，結果送交中醫師審核，獲取個人化建議。</span></p>' +
      '</div>' +

      // Flow explainer
      '<div class="card card--pad-lg mb-4">' +
      '<div class="grid-2" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--s-3);">' +
      aidStepCard('1', '👅', 'Tongue Photo', '舌頭照片', 'Upload a clear photo') +
      aidStepCard('2', '📝', '10 Questions', '10 題問卷', 'Bilingual TCM quiz') +
      aidStepCard('3', '🗺️', 'Constitution Map', '體質地圖', 'Radar + 10 dimensions') +
      aidStepCard('4', '🩺', 'Doctor Review', '醫師審核', 'Personalised plan') +
      '</div>' +
      '<div class="flex gap-2 mt-4 flex-wrap">' +
      '<button class="btn btn--primary btn--lg" id="aid-start-combined">🚀 Start Full Assessment · 開始完整評估 →</button>' +
      '<button class="btn btn--outline" id="aid-skip-tongue">Skip tongue, quiz only · 跳過舌診，只做問卷</button>' +
      '</div>' +
      '<p class="text-xs text-muted mt-3">Takes about 3–5 minutes. All data stays encrypted and only shared with the reviewing doctor. ' +
      '<span style="font-family: var(--font-zh);">約需 3–5 分鐘，資料加密保護。</span></p>' +
      '</div>' +

      // Combined history
      '<div class="mt-6">' +
      '<div class="text-label mb-3">📜 My Past Records · 過往記錄</div>' +
      '<div id="aid-past">Loading…</div>' +
      '</div>';

    injectStyle();
    document.getElementById('aid-start-combined').addEventListener('click', function () {
      state.skippedTongue = false;
      renderTongueStep(el);
    });
    document.getElementById('aid-skip-tongue').addEventListener('click', function () {
      state.skippedTongue = true;
      state.qIndex = 0;
      renderQuestion(el);
    });

    // Load combined history
    loadPastReports();
  }

  function aidStepCard(n, icon, en, zh, desc) {
    return '<div class="aid-step-card">' +
      '<div class="aid-step-num">' + n + '</div>' +
      '<div class="aid-step-icon">' + icon + '</div>' +
      '<div class="aid-step-en">' + en + '</div>' +
      '<div class="aid-step-zh">' + zh + '</div>' +
      '<div class="aid-step-desc">' + desc + '</div>' +
      '</div>';
  }

  // ── Step 1/11 — tongue photo ───────────────────────────────
  // Uploads the photo, polls for AI analysis, then transitions to the
  // 10-question quiz. The returned diagnosis id is kept in state so the
  // questionnaire submit can reference it as a single session.
  function renderTongueStep(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Step 1 of 11 · 第 1 / 11 步</div>' +
      '<h1 class="page-title">👅 Tongue Photo · 舌頭照片</h1>' +
      '<div class="aid-progress"><div class="aid-progress-fill" style="width: 9%;"></div></div>' +
      '</div>' +

      '<div class="card card--pad-lg" style="max-width: 700px;">' +
      '<p class="text-sm text-muted mb-4"><strong>Tips for best results · 最佳效果小貼士：</strong><br>' +
      '• Natural lighting, no filter · 自然光線，不使用濾鏡<br>' +
      '• Extend tongue fully, relaxed · 舌頭完全伸出，放鬆<br>' +
      '• Clean tongue (not right after eating) · 乾淨舌面（勿剛進食後）<br>' +
      '• Phone camera, 30–60 cm away · 手機距離 30–60 公分</p>' +

      '<label class="btn btn--primary btn--lg btn--block" style="cursor: pointer;">' +
      '📷 Upload Tongue Photo · 上傳舌頭照片' +
      '<input type="file" accept="image/*" capture="environment" id="aid-tongue-file" style="display:none;">' +
      '</label>' +

      '<div id="aid-tongue-status" style="display:none; margin-top: var(--s-4);"></div>' +

      '<div class="flex gap-2 mt-4">' +
      '<button class="btn btn--ghost" id="aid-tongue-back">← Back · 返回</button>' +
      '<button class="btn btn--outline" id="aid-tongue-skip">Skip this step · 跳過此步驟</button>' +
      '<button class="btn btn--primary" id="aid-tongue-next" style="margin-left:auto; display:none;">Continue to Questions · 繼續問卷 →</button>' +
      '</div>' +
      '</div>';

    injectStyle();
    document.getElementById('aid-tongue-back').addEventListener('click', function () { renderIntro(el); });
    document.getElementById('aid-tongue-skip').addEventListener('click', function () {
      state.skippedTongue = true;
      state.qIndex = 0;
      renderQuestion(el);
    });
    document.getElementById('aid-tongue-next').addEventListener('click', function () {
      state.qIndex = 0;
      renderQuestion(el);
    });
    document.getElementById('aid-tongue-file').addEventListener('change', handleTongueUpload);
  }

  async function handleTongueUpload(e) {
    var file = e.target.files[0];
    if (!file) return;

    var box = document.getElementById('aid-tongue-status');
    box.style.display = 'block';
    box.innerHTML =
      '<div class="flex gap-3" style="align-items:center;">' +
      '<img id="aid-tongue-preview" style="width:80px;height:80px;object-fit:cover;border-radius:var(--r-md);border:1px solid var(--border);">' +
      '<div><strong>✓ Photo uploaded · 照片已上傳</strong>' +
      '<div class="text-muted text-sm mt-1"><span class="spinner"></span> AI analysing… · AI 分析中…</div></div>' +
      '</div>';

    var reader = new FileReader();
    reader.onload = function (ev) {
      var img = document.getElementById('aid-tongue-preview');
      if (img) img.src = ev.target.result;
    };
    reader.readAsDataURL(file);

    try {
      var res = await HM.api.patient.uploadTongue(file);
      var diag = res.diagnosis;
      state.tongueId = diag.id;
      pollTongueAnalysis(diag.id, box);
    } catch (err) {
      box.innerHTML = '<div class="alert alert--danger"><div class="alert-body">' +
        (err.message || 'Upload failed') +
        ' — you can skip this step and continue with the quiz only.' +
        '</div></div>';
    }
  }

  function pollTongueAnalysis(id, box) {
    var attempts = 0;
    var iv = setInterval(async function () {
      attempts++;
      try {
        var r = await HM.api.patient.getDiagnosis(id);
        var d = r.diagnosis;
        if (d.status === 'completed') {
          clearInterval(iv);
          state.tongueReport = d;
          showTongueComplete(d, box);
        } else if (d.status === 'failed' || attempts > 30) {
          clearInterval(iv);
          box.innerHTML = '<div class="alert alert--warning"><div class="alert-body">' +
            'AI analysis took too long — you can still continue to the quiz. A doctor will see your photo. ' +
            '<span style="font-family: var(--font-zh);">AI 分析逾時，仍可繼續問卷，醫師會看到您的照片。</span>' +
            '</div></div>';
          document.getElementById('aid-tongue-next').style.display = 'inline-flex';
        }
      } catch (_) {}
    }, 3000);
  }

  function showTongueComplete(d, box) {
    var report = d.constitution_report || {};
    var c = report.constitution || {};
    var score = d.health_score;
    var scoreColor = score == null ? 'var(--stone)' : score >= 80 ? 'var(--sage)' : score >= 60 ? 'var(--gold)' : 'var(--red-seal)';
    box.innerHTML =
      '<div class="card card--bordered" style="border-left:3px solid var(--sage);">' +
      '<div class="flex-between mb-2"><strong>✓ AI analysis complete · AI 分析完成</strong>' +
      (score != null ? '<span style="font-weight:600;color:' + scoreColor + ';">Score: ' + score + '/100</span>' : '') +
      '</div>' +
      (c.name_en
        ? '<div class="text-sm">Initial constitution: <strong>' + HM.format.esc(c.name_en) + '</strong>' +
          (c.name_zh ? ' · <span style="font-family:var(--font-zh);">' + HM.format.esc(c.name_zh) + '</span>' : '') +
          '</div>'
        : '') +
      '<p class="text-xs text-muted mt-2">The quiz below will refine this with symptom-based dimensions. ' +
      '<span style="font-family:var(--font-zh);">下方問卷將進一步補充症狀資訊。</span></p>' +
      '</div>';
    document.getElementById('aid-tongue-next').style.display = 'inline-flex';
  }

  // ── Combined history: tongue scans + constitution reports, chronological ──
  async function loadPastReports() {
    var host = document.getElementById('aid-past');
    if (!host) return;
    try {
      var results = await Promise.all([
        HM.api.patient.listQuestionnaires().catch(function () { return { data: [] }; }),
        HM.api.patient.listDiagnoses().catch(function () { return { data: [] }; }),
      ]);
      var items = [];

      // Constitution questionnaires
      var qRows = (results[0] && results[0].data) || [];
      qRows.forEach(function (row) {
        var s = row.symptoms;
        if (typeof s === 'string') { try { s = JSON.parse(s); } catch (_) { s = {}; } }
        s = s || {};
        if (s.kind !== 'ai_constitution_v2') return;
        items.push({
          kind: 'constitution',
          id: row.id,
          created_at: row.created_at,
          review_status: s.review_status || 'pending',
          summary: s.patterns && s.patterns.length
            ? ((s.patterns[0].c || '') + (s.patterns[0].l ? ' · ' + s.patterns[0].l : ''))
            : 'Constitution report',
          has_advice: !!(s.doctor_comment || (s.doctor_advice && (s.doctor_advice.herbs || []).length)),
        });
      });

      // Tongue scans
      var tRows = (results[1] && results[1].data) || [];
      tRows.forEach(function (t) {
        var report = t.constitution_report || {};
        var c = report.constitution || {};
        items.push({
          kind: 'tongue',
          id: t.id,
          created_at: t.created_at,
          review_status: t.review_status || 'pending',
          summary: c.name_en || c.name_zh || 'Tongue scan',
          image_url: t.image_url,
          health_score: t.health_score,
          has_advice: !!(t.doctor_comment || (t.medicine_suggestions || []).length),
        });
      });

      if (!items.length) {
        host.innerHTML = '<div class="card"><p class="text-muted text-center" style="padding: var(--s-4);">No records yet. Start either assessment above. · 尚無記錄，請從上方開始。</p></div>';
        return;
      }

      // Sort newest first
      items.sort(function (a, b) { return (new Date(b.created_at)) - (new Date(a.created_at)); });

      host.innerHTML = '';
      items.forEach(function (it) { host.appendChild(renderHistoryCard(it)); });
    } catch (e) {
      host.innerHTML = '<div class="card"><p class="text-muted text-center" style="padding: var(--s-4);">Could not load records.</p></div>';
    }
  }

  function renderHistoryCard(it) {
    var card = document.createElement('div');
    card.className = 'card card--clickable mb-2';
    card.style.cursor = 'pointer';

    var statusBadge = {
      pending:       '<span class="badge">⏳ Pending review · 待審核</span>',
      approved:      '<span class="badge badge--success">✓ Reviewed · 已審核</span>',
      needs_changes: '<span class="badge badge--danger">⚠ Needs follow-up · 需跟進</span>',
    }[it.review_status] || '';

    var typeBadge = it.kind === 'tongue'
      ? '<span class="badge" style="background:rgba(184,150,90,.15);color:var(--gold);">👅 Tongue · 舌診</span>'
      : '<span class="badge" style="background:rgba(122,140,114,.15);color:var(--sage);">🧭 Constitution · 體質</span>';

    var imgHtml = (it.kind === 'tongue' && it.image_url)
      ? '<img src="' + HM.format.esc(it.image_url) + '" style="width:56px;height:56px;object-fit:cover;border-radius:var(--r-sm);border:1px solid var(--border);flex-shrink:0;">'
      : '<div style="width:56px;height:56px;border-radius:var(--r-sm);background:var(--washi);display:flex;align-items:center;justify-content:center;font-size:1.6rem;flex-shrink:0;">' + (it.kind === 'tongue' ? '👅' : '🧭') + '</div>';

    card.innerHTML = '<div class="flex gap-3" style="align-items:center;">' +
      imgHtml +
      '<div style="flex:1;">' +
      '<div class="flex gap-2 mb-1" style="align-items:center;flex-wrap:wrap;">' + typeBadge + statusBadge + '</div>' +
      '<div class="card-title" style="font-size: var(--text-base);">' + HM.format.esc(it.summary) + '</div>' +
      '<div class="text-xs text-muted mt-1">' + HM.format.datetime(it.created_at) +
      (it.review_status === 'approved' && it.has_advice ? ' · 💬 Doctor has added advice' : '') +
      (it.kind === 'tongue' && it.health_score != null ? ' · Score ' + it.health_score + '/100' : '') +
      '</div>' +
      '</div>' +
      '<div style="text-align:right;">' +
      '<div class="text-xs text-muted">View →</div>' +
      '</div>' +
      '</div>';

    card.addEventListener('click', function () {
      if (it.kind === 'tongue') location.hash = '#/tongue/' + it.id;
      else                      location.hash = '#/ai-diagnosis/' + it.id;
    });
    return card;
  }

  function renderQuestion(el) {
    var q = QS[state.qIndex];
    var step = state.qIndex + 1;
    var total = QS.length;
    // Overall progress includes the tongue step (unless skipped) + 10 Qs + review
    var totalSteps = state.skippedTongue ? (total + 1) : (total + 2);
    var currentStep = state.skippedTongue ? step : step + 1;
    var pct = Math.round((currentStep / totalSteps) * 100);

    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">' + q.mod + '</div>' +
      '<div class="flex-between mt-2">' +
      '<div class="text-sm text-muted">Step ' + currentStep + ' of ' + totalSteps + ' · Question ' + step + ' / ' + total + '</div>' +
      '<div class="text-sm text-muted">' + pct + '%</div>' +
      '</div>' +
      '<div class="aid-progress"><div class="aid-progress-fill" style="width: ' + pct + '%;"></div></div>' +
      '</div>' +

      '<div class="grid-2" style="grid-template-columns: 1fr 300px; gap: var(--s-5); align-items: start;">' +

      '<div>' +
      '<h2 class="mb-2">' + HM.format.esc(q.titleEn) + '</h2>' +
      '<p class="text-muted mb-4" style="font-family: var(--font-zh);">' + HM.format.esc(q.titleZh) + '</p>' +
      '<div id="aid-opts"></div>' +

      '<div class="flex gap-2 mt-4">' +
      (state.qIndex > 0 ? '<button class="btn btn--ghost" id="aid-back">← Back · 上一題</button>' : '') +
      '<button class="btn btn--primary" id="aid-next" disabled>' + (state.qIndex === total - 1 ? 'Generate Report · 生成報告' : 'Next · 下一題') + ' →</button>' +
      '</div>' +
      '</div>' +

      '<div class="card" style="padding: var(--s-4); position: sticky; top: var(--s-4);">' +
      '<div class="text-label mb-3">Live Dimensions · 即時體質</div>' +
      '<div id="aid-live"></div>' +
      '</div>' +

      '</div>';

    injectStyle();
    renderOptions(q);
    renderLive();

    if (state.answers[q.id] !== undefined) {
      document.getElementById('aid-next').disabled = false;
    }
    if (state.qIndex > 0) {
      document.getElementById('aid-back').addEventListener('click', function () {
        state.qIndex--;
        renderQuestion(el);
      });
    }
    document.getElementById('aid-next').addEventListener('click', function () {
      if (q.followUp && state.answers[q.id] !== undefined && state.answers[q.id] === q.fuTrigger) {
        renderFollowUp(el, q);
      } else {
        advance(el);
      }
    });
  }

  function renderOptions(q) {
    var host = document.getElementById('aid-opts');
    host.innerHTML = q.opts.map(function (opt, i) {
      var sel = state.answers[q.id] === opt.v ? ' aid-opt--selected' : '';
      return '<button type="button" class="aid-opt' + sel + '" data-idx="' + i + '">' +
        '<div class="aid-opt-en">' + HM.format.esc(opt.t) + '</div>' +
        '<div class="aid-opt-zh">' + HM.format.esc(opt.s) + '</div>' +
        '</button>';
    }).join('');

    host.querySelectorAll('.aid-opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        var opt = q.opts[idx];
        state.answers[q.id] = opt.v;
        state.dims[q.dim] = opt.v;
        host.querySelectorAll('.aid-opt').forEach(function (b) { b.classList.remove('aid-opt--selected'); });
        btn.classList.add('aid-opt--selected');
        document.getElementById('aid-next').disabled = false;
        renderLive();
      });
    });
  }

  function renderLive() {
    var host = document.getElementById('aid-live');
    if (!host) return;
    var keys = Object.keys(state.dims);
    if (!keys.length) {
      host.innerHTML = '<p class="text-xs text-muted">Answers will fill this panel as you go. · 您的答案會即時顯示於此。</p>';
      return;
    }
    host.innerHTML = keys.map(function (k) {
      var v = state.dims[k];
      var meta = DIMS[k];
      var color = v === 0 ? 'var(--sage)' : Math.abs(v) >= 2 ? 'var(--red-seal)' : 'var(--gold)';
      var sign = v > 0 ? '+' + v : v === 0 ? '0' : v;
      return '<div style="padding: 6px 0; border-bottom: 1px solid var(--border);">' +
        '<div class="flex-between" style="font-size: var(--text-xs);">' +
        '<span style="font-weight: 500;">' + meta.enShort + '</span>' +
        '<span style="color: ' + color + '; font-family: var(--font-mono);">[' + sign + ']</span>' +
        '</div>' +
        '<div style="font-family: var(--font-zh); font-size: var(--text-xs); color: var(--stone);">' + meta.zhShort + '</div>' +
        '</div>';
    }).join('');
  }

  // ── Safety follow-ups ──────────────────────────────────────
  function renderFollowUp(el, q) {
    var fu = FOLLOW_UPS[q.id];
    if (!fu) { advance(el); return; }

    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label" style="color: var(--red-seal);">' + fu.title + '</div>' +
      '</div>' +

      '<div class="card card--pad-lg" style="border-left: 3px solid var(--red-seal); max-width: 780px;">' +
      '<h2 class="mb-2">' + HM.format.esc(fu.question) + '</h2>' +
      '<p class="text-muted mb-4" style="font-family: var(--font-zh);">' + HM.format.esc(fu.questionZh) + '</p>' +

      '<div class="alert alert--info mb-4">' +
      '<div class="alert-body text-sm">' +
      '<strong>Why we ask · 為何詢問</strong><br>' +
      HM.format.esc(fu.purpose) + '<br>' +
      '<span style="font-family: var(--font-zh);">' + HM.format.esc(fu.purposeZh) + '</span>' +
      '</div></div>' +

      '<div id="aid-fu-alert" class="alert alert--danger mb-4" style="display: none;">' +
      '<div class="alert-body">' + HM.format.esc(fu.alert) + '</div></div>' +

      '<div class="flex gap-2">' +
      '<button class="btn btn--ghost btn--lg" id="aid-fu-no">No · 否</button>' +
      '<button class="btn btn--danger btn--lg" id="aid-fu-yes">Yes · 是</button>' +
      '<button class="btn btn--primary btn--lg" id="aid-fu-proceed" style="display: none;">I understand, continue · 繼續測評</button>' +
      '</div>' +
      '</div>';

    document.getElementById('aid-fu-no').addEventListener('click', function () { advance(el); });
    document.getElementById('aid-fu-yes').addEventListener('click', function () {
      document.getElementById('aid-fu-alert').style.display = 'block';
      document.getElementById('aid-fu-no').disabled = true;
      document.getElementById('aid-fu-yes').disabled = true;
      document.getElementById('aid-fu-proceed').style.display = 'inline-flex';
      state.followUpAlerts.push({ alert: fu.alert, purposeZh: fu.purposeZh });
    });
    document.getElementById('aid-fu-proceed').addEventListener('click', function () { advance(el); });
  }

  function advance(el) {
    if (state.qIndex < QS.length - 1) {
      state.qIndex++;
      renderQuestion(el);
    } else {
      renderReport(el);
    }
  }

  // ── Pattern detection ──────────────────────────────────────
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

  // ── Lifestyle tips ─────────────────────────────────────────
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

  // ── REPORT ─────────────────────────────────────────────────
  // The patient's pre-submit report shows ONLY the dimensions + constitution
  // pills (no herb/food/lifestyle advice). Advice is reserved for the
  // doctor-approved version on the detail page.
  function renderReport(el) {
    var dims = state.dims;
    Object.keys(DIMS).forEach(function (k) { if (!(k in dims)) dims[k] = 0; });

    var types = getConstitution(dims);
    var alerts = state.followUpAlerts || [];

    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Constitution Report · 體質報告</div>' +
      '<h1 class="page-title">Your 10-Dimension Profile</h1>' +
      '<p class="text-muted mt-1">Assessment complete. Submit for doctor review — your personalised herb, food and lifestyle advice will appear here after approval.</p>' +
      '</div>' +

      (alerts.length ? renderAlerts(alerts) : '') +

      // Constitution pills
      '<div class="card card--pad-lg mb-4">' +
      '<div class="text-label mb-3">Diagnosed Constitution · 體質診斷</div>' +
      '<div class="flex gap-2 flex-wrap mb-4">' +
      types.map(function (t) {
        var colorMap = { green: 'var(--sage)', yellow: 'var(--gold)', red: 'var(--red-seal)', blue: '#6699bb' };
        var c = colorMap[t.col];
        return '<span class="aid-pill" style="background:' + c + '22; color:' + c + '; border:1px solid ' + c + '66;">' +
          HM.format.esc(t.l) + ' · ' + HM.format.esc(t.c) + '</span>';
      }).join('') +
      '</div>' +
      '<div style="font-size: var(--text-sm); line-height: var(--leading-relaxed); color: var(--stone);">' +
      types.map(function (t) {
        return '<div class="mb-2">' +
          '<strong style="color: var(--ink);">' + HM.format.esc(t.c) + ' · ' + HM.format.esc(t.l) + '</strong>' +
          '<div class="mt-1">' + HM.format.esc(t.d) + '</div>' +
          '<div style="font-family: var(--font-zh); font-size: var(--text-xs); color: var(--stone);">' + HM.format.esc(t.dZh) + '</div>' +
          '</div>';
      }).join('') +
      '</div>' +

      // High-pressure warning for qi_xu >= 2
      (dims.qi_xu >= 2 ? (
        '<div class="alert alert--danger mt-4" style="border-left-width: 4px;">' +
        '<div class="alert-icon">⚠️</div>' +
        '<div class="alert-body">' +
        '<strong>High-Pressure Risk · 高壓風險預警</strong><br>' +
        '氣之盈虧 [+2] — Your body is in <em>high-pressure running mode</em>. Not simply high energy, but upward-surging Qi with excessive systemic pressure. ' +
        '<span style="font-family: var(--font-zh);">氣機上衝、系統壓力過大。若不調降，長期可能耗損元氣，甚至造成血管壓力過大（高血壓風險）。</span>' +
        '</div></div>'
      ) : '') +

      '</div>' +

      // Radar chart + dimension bars
      '<div class="grid-2" style="grid-template-columns: 360px 1fr; gap: var(--s-5); align-items: start; margin-bottom: var(--s-4);">' +
      '<div class="card card--pad-lg">' +
      '<div class="text-label mb-2">Radar Chart · 雷達圖</div>' +
      '<div class="text-xs text-muted mb-3">Distance from centre = severity. Balanced = near centre.</div>' +
      renderRadar(dims) +
      '</div>' +
      '<div class="card card--pad-lg">' +
      '<div class="text-label mb-3">10 Dimensions · 10 維體質</div>' +
      renderDimBars(dims) +
      '</div>' +
      '</div>' +

      // What comes next
      '<div class="alert alert--info mb-4">' +
      '<div class="alert-icon">🩺</div>' +
      '<div class="alert-body">' +
      '<strong>Next step · 下一步</strong><br>' +
      'Submit this report for a licensed TCM doctor to review. They will personalise your herb suggestions, food advice, and lifestyle tips based on your profile — and you will see the approved plan back on this page. ' +
      '<span style="font-family: var(--font-zh);">送出後由持證中醫師審核，您將收到個人化的草藥、飲食與生活建議。</span>' +
      '</div></div>' +

      '<div class="flex gap-2 flex-wrap">' +
      '<button class="btn btn--primary btn--lg" id="aid-save">Submit for Doctor Review · 送交醫師</button>' +
      '<button class="btn btn--outline btn--lg" onclick="location.hash=\'#/book\'">Book Consultation · 預約深度問診</button>' +
      '<button class="btn btn--ghost" id="aid-restart">Restart · 重新測評</button>' +
      '</div>';

    injectStyle();
    document.getElementById('aid-save').addEventListener('click', function () { saveReport(types, alerts); });
    document.getElementById('aid-restart').addEventListener('click', function () { render(el); });
  }

  // Render a previously-submitted report — same dimensions view, plus the
  // doctor-approved advice block if the doctor has reviewed.
  function renderApprovedReport(el, report) {
    var dims = report.dimensions || {};
    Object.keys(DIMS).forEach(function (k) { if (!(k in dims)) dims[k] = 0; });
    var types = report.patterns || getConstitution(dims);
    var alerts = report.safety_alerts || [];
    var status = report.review_status || 'pending';
    var advice = report.doctor_advice || {};
    var comment = report.doctor_comment || '';
    var reviewedAt = report.reviewed_at || '';

    var banner = '';
    if (status === 'pending') {
      banner = '<div class="alert alert--info mb-4"><div class="alert-icon">⏳</div><div class="alert-body">' +
        '<strong>Awaiting Doctor Review · 等待醫師審核</strong><br>' +
        'Your personalised advice will appear here once a licensed TCM doctor has reviewed your report. ' +
        '<span style="font-family: var(--font-zh);">醫師審核後將顯示個人化建議。</span>' +
        '</div></div>';
    } else if (status === 'approved') {
      banner = '<div class="alert alert--success mb-4"><div class="alert-icon">✓</div><div class="alert-body">' +
        '<strong>Reviewed &amp; Approved by Doctor · 醫師已審核批准</strong>' +
        (reviewedAt ? '<div class="text-xs text-muted mt-1">' + HM.format.datetime(reviewedAt) + '</div>' : '') +
        '</div></div>';
    } else if (status === 'needs_changes') {
      banner = '<div class="alert alert--warning mb-4"><div class="alert-icon">⚠</div><div class="alert-body">' +
        '<strong>Doctor Requested Clarification · 醫師要求補充資料</strong><br>' +
        'Please read the comments below and consider booking a consultation.' +
        '</div></div>';
    }

    // Tongue section — shown when this report was submitted as part of a
    // combined session (tongue photo → questions → one submission).
    var tongueSection = '';
    if (report.tongue_diagnosis_id || report.tongue_image_url || report.tongue_constitution) {
      var tc = report.tongue_constitution || {};
      var tScore = report.tongue_health_score;
      var tColor = tScore == null ? 'var(--stone)' : tScore >= 80 ? 'var(--sage)' : tScore >= 60 ? 'var(--gold)' : 'var(--red-seal)';
      tongueSection =
        '<div class="card card--pad-lg mb-4" style="border-left:3px solid var(--gold);">' +
        '<div class="text-label mb-3">👅 Tongue Diagnosis · 舌診結果</div>' +
        '<div class="flex gap-4" style="align-items:center;flex-wrap:wrap;">' +
        (report.tongue_image_url
          ? '<img src="' + HM.format.esc(report.tongue_image_url) + '" style="width:110px;height:110px;object-fit:cover;border-radius:var(--r-md);border:1px solid var(--border);">'
          : '<div style="width:110px;height:110px;border-radius:var(--r-md);background:var(--washi);display:flex;align-items:center;justify-content:center;font-size:3rem;">👅</div>') +
        '<div style="flex:1;min-width:200px;">' +
        (tc.name_en
          ? '<div style="font-weight:600;">' + HM.format.esc(tc.name_en) + '</div>'
          : '') +
        (tc.name_zh
          ? '<div style="font-family:var(--font-zh);color:var(--stone);">' + HM.format.esc(tc.name_zh) + '</div>'
          : '') +
        (tScore != null
          ? '<div class="mt-2">Health Score: <strong style="font-size:1.3rem;color:' + tColor + ';">' + tScore + '</strong>/100</div>'
          : '') +
        (report.tongue_diagnosis_id
          ? '<a href="#/tongue/' + report.tongue_diagnosis_id + '" class="btn btn--ghost btn--sm mt-2">View tongue details · 詳細舌診 →</a>'
          : '') +
        '</div>' +
        '</div>' +
        '</div>';
    }

    el.innerHTML = '<div class="page-header">' +
      '<button class="btn btn--ghost" onclick="location.hash=\'#/ai-diagnosis\'">← New Assessment · 新測評</button>' +
      '<h1 class="page-title mt-2">Full TCM Report · 完整體質報告</h1>' +
      '<p class="text-muted mt-1">Combined tongue diagnosis and 10-dimension constitution assessment · 舌診與體質問卷綜合報告</p>' +
      '</div>' +

      banner +

      (alerts.length ? renderAlerts(alerts) : '') +

      tongueSection +

      // Constitution pills — always shown
      '<div class="card card--pad-lg mb-4">' +
      '<div class="text-label mb-3">Diagnosed Constitution · 體質診斷</div>' +
      '<div class="flex gap-2 flex-wrap mb-4">' +
      types.map(function (t) {
        var colorMap = { green:'var(--sage)', yellow:'var(--gold)', red:'var(--red-seal)', blue:'#6699bb' };
        var c = colorMap[t.col] || 'var(--stone)';
        return '<span class="aid-pill" style="background:' + c + '22; color:' + c + '; border:1px solid ' + c + '66;">' +
          HM.format.esc(t.l || '') + (t.c ? ' · ' + HM.format.esc(t.c) : '') + '</span>';
      }).join('') +
      '</div>' +
      '</div>' +

      // Radar + bars — always shown
      '<div class="grid-2" style="grid-template-columns: 360px 1fr; gap: var(--s-5); align-items: start; margin-bottom: var(--s-4);">' +
      '<div class="card card--pad-lg">' +
      '<div class="text-label mb-2">Radar Chart · 雷達圖</div>' +
      renderRadar(dims) +
      '</div>' +
      '<div class="card card--pad-lg">' +
      '<div class="text-label mb-3">10 Dimensions · 10 維體質</div>' +
      renderDimBars(dims) +
      '</div>' +
      '</div>' +

      // Doctor advice — ONLY after approval
      (status === 'approved' || status === 'needs_changes' ? renderDoctorAdvice(comment, advice) : '') +

      '<div class="flex gap-2 mt-4 flex-wrap">' +
      '<button class="btn btn--primary" onclick="location.hash=\'#/book\'">Book Consultation · 預約問診</button>' +
      '<button class="btn btn--outline" onclick="location.hash=\'#/ai-diagnosis\'">New Assessment · 新測評</button>' +
      '</div>';

    injectStyle();
  }

  function renderDoctorAdvice(comment, advice) {
    advice = advice || {};
    var herbs = advice.herbs || [];
    var foods = advice.foods || [];
    var avoid = advice.avoid || '';
    var tips  = advice.tips  || [];

    var out = '<div class="card card--pad-lg mb-4" style="border-left: 3px solid var(--sage);">' +
      '<div class="text-label mb-3">💬 Doctor\'s Plan · 醫師審核建議</div>';

    if (comment) {
      out += '<p style="white-space: pre-wrap; margin-bottom: var(--s-4); line-height: var(--leading-relaxed);">' + HM.format.esc(comment) + '</p>';
    }

    if (herbs.length) {
      out += '<div class="text-label mb-2">🌿 Herbs · 建議草藥</div>' +
        '<div class="flex gap-2 flex-wrap mb-4">' +
        herbs.map(function (h) { return '<span class="aid-tag aid-tag--sage">' + HM.format.esc(h) + '</span>'; }).join('') +
        '</div>';
    }
    if (foods.length) {
      out += '<div class="text-label mb-2">🍱 Beneficial Foods · 有益食療</div>' +
        '<div class="flex gap-2 flex-wrap mb-4">' +
        foods.map(function (f) { return '<span class="aid-tag aid-tag--gold">' + HM.format.esc(f) + '</span>'; }).join('') +
        '</div>';
    }
    if (avoid) {
      out += '<div class="alert alert--warning mb-4"><div class="alert-icon">❌</div><div class="alert-body">' +
        '<strong>Avoid · 飲食禁忌</strong><br>' + HM.format.esc(avoid) +
        '</div></div>';
    }
    if (tips.length) {
      out += '<div class="text-label mb-2">💡 Lifestyle Advice · 生活建議</div>' +
        '<div class="aid-tips">' +
        tips.map(function (t) {
          return '<div class="aid-tip">' +
            '<span class="aid-tip-icon">' + (t.icon || '💡') + '</span>' +
            '<div>' +
            (t.en ? '<div>' + HM.format.esc(t.en) + '</div>' : '') +
            (t.zh ? '<div style="font-family: var(--font-zh); font-size: var(--text-xs); color: var(--stone); margin-top: 2px;">' + HM.format.esc(t.zh) + '</div>' : '') +
            '</div></div>';
        }).join('') +
        '</div>';
    }
    if (!herbs.length && !foods.length && !avoid && !tips.length && !comment) {
      out += '<p class="text-muted">Doctor has not yet added personalised advice.</p>';
    }

    out += '<div class="alert alert--warning mt-4"><div class="alert-body text-xs">' +
      'This plan is based on your constitution profile and the reviewing doctor\'s judgment. For complex or multi-herb prescriptions, book a follow-up consultation. ' +
      '<span style="font-family: var(--font-zh);">複方處方請預約深入問診。</span>' +
      '</div></div>';

    out += '</div>';
    return out;
  }

  function renderAlerts(alerts) {
    return '<div class="alert alert--danger mb-4" style="border-width: 2px;">' +
      '<div class="alert-icon">⚠️</div>' +
      '<div class="alert-body">' +
      '<strong>Urgent Medical Alerts · 醫療警示（重要提示）</strong>' +
      '<div class="mt-3">' +
      alerts.map(function (a) {
        return '<div style="padding: var(--s-2) 0; border-bottom: 1px solid rgba(192,57,43,.2); font-size: var(--text-sm);">' +
          HM.format.esc(a.alert) +
          '<div class="text-xs text-muted mt-1" style="font-family: var(--font-zh);">' + HM.format.esc(a.purposeZh) + '</div>' +
          '</div>';
      }).join('') +
      '</div>' +
      '<div class="mt-3 text-sm" style="font-weight: 500;">Please consult a licensed physician before starting any herbal treatment. · 開始任何中藥前請先諮詢持牌醫師。</div>' +
      '</div></div>';
  }

  // ── Radar chart (SVG) ──────────────────────────────────────
  function renderRadar(dims) {
    var keys = Object.keys(DIMS);
    var cx = 150, cy = 150, r = 110;
    var N = keys.length;

    // Severity = |value| / 2 ( normalised 0..1 )
    function severity(k) {
      var v = dims[k] || 0;
      var m = DIMS[k];
      var range = Math.max(Math.abs(m.min), Math.abs(m.max));
      return Math.min(1, Math.abs(v) / range);
    }

    // Compute point for each axis
    function pt(i, rr) {
      var angle = (-Math.PI / 2) + i * (2 * Math.PI / N);
      return [cx + rr * Math.cos(angle), cy + rr * Math.sin(angle)];
    }

    var svg = '<svg viewBox="0 0 300 300" style="width:100%;max-width:300px;height:auto;display:block;margin:0 auto;" xmlns="http://www.w3.org/2000/svg">';

    // Grid circles
    [0.25, 0.5, 0.75, 1].forEach(function (s) {
      svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * s) + '" fill="none" stroke="#e8e2d6" stroke-width="1"/>';
    });

    // Axes
    keys.forEach(function (k, i) {
      var p = pt(i, r);
      svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0] + '" y2="' + p[1] + '" stroke="#e8e2d6" stroke-width="1"/>';
    });

    // Severity polygon (filled)
    var pts = keys.map(function (k, i) {
      var s = severity(k);
      var p = pt(i, r * s);
      return p[0] + ',' + p[1];
    }).join(' ');
    svg += '<polygon points="' + pts + '" fill="rgba(184,150,90,0.25)" stroke="#b8965a" stroke-width="2" stroke-linejoin="round"/>';

    // Dots
    keys.forEach(function (k, i) {
      var v = dims[k] || 0;
      var s = severity(k);
      var p = pt(i, r * s);
      var color = v === 0 ? '#7a8c72' : Math.abs(v) >= 2 ? '#c0392b' : '#b8965a';
      svg += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" fill="' + color + '" stroke="#fff" stroke-width="1.5"/>';
    });

    // Labels (place just outside radius)
    keys.forEach(function (k, i) {
      var meta = DIMS[k];
      var p = pt(i, r + 22);
      var anchor = p[0] < cx - 5 ? 'end' : p[0] > cx + 5 ? 'start' : 'middle';
      svg += '<text x="' + p[0] + '" y="' + p[1] + '" text-anchor="' + anchor + '" alignment-baseline="middle" ' +
        'font-family="var(--font-body)" font-size="9" fill="#1a1612">' + meta.enShort + '</text>';
      svg += '<text x="' + p[0] + '" y="' + (p[1] + 10) + '" text-anchor="' + anchor + '" alignment-baseline="middle" ' +
        'font-family="Noto Serif SC,serif" font-size="9" fill="#7a7068">' + meta.zhShort + '</text>';
    });

    svg += '</svg>';

    // Small legend
    svg += '<div class="flex gap-3 flex-wrap mt-3" style="font-size: var(--text-xs); color: var(--stone); justify-content: center;">' +
      '<span><span style="display:inline-block;width:8px;height:8px;background:#7a8c72;border-radius:50%;margin-right:4px;"></span>Balanced</span>' +
      '<span><span style="display:inline-block;width:8px;height:8px;background:#b8965a;border-radius:50%;margin-right:4px;"></span>Mild</span>' +
      '<span><span style="display:inline-block;width:8px;height:8px;background:#c0392b;border-radius:50%;margin-right:4px;"></span>Strong</span>' +
      '</div>';

    return svg;
  }

  // ── Horizontal dimension bars (grouped) ────────────────────
  function renderDimBars(dims) {
    var groups = [
      { title: '🔋 Energy · 氣與脾胃',       keys: ['qi_xu','qi_zhi','pi_wei'] },
      { title: '🩸 Circulation · 血',        keys: ['xue_xu','xue_yu'] },
      { title: '❄️🔥 Temperature · 寒熱',    keys: ['ti_re','ti_han'] },
      { title: '💧 Moisture · 濕燥',         keys: ['shi_qi'] },
      { title: '🌙 Sleep & Immunity · 睡眠免疫', keys: ['shui_mian','min_li'] },
    ];
    return groups.map(function (g) {
      return '<div class="aid-group">' +
        '<div class="aid-group-title">' + g.title + '</div>' +
        g.keys.map(function (k) { return renderDimBar(k, dims[k] || 0); }).join('') +
        '</div>';
    }).join('');
  }

  function renderDimBar(key, val) {
    var meta = DIMS[key];
    var isCtr = meta.min < 0;
    var range = meta.max - meta.min;
    var pct = ((val - meta.min) / range) * 100;

    // Tag colour/text by value
    var tag, tagCol;
    if (val === 0)       { tag = 'Balanced · 平衡';         tagCol = '#7a8c72'; }
    else if (val === -1) { tag = 'Mild Deficiency · 輕度不足'; tagCol = '#5588bb'; }
    else if (val === -2) { tag = 'Severe Deficiency · 嚴重不足'; tagCol = '#3366aa'; }
    else if (val === 1)  { tag = 'Mild Excess · 輕度偏高';   tagCol = '#b8965a'; }
    else                 { tag = 'Elevated · 明顯偏高';     tagCol = '#c0392b'; }

    var bar;
    if (isCtr) {
      var w = Math.abs(pct - 50);
      var left = val < 0 ? pct : 50;
      bar = '<div class="aid-bar-track">' +
        '<div class="aid-bar-center"></div>' +
        '<div class="aid-bar-fill" style="left:' + left + '%;width:' + w + '%;background:' + tagCol + ';"></div>' +
        '</div>';
    } else {
      bar = '<div class="aid-bar-track">' +
        '<div class="aid-bar-fill" style="left:0;width:' + pct + '%;background:' + tagCol + ';"></div>' +
        '</div>';
    }

    var sign = val > 0 ? '+' + val : val === 0 ? '0' : val;
    var scale = isCtr
      ? '<div class="aid-bar-scale" style="grid-template-columns:1fr 1fr 1fr;"><span style="text-align:left;">← ' + meta.minLbl + '</span><span style="text-align:center;color:#7a8c72;">0 · 平衡</span><span style="text-align:right;">' + meta.maxLbl + ' →</span></div>'
      : '<div class="aid-bar-scale" style="grid-template-columns:1fr 1fr;"><span style="text-align:left;">← ' + meta.minLbl + '</span><span style="text-align:right;">' + meta.maxLbl + ' →</span></div>';

    return '<div class="aid-dim-row">' +
      '<div class="flex-between mb-1" style="align-items:flex-end;">' +
      '<div><div class="aid-dim-label-en">' + meta.enShort + '</div>' +
      '<div class="aid-dim-label-zh">' + meta.zhShort + '</div></div>' +
      '<div style="text-align:right;">' +
      '<div class="aid-dim-score" style="color:' + tagCol + ';">[' + sign + ']</div>' +
      '<div class="aid-dim-tag" style="background:' + tagCol + '22; color:' + tagCol + '; border-color:' + tagCol + '66;">' + tag + '</div>' +
      '</div>' +
      '</div>' +
      bar + scale +
      '</div>';
  }

  async function saveReport(types, alerts) {
    var btn = document.getElementById('aid-save');
    btn.disabled = true;
    btn.textContent = 'Submitting… · 送出中…';
    var payload = {
      symptoms: {
        kind:          'ai_constitution_v2',
        review_status: 'pending',
        answers:       state.answers,
        dimensions:    state.dims,
        patterns:      types,
        safety_alerts: alerts,
        submitted_at:  new Date().toISOString(),
        // Link this questionnaire to the tongue scan from the same session
        // so the reviewing doctor sees both sides of the assessment together.
        tongue_diagnosis_id:     state.tongueId || null,
        tongue_health_score:     state.tongueReport ? state.tongueReport.health_score : null,
        tongue_constitution:     state.tongueReport && state.tongueReport.constitution_report
          ? state.tongueReport.constitution_report.constitution || null
          : null,
        tongue_image_url:        state.tongueReport ? state.tongueReport.image_url : null,
      },
    };
    try {
      var res = await HM.api.patient.saveQuestionnaire(payload);
      HM.ui.toast('Submitted · 已送交醫師審核', 'success', 4000);
      // Navigate to the report detail page so the patient sees their
      // in-review view (dimensions only + pending banner).
      var qId = res && res.questionnaire ? res.questionnaire.id : null;
      if (qId) {
        location.hash = '#/ai-diagnosis/' + qId;
      } else {
        btn.textContent = '✓ Submitted · 已送出';
      }
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Submit for Doctor Review · 送交醫師';
      HM.ui.toast('Could not submit: ' + (e.message || 'Error'), 'danger');
    }
  }

  // Load a previously-submitted report by ID (from a route like #/ai-diagnosis/123).
  async function renderDetail(el, id) {
    el.innerHTML = '<div class="state state--loading"><div class="state-icon"></div></div>';
    try {
      var res = await HM.api.patient.getQuestionnaire(id);
      var row = res.questionnaire || {};
      var s = row.symptoms;
      // Backend returns symptoms as a JSON string; parse safely.
      if (typeof s === 'string') { try { s = JSON.parse(s); } catch (_) { s = {}; } }
      s = s || {};
      if (s.kind !== 'ai_constitution_v2') {
        el.innerHTML = '<p class="text-muted">This report is not an AI constitution report.</p>';
        return;
      }
      renderApprovedReport(el, s);
    } catch (e) { HM.state.error(el, e); }
  }

  // ── Styles ─────────────────────────────────────────────────
  function injectStyle() {
    if (document.getElementById('aid-style')) return;
    var s = document.createElement('style');
    s.id = 'aid-style';
    s.textContent =
      // Progress
      '.aid-progress{height:4px;background:var(--border);border-radius:2px;margin-top:var(--s-2);overflow:hidden;}' +
      '.aid-progress-fill{height:100%;background:var(--gold);transition:width .3s ease;}' +
      // Options
      '.aid-opt{display:block;width:100%;text-align:left;padding:var(--s-4);margin-bottom:var(--s-2);border:1px solid var(--border);background:var(--bg);border-radius:var(--r-md);cursor:pointer;transition:all .15s ease;font-family:inherit;}' +
      '.aid-opt:hover{border-color:var(--gold);background:var(--washi);}' +
      '.aid-opt--selected{border-color:var(--gold);background:var(--washi);border-width:2px;padding:calc(var(--s-4) - 1px);}' +
      '.aid-opt-en{font-size:var(--text-sm);color:var(--ink);line-height:1.5;margin-bottom:4px;}' +
      '.aid-opt-zh{font-family:var(--font-zh);font-size:var(--text-xs);color:var(--stone);line-height:1.5;}' +
      // Pills
      '.aid-pill{padding:6px 14px;border-radius:999px;font-size:var(--text-xs);font-weight:500;letter-spacing:.04em;}' +
      // Tags
      '.aid-tag{padding:5px 12px;font-size:var(--text-xs);border-radius:2px;font-family:var(--font-zh);border:1px solid;}' +
      '.aid-tag--sage{color:var(--sage);background:rgba(122,140,114,.12);border-color:rgba(122,140,114,.35);}' +
      '.aid-tag--gold{color:var(--gold);background:rgba(184,150,90,.1);border-color:rgba(184,150,90,.35);}' +
      // Dimension group
      '.aid-group{margin-bottom:var(--s-4);}' +
      '.aid-group-title{font-size:var(--text-xs);font-weight:600;letter-spacing:.08em;color:var(--stone);margin-bottom:var(--s-2);padding-bottom:4px;border-bottom:1px solid var(--border);}' +
      '.aid-dim-row{padding:var(--s-2) 0;margin-bottom:var(--s-2);}' +
      '.aid-dim-label-en{font-size:var(--text-sm);color:var(--ink);}' +
      '.aid-dim-label-zh{font-family:var(--font-zh);font-size:var(--text-xs);color:var(--stone);}' +
      '.aid-dim-score{font-family:var(--font-mono);font-size:var(--text-lg);font-weight:500;line-height:1;}' +
      '.aid-dim-tag{display:inline-block;margin-top:2px;padding:2px 8px;font-size:10px;border:1px solid;border-radius:2px;white-space:nowrap;}' +
      '.aid-bar-track{position:relative;height:10px;background:var(--border);border-radius:5px;margin:6px 0 4px;overflow:hidden;}' +
      '.aid-bar-fill{position:absolute;top:0;bottom:0;border-radius:5px;}' +
      '.aid-bar-center{position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(0,0,0,.2);}' +
      '.aid-bar-scale{display:grid;font-size:10px;color:var(--stone);margin-bottom:4px;}' +
      // Tips
      '.aid-tips{display:flex;flex-direction:column;gap:var(--s-2);}' +
      '.aid-tip{display:flex;gap:var(--s-3);align-items:flex-start;background:var(--washi);padding:var(--s-3) var(--s-4);border:1px solid var(--border);border-radius:var(--r-md);font-size:var(--text-sm);line-height:1.5;}' +
      '.aid-tip-icon{font-size:1.3rem;flex-shrink:0;}' +
      // Step cards (intro flow)
      '.aid-step-card{position:relative;padding:var(--s-4);border:1px solid var(--border);border-radius:var(--r-md);background:var(--washi);text-align:center;}' +
      '.aid-step-num{position:absolute;top:-10px;left:var(--s-3);background:var(--gold);color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;}' +
      '.aid-step-icon{font-size:2.2rem;margin-bottom:var(--s-2);}' +
      '.aid-step-en{font-weight:600;font-size:var(--text-sm);color:var(--ink);}' +
      '.aid-step-zh{font-family:var(--font-zh);font-size:var(--text-xs);color:var(--stone);margin-bottom:4px;}' +
      '.aid-step-desc{font-size:var(--text-xs);color:var(--stone);}';
    document.head.appendChild(s);
  }

  HM.patientPanels.aiDiagnosis = { render: render, renderDetail: renderDetail };
})();
