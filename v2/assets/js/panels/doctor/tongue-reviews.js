/**
 * Doctor Tongue Diagnosis Review Queue.
 *
 * Shows pending AI tongue analyses for doctor approval. Doctor can review
 * the AI findings, edit the medicine suggestions, add a comment, and
 * approve or request changes. The patient sees the outcome on their
 * tongue report.
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  var state = { filter: 'pending' };

  async function render(el) {
    state.filter = 'pending';
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Tongue Reviews · 舌診審核</div>' +
      '<h1 class="page-title">AI Tongue Analyses — Awaiting Approval</h1>' +
      '<p class="text-muted mt-1">AI analyses patient tongue photos and sends results here for your review. Approve, edit medicine suggestions, or request changes. ' +
      '<span style="font-family: var(--font-zh);">AI 分析結果送至此審核，您可批准、編輯藥物建議或要求修改。</span></p>' +
      '</div>' +

      '<div class="filter-bar mb-4">' +
      chip('pending', '⏳ Pending · 待審核', true) +
      chip('mine',    '✓ Reviewed by Me · 我已審核') +
      chip('all',     'All · 全部') +
      '</div>' +

      '<div id="tr-list"></div>';

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
    var container = document.getElementById('tr-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.doctor.listTongueReviews(state.filter);
      var items = res.data || [];
      if (!items.length) {
        HM.state.empty(container, {
          icon: '👅',
          title: state.filter === 'pending' ? 'Nothing pending · 暫無待審核' : 'No results',
          text: state.filter === 'pending' ? 'All tongue analyses are up to date. Nicely done!' : 'Try a different filter.',
        });
        return;
      }
      container.innerHTML = '';
      items.forEach(function (d) { container.appendChild(renderCard(d)); });
    } catch (e) { HM.state.error(container, e); }
  }

  function renderCard(d) {
    var card = document.createElement('div');
    card.className = 'card mb-3';
    var report = d.constitution_report || {};
    var c = report.constitution || {};
    var patient = d.patient || {};
    var patientLabel = 'Patient #' + d.patient_id + (patient.email ? ' · ' + patient.email : '');

    var statusBadge = {
      pending:       '<span class="badge">⏳ Pending</span>',
      approved:      '<span class="badge badge--success">✓ Approved</span>',
      needs_changes: '<span class="badge badge--danger">Needs Changes</span>',
    }[d.review_status || 'pending'];

    card.innerHTML = '<div class="flex gap-4" style="align-items:flex-start;">' +
      (d.image_url ? '<img src="' + HM.format.esc(d.image_url) + '" style="width: 90px; height: 90px; object-fit: cover; border-radius: var(--r-md); border: 1px solid var(--border); flex-shrink: 0;">' : '') +
      '<div style="flex:1;">' +
      '<div class="flex-between mb-2">' +
      '<div><div class="text-label text-gold">' + HM.format.datetime(d.created_at) + '</div>' +
      '<div class="card-title mt-1">' + HM.format.esc(patientLabel) + '</div></div>' +
      statusBadge +
      '</div>' +
      '<div class="text-sm">' +
      (c.name_en ? '<div><strong>' + HM.format.esc(c.name_en) + '</strong>' + (c.name_zh ? ' · <span style="font-family: var(--font-zh);">' + c.name_zh + '</span>' : '') + '</div>' : '') +
      (d.health_score != null ? '<div class="text-muted">Health Score: ' + d.health_score + '/100</div>' : '') +
      '</div>' +
      '<div class="flex gap-2 mt-3">' +
      '<button class="btn btn--primary btn--sm" data-review="' + d.id + '">Review · 審核</button>' +
      '</div>' +
      '</div></div>';

    card.querySelector('[data-review]').addEventListener('click', function () { openReviewModal(d); });
    return card;
  }

  function openReviewModal(d) {
    var report = d.constitution_report || {};
    var c = report.constitution || {};
    var findings = report.findings || [];
    var recs = report.recommendations || [];
    var existingMeds = d.medicine_suggestions || [];

    var content = '<div class="grid-2" style="gap: var(--s-5); align-items: start;">' +

      // LEFT: AI result
      '<div>' +
      (d.image_url ? '<img src="' + HM.format.esc(d.image_url) + '" style="width: 100%; border-radius: var(--r-md); border: 1px solid var(--border); margin-bottom: var(--s-3);">' : '') +
      '<div class="text-label mb-1">AI Analysis · AI 分析結果</div>' +
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

      // RIGHT: Doctor review form
      '<form id="tr-form">' +

      '<div class="text-label mb-2">Your Comment · 您的審核意見</div>' +
      '<textarea name="comment" class="field-input field-input--boxed" rows="5" placeholder="Notes for the patient — anything the AI missed, concerns, encouragement…\n給患者的備註——AI 可能遺漏的要點、提醒或鼓勵。">' + HM.format.esc(d.doctor_comment || '') + '</textarea>' +

      '<div class="text-label mt-4 mb-2">Medicine Suggestions · 藥物建議</div>' +
      '<div id="tr-meds">' + (existingMeds.length ? existingMeds.map(medRow).join('') : medRow({name: '', name_zh: '', note: ''})) + '</div>' +
      '<button type="button" class="btn btn--ghost btn--sm" id="tr-add-med">+ Add Another</button>' +

      '<div class="alert alert--warning mt-4">' +
      '<div class="alert-body text-xs">' +
      '<strong>Safety check:</strong> only suggest herbs/formulas you would recommend given what you can see. The patient cannot fill complex multi-herb prescriptions from this comment — they must book a consultation for that.' +
      '</div></div>' +

      '<div data-general-error class="alert alert--danger" style="display:none;"></div>' +

      '<div class="flex gap-2 mt-4">' +
      '<button type="button" class="btn btn--danger btn--sm" data-decision="needs_changes">Request Changes · 要求修改</button>' +
      '<button type="submit" class="btn btn--primary btn--block" data-decision="approved">✓ Approve · 批准</button>' +
      '</div>' +
      '</form>' +
      '</div>';

    var m = HM.ui.modal({
      size: 'xl',
      title: 'Review Tongue Diagnosis · 審核舌診',
      content: content,
    });

    var form = m.element.querySelector('#tr-form');

    m.element.querySelector('#tr-add-med').addEventListener('click', function () {
      var host = m.element.querySelector('#tr-meds');
      host.insertAdjacentHTML('beforeend', medRow({name: '', name_zh: '', note: ''}));
    });

    // Hook up remove buttons (delegation)
    m.element.querySelector('#tr-meds').addEventListener('click', function (e) {
      if (e.target.matches('[data-remove-med]')) {
        e.target.closest('.tr-med-row').remove();
      }
    });

    // Decision: needs_changes (no form submit, different button)
    m.element.querySelector('[data-decision="needs_changes"]').addEventListener('click', function () {
      submitReview(form, m, d.id, 'needs_changes');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitReview(form, m, d.id, 'approved');
    });
  }

  function medRow(item) {
    return '<div class="tr-med-row" style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 6px; margin-bottom: 6px;">' +
      '<input class="field-input field-input--boxed" name="med_name[]" placeholder="Name (EN)" value="' + HM.format.esc(item.name || '') + '" style="margin:0;padding:6px 10px;">' +
      '<input class="field-input field-input--boxed" name="med_name_zh[]" placeholder="中文名" value="' + HM.format.esc(item.name_zh || '') + '" style="margin:0;padding:6px 10px;">' +
      '<input class="field-input field-input--boxed" name="med_note[]" placeholder="Dose / note" value="' + HM.format.esc(item.note || '') + '" style="margin:0;padding:6px 10px;">' +
      '<button type="button" class="btn btn--ghost btn--sm" data-remove-med style="margin:0;">✕</button>' +
      '</div>';
  }

  async function submitReview(form, m, id, decision) {
    var comment = form.querySelector('textarea[name="comment"]').value.trim();
    var names    = Array.from(form.querySelectorAll('input[name="med_name[]"]')).map(function (x) { return x.value.trim(); });
    var namesZh  = Array.from(form.querySelectorAll('input[name="med_name_zh[]"]')).map(function (x) { return x.value.trim(); });
    var notes    = Array.from(form.querySelectorAll('input[name="med_note[]"]')).map(function (x) { return x.value.trim(); });

    var meds = [];
    for (var i = 0; i < names.length; i++) {
      if (names[i] || namesZh[i] || notes[i]) {
        meds.push({ name: names[i], name_zh: namesZh[i], note: notes[i] });
      }
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

  HM.doctorPanels.tongueReviews = { render: render };
})();
