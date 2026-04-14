/**
 * Booking — 3-step wizard: doctor → time → review+pay
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  var state = { doctorId: null, doctor: null, start: null, end: null, notes: '' };

  async function render(el, doctorIdParam) {
    state = { doctorId: doctorIdParam || null, doctor: null, start: null, end: null, notes: '' };

    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Book Appointment · 預約問診</div>' +
      '<h1 class="page-title">Schedule a Consultation</h1>' +
      '</div>' +
      '<div class="steps mb-6">' +
      '<div class="step ' + (!state.doctorId ? 'is-active' : 'is-done') + '" id="step-1"><div class="step-circle">1</div><span class="step-label">Doctor</span></div>' +
      '<div class="step-separator"></div>' +
      '<div class="step ' + (state.doctorId ? 'is-active' : '') + '" id="step-2"><div class="step-circle">2</div><span class="step-label">Time</span></div>' +
      '<div class="step-separator"></div>' +
      '<div class="step" id="step-3"><div class="step-circle">3</div><span class="step-label">Review & Pay</span></div>' +
      '</div>' +
      '<div id="booking-content"></div>';

    if (state.doctorId) {
      await loadDoctorAndShowTime();
    } else {
      showDoctorStep();
    }
  }

  async function showDoctorStep() {
    var c = document.getElementById('booking-content');
    c.innerHTML = '<div class="card card--pad-lg"><h3 class="mb-3">Choose a Doctor · 選擇醫師</h3><div id="book-docs"></div></div>';
    var container = document.getElementById('book-docs');
    HM.state.loading(container);
    try {
      var res = await HM.api.patient.listDoctors('sort=rating');
      var docs = res.data || [];
      if (!docs.length) {
        HM.state.empty(container, { icon: '👨‍⚕️', title: 'No doctors available', text: 'Please check back later.' });
        return;
      }
      container.innerHTML = '<div class="grid-auto" style="grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));"></div>';
      var grid = container.querySelector('.grid-auto');
      docs.forEach(function (d) {
        var data = {
          id: d.user_id,
          full_name: d.full_name,
          initial: (d.full_name || 'D').charAt(0),
          specialties: d.specialties || 'TCM',
          rating: parseFloat(d.rating || 0).toFixed(1),
          fee_formatted: HM.format.money(d.consultation_fee),
        };
        var node = HM.render.fromTemplate('tpl-doc-browse-card', data);
        node.addEventListener('click', function () {
          state.doctorId = d.user_id;
          state.doctor = d;
          loadDoctorAndShowTime();
        });
        grid.appendChild(node);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  async function loadDoctorAndShowTime() {
    if (!state.doctor) {
      try {
        var res = await HM.api.patient.getDoctor(state.doctorId);
        state.doctor = res.doctor;
      } catch (e) {
        HM.ui.toast('Could not load doctor', 'danger');
        return;
      }
    }
    document.getElementById('step-1').classList.remove('is-active');
    document.getElementById('step-1').classList.add('is-done');
    document.getElementById('step-2').classList.add('is-active');
    showTimeStep();
  }

  function showTimeStep() {
    var d = state.doctor;
    var today = new Date();
    var minDate = today.toISOString().split('T')[0];
    var maxDate = new Date(today.getTime() + 30 * 86400000).toISOString().split('T')[0];

    document.getElementById('booking-content').innerHTML = '' +
      '<div class="card card--pad-lg">' +
      '<div class="flex flex-gap-3 mb-4" style="align-items: center;">' +
      '<div class="avatar avatar--lg" style="background: var(--ink); color: var(--gold);">' + (d.full_name || 'D').charAt(0) + '</div>' +
      '<div><div class="card-title">' + HM.format.esc(d.full_name) + '</div>' +
      '<div class="text-sm text-muted">' + HM.format.esc(d.specialties || 'TCM') + ' · ' + HM.format.money(d.consultation_fee) + '</div></div>' +
      '<button class="btn btn--ghost btn--sm" style="margin-left:auto;" onclick="location.hash=\'#/book\'">Change</button>' +
      '</div>' +
      '<div class="field mb-4">' +
      '<label class="field-label" data-required>Select Date · 選擇日期</label>' +
      '<input type="date" id="book-date" class="field-input field-input--boxed" min="' + minDate + '" max="' + maxDate + '" value="' + minDate + '">' +
      '</div>' +
      '<div id="book-slots"><p class="text-muted">Select a date to see available times</p></div>' +
      '</div>';

    document.getElementById('book-date').addEventListener('change', loadSlots);
    loadSlots();
  }

  async function loadSlots() {
    var date = document.getElementById('book-date').value;
    var el = document.getElementById('book-slots');
    el.innerHTML = '<div class="state state--loading"><div class="state-icon"></div></div>';
    try {
      var res = await HM.api.patient.getDoctorSlots(state.doctorId, date);
      var slots = res.slots || [];
      if (!slots.length) {
        el.innerHTML = '<p class="text-muted text-center">No available slots this day. Try another date.</p>';
        return;
      }

      el.innerHTML = '<div class="text-label mb-2">Available Times · 可用時段</div>' +
        '<div class="grid-auto" style="grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: var(--s-2);"></div>';
      var grid = el.querySelector('.grid-auto');
      slots.forEach(function (s) {
        var btn = document.createElement('button');
        btn.className = 'btn btn--outline btn--sm';
        btn.textContent = s.time;
        btn.disabled = !s.available;
        if (!s.available) {
          btn.style.opacity = '0.4';
          btn.style.textDecoration = 'line-through';
        }
        btn.addEventListener('click', function () {
          state.start = s.start;
          state.end = s.end;
          showReviewStep();
        });
        grid.appendChild(btn);
      });
    } catch (e) { HM.state.error(el, e); }
  }

  function showReviewStep() {
    document.getElementById('step-2').classList.remove('is-active');
    document.getElementById('step-2').classList.add('is-done');
    document.getElementById('step-3').classList.add('is-active');

    var d = state.doctor;
    var start = new Date(state.start);

    document.getElementById('booking-content').innerHTML = '' +
      '<div class="card card--pad-lg">' +
      '<h3 class="mb-4">Review & Confirm · 確認預約</h3>' +
      '<div class="mb-6" style="padding: var(--s-5); background: var(--washi); border-radius: var(--r-md);">' +
      reviewRow('Doctor', d.full_name + ' · ' + (d.specialties || 'TCM')) +
      reviewRow('Date', HM.format.date(state.start)) +
      reviewRow('Time', HM.format.time(state.start)) +
      reviewRow('Duration', '30 minutes · 30分鐘') +
      reviewRow('Consultation Fee', HM.format.money(d.consultation_fee), true) +
      '</div>' +
      '<div class="field">' +
      '<label class="field-label">Notes for the doctor · 備註 (Optional)</label>' +
      '<textarea id="book-notes" class="field-input" rows="3" placeholder="Symptoms, concerns, anything you want the doctor to know…"></textarea>' +
      '</div>' +
      '<div class="flex flex-gap-3 mt-6">' +
      '<button class="btn btn--ghost" onclick="HM.patientPanels.booking.showTime()">← Back</button>' +
      '<button id="book-confirm" class="btn btn--primary btn--block">Confirm & Pay · 確認付款</button>' +
      '</div>' +
      '</div>';

    document.getElementById('book-confirm').addEventListener('click', confirmBooking);
  }

  function reviewRow(label, value, highlight) {
    return '<div class="flex-between mb-2" style="padding: var(--s-2) 0; border-bottom: 1px solid var(--border);' + (highlight ? 'border-bottom:none;font-weight:500;' : '') + '">' +
      '<span class="text-muted text-sm">' + label + '</span>' +
      '<span style="' + (highlight ? 'font-size: var(--text-lg); color: var(--gold);' : '') + '">' + HM.format.esc(value) + '</span>' +
      '</div>';
  }

  async function confirmBooking() {
    var notes = document.getElementById('book-notes').value;
    var btn = document.getElementById('book-confirm');
    btn.classList.add('is-loading');
    btn.disabled = true;

    try {
      var res = await HM.api.patient.bookAppointment({
        doctor_id: state.doctorId,
        scheduled_start: state.start,
        scheduled_end: state.end,
        notes: notes,
      });

      // Show payment modal
      showPaymentModal(res.appointment, res.stripe_client_secret);
    } catch (e) {
      btn.classList.remove('is-loading');
      btn.disabled = false;
      HM.ui.toast(e.message || 'Booking failed', 'danger');
    }
  }

  function showPaymentModal(appointment, clientSecret) {
    var html = '' +
      '<p class="mb-4">Choose your payment method · 選擇付款方式</p>' +
      '<div class="grid-auto" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--s-2); margin-bottom: var(--s-6);">' +
      payMethod('card', '💳', 'Card') +
      payMethod('fpx', '🏦', 'FPX') +
      payMethod('tng', '🔵', 'Touch\'n Go') +
      payMethod('grab', '🟢', 'GrabPay') +
      payMethod('shopee', '🟠', 'ShopeePay') +
      '</div>' +
      '<button id="pay-now" class="btn btn--primary btn--block btn--lg">Pay ' + HM.format.money(appointment.fee) + ' · 付款</button>' +
      '<p class="text-xs text-muted text-center mt-3">Secured by Stripe · 安全支付</p>';

    var m = HM.ui.modal({ title: 'Payment · 付款', content: html });

    var selected = 'card';
    m.element.querySelectorAll('[data-pay]').forEach(function (b) {
      b.addEventListener('click', function () {
        selected = b.getAttribute('data-pay');
        m.element.querySelectorAll('[data-pay]').forEach(function (x) { x.classList.remove('is-selected'); });
        b.classList.add('is-selected');
      });
    });

    m.element.querySelector('#pay-now').addEventListener('click', function () {
      m.close();
      HM.ui.toast('Payment processing (demo mode)… · 付款處理中（示範）', 'success');
      setTimeout(function () {
        HM.ui.toast('Appointment booked! · 預約成功', 'success');
        location.hash = '#/appointments';
      }, 1500);
    });
  }

  function payMethod(id, icon, label) {
    return '<button data-pay="' + id + '" class="btn btn--outline" style="padding: var(--s-3); flex-direction: column; gap: var(--s-1); height: auto; min-height: 80px;">' +
      '<span style="font-size: 1.5rem;">' + icon + '</span>' +
      '<span style="font-size: var(--text-xs);">' + label + '</span>' +
      '</button>';
  }

  HM.patientPanels.booking = {
    render: render,
    showTime: showTimeStep,
  };
})();
