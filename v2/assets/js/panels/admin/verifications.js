/**
 * Verifications — doctor + pharmacy approvals
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  async function render(el) {
    HM.state.loading(el);
    try {
      var results = await Promise.all([
        HM.api.admin.pendingDoctors(),
        HM.api.admin.pendingPharmacies(),
      ]);
      var docs = results[0].data || [];
      var pharms = results[1].data || [];

      el.innerHTML = '<div class="page-header">' +
        '<div class="page-header-label">Verifications · 審核</div>' +
        '<h1 class="page-title">Pending Approvals</h1>' +
        '</div>' +
        '<div class="tabs">' +
        '<button class="tab is-active" data-tab="docs">Doctors (' + docs.length + ') · 醫師</button>' +
        '<button class="tab" data-tab="pharms">Pharmacies (' + pharms.length + ') · 藥房</button>' +
        '</div>' +
        '<div class="tab-panel is-active" data-panel="docs" id="docs-panel"></div>' +
        '<div class="tab-panel" data-panel="pharms" id="pharms-panel"></div>';

      var tabs = el.querySelectorAll('.tab');
      var panels = el.querySelectorAll('.tab-panel');
      tabs.forEach(function (t) {
        t.addEventListener('click', function () {
          tabs.forEach(function (x) { x.classList.remove('is-active'); });
          panels.forEach(function (p) { p.classList.remove('is-active'); });
          t.classList.add('is-active');
          el.querySelector('[data-panel="' + t.getAttribute('data-tab') + '"]').classList.add('is-active');
        });
      });

      renderList(el.querySelector('#docs-panel'), docs, 'doctor');
      renderList(el.querySelector('#pharms-panel'), pharms, 'pharmacy');
    } catch (e) { HM.state.error(el, e); }
  }

  function renderList(container, items, type) {
    if (!items.length) {
      HM.state.empty(container, { icon: '✓', title: 'No pending ' + type + ' verifications', text: 'All caught up!' });
      return;
    }
    container.innerHTML = '';
    items.forEach(function (item) {
      var user = item.user || {};
      var card = document.createElement('div');
      card.className = 'card mb-3';
      card.innerHTML = '<div class="flex-between mb-2">' +
        '<div><strong>' + HM.format.esc(item.full_name || item.name || 'Unknown') + '</strong>' +
        '<div class="text-xs text-muted">' + HM.format.esc(user.email || '') + '</div>' +
        (item.specialties ? '<div class="text-sm text-muted">' + HM.format.esc(item.specialties) + '</div>' : '') +
        (type === 'doctor'
          ? (item.license_no
              ? '<div class="text-xs" style="color:var(--sage);">T&amp;CM Council: ' + HM.format.esc(item.license_no) + '</div>'
              : '<div class="text-xs" style="color:var(--red-seal);">⚠ T&amp;CM Council No not yet entered</div>')
          : (item.license_no ? '<div class="text-xs">License: ' + HM.format.esc(item.license_no) + '</div>' : '')) +
        '</div>' +
        '<div class="flex flex-gap-2">' +
        '<button class="btn btn--primary btn--sm" data-action="approve">✓ Approve</button>' +
        '<button class="btn btn--outline btn--sm" data-action="reject" style="color: var(--red-seal);">✕ Reject</button>' +
        '</div></div>';
      card.querySelector('[data-action="approve"]').addEventListener('click', async function () {
        try {
          if (type === 'doctor') await HM.api.admin.reviewDoctor(item.user_id, { decision: 'approve' });
          else await HM.api.admin.reviewPharmacy(item.user_id, { decision: 'approve' });
          HM.ui.toast('Approved', 'success');
          render(document.getElementById('panel-container'));
        } catch (e) { HM.ui.toast(e.message, 'danger'); }
      });
      card.querySelector('[data-action="reject"]').addEventListener('click', async function () {
        var reason = await HM.ui.prompt('Reason for rejection:', { required: true });
        if (!reason) return;
        try {
          if (type === 'doctor') await HM.api.admin.reviewDoctor(item.user_id, { decision: 'reject', reason: reason });
          else await HM.api.admin.reviewPharmacy(item.user_id, { decision: 'reject', reason: reason });
          HM.ui.toast('Rejected', 'success');
          render(document.getElementById('panel-container'));
        } catch (e) { HM.ui.toast(e.message, 'danger'); }
      });
      container.appendChild(card);
    });
  }

  HM.adminPanels.verifications = { render: render };
})();
