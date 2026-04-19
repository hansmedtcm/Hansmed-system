/**
 * Orders — list + detail + track
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Orders · 訂單</div>' +
      '<h1 class="page-title">Your Orders</h1>' +
      '</div><div id="order-list"></div>';

    var container = document.getElementById('order-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.patient.listOrders();
      var items = res.data || [];

      if (!items.length) {
        HM.state.empty(container, {
          icon: '📦',
          title: 'No orders yet',
          text: 'Your medicine orders will appear here',
        });
        return;
      }

      container.innerHTML = '';
      items.forEach(function (o) {
        var itemSummary = (o.items || []).map(function (i) { return i.drug_name; }).join(', ') || 'Medicine order';
        var data = {
          id: o.id,
          order_no: o.order_no,
          item_summary: HM.format.truncate(itemSummary, 80),
          created_at: o.created_at,
          status_badge: HM.format.statusBadge(o.status),
          total_formatted: HM.format.money(o.total),
          has_shipment: !!o.shipment,
          can_pay: o.status === 'pending_payment',
        };
        var node = HM.render.fromTemplate('tpl-order-card', data);
        node.querySelector('[data-action="view"]').addEventListener('click', function () {
          location.hash = '#/orders/' + o.id;
        });
        var payBtn = node.querySelector('[data-action="pay"]');
        if (payBtn) payBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          showPaymentModal(o);
        });
        var trackBtn = node.querySelector('[data-action="track"]');
        if (trackBtn) trackBtn.addEventListener('click', function () {
          showTracking(o);
        });
        container.appendChild(node);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  async function renderDetail(el, id) {
    HM.state.loading(el);
    try {
      var res = await HM.api.patient.getOrder(id);
      var o = res.order;

      var html = '<div class="page-header">' +
        '<button class="btn btn--ghost" onclick="location.hash=\'#/orders\'">← Back</button>' +
        '</div>' +
        '<div class="card card--pad-lg" style="max-width: 800px;">' +
        '<div class="flex-between mb-4">' +
        '<div><div class="text-label">' + HM.format.esc(o.order_no) + '</div>' +
        '<h2 class="mt-1">' + HM.format.money(o.total) + '</h2></div>' +
        HM.format.statusBadge(o.status) +
        '</div>';

      if (o.items && o.items.length) {
        html += '<div class="text-label mb-2">Items · 藥材</div><div class="table-wrap"><table class="table table--responsive"><thead><tr><th>Drug</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>';
        o.items.forEach(function (it) {
          html += '<tr>' +
            '<td data-label="Drug">' + HM.format.esc(it.drug_name) + '</td>' +
            '<td data-label="Qty">' + it.quantity + ' ' + it.unit + '</td>' +
            '<td data-label="Price">' + HM.format.money(it.unit_price) + '</td>' +
            '<td data-label="Total">' + HM.format.money(it.line_total) + '</td>' +
            '</tr>';
        });
        html += '</tbody></table></div>';
      }

      html += '<div class="flex-between mt-4" style="padding-top: var(--s-4); border-top: 1px solid var(--border);">' +
        '<span class="text-muted">Subtotal</span><span>' + HM.format.money(o.subtotal) + '</span></div>';
      if (o.shipping_fee > 0) {
        html += '<div class="flex-between"><span class="text-muted">Shipping</span><span>' + HM.format.money(o.shipping_fee) + '</span></div>';
      }
      html += '<div class="flex-between mt-2"><strong>Total</strong><strong style="color: var(--gold); font-size: var(--text-lg);">' + HM.format.money(o.total) + '</strong></div>';

      if (o.shipment) {
        html += '<div class="mt-6"><div class="text-label mb-3">Shipping · 物流</div>' + trackingHtml(o.shipment) + '</div>';
      }

      // Pay button — only when the order is still awaiting payment.
      // Opens a payment-method modal; on confirm, hits /orders/{id}/pay.
      if (o.status === 'pending_payment') {
        html += '<div class="mt-6" style="padding-top: var(--s-4); border-top: 1px solid var(--border);">' +
          '<button class="btn btn--primary btn--block btn--lg" id="pay-btn">' +
          '💳 Pay ' + HM.format.money(o.total) + ' · 付款' +
          '</button>' +
          '<p class="text-xs text-muted text-center mt-2">The pharmacy starts dispensing once payment is confirmed. · 付款後藥房即開始配藥。</p>' +
          '</div>';
      }

      html += '</div>';
      el.innerHTML = html;

      var payBtn = document.getElementById('pay-btn');
      if (payBtn) payBtn.addEventListener('click', function () { showPaymentModal(o); });
    } catch (e) { HM.state.error(el, e); }
  }

  function showPaymentModal(o) {
    var methods = [
      { id: 'card',      icon: '💳', label: 'Card' },
      { id: 'fpx',       icon: '🏦', label: 'FPX' },
      { id: 'tng',       icon: '🔵', label: "Touch'n Go" },
      { id: 'grabpay',   icon: '🟢', label: 'GrabPay' },
      { id: 'shopeepay', icon: '🟠', label: 'ShopeePay' },
    ];
    var html = '<p class="mb-3">Choose a payment method · 選擇付款方式</p>' +
      '<div class="grid-auto" style="grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: var(--s-2); margin-bottom: var(--s-5);">' +
      methods.map(function (pm, idx) {
        return '<button type="button" data-pm="' + pm.id + '" class="btn btn--outline' + (idx === 0 ? ' is-selected' : '') + '" style="padding: var(--s-3); flex-direction:column; gap: var(--s-1); height:auto; min-height:80px;' +
          (idx === 0 ? 'border-color: var(--gold);' : '') + '">' +
          '<span style="font-size: 1.5rem;">' + pm.icon + '</span>' +
          '<span style="font-size: var(--text-xs);">' + pm.label + '</span>' +
          '</button>';
      }).join('') +
      '</div>' +
      '<button id="pay-confirm" class="btn btn--primary btn--block btn--lg">Pay ' + HM.format.money(o.total) + ' · 確認付款</button>' +
      '<p class="text-xs text-muted text-center mt-3">Secured by Stripe Malaysia · 安全支付</p>';

    var m = HM.ui.modal({ title: 'Payment · 付款', content: html });

    // Method picker highlight
    m.body.querySelectorAll('[data-pm]').forEach(function (b) {
      b.addEventListener('click', function () {
        m.body.querySelectorAll('[data-pm]').forEach(function (x) { x.classList.remove('is-selected'); x.style.borderColor = 'var(--border)'; });
        b.classList.add('is-selected');
        b.style.borderColor = 'var(--gold)';
      });
    });

    m.body.querySelector('#pay-confirm').addEventListener('click', async function () {
      var selected = m.body.querySelector('[data-pm].is-selected');
      var method = selected ? selected.getAttribute('data-pm') : 'card';
      var btn = m.body.querySelector('#pay-confirm');
      btn.disabled = true;
      btn.textContent = 'Processing… · 處理中';
      try {
        await HM.api.patient.payOrder(o.id, { method: method });
        m.close();
        HM.ui.toast('Payment successful — pharmacy notified · 付款成功，藥房已收到', 'success', 5000);
        // Re-render so the Pay button disappears and the new status shows.
        setTimeout(function () {
          var el = document.getElementById('panel-container');
          if (el) HM.patientPanels.orders.renderDetail(el, o.id);
        }, 500);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Pay ' + HM.format.money(o.total) + ' · 確認付款';
        HM.ui.toast(err.message || 'Payment failed · 付款失敗', 'danger');
      }
    });
  }

  function trackingHtml(s) {
    var html = '<div class="card">' +
      '<div class="flex-between mb-3"><div><strong>' + HM.format.esc(s.carrier || 'Carrier') + '</strong><br>' +
      '<span class="text-xs text-muted">Tracking: ' + HM.format.esc(s.tracking_no || '—') + '</span></div>' +
      HM.format.statusBadge(s.status) + '</div>' +
      '<div class="timeline">';
    if (s.shipped_at) {
      html += '<div class="timeline-item is-done"><div class="timeline-time">' + HM.format.datetime(s.shipped_at) + '</div><div class="timeline-title">Shipped · 已寄出</div></div>';
    }
    if (s.delivered_at) {
      html += '<div class="timeline-item is-done"><div class="timeline-time">' + HM.format.datetime(s.delivered_at) + '</div><div class="timeline-title">Delivered · 已送達</div></div>';
    }
    html += '</div></div>';
    return html;
  }

  function showTracking(o) {
    HM.ui.modal({
      title: 'Order Tracking · 物流追蹤',
      content: o.shipment ? trackingHtml(o.shipment) : '<p class="text-muted">Shipping info not available yet. Your order is being prepared.</p>',
    });
  }

  HM.patientPanels.orders = { render: render, renderDetail: renderDetail };
})();
