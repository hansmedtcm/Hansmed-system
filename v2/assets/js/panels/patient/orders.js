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
        };
        var node = HM.render.fromTemplate('tpl-order-card', data);
        node.querySelector('[data-action="view"]').addEventListener('click', function () {
          location.hash = '#/orders/' + o.id;
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

      html += '</div>';
      el.innerHTML = html;
    } catch (e) { HM.state.error(el, e); }
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
