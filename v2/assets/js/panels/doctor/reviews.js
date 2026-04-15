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
      var calls = [];
      if (state.type !== 'tongue')       calls.push(HM.api.doctor.listConstitutionReviews(state.filter));
      else                                calls.push(Promise.resolve({ data: [] }));
      if (state.type !== 'constitution') calls.push(HM.api.doctor.listTongueReviews(state.filter));
      else                                calls.push(Promise.resolve({ data: [] }));

      var results = await Promise.all(calls);
      var constitutions = (results[0] && results[0].data) || [];
      var tongues       = (results[1] && results[1].data) || [];

      var items = [];
      constitutions.forEach(function (c) {
        items.push({
          kind: 'constitution',
          id: c.id,
          patient_id: c.patient_id,
          patient_email: c.patient_email,
          created_at: c.created_at,
          review_status: c.review_status,
          extra: {
            patterns: c.patterns || [],
            safety_alerts: c.safety_alerts || [],
          },
        });
      });
      tongues.forEach(function (t) {
        var patient = t.patient || {};
        var report = t.constitution_report || {};
        var c = report.constitution || {};
        items.push({
          kind: 'tongue',
          id: t.id,
          patient_id: t.patient_id,
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

    var typeBadge = it.kind === 'tongue'
      ? '<span class="badge" style="background:rgba(184,150,90,.15);color:var(--gold);">👅 Tongue · 舌診</span>'
      : '<span class="badge" style="background:rgba(122,140,114,.15);color:var(--sage);">🧭 Constitution · 體質</span>';

    var summary = '';
    if (it.kind === 'tongue') {
      var x = it.extra;
      summary = (x.constitution_en ? '<strong>' + HM.format.esc(x.constitution_en) + '</strong>' : 'Analysis complete') +
        (x.health_score != null ? ' · Health ' + x.health_score + '/100' : '');
    } else {
      var patterns = it.extra.patterns || [];
      var alerts = it.extra.safety_alerts || [];
      summary = 'Primary: <strong>' + (patterns.length ? HM.format.esc(patterns[0].l || patterns[0].c || '—') : '—') + '</strong>' +
        (alerts.length ? ' · <span style="color:var(--red-seal);">⚠️ ' + alerts.length + ' alert(s)</span>' : '');
    }

    var patientLabel = 'Patient #' + it.patient_id + (it.patient_email ? ' · ' + HM.format.esc(it.patient_email) : '');
    var imgHtml = (it.kind === 'tongue' && it.extra.image_url)
      ? '<img src="' + HM.format.esc(it.extra.image_url) + '" style="width:70px;height:70px;object-fit:cover;border-radius:var(--r-md);border:1px solid var(--border);flex-shrink:0;">'
      : '<div style="width:70px;height:70px;border-radius:var(--r-md);background:var(--washi);display:flex;align-items:center;justify-content:center;font-size:1.8rem;flex-shrink:0;">' + (it.kind === 'tongue' ? '👅' : '🧭') + '</div>';

    card.innerHTML = '<div class="flex gap-3" style="align-items:flex-start;">' +
      imgHtml +
      '<div style="flex:1;">' +
      '<div class="flex gap-2 mb-1" style="align-items:center;flex-wrap:wrap;">' +
      typeBadge +
      statusBadge +
      '<span class="text-xs text-muted">' + HM.format.datetime(it.created_at) + '</span>' +
      '</div>' +
      '<div class="card-title">' + patientLabel + '</div>' +
      '<div class="text-sm text-muted mt-1">' + summary + '</div>' +
      '</div>' +
      '<div style="text-align:right;">' +
      '<button class="btn btn--primary btn--sm" data-review>Review · 審核</button>' +
      '</div>' +
      '</div>';

    card.querySelector('[data-review]').addEventListener('click', function () {
      if (it.kind === 'tongue') openTongueModal(it.id, it.patient_id);
      else                      openConstitutionModal(it.id, it.patient_id);
    });
    return card;
  }

  // ═══════════════════════════════════════════════════════════
  //  CONSTITUTION REVIEW MODAL  (with tongue context from same patient)
  // ═══════════════════════════════════════════════════════════
  async function openConstitutionModal(id, patientId) {
    var loading = HM.ui.modal({ size: 'xl', title: 'Loading…', content: '<div class="state state--loading"><div class="state-icon"></div></div>' });

    var res, tongueRes;
    try {
      // Fetch the report + related tongue scans for context in parallel.
      var results = await Promise.all([
        HM.api.doctor.getConstitutionReview(id),
        HM.api.doctor.patientTongue(patientId).catch(function () { return { data: [] }; }),
      ]);
      res = results[0];
      tongueRes = results[1];
    } catch (e) {
      loading.close();
      HM.ui.toast(e.message || 'Failed to load', 'danger');
      return;
    }
    loading.close();

    var qRow = res.questionnaire;
    var report = qRow.report || {};
    var patterns = report.patterns || [];
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

    var content = '<div class="grid-2" style="gap: var(--s-5); align-items: start;">' +

      // ─── LEFT — patient report + tongue context ───
      '<div>' +
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

      '<div class="text-xs text-muted mb-2">10 Dimensions</div>' +
      '<table style="width:100%;font-size:var(--text-xs);">' +
      Object.keys(dims).map(function (k) {
        var v = dims[k];
        var color = v === 0 ? 'var(--sage)' : Math.abs(v) >= 2 ? 'var(--red-seal)' : 'var(--gold)';
        return '<tr><td style="padding:2px 0;">' + k + '</td><td style="padding:2px 0;text-align:right;color:' + color + ';font-weight:500;">[' + (v > 0 ? '+' + v : v) + ']</td></tr>';
      }).join('') +
      '</table>' +

      (alerts.length ? (
        '<div class="alert alert--danger mt-3"><div class="alert-body text-xs">' +
        '<strong>⚠️ Safety Alerts</strong><br>' +
        alerts.map(function (a) { return '• ' + HM.format.esc(a.alert || ''); }).join('<br>') +
        '</div></div>'
      ) : '') +

      '</div>' +

      // Tongue context for the same patient
      '<div class="text-label mt-4 mb-2">👅 Recent Tongue Scans · 近期舌診</div>' +
      (tongueScans.length
        ? '<div class="card" style="padding: var(--s-3);">' +
          tongueScans.map(renderMiniTongue).join('') +
          '</div>'
        : '<div class="card" style="padding: var(--s-3);"><p class="text-xs text-muted" style="margin:0;">No tongue scans on file for this patient.</p></div>') +

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

      '<div class="flex gap-2 mt-4">' +
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

    var res, constRes;
    try {
      var results = await Promise.all([
        HM.api.doctor.getTongueReview(id),
        HM.api.doctor.patientConstitutionReports(patientId).catch(function () { return { data: [] }; }),
      ]);
      res = results[0];
      constRes = results[1];
    } catch (e) {
      loading.close();
      HM.ui.toast(e.message || 'Failed to load', 'danger');
      return;
    }
    loading.close();

    var d = res.diagnosis;
    var report = d.constitution_report || {};
    var c = report.constitution || {};
    var findings = report.findings || [];
    var recs = report.recommendations || [];
    var existingMeds = d.medicine_suggestions || [];
    var constReports = (constRes && constRes.data) ? constRes.data.slice(0, 3) : [];

    var content = '<div class="grid-2" style="gap: var(--s-5); align-items: start;">' +

      // ─── LEFT — tongue result + constitution context ───
      '<div>' +
      '<div class="text-label mb-2">👅 AI Tongue Analysis · AI 舌診</div>' +
      '<div class="card" style="padding: var(--s-4);">' +
      (d.image_url ? '<img src="' + HM.format.esc(d.image_url) + '" style="width: 100%; border-radius: var(--r-md); border: 1px solid var(--border); margin-bottom: var(--s-3);">' : '') +
      (c.name_en ? '<div class="card-title">' + HM.format.esc(c.name_en) + '</div>' : '') +
      (c.name_zh ? '<div class="text-sm text-muted" style="font-family: var(--font-zh);">' + HM.format.esc(c.name_zh) + '</div>' : '') +
      (d.health_score != null ? '<div class="text-sm mt-2">Health Score: <strong>' + d.health_score + '/100</strong></div>' : '') +

      (findings.length ? ('<div class="text-label mt-4 mb-2">Findings</div>' +
        '<ul class="text-xs text-muted" style="list-style: none; padding: 0;">' +
        findings.map(function (f) {
          return '<li style="padding: 4px 0; border-bottom: 1px solid var(--border);">' +
            '<strong>' + HM.format.esc((f.category || '').replace(/_/g, ' ')) + ':</strong> ' +
            HM.format.esc(f.value || '—') + '</li>';
        }).join('') + '</ul>') : '') +

      (recs.length ? ('<div class="text-label mt-4 mb-2">AI Lifestyle Suggestions</div>' +
        '<ul class="text-xs text-muted" style="padding-left: 18px;">' +
        recs.map(function (r) { return '<li>' + HM.format.esc(r) + '</li>'; }).join('') +
        '</ul>') : '') +

      '</div>' +

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

      '<div class="flex gap-2 mt-4">' +
      '<button type="button" class="btn btn--danger btn--sm" data-decision="needs_changes">Request Changes · 要求修改</button>' +
      '<button type="submit" class="btn btn--primary btn--block" data-decision="approved">✓ Approve · 批准</button>' +
      '</div>' +
      '</form>' +
      '</div>';

    var m = HM.ui.modal({ size: 'xl', title: 'Review Tongue Diagnosis · 審核舌診', content: content });

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
