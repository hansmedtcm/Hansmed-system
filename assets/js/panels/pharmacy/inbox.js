/**
 * Prescription Inbox — PRE-ORDER heads-up.
 *
 * Shows only prescriptions the doctor has just issued that no patient
 * has paid for yet. Purpose: give the pharmacy a pipeline view so they
 * can pre-check stock + anticipate workload before the dispense chime
 * hits. Active dispensing work (paid / dispensing / shipped orders
 * with delivery addresses) lives under the Orders tab.
 */
(function () {
  'use strict';
  HM.pharmPanels = HM.pharmPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Inbox · 處方</div>' +
      '<h1 class="page-title">Prescription Inbox</h1>' +
      '<p class="page-subtitle">Newly-issued prescriptions waiting for patients to order · 新處方（尚未下單）</p>' +
      '<p class="text-xs text-muted mt-1">Tip: once a patient pays, the prescription moves to the Orders tab with the delivery address. ' +
      '<span style="font-family:var(--font-zh);">患者付款後會移至訂單頁（含收貨地址）。</span></p>' +
      '</div><div id="inbox-list"></div>';

    var container = document.getElementById('inbox-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.pharmacy.listPrescriptions();
      var items = res.data || [];
      if (!items.length) {
        HM.state.empty(container, {
          icon: '📋',
          title: 'No pending prescriptions · 暫無待處方',
          text: 'Newly-issued prescriptions will appear here before the patient pays.',
          actionText: 'Go to Orders · 前往訂單',
          actionHref: '#/orders',
        });
        return;
      }

      container.innerHTML = '';

      items.forEach(function (row) {
        var rx = row.prescription || {};
        var doctor = (rx.doctor && rx.doctor.doctor_profile) || {};
        var patient = (rx.patient && rx.patient.patient_profile) || {};

        var adminLine = (rx.instructions || '').split(/\n+/).filter(Boolean);

        var items_html = (rx.items || []).map(function (i) {
          var head = '<strong>' + HM.format.esc(i.drug_name) + '</strong> ' + i.quantity + (i.unit || 'g');
          var sub = [];
          if (i.dosage)       sub.push(HM.format.esc(i.dosage));
          if (i.frequency)    sub.push(HM.format.esc(i.frequency));
          if (i.usage_method) sub.push(HM.format.esc(i.usage_method));
          return '<div style="padding:4px 0;border-bottom:1px dashed var(--border);font-size:var(--text-sm);">' +
            head +
            (sub.length ? ' <span class="text-xs text-muted">(' + sub.join(' · ') + ')</span>' : '') +
            '</div>';
        }).join('');

        var card = document.createElement('div');
        card.className = 'card card--bordered mb-3';
        card.style.borderLeftColor = 'var(--gold)';

        card.innerHTML =
          '<div class="flex-between mb-2">' +
            '<div>' +
              '<strong>' + HM.format.esc(row.order_no) + '</strong>' +
              ' <span class="aid-pill" style="background:rgba(201,146,42,0.15);color:#8a5b00;font-size:10px;padding:2px 8px;">AWAITING PATIENT</span>' +
              '<div class="text-xs text-muted mt-1">' +
                'Patient: ' + HM.format.esc(patient.full_name || 'Unknown') +
                ' · Doctor: ' + HM.format.esc(doctor.full_name || 'Unknown') +
                ' · ' + HM.format.relative(row.created_at) +
              '</div>' +
            '</div>' +
          '</div>' +
          (rx.diagnosis ? '<p class="text-sm mt-2"><strong>Dx · 診斷:</strong> ' + HM.format.esc(rx.diagnosis) + '</p>' : '') +
          (adminLine.length
            ? '<div class="mt-2" style="background:var(--washi);padding:var(--s-2) var(--s-3);border-radius:var(--r-sm);border-left:2px solid var(--gold);">' +
              '<div class="text-label" style="font-size:10px;">Administration · 服用方法</div>' +
              adminLine.map(function (l) { return '<div class="text-sm">' + HM.format.esc(l) + '</div>'; }).join('') +
              '</div>'
            : '') +
          '<div class="mt-3" style="background:#fff;border:1px solid var(--border);border-radius:var(--r-sm);padding:var(--s-2) var(--s-3);">' +
            '<div class="text-label mb-1">Herbs · 藥材 (' + (rx.items || []).length + ')</div>' +
            (items_html || '<div class="text-sm text-muted">No items</div>') +
          '</div>' +
          '<div class="mt-3">' +
            '<span class="text-xs text-muted">Waiting for patient to place order · 待患者下單</span>' +
          '</div>';
        container.appendChild(card);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  HM.pharmPanels.inbox = { render: render };
})();
