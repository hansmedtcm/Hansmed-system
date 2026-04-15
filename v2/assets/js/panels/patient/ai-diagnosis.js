/**
 * AI Constitution Diagnosis — improved version.
 *
 * 8-dimension TCM questionnaire (ported from the original prototype) with
 * bilingual questions, live dimension preview, and integrated safety
 * follow-ups. Result is saved to the backend as a questionnaire and, like
 * the tongue diagnosis, flows through the doctor-review queue before any
 * medicine suggestion reaches the patient. Complex formulas still require
 * a booked consultation (consistent with shop gate 3).
 *
 * Dimensions scored:
 *   qi_xu   Qi deficiency ↔ qi excess         (-2 … +2)
 *   qi_zhi  Qi stagnation                     ( 0 … +2)
 *   pi_wei  Spleen/Stomach                    (-2 … +2)
 *   xue_xu  Blood deficiency ↔ blood heat     (-2 … +2)
 *   xue_yu  Blood stasis                      ( 0 … +2)
 *   ti_re   Internal heat                     (-2 … +2)  [negative = deficiency heat]
 *   ti_han  Cold sensitivity                  (-2 … +2)
 *   shi_qi  Dampness ↔ dryness                (-2 … +2)
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  // ── Question bank ──────────────────────────────────────────
  var QS = [
    { id: 'q1', dim: 'qi_xu', followUp: true, fuTrigger: -2,
      mod: '🔋 Energy · 能量（氣）',
      titleEn: 'How often do you feel fatigued, weak-voiced, or breathless?',
      titleZh: '你常覺得疲勞、說話沒力氣、爬樓梯容易喘嗎？',
      opts: [
        { t: 'Always exhausted — no energy to speak, extremely breathless', s: '總是疲勞、說話沒力、容易喘', v: -2 },
        { t: 'Often tired and lacking energy', s: '偶爾覺得累、沒力氣', v: -1 },
        { t: 'Full of energy, calm and breathing smoothly', s: '體力充沛，心平氣和', v: 0 },
        { t: 'Excess energy — cannot stop, easily irritable, face feels hot', s: '精力過剩、停不下來，心煩、臉部發熱', v: 1 },
        { t: 'Very loud voice, craving cold water, red face, head pressure', s: '氣粗口乾，臉紅，頭目脹痛', v: 2 },
      ],
    },
    { id: 'q2', dim: 'qi_zhi', followUp: false,
      mod: '🔋 Energy · 能量（氣）',
      titleEn: 'Do you often feel chest tightness, high stress, or urge to sigh?',
      titleZh: '你常覺得胸口悶、壓力大，或是常常想嘆氣？',
      opts: [
        { t: 'No chest tightness at all — completely relaxed', s: '完全不會悶', v: 0 },
        { t: 'Occasional chest heaviness, especially when emotional', s: '偶爾胸悶，情緒波動時明顯', v: 1 },
        { t: 'Whole body bound tight; must sigh frequently to feel relief', s: '全身緊繃，必須頻繁嘆氣才舒緩', v: 2 },
      ],
    },
    { id: 'q3', dim: 'pi_wei', followUp: false,
      mod: '🍚 Digestion · 消化（脾胃）',
      titleEn: 'How is your appetite and digestion?',
      titleZh: '你常覺得胃口不好、吃一點就飽、飯後容易脹氣嗎？',
      opts: [
        { t: 'Extreme loss of appetite, cannot digest', s: '極度厭食、胃脹痛', v: -2 },
        { t: 'Often poor appetite, feel full very quickly', s: '胃口不佳，吃一點就飽', v: -1 },
        { t: 'Good appetite, smooth digestion', s: '胃口好，消化順暢', v: 0 },
        { t: 'Frequently hungry, larger than normal appetite', s: '容易餓，食量偏大', v: 1 },
        { t: 'Always hungry even after eating, bad breath', s: '極度易餓、吃多不飽、口臭', v: 2 },
      ],
    },
    { id: 'q4', dim: 'xue_xu', followUp: true, fuTrigger: -2,
      mod: '🩸 Circulation · 循環（血）',
      titleEn: 'Do you experience dizziness or changes in complexion?',
      titleZh: '你常覺得頭暈、臉色蒼白，或常臉紅流鼻血？',
      opts: [
        { t: 'Constant dizziness, extremely pale face and lips', s: '總是頭暈，臉色極度蒼白', v: -2 },
        { t: 'Occasional dizziness, dull complexion', s: '偶爾頭暈，氣色偏淡', v: -1 },
        { t: 'Rarely dizzy, healthy rosy complexion', s: '很少頭暈，氣色紅潤', v: 0 },
        { t: 'No dizziness but often flushed and feel body heat', s: '不易頭暈，但常臉紅、身體燥熱', v: 1 },
        { t: 'Frequently flushed, overheated, prone to nosebleeds', s: '常臉紅發熱，易流鼻血或紅疹', v: 2 },
      ],
    },
    { id: 'q5', dim: 'xue_yu', followUp: true, fuTrigger: 2,
      mod: '🩸 Circulation · 循環（血）',
      titleEn: 'Numbness, painful periods with clots, or fixed stabbing pain?',
      titleZh: '您常覺得手腳發麻、生理期痛經有血塊，或身上固定位置刺痛？',
      opts: [
        { t: 'None of these — circulation feels smooth', s: '完全沒有（順暢）', v: 0 },
        { t: 'Occasional numbness, mild clots during periods', s: '偶爾麻，經期有小血塊', v: 1 },
        { t: 'Frequent fixed stabbing pain, persistent numbness, heavy clots', s: '定點刺痛、持續麻木、經血塊多', v: 2 },
      ],
    },
    { id: 'q6', dim: 'ti_re', followUp: true, fuTrigger: -2,
      mod: '🔥 Temperature · 溫度（熱）',
      titleEn: 'Do you feel palm/sole heat, night sweats, or internal heat?',
      titleZh: '你常手腳心發熱、夜間盜汗，或口臭、便秘、紅腫痘痘？',
      opts: [
        { t: 'Burning palms and soles, significant night sweats', s: '常手腳心發熱、夜間盜汗', v: -2 },
        { t: 'Mild afternoon heat or occasional flushing', s: '偶爾午後燥熱', v: -1 },
        { t: 'No heat sensations at all', s: '完全沒有燥熱感', v: 0 },
        { t: 'Occasional bitter mouth, mild constipation or small pimples', s: '偶爾口苦、便秘或長痘', v: 1 },
        { t: 'Frequent bad breath, constipation, large inflamed acne', s: '常口臭、便秘、紅腫大痘', v: 2 },
      ],
    },
    { id: 'q7', dim: 'ti_han', followUp: false,
      mod: '❄️ Temperature · 溫度（寒）',
      titleEn: 'Are you sensitive to cold? Does cold food cause discomfort?',
      titleZh: '你是不是特別怕冷、手腳冰冷，或一吃冰就不適？',
      opts: [
        { t: 'Cold extremities all year; diarrhoea from cold food', s: '四季手腳冰冷，吃冰就拉', v: -2 },
        { t: 'Slightly cold-sensitive, prone to colds', s: '稍微怕冷，容易感冒', v: -1 },
        { t: 'Balanced — warm hands and feet', s: '完全不怕冷，手足溫暖', v: 0 },
        { t: 'Cold wind causes neck/back stiffness and headache', s: '吹冷風即脖子背痛', v: 1 },
        { t: 'Cold food causes severe cramping that resists touch', s: '受寒後腹部劇烈絞痛拒按', v: 2 },
      ],
    },
    { id: 'q8', dim: 'shi_qi', followUp: true, fuTrigger: -2,
      mod: '💧 Moisture · 水分（濕燥）',
      titleEn: 'How would you describe your skin and body moisture?',
      titleZh: '你的身體皮膚與水分狀況如何？',
      opts: [
        { t: 'Extremely dry skin, persistent dry mouth', s: '皮膚極乾、口乾舌燥', v: -2 },
        { t: 'Often thirsty, skin tends to be dry', s: '常口渴、皮膚偏乾', v: -1 },
        { t: 'Balanced moisture — not dry, not puffy', s: '水潤適中，不乾不腫', v: 0 },
        { t: 'Body feels heavy, prone to water retention', s: '身體沉重、容易水腫', v: 1 },
        { t: 'Always heavy and sluggish, bloated, sticky stools', s: '全身沉重、整天昏沉、大便黏', v: 2 },
      ],
    },
  ];

  // ── Medical safety follow-ups ──────────────────────────────
  var FOLLOW_UPS = {
    q1: {
      title: '🚨 Medical Safety Check · 醫療安全確認',
      question: 'Is your breathlessness worsened when lying flat (must sit up) or accompanied by noticeable ankle swelling?',
      questionZh: '您的喘，是否平躺時加重（必須坐起來），或伴隨腳踝明顯水腫？',
      purpose: 'Distinguishes simple Qi deficiency from possible Heart Failure. If yes, please seek urgent medical attention.',
      purposeZh: '目的：區分單純氣虛與心臟衰竭。如答「是」，請儘快就醫。',
      alert: '⚠️ These symptoms may indicate Heart Failure · 可能提示心臟衰竭。Please seek urgent medical evaluation · 請立即就醫。',
    },
    q4: {
      title: '🚨 Medical Safety Check · 醫療安全確認',
      question: 'Is your stool recently black and tar-like, or do you have frequent stomach pain or vomiting of blood?',
      questionZh: '您最近的大便是否像柏油一樣的黑色？或常胃痛、吐血？',
      purpose: 'Distinguishes Blood deficiency from possible upper GI bleeding.',
      purposeZh: '目的：區分單純血虛與上消化道出血。如答「是」，請儘快就醫。',
      alert: '⚠️ Black tarry stools may indicate serious gastrointestinal bleeding · 可能提示嚴重消化道出血。Seek urgent medical attention · 請緊急就醫。',
    },
    q5: {
      title: '🚨 Medical Safety Check · 醫療安全確認',
      question: 'Is the stabbing pain accompanied by any stroke-like symptoms — one-sided weakness, facial droop, or sudden speech difficulty?',
      questionZh: '定點刺痛是否伴隨中風症狀（單側無力、口角歪斜、說話困難）？',
      purpose: 'Blood stasis with neuro signs needs emergency evaluation.',
      purposeZh: '目的：排除急性腦血管事件。如答「是」，請立即就醫。',
      alert: '⚠️ These symptoms suggest a possible stroke · 可能是中風徵兆。CALL 999 immediately · 請立即撥打 999。',
    },
    q6: {
      title: '🚨 Medical Safety Check · 醫療安全確認',
      question: 'Has your night sweating been accompanied by rapid weight loss without dieting, or unexplained lumps in the neck or armpits?',
      questionZh: '您的夜間盜汗，是否伴隨體重快速減輕或頸部/腋下有不明腫塊？',
      purpose: 'Distinguishes Yin deficiency from possible TB or lymphoma.',
      purposeZh: '目的：區分單純陰虛與肺結核或淋巴腫瘤。如答「是」，請就醫檢查。',
      alert: '⚠️ These symptoms with night sweats require medical investigation · 盜汗伴隨此症狀需就醫排除嚴重疾病。',
    },
    q8: {
      title: '🚨 Medical Safety Check · 醫療安全確認',
      question: 'Besides persistent thirst, have you noticed increased urination AND increased appetite while losing weight without trying?',
      questionZh: '除了口渴，您是否出現尿多、食量變大卻體重減輕？',
      purpose: 'These are classic diabetes symptoms — please check blood glucose.',
      purposeZh: '目的：這是糖尿病典型「三多一少」症狀，請就醫檢查血糖。',
      alert: '⚠️ Classic diabetes symptoms · 糖尿病典型症狀 — please consult a doctor for blood glucose testing · 請就醫檢測血糖。',
    },
  };

  var DIM_META = {
    qi_xu:  { en: 'Qi balance',        zh: '氣之盈虧', neg: 'Qi Deficiency', zhNeg: '氣虛',  pos: 'Qi Excess',       zhPos: '氣盛' },
    qi_zhi: { en: 'Qi stagnation',     zh: '氣機鬱滯', neg: '',               zhNeg: '',      pos: 'Qi Stagnation',   zhPos: '氣滯' },
    pi_wei: { en: 'Spleen & Stomach',  zh: '脾胃',     neg: 'Spleen weakness', zhNeg: '脾虛', pos: 'Stomach heat',    zhPos: '胃熱' },
    xue_xu: { en: 'Blood balance',     zh: '血之盈虧', neg: 'Blood Deficiency', zhNeg: '血虛', pos: 'Blood Heat',      zhPos: '血熱' },
    xue_yu: { en: 'Blood stasis',      zh: '血脈瘀滯', neg: '',               zhNeg: '',      pos: 'Blood Stasis',    zhPos: '血瘀' },
    ti_re:  { en: 'Internal heat',     zh: '內熱',     neg: 'Deficiency heat', zhNeg: '虛熱', pos: 'Excess heat',     zhPos: '實熱' },
    ti_han: { en: 'Cold sensitivity',  zh: '寒象',     neg: 'Yang Deficiency', zhNeg: '陽虛', pos: 'External cold',   zhPos: '外寒' },
    shi_qi: { en: 'Dampness ↔ Dryness',zh: '濕燥',     neg: 'Yin fluid deficiency', zhNeg: '陰虛', pos: 'Damp retention', zhPos: '濕盛' },
  };

  // ── State ──────────────────────────────────────────────────
  var state = { answers: {}, dims: {}, followUpAlerts: [], qIndex: 0 };

  // ── Entry ──────────────────────────────────────────────────
  async function render(el) {
    state = { answers: {}, dims: {}, followUpAlerts: [], qIndex: 0 };
    renderIntro(el);
  }

  function renderIntro(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">AI Constitution Diagnosis · AI 體質診斷</div>' +
      '<h1 class="page-title">Your 8-Dimension TCM Constitution Profile</h1>' +
      '<p class="text-muted mt-1">A quick 8-question assessment maps your TCM constitution across energy, digestion, circulation, temperature, and moisture. ' +
      '<span style="font-family: var(--font-zh);">8 道題目，AI 為您繪出體質地圖（氣血、脾胃、寒熱、濕燥）。</span></p>' +
      '</div>' +

      '<div class="grid-2" style="grid-template-columns: 1fr 1fr; gap: var(--s-5);">' +

      '<div class="card card--pad-lg">' +
      '<div style="font-size: 3rem; margin-bottom: var(--s-3);">📋</div>' +
      '<h3 class="mb-2">How it works · 使用流程</h3>' +
      '<ol style="padding-left: 20px; line-height: var(--leading-relaxed); font-size: var(--text-sm);">' +
      '<li>Answer 8 questions about how you feel (about 3 minutes)</li>' +
      '<li>For some answers, we ask a short safety follow-up</li>' +
      '<li>AI generates a constitution report across 8 dimensions</li>' +
      '<li>Results are sent to a licensed TCM doctor for approval</li>' +
      '<li>You see the doctor\'s comments &amp; personalised suggestions</li>' +
      '</ol>' +
      '</div>' +

      '<div class="card card--pad-lg" style="border-left: 3px solid var(--gold);">' +
      '<div style="font-size: 3rem; margin-bottom: var(--s-3);">🩺</div>' +
      '<h3 class="mb-2">Important · 重要聲明</h3>' +
      '<p class="text-sm text-muted">This assessment is a guide to your general TCM constitution. It is <strong>not a medical diagnosis</strong> and does not replace a consultation with a qualified practitioner or doctor. ' +
      '<br><br><span style="font-family: var(--font-zh);">此測評為體質參考，<strong>不構成醫療診斷</strong>，不能取代持證醫師諮詢。</span></p>' +
      '<p class="text-sm text-muted mt-2">We may ask urgent safety questions during the quiz. If any apply to you, please seek in-person care immediately.</p>' +
      '</div>' +

      '</div>' +

      '<div class="flex gap-2 mt-5">' +
      '<button class="btn btn--primary btn--lg" id="aid-start">Start · 開始測評</button>' +
      '<button class="btn btn--outline btn--lg" onclick="location.hash=\'#/tongue\'">+ Add Tongue Scan First · 先做舌診</button>' +
      '</div>';

    document.getElementById('aid-start').addEventListener('click', function () {
      state.qIndex = 0;
      renderQuestion(el);
    });
  }

  // ── Question screen ────────────────────────────────────────
  function renderQuestion(el) {
    var q = QS[state.qIndex];
    var step = state.qIndex + 1;
    var total = QS.length;
    var pct = Math.round((step / (total + 1)) * 100);

    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">' + q.mod + '</div>' +
      '<div class="flex-between mt-2">' +
      '<div class="text-sm text-muted">Question ' + step + ' of ' + total + ' · 第 ' + step + ' / ' + total + ' 題</div>' +
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

    var saved = state.answers[q.id];
    if (saved !== undefined) {
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
      var meta = DIM_META[k];
      var label = v < 0 ? (meta.neg || meta.en) : v > 0 ? (meta.pos || meta.en) : meta.en;
      var labelZh = v < 0 ? (meta.zhNeg || meta.zh) : v > 0 ? (meta.zhPos || meta.zh) : meta.zh;
      var sign = v > 0 ? '+' + v : v === 0 ? '0' : v;
      var color = v === 0 ? 'var(--stone)' : Math.abs(v) >= 2 ? 'var(--red-seal)' : 'var(--gold)';
      return '<div style="padding: 6px 0; border-bottom: 1px solid var(--border);">' +
        '<div class="flex-between" style="font-size: var(--text-xs);">' +
        '<span style="color: ' + color + '; font-weight: 500;">' + HM.format.esc(label) + '</span>' +
        '<span style="color: ' + color + '; font-family: var(--font-mono);">[' + sign + ']</span>' +
        '</div>' +
        '<div style="font-family: var(--font-zh); font-size: var(--text-xs); color: var(--stone);">' + HM.format.esc(labelZh) + '</div>' +
        '</div>';
    }).join('');
  }

  // ── Follow-up safety check ─────────────────────────────────
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

  // ── Report generation ──────────────────────────────────────
  function buildConstitution() {
    var d = state.dims;
    var patterns = [];
    if (d.qi_xu <= -1 && (d.xue_xu || 0) <= -1) patterns.push({ en: 'Qi & Blood Deficiency', zh: '氣血兩虛' });
    if ((d.qi_xu || 0) >= 1 && (d.ti_re || 0) >= 1) patterns.push({ en: 'Excess Yang with Heat', zh: '陽盛實熱' });
    if ((d.qi_zhi || 0) >= 1 && (d.xue_yu || 0) >= 1) patterns.push({ en: 'Qi Stagnation & Blood Stasis', zh: '氣滯血瘀' });
    if ((d.qi_zhi || 0) >= 2) patterns.push({ en: 'Severe Qi Stagnation', zh: '氣鬱重症' });
    if ((d.pi_wei || 0) <= -1 && (d.shi_qi || 0) >= 1) patterns.push({ en: 'Spleen Deficiency with Dampness', zh: '脾虛濕盛' });
    if ((d.shi_qi || 0) <= -1 || (d.ti_re || 0) <= -1) patterns.push({ en: 'Yin Deficiency', zh: '陰虛' });
    if ((d.ti_han || 0) <= -1) patterns.push({ en: 'Yang Deficiency / Cold', zh: '陽虛寒象' });
    if (!patterns.length) patterns.push({ en: 'Balanced Constitution (Ping He)', zh: '平和質' });
    return patterns;
  }

  function renderReport(el) {
    var patterns = buildConstitution();
    var alerts = state.followUpAlerts || [];

    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Constitution Report · 體質報告</div>' +
      '<h1 class="page-title">Your 8-Dimension Profile</h1>' +
      '<p class="text-muted mt-1">Assessment complete. This report will be sent to a licensed TCM doctor for review.</p>' +
      '</div>' +

      (alerts.length ? renderAlerts(alerts) : '') +

      '<div class="card card--pad-lg mb-4">' +
      '<div class="text-label mb-3">Primary Pattern · 主要證型</div>' +
      patterns.map(function (p) {
        return '<div style="padding: var(--s-3) 0; border-bottom: 1px solid var(--border);">' +
          '<strong style="font-size: var(--text-lg);">' + HM.format.esc(p.en) + '</strong>' +
          '<div class="text-sm" style="font-family: var(--font-zh); color: var(--stone);">' + HM.format.esc(p.zh) + '</div>' +
          '</div>';
      }).join('') +
      '</div>' +

      '<div class="card card--pad-lg mb-4">' +
      '<div class="text-label mb-3">8 Dimensions · 8 維體質</div>' +
      '<div class="grid-auto" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--s-3);">' +
      Object.keys(DIM_META).map(function (k) {
        var v = state.dims[k] !== undefined ? state.dims[k] : 0;
        var meta = DIM_META[k];
        var sign = v > 0 ? '+' + v : v === 0 ? '0' : v;
        var color = v === 0 ? 'var(--sage)' : Math.abs(v) >= 2 ? 'var(--red-seal)' : 'var(--gold)';
        var label = v < 0 ? (meta.neg || meta.en) : v > 0 ? (meta.pos || meta.en) : meta.en + ' (balanced)';
        var labelZh = v < 0 ? (meta.zhNeg || meta.zh) : v > 0 ? (meta.zhPos || meta.zh) : meta.zh + '（平）';
        return '<div style="padding: var(--s-3); border: 1px solid var(--border); border-radius: var(--r-md);">' +
          '<div class="flex-between"><span class="text-xs text-muted">' + meta.en + '</span>' +
          '<span style="color: ' + color + '; font-family: var(--font-mono); font-weight: 500;">[' + sign + ']</span></div>' +
          '<div class="text-sm mt-1" style="color: ' + color + '; font-weight: 500;">' + HM.format.esc(label) + '</div>' +
          '<div class="text-xs text-muted" style="font-family: var(--font-zh);">' + HM.format.esc(labelZh) + '</div>' +
          '</div>';
      }).join('') +
      '</div></div>' +

      '<div class="alert alert--info mb-4">' +
      '<div class="alert-icon">🩺</div>' +
      '<div class="alert-body">' +
      '<strong>Sent for Doctor Review · 已送交醫師審核</strong><br>' +
      'Your results will appear here with the doctor\'s comments and personalised recommendations once reviewed. For immediate concerns, book a consultation. ' +
      '<span style="font-family: var(--font-zh);">結果已送出，醫師審核後您將在此看到個人化建議。</span>' +
      '</div></div>' +

      '<div class="flex gap-2 flex-wrap">' +
      '<button class="btn btn--primary btn--lg" id="aid-save">Submit for Doctor Review · 送交醫師</button>' +
      '<button class="btn btn--outline btn--lg" onclick="location.hash=\'#/book\'">Book Full Consultation · 預約深度問診</button>' +
      '<button class="btn btn--ghost" id="aid-restart">Restart · 重新測評</button>' +
      '</div>';

    document.getElementById('aid-save').addEventListener('click', function () { saveReport(el, patterns, alerts); });
    document.getElementById('aid-restart').addEventListener('click', function () { render(el); });
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

  async function saveReport(el, patterns, alerts) {
    var btn = document.getElementById('aid-save');
    btn.disabled = true;
    btn.textContent = 'Submitting… · 送出中…';
    // Shape to fit the existing questionnaires schema (symptoms / lifestyle /
    // diet / discomfort_areas). We pack the AI report into "symptoms" so the
    // rest of the table stays unchanged.
    var payload = {
      symptoms: {
        kind:          'ai_constitution_v1',
        answers:       state.answers,
        dimensions:    state.dims,
        patterns:      patterns,
        safety_alerts: alerts,
        submitted_at:  new Date().toISOString(),
      },
    };
    try {
      await HM.api.patient.saveQuestionnaire(payload);
      HM.ui.toast('Submitted · 已送交醫師審核', 'success', 4000);
      btn.textContent = '✓ Submitted · 已送出';
      // Keep the report visible but disabled so the patient can still see it
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Submit for Doctor Review · 送交醫師';
      HM.ui.toast('Could not submit: ' + (e.message || 'Error'), 'danger');
    }
  }

  // ── Scoped styles ──────────────────────────────────────────
  function injectStyle() {
    if (document.getElementById('aid-style')) return;
    var s = document.createElement('style');
    s.id = 'aid-style';
    s.textContent =
      '.aid-progress{height:4px;background:var(--border);border-radius:2px;margin-top:var(--s-2);overflow:hidden;}' +
      '.aid-progress-fill{height:100%;background:var(--gold);transition:width .3s ease;}' +
      '.aid-opt{display:block;width:100%;text-align:left;padding:var(--s-4);margin-bottom:var(--s-2);border:1px solid var(--border);background:var(--bg);border-radius:var(--r-md);cursor:pointer;transition:all .15s ease;font-family:inherit;}' +
      '.aid-opt:hover{border-color:var(--gold);background:var(--washi);}' +
      '.aid-opt--selected{border-color:var(--gold);background:var(--washi);border-width:2px;padding:calc(var(--s-4) - 1px);}' +
      '.aid-opt-en{font-size:var(--text-sm);color:var(--ink);line-height:1.5;margin-bottom:4px;}' +
      '.aid-opt-zh{font-family:var(--font-zh);font-size:var(--text-xs);color:var(--stone);line-height:1.5;}';
    document.head.appendChild(s);
  }

  HM.patientPanels.aiDiagnosis = { render: render };
})();
