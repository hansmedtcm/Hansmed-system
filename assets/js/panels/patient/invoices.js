/**
 * Patient Invoices — list + printable viewer.
 *
 * Every successful payment (consultation fees, treatment fees, orders)
 * has a matching invoice. The viewer is a print-friendly modal that
 * the user can Ctrl/Cmd+P to save as PDF. No server-side PDF library
 * is needed, which keeps the Railway image slim.
 *
 * Exposed helpers:
 *   HM.patientPanels.invoices.render(el)  — the list view
 *   HM.patientPanels.invoices.show(id)    — pop the viewer directly from
 *                                           anywhere (Orders tab, Appt tab…)
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Invoices · 發票</div>' +
      '<h1 class="page-title">Payment Receipts</h1>' +
      '<p class="text-muted text-sm mt-1">Every successful payment is receipted here. Open one to print or save as PDF. ' +
      '<span style="font-family: var(--font-zh);">所有付款收據。可列印或儲存為 PDF。</span></p>' +
      '</div>' +
      '<div id="inv-list"></div>';
    await load();
  }

  async function load() {
    var host = document.getElementById('inv-list');
    HM.state.loading(host);
    try {
      var res = await HM.api.patient.listInvoices();
      var items = res.data || [];
      if (!items.length) {
        HM.state.empty(host, {
          icon: '🧾',
          title: 'No invoices yet',
          text: 'Your payment receipts will appear here after your first paid consultation or order.',
        });
        return;
      }
      host.innerHTML = '<div class="table-wrap"><table class="table table--responsive">' +
        '<thead><tr><th>Invoice #</th><th>Date</th><th>Type</th><th style="text-align:right;">Amount</th><th></th></tr></thead>' +
        '<tbody></tbody></table></div>';
      var tbody = host.querySelector('tbody');
      items.forEach(function (inv) {
        var typeLbl = inv.payable_type === 'appointment'
          ? '<span class="badge" style="background:rgba(74,144,217,.15);color:#4a90d9;">🩺 Consultation</span>'
          : '<span class="badge" style="background:rgba(122,140,114,.15);color:var(--sage);">💊 Order</span>';
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td data-label="Invoice"><strong>' + HM.format.esc(inv.invoice_no) + '</strong></td>' +
          '<td data-label="Date">' + HM.format.datetime(inv.paid_at) + '</td>' +
          '<td data-label="Type">' + typeLbl + '</td>' +
          '<td data-label="Amount" style="text-align:right;">' + HM.format.money(inv.amount) + '</td>' +
          '<td data-label="Actions"><button class="btn btn--outline btn--sm" data-view>📄 View</button></td>';
        tr.querySelector('[data-view]').addEventListener('click', function () { show(inv.id); });
        tbody.appendChild(tr);
      });
    } catch (e) { HM.state.error(host, e); }
  }

  async function show(id) {
    var loading = HM.ui.toast('Loading invoice…', 'info', 2000);
    try {
      var res = await HM.api.patient.getInvoice(id);
      renderViewer(res.invoice);
    } catch (e) {
      HM.ui.toast('Could not load invoice: ' + (e.message || 'Error'), 'danger');
    }
  }

  function renderViewer(inv) {
    injectStyle();
    var m = HM.ui.modal({
      size: 'lg',
      title: '🧾 Invoice ' + inv.invoice_no,
      content: buildHTML(inv),
    });
    var root = m.element.querySelector('.hm-invoice');
    var printBtn = m.element.querySelector('[data-print]');
    if (printBtn) printBtn.addEventListener('click', function () {
      // Open the invoice in a dedicated window for a clean print — strips
      // all modal chrome and site CSS that would show up in the printout.
      var w = window.open('', '_blank', 'width=820,height=1080');
      w.document.write(
        '<!doctype html><html><head><meta charset="utf-8"><title>' +
        HM.format.esc(inv.invoice_no) + '</title>' +
        '<style>' + printCss() + '</style>' +
        '</head><body>' + root.outerHTML +
        '<script>setTimeout(function(){window.print();},200);<\/script>' +
        '</body></html>'
      );
      w.document.close();
    });
  }

  function buildHTML(inv) {
    var items = (inv.items || []).map(function (it) {
      return '<tr>' +
        '<td>' + HM.format.esc(it.description) +
          (it.description_zh ? '<div class="inv-zh">' + HM.format.esc(it.description_zh) + '</div>' : '') +
        '</td>' +
        '<td class="inv-num">' + (it.quantity % 1 === 0 ? it.quantity : it.quantity.toFixed(2)) + '</td>' +
        '<td class="inv-num">' + HM.format.money(it.unit_price) + '</td>' +
        '<td class="inv-num">' + HM.format.money(it.line_total) + '</td>' +
      '</tr>';
    }).join('');

    var clinic = inv.clinic || {};
    var bill = inv.bill_to || {};
    var totals = inv.totals || {};

    return '<div class="hm-invoice">' +
      '<div class="inv-head">' +
        '<div>' +
          '<div class="inv-title">INVOICE · 發票</div>' +
          '<div class="inv-no">' + HM.format.esc(inv.invoice_no) + '</div>' +
          '<div class="inv-date">' + HM.format.datetime(inv.issued_at) + '</div>' +
        '</div>' +
        '<div class="inv-clinic">' +
          '<div class="inv-clinic-name">' + HM.format.esc(clinic.name || 'HansMed Modern TCM') + '</div>' +
          (clinic.address ? '<div>' + HM.format.esc(clinic.address) + '</div>' : '') +
          (clinic.phone   ? '<div>Tel: ' + HM.format.esc(clinic.phone) + '</div>' : '') +
          (clinic.email   ? '<div>' + HM.format.esc(clinic.email) + '</div>' : '') +
        '</div>' +
      '</div>' +

      '<div class="inv-meta">' +
        '<div><div class="inv-label">Bill To · 付款人</div>' +
          '<div><strong>' + HM.format.esc(bill.name || '') + '</strong></div>' +
          (bill.email   ? '<div>' + HM.format.esc(bill.email) + '</div>' : '') +
          (bill.phone   ? '<div>' + HM.format.esc(bill.phone) + '</div>' : '') +
          (bill.address ? '<div>' + HM.format.esc(bill.address) + '</div>' : '') +
        '</div>' +
        '<div><div class="inv-label">Payment · 付款資訊</div>' +
          '<div>Method: ' + HM.format.esc(inv.provider || '—') + '</div>' +
          (inv.provider_ref ? '<div>Ref: ' + HM.format.esc(inv.provider_ref) + '</div>' : '') +
          (inv.doctor_name   ? '<div>Doctor: ' + HM.format.esc(inv.doctor_name) + '</div>' : '') +
          (inv.pharmacy_name ? '<div>Pharmacy: ' + HM.format.esc(inv.pharmacy_name) + '</div>' : '') +
        '</div>' +
      '</div>' +

      '<table class="inv-items"><thead><tr>' +
        '<th>Description · 項目</th>' +
        '<th class="inv-num">Qty</th>' +
        '<th class="inv-num">Unit Price</th>' +
        '<th class="inv-num">Amount</th>' +
      '</tr></thead><tbody>' + items + '</tbody></table>' +

      '<div class="inv-totals">' +
        '<div><span>Subtotal · 小計</span><span>' + HM.format.money(totals.subtotal || 0) + '</span></div>' +
        (totals.tax > 0 ? '<div><span>Tax · 稅金</span><span>' + HM.format.money(totals.tax) + '</span></div>' : '') +
        '<div class="inv-grand"><span>TOTAL · 總計</span><span>' + HM.format.money(totals.total || 0) + '</span></div>' +
      '</div>' +

      '<div class="inv-footer">' +
        'Thank you for your trust in HansMed Modern TCM. · 感謝您的信任。' +
      '</div>' +

      '<div class="inv-actions">' +
        '<button type="button" class="btn btn--primary" data-print>🖨 Print / Save PDF · 列印/儲存</button>' +
      '</div>' +
    '</div>';
  }

  function injectStyle() {
    if (document.getElementById('inv-style')) return;
    var s = document.createElement('style');
    s.id = 'inv-style';
    s.textContent = printCss();
    document.head.appendChild(s);
  }

  function printCss() {
    return (
      '.hm-invoice{font-family:var(--font-body,sans-serif);color:#222;background:#fff;padding:24px 28px;border-radius:8px;max-width:720px;margin:0 auto;line-height:1.5;}' +
      '.inv-head{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:2px solid #222;margin-bottom:20px;}' +
      '.inv-title{font-size:24px;letter-spacing:.12em;font-weight:700;}' +
      '.inv-no{font-family:monospace;color:#555;margin-top:4px;font-size:14px;}' +
      '.inv-date{color:#666;font-size:13px;}' +
      '.inv-clinic{text-align:right;font-size:13px;color:#444;}' +
      '.inv-clinic-name{font-weight:600;font-size:15px;color:#222;}' +
      '.inv-meta{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;font-size:13px;}' +
      '.inv-label{font-size:10px;letter-spacing:.1em;color:#888;text-transform:uppercase;margin-bottom:6px;}' +
      '.inv-items{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px;}' +
      '.inv-items th{text-align:left;border-bottom:1px solid #222;padding:8px 6px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;}' +
      '.inv-items td{padding:10px 6px;border-bottom:1px dashed #ccc;vertical-align:top;}' +
      '.inv-items .inv-num{text-align:right;font-family:monospace;white-space:nowrap;}' +
      '.inv-zh{font-size:11px;color:#888;margin-top:2px;}' +
      '.inv-totals{display:grid;gap:4px;margin-left:auto;max-width:280px;font-size:13px;}' +
      '.inv-totals div{display:flex;justify-content:space-between;padding:4px 6px;}' +
      '.inv-grand{border-top:2px solid #222;margin-top:6px;padding-top:10px !important;font-weight:700;font-size:16px;}' +
      '.inv-footer{text-align:center;color:#888;font-size:12px;margin-top:24px;padding-top:16px;border-top:1px dashed #ccc;}' +
      '.inv-actions{text-align:center;margin-top:20px;}' +
      '@media print{.inv-actions,.modal-header,.modal-close{display:none !important;}body{background:#fff !important;}}'
    );
  }

  HM.patientPanels.invoices = { render: render, show: show };
})();
