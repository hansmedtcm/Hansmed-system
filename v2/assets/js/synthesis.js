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
      summary_en: 'Low energy, easily fatigued, weak voice, prone to colds.',
      summary_zh: '體力不足、容易疲勞、聲音低弱、易感冒。',
      detect: {
        // Cosmic: weak Spleen or Lung organ (qi-producing organs)
        wyl: function (w) {
          var weak = (w && w.organs && w.organs.weak) || [];
          return weak.indexOf('脾') >= 0 || weak.indexOf('肺') >= 0;
        },
        // Constitution: qi_xu negative or pi_wei negative
        constitution: function (c) {
          var d = (c && c.dimensions) || {};
          return (d.qi_xu || 0) <= -1 || (d.pi_wei || 0) <= -1;
        },
        // Tongue: pale colour, teeth marks, weak shape
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
      food: {
        eatMore: [
          { en: 'Rice porridge with yam (山藥)', zh: '山藥粥', why_en: 'Gentle on the spleen, builds qi', why_zh: '健脾益氣' },
          { en: 'Red dates (紅棗)', zh: '紅棗', why_en: 'Tonifies qi & blood', why_zh: '補氣養血' },
          { en: 'Chicken broth', zh: '雞湯', why_en: 'Warming, easy to digest', why_zh: '溫補氣血' },
          { en: 'Millet (小米)', zh: '小米', why_en: 'Strengthens spleen-stomach', why_zh: '健脾養胃' },
        ],
        eatLess: [
          { en: 'Cold drinks and ice cream', zh: '冰飲、雪糕', why_en: 'Cold injures spleen yang', why_zh: '寒傷脾陽' },
          { en: 'Raw vegetables and salads', zh: '生冷沙律', why_en: 'Hard to digest when qi is weak', why_zh: '氣虛運化無力' },
        ],
        avoid: [
          { en: 'Excessive sweating activities (sauna, hot yoga)', zh: '過度出汗活動', why_en: 'Sweat depletes qi', why_zh: '汗為氣之餘' },
        ],
      },
      lifestyle: [
        { icon: '😴', en: 'Sleep before 11pm; aim for 7–8 hours', zh: '11點前入睡，保證7-8小時' },
        { icon: '🌳', en: 'Gentle exercise: Tai Chi, walking, Qi Gong — avoid HIIT', zh: '溫和運動：太極、散步、氣功，避免劇烈' },
        { icon: '🌬️', en: 'Practise abdominal breathing 5 min, twice daily', zh: '每日二次腹式呼吸5分鐘' },
      ],
      herbs: ['黃耆 Huang Qi', '黨參 Dang Shen', '白朮 Bai Zhu', '炙甘草 Zhi Gan Cao', '大棗 Da Zao'],
    },

    yang_deficiency: {
      en: 'Yang Deficiency (Cold)', zh: '陽虛（寒）',
      summary_en: 'Cold extremities, fear of cold, low metabolism, loose stools.',
      summary_zh: '手腳冰冷、怕冷、代謝偏低、大便偏軟。',
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
          // Pale wet root signal in three-burner lower jiao
          var lower = t.three_burner && t.three_burner.lower_jiao;
          if (lower && lower.status === 'cold_damp') return true;
          if (lower && lower.status === 'deficiency_cold') return true;
          var asc = t.ascending_descending || {};
          return false;
        },
      },
      food: {
        eatMore: [
          { en: 'Ginger tea (生薑茶)', zh: '生薑茶', why_en: 'Warms the middle', why_zh: '溫中散寒' },
          { en: 'Lamb stew with cinnamon', zh: '肉桂燉羊肉', why_en: 'Warms kidney yang', why_zh: '溫補腎陽' },
          { en: 'Walnuts (核桃)', zh: '核桃', why_en: 'Tonifies kidney yang', why_zh: '補腎助陽' },
          { en: 'Chives (韭菜)', zh: '韭菜', why_en: 'Yang-warming vegetable', why_zh: '溫陽行氣' },
        ],
        eatLess: [
          { en: 'Iced drinks, raw seafood', zh: '冰飲、生海鮮', why_en: 'Cold injures yang qi', why_zh: '寒涼傷陽' },
          { en: 'Bitter melon, watermelon (cooling)', zh: '苦瓜、西瓜（寒涼）', why_en: 'Worsens internal cold', why_zh: '加重內寒' },
        ],
        avoid: [
          { en: 'Air-conditioning blowing on lower back / abdomen', zh: '冷氣直吹腰腹', why_en: 'External cold invades', why_zh: '寒邪外侵' },
        ],
      },
      lifestyle: [
        { icon: '🛁', en: 'Warm foot soak before bed (40°C, 15–20 min)', zh: '睡前溫水泡腳（40°C，15-20分鐘）' },
        { icon: '☀️', en: 'Morning sun exposure — 15 min back to the sun', zh: '晨間曬太陽15分鐘（背曬）' },
        { icon: '🧣', en: 'Keep lower back, knees, neck warm', zh: '注意腰、膝、頸保暖' },
        { icon: '🔥', en: 'Consider moxibustion at 關元 / 命門', zh: '可考慮艾灸關元、命門' },
      ],
      herbs: ['附子 Fu Zi', '肉桂 Rou Gui', '乾薑 Gan Jiang', '杜仲 Du Zhong', '淫羊藿 Yin Yang Huo'],
    },

    yin_deficiency: {
      en: 'Yin Deficiency (Heat from deficiency)', zh: '陰虛（虛熱）',
      summary_en: 'Hot palms/soles, night sweats, dry mouth, afternoon flush.',
      summary_zh: '手腳心發熱、夜間盜汗、口乾、午後潮熱。',
      detect: {
        wyl: function (w) {
          // Liuqi nature carrying dryness/fire excess as a tendency
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
      food: {
        eatMore: [
          { en: 'Pear, lily bulb, white fungus soup', zh: '雪梨百合銀耳湯', why_en: 'Moistens yin and lung', why_zh: '滋陰潤肺' },
          { en: 'Black sesame (黑芝麻)', zh: '黑芝麻', why_en: 'Nourishes kidney yin', why_zh: '補腎陰' },
          { en: 'Soy milk (warm)', zh: '溫豆漿', why_en: 'Cool and moistening', why_zh: '清潤生津' },
          { en: 'Goji berries (枸杞)', zh: '枸杞', why_en: 'Liver-kidney yin tonic', why_zh: '滋補肝腎' },
        ],
        eatLess: [
          { en: 'Spicy, fried, grilled foods', zh: '辛辣、油炸、燒烤', why_en: 'Drying & heating', why_zh: '助火傷陰' },
          { en: 'Coffee and strong tea', zh: '咖啡、濃茶', why_en: 'Drying, agitate yin', why_zh: '燥熱擾陰' },
        ],
        avoid: [
          { en: 'Staying up past 11pm — yin restores during deep sleep', zh: '熬夜過11點 — 陰於深眠時恢復', why_en: 'Late nights deplete yin', why_zh: '熬夜耗陰' },
        ],
      },
      lifestyle: [
        { icon: '💤', en: 'Strict 11pm bedtime — yin restores in deep sleep', zh: '嚴格11點前入睡' },
        { icon: '💧', en: 'Drink warm water steadily; avoid waiting until thirsty', zh: '少量多次喝溫水，勿等口渴' },
        { icon: '🧘', en: 'Meditation, quiet breathing — avoid agitating exercise', zh: '靜坐養神，避免劇烈運動' },
      ],
      herbs: ['麥冬 Mai Dong', '石斛 Shi Hu', '玉竹 Yu Zhu', '百合 Bai He', '枸杞 Gou Qi', '生地黃 Sheng Di Huang'],
    },

    damp_heat: {
      en: 'Damp-Heat', zh: '濕熱',
      summary_en: 'Heaviness, oily skin, sticky stools, bitter mouth, yellow urine.',
      summary_zh: '身重、面油、大便黏、口苦、小便黃。',
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
          // Any zone showing damp_heat
          var tb = t.three_burner || {};
          return ['upper_jiao','middle_jiao','lower_jiao'].some(function (k) {
            return tb[k] && tb[k].status === 'damp_heat';
          });
        },
      },
      food: {
        eatMore: [
          { en: 'Mung bean soup (綠豆湯)', zh: '綠豆湯', why_en: 'Clears heat, drains damp', why_zh: '清熱利濕' },
          { en: 'Job\'s tears (薏苡仁) congee', zh: '薏苡仁粥', why_en: 'Drains damp, cools', why_zh: '利濕清熱' },
          { en: 'Bitter melon, cucumber, winter melon', zh: '苦瓜、黃瓜、冬瓜', why_en: 'Cool & dampness-draining', why_zh: '清涼利濕' },
        ],
        eatLess: [
          { en: 'Alcohol (especially beer)', zh: '酒類（尤其啤酒）', why_en: 'Generates damp-heat', why_zh: '生濕助熱' },
          { en: 'Greasy fried food, BBQ', zh: '油炸、燒烤', why_en: 'Heavy & heating', why_zh: '助濕生熱' },
          { en: 'Sweet desserts, sugary drinks', zh: '甜點、含糖飲料', why_en: 'Sweet generates damp', why_zh: '甘助濕' },
        ],
        avoid: [
          { en: 'Damp environments, sweating in unwashed clothes', zh: '潮濕環境、汗濕未換衣' },
        ],
      },
      lifestyle: [
        { icon: '🏃', en: 'Aerobic exercise 30 min/day to sweat out damp', zh: '每日30分鐘有氧運動，微出汗' },
        { icon: '🧴', en: 'Daily shower; keep skin dry, especially folds', zh: '每日洗澡，保持皮膚乾爽' },
        { icon: '⛅', en: 'Use dehumidifier in humid weather', zh: '潮濕天氣使用抽濕機' },
      ],
      herbs: ['茵陳 Yin Chen', '黃連 Huang Lian', '梔子 Zhi Zi', '茯苓 Fu Ling', '滑石 Hua Shi'],
    },

    liver_qi_stagnation: {
      en: 'Liver Qi Stagnation', zh: '肝氣鬱結',
      summary_en: 'Tightness, sighing, mood swings, breast tenderness, irregular periods.',
      summary_zh: '胸悶、嘆氣、情緒波動、乳房脹痛、月經不調。',
      detect: {
        wyl: function (w) {
          // Strong Wood / Liver in cosmic constitution
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
          // Liver flag in holographic
          var holo = (t.holographic_map && t.holographic_map.affected) || [];
          return holo.some(function (f) { return /liver/i.test(f.region || ''); });
        },
      },
      food: {
        eatMore: [
          { en: 'Chrysanthemum tea (菊花茶)', zh: '菊花茶', why_en: 'Soothes liver, calms', why_zh: '疏肝清熱' },
          { en: 'Citrus peel (陳皮) tea', zh: '陳皮茶', why_en: 'Moves stagnant qi', why_zh: '理氣解鬱' },
          { en: 'Mint, jasmine flower tea', zh: '薄荷、茉莉花茶', why_en: 'Light, fragrant — moves qi', why_zh: '芳香理氣' },
          { en: 'Rose tea (玫瑰花茶)', zh: '玫瑰花茶', why_en: 'Soothes mood, regulates menses', why_zh: '疏肝解鬱、調經' },
        ],
        eatLess: [
          { en: 'Heavy alcohol, late-night meals', zh: '酗酒、宵夜', why_en: 'Burdens liver detox', why_zh: '加重肝臟負擔' },
        ],
        avoid: [
          { en: 'Suppressing emotions; work without breaks', zh: '壓抑情緒、工作不間斷', why_en: 'Stagnates qi further', why_zh: '加重氣機鬱滯' },
        ],
      },
      lifestyle: [
        { icon: '🌿', en: 'Spend time outdoors, see green / nature', zh: '走出戶外，多接觸綠意' },
        { icon: '📓', en: 'Journal feelings; vent in healthy ways', zh: '寫日記抒發情緒' },
        { icon: '🤝', en: 'Social connection — talk it out', zh: '與朋友傾訴交流' },
        { icon: '🧘', en: 'Stretching, yoga, qi gong — open the chest', zh: '伸展運動、瑜伽、氣功，打開胸廓' },
      ],
      herbs: ['柴胡 Chai Hu', '香附 Xiang Fu', '玫瑰花 Mei Gui Hua', '合歡皮 He Huan Pi', '鬱金 Yu Jin'],
    },

    blood_stasis: {
      en: 'Blood Stasis', zh: '血瘀',
      summary_en: 'Fixed sharp pain, bruising, dark menstrual clots, dull complexion.',
      summary_zh: '定點刺痛、易瘀青、經血血塊、面色晦暗。',
      detect: {
        wyl: function () { return false; }, // No direct DOB signal
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
      food: {
        eatMore: [
          { en: 'Hawthorn (山楂)', zh: '山楂', why_en: 'Invigorates blood, breaks stasis', why_zh: '活血化瘀' },
          { en: 'Black fungus (黑木耳)', zh: '黑木耳', why_en: 'Moves blood, mild anticoagulant', why_zh: '活血通絡' },
          { en: 'Saffron-style turmeric, ginger', zh: '薑黃、生薑', why_en: 'Warms & moves blood', why_zh: '溫經活血' },
          { en: 'Dark leafy greens', zh: '深色綠葉菜', why_en: 'Iron + circulation support', why_zh: '養血助行' },
        ],
        eatLess: [
          { en: 'Cold raw foods, ice', zh: '生冷食物、冰飲', why_en: 'Cold congeals blood', why_zh: '寒則血凝' },
        ],
        avoid: [
          { en: 'Prolonged sitting / immobility', zh: '久坐不動', why_en: 'Stagnates flow', why_zh: '久坐傷氣血' },
        ],
      },
      lifestyle: [
        { icon: '🚶', en: 'Walk briskly 30 min/day to keep blood moving', zh: '每日快走30分鐘' },
        { icon: '💆', en: 'Self-massage stiff areas; consider Tuina or cupping', zh: '自我按摩、考慮推拿或拔罐' },
        { icon: '🌡️', en: 'Stay warm — cold worsens stasis', zh: '注意保暖，寒加重瘀' },
      ],
      herbs: ['丹參 Dan Shen', '川芎 Chuan Xiong', '桃仁 Tao Ren', '紅花 Hong Hua', '益母草 Yi Mu Cao'],
    },

    blood_deficiency: {
      en: 'Blood Deficiency', zh: '血虛',
      summary_en: 'Pale lips/face, dizziness, dry hair & nails, scant or pale menstruation.',
      summary_zh: '唇面蒼白、頭暈、頭髮指甲乾、月經量少色淡。',
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
      food: {
        eatMore: [
          { en: 'Pork liver, beef', zh: '豬肝、牛肉', why_en: 'Iron + blood-building', why_zh: '補血養肝' },
          { en: 'Black sesame, walnuts, longan', zh: '黑芝麻、核桃、龍眼', why_en: 'Nourishes blood', why_zh: '養血安神' },
          { en: 'Spinach, beetroot, dark grapes', zh: '菠菜、紅菜頭、黑葡萄', why_en: 'Iron-rich plants', why_zh: '富含鐵質' },
          { en: 'Dang Gui (當歸) cooked with chicken', zh: '當歸燉雞', why_en: 'Classic blood tonic', why_zh: '補血養顏' },
        ],
        eatLess: [
          { en: 'Excessive coffee/tea (interferes with iron absorption)', zh: '過量咖啡/茶（影響鐵吸收）', why_en: 'Tannins block iron', why_zh: '影響鐵質吸收' },
        ],
        avoid: [
          { en: 'Skipping meals, crash diets', zh: '不吃飯、節食減肥', why_en: 'Starves blood production', why_zh: '飲食不足化源不足' },
        ],
      },
      lifestyle: [
        { icon: '😴', en: 'Sleep before 11pm — blood returns to liver', zh: '11點前入睡，血歸肝藏' },
        { icon: '👁️', en: 'Limit screen time — overuse of eyes consumes blood', zh: '減少用眼，久視傷血' },
      ],
      herbs: ['熟地黃 Shu Di Huang', '當歸 Dang Gui', '白芍 Bai Shao', '阿膠 E Jiao', '龍眼肉 Long Yan Rou'],
    },

    phlegm_dampness: {
      en: 'Phlegm-Dampness', zh: '痰濕',
      summary_en: 'Heaviness, sluggish digestion, mucus, weight gain, foggy head.',
      summary_zh: '身重、消化遲緩、痰多、易胖、頭重昏沉。',
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
      food: {
        eatMore: [
          { en: 'Job\'s tears (薏苡仁), red bean (赤小豆)', zh: '薏苡仁、赤小豆', why_en: 'Drain damp via urine', why_zh: '利濕健脾' },
          { en: 'Winter melon soup', zh: '冬瓜湯', why_en: 'Light, drains damp', why_zh: '清淡利水' },
          { en: 'Lotus seeds (蓮子), poria (茯苓)', zh: '蓮子、茯苓', why_en: 'Strengthen spleen', why_zh: '健脾化濕' },
        ],
        eatLess: [
          { en: 'Dairy (especially cheese)', zh: '乳製品（尤其芝士）', why_en: 'Generates phlegm-damp', why_zh: '助濕生痰' },
          { en: 'Greasy, sweet, fried foods', zh: '油膩、甜食、油炸', why_en: 'Heavy on the spleen', why_zh: '困脾生濕' },
        ],
        avoid: [
          { en: 'Eating right before sleep', zh: '睡前進食', why_en: 'Food sits, generates damp', why_zh: '食滯化濕' },
        ],
      },
      lifestyle: [
        { icon: '🏃', en: 'Daily aerobic exercise — sweat is medicinal', zh: '每日有氧運動，發汗助化濕' },
        { icon: '🌬️', en: 'Avoid damp environments and sitting on cold floors', zh: '避免潮濕環境及坐冷地' },
      ],
      herbs: ['茯苓 Fu Ling', '蒼朮 Cang Zhu', '半夏 Ban Xia', '陳皮 Chen Pi', '薏苡仁 Yi Yi Ren'],
    },
  };

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
        key:        key,
        en:         theme.en,
        zh:         theme.zh,
        summary_en: theme.summary_en,
        summary_zh: theme.summary_zh,
        sources:    sources,
        priority:   sources.length >= 3 ? 'high' : (sources.length === 2 ? 'medium' : 'low'),
        evidence:   evidence,
        food:       theme.food,
        lifestyle:  theme.lifestyle,
        herbs:      theme.herbs,
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

    return {
      themes:          themes,
      food:            aggregate.food,
      lifestyle:       aggregate.lifestyle,
      herbs:           aggregate.herbs,
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
      lifestyle: toSorted(lifestyleMap),
      herbs:     toSorted(herbMap),
    };
  }

  HM.synthesis = {
    combine: combine,
    THEMES:  THEMES,    // exposed for tests / future UI extensions
  };
})();
