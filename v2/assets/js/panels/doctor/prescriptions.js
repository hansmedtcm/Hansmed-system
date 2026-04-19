/**
 * Doctor Prescriptions — issued list + PDF + Revise modal + Revoke
 *
 * PDF: the documents endpoint sits behind auth:sanctum, so a plain
 *      <a href> returns 401. We fetch the PDF with the Bearer token
 *      as a blob and open an object URL instead.
 *
 * Revise: opens a modal pre-filled from the parent Rx so the doctor
 *         can tweak diagnosis / instructions / items and POST to
 *         /doctor/prescriptions/{id}/revise — backend archives the
 *         parent (status=revised) and creates a new child Rx.
 *
 * Every card now surfaces the administration block
 * (pack × times × days + usage notes) parsed from the stored
 * `instructions` field so the doctor can verify what the patient
 * and pharmacy actually see.
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Prescriptions · 處方</div>' +
      '<h1 class="page-title">Issued Prescriptions</h1>' +
      '</div><div id="rx-list"></div>';

    var container = document.getElementById('rx-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.doctor.listPrescriptions();
      var items = res.data || [];

      if (!items.length) {
        HM.state.empty(container, {
          icon: '📝',
          title: 'No prescriptions issued yet',
          text: 'Prescriptions you issue during consultations will appear here',
        });
        return;
      }

      container.innerHTML = '';
      items.forEach(function (rx) {
        var adminLines = (rx.instructions || '').split(/\n+/).filter(Boolean);

        var itemsHtml = (rx.items || []).map(function (i) {
          var sub = [];
          if (i.dosage)       sub.push(HM.format.esc(i.dosage));
          if (i.frequency)    sub.push(HM.format.esc(i.frequency));
          if (i.usage_method) sub.push(HM.format.esc(i.usage_method));
          return '<div style="padding:3px 0;font-size:var(--text-sm);">' +
            '<strong>' + HM.format.esc(i.drug_name) + '</strong> ' +
            HM.format.esc(String(i.quantity)) + (i.unit || 'g') +
            (sub.length ? ' <span class="text-xs text-muted">(' + sub.join(' · ') + ')</span>' : '') +
            '</div>';
        }).join('');

        var card = document.createElement('div');
        card.className = 'card mb-3';
        card.innerHTML =
          '<div class="flex-between mb-2">' +
            '<div>' +
              '<div class="text-label">' + HM.format.datetime(rx.created_at) + '</div>' +
              '<strong>' + HM.format.esc(rx.diagnosis || 'Prescription #' + rx.id) + '</strong>' +
              '<div class="text-xs text-muted">Patient #' + rx.patient_id +
              (rx.duration_days ? ' · ' + rx.duration_days + ' days' : '') + '</div>' +
            '</div>' +
            HM.format.statusBadge(rx.status) +
          '</div>' +

          // Administration block — surfaced prominently
          (adminLines.length
            ? '<div class="mt-2 mb-3" style="background:var(--washi);padding:var(--s-2) var(--s-3);border-radius:var(--r-sm);border-left:2px solid var(--gold);">' +
              '<div class="text-label" style="font-size:10px;">Administration · 服用方法</div>' +
              adminLines.map(function (l) { return '<div class="text-sm">' + HM.format.esc(l) + '</div>'; }).join('') +
              '</div>'
            : '') +

          // Herb items
          '<div class="mt-2" style="background:#fff;border:1px solid var(--border);border-radius:var(--r-sm);padding:var(--s-2) var(--s-3);">' +
            '<div class="text-label mb-1">Herbs · 藥材 (' + (rx.items || []).length + ')</div>' +
            (itemsHtml || '<div class="text-sm text-muted">No items</div>') +
          '</div>' +

          '<div class="flex flex-gap-2 mt-3">' +
            '<button class="btn btn--outline btn--sm" data-pdf>📄 PDF</button>' +
            // To edit an Rx the doctor re-enters the consultation —
            // re-submitting from there supersedes this one (old Rx is
            // deleted + pharmacy is notified again). See consult.js.
            (rx.status === 'issued' && rx.appointment_id
              ? '<button class="btn btn--outline btn--sm" data-edit>Edit in consult · 回診編輯</button>'
              : '') +
            (rx.status === 'issued'
              ? '<button class="btn btn--ghost btn--sm" data-revoke style="color: var(--red-seal);">Revoke · 撤銷</button>'
              : '') +
          '</div>';

        // PDF — authed blob download
        card.querySelector('[data-pdf]').addEventListener('click', async function () {
          HM.ui.toast('Opening PDF…', 'info');
          try {
            await HM.api.openAuthedFile('/documents/prescription/' + rx.id, 'prescription-' + rx.id + '.pdf');
          } catch (e) {
            HM.ui.toast(e.message || 'Could not load PDF', 'danger');
          }
        });

        var editBtn = card.querySelector('[data-edit]');
        if (editBtn) editBtn.addEventListener('click', function () {
          // Jump back into the consult view — consult.js pre-fills the
          // Rx pad with this Rx's items on load, the doctor edits, and
          // re-submitting supersedes the old Rx.
          location.hash = '#/consult/' + rx.appointment_id;
        });

        var revokeBtn = card.querySelector('[data-revoke]');
        if (revokeBtn) revokeBtn.addEventListener('click', async function () {
          var ok = await HM.ui.confirm('Revoke this prescription? · 撤銷此處方？', { danger: true });
          if (!ok) return;
          try {
            await HM.api.doctor.revokePrescription(rx.id);
            HM.ui.toast('Prescription revoked · 已撤銷', 'success');
            render(el);
          } catch (e) { HM.ui.toast(e.message || 'Failed', 'danger'); }
        });

        container.appendChild(card);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  /**
   * Revise modal. Pre-fills every line from the parent Rx and lets
   * the doctor edit them inline. On submit, the backend archives
   * the parent (status=revised) and creates a new child Rx.
   */
  function openReviseModal(rx, onDone) {
    var items = (rx.items || []).map(function (i) {
      return {
        drug_name: i.drug_name,
        quantity:  i.quantity,
        unit:      i.unit || 'g',
        dosage:    i.dosage || '',
        frequency: i.frequency || '',
        usage_method: i.usage_method || '',
      };
    });
    if (! items.length) items.push({ drug_name: '', quantity: 0, unit: 'g' });

    var contentHtml =
      '<div class="field"><label class="field-label">Diagnosis · 診斷</label>' +
      '<input id="rv-dx" class="field-input field-input--boxed" value="' + HM.format.esc(rx.diagnosis || '') + '"></div>' +

      '<div class="field mt-3"><label class="field-label">Instructions (administration) · 服用方法</label>' +
      '<textarea id="rv-inst" class="field-input field-input--boxed" rows="3">' +
      HM.format.esc(rx.instructions || '') + '</textarea></div>' +

      '<div class="field mt-3"><label class="field-label">Duration (days) · 療程天數</label>' +
      '<input id="rv-days" type="number" min="1" max="365" class="field-input field-input--boxed" value="' +
      (rx.duration_days || 7) + '"></div>' +

      '<div class="mt-4">' +
      '<div class="text-label mb-2">Herb Items · 藥材清單</div>' +
      '<div id="rv-items"></div>' +
      '<button type="button" class="btn btn--outline btn--sm mt-2" id="rv-add">+ Add Herb · 新增藥材</button>' +
      '</div>' +

      '<div class="flex flex-gap-3 mt-6" style="justify-content:flex-end;">' +
      '<button type="button" class="btn btn--ghost" id="rv-cancel">Cancel · 取消</button>' +
      '<button type="button" class="btn btn--primary" id="rv-submit">Submit revision · 送出修改</button>' +
      '</div>';

    var modal = HM.ui.modal({
      title: 'Revise Prescription · 修改處方',
      content: contentHtml,
      size: 'lg',
    });

    function renderItems() {
      var host = document.getElementById('rv-items');
      host.innerHTML = '';
      items.forEach(function (it, idx) {
        var row = document.createElement('div');
        row.className = 'flex gap-2 mb-2';
        row.style.alignItems = 'center';
        row.innerHTML =
          '<input data-rv-f="drug_name" data-rv-i="' + idx + '" class="field-input field-input--boxed" ' +
            'placeholder="Drug · 藥名" value="' + HM.format.esc(it.drug_name) + '" style="flex:2;">' +
          '<input data-rv-f="quantity" data-rv-i="' + idx + '" class="field-input field-input--boxed" ' +
            'type="number" step="0.1" min="0" placeholder="Qty" value="' + (it.quantity || '') + '" style="flex:1;">' +
          '<input data-rv-f="unit" data-rv-i="' + idx + '" class="field-input field-input--boxed" ' +
            'placeholder="Unit" value="' + HM.format.esc(it.unit) + '" style="width:70px;">' +
          '<button type="button" data-rv-del="' + idx + '" class="btn btn--ghost btn--sm" style="color:var(--red-seal);">✕</button>';
        host.appendChild(row);
      });
      host.querySelectorAll('[data-rv-f]').forEach(function (inp) {
        inp.addEventListener('input', function () {
          var i = parseInt(inp.getAttribute('data-rv-i'), 10);
          var f = inp.getAttribute('data-rv-f');
          items[i][f] = f === 'quantity' ? (parseFloat(inp.value) || 0) : inp.value;
        });
        // Arrow-down / Enter jumps to next drug_name (same as consult pad)
        inp.addEventListener('keydown', function (ev) {
          if (ev.key !== 'ArrowDown' && ev.key !== 'Enter') return;
          var f = inp.getAttribute('data-rv-f');
          if (f !== 'quantity' && ev.key === 'ArrowDown') return;
          ev.preventDefault();
          var i = parseInt(inp.getAttribute('data-rv-i'), 10);
          var nextI = i + 1;
          if (nextI >= items.length) {
            items.push({ drug_name: '', quantity: 0, unit: 'g' });
            renderItems();
          }
          setTimeout(function () {
            var next = document.querySelector('[data-rv-f="' + f + '"][data-rv-i="' + nextI + '"]');
            if (next) { next.focus(); if (next.select) next.select(); }
          }, 0);
        });
      });
      host.querySelectorAll('[data-rv-del]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var i = parseInt(btn.getAttribute('data-rv-del'), 10);
          items.splice(i, 1);
          if (! items.length) items.push({ drug_name: '', quantity: 0, unit: 'g' });
          renderItems();
        });
      });
    }

    // Defer so the modal body exists in the DOM before we populate it.
    setTimeout(function () {
      renderItems();
      var addBtn = document.getElementById('rv-add');
      if (addBtn) addBtn.addEventListener('click', function () {
        items.push({ drug_name: '', quantity: 0, unit: 'g' });
        renderItems();
      });
      var cancelBtn = document.getElementById('rv-cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', function () { modal.close(); });
      var submitBtn = document.getElementById('rv-submit');
      if (submitBtn) submitBtn.addEventListener('click', submit);
    }, 0);

    async function submit() {
      var clean = items.filter(function (it) { return it.drug_name && it.quantity > 0; });
      if (! clean.length) { HM.ui.toast('Add at least one herb · 至少一項藥材', 'warning'); return; }
      try {
        await HM.api.doctor.revisePrescription(rx.id, {
          diagnosis:     document.getElementById('rv-dx').value,
          instructions:  document.getElementById('rv-inst').value,
          duration_days: parseInt(document.getElementById('rv-days').value, 10) || null,
          items:         clean,
        });
        HM.ui.toast('Prescription revised · 已修改', 'success');
        if (modal && modal.close) modal.close();
        if (typeof onDone === 'function') onDone();
      } catch (e) {
        HM.ui.toast(e.message || 'Revision failed', 'danger');
      }
    }
  }

  HM.doctorPanels.prescriptions = { render: render };
})();
