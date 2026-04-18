/**
 * Wuyun Liuqi (五運六氣) Constitution Analyser
 *
 * Classical TCM calendrical analysis from the Huangdi Neijing — uses the
 * Ganzhi (天干地支) year derived from patient DOB to estimate inherent
 * constitutional tendencies. This is a *clinical aide* for the doctor,
 * not a patient-facing diagnosis: it surfaces predispositions that may
 * speed up pattern-differentiation during consultation.
 *
 * Calendar rules:
 *   • New "qi year" starts at Daxuan (大寒, ~Jan 20). DOB before that
 *     counts as the previous Ganzhi year.
 *   • Heavenly Stem (天干) → Da Yun (大運) + organ tendency
 *   • Earthly Branch (地支) → Sitian/Zaiquan (司天/在泉) + qi nature
 *   • Month + day → which of the six qi steps the patient was born in
 *
 * Exposes:
 *   HM.wuyunLiuqi.analyze(dobString)   → full analysis object, or null
 *   HM.wuyunLiuqi.renderCard(analysis) → HTML string for a compact
 *                                        doctor-facing card
 */
(function () {
  'use strict';
  window.HM = window.HM || {};

  var STEMS    = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  var BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

  // Stem → Da Yun (五運). Odd-position stems are 陽 (太過), even are 陰 (不及).
  var STEM_DAYUN = [
    { yun: '土運', element: '土', organ: '脾', phase: '太過', yang: true  }, // 甲
    { yun: '金運', element: '金', organ: '肺', phase: '不及', yang: false }, // 乙
    { yun: '水運', element: '水', organ: '腎', phase: '太過', yang: true  }, // 丙
    { yun: '木運', element: '木', organ: '肝', phase: '不及', yang: false }, // 丁
    { yun: '火運', element: '火', organ: '心', phase: '太過', yang: true  }, // 戊
    { yun: '土運', element: '土', organ: '脾', phase: '不及', yang: false }, // 己
    { yun: '金運', element: '金', organ: '肺', phase: '太過', yang: true  }, // 庚
    { yun: '水運', element: '水', organ: '腎', phase: '不及', yang: false }, // 辛
    { yun: '木運', element: '木', organ: '肝', phase: '太過', yang: true  }, // 壬
    { yun: '火運', element: '火', organ: '心', phase: '不及', yang: false }, // 癸
  ];

  // Branch → ruling qi pair. 子/午 share sitian, 丑/未 share, etc.
  var BRANCH_LIUQI = {
    '子': { sitian:'少陰君火', zaiquan:'陽明燥金', sitianShort:'少陰', zaiquanShort:'陽明', nature:'熱燥' },
    '午': { sitian:'少陰君火', zaiquan:'陽明燥金', sitianShort:'少陰', zaiquanShort:'陽明', nature:'熱燥' },
    '丑': { sitian:'太陰濕土', zaiquan:'太陽寒水', sitianShort:'太陰', zaiquanShort:'太陽', nature:'寒濕' },
    '未': { sitian:'太陰濕土', zaiquan:'太陽寒水', sitianShort:'太陰', zaiquanShort:'太陽', nature:'寒濕' },
    '寅': { sitian:'少陽相火', zaiquan:'厥陰風木', sitianShort:'少陽', zaiquanShort:'厥陰', nature:'風熱' },
    '申': { sitian:'少陽相火', zaiquan:'厥陰風木', sitianShort:'少陽', zaiquanShort:'厥陰', nature:'風熱' },
    '卯': { sitian:'陽明燥金', zaiquan:'少陰君火', sitianShort:'陽明', zaiquanShort:'少陰', nature:'燥熱' },
    '酉': { sitian:'陽明燥金', zaiquan:'少陰君火', sitianShort:'陽明', zaiquanShort:'少陰', nature:'燥熱' },
    '辰': { sitian:'太陽寒水', zaiquan:'太陰濕土', sitianShort:'太陽', zaiquanShort:'太陰', nature:'寒濕' },
    '戌': { sitian:'太陽寒水', zaiquan:'太陰濕土', sitianShort:'太陽', zaiquanShort:'太陰', nature:'寒濕' },
    '巳': { sitian:'厥陰風木', zaiquan:'少陽相火', sitianShort:'厥陰', zaiquanShort:'少陽', nature:'風火' },
    '亥': { sitian:'厥陰風木', zaiquan:'少陽相火', sitianShort:'厥陰', zaiquanShort:'少陽', nature:'風火' },
  };

  // Fixed main qi (主氣) cycle through the six steps of the year
  var ZHU_QI = [
    { name:'厥陰風木', short:'厥陰', window:'1/20–3/19' },
    { name:'少陰君火', short:'少陰', window:'3/20–5/20' },
    { name:'少陽相火', short:'少陽', window:'5/21–7/21' },
    { name:'太陰濕土', short:'太陰', window:'7/22–9/22' },
    { name:'陽明燥金', short:'陽明', window:'9/23–11/21' },
    { name:'太陽寒水', short:'太陽', window:'11/22–1/19' },
  ];
  var QI_ORDER = ['厥陰風木','少陰君火','太陰濕土','少陽相火','陽明燥金','太陽寒水'];
  var QI_SHORT = ['厥陰','少陰','太陰','少陽','陽明','太陽'];

  // Stem → organ strength profile. Based on 五行生克:
  //  • 太過 stems → own organ is strong, and the organ it controls (克) is weak.
  //  • 不及 stems → own organ is weak, and the organ that controls it is relatively strong.
  var STEM_ORGANS = {
    '甲': { strong:['脾'],        weak:['腎'], note:'土運太過：脾氣偏盛，腎水受克偏弱' },
    '乙': { strong:['肝'],        weak:['肺'], note:'金運不及：肺氣偏弱，肝木相對偏旺' },
    '丙': { strong:['腎'],        weak:['心'], note:'水運太過：腎水偏盛，心火受克偏弱' },
    '丁': { strong:['肺'],        weak:['肝'], note:'木運不及：肝氣偏弱，肺金相對偏旺' },
    '戊': { strong:['心'],        weak:['肺'], note:'火運太過：心火偏盛，肺金受克偏弱' },
    '己': { strong:['肝'],        weak:['脾'], note:'土運不及：脾氣偏弱，肝木相對偏旺' },
    '庚': { strong:['肺'],        weak:['肝'], note:'金運太過：肺金偏盛，肝木受克偏弱' },
    '辛': { strong:['心'],        weak:['腎'], note:'水運不及：腎氣偏弱，心火相對偏旺' },
    '壬': { strong:['肝'],        weak:['脾'], note:'木運太過：肝木偏盛，脾土受克偏弱' },
    '癸': { strong:['腎'],        weak:['心'], note:'火運不及：心火偏弱，腎水相對偏旺' },
  };

  var ALL_ORGANS = ['肝','心','脾','肺','腎'];

  // Constitution profiles indexed by the branch's qi "nature".
  // Clinical summaries — phrased for practitioner review, not patient display.
  var CONSTITUTION = {
    '熱燥': {
      name: '熱燥體質 Heat-Dry',
      color: '#c0392b',
      summary: 'Upper-half-year heat dominance, lower-half dryness. Patient may trend toward Yin deficiency with internal heat and fluid depletion.',
      watchFor: ['口咽乾 dry mouth/throat','易上火 tendency to flare','皮膚乾 dry skin','便秘 constipation','心煩失眠 restless sleep','小便短赤 scanty dark urine'],
      therapeuticDirection: ['滋陰清熱 nourish Yin, clear heat','生津潤燥 generate fluids, moisten dryness','平肝降火 calm liver, drain fire'],
      cautions: ['辛辣煎炸 spicy / fried','烈酒 strong alcohol','溫燥補品 warming tonics'],
      tags: ['陰虛傾向', '內熱', '燥象'],
    },
    '寒濕': {
      name: '寒濕體質 Cold-Damp',
      color: '#1b3a4b',
      summary: 'Cold-damp environmental qi dominates. Patient may trend toward Yang deficiency with internal cold and damp accumulation; heart fire may be internally stifled.',
      watchFor: ['畏寒 cold aversion','易疲勞 fatigue','浮腫 edema','消化不良 poor digestion','關節痠痛 joint ache','便溏 loose stool'],
      therapeuticDirection: ['溫陽健脾 warm Yang, fortify spleen','散寒化濕 disperse cold, transform damp','固護腎陽 support kidney Yang'],
      cautions: ['生冷 raw / cold','甜膩 sweet-greasy','久處潮濕 damp environment'],
      tags: ['陽虛傾向', '寒濕', '脾腎偏弱'],
    },
    '風熱': {
      name: '風熱體質 Wind-Heat',
      color: '#2d6a4f',
      summary: 'Upper-year relative fire, lower-year wind movement. Liver qi tends to be hyperactive; patient may be sensitive to emotional triggers and external wind-heat pathogens.',
      watchFor: ['頭痛頭脹 head pain','情緒波動 mood swings','過敏 allergic tendency','目赤 red eyes','皮疹 rashes','睡眠欠佳 light sleep'],
      therapeuticDirection: ['疏肝清熱 soothe liver, clear heat','平肝熄風 pacify liver, extinguish wind','養陰安神 nourish Yin, calm spirit'],
      cautions: ['情緒刺激 emotional stress','肥甘厚味 rich foods','熬夜 late nights'],
      tags: ['肝旺', '風火', '情志敏感'],
    },
    '燥熱': {
      name: '燥熱體質 Dry-Heat',
      color: '#7b4f12',
      summary: 'Upper-year dryness, lower-year heat. Combined dry-heat pattern; lung Yin and heart Yin are relatively vulnerable.',
      watchFor: ['乾咳少痰 dry cough','皮膚乾 dry skin','便乾 dry stool','心煩 irritability','口鼻乾 dry mouth/nose','盜汗 night sweat'],
      therapeuticDirection: ['潤肺養陰 moisten lung, nourish Yin','清熱生津 clear heat, generate fluids','寧心安神 calm heart, settle spirit'],
      cautions: ['燥熱食物 dry-heat foods','吸煙 smoking','乾燥環境 dry environment'],
      tags: ['燥邪', '肺陰易傷', '心火易動'],
    },
    '風火': {
      name: '風火體質 Wind-Fire',
      color: '#6b2d1e',
      summary: 'Upper-year wind dominance, lower-year relative fire. Liver wind with hyperactive ministerial fire; often accompanies liver-kidney Yin patterns.',
      watchFor: ['頭暈目眩 dizziness','耳鳴 tinnitus','情緒激動 emotional volatility','肌肉痙攣 cramps','失眠多夢 restless sleep','月經不調 (女) menstrual irregularity'],
      therapeuticDirection: ['柔肝熄風 soften liver, extinguish wind','清相火 clear ministerial fire','寧心養血 calm heart, nourish blood'],
      cautions: ['辛辣燥熱 spicy-dry','情緒刺激 stress','過度運動 over-exertion'],
      tags: ['風動', '相火亢', '肝腎陰虛'],
    },
  };

  // Map a (month, day) to one of the six qi steps. Boundaries at the
  // classical solar-term-aligned dates used in the calendar above.
  function birthStepIndex(month, day) {
    var md = month * 100 + day;
    if (md >=  120 && md <=  319) return 0;
    if (md >=  320 && md <=  520) return 1;
    if (md >=  521 && md <=  721) return 2;
    if (md >=  722 && md <=  922) return 3;
    if (md >=  923 && md <= 1121) return 4;
    return 5; // Nov 22 – Jan 19
  }

  /**
   * Main entry: take an ISO-ish birth date string and return the analysis.
   * Accepts 'YYYY-MM-DD', 'YYYY/MM/DD', or a Date object. Returns null if
   * the date is unparseable so callers can hide the section gracefully.
   */
  function analyze(dob) {
    if (!dob) return null;
    var d;
    if (dob instanceof Date) {
      d = dob;
    } else {
      var s = String(dob).replace(/\//g, '-').substring(0, 10);
      var parts = s.split('-').map(function (x) { return parseInt(x, 10); });
      if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) return null;
      d = new Date(parts[0], parts[1] - 1, parts[2]);
    }
    if (isNaN(d.getTime())) return null;

    var year = d.getFullYear();
    var month = d.getMonth() + 1;
    var day = d.getDate();

    // Before 大寒 (~Jan 20) → previous qi year
    var qiYear = year;
    if (month === 1 && day < 20) qiYear = year - 1;

    var stemIdx = ((qiYear - 4) % 10 + 10) % 10;
    var branchIdx = ((qiYear - 4) % 12 + 12) % 12;
    var stem = STEMS[stemIdx];
    var branch = BRANCHES[branchIdx];

    var dayun = STEM_DAYUN[stemIdx];
    var liuqi = BRANCH_LIUQI[branch];
    var organs = STEM_ORGANS[stem];
    var constitution = CONSTITUTION[liuqi.nature];
    var step = birthStepIndex(month, day);

    var sitianIdx = QI_SHORT.indexOf(liuqi.sitianShort);
    var keQi = [];
    for (var i = 0; i < 6; i++) {
      keQi.push(QI_ORDER[((sitianIdx - 2 + i) % 6 + 6) % 6]);
    }

    return {
      dob: d.toISOString().substring(0, 10),
      inputYear: year,
      qiYear: qiYear,
      stem: stem,
      branch: branch,
      ganzhi: stem + branch,
      dayun: dayun,
      liuqi: liuqi,
      organs: organs,
      constitution: constitution,
      birthStep: step,
      zhuQi: ZHU_QI[step],
      keQi: keQi[step],
      allKeQi: keQi,
      // Pre-computed organ strength map for easy rendering
      organMap: ALL_ORGANS.map(function (o) {
        return {
          organ: o,
          status: organs.strong.indexOf(o) >= 0 ? 'strong'
                : organs.weak.indexOf(o) >= 0 ? 'weak'
                : 'neutral',
        };
      }),
    };
  }

  /**
   * Render a compact card for the doctor's view. Returns HTML string
   * (not a detached node) so it can be inserted with innerHTML. The
   * caller is responsible for ensuring this ONLY appears in
   * practitioner-facing views.
   */
  function renderCard(a) {
    if (!a) return '';
    var c = a.constitution;

    var organHtml = a.organMap.map(function (o) {
      var cls = 'wyl-organ wyl-organ--' + o.status;
      var label = o.status === 'strong' ? '偏強 ▲'
                : o.status === 'weak'   ? '偏弱 ▼'
                : '平';
      return '<div class="' + cls + '"><div class="wyl-organ-name">' + o.organ +
        '</div><div class="wyl-organ-status">' + label + '</div></div>';
    }).join('');

    var stepHtml = ZHU_QI.map(function (s, i) {
      var cur = (i === a.birthStep) ? ' wyl-step--current' : '';
      return '<div class="wyl-step' + cur + '">' +
        '<div class="wyl-step-num">第' + (i + 1) + '步</div>' +
        '<div class="wyl-step-zhu">' + s.short + '</div>' +
        '<div class="wyl-step-ke">客:' + QI_SHORT[((QI_SHORT.indexOf(a.liuqi.sitianShort) - 2 + i) % 6 + 6) % 6] + '</div>' +
        '<div class="wyl-step-date">' + s.window + '</div>' +
      '</div>';
    }).join('');

    var tagHtml = c.tags.map(function (t) {
      return '<span class="wyl-tag" style="background:' + c.color + '22;color:' + c.color + ';border-color:' + c.color + '55;">' +
        escapeHtml(t) + '</span>';
    }).join('');

    var watchList = c.watchFor.map(function (w) {
      return '<span class="wyl-pill">' + escapeHtml(w) + '</span>';
    }).join('');

    return (
      '<div class="wyl-card">' +
        '<div class="wyl-head">' +
          '<div>' +
            '<div class="wyl-head-label">五運六氣分析 · Wuyun Liuqi Analysis</div>' +
            '<div class="wyl-head-sub">Clinical aide derived from patient DOB — not shown to patient</div>' +
          '</div>' +
          '<div class="wyl-ganzhi">' +
            '<span class="wyl-gz-char">' + a.stem + '</span>' +
            '<span class="wyl-gz-char">' + a.branch + '</span>' +
            '<div class="wyl-gz-year">' + a.qiYear + ' 年</div>' +
          '</div>' +
        '</div>' +

        '<div class="wyl-pillars">' +
          pillar('大運', a.dayun.yun, a.dayun.phase + ' · ' + a.dayun.organ) +
          pillar('司天 (上半年)', a.liuqi.sitian, '') +
          pillar('在泉 (下半年)', a.liuqi.zaiquan, '') +
        '</div>' +

        '<div class="wyl-section">' +
          '<div class="wyl-const" style="border-left-color:' + c.color + ';">' +
            '<div class="wyl-const-name" style="color:' + c.color + ';">' + escapeHtml(c.name) + '</div>' +
            '<div class="wyl-const-tags">' + tagHtml + '</div>' +
            '<div class="wyl-const-summary">' + escapeHtml(c.summary) + '</div>' +
            '<div class="wyl-const-note">' + escapeHtml(a.organs.note) + '</div>' +
          '</div>' +
        '</div>' +

        '<div class="wyl-section">' +
          '<div class="wyl-section-label">五臟強弱 · Organ tendency</div>' +
          '<div class="wyl-organs">' + organHtml + '</div>' +
        '</div>' +

        '<div class="wyl-section">' +
          '<div class="wyl-section-label">出生時令 · Birth season (highlighted)</div>' +
          '<div class="wyl-steps">' + stepHtml + '</div>' +
        '</div>' +

        '<div class="wyl-section">' +
          '<div class="wyl-section-label">臨床關注 · Clinical watch-fors</div>' +
          '<div class="wyl-pills">' + watchList + '</div>' +
        '</div>' +

        '<div class="wyl-section wyl-rx">' +
          '<div class="wyl-rx-col">' +
            '<div class="wyl-section-label">治則方向 · Therapeutic direction</div>' +
            '<ul class="wyl-rx-list">' +
              c.therapeuticDirection.map(function (x) { return '<li>' + escapeHtml(x) + '</li>'; }).join('') +
            '</ul>' +
          '</div>' +
          '<div class="wyl-rx-col">' +
            '<div class="wyl-section-label">宜避 · Cautions</div>' +
            '<ul class="wyl-rx-list">' +
              c.cautions.map(function (x) { return '<li>' + escapeHtml(x) + '</li>'; }).join('') +
            '</ul>' +
          '</div>' +
        '</div>' +

        '<div class="wyl-footer">Reference only — integrate with 四診合參 and流年運氣 before treatment decisions.</div>' +
      '</div>'
    );
  }

  function pillar(label, main, sub) {
    return '<div class="wyl-pillar">' +
      '<div class="wyl-pillar-label">' + label + '</div>' +
      '<div class="wyl-pillar-main">' + escapeHtml(main) + '</div>' +
      (sub ? '<div class="wyl-pillar-sub">' + escapeHtml(sub) + '</div>' : '') +
    '</div>';
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  /** Inject the compact clinical-card styles once per page. */
  function injectStyles() {
    if (document.getElementById('wyl-style')) return;
    var s = document.createElement('style');
    s.id = 'wyl-style';
    s.textContent =
      '.wyl-card{background:linear-gradient(145deg,#fbf7ec,#f3eada);border:1px solid rgba(201,146,42,0.28);border-radius:var(--r-md);padding:var(--s-4);font-size:var(--text-sm);color:var(--ink);}' +
      '.wyl-head{display:flex;justify-content:space-between;align-items:flex-start;gap:var(--s-3);padding-bottom:var(--s-3);border-bottom:1px dashed rgba(139,69,19,0.25);margin-bottom:var(--s-3);}' +
      '.wyl-head-label{font-size:var(--text-xs);letter-spacing:.12em;color:#8a621c;font-weight:600;text-transform:uppercase;}' +
      '.wyl-head-sub{font-size:11px;color:#9b7a3f;margin-top:2px;font-style:italic;}' +
      '.wyl-ganzhi{display:flex;align-items:center;gap:4px;}' +
      '.wyl-gz-char{display:inline-flex;width:34px;height:40px;align-items:center;justify-content:center;background:rgba(201,146,42,0.1);border:1px solid rgba(201,146,42,0.35);border-radius:3px;font-size:1.3rem;font-weight:700;color:#6b4413;font-family:var(--font-zh);}' +
      '.wyl-gz-year{font-size:10px;color:#9b7a3f;margin-left:6px;letter-spacing:.1em;}' +
      '.wyl-pillars{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s-2);margin-bottom:var(--s-3);}' +
      '@media (max-width:520px){.wyl-pillars{grid-template-columns:1fr;}}' +
      '.wyl-pillar{background:rgba(255,255,255,0.45);border:1px solid rgba(139,69,19,0.15);border-radius:3px;padding:8px 10px;text-align:center;}' +
      '.wyl-pillar-label{font-size:10px;letter-spacing:.16em;color:#8a621c;}' +
      '.wyl-pillar-main{font-size:var(--text-sm);font-weight:600;color:#2a1f0a;margin-top:3px;}' +
      '.wyl-pillar-sub{font-size:10px;color:#9b7a3f;margin-top:2px;}' +
      '.wyl-section{margin-bottom:var(--s-3);}' +
      '.wyl-section-label{font-size:10px;letter-spacing:.14em;color:#8a621c;font-weight:600;margin-bottom:6px;text-transform:uppercase;}' +
      '.wyl-const{background:rgba(255,255,255,0.5);border-left:3px solid var(--gold);border-radius:0 4px 4px 0;padding:10px 14px;}' +
      '.wyl-const-name{font-size:var(--text-base);font-weight:700;margin-bottom:6px;}' +
      '.wyl-const-tags{margin-bottom:8px;display:flex;gap:4px;flex-wrap:wrap;}' +
      '.wyl-const-summary{font-size:var(--text-xs);line-height:1.6;color:#3a2a10;}' +
      '.wyl-const-note{font-size:11px;color:#6b4413;font-style:italic;margin-top:6px;padding-top:6px;border-top:1px dashed rgba(139,69,19,0.2);}' +
      '.wyl-tag{display:inline-block;padding:2px 8px;border-radius:2px;font-size:10px;border:1px solid;font-family:var(--font-zh);}' +
      '.wyl-organs{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;}' +
      '.wyl-organ{text-align:center;padding:6px 2px;border-radius:3px;border:1px solid rgba(139,69,19,0.15);background:rgba(255,255,255,0.3);}' +
      '.wyl-organ--strong{background:rgba(192,57,43,0.1);border-color:rgba(192,57,43,0.35);}' +
      '.wyl-organ--strong .wyl-organ-name{color:var(--red-seal);}' +
      '.wyl-organ--weak{background:rgba(27,58,75,0.1);border-color:rgba(27,58,75,0.3);}' +
      '.wyl-organ--weak .wyl-organ-name{color:#1b3a4b;}' +
      '.wyl-organ-name{font-size:var(--text-sm);font-weight:700;}' +
      '.wyl-organ-status{font-size:9px;letter-spacing:.08em;color:#666;margin-top:2px;}' +
      '.wyl-steps{display:grid;grid-template-columns:repeat(6,1fr);gap:3px;}' +
      '@media (max-width:520px){.wyl-steps{grid-template-columns:repeat(3,1fr);}}' +
      '.wyl-step{text-align:center;padding:5px 2px;border-radius:3px;border:1px solid rgba(139,69,19,0.15);background:rgba(255,255,255,0.3);font-size:10px;}' +
      '.wyl-step--current{background:rgba(201,146,42,0.18);border-color:rgba(201,146,42,0.5);box-shadow:0 0 6px rgba(201,146,42,0.25);}' +
      '.wyl-step-num{font-size:9px;color:#8a621c;letter-spacing:.05em;}' +
      '.wyl-step-zhu{font-weight:700;color:#2a1f0a;margin-top:2px;}' +
      '.wyl-step-ke{color:#2d6a4f;margin-top:1px;}' +
      '.wyl-step-date{font-size:9px;color:#8b7355;margin-top:1px;}' +
      '.wyl-pills{display:flex;flex-wrap:wrap;gap:4px;}' +
      '.wyl-pill{display:inline-block;padding:3px 8px;background:rgba(139,69,19,0.08);border:1px solid rgba(139,69,19,0.18);border-radius:10px;font-size:11px;color:#3a2a10;}' +
      '.wyl-rx{display:grid;grid-template-columns:1fr 1fr;gap:var(--s-3);}' +
      '@media (max-width:520px){.wyl-rx{grid-template-columns:1fr;}}' +
      '.wyl-rx-list{margin:0;padding-left:18px;font-size:var(--text-xs);line-height:1.6;color:#2a1f0a;}' +
      '.wyl-rx-list li{margin-bottom:3px;}' +
      '.wyl-footer{font-size:10px;color:#8b7355;font-style:italic;text-align:center;margin-top:var(--s-3);padding-top:var(--s-2);border-top:1px dashed rgba(139,69,19,0.2);}';
    document.head.appendChild(s);
  }

  /**
   * Convenience: take a container element + DOB string, inject styles,
   * and render the card. If DOB is missing or unparseable, renders
   * nothing (empty container).
   */
  function mount(container, dob) {
    if (!container) return null;
    var a = analyze(dob);
    if (!a) {
      container.innerHTML = '';
      return null;
    }
    injectStyles();
    container.innerHTML = renderCard(a);
    return a;
  }

  HM.wuyunLiuqi = {
    analyze:       analyze,
    renderCard:    renderCard,
    injectStyles:  injectStyles,
    mount:         mount,
  };
})();
