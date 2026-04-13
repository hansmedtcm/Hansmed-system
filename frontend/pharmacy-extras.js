/**
 * HansMed Pharmacy — P-02, P-03, P-08, P-11
 * --------------------------------------------
 * Pharmacy profile, prescription inbox, product list/delist, help.
 */
(function () {
  'use strict';
  var A = window.HansMedAPI;
  if (!A) return;

  // ── Inject extra tabs ──
  function injectPharmTabs() {
    var tabBar = document.querySelector('#page-pharmacy .pharm-tab')?.parentElement;
    if (!tabBar || document.getElementById('ph-profile-btn')) return;

    var tabs = [
      { id: 'ph-profile',  label: '👤 Profile', fn: function () { window.showPharmPanel('ph-profile', document.getElementById('ph-profile-btn')); } },
      { id: 'ph-rx-inbox', label: '📋 Prescriptions', fn: function () { window.showPharmPanel('ph-rx-inbox', document.getElementById('ph-rx-inbox-btn')); } },
      { id: 'ph-help',     label: '❓ Help', fn: function () { window.showPharmPanel('ph-help', document.getElementById('ph-help-btn')); } },
    ];

    tabs.forEach(function (t) {
      var btn = document.createElement('button');
      btn.id = t.id + '-btn';
      btn.className = 'pharm-tab';
      btn.textContent = t.label;
      btn.onclick = t.fn;
      tabBar.appendChild(btn);

      var panel = document.createElement('div');
      panel.id = t.id;
      panel.className = 'pharm-panel';
      panel.style.display = 'none';
      tabBar.parentElement.appendChild(panel);
    });
  }

  var _origShowPage = window.showPage;
  window.showPage = function (p) {
    if (typeof _origShowPage === 'function') _origShowPage(p);
    if (p === 'pharmacy') setTimeout(injectPharmTabs, 150);
  };

  var _origShowPharmPanel = window.showPharmPanel;
  window.showPharmPanel = function (id, btn) {
    if (typeof _origShowPharmPanel === 'function') _origShowPharmPanel(id, btn);
    if (id === 'ph-profile')  loadPhProfile();
    if (id === 'ph-rx-inbox') loadPhPrescriptions();
    if (id === 'ph-help')     loadPhHelp();
  };

  // ================================================================
  // P-02: PHARMACY PROFILE
  // ================================================================
  async function loadPhProfile() {
    var el = document.getElementById('ph-profile');
    if (!el) return;
    try {
      var res = await A.api.get('/pharmacy/profile');
      var user = res.user || {};
      var pp = user.pharmacy_profile || {};

      el.innerHTML = ''
        + '<h3>Pharmacy Profile · 藥房資料</h3>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.3rem;margin:1.5rem 0;">'
        + field('pp-name', 'Pharmacy Name · 藥房名稱', pp.name || '')
        + field('pp-email', 'Email · 電郵', user.email || '', true)
        + field('pp-license', 'License No · 執照號碼', pp.license_no || '')
        + field('pp-phone', 'Phone · 電話', pp.phone || '')
        + field('pp-addr', 'Address · 地址', pp.address_line || '')
        + field('pp-city', 'City · 城市', pp.city || '')
        + field('pp-state', 'State · 州', pp.state || '')
        + field('pp-country', 'Country · 國家', pp.country || 'Malaysia')
        + field('pp-postal', 'Postal Code · 郵遞區號', pp.postal_code || '')
        + field('pp-hours', 'Business Hours · 營業時間', pp.business_hours || '')
        + field('pp-radius', 'Delivery Radius (km) · 配送範圍', pp.delivery_radius_km || '', 'number')
        + '</div>'
        + '<button class="btn-primary" onclick="savePhProfile()">Save · 儲存 ✓</button>';
    } catch (e) { el.innerHTML = '<p style="color:var(--red-seal);">Failed to load</p>'; }
  }

  window.savePhProfile = async function () {
    try {
      await A.api.put('/pharmacy/profile', {
        name: gv('pp-name'), license_no: gv('pp-license'), phone: gv('pp-phone'),
        address_line: gv('pp-addr'), city: gv('pp-city'), state: gv('pp-state'),
        country: gv('pp-country'), postal_code: gv('pp-postal'),
        business_hours: gv('pp-hours'), delivery_radius_km: parseFloat(gv('pp-radius')) || null,
      });
      showToast('Profile saved! · 資料已儲存 ✓');
    } catch (e) { showToast(e.message || 'Failed'); }
  };

  // ================================================================
  // P-03: PRESCRIPTION INBOX
  // ================================================================
  async function loadPhPrescriptions() {
    var el = document.getElementById('ph-rx-inbox');
    if (!el) return;
    try {
      var res = await A.api.get('/pharmacy/prescriptions');
      var orders = res.data || [];

      el.innerHTML = '<h3>Prescription Inbox · 處方收件箱</h3>'
        + '<div class="sub-label">Prescriptions attached to your orders · 與訂單關聯的處方</div>';

      if (!orders.length) {
        el.innerHTML += '<p style="color:var(--stone);margin-top:1rem;">No prescriptions received yet · 暫無收到處方</p>';
        return;
      }

      el.innerHTML += orders.map(function (o) {
        var rx = o.prescription || {};
        var doctor = rx.doctor?.doctor_profile || {};
        var patient = rx.patient?.patient_profile || {};
        var items = (rx.items || []).map(function (i) { return i.drug_name + ' ' + i.quantity + i.unit; }).join(', ');

        return '<div style="background:var(--washi);border:1px solid var(--mist);border-left:3px solid ' + (o.status === 'paid' ? 'var(--gold)' : 'var(--sage)') + ';padding:1rem;margin-bottom:.8rem;">'
          + '<div style="display:flex;justify-content:space-between;align-items:start;">'
          + '<div>'
          + '  <div style="font-size:.95rem;color:var(--ink);font-weight:500;">Order ' + o.order_no + '</div>'
          + '  <div style="font-size:.78rem;color:var(--stone);margin-top:.2rem;">Patient: ' + (patient.full_name || 'Unknown') + ' · Doctor: ' + (doctor.full_name || 'Unknown') + '</div>'
          + '</div>'
          + '<span style="font-size:.68rem;padding:.2rem .5rem;border-radius:3px;background:var(--washi-dark);color:var(--stone);">' + o.status.replace(/_/g, ' ') + '</span>'
          + '</div>'
          + (rx.diagnosis ? '<div style="margin-top:.5rem;font-size:.85rem;"><span style="color:var(--gold);">Dx:</span> ' + rx.diagnosis + '</div>' : '')
          + '<div style="margin-top:.3rem;font-size:.82rem;color:var(--stone);">' + items + '</div>'
          + (rx.instructions ? '<div style="margin-top:.3rem;font-size:.78rem;color:var(--sage);">⚠ ' + rx.instructions + '</div>' : '')
          + '</div>';
      }).join('');
    } catch (e) { el.innerHTML = '<p style="color:var(--red-seal);">Failed to load</p>'; }
  }

  // ================================================================
  // P-08: PRODUCT LIST / DELIST TOGGLE
  // ================================================================
  window.toggleProductListing = async function (productId, currentlyListed) {
    try {
      await A.pharmacy.updateProduct(productId, { is_listed: !currentlyListed });
      showToast(currentlyListed ? 'Product delisted · 已下架' : 'Product listed · 已上架');
      // Refresh product list
      if (typeof window.showPharmPanel === 'function') {
        window.showPharmPanel('ph-products', document.querySelector('.pharm-tab.active'));
      }
    } catch (e) { showToast(e.message || 'Failed'); }
  };

  // Override product card rendering to add list/delist button
  var _origLoadPhProducts = window.loadPhProducts;
  // The pharmacy-portal.js handles product rendering, we just need to make sure
  // the toggle button exists. It's already in the productCard function via the
  // update endpoint. Add a convenience function for the UI.

  // ================================================================
  // P-11: PHARMACY HELP
  // ================================================================
  function loadPhHelp() {
    var el = document.getElementById('ph-help');
    if (!el) return;
    el.innerHTML = ''
      + '<h3>Help & Support · 幫助與支持</h3>'
      + '<div class="sub-label">Guides for pharmacy operations · 藥房操作指南</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1.5rem;">'
      + helpCard('📦', 'How to add products', '如何新增產品', 'Go to Products tab → Click "+ Add Product" → Enter name, price, stock → Save.')
      + helpCard('📊', 'How to manage inventory', '如何管理庫存', 'Products tab → Click "± Stock" on any product → Enter quantity change → Confirm.')
      + helpCard('📋', 'How to fulfill orders', '如何處理訂單', 'Orders tab → Click "Start Dispensing" on a paid order → Prepare items → Click "Mark Dispensed" → Enter shipping info → Ship.')
      + helpCard('🧾', 'How to use POS', '如何使用收銀系統', 'POS tab → Click products to add to cart → Select payment method → Complete sale → Print receipt.')
      + helpCard('📈', 'How to view finances', '如何查看財務', 'Finance tab → View monthly revenue, platform fees, and daily breakdown.')
      + helpCard('📋', 'How to view prescriptions', '如何查看處方', 'Prescriptions tab → View all prescriptions attached to your orders with doctor notes and drug details.')
      + helpCard('👤', 'How to edit pharmacy info', '如何編輯藥房資料', 'Profile tab → Update name, address, phone, business hours, delivery radius → Save.')
      + helpCard('📞', 'Contact support', '聯絡客服', 'Email: support@hansmed.com.my<br>WhatsApp: +60 12-345 6789<br>Hours: Mon-Fri 9am-6pm')
      + '</div>';
  }

  function helpCard(icon, title, titleZh, body) {
    return '<div style="background:var(--washi);border:1px solid var(--mist);padding:1.2rem;">'
      + '<div style="font-size:1.5rem;margin-bottom:.5rem;">' + icon + '</div>'
      + '<div style="font-size:.92rem;color:var(--ink);font-weight:500;">' + title + '</div>'
      + '<div style="font-size:.78rem;color:var(--gold);margin-bottom:.5rem;">' + titleZh + '</div>'
      + '<div style="font-size:.82rem;color:var(--stone);line-height:1.6;">' + body + '</div>'
      + '</div>';
  }

  // ── Helpers ──
  function field(id, label, value, disabled) {
    return '<div><label style="display:block;font-size:.68rem;letter-spacing:.12em;color:var(--gold);text-transform:uppercase;margin-bottom:.3rem;">' + label + '</label>'
      + '<input id="' + id + '" type="' + (typeof disabled === 'string' ? disabled : 'text') + '" value="' + esc(value) + '" style="width:100%;padding:.5rem 0;border:none;border-bottom:1px solid var(--mist);background:transparent;outline:none;font-size:.95rem;"' + (disabled === true ? ' disabled' : '') + '></div>';
  }
  function esc(s) { return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }

  console.log('[HansMed] Pharmacy extras (P-02/03/08/11) loaded');
})();
