/**
 * Doctor Patient Reviews — unified queue for tongue diagnoses + AI
 * constitution questionnaires.
 *
 * Both flows share the same clinical goal: review what the AI detected,
 * adjust it, comment, approve. Since tongue findings are an input to the
 * overall constitution assessment, opening either type of review also
 * loads any recent reports from the OTHER type for the same patient —
 * so the doctor sees the full picture at once.
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  // Bilingual labels for the 10 constitution dimensions (matches DIMS in patient ai-diagnosis.js)
  var DIM_LABELS = {
    qi_xu:     { en: 'Qi Level',         zh: '氣之盈虧' },
    qi_zhi:    { en: 'Qi Stagnation',    zh: '氣滯度' },
    pi_wei:    { en: 'Digestion',        zh: '脾胃虛實' },
    xue_xu:    { en: 'Blood Level',      zh: '血之盈虧' },
    xue_yu:    { en: 'Blood Stasis',     zh: '血瘀度' },
    ti_re:     { en: 'Heat',             zh: '體熱虛實' },
    ti_han:    { en: 'Cold',             zh: '體寒虛實' },
    shi_qi:    { en: 'Moisture',         zh: '濕氣度' },
    shui_mian: { en: 'Sleep',            zh: '睡眠品質' },
    min_li:    { en: 'Immunity',         zh: '免疫敏感' },
  };

  var HERB_MAP = {
    'Qi Deficiency':            { herbs:['黃耆 Huang Qi','黨參 Dang Shen','白朮 Bai Zhu','大棗 Da Zao','炙甘草 Zhi Gan Cao'], foods:['山藥 Yam','紅棗 Red dates','小米粥 Millet congee','雞湯 Chicken broth'], avoid:'Raw & cold foods, excessive sweating · 忌生冷食物' },
    'Blood Deficiency':         { herbs:['熟地黃 Shu Di','當歸 Dang Gui','白芍 Bai Shao','阿膠 E Jiao','龍眼肉 Long Yan'], foods:['豬肝 Pork liver','黑芝麻 Black sesame','菠菜 Spinach','枸杞 Wolfberry'], avoid:'Spicy & drying foods · 忌辛辣燥熱' },
    'Blood Stasis':             { herbs:['丹參 Dan Shen','川芎 Chuan Xiong','桃仁 Tao Ren','紅花 Hong Hua','益母草 Yi Mu Cao'], foods:['山楂 Hawthorn','黑木耳 Black fungus','醋 Vinegar','玫瑰花茶 Rose tea'], avoid:'Cold food & prolonged sitting · 忌生冷久坐' },
    'Qi Stagnation':            { herbs:['柴胡 Chai Hu','香附 Xiang Fu','玫瑰花 Mei Gui','合歡皮 He Huan','鬱金 Yu Jin'], foods:['柑橘 Citrus','茉莉花茶 Jasmine tea','薄荷 Mint','山楂 Hawthorn'], avoid:'Isolation & overthinking · 避免獨處及過度思慮' },
    'Spleen Deficiency':        { herbs:['茯苓 Fu Ling','白朮 Bai Zhu','山藥 Shan Yao','薏苡仁 Yi Yi Ren','蓮子 Lian Zi'], foods:['南瓜 Pumpkin','小米 Millet','蓮藕 Lotus root','豆腐 Tofu'], avoid:'Cold food & irregular meals · 忌生冷及飲食不規律' },
    'Deficiency Heat (Yin Xu)': { herbs:['麥冬 Mai Dong','石斛 Shi Hu','玉竹 Yu Zhu','百合 Bai He','枸杞 Gou Qi'], foods:['雪梨 Pear','銀耳 White fungus','蜂蜜 Honey','豆漿 Soy milk'], avoid:'Spicy & fried foods, staying up late · 忌辛辣煎炸及熬夜' },
    'Deficiency Cold (Yang Xu)':{ herbs:['附子 Fu Zi','肉桂 Rou Gui','乾薑 Gan Jiang','杜仲 Du Zhong','淫羊藿 Yin Yang Huo'], foods:['薑茶 Ginger tea','核桃 Walnut','韭菜 Chives','羊肉 Lamb'], avoid:'Cold environments & raw foods · 忌受寒及生冷食物' },
    'Dampness / Phlegm':        { herbs:['蒼朮 Cang Zhu','茯苓 Fu Ling','半夏 Ban Xia','陳皮 Chen Pi','薏苡仁 Yi Yi Ren'], foods:["薏仁湯 Job's tears soup",'冬瓜 Winter melon','玉米鬚茶 Corn silk tea','綠豆 Mung bean'], avoid:'Dairy, fried food & alcohol · 忌奶製品、煎炸及酒精' },
    'Allergic Constitution':    { herbs:['黃耆 Huang Qi','防風 Fang Feng','白朮 Bai Zhu','蟬蛻 Chan Tui','烏梅 Wu Mei'], foods:['蜂蜜水 Honey water','生薑茶 Ginger tea','紅棗 Red dates'], avoid:'Known allergens, cold & dusty environments · 忌已知過敏原' },
    'Poor Sleep':               { herbs:['酸棗仁 Suan Zao Ren','柏子仁 Bai Zi Ren','夜交藤 Ye Jiao Teng','合歡花 He Huan Hua','龍眼肉 Long Yan'], foods:['百合蓮子湯 Lily & lotus soup','牛奶 Warm milk','核桃 Walnut'], avoid:'Caffeine after 2pm, screen time before bed · 忌下午後咖啡因及睡前使用電子設備' },
    'Balanced Constitution':    { herbs:['枸杞 Gou Qi','菊花 Ju Hua','靈芝 Ling Zhi','大棗 Da Zao'], foods:['均衡飲食 Balanced diet','時令蔬果 Seasonal vegetables & fruit'], avoid:'Overworking & irregular sleep · 忌過勞及作息不規律' },
  };

  var state = { filter: 'pending', type: 'all' };

  async function render(el) {
    state = { filter: 'pending', type: 'all' };

    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Patient Reviews · 患者審核</div>' +
      '<h1 class="page-title">AI Reviews — Tongue &amp; Constitution</h1>' +
      '<p class="text-muted mt-1">Combined queue for AI tongue analyses and 10-dimension constitution reports. Opening either kind shows any recent reports from the other for the same patient — so you always see the full picture. ' +
      '<span style="font-family: var(--font-zh);">舌診與體質報告已合併。審核時同時顯示患者近期的另一類資料。</span></p>' +
      '</div>' +

      '<div class="filter-bar mb-3" id="rv-status">' +
      chip('status', 'pending', '⏳ Pending · 待審核', true) +
      chip('status', 'mine', '✓ Reviewed by Me · 我已審核') +
      chip('status', 'all', 'All · 全部') +
      '</div>' +

      '<div class="filter-bar mb-4" id="rv-type">' +
      chip('type', 'all', 'All Types · 全部類型', true) +
      chip('type', 'constitution', '🧭 Constitution · 體質') +
      chip('type', 'tongue', '👅 Tongue · 舌診') +
      '</div>' +

      '<div id="rv-list"></div>';

    document.querySelectorAll('#rv-status .filter-chip').forEach(function (c) {
      c.addEventListener('click', function () {
        document.querySelectorAll('#rv-status .filter-chip').forEach(function (x) { x.classList.remove('is-active'); });
        c.classList.add('is-active');
        state.filter = c.getAttribute('data-value');
        load();
      });
    });

    document.querySelectorAll('#rv-type .filter-chip').forEach(function (c) {
      c.addEventListener('click', function () {
        document.querySelectorAll('#rv-type .filter-chip').forEach(function (x) { x.classList.remove('is-active'); });
        c.classList.add('is-active');
        state.type = c.getAttribute('data-value');
        load();
      });
    });

    await load();
  }

  function chip(group, value, label, active) {
    return '<button class="filter-chip' + (active ? ' is-active' : '') + '" data-group="' + group + '" data-value="' + value + '">' + label + '</button>';
  }

  async function load() {
    var container = document.getElementById('rv-list');
    HM.state.loading(container);
    try {
      // Always fetch both — we need constitutions to know which
      // tongue rows to fold into combined cards, regardless of the
      // current type filter. Filtering is applied at the end.
      var results = await Promise.all([
        HM.api.doctor.listConstitutionReviews(state.filter),
        HM.api.doctor.listTongueReviews(state.filter),
      ]);
      var constitutions = (results[0] && results[0].data) || [];
      var tongues       = (results[1] && results[1].data) || [];

      // Index tongues by id so we can fold matched ones into their
      // constitution sibling. The patient submits both as one
      // session; the questionnaire payload carries tongue_diagnosis_id
      // pointing at the tongue row, so we have a direct join key.
      var tongueById = {};
      tongues.forEach(function (t) { tongueById[t.id] = t; });
      var foldedTongueIds = {};

      var items = [];
      constitutions.forEach(function (c) {
        var matchedTongue = c.tongue_diagnosis_id ? tongueById[c.tongue_diagnosis_id] : null;
        var report = matchedTongue && matchedTongue.constitution_report ? matchedTongue.constitution_report : {};
        var tongueConst = report.constitution || c.tongue_constitution || {};
        if (matchedTongue) foldedTongueIds[matchedTongue.id] = true;

        items.push({
          // "combined" when both tongue + questionnaire submitted; the
          // single card replaces two separate ones in the queue.
          kind: matchedTongue ? 'combined' : 'constitution',
          id: c.id,
          patient_id: c.patient_id,
          patient_name: c.patient_name || null,
          patient_email: c.patient_email,
          created_at: c.created_at,
          review_status: c.review_status,
          extra: {
            patterns: c.patterns || [],
            safety_alerts: c.safety_alerts || [],
            health_concerns: c.health_concerns || null,
            tongue_id: matchedTongue ? matchedTongue.id : (c.tongue_diagnosis_id || null),
            image_url: matchedTongue ? matchedTongue.image_url : (c.tongue_image_url || null),
            constitution_en: tongueConst.name_en || null,
            constitution_zh: tongueConst.name_zh || null,
            health_score: matchedTongue ? matchedTongue.health_score : (c.tongue_health_score || null),
          },
        });
      });

      // Standalone tongue rows — those NOT folded into a constitution
      // (patient skipped the questionnaire, or hasn't submitted it
      // yet). They keep their own card.
      tongues.forEach(function (t) {
        if (foldedTongueIds[t.id]) return;
        var patient = t.patient || {};
        var pp = patient.patient_profile || {};
        var report = t.constitution_report || {};
        var c = report.constitution || {};
        items.push({
          kind: 'tongue',
          id: t.id,
          patient_id: t.patient_id,
          patient_name: pp.full_name || null,
          patient_email: patient.email || null,
          created_at: t.created_at,
          review_status: t.review_status,
          extra: {
            image_url: t.image_url,
            constitution_en: c.name_en || null,
            constitution_zh: c.name_zh || null,
            health_score: t.health_score,
          },
        });
      });

      // Type filter — combined cards count as BOTH so the doctor
      // sees them whether they filter by tongue or constitution.
      if (state.type === 'tongue') {
        items = items.filter(function (it) { return it.kind === 'tongue' || it.kind === 'combined'; });
      } else if (state.type === 'constitution') {
        items = items.filter(function (it) { return it.kind === 'constitution' || it.kind === 'combined'; });
      }

      items.sort(function (a, b) {
        return (new Date(b.created_at)) - (new Date(a.created_at));
      });

      if (!items.length) {
        HM.state.empty(container, {
          icon: '🩺',
          title: state.filter === 'pending' ? 'Nothing pending · 暫無待審核' : 'No results',
          text: state.filter === 'pending' ? 'All AI reviews are up to date.' : 'Try a different filter.',
        });
        return;
      }
      container.innerHTML = '';
      items.forEach(function (it) { container.appendChild(renderCard(it)); });
    } catch (e) { HM.state.error(container, e); }
  }

  function renderCard(it) {
    var card = document.createElement('div');
    card.className = 'card mb-3';

    var statusBadge = {
      pending:       '<span class="badge">⏳ Pending</span>',
      approved:      '<span class="badge badge--success">✓ Approved</span>',
      needs_changes: '<span class="badge badge--danger">Needs Changes</span>',
    }[it.review_status || 'pending'];

    // Type badge(s) — combined cards show BOTH so the doctor sees at
    // a glance that this is a full session (tongue + questionnaire).
    var tongueBadge = '<span class="badge" style="background:rgba(184,150,90,.15);color:var(--gold);">👅 Tongue · 舌診</span>';
    var constBadge  = '<span class="badge" style="background:rgba(122,140,114,.15);color:var(--sage);">🧭 Constitution · 體質</span>';
    var typeBadge;
    if      (it.kind === 'combined')     typeBadge = tongueBadge + ' ' + constBadge;
    else if (it.kind === 'tongue')       typeBadge = tongueBadge;
    else                                 typeBadge = constBadge;

    // Summary line(s) — combined cards show both summaries on
    // separate rows so the doctor can scan tongue + constitution
    // side by side before opening the modal.
    var summary;
    var x = it.extra || {};
    var patterns = x.patterns || [];
    var alerts = x.safety_alerts || [];
    var primaryConstitution = patterns.length ? (patterns[0].l || patterns[0].c || '—') : '—';
    var tongueLine =
      '<div class="text-sm" style="margin-top:2px;">' +
      '<span class="text-muted">Tongue · 舌診:</span> ' +
      (x.constitution_en
        ? '<strong>' + HM.format.esc(x.constitution_en) + '</strong>'
        : 'Analysis complete') +
      (x.health_score != null ? ' · <span class="text-muted">Health ' + x.health_score + '/100</span>' : '') +
      '</div>';
    var constLine =
      '<div class="text-sm" style="margin-top:2px;">' +
      '<span class="text-muted">Constitution · 體質:</span> ' +
      '<strong>' + HM.format.esc(primaryConstitution) + '</strong>' +
      (alerts.length ? ' · <span style="color:var(--red-seal);">⚠️ ' + alerts.length + ' alert(s)</span>' : '') +
      '</div>';
    var concernsLine = x.health_concerns
      ? '<div class="text-xs text-muted mt-1" style="font-style:italic;">🩺 "' +
        HM.format.esc(HM.format.truncate(x.health_concerns, 90)) + '"</div>'
      : '';

    if (it.kind === 'combined')      summary = tongueLine + constLine + concernsLine;
    else if (it.kind === 'tongue')   summary = tongueLine;
    else                              summary = constLine + concernsLine;

    var patientLabel = HM.format.esc(HM.format.patientLabel(it)) + (it.patient_email && !it.patient_name ? ' · ' + HM.format.esc(it.patient_email) : '');

    // Thumbnail: tongue photo if available (combined or tongue-only);
    // 🧭 placeholder for constitution-only (no tongue submitted).
    var thumbUrl  = (it.kind === 'tongue' || it.kind === 'combined') ? (x.image_url || null) : null;
    var thumbIcon = (it.kind === 'constitution') ? '🧭' : '👅';
    var imgHtml = thumbUrl
      ? HM.format.img(thumbUrl, {
          style: 'width:70px;height:70px;border-radius:var(--r-md);border:1px solid var(--border);flex-shrink:0;',
          icon: thumbIcon,
          title: 'Photo unavailable · 圖片已不存在',
        })
      : '<div style="width:70px;height:70px;border-radius:var(--r-md);background:var(--washi);display:flex;align-items:center;justify-content:center;font-size:1.8rem;flex-shrink:0;color:var(--stone);">' + thumbIcon + '</div>';

    card.innerHTML = '<div class="flex gap-3" style="align-items:flex-start;">' +
      imgHtml +
      '<div style="flex:1;">' +
      '<div class="flex gap-2 mb-1" style="align-items:center;flex-wrap:wrap;">' +
      typeBadge +
      statusBadge +
      '<span class="text-xs text-muted">' + HM.format.datetime(it.created_at) + '</span>' +
      '</div>' +
      '<div class="card-title">' + patientLabel + '</div>' +
      summary +
      '</div>' +
      '<div style="text-align:right;display:flex;flex-direction:column;gap:6px;">' +
      '<button class="btn btn--primary btn--sm" data-review>Review · 審核</button>' +
      '<button class="btn btn--outline btn--sm" data-chat>💬 Chat · 對話</button>' +
      '</div>' +
      '</div>';

    card.querySelector('[data-review]').addEventListener('click', function () {
      // Combined cards open the constitution modal — it loads the
      // linked tongue scan + Wuyun Liuqi inline (full deep analysis,
      // not just a thumbnail), so the doctor reviews everything in
      // one place. Standalone tongue cards open the tongue modal.
      if (it.kind === 'tongue')          openTongueModal(it.id, it.patient_id);
      else if (it.kind === 'combined')   openConstitutionModal(it.id, it.patient_id, it.extra && it.extra.tongue_id);
      else                                openConstitutionModal(it.id, it.patient_id);
    });
    // Opens/creates the chat thread for this patient and jumps the
    // doctor to Messages so they can clarify symptoms before
    // approving or prescribing.
    card.querySelector('[data-chat]').addEventListener('click', async function (ev) {
      ev.stopPropagation();
      try {
        var r = await HM.api.chat.openThread({ patient_id: it.patient_id });
        location.hash = '#/messages/' + r.thread.id;
      } catch (e) { HM.ui.toast(e.message || 'Could not open chat', 'danger'); }
    });
    return card;
  }

  // ═══════════════════════════════════════════════════════════
  //  CONSTITUTION REVIEW MODAL  (with tongue context from same patient)
  // ═══════════════════════════════════════════════════════════
  async function openConstitutionModal(id, patientId, linkedTongueId) {
    var loading = HM.ui.modal({ size: 'xl', title: 'Loading…', content: '<div class="state state--loading"><div class="state-icon"></div></div>' });

    var res, tongueRes, patientRes, linkedTongueRes = null;
    try {
      // Fetch the report + related tongue scans + patient profile (for DOB-
      // based Wuyun Liuqi analysis) in parallel.
      // When the doctor opened a "combined" card, ALSO fetch the
      // linked tongue's full review payload (with deep three-burner /
      // holographic / six-meridian analysis) so we can inline it
      // instead of just the mini thumbnail.
      var promises = [
        HM.api.doctor.getConstitutionReview(id),
        HM.api.doctor.patientTongue(patientId).catch(function () { return { data: [] }; }),
        HM.api.doctor.patientConsults(patientId).catch(function () { return { patient: null }; }),
      ];
      if (linkedTongueId) {
        promises.push(HM.api.doctor.getTongueReview(linkedTongueId).catch(function () { return null; }));
      }
      var results = await Promise.all(promises);
      res = results[0];
      tongueRes = results[1];
      patientRes = results[2];
      linkedTongueRes = results[3] || null;
    } catch (e) {
      loading.close();
      HM.ui.toast(e.message || 'Failed to load', 'danger');
      return;
    }
    loading.close();

    // Defensive key lookup — different Laravel serialisation configs may
    // emit either `patient_profile` (snake_case, our default) or
    // `patientProfile` (camelCase, if SnakeCaseHydration is off).
    var pRaw = (patientRes && patientRes.patient) || {};
    var patientProfile = pRaw.patient_profile || pRaw.patientProfile || {};
    var patientDob = patientProfile.birth_date || patientProfile.dob || null;

    var qRow = res.questionnaire;
    var report = qRow.report || {};
    var patterns = report.patterns || [];
    var healthConcerns = (report.health_concerns || '').trim();
    var dims = report.dimensions || {};
    var alerts = report.safety_alerts || [];
    var primaryType = patterns.length ? (patterns[0].l || 'Balanced Constitution') : 'Balanced Constitution';
    var existingAdvice = report.doctor_advice || {};
    var template = HERB_MAP[primaryType] || HERB_MAP['Balanced Constitution'];

    var advice = {
      herbs: existingAdvice.herbs && existingAdvice.herbs.length ? existingAdvice.herbs : template.herbs.slice(),
      foods: existingAdvice.foods && existingAdvice.foods.length ? existingAdvice.foods : template.foods.slice(),
      avoid: existingAdvice.avoid || template.avoid,
      tips:  existingAdvice.tips && existingAdvice.tips.length ? existingAdvice.tips : defaultTips(dims),
    };
    var existingComment = report.doctor_comment || '';

    // Build the tongue-context sidebar from the patient's recent tongue scans
    var tongueScans = (tongueRes && tongueRes.data) ? tongueRes.data.slice(0, 3) : [];

    // ── Combined synthesis: DOB + Constitution + Tongue → unified plan
    // Run before the HTML is built so the panel sits at the top.
    var wylAnalysis = (window.HM && HM.wuyunLiuqi && HM.wuyunLiuqi.analyze)
      ? HM.wuyunLiuqi.analyze(patientDob)
      : null;
    var linkedTongueReport = (linkedTongueRes && linkedTongueRes.diagnosis && linkedTongueRes.diagnosis.constitution_report) || null;
    var synthesis = (window.HM && HM.synthesis && HM.synthesis.combine)
      ? HM.synthesis.combine({
          wyl:          wylAnalysis,
          constitution: report,
          tongue:       linkedTongueReport,
        })
      : null;

    var content =
      // Wuyun Liuqi slot — populated after the modal is mounted so the
      // DOB-based analysis + today's environmental qi sit above the
      // review form for immediate clinical context.
      '<div id="rvw-wyl-const" class="mb-4"></div>' +

      // Combined synthesis panel — the headline summary that fuses
      // all three diagnostic sources into a single ranked plan.
      // Hidden when there's nothing to synthesise (no themes detected).
      renderSynthesisPanel(synthesis) +

      '<div class="grid-2" style="gap: var(--s-5); align-items: start;">' +

      // ─── LEFT — patient report + tongue context ───
      '<div>' +

      // Patient's own words — shown FIRST so the doctor reads the
      // context before interpreting the AI dimensions. Gold border so
      // it stands out from the auto-generated report below.
      (healthConcerns
        ? '<div class="text-label mb-2">🩺 Patient\'s Concerns · 患者主訴</div>' +
          '<div class="card mb-3" style="padding: var(--s-4); background: rgba(201,146,42,.06); border-left: 3px solid var(--gold);">' +
          '<div class="text-sm" style="white-space: pre-wrap;">' + HM.format.esc(healthConcerns) + '</div>' +
          '</div>'
        : '') +

      '<div class="text-label mb-2">🧭 Constitution Report · 體質報告</div>' +
      '<div class="card" style="padding: var(--s-4);">' +
      (patterns.length ? (
        '<div class="mb-3">' +
        patterns.map(function (p) {
          var col = { green:'var(--sage)', yellow:'var(--gold)', red:'var(--red-seal)', blue:'#6699bb' }[p.col] || 'var(--stone)';
          return '<span style="display:inline-block;margin:2px 4px 2px 0;padding:4px 10px;font-size:11px;border-radius:999px;background:' + col + '22;color:' + col + ';border:1px solid ' + col + '66;">' +
            HM.format.esc(p.l || '') + (p.c ? ' · ' + HM.format.esc(p.c) : '') + '</span>';
        }).join('') +
        '</div>'
      ) : '') +

      '<div class="text-xs text-muted mb-2">10 Dimensions · 十維體質</div>' +
      '<table style="width:100%;font-size:var(--text-xs);">' +
      Object.keys(dims).map(function (k) {
        var v = dims[k];
        var meta = DIM_LABELS[k] || { en: k, zh: '' };
        var color = v === 0 ? 'var(--sage)' : Math.abs(v) >= 2 ? 'var(--red-seal)' : 'var(--gold)';
        return '<tr>' +
          '<td style="padding:3px 0;">' +
          '<span style="font-family:var(--font-zh);color:var(--ink);">' + meta.zh + '</span>' +
          '<span class="text-muted" style="margin-left:6px;font-size:10px;">' + meta.en + '</span>' +
          '</td>' +
          '<td style="padding:3px 0;text-align:right;color:' + color + ';font-weight:500;font-family:var(--font-mono);">[' + (v > 0 ? '+' + v : v) + ']</td>' +
          '</tr>';
      }).join('') +
      '</table>' +

      (alerts.length ? (
        '<div class="alert alert--danger mt-3"><div class="alert-body text-xs">' +
        '<strong>⚠️ Safety Alerts</strong><br>' +
        alerts.map(function (a) { return '• ' + HM.format.esc(a.alert || ''); }).join('<br>') +
        '</div></div>'
      ) : '') +

      '</div>' +

      // Linked tongue — when this constitution review came from a
      // combined session (patient submitted tongue + questionnaire
      // together), inline the FULL tongue analysis here instead of
      // just a mini thumbnail. Includes photo, findings, AI advice,
      // and the deep three-burner / holographic / six-meridian /
      // ascending-descending analysis.
      (function () {
        if (! linkedTongueRes || ! linkedTongueRes.diagnosis) {
          // No matched tongue — fall back to the historical mini list.
          return '<div class="text-label mt-4 mb-2">👅 Recent Tongue Scans · 近期舌診</div>' +
            (tongueScans.length
              ? '<div class="card" style="padding: var(--s-3);">' +
                tongueScans.map(renderMiniTongue).join('') +
                '</div>'
              : '<div class="card" style="padding: var(--s-3);"><p class="text-xs text-muted" style="margin:0;">No tongue scans on file for this patient.</p></div>');
        }
        var lt = linkedTongueRes.diagnosis;
        var ltReport = lt.constitution_report || {};
        var ltConst = ltReport.constitution || {};
        var ltFindings = ltReport.findings || [];
        var ltRecs = ltReport.recommendations || [];
        var ltStatusBadge = {
          pending:       '<span class="badge">⏳ Pending</span>',
          approved:      '<span class="badge badge--success">✓ Approved</span>',
          needs_changes: '<span class="badge badge--danger">Needs Changes</span>',
        }[lt.review_status || 'pending'] || '';

        return '<div class="text-label mt-4 mb-2">👅 Linked Tongue Diagnosis · 配對舌診 ' + ltStatusBadge + '</div>' +
          '<div class="card" style="padding: var(--s-3);">' +
          (lt.image_url
            ? HM.format.img(lt.image_url, {
                style: 'width:100%;aspect-ratio:1;border-radius:var(--r-md);border:1px solid var(--border);margin-bottom:var(--s-3);',
                icon: '👅',
                title: 'Photo unavailable · 圖片已不存在',
              })
            : '') +
          (ltConst.name_en ? '<div class="card-title">' + HM.format.esc(ltConst.name_en) + '</div>' : '') +
          (ltConst.name_zh ? '<div class="text-sm text-muted" style="font-family: var(--font-zh);">' + HM.format.esc(ltConst.name_zh) + '</div>' : '') +
          (lt.health_score != null ? '<div class="text-sm mt-2">Health Score: <strong>' + lt.health_score + '/100</strong></div>' : '') +

          (ltFindings.length ? ('<div class="text-label mt-4 mb-2">Findings · 望舌所見</div>' +
            '<ul class="text-xs text-muted" style="list-style: none; padding: 0;">' +
            ltFindings.map(renderFindingRow).join('') + '</ul>') : '') +

          (ltRecs.length ? ('<div class="text-label mt-4 mb-2">AI Lifestyle Suggestions · AI 養生建議</div>' +
            '<ul class="text-xs text-muted" style="padding-left: 18px;">' +
            ltRecs.map(function (r) { return '<li style="margin-bottom: 4px;">' + HM.format.esc(r) + '</li>'; }).join('') +
            '</ul>') : '') +

          // Deep Yin Modern Tongue Diagnosis analysis — three-burner,
          // holographic body map, six meridians, clinical patterns,
          // ascending/descending direction.
          renderDeepTongueAnalysis(ltReport) +

          // Quick actions for the linked tongue review — doctor can
          // approve / request changes on the tongue right from the
          // constitution modal so they don't have to bounce.
          (lt.review_status === 'pending'
            ? '<div class="flex gap-2 mt-3">' +
              '<button type="button" class="btn btn--danger btn--sm" id="lt-needs-changes">Tongue: Request Changes</button>' +
              '<button type="button" class="btn btn--primary btn--sm" id="lt-approve" style="flex:1;">✓ Approve Tongue · 批准舌診</button>' +
              '</div>'
            : '<div class="text-xs text-muted mt-3" style="text-align:center;">Tongue review already completed.</div>') +

          '</div>';
      })() +

      '</div>' +

      // ─── RIGHT — editable doctor plan ───
      '<form id="cr-form">' +

      '<div class="text-label mb-2">Your Comment · 醫師備註</div>' +
      '<textarea name="doctor_comment" class="field-input field-input--boxed" rows="4" placeholder="Notes for the patient — what you confirm, what you adjust, what to watch for…">' + HM.format.esc(existingComment) + '</textarea>' +

      '<div class="text-label mt-4 mb-2">🌿 Herbs (template from <em>' + HM.format.esc(primaryType) + '</em>)</div>' +
      '<textarea id="cr-herbs" class="field-input field-input--boxed" rows="3">' + HM.format.esc(advice.herbs.join(', ')) + '</textarea>' +
      '<div class="text-xs text-muted">Comma-separated. Edit freely — patient only sees what you leave here.</div>' +

      '<div class="text-label mt-4 mb-2">🍱 Beneficial Foods</div>' +
      '<textarea id="cr-foods" class="field-input field-input--boxed" rows="3">' + HM.format.esc(advice.foods.join(', ')) + '</textarea>' +

      '<div class="text-label mt-4 mb-2">❌ Avoid</div>' +
      '<input id="cr-avoid" class="field-input field-input--boxed" value="' + HM.format.esc(advice.avoid) + '">' +

      '<div class="text-label mt-4 mb-2">💡 Lifestyle Tips</div>' +
      '<div id="cr-tips">' + advice.tips.map(tipRow).join('') + '</div>' +
      '<button type="button" class="btn btn--ghost btn--sm" id="cr-add-tip">+ Add tip</button>' +

      '<div class="alert alert--info mt-4"><div class="alert-body text-xs">' +
      'The patient currently sees only the dimensions and constitution pills. Your advice becomes visible on their report after you click Approve. ' +
      '<span style="font-family: var(--font-zh);">批准後患者才會看到您編輯的建議。</span>' +
      '</div></div>' +

      '<div data-general-error class="alert alert--danger" style="display:none;"></div>' +

      '<div class="flex gap-2 mt-4 flex-wrap">' +
      '<button type="button" class="btn btn--outline btn--sm" id="cr-prescribe">💊 Prescribe Medicine · 開立處方</button>' +
      '</div>' +

      '<div class="flex gap-2 mt-2">' +
      '<button type="button" class="btn btn--danger btn--sm" data-decision="needs_changes">Request Changes · 要求修改</button>' +
      '<button type="submit" class="btn btn--primary btn--block" data-decision="approved">✓ Approve &amp; Send to Patient · 批准並發送</button>' +
      '</div>' +
      '</form>' +

      '</div>';

    var m = HM.ui.modal({
      size: 'xl',
      title: 'Review Constitution Report · 審核體質報告',
      content: content,
    });

    // Mount the Wuyun Liuqi dual card (innate + today's environmental qi)
    // inside the modal. Silently renders nothing if DOB isn't on file.
    if (window.HM && HM.wuyunLiuqi) {
      HM.wuyunLiuqi.mountDual(m.element.querySelector('#rvw-wyl-const'), patientDob);
    }

    var form = m.element.querySelector('#cr-form');

    m.element.querySelector('#cr-add-tip').addEventListener('click', function () {
      m.element.querySelector('#cr-tips').insertAdjacentHTML('beforeend', tipRow({ icon: '💡', en: '', zh: '' }));
    });
    m.element.querySelector('#cr-tips').addEventListener('click', function (e) {
      if (e.target.matches('[data-remove-tip]')) e.target.closest('.cr-tip-row').remove();
    });

    m.element.querySelector('[data-decision="needs_changes"]').addEventListener('click', function () {
      submitConstitution(form, m, id, 'needs_changes');
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitConstitution(form, m, id, 'approved');
    });

    // Inline tongue-review actions (only present on combined sessions
    // where linkedTongueRes was loaded). One-click approve / needs-
    // changes for the linked tongue without leaving the modal.
    var ltApprove = m.element.querySelector('#lt-approve');
    var ltChanges = m.element.querySelector('#lt-needs-changes');
    if (ltApprove && linkedTongueRes && linkedTongueRes.diagnosis) {
      var ltId = linkedTongueRes.diagnosis.id;
      var disableLtButtons = function () {
        ltApprove.disabled = true; ltChanges.disabled = true;
      };
      var submitLt = async function (decision) {
        disableLtButtons();
        try {
          await HM.api.doctor.reviewTongue(ltId, {
            decision: decision,
            comment: '',
            medicine_suggestions: linkedTongueRes.diagnosis.medicine_suggestions || [],
          });
          HM.ui.toast('Tongue ' + (decision === 'approved' ? 'approved' : 'flagged for changes') + ' · 舌診已處理', 'success');
          // Reflect new state inline so the doctor sees it without
          // a refresh.
          var box = ltApprove.parentNode;
          box.outerHTML = '<div class="text-xs text-muted mt-3" style="text-align:center;">✓ Tongue review submitted.</div>';
        } catch (err) {
          HM.ui.toast(err.message || 'Tongue review failed', 'danger');
          ltApprove.disabled = false; ltChanges.disabled = false;
        }
      };
      ltApprove.addEventListener('click', function () { submitLt('approved'); });
      ltChanges.addEventListener('click', function () { submitLt('needs_changes'); });
    }

    // Prescribe — opens a second modal, seeded with the primary pattern's herbs
    m.element.querySelector('#cr-prescribe').addEventListener('click', function () {
      var seed = (template.herbs || []).map(function (h) {
        // Herbs like "黃耆 Huang Qi" — use the leading Chinese as drug_name.
        var parts = h.split(/\s+/);
        return { drug_name: parts[0] || h, note: h, quantity: 10, unit: 'g' };
      });
      openPrescribeModal({
        patient_id: qRow.patient_id,
        source_type: 'constitution',
        source_id: qRow.id,
        default_diagnosis: (patterns[0] ? (patterns[0].c || patterns[0].l) : ''),
        seed_items: seed,
      });
    });
  }

  /**
   * Renders the deep Yin-Modern-Tongue-Diagnosis findings block shown to
   * the doctor during a tongue review. Surfaces three-burner zone status,
   * holographic body-region flags, six-meridian pattern notes, detected
   * clinical sign patterns with formula guidance, and ascending/descending
   * treatment cautions. Renders nothing if the report lacks these fields
   * (e.g. pre-upgrade rows analysed before the deep-analysis layer).
   */
  function renderDeepTongueAnalysis(report) {
    if (! report) return '';
    var tb = report.three_burner || {};
    var holo = report.holographic_map || {};
    var meridians = report.six_meridians || [];
    var patterns = report.clinical_patterns || [];
    var ascDesc = report.ascending_descending || {};

    // Bail out cleanly if none of the new fields are populated — keeps the
    // legacy report view clean for any tongue rows analysed before upgrade.
    var hasDeep = (tb && (tb.upper_jiao || tb.middle_jiao || tb.lower_jiao))
               || (holo && (holo.affected || []).length)
               || meridians.length
               || patterns.length
               || (ascDesc && ascDesc.direction && ascDesc.direction !== 'balanced');
    if (! hasDeep) return '';

    var out = '<div class="text-label mt-4 mb-2">🔬 Deep Analysis · 深度分析 <span class="text-muted" style="font-weight:400;font-size:10px;letter-spacing:.08em;">Yin Modern Tongue Diagnosis</span></div>';

    // ── Three Burners ──
    if (tb.upper_jiao || tb.middle_jiao || tb.lower_jiao) {
      out += '<div class="card mb-3" style="padding: var(--s-3);">' +
        '<div class="text-label mb-2" style="font-size: 10px;">三焦辨證 · Three Burners</div>';
      ['upper_jiao', 'middle_jiao', 'lower_jiao'].forEach(function (k) {
        var z = tb[k];
        if (! z) return;
        var statusColor = {
          heat: 'var(--red-seal)', damp_heat: '#c04545', dampness: 'var(--gold)',
          cold_damp: '#4a90b8', deficiency_cold: '#4a90b8', stasis: '#6b2d88',
          yin_deficiency: '#c04545', normal: 'var(--sage)',
        }[z.status] || 'var(--stone)';
        // Status label: prefer the bilingual pair from the backend
        // (status_zh + status_en); fall back to the raw enum.
        var statusEn = z.status_en || (z.status || 'normal').replace(/_/g, ' ');
        var statusZh = z.status_zh || '';
        out += '<div style="padding: 6px 0; border-bottom: 1px dashed var(--border);">' +
          '<div style="font-size: var(--text-xs);">' +
          '<strong style="font-family: var(--font-zh); color: ' + statusColor + ';">' + HM.format.esc(z.name_zh || '') + '</strong> ' +
          '<span class="text-muted">(' + HM.format.esc(z.name_en || '') + ')</span> ' +
          '<span style="color: ' + statusColor + '; font-weight: 600;">· ' + HM.format.esc(statusEn) +
          (statusZh ? ' · ' + HM.format.esc(statusZh) : '') + '</span>' +
          '</div>' +
          '<div class="text-xs text-muted mt-1">' + HM.format.esc(z.explanation || '') +
          (z.explanation_zh
            ? '<div style="font-family: var(--font-zh); margin-top: 2px;">' + HM.format.esc(z.explanation_zh) + '</div>'
            : '') +
          '</div>' +
          (z.organs && z.organs.length
            ? '<div class="text-xs text-muted" style="font-size: 10px;">Organs · 涉及臟腑: ' + z.organs.map(HM.format.esc).join(', ') + '</div>'
            : '') +
          '</div>';
      });
      if (tb.edges) {
        out += '<div class="text-xs text-muted mt-2" style="font-style: italic;">' +
          HM.format.esc(tb.edges.note || '') +
          (tb.edges.note_zh
            ? '<div style="font-family: var(--font-zh);">' + HM.format.esc(tb.edges.note_zh) + '</div>'
            : '') +
          '</div>';
      }
      out += '</div>';
    }

    // ── Holographic body map ──
    var affected = (holo && holo.affected) || [];
    if (affected.length) {
      out += '<div class="card mb-3" style="padding: var(--s-3);">' +
        '<div class="text-label mb-2" style="font-size: 10px;">全息圖 · Body Regions to Watch</div>' +
        '<ul style="list-style: none; padding: 0; margin: 0;">' +
        affected.map(function (f) {
          return '<li style="padding: 4px 0; font-size: var(--text-xs);">' +
            '<strong>' + HM.format.esc(f.region || '') +
            (f.region_zh
              ? ' <span style="font-family: var(--font-zh); color: var(--stone); font-weight: 400;">· ' + HM.format.esc(f.region_zh) + '</span>'
              : '') +
            '</strong>' +
            '<div class="text-muted" style="font-size: 11px; margin-top: 2px;">' + HM.format.esc(f.reason || '') +
            (f.reason_zh
              ? '<div style="font-family: var(--font-zh); margin-top: 1px;">' + HM.format.esc(f.reason_zh) + '</div>'
              : '') +
            '</div>' +
            '</li>';
        }).join('') +
        '</ul></div>';
    }

    // ── Six Meridians ──
    if (meridians.length) {
      out += '<div class="card mb-3" style="padding: var(--s-3);">' +
        '<div class="text-label mb-2" style="font-size: 10px;">六經辨證 · Six-Meridian Pattern Differentiation</div>' +
        meridians.map(function (m) {
          var zoneZh = m.zone_zh ? ' · ' + HM.format.esc(m.zone_zh) : '';
          return '<div style="padding: 6px 0; border-bottom: 1px dashed var(--border);">' +
            '<div style="font-size: var(--text-xs); font-weight: 600;">' + HM.format.esc(m.meridian || '') + '</div>' +
            '<div class="text-xs text-muted" style="font-size: 11px;">' +
            HM.format.esc(m.zone || '') + zoneZh + ' — ' + HM.format.esc(m.note || '') +
            (m.note_zh
              ? '<div style="font-family: var(--font-zh); margin-top: 2px;">' + HM.format.esc(m.note_zh) + '</div>'
              : '') +
            '</div>' +
            '</div>';
        }).join('') +
        '</div>';
    }

    // ── Clinical sign patterns + formula guidance ──
    if (patterns.length) {
      out += '<div class="card mb-3" style="padding: var(--s-3); border-left: 3px solid var(--gold);">' +
        '<div class="text-label mb-2" style="font-size: 10px;">臨床特徵 · Clinical Patterns Detected</div>';
      patterns.forEach(function (p) {
        out += '<div style="padding: 8px 0; border-bottom: 1px dashed var(--border);">' +
          '<div style="font-size: var(--text-xs);">' +
          '<strong style="font-family: var(--font-zh);">' + HM.format.esc(p.name_zh || '') + '</strong> · ' +
          HM.format.esc(p.name_en || '') +
          (p.extent ? ' <span class="chip chip--gold" style="font-size: 9px;">' + HM.format.esc(p.extent).replace(/_/g, ' ') + '</span>' : '') +
          '</div>' +
          (p.description
            ? '<div class="text-xs text-muted mt-1">' + HM.format.esc(p.description) +
              (p.description_zh
                ? '<div style="font-family: var(--font-zh); margin-top: 1px;">' + HM.format.esc(p.description_zh) + '</div>'
                : '') +
              '</div>'
            : '') +
          (p.indication
            ? '<div class="text-xs mt-1" style="color: #6b4413;">→ ' + HM.format.esc(p.indication) +
              (p.indication_zh
                ? '<div style="font-family: var(--font-zh); margin-top: 1px;">→ ' + HM.format.esc(p.indication_zh) + '</div>'
                : '') +
              '</div>'
            : '') +
          (p.formula
            ? '<div class="text-xs mt-2" style="background: rgba(201,146,42,0.1); padding: 6px 10px; border-radius: 3px; border-left: 2px solid var(--gold);">' +
              '<strong>💊 Formula direction · 用藥方向:</strong> ' + HM.format.esc(p.formula) +
              (p.formula_zh
                ? '<div style="font-family: var(--font-zh); margin-top: 2px;">' + HM.format.esc(p.formula_zh) + '</div>'
                : '') +
              '</div>'
            : '') +
          '</div>';
      });
      out += '</div>';
    }

    // ── Ascending / descending with treatment cautions ──
    if (ascDesc && ascDesc.direction && ascDesc.direction !== 'balanced') {
      var isAsc = ascDesc.direction === 'ascending_excess';
      var borderCol = isAsc ? 'var(--red-seal)' : '#4a90b8';
      out += '<div class="card mb-3" style="padding: var(--s-3); border-left: 3px solid ' + borderCol + ';">' +
        '<div class="text-label mb-2" style="font-size: 10px;">升降辨證 · Ascending / Descending</div>' +
        '<div style="font-size: var(--text-xs);">' +
        '<strong style="color: ' + borderCol + '; font-family: var(--font-zh);">' + HM.format.esc(ascDesc.name_zh || '') + '</strong> · ' +
        HM.format.esc(ascDesc.name_en || '') +
        '</div>' +
        (ascDesc.signs
          ? '<div class="text-xs text-muted mt-1">' + HM.format.esc(ascDesc.signs) +
            (ascDesc.signs_zh
              ? '<div style="font-family: var(--font-zh); margin-top: 1px;">' + HM.format.esc(ascDesc.signs_zh) + '</div>'
              : '') +
            '</div>'
          : '') +
        (ascDesc.caution
          ? '<div class="text-xs mt-2" style="background: rgba(192,57,43,0.08); padding: 6px 10px; border-radius: 3px; border-left: 2px solid var(--red-seal); color: var(--red-seal);">' +
            '<strong>⚠ Caution · 注意:</strong> ' + HM.format.esc(ascDesc.caution) +
            (ascDesc.caution_zh
              ? '<div style="font-family: var(--font-zh); margin-top: 2px;">' + HM.format.esc(ascDesc.caution_zh) + '</div>'
              : '') +
            '</div>'
          : '') +
        (ascDesc.treatment
          ? '<div class="text-xs mt-2" style="background: rgba(74,144,184,0.1); padding: 6px 10px; border-radius: 3px; border-left: 2px solid #4a90b8;">' +
            '<strong>💡 Direction · 治法:</strong> ' + HM.format.esc(ascDesc.treatment) +
            (ascDesc.treatment_zh
              ? '<div style="font-family: var(--font-zh); margin-top: 2px;">' + HM.format.esc(ascDesc.treatment_zh) + '</div>'
              : '') +
            '</div>'
          : '') +
        '</div>';
    }

    // ── Free-form AI observations ──
    if (report.observations) {
      out += '<div class="card mb-3" style="padding: var(--s-3);">' +
        '<div class="text-label mb-2" style="font-size: 10px;">AI Observations · AI 觀察</div>' +
        '<div class="text-xs text-muted" style="font-style: italic; line-height: 1.6;">' + HM.format.esc(report.observations) + '</div>' +
        '</div>';
    }

    return out;
  }

  /**
   * Render the unified synthesis panel — fuses DOB, constitution, and
   * tongue analysis into a ranked theme list with combined food /
   * lifestyle / herb advice. Returns empty string when no themes
   * matched so the modal stays clean.
   */
  function renderSynthesisPanel(syn) {
    if (! syn || ! syn.themes || ! syn.themes.length) return '';

    var sourceCount = syn.sourceCount || 0;
    var sourceLabel = (syn.hasDob ? '🌌 DOB · 五運六氣 ' : '') +
                      (syn.hasConstitution ? '🧭 Constitution ' : '') +
                      (syn.hasTongue ? '👅 Tongue' : '');

    // Themes — coloured dots by priority + evidence trail per source.
    var themesHtml = syn.themes.map(function (t) {
      var pColor = t.priority === 'high' ? 'var(--red-seal)' :
                   t.priority === 'medium' ? 'var(--gold)' : 'var(--stone)';
      var pIcon = t.priority === 'high' ? '●●●' : t.priority === 'medium' ? '●●○' : '●○○';
      var sources = t.sources.map(function (s) {
        var icon = s === 'DOB' ? '🌌' : s === 'Constitution' ? '🧭' : '👅';
        return '<span class="syn-source-pill">' + icon + ' ' + s + '</span>';
      }).join('');
      var evidenceLines = '';
      if (t.evidence.dob)          evidenceLines += '<div class="syn-ev"><strong>DOB:</strong> ' + HM.format.esc(t.evidence.dob) + '</div>';
      if (t.evidence.constitution) evidenceLines += '<div class="syn-ev"><strong>Constitution:</strong> ' + HM.format.esc(t.evidence.constitution) + '</div>';
      if (t.evidence.tongue)       evidenceLines += '<div class="syn-ev"><strong>Tongue:</strong> ' + HM.format.esc(t.evidence.tongue) + '</div>';

      return '<div class="syn-theme">' +
        '<div class="syn-theme-head">' +
          '<span style="color:' + pColor + ';font-family:var(--font-mono);font-size:10px;">' + pIcon + '</span> ' +
          '<strong style="font-family:var(--font-zh);">' + HM.format.esc(t.zh) + '</strong> · ' +
          '<span>' + HM.format.esc(t.en) + '</span> ' +
          sources +
        '</div>' +
        '<div class="syn-theme-summary">' + HM.format.esc(t.summary_en) +
        '<div style="font-family:var(--font-zh);">' + HM.format.esc(t.summary_zh) + '</div></div>' +
        (evidenceLines ? '<details class="syn-evidence"><summary>Why · 依據</summary>' + evidenceLines + '</details>' : '') +
        '</div>';
    }).join('');

    function renderFoodList(items, color, label_en, label_zh, icon) {
      if (! items.length) return '';
      return '<div class="syn-food-col" style="border-top:3px solid ' + color + ';">' +
        '<div class="syn-food-head">' + icon + ' ' + label_en + ' · ' + label_zh + '</div>' +
        '<ul class="syn-food-list">' +
        items.slice(0, 8).map(function (it) {
          var why = it.why_en ? '<div class="syn-why">— ' + HM.format.esc(it.why_en) +
                                  (it.why_zh ? ' · <span style="font-family:var(--font-zh);">' + HM.format.esc(it.why_zh) + '</span>' : '') +
                                  '</div>' : '';
          return '<li>' +
            '<div><strong>' + HM.format.esc(it.en) + '</strong>' +
            (it.zh ? ' <span style="font-family:var(--font-zh);color:var(--stone);">· ' + HM.format.esc(it.zh) + '</span>' : '') +
            '</div>' +
            why +
            '</li>';
        }).join('') +
        '</ul></div>';
    }

    var foodHtml = '<div class="syn-food-grid">' +
      renderFoodList(syn.food.eatMore, 'var(--sage)',     'Eat More',  '宜多食', '✅') +
      renderFoodList(syn.food.eatLess, 'var(--gold)',     'Eat Less',  '宜少食', '⚠️') +
      renderFoodList(syn.food.avoid,   'var(--red-seal)', 'Avoid',     '忌',     '❌') +
      '</div>';

    var lifestyleHtml = syn.lifestyle.length
      ? '<div class="syn-section-head">🌿 Lifestyle · 生活建議</div>' +
        '<ul class="syn-lifestyle">' +
        syn.lifestyle.slice(0, 10).map(function (l) {
          return '<li>' + (l.icon || '•') + ' <strong>' + HM.format.esc(l.en) + '</strong>' +
            (l.zh ? '<div style="font-family:var(--font-zh);color:var(--stone);font-size:11px;margin-left:24px;">' + HM.format.esc(l.zh) + '</div>' : '') +
            '</li>';
        }).join('') +
        '</ul>'
      : '';

    var herbsHtml = syn.herbs.length
      ? '<div class="syn-section-head">🌿 Suggested Herb Directions · 建議用藥方向</div>' +
        '<div class="syn-herbs">' +
        syn.herbs.slice(0, 12).map(function (h) {
          var themes = (h.for_themes || []).map(function (t) { return t.zh; }).join(' / ');
          return '<span class="syn-herb-pill" title="For: ' + HM.format.esc(themes) + '">' +
            HM.format.esc(h.name) + '</span>';
        }).join(' ') +
        '</div>' +
        '<div class="text-xs text-muted mt-1" style="font-style:italic;">Hover each herb to see which pattern(s) it addresses.</div>'
      : '';

    injectSynthesisStyles();

    return '<div class="syn-panel">' +
      '<div class="syn-header">' +
      '<div class="syn-title">🔮 Combined Plan · 綜合分析建議</div>' +
      '<div class="syn-sub">Synthesised from ' + sourceCount + ' source' + (sourceCount === 1 ? '' : 's') + ': ' + sourceLabel + '</div>' +
      '</div>' +

      '<div class="syn-section-head">🎯 Detected Patterns · 主要證型</div>' +
      '<div class="syn-themes">' + themesHtml + '</div>' +

      '<div class="syn-section-head">🍱 Food Recommendations · 飲食建議</div>' +
      foodHtml +

      lifestyleHtml +
      herbsHtml +
      '</div>';
  }

  function injectSynthesisStyles() {
    if (document.getElementById('syn-style')) return;
    var s = document.createElement('style');
    s.id = 'syn-style';
    s.textContent =
      '.syn-panel{background:linear-gradient(135deg,rgba(201,146,42,.05),rgba(122,140,114,.05));border:1px solid rgba(201,146,42,.3);border-radius:var(--r-md);padding:var(--s-4);margin-bottom:var(--s-5);}' +
      '.syn-header{border-bottom:1px solid rgba(201,146,42,.2);padding-bottom:var(--s-2);margin-bottom:var(--s-3);}' +
      '.syn-title{font-family:var(--font-serif,Cormorant);font-size:18px;font-weight:600;color:var(--ink);}' +
      '.syn-sub{font-size:11px;color:var(--stone);margin-top:2px;}' +
      '.syn-section-head{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--stone);margin:var(--s-3) 0 var(--s-2);font-weight:500;}' +
      '.syn-themes{display:flex;flex-direction:column;gap:8px;}' +
      '.syn-theme{background:#fff;border:1px solid var(--border);border-radius:var(--r-sm);padding:10px 12px;}' +
      '.syn-theme-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:13px;}' +
      '.syn-theme-summary{font-size:11px;color:var(--stone);margin-top:4px;line-height:1.5;}' +
      '.syn-source-pill{display:inline-block;background:var(--washi);border:1px solid var(--border);border-radius:999px;padding:1px 8px;font-size:10px;color:var(--stone);margin-left:4px;}' +
      '.syn-evidence{margin-top:6px;font-size:11px;}' +
      '.syn-evidence summary{cursor:pointer;color:var(--gold);user-select:none;}' +
      '.syn-ev{padding:2px 0;color:var(--stone);}' +
      '.syn-food-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;}' +
      '.syn-food-col{background:#fff;border:1px solid var(--border);border-radius:var(--r-sm);padding:10px;}' +
      '.syn-food-head{font-size:11px;font-weight:600;margin-bottom:8px;letter-spacing:.05em;}' +
      '.syn-food-list{list-style:none;padding:0;margin:0;}' +
      '.syn-food-list li{padding:6px 0;border-bottom:1px dashed var(--border);font-size:12px;}' +
      '.syn-food-list li:last-child{border-bottom:none;}' +
      '.syn-why{font-size:10px;color:var(--stone);margin-top:2px;line-height:1.4;}' +
      '.syn-lifestyle{list-style:none;padding:0;margin:0;background:#fff;border:1px solid var(--border);border-radius:var(--r-sm);padding:8px 12px;}' +
      '.syn-lifestyle li{padding:6px 0;border-bottom:1px dashed var(--border);font-size:12px;}' +
      '.syn-lifestyle li:last-child{border-bottom:none;}' +
      '.syn-herbs{display:flex;flex-wrap:wrap;gap:6px;background:#fff;border:1px solid var(--border);border-radius:var(--r-sm);padding:10px;}' +
      '.syn-herb-pill{display:inline-block;background:rgba(201,146,42,.1);color:#6b4413;border:1px solid rgba(201,146,42,.4);border-radius:999px;padding:3px 10px;font-size:11px;cursor:help;}' +
      '';
    document.head.appendChild(s);
  }

  // Bilingual labels for the finding categories that come back from
  // the AnalysisReport — keeps the data flat (just `category` enum)
  // while the UI shows both languages.
  var FINDING_CATEGORY_LABELS = {
    tongue_color: { en: 'Tongue colour', zh: '舌色' },
    coating:      { en: 'Coating',       zh: '苔象' },
    shape:        { en: 'Shape',         zh: '舌形' },
    moisture:     { en: 'Moisture',      zh: '潤燥' },
    midline:      { en: 'Midline',       zh: '中線' },
    teeth_marks:  { en: 'Teeth marks',   zh: '齒痕' },
    cracks:       { en: 'Cracks',        zh: '裂紋' },
  };

  function renderFindingRow(f) {
    var lab = FINDING_CATEGORY_LABELS[f.category] || {
      en: (f.category || '').replace(/_/g, ' '),
      zh: '',
    };
    var labelHtml = '<strong>' + HM.format.esc(lab.en) +
      (lab.zh ? ' · ' + lab.zh : '') + ':</strong> ';

    // Two finding shapes:
    //   - Standard: { value, value_zh, indication_en, indication_zh }
    //   - Boolean:  { present: true, indication_en, indication_zh }
    var valueHtml = '';
    if (f.value || f.value_zh) {
      valueHtml = HM.format.esc(f.value || '—') +
        (f.value_zh ? ' <span style="font-family: var(--font-zh); color: var(--stone);">· ' + HM.format.esc(f.value_zh) + '</span>' : '');
    }
    var indicationHtml = '';
    if (f.indication_en || f.indication_zh) {
      indicationHtml = '<div style="margin-top:2px; font-size: 11px;">→ ' +
        HM.format.esc(f.indication_en || '') +
        (f.indication_zh
          ? '<span style="font-family: var(--font-zh); color: var(--stone);"> · ' + HM.format.esc(f.indication_zh) + '</span>'
          : '') +
        '</div>';
    }

    return '<li style="padding: 6px 0; border-bottom: 1px solid var(--border);">' +
      labelHtml + valueHtml + indicationHtml +
      '</li>';
  }

  function renderMiniTongue(t) {
    var report = t.constitution_report || {};
    var c = report.constitution || {};
    var statusBadge = {
      pending:       '<span class="badge" style="font-size:9px;">⏳</span>',
      approved:      '<span class="badge badge--success" style="font-size:9px;">✓</span>',
      needs_changes: '<span class="badge badge--danger" style="font-size:9px;">!</span>',
    }[t.review_status || 'pending'] || '';
    return '<div class="flex gap-2 mb-2" style="align-items:center;">' +
      (t.image_url
        ? '<img src="' + HM.format.esc(t.image_url) + '" style="width:48px;height:48px;object-fit:cover;border-radius:var(--r-sm);border:1px solid var(--border);flex-shrink:0;">'
        : '<div style="width:48px;height:48px;border-radius:var(--r-sm);background:var(--washi);display:flex;align-items:center;justify-content:center;flex-shrink:0;">👅</div>') +
      '<div style="flex:1;font-size:var(--text-xs);">' +
      '<div class="flex gap-1" style="align-items:center;">' + statusBadge +
      '<span class="text-muted">' + HM.format.date(t.created_at) + '</span></div>' +
      (c.name_en ? '<div style="font-weight:500;">' + HM.format.esc(c.name_en) + '</div>' : '') +
      (t.health_score != null ? '<div class="text-muted">Score ' + t.health_score + '/100</div>' : '') +
      '</div></div>';
  }

  // ═══════════════════════════════════════════════════════════
  //  TONGUE REVIEW MODAL  (with constitution context from same patient)
  // ═══════════════════════════════════════════════════════════
  async function openTongueModal(id, patientId) {
    var loading = HM.ui.modal({ size: 'xl', title: 'Loading…', content: '<div class="state state--loading"><div class="state-icon"></div></div>' });

    var res, constRes, patientRes;
    try {
      var results = await Promise.all([
        HM.api.doctor.getTongueReview(id),
        HM.api.doctor.patientConstitutionReports(patientId).catch(function () { return { data: [] }; }),
        HM.api.doctor.patientConsults(patientId).catch(function () { return { patient: null }; }),
      ]);
      res = results[0];
      constRes = results[1];
      patientRes = results[2];
    } catch (e) {
      loading.close();
      HM.ui.toast(e.message || 'Failed to load', 'danger');
      return;
    }
    loading.close();

    var pRaw2 = (patientRes && patientRes.patient) || {};
    var patientProfile = pRaw2.patient_profile || pRaw2.patientProfile || {};
    var patientDob = patientProfile.birth_date || patientProfile.dob || null;

    var d = res.diagnosis;
    var report = d.constitution_report || {};
    var c = report.constitution || {};
    var findings = report.findings || [];
    var recs = report.recommendations || [];
    var existingMeds = d.medicine_suggestions || [];
    var constReports = (constRes && constRes.data) ? constRes.data.slice(0, 3) : [];

    var content =
      '<div id="rvw-wyl-tongue" class="mb-4"></div>' +

      '<div class="grid-2" style="gap: var(--s-5); align-items: start;">' +

      // ─── LEFT — tongue result + constitution context ───
      '<div>' +
      '<div class="text-label mb-2">👅 AI Tongue Analysis · AI 舌診</div>' +
      '<div class="card" style="padding: var(--s-4);">' +
      (d.image_url
        ? HM.format.img(d.image_url, {
            style: 'width:100%;aspect-ratio:1;border-radius:var(--r-md);border:1px solid var(--border);margin-bottom:var(--s-3);',
            icon: '👅',
            title: 'Photo unavailable · 圖片已不存在',
          })
        : '') +
      (c.name_en ? '<div class="card-title">' + HM.format.esc(c.name_en) + '</div>' : '') +
      (c.name_zh ? '<div class="text-sm text-muted" style="font-family: var(--font-zh);">' + HM.format.esc(c.name_zh) + '</div>' : '') +
      (d.health_score != null ? '<div class="text-sm mt-2">Health Score: <strong>' + d.health_score + '/100</strong></div>' : '') +

      (findings.length ? ('<div class="text-label mt-4 mb-2">Findings · 望舌所見</div>' +
        '<ul class="text-xs text-muted" style="list-style: none; padding: 0;">' +
        findings.map(renderFindingRow).join('') + '</ul>') : '') +

      (recs.length ? ('<div class="text-label mt-4 mb-2">AI Lifestyle Suggestions · AI 養生建議</div>' +
        '<ul class="text-xs text-muted" style="padding-left: 18px;">' +
        recs.map(function (r) { return '<li style="margin-bottom: 4px;">' + HM.format.esc(r) + '</li>'; }).join('') +
        '</ul>') : '') +

      '</div>' +

      // ─── Deep Yin Modern Tongue Diagnosis analysis ───
      renderDeepTongueAnalysis(report) +

      // Constitution context
      '<div class="text-label mt-4 mb-2">🧭 Recent Constitution Reports · 近期體質報告</div>' +
      (constReports.length
        ? '<div class="card" style="padding: var(--s-3);">' +
          constReports.map(renderMiniConstitution).join('') +
          '</div>'
        : '<div class="card" style="padding: var(--s-3);"><p class="text-xs text-muted" style="margin:0;">No AI constitution reports on file for this patient.</p></div>') +

      '</div>' +

      // ─── RIGHT — editable tongue review ───
      '<form id="tr-form">' +
      '<div class="text-label mb-2">Your Comment · 您的審核意見</div>' +
      '<textarea name="comment" class="field-input field-input--boxed" rows="5" placeholder="Notes for the patient — anything the AI missed, concerns, encouragement…">' + HM.format.esc(d.doctor_comment || '') + '</textarea>' +

      '<div class="text-label mt-4 mb-2">Medicine Suggestions · 藥物建議</div>' +
      '<div id="tr-meds">' + (existingMeds.length ? existingMeds.map(medRow).join('') : medRow({name: '', name_zh: '', note: ''})) + '</div>' +
      '<button type="button" class="btn btn--ghost btn--sm" id="tr-add-med">+ Add Another</button>' +

      '<div class="alert alert--warning mt-4"><div class="alert-body text-xs">' +
      '<strong>Safety check:</strong> only suggest herbs/formulas you would recommend given what you can see. The patient cannot fill complex multi-herb prescriptions from this comment — they must book a consultation for that.' +
      '</div></div>' +

      '<div data-general-error class="alert alert--danger" style="display:none;"></div>' +

      '<div class="flex gap-2 mt-4 flex-wrap">' +
      '<button type="button" class="btn btn--outline btn--sm" id="tr-prescribe">💊 Prescribe Medicine · 開立處方</button>' +
      '</div>' +

      '<div class="flex gap-2 mt-2">' +
      '<button type="button" class="btn btn--danger btn--sm" data-decision="needs_changes">Request Changes · 要求修改</button>' +
      '<button type="submit" class="btn btn--primary btn--block" data-decision="approved">✓ Approve · 批准</button>' +
      '</div>' +
      '</form>' +
      '</div>';

    var m = HM.ui.modal({ size: 'xl', title: 'Review Tongue Diagnosis · 審核舌診', content: content });

    if (window.HM && HM.wuyunLiuqi) {
      HM.wuyunLiuqi.mountDual(m.element.querySelector('#rvw-wyl-tongue'), patientDob);
    }

    var form = m.element.querySelector('#tr-form');

    m.element.querySelector('#tr-add-med').addEventListener('click', function () {
      m.element.querySelector('#tr-meds').insertAdjacentHTML('beforeend', medRow({name: '', name_zh: '', note: ''}));
    });
    m.element.querySelector('#tr-meds').addEventListener('click', function (e) {
      if (e.target.matches('[data-remove-med]')) e.target.closest('.tr-med-row').remove();
    });

    m.element.querySelector('[data-decision="needs_changes"]').addEventListener('click', function () {
      submitTongue(form, m, id, 'needs_changes');
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitTongue(form, m, id, 'approved');
    });

    // Prescribe — opens a second modal, seeded with the existing med suggestions
    m.element.querySelector('#tr-prescribe').addEventListener('click', function () {
      var seedItems = existingMeds.map(function (mItem) {
        return { drug_name: mItem.name_zh || mItem.name || '', note: mItem.note || '', quantity: 10, unit: 'g' };
      });
      openPrescribeModal({
        patient_id: d.patient_id,
        source_type: 'tongue',
        source_id: d.id,
        default_diagnosis: (c.name_zh || c.name_en || ''),
        seed_items: seedItems,
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  PRESCRIBE MODAL — issue a formal prescription from a review
  // ═══════════════════════════════════════════════════════════
  // Rich prescription modal — mirrors the consult Rx pad experience
  // (dosage pattern, usage-note preset chips, catalog autocomplete,
  // per-row stock pill, running totals) so the doctor gets the same
  // capable tooling when issuing from an AI review. Modal-bound so
  // they don't lose the review context.
  var rvwRxState = { items: [], catalog: [] };

  async function openPrescribeModal(opts) {
    rvwRxState.items = (opts.seed_items && opts.seed_items.length)
      ? opts.seed_items.map(function (s) {
          return {
            drug_name: s.drug_name || '',
            quantity:  s.quantity  || 10,
            unit:      s.unit      || 'g',
            notes:     s.note      || s.notes || '',
            dosage:    s.dosage    || '',
            frequency: s.frequency || '',
          };
        })
      : [{ drug_name: '', quantity: 10, unit: 'g' }];

    var content =
      '<form id="rx-form">' +
      '<div class="alert alert--info mb-3" style="margin-top:0;"><div class="alert-body text-xs">' +
      '<strong>Formal prescription · 正式處方</strong><br>' +
      'Creates a real prescription in the patient\'s record — they get a notification and can order via the pharmacy.' +
      '</div></div>' +

      // Diagnosis
      '<div class="field"><label class="field-label">Diagnosis · 診斷</label>' +
      '<input name="diagnosis" class="field-input field-input--boxed" value="' + HM.format.esc(opts.default_diagnosis || '') + '" placeholder="e.g. Qi-Blood Deficiency · 氣血兩虛"></div>' +

      // ── Dosage pattern (packs × times × days) — same UX as consult ──
      '<div class="text-label mt-3 mb-1">Dosage Pattern · 服用方式</div>' +
      '<div class="flex flex-gap-2" style="align-items:center;flex-wrap:wrap;">' +
      '<input id="rvrx-packs" class="field-input field-input--boxed rx-dosage-input" type="number" min="1" max="10" value="1" title="Packs per dose">' +
      '<span>×</span>' +
      '<input id="rvrx-times" class="field-input field-input--boxed rx-dosage-input" type="number" min="1" max="8" value="2" title="Times per day">' +
      '<span>×</span>' +
      '<input id="rvrx-days" class="field-input field-input--boxed rx-dosage-input" type="number" min="1" max="90" value="7" title="Duration in days">' +
      '<span class="rx-dosage-hint text-xs text-muted" id="rvrx-hint">1 pack · 2×/day · 7 days (14 doses)</span>' +
      '</div>' +
      '<div class="text-xs text-muted mt-1">Pack × Times/day × Days. Each herb\'s qty is per dose — the backend multiplies out for the full course. <span style="font-family:var(--font-zh);">每次 × 每日次數 × 天數。</span></div>' +

      // ── Usage notes with preset chips (same chips as consult) ──
      '<div class="text-label mt-3 mb-1">Usage Notes · 用法備註</div>' +
      '<div id="rvrx-presets" class="rx-usage-presets">' +
      [
        { en: 'After meals',    zh: '飯後服用' },
        { en: 'Before meals',   zh: '飯前服用' },
        { en: 'Empty stomach',  zh: '空腹服用' },
        { en: 'Warm water',     zh: '溫水送服' },
        { en: 'Decoct in water',zh: '水煎服' },
        { en: 'Before sleep',   zh: '睡前服用' },
        { en: 'Morning',        zh: '晨起服用' },
        { en: 'Avoid cold/raw', zh: '忌生冷' },
        { en: 'Avoid spicy',    zh: '忌辛辣' },
      ].map(function (p) {
        return '<button type="button" class="rx-usage-chip" data-usage="' +
          HM.format.esc(p.zh + ' ' + p.en) + '">' +
          '<span style="font-family:var(--font-zh);">' + p.zh + '</span> · ' + p.en +
          '</button>';
      }).join('') +
      '</div>' +
      '<input id="rvrx-usage" class="field-input field-input--boxed mt-2" placeholder="e.g. 飯後服用，水煎 After meals, decoct with water">' +

      // ── Herb items: table with stock pill + autocomplete ──
      '<div class="text-label mt-3 mb-1">Herb Items · 藥材清單</div>' +
      '<div class="text-xs text-muted mb-2">Type to search catalog. ' +
      '<span style="color: var(--sage);">● in stock</span> · ' +
      '<span style="color: var(--red-seal);">● out</span> · ' +
      '<span style="color: var(--stone);">? not in catalog</span></div>' +
      '<div id="rvrx-items-list" class="mb-2"></div>' +
      '<datalist id="rvrx-catalog"></datalist>' +
      '<button type="button" class="btn btn--outline btn--sm" id="rvrx-add-row">+ Add Herb · 新增藥材</button>' +

      // Running total
      '<div id="rvrx-total" class="rx-total-box mt-3" style="display:none;">' +
      '<div class="flex-between"><span class="text-muted text-sm">Total price · 總金額</span><strong id="rvrx-total-price">—</strong></div>' +
      '<div class="flex-between mt-1"><span class="text-muted text-sm">Total weight · 總重</span><span id="rvrx-total-weight">—</span></div>' +
      '</div>' +

      '<div data-general-error class="alert alert--danger mt-3" style="display:none;"></div>' +

      '<div class="flex gap-2 mt-4">' +
      '<button type="button" class="btn btn--ghost" id="rvrx-cancel">Cancel</button>' +
      '<button type="submit" class="btn btn--primary btn--block">Issue Prescription · 開立處方</button>' +
      '</div>' +
      '</form>';

    var m = HM.ui.modal({ size: 'lg', title: '💊 Prescribe Medicine · 開立處方', content: content });
    var form = m.element.querySelector('#rx-form');

    // Styles shared with the consult pad.
    injectRvRxStyles();

    // Load catalog (shared endpoint) — autocomplete + stock pills.
    HM.api.doctor.drugCatalog().then(function (res) {
      rvwRxState.catalog = (res && res.data) || [];
      var dl = m.element.querySelector('#rvrx-catalog');
      if (dl) dl.innerHTML = rvwRxState.catalog.map(function (d) {
        return '<option value="' + HM.format.esc(d.name) + '">' +
          HM.format.esc((d.specification || '') + ' · stock: ' + (parseFloat(d.total_stock) || 0) + (d.unit || 'g')) +
          '</option>';
      }).join('');
      renderRvRxList(m);
    }).catch(function () { renderRvRxList(m); });

    // Dosage-pattern inputs refresh the hint + totals.
    ['rvrx-packs','rvrx-times','rvrx-days'].forEach(function (id) {
      var el = m.element.querySelector('#' + id);
      el.addEventListener('input', function () { updateRvRxHint(m); renderRvRxList(m); });
    });
    updateRvRxHint(m);

    // Preset chips — append / toggle into the usage input.
    m.element.querySelector('#rvrx-presets').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-usage]'); if (! btn) return;
      ev.preventDefault();
      var piece = btn.getAttribute('data-usage');
      var inp = m.element.querySelector('#rvrx-usage');
      var parts = (inp.value || '').split(/[,，、；;]\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
      var idx = parts.indexOf(piece);
      if (idx >= 0) { parts.splice(idx, 1); btn.classList.remove('is-selected'); }
      else          { parts.push(piece);    btn.classList.add('is-selected'); }
      inp.value = parts.join(', ');
    });

    // Add row
    m.element.querySelector('#rvrx-add-row').addEventListener('click', function () {
      rvwRxState.items.push({ drug_name: '', quantity: 10, unit: 'g' });
      renderRvRxList(m);
    });

    m.element.querySelector('#rvrx-cancel').addEventListener('click', function () { m.close(); });

    // Submit — collect everything and issue.
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var diagnosis = form.querySelector('[name="diagnosis"]').value.trim();
      var packs = parseInt(m.element.querySelector('#rvrx-packs').value, 10) || 1;
      var times = parseInt(m.element.querySelector('#rvrx-times').value, 10) || 1;
      var days  = parseInt(m.element.querySelector('#rvrx-days').value,  10) || 7;
      var usage = m.element.querySelector('#rvrx-usage').value.trim();

      var clean = rvwRxState.items.filter(function (it) { return it.drug_name && parseFloat(it.quantity) > 0; });
      if (!clean.length) {
        HM.form.showGeneralError(form, 'Add at least one herb with quantity > 0');
        return;
      }

      // Per-dose → full-course multiplication (same as consult pad).
      var multiplier = packs * times * days;
      var expanded = clean.map(function (it) {
        return {
          drug_name:     it.drug_name,
          quantity:      parseFloat((parseFloat(it.quantity) * multiplier).toFixed(2)),
          unit:          it.unit || 'g',
          notes:         (it.notes ? it.notes + ' | ' : '') + 'per dose: ' + it.quantity + (it.unit || 'g'),
        };
      });
      var dosageLine = packs + ' pack · ' + times + '× per day · ' + days + ' days · 每次' + packs + '包 每日' + times + '次 共' + days + '天';

      HM.form.setLoading(form, true);
      try {
        await HM.api.doctor.issuePrescription({
          patient_id:    opts.patient_id,
          source_type:   opts.source_type,
          source_id:     opts.source_id,
          diagnosis:     diagnosis || null,
          instructions:  [dosageLine, usage].filter(Boolean).join('\n'),
          duration_days: days,
          items:         expanded,
        });
        m.close();
        HM.ui.toast('Prescription issued · 處方已開立', 'success');
      } catch (err) {
        HM.form.setLoading(form, false);
        HM.form.showGeneralError(form, err.message || 'Failed to issue prescription');
      }
    });
  }

  function updateRvRxHint(m) {
    var packs = parseInt(m.element.querySelector('#rvrx-packs').value, 10) || 1;
    var times = parseInt(m.element.querySelector('#rvrx-times').value, 10) || 1;
    var days  = parseInt(m.element.querySelector('#rvrx-days').value,  10) || 1;
    var hint  = m.element.querySelector('#rvrx-hint');
    if (hint) hint.textContent = packs + ' pack · ' + times + '×/day · ' + days + ' days (' + (times * days) + ' doses)';
  }

  function rvRxCatalogLookup(name) {
    if (!name) return null;
    var lc = name.toLowerCase().trim();
    for (var i = 0; i < rvwRxState.catalog.length; i++) {
      if ((rvwRxState.catalog[i].name || '').toLowerCase() === lc) return rvwRxState.catalog[i];
    }
    return null;
  }

  function renderRvRxList(m) {
    var container = m.element.querySelector('#rvrx-items-list');
    if (!container) return;
    if (!rvwRxState.items.length) {
      container.innerHTML = '<div class="card" style="padding: var(--s-3);"><p class="text-muted text-xs text-center">No herbs added. Click "+ Add Herb" below.</p></div>';
      return;
    }

    var packs = parseInt(m.element.querySelector('#rvrx-packs').value, 10) || 1;
    var times = parseInt(m.element.querySelector('#rvrx-times').value, 10) || 1;
    var days  = parseInt(m.element.querySelector('#rvrx-days').value,  10) || 1;
    var multiplier = packs * times * days;

    var totalPrice = 0, totalWeight = 0;
    container.innerHTML = '';
    var table = document.createElement('table');
    table.className = 'rx-table';
    table.innerHTML =
      '<thead><tr>' +
        '<th class="rx-col-num">#</th>' +
        '<th class="rx-col-herb">Herb · 藥材</th>' +
        '<th class="rx-col-stock" title="Stock">●</th>' +
        '<th class="rx-col-qty">Qty / dose<div class="rx-col-sub">每次</div></th>' +
        '<th class="rx-col-total-qty">Total Qty<div class="rx-col-sub">總量</div></th>' +
        '<th class="rx-col-total">Total Cost<div class="rx-col-sub">總金額</div></th>' +
        '<th class="rx-col-remove"></th>' +
      '</tr></thead><tbody></tbody>';
    var tbody = table.querySelector('tbody');

    rvwRxState.items.forEach(function (it, idx) {
      var match = rvRxCatalogLookup(it.drug_name);
      var unitPrice = match ? (parseFloat(match.min_price) || 0) : 0;
      var perDose = parseFloat(it.quantity) || 0;
      var courseQty = perDose * multiplier;
      var lineTotal = unitPrice * courseQty;
      totalPrice += lineTotal;
      totalWeight += courseQty;

      var stockPill;
      if (!it.drug_name) stockPill = '<span class="rx-stock" style="color:var(--stone);">—</span>';
      else if (!match)   stockPill = '<span class="rx-stock" title="Not in catalog" style="color:var(--stone);">?</span>';
      else {
        var stock = parseFloat(match.total_stock) || 0;
        if (stock <= 0)                stockPill = '<span class="rx-stock" style="color:var(--red-seal);" title="Out of stock">●</span>';
        else if (stock < courseQty)    stockPill = '<span class="rx-stock" style="color:var(--gold);" title="Stock ' + stock.toFixed(0) + 'g — short of course ' + courseQty.toFixed(0) + 'g">●</span>';
        else                           stockPill = '<span class="rx-stock" style="color:var(--sage);" title="In stock ' + stock.toFixed(0) + 'g">●</span>';
      }

      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="rx-col-num">' + (idx + 1) + '</td>' +
        '<td class="rx-col-herb"><input data-rv-f="drug_name" data-rv-i="' + idx + '" class="rx-line-name" list="rvrx-catalog" autocomplete="off" placeholder="Drug · 藥名" value="' + HM.format.esc(it.drug_name || '') + '"></td>' +
        '<td class="rx-col-stock">' + stockPill + '</td>' +
        '<td class="rx-col-qty"><input data-rv-f="quantity" data-rv-i="' + idx + '" type="number" step="0.1" min="0" class="rx-line-qty" value="' + (it.quantity || '') + '"></td>' +
        '<td class="rx-col-total-qty">' + (perDose > 0 ? courseQty.toFixed(1) + ' g' : '—') + '</td>' +
        '<td class="rx-col-total">' + (match && perDose > 0 ? '<strong>' + HM.format.money(lineTotal) + '</strong>' : '—') + '</td>' +
        '<td class="rx-col-remove"><button type="button" class="rx-line-remove" data-rv-del="' + idx + '">✕</button></td>';
      tbody.appendChild(tr);
    });
    container.appendChild(table);

    // Per-input events
    container.querySelectorAll('[data-rv-f]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var i = parseInt(inp.getAttribute('data-rv-i'), 10);
        var f = inp.getAttribute('data-rv-f');
        var v = inp.value;
        if (f === 'quantity') v = parseFloat(v) || 0;
        rvwRxState.items[i][f] = v;
        if (f === 'drug_name') {
          var hit = rvRxCatalogLookup(v);
          if (hit && hit.unit) rvwRxState.items[i].unit = hit.unit;
        }
      });
      inp.addEventListener('change', function () {
        if (inp.getAttribute('data-rv-f') === 'drug_name') renderRvRxList(m);
        else renderRvRxList(m);
      });
    });
    container.querySelectorAll('[data-rv-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = parseInt(btn.getAttribute('data-rv-del'), 10);
        rvwRxState.items.splice(i, 1);
        if (!rvwRxState.items.length) rvwRxState.items.push({ drug_name: '', quantity: 10, unit: 'g' });
        renderRvRxList(m);
      });
    });
    // Delegated arrow-nav (same mechanics as consult pad).
    if (!container._keyWired) {
      container._keyWired = true;
      container.addEventListener('keydown', function (ev) {
        if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp' && ev.key !== 'Enter') return;
        var inp = ev.target.closest('[data-rv-f]'); if (!inp) return;
        ev.preventDefault();
        var f = inp.getAttribute('data-rv-f');
        var i = parseInt(inp.getAttribute('data-rv-i'), 10);
        var target;
        if (ev.key === 'ArrowUp') target = Math.max(0, i - 1);
        else {
          target = i + 1;
          if (target >= rvwRxState.items.length) {
            rvwRxState.items.push({ drug_name: '', quantity: 10, unit: 'g' });
            renderRvRxList(m);
            setTimeout(function () {
              var n = container.querySelector('[data-rv-f="' + f + '"][data-rv-i="' + target + '"]');
              if (n) { n.focus(); if (n.select) n.select(); }
            }, 0);
            return;
          }
        }
        var next = container.querySelector('[data-rv-f="' + f + '"][data-rv-i="' + target + '"]');
        if (next) { next.focus(); if (next.select) next.select(); }
      });
    }

    // Total box
    var totalBox = m.element.querySelector('#rvrx-total');
    var priceEl  = m.element.querySelector('#rvrx-total-price');
    var weightEl = m.element.querySelector('#rvrx-total-weight');
    if (totalBox && priceEl && weightEl) {
      if (totalWeight > 0) {
        totalBox.style.display = '';
        priceEl.textContent  = HM.format.money(totalPrice);
        weightEl.textContent = totalWeight.toFixed(1) + ' g (over ' + days + ' days)';
      } else {
        totalBox.style.display = 'none';
      }
    }
  }

  function injectRvRxStyles() {
    if (document.getElementById('rvrx-style')) return;
    var s = document.createElement('style');
    s.id = 'rvrx-style';
    s.textContent =
      '.rx-dosage-input{width:70px;text-align:center;margin:0;padding:6px 8px;}' +
      '.rx-usage-presets{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;}' +
      '.rx-usage-chip{border:1px solid var(--border);background:#fff;color:var(--ink);padding:5px 11px;font-size:var(--text-xs);border-radius:999px;cursor:pointer;transition:all .15s;}' +
      '.rx-usage-chip:hover{border-color:var(--gold);background:rgba(201,146,42,.08);}' +
      '.rx-usage-chip.is-selected{border-color:var(--gold);background:rgba(201,146,42,.18);color:var(--ink);}' +
      '.rx-table{width:100%;border-collapse:collapse;font-size:var(--text-sm);}' +
      '.rx-table th{text-align:left;padding:4px 6px;border-bottom:1px solid var(--border);font-weight:500;color:var(--stone);}' +
      '.rx-table td{padding:4px 6px;border-bottom:1px dashed var(--border);}' +
      '.rx-col-num{width:28px;color:var(--stone);}' +
      '.rx-col-stock{width:24px;text-align:center;}' +
      '.rx-col-qty{width:90px;}' +
      '.rx-col-total-qty,.rx-col-total{width:90px;text-align:right;}' +
      '.rx-col-remove{width:28px;text-align:right;}' +
      '.rx-col-sub{font-size:10px;color:var(--stone);font-weight:400;}' +
      '.rx-line-name,.rx-line-qty{width:100%;border:1px solid var(--border);border-radius:var(--r-sm);padding:4px 8px;font-size:var(--text-sm);}' +
      '.rx-line-name:focus,.rx-line-qty:focus{outline:none;border-color:var(--gold);}' +
      '.rx-line-remove{background:none;border:none;color:var(--red-seal);cursor:pointer;padding:0 4px;}' +
      '.rx-total-box{background:var(--washi);padding:var(--s-3);border-radius:var(--r-md);border:1px solid var(--border);}' +
      '';
    document.head.appendChild(s);
  }

  function renderMiniConstitution(q) {
    var patterns = q.patterns || [];
    var primary = patterns.length ? (patterns[0].l || patterns[0].c || '—') : '—';
    var statusBadge = {
      pending:       '<span class="badge" style="font-size:9px;">⏳</span>',
      approved:      '<span class="badge badge--success" style="font-size:9px;">✓</span>',
      needs_changes: '<span class="badge badge--danger" style="font-size:9px;">!</span>',
    }[q.review_status || 'pending'] || '';
    return '<div class="flex gap-2 mb-2" style="align-items:center;">' +
      '<div style="width:40px;height:40px;border-radius:var(--r-sm);background:var(--washi);display:flex;align-items:center;justify-content:center;flex-shrink:0;">🧭</div>' +
      '<div style="flex:1;font-size:var(--text-xs);">' +
      '<div class="flex gap-1" style="align-items:center;">' + statusBadge +
      '<span class="text-muted">' + HM.format.date(q.created_at) + '</span></div>' +
      '<div style="font-weight:500;">' + HM.format.esc(primary) + '</div>' +
      '</div></div>';
  }

  // ── Shared row templates ───────────────────────────────────
  function tipRow(tip) {
    return '<div class="cr-tip-row" style="display:grid;grid-template-columns:60px 1fr 1fr auto;gap:6px;margin-bottom:6px;">' +
      '<input class="field-input field-input--boxed" name="tip_icon[]" placeholder="💡" value="' + HM.format.esc(tip.icon || '💡') + '" style="margin:0;padding:6px 10px;text-align:center;">' +
      '<input class="field-input field-input--boxed" name="tip_en[]" placeholder="English advice" value="' + HM.format.esc(tip.en || '') + '" style="margin:0;padding:6px 10px;">' +
      '<input class="field-input field-input--boxed" name="tip_zh[]" placeholder="中文建議" value="' + HM.format.esc(tip.zh || '') + '" style="margin:0;padding:6px 10px;">' +
      '<button type="button" class="btn btn--ghost btn--sm" data-remove-tip style="margin:0;">✕</button>' +
      '</div>';
  }

  function medRow(item) {
    return '<div class="tr-med-row" style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 6px; margin-bottom: 6px;">' +
      '<input class="field-input field-input--boxed" name="med_name[]" placeholder="Name (EN)" value="' + HM.format.esc(item.name || '') + '" style="margin:0;padding:6px 10px;">' +
      '<input class="field-input field-input--boxed" name="med_name_zh[]" placeholder="中文名" value="' + HM.format.esc(item.name_zh || '') + '" style="margin:0;padding:6px 10px;">' +
      '<input class="field-input field-input--boxed" name="med_note[]" placeholder="Dose / note" value="' + HM.format.esc(item.note || '') + '" style="margin:0;padding:6px 10px;">' +
      '<button type="button" class="btn btn--ghost btn--sm" data-remove-med style="margin:0;">✕</button>' +
      '</div>';
  }

  function defaultTips(d) {
    var tips = [];
    if ((d.qi_xu   || 0) <= -1) tips.push({ icon:'😴', en:'Rest adequately. Avoid overexertion. Tai Chi or walking.', zh:'適當休息，避免過勞，可練太極或散步。' });
    if ((d.qi_zhi  || 0) >=  1) tips.push({ icon:'🧘', en:'Practise deep breathing, meditation or journaling daily.', zh:'每日深呼吸、冥想或寫日記。' });
    if ((d.pi_wei  || 0) <= -1) tips.push({ icon:'🍚', en:'Warm, cooked meals at regular times. Do not skip breakfast.', zh:'定時進食溫熱食物，勿空腹。' });
    if ((d.xue_xu  || 0) <= -1) tips.push({ icon:'💤', en:'Sleep before 11pm. Eat iron-rich foods.', zh:'11點前入睡，多補血。' });
    if ((d.xue_yu  || 0) >=  1) tips.push({ icon:'🚶', en:'Walk 30 min/day. Avoid prolonged sitting.', zh:'每日步行30分鐘。' });
    if ((d.ti_re   || 0) <= -1) tips.push({ icon:'💧', en:'Drink 8 glasses of water. Avoid spicy foods.', zh:'多喝水，避免辛辣。' });
    if ((d.ti_han  || 0) <= -1) tips.push({ icon:'🧣', en:'Keep waist and knees warm. Ginger tea helps.', zh:'保暖，多飲薑茶。' });
    if ((d.shi_qi  || 0) >=  1) tips.push({ icon:'🏃', en:'Regular aerobic exercise. Low-sugar diet.', zh:'定期運動，低糖飲食。' });
    if ((d.shui_mian||0) <= -1) tips.push({ icon:'🌙', en:'Consistent sleep schedule. No screens 1hr before bed.', zh:'固定作息，睡前遠離螢幕。' });
    if ((d.min_li  || 0) >=  1) tips.push({ icon:'🛡️', en:'Identify and avoid allergy triggers. Strengthen immunity gradually.', zh:'找出過敏原並避免。' });
    if (!tips.length) tips.push({ icon:'⚖️', en:'Maintain your healthy routine — balanced diet, regular exercise, sleep.', zh:'維持健康作息。' });
    return tips;
  }

  // ── Submit handlers ───────────────────────────────────────
  async function submitConstitution(form, m, id, decision) {
    var data = {
      decision: decision,
      doctor_comment: form.querySelector('[name="doctor_comment"]').value.trim(),
      advice: {
        herbs: form.querySelector('#cr-herbs').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean),
        foods: form.querySelector('#cr-foods').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean),
        avoid: form.querySelector('#cr-avoid').value.trim(),
        tips:  collectTips(form),
      },
    };
    HM.form.setLoading(form, true);
    try {
      await HM.api.doctor.reviewConstitution(id, data);
      m.close();
      HM.ui.toast(decision === 'approved' ? 'Approved · 已批准' : 'Changes requested · 已要求修改', 'success');
      load();
    } catch (err) {
      HM.form.setLoading(form, false);
      HM.form.showGeneralError(form, err.message || 'Review failed');
    }
  }

  async function submitTongue(form, m, id, decision) {
    var comment = form.querySelector('textarea[name="comment"]').value.trim();
    var names    = Array.from(form.querySelectorAll('input[name="med_name[]"]')).map(function (x) { return x.value.trim(); });
    var namesZh  = Array.from(form.querySelectorAll('input[name="med_name_zh[]"]')).map(function (x) { return x.value.trim(); });
    var notes    = Array.from(form.querySelectorAll('input[name="med_note[]"]')).map(function (x) { return x.value.trim(); });

    var meds = [];
    for (var i = 0; i < names.length; i++) {
      if (names[i] || namesZh[i] || notes[i]) meds.push({ name: names[i], name_zh: namesZh[i], note: notes[i] });
    }

    HM.form.setLoading(form, true);
    try {
      await HM.api.doctor.reviewTongue(id, {
        decision: decision,
        comment: comment,
        medicine_suggestions: meds,
      });
      m.close();
      HM.ui.toast(decision === 'approved' ? 'Approved · 已批准' : 'Changes requested · 已要求修改', 'success');
      load();
    } catch (err) {
      HM.form.setLoading(form, false);
      HM.form.showGeneralError(form, err.message || 'Review failed');
    }
  }

  function collectTips(form) {
    var icons = Array.from(form.querySelectorAll('input[name="tip_icon[]"]')).map(function (x) { return x.value.trim(); });
    var ens   = Array.from(form.querySelectorAll('input[name="tip_en[]"]')).map(function (x) { return x.value.trim(); });
    var zhs   = Array.from(form.querySelectorAll('input[name="tip_zh[]"]')).map(function (x) { return x.value.trim(); });
    var out = [];
    for (var i = 0; i < icons.length; i++) {
      if (ens[i] || zhs[i]) out.push({ icon: icons[i] || '💡', en: ens[i], zh: zhs[i] });
    }
    return out;
  }

  HM.doctorPanels.reviews = { render: render };
})();
