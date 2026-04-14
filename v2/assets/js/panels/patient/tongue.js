/**
 * Tongue Scan — upload + history + detail
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Tongue Diagnosis · 舌診</div>' +
      '<h1 class="page-title">AI Tongue Analysis · 人工智能舌診</h1>' +
      '<p class="page-subtitle">Upload a photo of your tongue for AI-assisted analysis based on classical TCM.<br>' +
      '<span style="font-family: var(--font-zh);">上傳舌頭照片，AI 根據古典中醫學為您分析體質。</span></p>' +
      '</div>' +

      '<div class="card card--pad-lg mb-6" style="max-width: 700px;">' +
      '<h3 class="mb-3">📷 New Tongue Scan · 新舌診</h3>' +
      '<p class="text-muted text-sm mb-4"><strong>Tips for best results · 最佳效果小貼士：</strong><br>' +
      '• Natural lighting, no filter · 自然光線，不使用濾鏡<br>' +
      '• Extend tongue fully, relaxed · 舌頭完全伸出，放鬆<br>' +
      '• Clean tongue (not right after eating) · 乾淨舌面（勿剛進食後）<br>' +
      '• Phone camera, 1-2 feet away · 手機距離 30-60 公分</p>' +
      '<label class="btn btn--primary btn--lg btn--block" style="cursor: pointer;">' +
      '📷 Upload Tongue Photo · 上傳舌頭照片' +
      '<input type="file" accept="image/*" capture="environment" id="tongue-file" style="display:none;">' +
      '</label>' +
      '<div id="tongue-analyzing" style="display:none; margin-top: var(--s-4);"></div>' +
      '</div>' +

      '<div class="text-label mb-3">Scan History · 舌診歷史記錄</div>' +
      '<div id="tongue-list"></div>';

    document.getElementById('tongue-file').addEventListener('change', handleUpload);
    await loadHistory();
  }

  async function handleUpload(e) {
    var file = e.target.files[0];
    if (!file) return;

    var box = document.getElementById('tongue-analyzing');
    box.style.display = 'block';
    box.innerHTML = '' +
      '<div class="flex flex-gap-3" style="align-items: center;">' +
      '<img id="tongue-preview" style="width: 80px; height: 80px; object-fit: cover; border-radius: var(--r-md); border: 1px solid var(--border);">' +
      '<div><strong>✓ Photo uploaded · 照片已上傳</strong><div class="text-muted text-sm mt-1"><span class="spinner"></span> Analyzing… · 分析中…</div></div>' +
      '</div>';

    var reader = new FileReader();
    reader.onload = function (ev) {
      document.getElementById('tongue-preview').src = ev.target.result;
    };
    reader.readAsDataURL(file);

    try {
      var res = await HM.api.patient.uploadTongue(file);
      var diag = res.diagnosis;
      pollForResult(diag.id);
    } catch (err) {
      box.innerHTML = '<div class="alert alert--danger"><div class="alert-body">' + (err.message || 'Upload failed') + '</div></div>';
    }
  }

  async function pollForResult(id) {
    var attempts = 0;
    var box = document.getElementById('tongue-analyzing');
    var interval = setInterval(async function () {
      attempts++;
      try {
        var res = await HM.api.patient.getDiagnosis(id);
        if (res.diagnosis.status === 'completed') {
          clearInterval(interval);
          showResult(res.diagnosis, box);
          loadHistory();
        } else if (res.diagnosis.status === 'failed' || attempts > 30) {
          clearInterval(interval);
          box.innerHTML = '<div class="alert alert--danger"><div class="alert-body">Analysis failed. Please try again. · 分析失敗，請重試。</div></div>';
        }
      } catch {}
    }, 3000);
  }

  function showResult(diag, box) {
    var report = diag.constitution_report || {};
    var constitution = report.constitution || {};
    var findings = report.findings || [];

    var html = '<div class="card card--bordered" style="border-left-color: var(--sage);">' +
      '<div class="flex-between mb-3"><strong>✓ Analysis Complete · 分析完成</strong>' +
      '<a href="#/tongue/' + diag.id + '" class="btn btn--ghost btn--sm">View Details · 詳情 →</a></div>';

    if (constitution.name_en) {
      html += '<div class="mb-3">' +
        '<div class="text-label">Constitution · 體質類型</div>' +
        '<div class="card-title">' + HM.format.esc(constitution.name_en) + '</div>' +
        (constitution.name_zh ? '<div class="text-muted text-sm" style="font-family: var(--font-zh);">' + constitution.name_zh + '</div>' : '') +
        '</div>';
    }

    if (diag.health_score != null) {
      var color = diag.health_score >= 80 ? 'var(--sage)' : diag.health_score >= 60 ? 'var(--gold)' : 'var(--red-seal)';
      html += '<div class="mb-3">Health Score · 健康評分: <strong style="font-size: 1.5rem; color: ' + color + ';">' + diag.health_score + '</strong>/100</div>';
    }

    if (findings.length) {
      html += '<div class="grid-2 mb-3" style="gap: var(--s-2);">';
      findings.forEach(function (f) {
        html += '<div style="background: var(--washi); padding: var(--s-3); border-radius: var(--r-md);">' +
          '<div class="text-label" style="font-size: 0.6rem;">' + (f.category || '').replace(/_/g, ' ') + '</div>' +
          '<div class="text-sm">' + HM.format.esc(f.value || '—') + '</div>' +
          '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    box.innerHTML = html;
  }

  async function loadHistory() {
    var container = document.getElementById('tongue-list');
    if (!container) return;
    HM.state.loading(container);
    try {
      var res = await HM.api.patient.listDiagnoses();
      var items = res.data || [];

      if (!items.length) {
        HM.state.empty(container, {
          icon: '👅',
          title: 'No scans yet · 暫無記錄',
          text: 'Your tongue diagnosis history will appear here · 您的舌診記錄將會顯示於此',
        });
        return;
      }

      container.innerHTML = '';
      items.forEach(function (d) {
        var report = d.constitution_report || {};
        var c = report.constitution || {};
        var data = {
          id: d.id,
          created_at: d.created_at,
          image_url: d.image_url,
          constitution_name: c.name_en || 'Analysis complete',
          features_summary: [d.tongue_color, d.coating, d.shape].filter(Boolean).map(function (x) { return (x || '').replace(/_/g, ' '); }).join(' · '),
          health_score: d.health_score || '—',
        };
        var node = HM.render.fromTemplate('tpl-tongue-card', data);
        node.querySelector('[data-action="view"]').addEventListener('click', function () {
          location.hash = '#/tongue/' + d.id;
        });
        container.appendChild(node);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  async function renderDetail(el, id) {
    HM.state.loading(el);
    try {
      var res = await HM.api.patient.getDiagnosis(id);
      var d = res.diagnosis;
      var report = d.constitution_report || {};
      var c = report.constitution || {};
      var findings = report.findings || [];
      var recs = report.recommendations || [];

      var html = '<div class="page-header">' +
        '<button class="btn btn--ghost" onclick="location.hash=\'#/tongue\'">← Back to History · 返回記錄</button>' +
        '</div>' +
        '<div class="grid-2" style="gap: var(--s-6); align-items: start;">' +
        '<div><img src="' + HM.format.esc(d.image_url) + '" style="width: 100%; border-radius: var(--r-md); border: 1px solid var(--border);"></div>' +
        '<div>' +
        '<div class="text-label mb-2">' + HM.format.datetime(d.created_at) + '</div>';

      if (c.name_en) {
        html += '<h2 class="mb-2">' + HM.format.esc(c.name_en) + '</h2>';
        if (c.name_zh) html += '<p class="text-muted mb-4" style="font-family: var(--font-zh);">' + c.name_zh + '</p>';
      }

      if (d.health_score != null) {
        var color = d.health_score >= 80 ? 'var(--sage)' : d.health_score >= 60 ? 'var(--gold)' : 'var(--red-seal)';
        html += '<div class="card mb-4"><div class="text-label mb-1">Health Score · 健康評分</div><strong style="font-size: 2.5rem; color: ' + color + ';">' + d.health_score + '</strong>/100</div>';
      }

      html += '</div></div>';

      if (findings.length) {
        html += '<div class="mt-6"><div class="text-label mb-3">Diagnostic Findings · 檢查結果</div>' +
          '<div class="grid-auto" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">';
        findings.forEach(function (f) {
          html += '<div class="card">' +
            '<div class="text-label" style="font-size: 0.65rem;">' + (f.category || '').replace(/_/g, ' ') + '</div>' +
            '<div class="text-sm mt-1">' + HM.format.esc(f.value || '—') + '</div>' +
            (f.value_zh ? '<div class="text-xs text-muted mt-1">' + HM.format.esc(f.value_zh) + '</div>' : '') +
            (f.indication_en ? '<div class="text-xs text-muted mt-2" style="font-style: italic;">' + HM.format.esc(f.indication_en) + '</div>' : '') +
            '</div>';
        });
        html += '</div></div>';
      }

      if (recs.length) {
        html += '<div class="mt-6"><div class="text-label mb-3">Lifestyle Recommendations · 養生建議</div>' +
          '<div class="card"><ul style="padding: 0; list-style: none;">';
        recs.forEach(function (r) {
          html += '<li style="padding: var(--s-2) 0; border-bottom: 1px solid var(--border); font-size: var(--text-sm);">• ' + HM.format.esc(r) + '</li>';
        });
        html += '</ul></div></div>';
      }

      el.innerHTML = html;
    } catch (e) { HM.state.error(el, e); }
  }

  HM.patientPanels.tongue = { render: render, renderDetail: renderDetail };
})();
