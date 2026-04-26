/**
 * Admin Orders — oversight
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header flex-between">' +
      '<div><div class="page-header-label">Orders · 訂單</div>' +
      '<h1 class="page-title">All Orders</h1></div>' +
      '<button class="btn btn--outline" onclick="HM.adminPanels.orders._export()">📊 Export CSV</button>' +
      '</div><div id="ord-list"></div>';

    var container = document.getElementById('ord-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.admin.listOrders();
      var items = res.data || [];
      if (!items.length) {
        HM.state.empty(container, { icon: '📦', title: 'No orders yet', text: 'Orders will appear here' });
        return;
      }
      container.innerHTML = '<div class="table-wrap"><table class="table table--responsive"><thead><tr><th>Order #</th><th>Patient</th><th>Pharmacy</th><th>Total</th><th>Status</th><th>Date</th></tr></thead><tbody></tbody></table></div>';
      var tbody = container.querySelector('tbody');
      items.forEach(function (o) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td data-label="Order #"><strong>' + HM.format.esc(o.order_no) + '</strong></td>' +
          '<td data-label="Patient">#' + o.patient_id + '</td>' +
          '<td data-label="Pharmacy">#' + o.pharmacy_id + '</td>' +
          '<td data-label="Total">' + HM.format.money(o.total) + '</td>' +
          '<td data-label="Status">' + HM.format.statusBadge(o.status) + '</td>' +
          '<td data-label="Date">' + HM.format.date(o.created_at) + '</td>';
        tbody.appendChild(tr);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  HM.adminPanels.orders = {
    render: render,
    _export: async function () {
      try {
        var blob = await HM.api.admin.exportCsv('orders');
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'orders-' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click();
        URL.revokeObjectURL(url);
        HM.ui.toast('Exported', 'success');
      } catch (e) { HM.ui.toast(e.message, 'danger'); }
    },
  };
})();
