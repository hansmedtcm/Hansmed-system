/**
 * Doctors — browse + detail
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Find a Doctor · 尋醫</div>' +
      '<h1 class="page-title">Our Practitioners</h1>' +
      '<p class="page-subtitle">Browse licensed TCM practitioners</p>' +
      '</div>' +
      '<div class="filter-bar mb-4">' +
      '<input id="doc-search" type="text" class="field-input field-input--boxed" placeholder="Search by name or specialty… · 搜尋" style="max-width: 400px;">' +
      '<select id="doc-sort" class="field-input field-input--boxed" style="max-width: 200px;">' +
      '<option value="rating">Sort by rating</option>' +
      '<option value="consultations">Sort by experience</option>' +
      '</select>' +
      '</div>' +
      '<div id="doc-list"><div class="state state--loading"><div class="state-icon"></div><div class="state-text">Loading doctors…</div></div></div>';

    await load();

    document.getElementById('doc-search').addEventListener('input', debounce(load, 300));
    document.getElementById('doc-sort').addEventListener('change', load);
  }

  async function load() {
    var container = document.getElementById('doc-list');
    var search = document.getElementById('doc-search') ? document.getElementById('doc-search').value : '';
    var sort = document.getElementById('doc-sort') ? document.getElementById('doc-sort').value : 'rating';
    var query = 'sort=' + sort + (search ? '&search=' + encodeURIComponent(search) : '');

    HM.state.loading(container);
    try {
      var res = await HM.api.patient.listDoctors(query);
      var docs = res.data || [];

      if (!docs.length) {
        HM.state.empty(container, {
          icon: '👨‍⚕️',
          title: 'No doctors found',
          text: 'Try a different search or check back later',
        });
        return;
      }

      container.innerHTML = '<div class="grid-auto" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--s-4);"></div>';
      var grid = container.querySelector('.grid-auto');

      docs.forEach(function (d) {
        var data = {
          id: d.user_id,
          full_name: d.full_name || 'Doctor',
          initial: (d.full_name || 'D').charAt(0),
          specialties: d.specialties || 'TCM Practitioner',
          rating: parseFloat(d.rating || 0).toFixed(1),
          fee_formatted: HM.format.money(d.consultation_fee),
        };
        var node = HM.render.fromTemplate('tpl-doc-browse-card', data);
        node.querySelector('[data-action="select"]').addEventListener('click', function () {
          location.hash = '#/doctors/' + d.user_id;
        });
        node.querySelector('[data-action="book"]').addEventListener('click', function (e) {
          e.stopPropagation();
          location.hash = '#/book/' + d.user_id;
        });
        grid.appendChild(node);
      });
    } catch (e) {
      HM.state.error(container, e);
    }
  }

  async function renderDetail(el, doctorId) {
    HM.state.loading(el);
    try {
      var res = await HM.api.patient.getDoctor(doctorId);
      var d = res.doctor;
      el.innerHTML = '' +
        '<div class="page-header">' +
        '<button class="btn btn--ghost" onclick="location.hash=\'#/doctors\'">← Back to Doctors</button>' +
        '</div>' +
        '<div class="card card--pad-lg" style="max-width: 800px;">' +
        '<div class="flex flex-gap-4 mb-6" style="align-items: flex-start;">' +
        '<div class="avatar avatar--xl" style="background: var(--ink); color: var(--gold);">' + HM.format.esc((d.full_name || 'D').charAt(0)) + '</div>' +
        '<div style="flex: 1;">' +
        '<h2 style="margin-bottom: var(--s-1);">' + HM.format.esc(d.full_name) + '</h2>' +
        '<p class="text-muted" style="font-family: var(--font-zh);">' + HM.format.esc(d.specialties || 'TCM Practitioner') + '</p>' +
        '<div class="flex flex-gap-4 mt-3">' +
        '<div><strong>⭐ ' + parseFloat(d.rating || 0).toFixed(1) + '</strong> <span class="text-muted text-sm">Rating</span></div>' +
        '<div><strong>' + (d.consultation_count || 0) + '</strong> <span class="text-muted text-sm">Consultations</span></div>' +
        '<div><strong>' + HM.format.money(d.consultation_fee) + '</strong> <span class="text-muted text-sm">Per Visit</span></div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        (d.bio ? '<div class="mb-4"><div class="text-label mb-2">About · 簡介</div><p class="text-sm">' + HM.format.esc(d.bio) + '</p></div>' : '') +
        (d.license_no ? '<div class="text-xs text-muted">License: ' + HM.format.esc(d.license_no) + '</div>' : '') +
        '<button class="btn btn--primary btn--lg btn--block mt-6" onclick="location.hash=\'#/book/' + doctorId + '\'">Book Appointment · 預約問診</button>' +
        '</div>';
    } catch (e) {
      HM.state.error(el, e);
    }
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  HM.patientPanels.doctors = { render: render, renderDetail: renderDetail };
})();
