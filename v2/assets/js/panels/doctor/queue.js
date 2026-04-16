/**
 * Doctor Queue — today's patient pool.
 *
 * Patients enter the pool by booking with a concern + time slot (no doctor
 * selected). Any doctor can pick up any patient. Pool is filtered to today
 * by default; doctors can filter to their recommended specialty, or view all.
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  var state = { filter: 'matching', date: null };

  async function render(el) {
    var today = new Date().toISOString().split('T')[0];
    state = { filter: 'matching', date: today };

    el.innerHTML = '<div class="page-header flex-between">' +
      '<div><div class="page-header-label">Today\'s Queue · 候診池</div>' +
      '<h1 class="page-title">Patient Pool</h1>' +
      '<p class="text-muted mt-1">Patients have paid and are waiting. Pick one to start the consultation.</p>' +
      '</div>' +
      '<div class="flex gap-2" style="align-items:center;">' +
      '<input type="date" id="q-date" class="field-input field-input--boxed" value="' + today + '" style="max-width: 180px;">' +
      '<button class="btn btn--primary" id="q-new-appt">+ New · 新建</button>' +
      '</div>' +
      '</div>' +

      '<div class="filter-bar mb-4">' +
      chip('matching', '🎯 My Specialty · 對口', true) +
      chip('all', 'All Pool · 全部') +
      chip('mine', '✓ Picked by Me · 我選擇') +
      '</div>' +

      '<div id="q-list"></div>';

    document.getElementById('q-date').addEventListener('change', function (e) {
      state.date = e.target.value;
      load();
    });

    document.getElementById('q-new-appt').addEventListener('click', function () {
      // Reuse the patients panel booking modal
      if (HM.doctorPanels.patients && HM.doctorPanels.patients._book) {
        HM.doctorPanels.patients._book(null, null);
      }
    });

    document.querySelectorAll('.filter-chip').forEach(function (c) {
      c.addEventListener('click', function () {
        document.querySelectorAll('.filter-chip').forEach(function (x) { x.classList.remove('is-active'); });
        c.classList.add('is-active');
        state.filter = c.getAttribute('data-filter');
        load();
      });
    });

    await load();
  }

  function chip(key, label, active) {
    return '<button class="filter-chip' + (active ? ' is-active' : '') + '" data-filter="' + key + '">' + label + '</button>';
  }

  async function load() {
    var container = document.getElementById('q-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.doctor.listAppointments('date=' + state.date);
      var appts = res.data || [];

      // Filter: today + filter type
      var list = appts.filter(function (a) {
        var sameDate = (a.scheduled_start || '').slice(0, 10) === state.date;
        if (!sameDate) return false;
        if (['confirmed','pending_payment','in_progress','paid'].indexOf(a.status) < 0) return false;
        if (state.filter === 'mine') return a.doctor_id === getCurrentDoctorId();
        if (state.filter === 'matching') {
          // Match if doctor hasn't picked it yet AND specialty matches the recommended
          if (a.doctor_id) return false;
          return matchesSpecialty(a);
        }
        if (state.filter === 'all') {
          return !a.doctor_id || a.doctor_id === getCurrentDoctorId();
        }
        return true;
      }).sort(function (a, b) {
        return new Date(a.scheduled_start) - new Date(b.scheduled_start);
      });

      if (!list.length) {
        HM.state.empty(container, {
          icon: '🕊️',
          title: state.filter === 'mine' ? 'You haven\'t picked any patients today' : 'Pool is empty',
          text: state.filter === 'matching' ? 'No pool patients match your specialty right now. Try "All Pool".' : 'Pool will populate as patients book.',
        });
        return;
      }

      container.innerHTML = '';
      list.forEach(function (a) { container.appendChild(renderCard(a)); });
    } catch (e) { HM.state.error(container, e); }
  }

  function renderCard(a) {
    var card = document.createElement('div');
    card.className = 'card mb-3';

    var picked = !!a.doctor_id;
    var concernBadge = a.concern_label ? '<span class="badge">' + HM.format.esc(a.concern_label) + '</span>' : '';
    var specBadge = a.recommended_specialty ? '<span class="badge badge--gold" style="margin-left:6px;">🎯 ' + HM.format.esc(a.recommended_specialty) + '</span>' : '';
    var visitBadge = (a.visit_type === 'walk_in')
      ? '<span class="badge" style="background:rgba(184,150,90,.15);color:var(--gold);border:1px solid rgba(184,150,90,.35);">🏥 Walk-in · 臨診</span>'
      : '<span class="badge" style="background:rgba(74,144,217,.15);color:#4a90d9;border:1px solid rgba(74,144,217,.35);">📹 Teleconsult · 線上</span>';

    card.innerHTML = '<div class="flex-between">' +
      '<div>' +
      '<div class="flex flex-gap-2 mb-1" style="align-items:center;flex-wrap:wrap;">' + visitBadge +
      '<span class="text-label text-gold">' + HM.format.time(a.scheduled_start) + ' · ' + HM.format.date(a.scheduled_start) + '</span>' +
      '</div>' +
      '<div class="card-title">Patient #' + a.patient_id + '</div>' +
      '<div class="mt-2">' + concernBadge + specBadge + '</div>' +
      (a.notes ? '<div class="text-sm text-muted mt-2" style="max-width: 520px;">"' + HM.format.esc(a.notes) + '"</div>' : '') +
      '</div>' +
      '<div style="text-align:right;">' +
      HM.format.statusBadge(a.status) +
      '<div class="text-sm mt-2">' + HM.format.money(a.fee) + '</div>' +
      '</div>' +
      '</div>' +

      '<div class="flex flex-gap-2 mt-4">' +
      (!picked ? '<button class="btn btn--primary btn--sm" data-action="pick">✋ Pick This Patient · 認領</button>' : '') +
      (picked ? '<button class="btn btn--primary btn--sm" data-action="consult">▶ Start Consult · 開始問診</button>' : '') +
      '<button class="btn btn--outline btn--sm" data-action="view">Details · 詳情</button>' +
      '<button class="btn btn--outline btn--sm" data-action="chat">💬 Chat</button>' +
      '</div>';

    var pickBtn = card.querySelector('[data-action="pick"]');
    if (pickBtn) pickBtn.addEventListener('click', function () { pickPatient(a); });

    var consultBtn = card.querySelector('[data-action="consult"]');
    if (consultBtn) consultBtn.addEventListener('click', function () { location.hash = '#/consult/' + a.id; });

    card.querySelector('[data-action="view"]').addEventListener('click', function () { location.hash = '#/appointments/' + a.id; });
    card.querySelector('[data-action="chat"]').addEventListener('click', async function () {
      try {
        var res = await HM.api.chat.openThread({ patient_id: a.patient_id, appointment_id: a.id });
        location.hash = '#/messages/' + res.thread.id;
      } catch (e) { HM.ui.toast('Could not open chat', 'danger'); }
    });

    return card;
  }

  async function pickPatient(a) {
    // Try a dedicated pool-pick endpoint; fall back to assigning via updateAppointment.
    try {
      var url = '/doctor/pool/' + a.id + '/pick';
      try {
        await HM.api.post(url);
      } catch (_) {
        // Fallback: start the appointment directly
        await HM.api.doctor.startAppointment(a.id);
      }
      HM.ui.toast('Patient picked · 已認領', 'success');
      load();
    } catch (e) {
      HM.ui.toast(e.message || 'Could not pick patient', 'danger');
    }
  }

  function matchesSpecialty(appt) {
    var user = HM.api.getUser();
    if (!user || !user.doctor_profile) return true; // if unknown, show all
    var mySpecs = (user.doctor_profile.specialties || '').toLowerCase();
    var rec = (appt.recommended_specialty || '').toLowerCase();
    if (!rec) return true;
    // Substring match is enough for the free-text specialty field
    return mySpecs.indexOf(rec) >= 0 || rec.indexOf('general') >= 0;
  }

  function getCurrentDoctorId() {
    var user = HM.api.getUser();
    return user ? user.id : null;
  }

  HM.doctorPanels.queue = { render: render };
})();
