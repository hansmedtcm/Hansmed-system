/**
 * Pharmacy Orders — list + dispense flow
 */
(function () {
  'use strict';
  HM.pharmPanels = HM.pharmPanels || {};

  var filter = '';

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Orders · 訂單</div>' +
      '<h1 class="page-title">Order Management</h1>' +
      '</div>' +
      '<div class="filter-bar">' +
      chip('', 'All') +
      chip('paid', 'New · 新訂單') +
      chip('dispensing', 'Dispensing · 配藥中') +
      chip('dispensed', 'Dispensed · 已配藥') +
      chip('shipped', 'Shipped · 已寄出') +
      chip('delivered', 'Delivered · 已送達') +
      '</div><div id="ord-list"></div>';

    document.querySelectorAll('.filter-chip').forEach(function (c) {
      c.addEventListener('click', function () {
        document.querySelectorAll('.filter-chip').forEach(function (x) { x.classList.remove('is-active'); });
        c.classList.add('is-active');
        filter = c.getAttribute('data-filter');
        load();
      });
    });
    await load();
  }

  function chip(f, l) { return '<button class="filter-chip ' + (f === filter ? 'is-active' : '') + '" data-filter="' + f + '">' + l + '</button>'; }

  async function load() {
    var container = document.getElementById('ord-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.pharmacy.listOrders(filter ? 'status=' + filter : '');
      var items = res.data || [];
      if (!items.length) {
        HM.state.empty(container, { icon: '📦', title: 'No orders', text: 'Orders will appear here when patients place them' });
        return;
      }
      container.innerHTML = '';
      items.forEach(function (o) {
        var itemsStr = (o.items || []).map(function (i) { return i.drug_name; }).join(', ');
        var card = document.createElement('div');
        card.className = 'card mb-3';
        var actions = '';
        if (o.status === 'paid') actions = '<button class="btn btn--primary btn--sm" data-action="start">Start Dispensing · 開始配藥</button>';
        else if (o.status === 'dispensing') actions = '<button class="btn btn--primary btn--sm" data-action="finish">Mark Dispensed · 完成配藥</button>';
        else if (o.status === 'dispensed') actions = '<button class="btn btn--primary btn--sm" data-action="ship">Ship · 寄出</button>';

        card.innerHTML = '<div class="flex-between mb-2">' +
          '<div><strong>' + HM.format.esc(o.order_no) + '</strong>' +
          '<div class="text-xs text-muted">' + HM.format.esc(HM.format.patientLabel(o)) + ' · ' + HM.format.date(o.created_at) + '</div></div>' +
          '<div style="text-align: right;">' + HM.format.statusBadge(o.status) + '<div class="text-lg mt-1"><strong>' + HM.format.money(o.total) + '</strong></div></div>' +
          '</div>' +
          '<p class="text-sm text-muted mb-3">' + HM.format.truncate(HM.format.esc(itemsStr), 100) + '</p>' +
          '<div class="flex flex-gap-2">' +
          '<button class="btn btn--outline btn--sm" data-action="view">View Details · 詳情</button>' + actions +
          '</div>';

        card.querySelector('[data-action="view"]').addEventListener('click', function () { location.hash = '#/orders/' + o.id; });
        var startBtn = card.querySelector('[data-action="start"]');
        var finishBtn = card.querySelector('[data-action="finish"]');
        var shipBtn = card.querySelector('[data-action="ship"]');
        if (startBtn) startBtn.addEventListener('click', function () { startDispense(o.id); });
        if (finishBtn) finishBtn.addEventListener('click', function () { finishDispense(o.id); });
        if (shipBtn) shipBtn.addEventListener('click', function () { shipOrder(o.id); });
        container.appendChild(card);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  async function startDispense(id) {
    try { await HM.api.pharmacy.startDispense(id); HM.ui.toast('Dispensing started', 'success'); load(); } catch (e) { HM.ui.toast(e.message, 'danger'); }
  }
  async function finishDispense(id) {
    var ok = await HM.ui.confirm('Mark this order as fully dispensed? · 確認完成配藥？');
    if (!ok) return;
    try { await HM.api.pharmacy.finishDispense(id); HM.ui.toast('Dispensed · 已完成', 'success'); load(); } catch (e) { HM.ui.toast(e.message, 'danger'); }
  }
  async function shipOrder(id) {
    var carrier = await HM.ui.prompt('Carrier name · 快遞公司 (e.g. J&T, Pos Laju):', { required: true });
    if (!carrier) return;
    var tracking = await HM.ui.prompt('Tracking number · 追蹤號碼:', { required: true });
    if (!tracking) return;
    try { await HM.api.pharmacy.shipOrder(id, { carrier: carrier, tracking_no: tracking }); HM.ui.toast('Shipped · 已寄出', 'success'); load(); } catch (e) { HM.ui.toast(e.message, 'danger'); }
  }

  async function renderDetail(el, id) {
    HM.state.loading(el);
    try {
      var res = await HM.api.pharmacy.getOrder(id);
      var o = res.order;
      var html = '<div class="page-header"><button class="btn btn--ghost" onclick="location.hash=\'#/orders\'">← Back</button></div>' +
        '<div class="card card--pad-lg" style="max-width: 900px;">' +
        '<div class="flex-between mb-4"><div><div class="text-label">' + HM.format.esc(o.order_no) + '</div><h2>' + HM.format.esc(HM.format.patientLabel(o)) + '</h2>' +
        '<div class="text-xs text-muted">Patient #' + o.patient_id + '</div></div>' +
        HM.format.statusBadge(o.status) + '</div>';
      if (o.prescription) {
        var rx = o.prescription;
        html += '<div class="alert alert--info mb-4"><div class="alert-body">' +
          '<div class="alert-title">Prescription Attached · 附加處方</div>' +
          (rx.diagnosis ? '<p class="text-sm mb-2"><strong>Dx:</strong> ' + HM.format.esc(rx.diagnosis) + '</p>' : '') +
          (rx.instructions ? '<p class="text-sm"><strong>Instructions:</strong> ' + HM.format.esc(rx.instructions) + '</p>' : '') +
          '</div></div>';
      }
      if (o.items && o.items.length) {
        html += '<div class="text-label mb-2">Items</div><div class="table-wrap"><table class="table"><thead><tr><th>Drug</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>';
        o.items.forEach(function (it) {
          html += '<tr><td>' + HM.format.esc(it.drug_name) + '</td><td>' + it.quantity + ' ' + it.unit + '</td><td>' + HM.format.money(it.unit_price) + '</td><td>' + HM.format.money(it.line_total) + '</td></tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '<div class="flex-between mt-4"><span class="text-muted">Subtotal</span><span>' + HM.format.money(o.subtotal) + '</span></div>' +
        '<div class="flex-between"><strong>Total</strong><strong style="color: var(--gold); font-size: var(--text-lg);">' + HM.format.money(o.total) + '</strong></div>';
      if (o.shipment) {
        html += '<div class="mt-6"><div class="text-label mb-2">Shipping</div>' +
          '<p class="text-sm">Carrier: ' + HM.format.esc(o.shipment.carrier || '—') + '</p>' +
          '<p class="text-sm">Tracking: ' + HM.format.esc(o.shipment.tracking_no || '—') + '</p>' +
          '</div>';
      }
      html += '</div>';
      el.innerHTML = html;
    } catch (e) { HM.state.error(el, e); }
  }

  HM.pharmPanels.orders = { render: render, renderDetail: renderDetail };
})();
