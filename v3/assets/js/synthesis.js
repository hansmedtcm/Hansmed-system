/**
 * HM.synthesis — combines DOB-based Wuyun Liuqi (五運六氣), AI
 * constitution questionnaire (10-dim), and AI tongue analysis into
 * a single unified clinical plan: themes, food advice, lifestyle
 * recommendations, herb directions, warnings.
 *
 * Pure module — no DOM, no API calls. Takes structured input and
 * returns a structured plan object the UI can render.
 *
 * Entry point:
 *   HM.synthesis.combine({ wyl, constitution, tongue }) → plan
 *
 *   wyl:          HM.wuyunLiuqi.analyze(dob) result, or null
 *   constitution: questionnaire report.symptoms object, or null
 *   tongue:       tongue diagnosis.constitution_report object, or null
 */
(function () {
  'use strict';
  window.HM = window.HM || {};

  // ── Theme catalog ─────────────────────────────────────────────
  // Each theme has detection rules per source + the food/lifestyle/herb
  // payload to surface when matched. Bilingual throughout.
  var THEMES = {

    qi_deficiency: {
      en: 'Qi Deficiency', zh: '氣虛',
      summary_en: 'Low energy, easily fatigued, weak voice, prone to colds, pale complexion.',
      summary_zh: '氣短乏力、聲低易汗、面色蒼白、易感冒。',
      detect: {
        wyl: function (w) {
          var weak = (w && w.organs && w.organs.weak) || [];
          return weak.indexOf('脾') >= 0 || weak.indexOf('肺') >= 0;
        },
        constitution: function (c) {
          var d = (c && c.dimensions) || {};
          return (d.qi_xu || 0) <= -1 || (d.pi_wei || 0) <= -1;
        },
        tongue: function (t) {
          if (!t) return false;
          var const_ = (t.constitution && t.constitution.primary) || '';
          if (const_ === 'qi_deficient' || const_ === 'spleen_deficient') return true;
          var findings = t.findings || [];
          var hasPale = findings.some(function (f) { return /pale/i.test(f.value || ''); });
          var hasTeeth = findings.some(function (f) { return f.category === 'teeth_marks' && f.present; });
          return hasPale || hasTeeth;
        },
      },
      // Foods drawn from 中醫藥膳學 (Zuo et al., 2014) Ch.5 §1 心氣虛 / 脾氣虛 + Ch.5 §2 氣虛質
      food: {
        eatMore: [
          { en: 'Polished rice & glutinous rice (粳米、糯米)', zh: '粳米、糯米',         why_en: 'Sweet & warm; tonifies spleen-stomach qi', why_zh: '甘溫，健脾益氣' },
          { en: 'Yam (山藥) congee',                         zh: '山藥粥',                why_en: 'Gentle qi tonic; spleen + lung + kidney',  why_zh: '健脾益氣，補肺固腎' },
          { en: 'Red dates (紅棗) & black dates',             zh: '紅棗、黑棗',            why_en: 'Tonifies qi & blood, calms spirit',         why_zh: '補氣養血、安神' },
          { en: 'Lotus seed (蓮子) & job\'s tears (薏苡仁)',  zh: '蓮子、薏苡仁',          why_en: 'Strengthen spleen, drain damp',             why_zh: '健脾利濕' },
          { en: 'Millet, sorghum, oat, sweet potato',         zh: '小米、高粱、莜麥、紅薯', why_en: 'Easy-to-digest qi-builders',                why_zh: '健脾養胃' },
          { en: 'Chicken, beef, rabbit, quail, quail eggs',   zh: '雞肉、牛肉、兔肉、鵪鶉、鵪鶉蛋', why_en: 'Warm meats; rebuild spleen qi',     why_zh: '溫補脾氣' },
          { en: 'Shiitake & button mushrooms (香菇、蘑菇)',    zh: '香菇、蘑菇',            why_en: 'Light qi tonics; immune support',           why_zh: '補氣強免疫' },
          { en: 'Tofu & soy milk',                            zh: '豆腐、豆漿',            why_en: 'Plant protein; mild qi tonic',              why_zh: '補氣益胃' },
        ],
        eatLess: [
          { en: 'Iced drinks, ice cream, cold raw foods',     zh: '冰飲、雪糕、生冷食物',  why_en: 'Cold injures spleen yang and blocks qi',    why_zh: '寒傷脾陽阻氣機' },
          { en: 'Bitter & overly cooling vegetables in excess (raw cucumber, watermelon)', zh: '過量苦寒蔬果（生黃瓜、西瓜）', why_en: 'Cool nature drains weak qi further', why_zh: '寒涼更耗氣' },
        ],
        avoid: [
          { en: 'Skipping meals, crash diets',                zh: '不吃飯、節食減肥',      why_en: 'Starves qi production',                     why_zh: '化源不足' },
          { en: 'Excessive sweating (sauna, hot yoga)',       zh: '過度出汗（桑拿、熱瑜伽）', why_en: '"Sweat is the surplus of qi" — depletes', why_zh: '汗為氣之餘，過汗傷氣' },
        ],
      },
      lifestyle: [
        { icon: '😴', en: 'Sleep before 11pm; aim for 7–8 hours',                          zh: '11點前入睡，保證7-8小時' },
        { icon: '🌳', en: 'Gentle exercise: Tai Chi, walking, Qi Gong — avoid HIIT',       zh: '溫和運動：太極、散步、氣功，避免劇烈' },
        { icon: '🌬️', en: 'Daily abdominal breathing 5 min × 2 — circulates qi',           zh: '每日二次腹式呼吸5分鐘' },
        { icon: '🌞', en: 'Morning sunlight 15 min — gentle yang activation',              zh: '晨間曬太陽15分鐘' },
      ],
      herbs: ['黃耆 Huang Qi', '黨參 Dang Shen', '白朮 Bai Zhu', '炙甘草 Zhi Gan Cao', '大棗 Da Zao', '太子參 Tai Zi Shen', '靈芝 Ling Zhi'],
      // 藥膳 — actual TCM medicinal-meal recipes for this pattern.
      // Source: 中醫藥膳學 (Zuo et al., 2014). Doctor can recommend
      // these by name; patient looks up the recipe.
      medicinal_meals: [
        { name_zh: '黃耆蓮米粥', name_en: "Huang Qi & Lotus Seed Congee", note_en: 'Classic spleen-qi tonic congee' },
        { name_zh: '人參湯圓',   name_en: "Ren Shen Tang Yuan",            note_en: 'Festive qi-tonifying glutinous-rice balls' },
        { name_zh: '八珍糕',     name_en: "Ba Zhen Cake",                  note_en: 'Eight-treasure cake — rebuilds spleen qi over weeks' },
        { name_zh: '參芪羊肉粥', name_en: "Shen Qi Lamb Congee",           note_en: 'For middle-qi sinking (脾氣下陷)' },
        { name_zh: '黃耆汽鍋雞', name_en: "Huang Qi Steam-pot Chicken",    note_en: 'Lung-qi tonic; for chronic colds' },
      ],
    },

    yang_deficiency: {
      en: 'Yang Deficiency (Cold)', zh: '陽虛（寒）',
      summary_en: 'Cold extremities, fear of cold, pale puffy face, low metabolism, loose stools, frequent night urination.',
      summary_zh: '手腳冰冷、畏寒喜暖、面色淡白、代謝偏低、大便溏、夜尿頻。',
      detect: {
        wyl: function (w) {
          var weak = (w && w.organs && w.organs.weak) || [];
          return weak.indexOf('腎') >= 0;
        },
        constitution: function (c) {
          var d = (c && c.dimensions) || {};
          return (d.ti_han || 0) <= -1;
        },
        tongue: function (t) {
          if (!t) return false;
          var const_ = (t.constitution && t.constitution.primary) || '';
          if (const_ === 'yang_deficient') return true;
          var lower = t.three_burner && t.three_burner.lower_jiao;
          if (lower && (lower.status === 'cold_damp' || lower.status === 'deficiency_cold')) return true;
          return false;
        },
      },
      // Source: 中醫藥膳學 Ch.5 §1 腎陽虛 / 心陽虛 / 脾陽虛 + Ch.5 §2 陽虛質
      food: {
        eatMore: [
          { en: 'Lamb, beef, dog, deer/venison',          zh: '羊肉、牛肉、狗肉、鹿肉',  why_en: 'Sweet & hot meats; replenish yang & produce heat', why_zh: '甘溫熱性肉類，溫陽產熱' },
          { en: 'Ginger, scallion, leek, chives',          zh: '生薑、大蔥、韭菜',         why_en: 'Pungent-warm herbs; activate yang qi',            why_zh: '辛溫助陽行氣' },
          { en: 'Cinnamon, Sichuan pepper, black pepper',  zh: '肉桂、花椒、胡椒',         why_en: 'Warming spices for cold middle',                  why_zh: '溫中散寒' },
          { en: 'Walnut, chestnut',                        zh: '核桃、栗子',               why_en: 'Tonify kidney yang; warm low back',               why_zh: '補腎強腰' },
          { en: 'Shrimp & sea horse',                      zh: '蝦、海馬',                 why_en: 'Replenish kidney yang',                           why_zh: '補腎興陽' },
          { en: 'Carrot, potato, taro, root vegetables',   zh: '胡蘿蔔、土豆、芋頭',       why_en: 'Mineral-rich roots; pair with warm meats',        why_zh: '富含礦物質，配溫補肉類' },
          { en: 'Hairtail (帶魚)',                          zh: '帶魚',                     why_en: 'Warm-natured fish; tonifies kidney',              why_zh: '溫腎益氣' },
        ],
        eatLess: [
          { en: 'Iced drinks, ice cream',                  zh: '冰飲、雪糕',               why_en: 'Cold pathogen damages yang qi',                   why_zh: '寒涼傷陽' },
          { en: 'Watermelon, bitter melon, mung bean (cooling)', zh: '西瓜、苦瓜、綠豆',  why_en: 'Cool nature deepens internal cold',               why_zh: '寒涼加重內寒' },
          { en: 'Raw seafood (sashimi, oysters)',          zh: '生海鮮（生魚片、生蠔）', why_en: 'Cold + raw — double burden on yang',             why_zh: '生冷雙重傷陽' },
        ],
        avoid: [
          { en: 'Air-con blowing on lower back / abdomen',  zh: '冷氣直吹腰腹',            why_en: 'External cold invades kidney',                    why_zh: '外寒侵腎' },
          { en: 'Walking barefoot on cold tiles',          zh: '光腳踩冷地',               why_en: 'Cold enters via 涌泉 (kidney point)',             why_zh: '寒從涌泉穴入' },
        ],
      },
      lifestyle: [
        { icon: '🛁', en: 'Warm foot soak nightly (40°C, 15–20 min, with ginger slice)', zh: '睡前薑片水泡腳（40°C，15-20分鐘）' },
        { icon: '☀️', en: 'Morning sun on the back 15 min — directly tonifies du-mai yang', zh: '晨間背向曬太陽15分鐘，補督脈陽氣' },
        { icon: '🧣', en: 'Keep lower back, knees, neck and feet warm year-round',     zh: '腰、膝、頸、足全年保暖' },
        { icon: '🔥', en: 'Consider moxibustion at 關元 (Guan Yuan) / 命門 (Ming Men)', zh: '可考慮艾灸關元、命門' },
      ],
      herbs: ['附子 Fu Zi', '肉桂 Rou Gui', '乾薑 Gan Jiang', '杜仲 Du Zhong', '淫羊藿 Yin Yang Huo', '巴戟天 Ba Ji Tian', '鹿茸 Lu Rong'],
      medicinal_meals: [
        { name_zh: '壯陽餅',         name_en: "Yang-Tonifying Cake",        note_en: 'Daily snack for kidney yang xu' },
        { name_zh: '丁香雞',         name_en: "Clove Chicken",              note_en: 'Warming poultry stew' },
        { name_zh: '雙鞭壯陽湯',     name_en: "Double-Whip Yang Soup",      note_en: 'Powerful kidney yang tonic for impotence/cold' },
        { name_zh: '桂心粥',         name_en: "Cinnamon Heart Congee",      note_en: 'Warms heart yang' },
        { name_zh: '理中雞蛋清',     name_en: "Li Zhong Egg White",         note_en: 'Warms spleen yang' },
        { name_zh: '薤白粥',         name_en: "Chinese Chive Bulb Congee",  note_en: 'Heart yang xu with chest oppression' },
      ],
    },

    yin_deficiency: {
      en: 'Yin Deficiency (Heat from deficiency)', zh: '陰虛（虛熱）',
      summary_en: 'Hot palms/soles, night sweats, dry mouth & throat, afternoon tidal heat, red cheeks, irritability, thin frame.',
      summary_zh: '手腳心發熱、夜間盜汗、口咽乾燥、午後潮熱、兩顴泛紅、煩躁、形體偏瘦。',
      detect: {
        wyl: function (w) {
          var nature = (w && w.liuqi && w.liuqi.nature) || '';
          return /dry|fire|heat/i.test(nature);
        },
        constitution: function (c) {
          var d = (c && c.dimensions) || {};
          return (d.ti_re || 0) <= -1 && (d.shi_qi || 0) <= -1;
        },
        tongue: function (t) {
          if (!t) return false;
          var const_ = (t.constitution && t.constitution.primary) || '';
          if (const_ === 'yin_deficient') return true;
          var findings = t.findings || [];
          var hasRed = findings.some(function (f) { return /red(?!_dot)/i.test(f.value || ''); });
          var hasCracks = findings.some(function (f) { return f.category === 'cracks' && f.present; });
          var hasPeeled = findings.some(function (f) { return /peel/i.test(f.value || ''); });
          return hasRed && (hasCracks || hasPeeled);
        },
      },
      // Source: 中醫藥膳學 Ch.5 §1 肺陰虛 / 胃陰虛 / 肝陰血虛 / 腎陰虛 + Ch.5 §2 陰虛質
      food: {
        eatMore: [
          { en: 'Pear, lily bulb, white fungus soup',         zh: '雪梨百合銀耳湯',     why_en: 'Classic moisten-yin recipe; lung + heart',  why_zh: '滋陰潤肺養心' },
          { en: 'Black sesame, mulberry, longan',              zh: '黑芝麻、桑椹、龍眼',  why_en: 'Tonify liver-kidney yin & blood',           why_zh: '滋補肝腎陰血' },
          { en: 'Soy milk (warm), tofu',                       zh: '溫豆漿、豆腐',        why_en: 'Cool, moistening plant protein',            why_zh: '清涼滋潤' },
          { en: 'Goji (枸杞), Chinese yam (山藥)',              zh: '枸杞、山藥',          why_en: 'Liver-kidney + spleen-lung yin tonic',      why_zh: '滋肝腎、健脾肺' },
          { en: 'Pear, sugar cane, persimmon, apple, grape, kiwi', zh: '雪梨、甘蔗、柿子、蘋果、葡萄、奇異果', why_en: 'Juicy fruits replenish stomach yin & fluids', why_zh: '汁液豐富滋胃陰' },
          { en: 'Soft-shelled turtle, sea cucumber, oyster, clam', zh: '甲魚、海參、牡蠣、蛤蜊', why_en: 'Heavy yin tonics for deep depletion',     why_zh: '血肉有情之品，大補真陰' },
          { en: 'Duck meat (cool nature)',                     zh: '鴨肉',                why_en: 'Cool meat; nourishes yin',                  why_zh: '甘涼養陰' },
          { en: 'Honey, white fungus, lily bulb (百合)',        zh: '蜂蜜、銀耳、百合',    why_en: 'Moisten lung dryness',                      why_zh: '潤肺生津' },
        ],
        eatLess: [
          { en: 'Chilli, ginger, garlic, leek (pungent-warm)', zh: '辣椒、薑、蒜、韭菜',  why_en: 'Pungent-warm herbs further dry yin',        why_zh: '辛溫助火傷陰' },
          { en: 'Fried, grilled, baked food',                  zh: '油炸、燒烤、烘焙',    why_en: 'Heating & dehydrating',                     why_zh: '助火傷陰' },
          { en: 'Coffee, strong tea, alcohol',                 zh: '咖啡、濃茶、酒類',    why_en: 'Stimulants agitate yin & deplete fluids',   why_zh: '燥熱擾陰耗津' },
        ],
        avoid: [
          { en: 'Staying up past 11pm',                        zh: '熬夜過11點',          why_en: 'Yin restores during 子時 deep sleep',        why_zh: '子時不眠耗陰' },
          { en: 'Hot saunas, dry climate without hydration',   zh: '高溫桑拿、乾燥環境不補水', why_en: 'Sweat depletes fluid & yin',           why_zh: '汗多耗陰津' },
        ],
      },
      lifestyle: [
        { icon: '💤', en: 'Strict 11pm bedtime — yin restores in deep sleep',          zh: '嚴格11點前入睡' },
        { icon: '💧', en: 'Sip warm water steadily; avoid waiting until thirsty',     zh: '少量多次飲溫水，勿等口渴' },
        { icon: '🧘', en: 'Meditation, soft Qigong; avoid agitating high-intensity exercise', zh: '靜坐、柔和氣功，避免劇烈運動' },
        { icon: '🌙', en: 'Cool, dark bedroom; humidifier in dry season',              zh: '臥室涼爽避光，乾燥季節用加濕器' },
      ],
      herbs: ['麥冬 Mai Dong', '石斛 Shi Hu', '玉竹 Yu Zhu', '百合 Bai He', '枸杞 Gou Qi', '生地黃 Sheng Di Huang', '沙參 Sha Shen', '黃精 Huang Jing'],
      medicinal_meals: [
        { name_zh: '銀耳枸杞湯',     name_en: "White Fungus & Goji Soup",         note_en: 'Daily yin tonic dessert' },
        { name_zh: '川貝釀梨',       name_en: "Chuan Bei-stuffed Pear",           note_en: 'Lung yin xu with dry cough' },
        { name_zh: '百合粥',         name_en: "Lily Bulb Congee",                  note_en: 'Calms shen, moistens lung' },
        { name_zh: '蟲草全鴨',       name_en: "Cordyceps Whole Duck",              note_en: 'Heavy yin tonic; lung-kidney xu' },
        { name_zh: '麥冬粥',         name_en: "Mai Dong Congee",                   note_en: 'Stomach yin xu, dry mouth' },
        { name_zh: '玉竹心子',       name_en: "Yu Zhu Pork Heart",                 note_en: 'Heart yin xu with palpitations' },
        { name_zh: '清燉龜肉',       name_en: "Clear-stewed Turtle",               note_en: 'Deep kidney-yin replenishment' },
      ],
    },

    damp_heat: {
      en: 'Damp-Heat', zh: '濕熱',
      summary_en: 'Body heaviness, oily complexion, sticky stools, bitter mouth, yellow urine, foul breath, easy skin breakouts.',
      summary_zh: '身重、面油、大便黏滯、口苦、小便黃赤、口臭、易長痘。',
      detect: {
        wyl: function (w) {
          var nature = (w && w.liuqi && w.liuqi.nature) || '';
          return /damp|heat/i.test(nature);
        },
        constitution: function (c) {
          var d = (c && c.dimensions) || {};
          return (d.shi_qi || 0) >= 1 && (d.ti_re || 0) >= 1;
        },
        tongue: function (t) {
          if (!t) return false;
          var const_ = (t.constitution && t.constitution.primary) || '';
          if (const_ === 'damp_heat') return true;
          var tb = t.three_burner || {};
          return ['upper_jiao','middle_jiao','lower_jiao'].some(function (k) {
            return tb[k] && tb[k].status === 'damp_heat';
          });
        },
      },
      // Source: 中醫藥膳學 Ch.5 §1 脾胃濕熱 / 肝膽濕熱 / 腎與膀胱濕熱 + Ch.5 §2 濕熱質
      food: {
        eatMore: [
          { en: 'Mung bean soup (綠豆湯)',                       zh: '綠豆湯',          why_en: 'Cools heat & drains damp via urine',   why_zh: '清熱解毒利濕' },
          { en: 'Job\'s tears congee (薏苡仁粥)',                 zh: '薏苡仁粥',        why_en: 'Drains lower-burner damp',              why_zh: '利濕健脾' },
          { en: 'Bitter melon, cucumber, winter melon, loofah', zh: '苦瓜、黃瓜、冬瓜、絲瓜', why_en: 'Cool, draining gourds',           why_zh: '甘涼利濕' },
          { en: 'Lotus root, water spinach, celery',            zh: '蓮藕、空心菜、芹菜', why_en: 'Cool vegetables; drain damp-heat',  why_zh: '清涼利濕' },
          { en: 'Red bean (赤小豆), broad bean (蠶豆)',           zh: '赤小豆、蠶豆',    why_en: 'Drain damp via urine',                  why_zh: '利水滲濕' },
          { en: 'Duck, crucian carp (鯽魚)',                     zh: '鴨肉、鯽魚',      why_en: 'Cool meats; gentle protein',            why_zh: '清涼補益' },
          { en: 'Purslane (馬齒莧), dandelion (蒲公英)',           zh: '馬齒莧、蒲公英',  why_en: 'Wild greens; powerful heat-clearers',   why_zh: '野菜，清熱解毒' },
          { en: 'Green bean sprouts, soy bean sprouts',         zh: '綠豆芽、黃豆芽',   why_en: 'Cool, fresh; aid damp drainage',        why_zh: '清涼利濕' },
        ],
        eatLess: [
          { en: 'Beer & all alcohol',                           zh: '啤酒及一切酒類',   why_en: 'Alcohol is the #1 generator of damp-heat', why_zh: '酒最易生濕熱' },
          { en: 'Lamb, beef (warming red meats)',               zh: '羊肉、牛肉',      why_en: 'Generate internal heat',                why_zh: '助熱生火' },
          { en: 'Greasy, fried, grilled food',                  zh: '油膩、油炸、燒烤', why_en: 'Heavy and heating',                     why_zh: '助濕生熱' },
          { en: 'Sweet desserts, sugary drinks, milk tea',      zh: '甜點、含糖飲料、奶茶', why_en: '"Sweet generates damp"',           why_zh: '甘助濕' },
          { en: 'Spicy seasonings: chilli, pepper, ginger',     zh: '辣椒、花椒、生薑',  why_en: 'Pungent fuels heat',                    why_zh: '辛溫助熱' },
        ],
        avoid: [
          { en: 'Damp environments; sitting in wet clothes',    zh: '潮濕環境、汗濕不換衣', why_en: 'External damp compounds internal',  why_zh: '外濕加重內濕' },
          { en: 'Late-night meals',                             zh: '宵夜',             why_en: 'Burdens digestion → damp accumulation', why_zh: '飲食停滯化濕' },
        ],
      },
      lifestyle: [
        { icon: '🏃', en: 'Aerobic exercise 30 min/day to sweat damp out', zh: '每日30分鐘有氧運動發汗化濕' },
        { icon: '🧴', en: 'Daily shower; keep skin folds dry',              zh: '每日洗澡，保持皮膚褶皺乾爽' },
        { icon: '⛅', en: 'Use a dehumidifier in humid season',              zh: '潮濕季節使用抽濕機' },
        { icon: '🚽', en: 'Don\'t hold urine — let damp out',                 zh: '勿憋尿，讓濕邪外出' },
      ],
      herbs: ['茵陳 Yin Chen', '黃連 Huang Lian', '梔子 Zhi Zi', '茯苓 Fu Ling', '滑石 Hua Shi', '車前子 Che Qian Zi', '黃芩 Huang Qin'],
      medicinal_meals: [
        { name_zh: '茵陳粥',         name_en: "Yin Chen Congee",            note_en: 'Liver-gallbladder damp-heat (jaundice tendency)' },
        { name_zh: '蒲公英粥',       name_en: "Dandelion Congee",            note_en: 'General heat-clearing congee' },
        { name_zh: '凉拌馬齒莧',     name_en: "Cold-tossed Purslane",         note_en: 'Spleen-stomach damp-heat (diarrhoea tendency)' },
        { name_zh: '冬瓜薏米湯',     name_en: "Winter Melon & Job\'s Tears Soup", note_en: 'Daily summer cooler' },
        { name_zh: '車前子飲',       name_en: "Plantago Seed Drink",          note_en: 'Bladder damp-heat (UTI tendency)' },
      ],
    },

    liver_qi_stagnation: {
      en: 'Liver Qi Stagnation', zh: '肝氣鬱結',
      summary_en: 'Chest tightness, frequent sighing, mood swings, breast/rib distension, irregular menses, easily irritable.',
      summary_zh: '胸悶嘆氣、情緒波動、兩脅脹痛、乳房脹、月經不調、煩躁易怒。',
      detect: {
        wyl: function (w) {
          var strong = (w && w.organs && w.organs.strong) || [];
          if (strong.indexOf('肝') >= 0) return true;
          var nature = (w && w.liuqi && w.liuqi.nature) || '';
          return /wind|wood/i.test(nature);
        },
        constitution: function (c) {
          var d = (c && c.dimensions) || {};
          return (d.qi_zhi || 0) >= 1;
        },
        tongue: function (t) {
          if (!t) return false;
          var asc = t.ascending_descending || {};
          if (asc.direction === 'ascending_excess') return true;
          var holo = (t.holographic_map && t.holographic_map.affected) || [];
          return holo.some(function (f) { return /liver/i.test(f.region || ''); });
        },
      },
      // Source: 中醫藥膳學 Ch.5 §1 肝氣鬱結 + Ch.5 §2 氣鬱質
      food: {
        eatMore: [
          { en: 'Chrysanthemum tea (菊花茶)',                 zh: '菊花茶',          why_en: 'Soothes liver, clears head heat',           why_zh: '疏肝清頭目' },
          { en: 'Citrus peel (陳皮) tea',                      zh: '陳皮茶',          why_en: 'Moves stagnant qi',                          why_zh: '理氣解鬱' },
          { en: 'Mint (薄荷), jasmine, rose tea',              zh: '薄荷、茉莉、玫瑰花茶', why_en: 'Aromatic flowers — move qi & lift mood', why_zh: '芳香理氣，調暢情志' },
          { en: 'Toon shoots, soybean sprouts, celery',        zh: '香椿芽、豆芽、芹菜', why_en: 'Spring greens; circulate qi',           why_zh: '行氣疏肝' },
          { en: 'Buddha\'s hand (佛手), apple, pomelo',         zh: '佛手、蘋果、柚子', why_en: 'Aromatic citrus; soothe liver',          why_zh: '疏肝理氣' },
          { en: 'Litchi (荔枝) — small amounts',                zh: '荔枝',            why_en: 'Moves qi, warms middle',                     why_zh: '行氣溫中' },
          { en: 'Sorghum, mushroom, radish, onion, garlic',    zh: '高粱、蘑菇、蘿蔔、洋蔥、大蒜', why_en: 'Qi-moving foods (per textbook)', why_zh: '行氣食物' },
        ],
        eatLess: [
          { en: 'Heavy alcohol, late-night meals',             zh: '酗酒、宵夜',      why_en: 'Burden liver\'s detox + qi flow',          why_zh: '加重肝臟負擔' },
          { en: 'Excess raw / cold food',                      zh: '過量生冷',        why_en: 'Cold contracts qi → worse stagnation',      why_zh: '寒則氣滯' },
        ],
        avoid: [
          { en: 'Suppressing emotions; non-stop work',         zh: '壓抑情緒、工作不間斷', why_en: 'Stagnates qi further',                  why_zh: '加重氣機鬱滯' },
          { en: 'Isolation; avoiding social contact',          zh: '獨處、避社交',    why_en: 'Worsens emotional component',                why_zh: '加重情志鬱結' },
        ],
      },
      lifestyle: [
        { icon: '🌿', en: 'Spend time outdoors in green spaces (per <Yang Sheng Yue Lan>)', zh: '走出戶外，多接觸綠意' },
        { icon: '📓', en: 'Journal feelings; healthy emotional release',                  zh: '寫日記抒發情緒' },
        { icon: '🤝', en: 'Social connection — talk it out',                              zh: '與朋友傾訴交流' },
        { icon: '🧘', en: 'Stretching, yoga, Qigong — open the chest',                    zh: '伸展、瑜伽、氣功，打開胸廓' },
        { icon: '🍷', en: 'A small amount of yellow wine / red wine OK to circulate qi',  zh: '可少量飲黃酒、紅酒以活血暢氣' },
      ],
      herbs: ['柴胡 Chai Hu', '香附 Xiang Fu', '玫瑰花 Mei Gui Hua', '合歡皮 He Huan Pi', '鬱金 Yu Jin', '青皮 Qing Pi', '佛手 Fo Shou'],
      medicinal_meals: [
        { name_zh: '香附川芎茶',     name_en: "Xiang Fu & Chuan Xiong Tea",   note_en: 'Daily qi-moving + headache relief' },
        { name_zh: '香椿拌豆腐',     name_en: "Toon-shoot Tofu Salad",         note_en: 'Spring qi-moving dish' },
        { name_zh: '香櫞飲',         name_en: "Xiang Yuan Drink",              note_en: 'Buddha\'s-hand citron beverage' },
        { name_zh: '荔枝香附飲',     name_en: "Litchi & Xiang Fu Drink",       note_en: 'For PMS / breast distension' },
        { name_zh: '青皮粥',         name_en: "Qing Pi Congee",                note_en: 'Strong qi-mover; short-term use' },
      ],
    },

    blood_stasis: {
      en: 'Blood Stasis', zh: '血瘀',
      summary_en: 'Fixed sharp/stabbing pain, easy bruising, dark menstrual clots, dull dark complexion, dark lips.',
      summary_zh: '定點刺痛、易瘀青、經血暗有血塊、面色晦暗、口唇色暗。',
      detect: {
        wyl: function () { return false; },
        constitution: function (c) {
          var d = (c && c.dimensions) || {};
          return (d.xue_yu || 0) >= 1;
        },
        tongue: function (t) {
          if (!t) return false;
          var const_ = (t.constitution && t.constitution.primary) || '';
          if (const_ === 'blood_stasis') return true;
          var findings = t.findings || [];
          if (findings.some(function (f) { return /purple/i.test(f.value || ''); })) return true;
          var tb = t.three_burner || {};
          return ['upper_jiao','middle_jiao','lower_jiao'].some(function (k) {
            return tb[k] && tb[k].status === 'stasis';
          });
        },
      },
      // Source: 中醫藥膳學 Ch.5 §1 心血瘀阻 + Ch.5 §2 瘀血質
      food: {
        eatMore: [
          { en: 'Hawthorn (山楂)',                          zh: '山楂',          why_en: 'Strong food-grade blood-mover',         why_zh: '消食活血化瘀' },
          { en: 'Peach kernel, black sesame, soybean, black bean', zh: '桃仁、黑芝麻、黃豆、黑大豆', why_en: 'Per textbook constitution-care list', why_zh: '活血滋補' },
          { en: 'Black fungus (黑木耳)',                    zh: '黑木耳',        why_en: 'Mild anticoagulant; moves blood',       why_zh: '活血通絡' },
          { en: 'Turmeric, fresh ginger',                   zh: '薑黃、生薑',    why_en: 'Warm & move blood',                     why_zh: '溫經活血' },
          { en: 'Onion, mustard greens (rapeseed)',         zh: '洋蔥、油菜',    why_en: 'Light qi-blood movers',                 why_zh: '行氣活血' },
          { en: 'Vinegar (used liberally in cooking)',      zh: '醋',            why_en: 'Activates blood, descends stasis',      why_zh: '活血散瘀' },
          { en: 'Shiitake mushroom (香菇)',                  zh: '香菇',          why_en: 'Per textbook stasis-care list',         why_zh: '活血益氣' },
          { en: 'Yellow wine, red wine (small amounts)',    zh: '黃酒、紅酒（少量）', why_en: 'Activates blood circulation',       why_zh: '活血通脈' },
        ],
        eatLess: [
          { en: 'Iced drinks, raw cold food',               zh: '冰飲、生冷食物', why_en: '"Cold congeals blood"',                why_zh: '寒則血凝' },
          { en: 'Heavy fatty/greasy food',                  zh: '肥甘厚味',      why_en: 'Thickens blood; worsens stasis',       why_zh: '阻滯氣血' },
        ],
        avoid: [
          { en: 'Prolonged sitting / standing without movement', zh: '久坐久立不動', why_en: '"Long sitting harms qi & blood"',  why_zh: '久坐傷氣血' },
          { en: 'Letting cold air blow on the abdomen / lower back', zh: '冷風吹腹腰', why_en: 'Cold contracts vessels',           why_zh: '寒收脈絡' },
        ],
      },
      lifestyle: [
        { icon: '🚶', en: 'Brisk walk 30 min daily — keep blood moving',           zh: '每日快走30分鐘' },
        { icon: '💆', en: 'Self-massage stiff areas; consider Tuina or cupping',   zh: '自我按摩、考慮推拿或拔罐' },
        { icon: '🌡️', en: 'Stay warm — cold worsens stasis',                       zh: '注意保暖，寒加重瘀' },
        { icon: '🪟', en: 'Stand up + stretch every 45 min if desk-bound',          zh: '久坐每45分鐘起身伸展' },
      ],
      herbs: ['丹參 Dan Shen', '川芎 Chuan Xiong', '桃仁 Tao Ren', '紅花 Hong Hua', '益母草 Yi Mu Cao', '三七 San Qi'],
      medicinal_meals: [
        { name_zh: '木耳燒豆腐',     name_en: "Black Fungus & Tofu Stir-fry",  note_en: 'Daily blood-moving dish' },
        { name_zh: '丹參三七雞',     name_en: "Dan Shen & San Qi Chicken",     note_en: 'Heart blood stasis (chest pain)' },
        { name_zh: '丹參酒',         name_en: "Dan Shen Wine",                  note_en: 'Tincture, daily small amount' },
        { name_zh: '葡萄酒',         name_en: "Red wine (small daily amount)",  note_en: 'Light blood-moving' },
        { name_zh: '薤白粥',         name_en: "Chinese Chive Bulb Congee",      note_en: 'Heart vessel stasis' },
      ],
    },

    blood_deficiency: {
      en: 'Blood Deficiency', zh: '血虛',
      summary_en: 'Pale lips & face, dizziness, dry hair & brittle nails, scant pale menstruation, palpitations, blurred vision.',
      summary_zh: '面色及唇蒼白、頭暈目眩、頭髮指甲乾枯、月經量少色淡、心悸、視物模糊。',
      detect: {
        wyl: function (w) {
          var weak = (w && w.organs && w.organs.weak) || [];
          return weak.indexOf('心') >= 0 || weak.indexOf('肝') >= 0;
        },
        constitution: function (c) {
          var d = (c && c.dimensions) || {};
          return (d.xue_xu || 0) <= -1;
        },
        tongue: function (t) {
          if (!t) return false;
          var const_ = (t.constitution && t.constitution.primary) || '';
          if (const_ === 'blood_deficient') return true;
          var findings = t.findings || [];
          return findings.some(function (f) { return /pale/i.test(f.value || ''); });
        },
      },
      // Source: 中醫藥膳學 Ch.5 §1 心陰血虛 / 肝陰血虛 / 脾不統血
      food: {
        eatMore: [
          { en: 'Pork liver, animal liver dishes',           zh: '豬肝、動物肝臟', why_en: 'Heme iron + classic "liver tonifies liver"', why_zh: '富含血紅素鐵，以肝補肝' },
          { en: 'Beef, chicken, animal blood (pork blood)', zh: '牛肉、雞肉、豬血', why_en: 'Heavy blood-building proteins',          why_zh: '補血主力' },
          { en: 'Spinach (菠菜)',                            zh: '菠菜',          why_en: 'Iron + folate; classic blood vegetable',  why_zh: '養肝補血' },
          { en: 'Black sesame, walnuts, longan',             zh: '黑芝麻、核桃、龍眼肉', why_en: 'Nourish blood; calm spirit',          why_zh: '養血安神' },
          { en: 'Red dates (紅棗), goji (枸杞), white fungus (銀耳)', zh: '紅棗、枸杞、銀耳', why_en: 'Daily blood + qi tonic combo',     why_zh: '日常補益氣血' },
          { en: 'Mussels (淡菜), turtle, sea cucumber',       zh: '淡菜、龜肉、海參', why_en: 'Yin-blood replenishing seafoods',     why_zh: '滋陰養血' },
          { en: 'Dang Gui (當歸) chicken stew',                zh: '當歸燉雞',      why_en: 'The classic Chinese blood tonic',         why_zh: '補血聖品' },
          { en: 'Brown sugar, dates congee',                 zh: '紅糖、大棗粥',  why_en: 'Daily mild blood tonic',                  why_zh: '溫補氣血' },
        ],
        eatLess: [
          { en: 'Coffee/strong tea (block iron absorption)', zh: '咖啡、濃茶',    why_en: 'Tannins reduce iron uptake',              why_zh: '鞣酸影響鐵吸收' },
          { en: 'Cold raw foods',                            zh: '生冷食物',      why_en: 'Spleen-stomach can\'t produce blood from cold', why_zh: '脾胃虛寒則化源不足' },
        ],
        avoid: [
          { en: 'Skipping meals, crash diets',               zh: '不吃飯、節食減肥', why_en: 'No food → no blood (no source)',       why_zh: '飲食不足化源不足' },
          { en: 'Excessive blood loss (heavy periods, frequent donation)', zh: '經血過多、頻繁獻血', why_en: 'Outflow exceeds production', why_zh: '失血過多' },
        ],
      },
      lifestyle: [
        { icon: '😴', en: 'Sleep before 11pm — "blood returns to liver" during deep sleep', zh: '11點前入睡，血歸肝藏' },
        { icon: '👁️', en: 'Limit screen time — "overuse of eyes consumes blood"',           zh: '減少用眼，久視傷血' },
        { icon: '🧴', en: 'Gentle scalp + foot massage to circulate the blood you have',    zh: '頭皮、足底按摩促循環' },
      ],
      herbs: ['熟地黃 Shu Di Huang', '當歸 Dang Gui', '白芍 Bai Shao', '阿膠 E Jiao', '龍眼肉 Long Yan Rou', '何首烏 He Shou Wu', '桑椹 Sang Shen'],
      medicinal_meals: [
        { name_zh: '當歸燉雞',       name_en: "Dang Gui Chicken Stew",         note_en: 'The most-recommended blood tonic in TCM kitchens' },
        { name_zh: '蜜餞薑棗龍眼',   name_en: "Honeyed Ginger-Date-Longan",    note_en: 'Daily afternoon tonic' },
        { name_zh: '玄參燉豬肝',     name_en: "Xuan Shen Pork Liver Stew",     note_en: 'Liver yin-blood xu' },
        { name_zh: '羊肝羹',         name_en: "Lamb Liver Soup",                note_en: 'Strong blood + vision tonic' },
        { name_zh: '銀耳枸杞湯',     name_en: "White Fungus & Goji Soup",       note_en: 'Mild daily yin-blood support' },
      ],
    },

    phlegm_dampness: {
      en: 'Phlegm-Dampness', zh: '痰濕',
      summary_en: 'Body heaviness, sluggish digestion, copious mucus, weight gain, foggy head, sleepiness, sweet/oily food cravings.',
      summary_zh: '身重、消化遲緩、痰多、易肥胖、頭昏沉、嗜睡、嗜食肥甘。',
      detect: {
        wyl: function (w) {
          var weak = (w && w.organs && w.organs.weak) || [];
          return weak.indexOf('脾') >= 0;
        },
        constitution: function (c) {
          var d = (c && c.dimensions) || {};
          return (d.shi_qi || 0) >= 1 && (d.pi_wei || 0) <= 0;
        },
        tongue: function (t) {
          if (!t) return false;
          var const_ = (t.constitution && t.constitution.primary) || '';
          if (const_ === 'phlegm_dampness') return true;
          var tb = t.three_burner || {};
          return ['upper_jiao','middle_jiao','lower_jiao'].some(function (k) {
            return tb[k] && (tb[k].status === 'dampness' || tb[k].status === 'cold_damp');
          });
        },
      },
      // Source: 中醫藥膳學 Ch.5 §1 痰浊阻肺 / 水湿困脾 + Ch.5 §2 痰湿质
      food: {
        eatMore: [
          { en: 'Job\'s tears (薏苡仁), red bean (赤小豆)',  zh: '薏苡仁、赤小豆', why_en: 'Drain damp via urine; daily core',     why_zh: '利水滲濕，日常主力' },
          { en: 'Winter melon soup',                         zh: '冬瓜湯',         why_en: 'Light, drains damp',                    why_zh: '清淡利水' },
          { en: 'Lotus seeds (蓮子), poria (茯苓)',           zh: '蓮子、茯苓',     why_en: 'Strengthen spleen; transform damp',     why_zh: '健脾化濕' },
          { en: 'Tangerine peel (陳皮), shaddock peel (柚皮)', zh: '陳皮、柚皮',    why_en: 'Aromatic; transform damp + move qi',    why_zh: '芳香化濕、理氣' },
          { en: 'White radish, kelp seaweed',                zh: '白蘿蔔、海帶',   why_en: 'Cut through phlegm; descend qi',        why_zh: '化痰下氣' },
          { en: 'Mustard greens, scallion, ginger',          zh: '芥菜、蔥白、生薑', why_en: 'Pungent dispersion of phlegm-damp',  why_zh: '辛散化痰' },
          { en: 'Atractylodes (蒼朮), pinellia (半夏) — in formulas only', zh: '蒼朮、半夏（入方）', why_en: 'Drying-damp herbs',         why_zh: '燥濕化痰（藥用）' },
        ],
        eatLess: [
          { en: 'Dairy (especially cheese, cream)',          zh: '乳製品（芝士、奶油）', why_en: 'Generates phlegm-damp',           why_zh: '助濕生痰' },
          { en: 'Greasy, sweet, fried foods',                zh: '油膩、甜食、油炸',   why_en: 'Heavy on the spleen',                   why_zh: '困脾生濕' },
          { en: 'Excessive alcohol',                         zh: '過量飲酒',          why_en: 'Generates damp-heat (overlap with damp_heat)', why_zh: '生濕生熱' },
        ],
        avoid: [
          { en: 'Eating right before sleep',                  zh: '睡前進食',          why_en: 'Food stagnates → generates damp',       why_zh: '食滯化濕' },
          { en: 'Long hours in damp/humid spaces (basement)', zh: '長時間處於潮濕環境', why_en: 'External damp adds to internal',        why_zh: '外濕加重內濕' },
        ],
      },
      lifestyle: [
        { icon: '🏃', en: 'Daily aerobic exercise — sweat is medicinal',         zh: '每日有氧運動，發汗助化濕' },
        { icon: '🌬️', en: 'Avoid damp environments and sitting on cold floors',  zh: '避免潮濕環境及坐冷地' },
        { icon: '🍵', en: 'Sip warm water + citrus peel tea throughout the day', zh: '日間多飲溫水或陳皮茶' },
      ],
      herbs: ['茯苓 Fu Ling', '蒼朮 Cang Zhu', '半夏 Ban Xia', '陳皮 Chen Pi', '薏苡仁 Yi Yi Ren', '澤瀉 Ze Xie'],
      medicinal_meals: [
        { name_zh: '生薑橘皮湯',     name_en: "Ginger & Tangerine-peel Tea",   note_en: 'Daily damp-transform drink' },
        { name_zh: '蘿蔔海帶湯',     name_en: "Radish & Kelp Soup",             note_en: 'Cuts through thick phlegm' },
        { name_zh: '八仙茶',         name_en: "Ba Xian Tea",                    note_en: 'Eight-immortal phlegm-damp tea' },
        { name_zh: '海蜇蘿蔔',       name_en: "Jellyfish & Radish",             note_en: 'For damp-heat-transformed phlegm' },
        { name_zh: '茯苓酥',         name_en: "Fu Ling Pastry",                 note_en: 'Daily snack for spleen-damp' },
      ],
    },
  };

  // ─────────────────────────────────────────────────────────
  //  四季宜忌 SEASONAL MODIFIER
  // ─────────────────────────────────────────────────────────
  // Per the textbook's §3 (辨四季施膳), each season biases what's
  // helpful regardless of the patient's constitution. The synthesis
  // picks today's season and surfaces a small "seasonal note" that
  // the doctor can fold into their advice — most useful for chronic
  // conditions that flare with weather changes.
  //
  // Seasons here use Northern-hemisphere months — the clinic is in
  // Malaysia which sits near the equator, so the user can reasonably
  // ignore or override these. They don't replace the per-theme
  // recommendations, just add context.
  var SEASONS = {
    spring: {
      en: 'Spring',  zh: '春',
      months: [3, 4, 5],
      tips_en: [
        'Spring is liver season — favour green leafy vegetables, soybean sprouts, mint, and a small amount of pungent-warm seasoning to lift yang qi.',
        'Add red dates congee for daily spleen-lung qi support; increases protective wei qi against early-spring colds.',
        'Liver yang–excess patients (hypertension, irritability) should avoid excessive pungent / heating foods.',
      ],
      tips_zh: [
        '春屬肝，多食青綠葉菜、豆芽、薄荷及少量辛溫調味升發陽氣。',
        '紅棗粥日常補益脾肺氣，增強衛外功能以防春寒。',
        '肝陽上亢者（高血壓、易怒）忌辛辣升發過度。',
      ],
    },
    summer: {
      en: 'Summer',  zh: '夏',
      months: [6, 7, 8],
      tips_en: [
        'Summer heat consumes fluids — favour watermelon, cucumber, bitter melon, winter melon, mung bean, lemon to clear heat & generate fluids.',
        'Late summer (long-summer 長夏) brings damp-heat — combine cooling foods with damp-draining ones (e.g. winter-melon + Job\'s tears congee).',
        'Sweet-cool fresh juices (pear, watermelon, sugar cane) are excellent; avoid icy drinks that shock the spleen.',
      ],
      tips_zh: [
        '夏熱耗津，宜食西瓜、黃瓜、苦瓜、冬瓜、綠豆、檸檬等清熱生津。',
        '長夏多濕熱，宜清熱配利濕（如冬瓜薏米粥）。',
        '甘涼鮮果汁（雪梨、西瓜、甘蔗）為佳；忌冰飲傷脾。',
      ],
    },
    autumn: {
      en: 'Autumn',  zh: '秋',
      months: [9, 10, 11],
      tips_en: [
        'Autumn dryness injures lung yin — favour pear, grape, pomegranate, pomelo, persimmon, lily bulb, white fungus, water chestnut.',
        'Pear + sugar cane + honey paste, or pear + Chuan Bei stewed, ease autumn dry cough.',
        'Especially helpful for yin-xu / lung-yin-xu patients whose chronic conditions worsen in autumn.',
      ],
      tips_zh: [
        '秋燥傷肺陰，宜食梨、葡萄、石榴、柚子、柿子、百合、銀耳、荸薺。',
        '雪梨甘蔗蜜膏，或雪梨川貝燉服，治秋燥乾咳。',
        '陰虛、肺陰虛者秋季病情加重時尤宜。',
      ],
    },
    winter: {
      en: 'Winter',  zh: '冬',
      months: [12, 1, 2],
      tips_en: [
        'Winter cold damages yang — favour warming meats (lamb, beef, deer), root vegetables, and warming spices (ginger, cinnamon, pepper).',
        'Walnut, chestnut, leek, shrimp tonify kidney yang; pair with iron-rich foods + vitamin C for cold-resistance.',
        'Yang-xu patients deteriorate fastest in winter — proactive temperature & diet management is essential.',
      ],
      tips_zh: [
        '冬寒傷陽，宜溫熱性肉類（羊、牛、鹿）、根莖蔬菜、溫熱香料（薑、桂、椒）。',
        '核桃、栗子、韭菜、蝦溫補腎陽；配合富鐵食物與維C增強耐寒。',
        '陽虛者冬季病情最重，需主動調節體溫與飲食。',
      ],
    },
  };

  function currentSeason(date) {
    var d = date || new Date();
    var m = d.getMonth() + 1; // 1..12
    if (m >= 3 && m <= 5)  return SEASONS.spring;
    if (m >= 6 && m <= 8)  return SEASONS.summer;
    if (m >= 9 && m <= 11) return SEASONS.autumn;
    return SEASONS.winter;
  }

  // ── Synthesis engine ──────────────────────────────────────────

  /**
   * Combine three diagnostic inputs into a unified clinical plan.
   * Returns a structured object the UI can render section-by-section.
   *
   * Each theme is detected per source, then ranked by source agreement:
   *   3 sources agree → high confidence
   *   2 sources agree → medium confidence
   *   1 source flags  → low confidence (still surfaced for transparency)
   */
  function combine(input) {
    input = input || {};
    var wyl = input.wyl || null;
    var constitution = input.constitution || null;
    var tongue = input.tongue || null;

    var themes = [];

    Object.keys(THEMES).forEach(function (key) {
      var theme = THEMES[key];
      var sources = [];
      var evidence = {};

      try {
        if (wyl && theme.detect.wyl && theme.detect.wyl(wyl)) {
          sources.push('DOB');
          evidence.dob = wylEvidence(wyl);
        }
      } catch (_) {}
      try {
        if (constitution && theme.detect.constitution && theme.detect.constitution(constitution)) {
          sources.push('Constitution');
          evidence.constitution = constitutionEvidence(constitution, key);
        }
      } catch (_) {}
      try {
        if (tongue && theme.detect.tongue && theme.detect.tongue(tongue)) {
          sources.push('Tongue');
          evidence.tongue = tongueEvidence(tongue, key);
        }
      } catch (_) {}

      if (! sources.length) return;

      themes.push({
        key:              key,
        en:               theme.en,
        zh:               theme.zh,
        summary_en:       theme.summary_en,
        summary_zh:       theme.summary_zh,
        sources:          sources,
        priority:         sources.length >= 3 ? 'high' : (sources.length === 2 ? 'medium' : 'low'),
        evidence:         evidence,
        food:             theme.food,
        lifestyle:        theme.lifestyle,
        herbs:            theme.herbs,
        // 藥膳 — actual TCM medicinal-meal recipe names per pattern.
        // Source: 中醫藥膳學 (左铮云等, 2014). Doctor can recommend
        // these by name; patient looks up the recipe.
        medicinal_meals:  theme.medicinal_meals || [],
      });
    });

    themes.sort(function (a, b) {
      var rank = { high: 0, medium: 1, low: 2 };
      return rank[a.priority] - rank[b.priority];
    });

    // Aggregate food / lifestyle / herbs across all themes, dedup by
    // English key, and tag each item with the themes that produced it
    // so the UI can show "for: Qi Deficiency, Blood Deficiency".
    var aggregate = aggregateAdvice(themes);
    var season = currentSeason();

    return {
      themes:          themes,
      food:            aggregate.food,
      lifestyle:       aggregate.lifestyle,
      herbs:           aggregate.herbs,
      medicinal_meals: aggregate.medicinal_meals,
      season:          season,
      // Convenience flags for the UI
      hasDob:          !! wyl,
      hasConstitution: !! constitution,
      hasTongue:       !! tongue,
      sourceCount:     (wyl ? 1 : 0) + (constitution ? 1 : 0) + (tongue ? 1 : 0),
    };
  }

  function wylEvidence(w) {
    var bits = [];
    if (w.organs && w.organs.weak  && w.organs.weak.length)  bits.push('Weak: ' + w.organs.weak.join(', '));
    if (w.organs && w.organs.strong && w.organs.strong.length) bits.push('Strong: ' + w.organs.strong.join(', '));
    if (w.liuqi && w.liuqi.nature)                              bits.push('Qi nature: ' + w.liuqi.nature);
    return bits.join(' · ');
  }

  function constitutionEvidence(c, themeKey) {
    var d = c.dimensions || {};
    // Surface the dimension(s) that triggered this theme.
    var triggers = {
      qi_deficiency:        ['qi_xu', 'pi_wei'],
      yang_deficiency:      ['ti_han'],
      yin_deficiency:       ['ti_re', 'shi_qi'],
      damp_heat:            ['shi_qi', 'ti_re'],
      liver_qi_stagnation:  ['qi_zhi'],
      blood_stasis:         ['xue_yu'],
      blood_deficiency:     ['xue_xu'],
      phlegm_dampness:      ['shi_qi', 'pi_wei'],
    }[themeKey] || [];
    return triggers
      .filter(function (k) { return d[k] !== undefined && d[k] !== 0; })
      .map(function (k) { return k + '=' + (d[k] > 0 ? '+' + d[k] : d[k]); })
      .join(', ');
  }

  function tongueEvidence(t, themeKey) {
    var bits = [];
    if (t.constitution && t.constitution.name_en) {
      bits.push(t.constitution.name_en);
    }
    var tb = t.three_burner || {};
    ['upper_jiao','middle_jiao','lower_jiao'].forEach(function (k) {
      var z = tb[k];
      if (z && z.status && z.status !== 'normal') {
        bits.push((z.name_en || k) + ': ' + (z.status_en || z.status));
      }
    });
    var asc = t.ascending_descending || {};
    if (asc.direction && asc.direction !== 'balanced') {
      bits.push(asc.name_en || asc.direction);
    }
    return bits.slice(0, 3).join(' · ');
  }

  function aggregateAdvice(themes) {
    var foodEatMore = {}, foodEatLess = {}, foodAvoid = {};
    var lifestyleMap = {};
    var herbMap = {};
    var mealMap  = {};

    themes.forEach(function (t) {
      var weight = t.priority === 'high' ? 3 : (t.priority === 'medium' ? 2 : 1);
      function addFood(bucket, item) {
        var key = item.en;
        if (! bucket[key]) bucket[key] = Object.assign({}, item, { for_themes: [], weight: 0 });
        bucket[key].for_themes.push({ en: t.en, zh: t.zh });
        bucket[key].weight += weight;
      }
      (t.food && t.food.eatMore || []).forEach(function (i) { addFood(foodEatMore, i); });
      (t.food && t.food.eatLess || []).forEach(function (i) { addFood(foodEatLess, i); });
      (t.food && t.food.avoid   || []).forEach(function (i) { addFood(foodAvoid,   i); });

      (t.lifestyle || []).forEach(function (i) {
        var k = i.en;
        if (! lifestyleMap[k]) lifestyleMap[k] = Object.assign({}, i, { for_themes: [], weight: 0 });
        lifestyleMap[k].for_themes.push({ en: t.en, zh: t.zh });
        lifestyleMap[k].weight += weight;
      });

      (t.herbs || []).forEach(function (h) {
        if (! herbMap[h]) herbMap[h] = { name: h, for_themes: [], weight: 0 };
        herbMap[h].for_themes.push({ en: t.en, zh: t.zh });
        herbMap[h].weight += weight;
      });

      // 藥膳 — keyed by Chinese name so duplicates collapse cleanly.
      (t.medicinal_meals || []).forEach(function (m) {
        var key = m.name_zh || m.name_en;
        if (! mealMap[key]) mealMap[key] = Object.assign({}, m, { for_themes: [], weight: 0 });
        mealMap[key].for_themes.push({ en: t.en, zh: t.zh });
        mealMap[key].weight += weight;
      });
    });

    function toSorted(obj) {
      return Object.values(obj).sort(function (a, b) { return b.weight - a.weight; });
    }

    return {
      food: {
        eatMore: toSorted(foodEatMore),
        eatLess: toSorted(foodEatLess),
        avoid:   toSorted(foodAvoid),
      },
      lifestyle:        toSorted(lifestyleMap),
      herbs:            toSorted(herbMap),
      medicinal_meals:  toSorted(mealMap),
    };
  }

  HM.synthesis = {
    combine: combine,
    THEMES:  THEMES,    // exposed for tests / future UI extensions
  };
})();
