/**
 * Admin Doctors — full CRUD
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header flex-between">' +
      '<div><div class="page-header-label">Doctors · 醫師</div>' +
      '<h1 class="page-title">Doctor Management</h1></div>' +
      '<button class="btn btn--primary" onclick="location.hash=\'#/accounts\'">+ Add Doctor</button>' +
      '</div><div id="doc-list"></div>';

    var container = document.getElementById('doc-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.admin.listDoctors();
      var items = res.data || [];
      if (!items.length) {
        HM.state.empty(container, { icon: '👨‍⚕️', title: 'No doctors', text: 'Create doctor accounts from Accounts page' });
        return;
      }
      container.innerHTML = '<div class="table-wrap"><table class="table table--responsive"><thead><tr><th>Name</th><th>Email</th><th>Specialty</th><th>Fee</th><th>Status</th><th></th></tr></thead><tbody></tbody></table></div>';
      var tbody = container.querySelector('tbody');
      items.forEach(function (u) {
        var dp = u.doctor_profile || {};
        var tr = document.createElement('tr');
        tr.innerHTML = '<td data-label="Name">' + HM.format.esc(dp.full_name || '—') + '</td>' +
          '<td data-label="Email">' + HM.format.esc(u.email) + '</td>' +
          '<td data-label="Specialty">' + HM.format.esc(dp.specialties || '—') + '</td>' +
          '<td data-label="Fee">' + HM.format.money(dp.consultation_fee) + '</td>' +
          '<td data-label="Status">' + HM.format.statusBadge(u.status) + '</td>' +
          '<td data-label="Actions"><button class="btn btn--outline btn--sm">' + (u.status === 'active' ? 'Suspend' : 'Activate') + '</button></td>';
        tr.querySelector('button').addEventListener('click', async function () {
          try { await HM.api.admin.toggleDoctor(u.id); HM.ui.toast('Updated', 'success'); render(el); }
          catch (e) { HM.ui.toast(e.message, 'danger'); }
        });
        tbody.appendChild(tr);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  HM.adminPanels.doctors = { render: render };
})();
