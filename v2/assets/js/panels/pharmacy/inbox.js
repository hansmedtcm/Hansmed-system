/**
 * Prescription Inbox — unified view of:
 *   • Incoming Rx (doctor just issued, patient hasn't ordered yet)
 *   • Active orders attached to this pharmacy
 */
(function () {
  'use strict';
  HM.pharmPanels = HM.pharmPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Inbox · 處方</div>' +
      '<h1 class="page-title">Prescription Inbox</h1>' +
      '<p class="page-subtitle">Newly-issued prescriptions and active orders · 新處方與進行中訂單</p>' +
      '</div><div id="inbox-list"></div>';

    var container = document.getElementById('inbox-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.pharmacy.listPrescriptions();
      var items = res.data || [];
      if (!items.length) {
        HM.state.empty(container, { icon: '📋', title: 'No prescriptions', text: 'Newly-issued prescriptions will appear here' });
        return;
      }

      container.innerHTML = '';

      // Small counter banner so the pharmacy sees at a glance how many
      // Rx are waiting for the patient vs how many are already paid.
      var incoming = res.incoming_count || 0;
      var orders   = res.orders_count   || 0;
      container.insertAdjacentHTML('beforeend',
        '<div class="flex gap-2 mb-3">' +
        '<span class="aid-pill" style="background:rgba(201,146,42,0.12);color:#8a5b00;border:1px solid rgba(201,146,42,0.3);">' +
        '🆕 ' + incoming + ' incoming · 新處方</span>' +
        '<span class="aid-pill" style="background:rgba(76,127,84,0.12);color:var(--sage);border:1px solid rgba(76,127,84,0.3);">' +
        '🧾 ' + orders + ' active orders · 進行中訂單</span>' +
        '</div>');

      items.forEach(function (row) {
        var rx = row.prescription || {};
        var doctor = (rx.doctor && rx.doctor.doctor_profile) || {};
        var patient = (rx.patient && rx.patient.patient_profile) || {};

        // Administration method — instructions string from Rx issue
        // carries a line like "1 pack · 2× per day · 5 days · after
        // meals". Split into bullets for scan-ability.
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

        var isIncoming = row.kind === 'incoming';
        var card = document.createElement('div');
        card.className = 'card card--bordered mb-3';
        card.style.borderLeftColor = isIncoming ? 'var(--gold)' : (row.status === 'paid' ? 'var(--gold)' : 'var(--sage)');

        card.innerHTML =
          '<div class="flex-between mb-2">' +
            '<div>' +
              '<strong>' + HM.format.esc(row.order_no) + '</strong>' +
              (isIncoming ? ' <span class="aid-pill" style="background:rgba(201,146,42,0.15);color:#8a5b00;font-size:10px;padding:2px 8px;">NEW</span>' : '') +
              '<div class="text-xs text-muted mt-1">' +
                'Patient: ' + HM.format.esc(patient.full_name || 'Unknown') +
                ' · Doctor: ' + HM.format.esc(doctor.full_name || 'Unknown') +
                ' · ' + HM.format.relative(row.created_at) +
              '</div>' +
            '</div>' +
            HM.format.statusBadge(row.status) +
          '</div>' +
          (rx.diagnosis ? '<p class="text-sm mt-2"><strong>Dx · 診斷:</strong> ' + HM.format.esc(rx.diagnosis) + '</p>' : '') +
          // Delivery address — only present once the patient has placed
          // an order (incoming-only Rx have no address yet). Shown with
          // a distinct sage border so the packer spots it at a glance.
          (row.address
            ? (function () {
                var a = row.address;
                var line = [a.line1, a.line2].filter(Boolean).join(', ');
                var region = [a.city, a.state, a.postal_code, a.country].filter(Boolean).join(' ');
                return '<div class="mt-2" style="background:rgba(122,140,114,.08);padding:var(--s-2) var(--s-3);border-radius:var(--r-sm);border-left:2px solid var(--sage);">' +
                  '<div class="text-label" style="font-size:10px;">📦 Deliver to · 送貨地址</div>' +
                  '<div class="text-sm"><strong>' + HM.format.esc(a.recipient || '') + '</strong>' +
                  (a.phone ? ' · <span class="text-muted">' + HM.format.esc(a.phone) + '</span>' : '') + '</div>' +
                  '<div class="text-sm">' + HM.format.esc(line) + '</div>' +
                  '<div class="text-xs text-muted">' + HM.format.esc(region) + '</div>' +
                  '</div>';
              })()
            : '') +
          // Admin method block — only render when instructions have content
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
          '<div class="mt-3 flex gap-2 flex-wrap">' +
            (row.order_id
              ? '<button class="btn btn--outline btn--sm" onclick="location.hash=\'#/orders/' + row.order_id + '\'">View Order · 查看訂單</button>'
              : '<span class="text-xs text-muted" style="padding:8px 0;">Awaiting patient to place order · 待患者下單</span>') +
          '</div>';
        container.appendChild(card);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  HM.pharmPanels.inbox = { render: render };
})();
