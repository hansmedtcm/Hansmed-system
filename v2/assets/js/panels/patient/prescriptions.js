/**
 * Prescriptions — list + detail + order
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Prescriptions · 處方</div>' +
      '<h1 class="page-title">Your Electronic Prescriptions</h1>' +
      '</div><div id="rx-list"></div>';

    var container = document.getElementById('rx-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.patient.listPrescriptions();
      var items = res.data || [];

      if (!items.length) {
        HM.state.empty(container, {
          icon: '💊',
          title: 'No prescriptions yet',
          text: 'Prescriptions from your doctors will appear here',
        });
        return;
      }

      container.innerHTML = '';
      items.forEach(function (rx) {
        var itemNames = (rx.items || []).map(function (i) { return i.drug_name + ' × ' + i.quantity + i.unit; }).join(', ');
        var data = {
          id: rx.id,
          created_at: rx.created_at,
          diagnosis: rx.diagnosis || 'Prescription #' + rx.id,
          items_summary: itemNames,
          status_badge: HM.format.statusBadge(rx.status),
          can_order: rx.status === 'issued',
        };
        var node = HM.render.fromTemplate('tpl-rx-card', data);
        node.querySelector('[data-action="view"]').addEventListener('click', function () {
          location.hash = '#/prescriptions/' + rx.id;
        });
        var orderBtn = node.querySelector('[data-action="order"]');
        if (orderBtn) orderBtn.addEventListener('click', function () {
          showOrderFlow(rx);
        });
        container.appendChild(node);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  async function renderDetail(el, id) {
    HM.state.loading(el);
    try {
      var res = await HM.api.patient.listPrescriptions();
      var rx = (res.data || []).find(function (r) { return r.id == id; });
      if (!rx) throw new Error('Prescription not found');

      var html = '<div class="page-header">' +
        '<button class="btn btn--ghost" onclick="location.hash=\'#/prescriptions\'">← Back</button>' +
        '</div>' +
        '<div class="card card--pad-lg" style="max-width: 800px;">' +
        '<div class="flex-between mb-4">' +
        '<div><div class="text-label">' + HM.format.date(rx.created_at) + '</div>' +
        '<h2 class="mt-1">' + HM.format.esc(rx.diagnosis || 'Prescription #' + rx.id) + '</h2></div>' +
        HM.format.statusBadge(rx.status) +
        '</div>';

      if (rx.items && rx.items.length) {
        html += '<div class="text-label mb-2">Medicines · 藥材</div>' +
          '<div class="table-wrap"><table class="table table--responsive"><thead><tr><th>#</th><th>Drug</th><th>Quantity</th><th>Dosage</th><th>Frequency</th></tr></thead><tbody>';
        rx.items.forEach(function (it, i) {
          html += '<tr>' +
            '<td data-label="#">' + (i + 1) + '</td>' +
            '<td data-label="Drug"><strong>' + HM.format.esc(it.drug_name) + '</strong>' + (it.specification ? '<br><span class="text-xs text-muted">' + HM.format.esc(it.specification) + '</span>' : '') + '</td>' +
            '<td data-label="Quantity">' + it.quantity + ' ' + it.unit + '</td>' +
            '<td data-label="Dosage">' + HM.format.esc(it.dosage || '—') + '</td>' +
            '<td data-label="Frequency">' + HM.format.esc(it.frequency || '—') + '</td>' +
            '</tr>';
        });
        html += '</tbody></table></div>';
      }

      if (rx.instructions) {
        html += '<div class="alert alert--info mt-4"><div class="alert-body"><div class="alert-title">Instructions · 醫囑</div>' + HM.format.esc(rx.instructions) + '</div></div>';
      }
      if (rx.contraindications) {
        html += '<div class="alert alert--warning"><div class="alert-body"><div class="alert-title">⚠ Contraindications · 禁忌</div>' + HM.format.esc(rx.contraindications) + '</div></div>';
      }

      html += '<div class="flex flex-gap-3 mt-6">' +
        '<a href="' + HM.config.API_BASE + '/documents/prescription/' + rx.id + '" target="_blank" class="btn btn--outline">📄 Download PDF</a>';
      if (rx.status === 'issued') {
        html += '<button class="btn btn--primary" onclick="HM.patientPanels.prescriptions._order(' + rx.id + ')">Order Medicine · 購藥</button>';
      }
      html += '</div></div>';

      el.innerHTML = html;
    } catch (e) { HM.state.error(el, e); }
  }

  async function showOrderFlow(rx) {
    // Fetch pharmacies & addresses in parallel
    var m = HM.ui.modal({ title: 'Order Medicine · 購藥', content: '<div class="state state--loading"><div class="state-icon"></div></div>' });
    try {
      var results = await Promise.all([
        HM.api.patient.listPharmacies(),
        HM.api.patient.getAddresses(),
      ]);
      var pharmacies = results[0].data || [];
      var addresses = results[1] || [];
      if (!Array.isArray(addresses)) addresses = addresses.data || [];

      if (!pharmacies.length) {
        m.body.innerHTML = '<p class="text-muted">No pharmacies available yet. Please check back later.</p>';
        return;
      }
      if (!addresses.length) {
        m.body.innerHTML = '<div class="alert alert--warning"><div class="alert-body">Please add a delivery address in your profile before ordering.</div></div>';
        return;
      }

      var phOpts = pharmacies.map(function (p) { return '<option value="' + p.user_id + '">' + HM.format.esc(p.name) + ' · ' + HM.format.esc(p.city || '') + '</option>'; }).join('');
      var addrOpts = addresses.map(function (a) { return '<option value="' + a.id + '">' + HM.format.esc(a.recipient + ' — ' + a.line1 + ', ' + a.city) + '</option>'; }).join('');

      m.body.innerHTML = '' +
        '<div class="field"><label class="field-label">Pharmacy · 藥房</label><select id="ord-pharm" class="field-input field-input--boxed">' + phOpts + '</select></div>' +
        '<div class="field"><label class="field-label">Delivery Address · 收貨地址</label><select id="ord-addr" class="field-input field-input--boxed">' + addrOpts + '</select></div>' +
        '<button id="ord-place" class="btn btn--primary btn--block mt-4">Place Order · 下單</button>';

      m.body.querySelector('#ord-place').addEventListener('click', async function () {
        try {
          var res = await HM.api.patient.createOrder({
            prescription_id: rx.id,
            pharmacy_id: parseInt(m.body.querySelector('#ord-pharm').value),
            address_id: parseInt(m.body.querySelector('#ord-addr').value),
          });
          m.close();
          HM.ui.toast('Order placed! Total: ' + HM.format.money(res.order.total) + ' · 訂單已建立', 'success');
          setTimeout(function () { location.hash = '#/orders/' + res.order.id; }, 800);
        } catch (err) {
          HM.ui.toast(err.message || 'Order failed', 'danger');
        }
      });
    } catch (err) {
      m.body.innerHTML = '<p class="text-danger">' + (err.message || 'Failed to load') + '</p>';
    }
  }

  HM.patientPanels.prescriptions = {
    render: render,
    renderDetail: renderDetail,
    _order: function (id) {
      HM.api.patient.listPrescriptions().then(function (res) {
        var rx = (res.data || []).find(function (r) { return r.id == id; });
        if (rx) showOrderFlow(rx);
      });
    },
  };
})();
