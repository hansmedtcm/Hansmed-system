/**
 * Doctor Constitution Review Queue.
 *
 * When patients complete the AI Constitution Diagnosis (10-question
 * questionnaire), the report is saved with an AI-generated advice
 * template but WITHOUT being shown to the patient. It waits here for
 * the doctor to review, edit the advice template (herbs / foods /
 * avoid / tips), add a comment, then approve. After approval the
 * patient sees the doctor's final approved advice.
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  var state = { filter: 'pending' };

  // Template library mirrors the AI's herb/food map so the doctor gets
  // a ready-made starting point for every primary pattern.
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

  async function render(el) {
    state.filter = 'pending';
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Constitution Reviews · 體質審核</div>' +
      '<h1 class="page-title">AI Constitution Reports — Awaiting Approval</h1>' +
      '<p class="text-muted mt-1">Patients submit their 10-dimension constitution reports here. Review, edit the advice template (herbs / foods / lifestyle), then approve so the patient sees their final personalised plan. ' +
      '<span style="font-family: var(--font-zh);">10 維體質測評結果在此審核，您可編輯建議（草藥、飲食、生活），批准後患者才會看到最終報告。</span></p>' +
      '</div>' +

      '<div class="filter-bar mb-4">' +
      chip('pending', '⏳ Pending · 待審核', true) +
      chip('mine',    '✓ Reviewed by Me · 我已審核') +
      chip('all',     'All · 全部') +
      '</div>' +

      '<div id="cr-list"></div>';

    document.querySelectorAll('.filter-chip').forEach(function (c) {
      c.addEventListener('click', function () {
        document.querySelectorAll('.filter-chip').forEach(function (x) { x.classList.remove('is-active'); });
        c.classList.add('is-active');
        state.filter = c.getAttribute('data-filter');
        load();
      });
    });

    await load();
  }

  function chip(key, label, active) {
    return '<button class="filter-chip' + (active ? ' is-active' : '') + '" data-filter="' + key + '">' + label + '</button>';
  }

  async function load() {
    var container = document.getElementById('cr-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.doctor.listConstitutionReviews(state.filter);
      var items = res.data || [];
      if (!items.length) {
        HM.state.empty(container, {
          icon: '🧭',
          title: state.filter === 'pending' ? 'Nothing pending · 暫無待審核' : 'No results',
          text: state.filter === 'pending' ? 'All constitution reports are up to date.' : 'Try a different filter.',
        });
        return;
      }
      container.innerHTML = '';
      items.forEach(function (q) { container.appendChild(renderCard(q)); });
    } catch (e) { HM.state.error(container, e); }
  }

  function renderCard(q) {
    var card = document.createElement('div');
    card.className = 'card mb-3';
    var patterns = q.patterns || [];
    var alerts = q.safety_alerts || [];
    var primaryName = patterns.length ? (patterns[0].l || patterns[0].c || '—') : '—';

    var statusBadge = {
      pending:       '<span class="badge">⏳ Pending</span>',
      approved:      '<span class="badge badge--success">✓ Approved</span>',
      needs_changes: '<span class="badge badge--danger">Needs Changes</span>',
    }[q.review_status || 'pending'];

    card.innerHTML = '<div class="flex-between">' +
      '<div>' +
      '<div class="text-label text-gold mb-1">' + HM.format.datetime(q.created_at) + '</div>' +
      '<div class="card-title">Patient #' + q.patient_id + (q.patient_email ? ' · ' + HM.format.esc(q.patient_email) : '') + '</div>' +
      '<div class="text-sm text-muted mt-1">Primary pattern: <strong>' + HM.format.esc(primaryName) + '</strong></div>' +
      (alerts.length ? '<div class="text-sm mt-1" style="color: var(--red-seal);">⚠️ ' + alerts.length + ' safety alert(s)</div>' : '') +
      '</div>' +
      '<div style="text-align:right;">' +
      statusBadge +
      '<div class="mt-2"><button class="btn btn--primary btn--sm" data-review>Review · 審核</button></div>' +
      '</div>' +
      '</div>';

    card.querySelector('[data-review]').addEventListener('click', function () { openReviewModal(q.id); });
    return card;
  }

  async function openReviewModal(id) {
    var loading = HM.ui.modal({ size: 'xl', title: 'Loading…', content: '<div class="state state--loading"><div class="state-icon"></div></div>' });
    var res;
    try {
      res = await HM.api.doctor.getConstitutionReview(id);
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

    var content = '<div class="grid-2" style="gap: var(--s-5); align-items: start;">' +

      // LEFT — AI-generated raw report
      '<div>' +
      '<div class="text-label mb-2">Patient Report · 患者報告</div>' +
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

      '</div></div>' +

      // RIGHT — Editable advice template
      '<form id="cr-form">' +

      '<div class="text-label mb-2">Your Comment · 醫師備註</div>' +
      '<textarea name="doctor_comment" class="field-input field-input--boxed" rows="4" placeholder="Notes for the patient — what you confirm, what you adjust, what to watch for…">' + HM.format.esc(existingComment) + '</textarea>' +

      // Herbs
      '<div class="text-label mt-4 mb-2">🌿 Herbs (template from <em>' + HM.format.esc(primaryType) + '</em>)</div>' +
      '<textarea id="cr-herbs" class="field-input field-input--boxed" rows="3">' + HM.format.esc(advice.herbs.join(', ')) + '</textarea>' +
      '<div class="text-xs text-muted">Comma-separated. Edit freely — patient will only see what you leave here.</div>' +

      // Foods
      '<div class="text-label mt-4 mb-2">🍱 Beneficial Foods</div>' +
      '<textarea id="cr-foods" class="field-input field-input--boxed" rows="3">' + HM.format.esc(advice.foods.join(', ')) + '</textarea>' +

      // Avoid
      '<div class="text-label mt-4 mb-2">❌ Avoid</div>' +
      '<input id="cr-avoid" class="field-input field-input--boxed" value="' + HM.format.esc(advice.avoid) + '">' +

      // Tips
      '<div class="text-label mt-4 mb-2">💡 Lifestyle Tips</div>' +
      '<div id="cr-tips">' +
      advice.tips.map(tipRow).join('') +
      '</div>' +
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
      submit(form, m, id, 'needs_changes');
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submit(form, m, id, 'approved');
    });
  }

  function tipRow(tip) {
    return '<div class="cr-tip-row" style="display:grid;grid-template-columns:60px 1fr 1fr auto;gap:6px;margin-bottom:6px;">' +
      '<input class="field-input field-input--boxed" name="tip_icon[]" placeholder="💡" value="' + HM.format.esc(tip.icon || '💡') + '" style="margin:0;padding:6px 10px;text-align:center;">' +
      '<input class="field-input field-input--boxed" name="tip_en[]" placeholder="English advice" value="' + HM.format.esc(tip.en || '') + '" style="margin:0;padding:6px 10px;">' +
      '<input class="field-input field-input--boxed" name="tip_zh[]" placeholder="中文建議" value="' + HM.format.esc(tip.zh || '') + '" style="margin:0;padding:6px 10px;">' +
      '<button type="button" class="btn btn--ghost btn--sm" data-remove-tip style="margin:0;">✕</button>' +
      '</div>';
  }

  function defaultTips(d) {
    var tips = [];
    if ((d.qi_xu   || 0) <= -1) tips.push({ icon:'😴', en:'Rest adequately. Avoid overexertion. Tai Chi or walking.',               zh:'適當休息，避免過勞，可練太極或散步。' });
    if ((d.qi_zhi  || 0) >=  1) tips.push({ icon:'🧘', en:'Practise deep breathing, meditation or journaling daily.',               zh:'每日深呼吸、冥想或寫日記。' });
    if ((d.pi_wei  || 0) <= -1) tips.push({ icon:'🍚', en:'Warm, cooked meals at regular times. Do not skip breakfast.',            zh:'定時進食溫熱食物，勿空腹。' });
    if ((d.xue_xu  || 0) <= -1) tips.push({ icon:'💤', en:'Sleep before 11pm. Eat iron-rich foods.',                                zh:'11點前入睡，多補血。' });
    if ((d.xue_yu  || 0) >=  1) tips.push({ icon:'🚶', en:'Walk 30 min/day. Avoid prolonged sitting.',                              zh:'每日步行30分鐘。' });
    if ((d.ti_re   || 0) <= -1) tips.push({ icon:'💧', en:'Drink 8 glasses of water. Avoid spicy foods.',                           zh:'多喝水，避免辛辣。' });
    if ((d.ti_han  || 0) <= -1) tips.push({ icon:'🧣', en:'Keep waist and knees warm. Ginger tea helps.',                           zh:'保暖，多飲薑茶。' });
    if ((d.shi_qi  || 0) >=  1) tips.push({ icon:'🏃', en:'Regular aerobic exercise. Low-sugar diet.',                              zh:'定期運動，低糖飲食。' });
    if ((d.shui_mian||0) <= -1) tips.push({ icon:'🌙', en:'Consistent sleep schedule. No screens 1hr before bed.',                  zh:'固定作息，睡前遠離螢幕。' });
    if ((d.min_li  || 0) >=  1) tips.push({ icon:'🛡️', en:'Identify and avoid allergy triggers. Strengthen immunity gradually.',   zh:'找出過敏原並避免。' });
    if (!tips.length) tips.push({ icon:'⚖️', en:'Maintain your healthy routine — balanced diet, regular exercise, sleep.', zh:'維持健康作息。' });
    return tips;
  }

  async function submit(form, m, id, decision) {
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

  HM.doctorPanels.constitutionReviews = { render: render };
})();
