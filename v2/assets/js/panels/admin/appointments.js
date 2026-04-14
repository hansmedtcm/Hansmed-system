/**
 * Admin Appointments
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  var filter = '';

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Appointments · 預約</div>' +
      '<h1 class="page-title">All Appointments</h1>' +
      '</div>' +
      '<div class="filter-bar">' +
      chip('', 'All') + chip('confirmed', 'Confirmed') + chip('completed', 'Completed') + chip('cancelled', 'Cancelled') +
      '</div><div id="appt-list"></div>';

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
    var container = document.getElementById('appt-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.admin.listAppointments(filter ? 'status=' + filter : '');
      var items = res.data || [];
      if (!items.length) {
        HM.state.empty(container, { icon: '📅', title: 'No appointments', text: 'Matching appointments will appear here' });
        return;
      }
      container.innerHTML = '<div class="table-wrap"><table class="table table--responsive"><thead><tr><th>Date</th><th>Patient</th><th>Doctor</th><th>Fee</th><th>Status</th></tr></thead><tbody></tbody></table></div>';
      var tbody = container.querySelector('tbody');
      items.forEach(function (a) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td data-label="Date">' + HM.format.datetime(a.scheduled_start) + '</td>' +
          '<td data-label="Patient">#' + a.patient_id + '</td>' +
          '<td data-label="Doctor">#' + a.doctor_id + '</td>' +
          '<td data-label="Fee">' + HM.format.money(a.fee) + '</td>' +
          '<td data-label="Status">' + HM.format.statusBadge(a.status) + '</td>';
        tbody.appendChild(tr);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  HM.adminPanels.appointments = { render: render };
})();
