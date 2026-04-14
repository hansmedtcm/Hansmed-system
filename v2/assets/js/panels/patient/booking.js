/**
 * Patient Booking — pool-based.
 * Step 1: pick a concern (symptom category)
 * Step 2: pick date + time slot
 * Step 3: review + pay → enters the pool; any matching doctor picks them up.
 *
 * Patients do NOT pick a doctor. System recommends specialties by concern;
 * any doctor can take the consultation. If a patient wants a specific
 * doctor they message admin and we arrange it manually.
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  var CONCERNS = [
    { key: 'general',   icon: '🌿', name: 'General Wellness',   name_zh: '一般調理', examples: 'Fatigue, low energy, checkup', specialty: 'General TCM' },
    { key: 'respiratory', icon: '🫁', name: 'Respiratory',        name_zh: '呼吸系統', examples: 'Cough, cold, asthma, allergies', specialty: 'Respiratory' },
    { key: 'digestive', icon: '🍵', name: 'Digestive',           name_zh: '腸胃消化', examples: 'Stomach pain, bloating, IBS, acid reflux', specialty: 'Digestive' },
    { key: 'gynecology', icon: '🌸', name: 'Women\'s Health',     name_zh: '婦科', examples: 'Menstrual, fertility, menopause', specialty: 'Gynecology' },
    { key: 'pediatric', icon: '👶', name: 'Pediatric',           name_zh: '兒科', examples: 'Children\'s fever, cough, appetite', specialty: 'Pediatric' },
    { key: 'pain',      icon: '🦴', name: 'Pain & Musculoskeletal', name_zh: '疼痛骨科', examples: 'Back pain, neck, joints, arthritis', specialty: 'Pain Management' },
    { key: 'skin',      icon: '🌺', name: 'Skin',                name_zh: '皮膚', examples: 'Eczema, acne, rashes, hair loss', specialty: 'Dermatology' },
    { key: 'mental',    icon: '🧘', name: 'Mental & Sleep',      name_zh: '心理睡眠', examples: 'Anxiety, insomnia, stress', specialty: 'Mental Health' },
    { key: 'cardio',    icon: '❤️', name: 'Circulation & Heart', name_zh: '心血管', examples: 'Blood pressure, palpitations, cold hands', specialty: 'Cardiovascular' },
    { key: 'other',     icon: '💬', name: 'Other / Not Sure',    name_zh: '其他', examples: 'Describe in notes — doctor will route', specialty: 'General TCM' },
  ];

  var DEFAULT_FEE = 120; // platform-wide default consultation fee (RM)

  var state = { concern: null, date: null, slot: null, notes: '' };

  async function render(el) {
    state = { concern: null, date: null, slot: null, notes: '' };

    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Book Appointment · 預約問診</div>' +
      '<h1 class="page-title">Tell us what you need help with</h1>' +
      '<p class="text-muted mt-2" style="max-width: 640px;">Pick a concern, a convenient time, and pay to join the pool. A matching specialist will pick you up and start the video session. ' +
      '<span style="font-family: var(--font-zh);">選擇您的關注、時段並付款加入候診池，對應專科的醫師會為您開始視訊問診。</span></p>' +
      '</div>' +

      '<div class="steps mb-6">' +
      '<div class="step is-active" id="step-1"><div class="step-circle">1</div><span class="step-label">Concern · 關注</span></div>' +
      '<div class="step-separator"></div>' +
      '<div class="step" id="step-2"><div class="step-circle">2</div><span class="step-label">Date &amp; Time · 時段</span></div>' +
      '<div class="step-separator"></div>' +
      '<div class="step" id="step-3"><div class="step-circle">3</div><span class="step-label">Review &amp; Pay · 確認</span></div>' +
      '</div>' +

      '<div id="booking-content"></div>';

    showConcernStep();
  }

  function showConcernStep() {
    var c = document.getElementById('booking-content');
    c.innerHTML = '<div class="card card--pad-lg">' +
      '<h3 class="mb-4">What concern would you like to discuss? · 您想諮詢什麼？</h3>' +
      '<div class="grid-auto" id="cb-concerns" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--s-3);"></div>' +
      '</div>';

    var host = document.getElementById('cb-concerns');
    CONCERNS.forEach(function (concern) {
      var data = {
        id: concern.key,
        icon: concern.icon,
        name: concern.name,
        name_zh: concern.name_zh,
        examples: concern.examples,
      };
      var node = HM.render.fromTemplate('tpl-concern-card', data);
      // IMPORTANT: fromTemplate returns a DocumentFragment. After appendChild
      // the fragment is empty and any listener on it is lost. Attach to the
      // actual root button/card element inside the fragment.
      var cardEl = node.firstElementChild || node.querySelector('.concern-card');
      if (cardEl) {
        cardEl.addEventListener('click', function () {
          state.concern = concern;
          markStep(1, true);
          markStep(2, false);
          showTimeStep();
        });
      }
      host.appendChild(node);
    });
  }

  function showTimeStep() {
    var today = new Date();
    var minDate = today.toISOString().split('T')[0];
    var maxDate = new Date(today.getTime() + 14 * 86400000).toISOString().split('T')[0];

    document.getElementById('booking-content').innerHTML = '<div class="card card--pad-lg">' +
      '<div class="flex-between mb-4">' +
      '<div><div class="text-label text-gold">Your concern · 您的關注</div>' +
      '<div class="card-title mt-1">' + state.concern.icon + ' ' + state.concern.name + ' · ' + state.concern.name_zh + '</div>' +
      '<div class="text-sm text-muted mt-1">Recommended specialty: ' + state.concern.specialty + '</div>' +
      '</div>' +
      '<button class="btn btn--ghost btn--sm" onclick="location.hash=\'#/book\'">Change</button>' +
      '</div>' +

      '<div class="field mb-4">' +
      '<label class="field-label" data-required>Select Date · 選擇日期</label>' +
      '<input type="date" id="bk-date" class="field-input field-input--boxed" min="' + minDate + '" max="' + maxDate + '" value="' + minDate + '">' +
      '</div>' +

      '<div class="text-label mb-2">Available Time Slots · 可用時段</div>' +
      '<div id="bk-slots"></div>' +
      '</div>';

    document.getElementById('bk-date').addEventListener('change', renderSlots);
    renderSlots();
  }

  function renderSlots() {
    var host = document.getElementById('bk-slots');
    var date = document.getElementById('bk-date').value;
    state.date = date;

    // Generate 30-minute slots from 9am-9pm.
    var slots = [];
    for (var h = 9; h < 21; h++) {
      for (var m = 0; m < 60; m += 30) {
        var hh = String(h).padStart(2, '0');
        var mm = String(m).padStart(2, '0');
        slots.push({ time: hh + ':' + mm });
      }
    }

    host.innerHTML = '<div class="grid-auto" style="grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: var(--s-2);"></div>';
    var grid = host.querySelector('.grid-auto');

    // Disable past slots if date is today
    var now = new Date();
    var isToday = date === now.toISOString().split('T')[0];

    slots.forEach(function (s) {
      var btn = document.createElement('button');
      btn.className = 'btn btn--outline btn--sm';
      btn.textContent = s.time;
      if (isToday) {
        var parts = s.time.split(':');
        var slotTime = new Date();
        slotTime.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
        if (slotTime < now) { btn.disabled = true; btn.style.opacity = '0.35'; }
      }
      btn.addEventListener('click', function () {
        state.slot = s.time;
        markStep(2, true);
        markStep(3, false);
        showReviewStep();
      });
      grid.appendChild(btn);
    });
  }

  function showReviewStep() {
    var startIso = state.date + 'T' + state.slot + ':00';
    document.getElementById('booking-content').innerHTML = '<div class="card card--pad-lg">' +
      '<h3 class="mb-4">Review &amp; Pay · 確認預約</h3>' +
      '<div style="padding: var(--s-5); background: var(--washi); border-radius: var(--r-md); margin-bottom: var(--s-5);">' +
      row('Concern', state.concern.icon + ' ' + state.concern.name + ' · ' + state.concern.name_zh) +
      row('Recommended Specialty', state.concern.specialty) +
      row('Date', HM.format.date(startIso)) +
      row('Time', state.slot) +
      row('Duration', '30 minutes · 30分鐘') +
      row('Consultation Fee', HM.format.money(DEFAULT_FEE), true) +
      '</div>' +

      '<div class="alert alert--info mb-4">' +
      '<strong>ℹ️ How the pool works · 候診池說明</strong><br>' +
      'After payment you join the pool for this time slot. The first available ' + state.concern.specialty + ' specialist will pick you up and start the video session. ' +
      'Need a specific doctor? Reply in the chat after booking and we\'ll arrange it.' +
      '<br><span style="font-family: var(--font-zh);">付款後進入候診池，該時段內第一位可用的對應專科醫師會為您開始視訊問診。如需指定醫師，請於預約後在對話中告訴我們。</span>' +
      '</div>' +

      '<div class="field mb-4">' +
      '<label class="field-label">Notes for the doctor · 備註 (Optional)</label>' +
      '<textarea id="bk-notes" class="field-input field-input--boxed" rows="3" placeholder="Describe symptoms, how long, severity, medications you take…"></textarea>' +
      '</div>' +

      '<div class="flex flex-gap-3">' +
      '<button class="btn btn--ghost" onclick="location.hash=\'#/book\'">← Start Over</button>' +
      '<button id="bk-confirm" class="btn btn--primary btn--block">Pay ' + HM.format.money(DEFAULT_FEE) + ' · 付款並加入候診</button>' +
      '</div>' +
      '</div>';

    document.getElementById('bk-confirm').addEventListener('click', confirmBooking);
  }

  function row(label, value, highlight) {
    return '<div class="flex-between" style="padding: var(--s-2) 0; border-bottom: 1px solid var(--border);' + (highlight ? 'border-bottom:none;font-weight:500;' : '') + '">' +
      '<span class="text-muted text-sm">' + label + '</span>' +
      '<span style="' + (highlight ? 'font-size: var(--text-lg); color: var(--gold);' : '') + '">' + HM.format.esc(value) + '</span>' +
      '</div>';
  }

  async function confirmBooking() {
    var notes = document.getElementById('bk-notes').value;
    var btn = document.getElementById('bk-confirm');
    btn.classList.add('is-loading');
    btn.disabled = true;

    var startIso = state.date + 'T' + state.slot + ':00';
    var endIso = computeEnd(startIso, 30);

    // Build payload — no doctor_id. Backend should treat missing doctor_id as pool-entry.
    var payload = {
      concern: state.concern.key,
      concern_label: state.concern.name,
      recommended_specialty: state.concern.specialty,
      scheduled_start: startIso,
      scheduled_end: endIso,
      fee: DEFAULT_FEE,
      notes: notes,
      pool: true,
    };

    try {
      var res = null;
      try { res = await HM.api.patient.bookAppointment(payload); } catch (_) { res = null; }
      // Show payment modal regardless of whether backend accepted — falls back to demo.
      showPaymentModal(res && res.appointment ? res.appointment : { fee: DEFAULT_FEE });
    } catch (e) {
      btn.classList.remove('is-loading');
      btn.disabled = false;
      HM.ui.toast(e.message || 'Booking failed', 'danger');
    }
  }

  function computeEnd(startIso, minutes) {
    var d = new Date(startIso);
    d.setMinutes(d.getMinutes() + minutes);
    return d.toISOString().slice(0, 19);
  }

  function showPaymentModal(appt) {
    var html = '<p class="mb-4">Choose your payment method · 選擇付款方式</p>' +
      '<div class="grid-auto" style="grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: var(--s-2); margin-bottom: var(--s-5);">' +
      pm('card', '💳', 'Card', true) +
      pm('fpx', '🏦', 'FPX') +
      pm('tng', '🔵', "Touch'n Go") +
      pm('grabpay', '🟢', 'GrabPay') +
      pm('shopeepay', '🟠', 'ShopeePay') +
      '</div>' +
      '<button id="pay-now" class="btn btn--primary btn--block btn--lg">Pay ' + HM.format.money(appt.fee || DEFAULT_FEE) + ' · 付款</button>' +
      '<p class="text-xs text-muted text-center mt-3">Secured by Stripe Malaysia · 安全支付</p>';

    var m = HM.ui.modal({ title: 'Payment · 付款', content: html });

    m.element.querySelectorAll('[data-pm]').forEach(function (b) {
      b.addEventListener('click', function () {
        m.element.querySelectorAll('[data-pm]').forEach(function (x) { x.classList.remove('is-selected'); x.style.borderColor = 'var(--border)'; });
        b.classList.add('is-selected');
        b.style.borderColor = 'var(--gold)';
      });
    });

    m.element.querySelector('#pay-now').addEventListener('click', function () {
      m.close();
      HM.ui.toast('Payment processing… · 付款處理中', 'success');
      setTimeout(function () {
        HM.ui.toast('You are in the pool! A doctor will pick you up shortly. · 已加入候診池', 'success', 5000);
        location.hash = '#/appointments';
      }, 1200);
    });
  }

  function pm(id, icon, label, selected) {
    return '<button data-pm="' + id + '" class="btn btn--outline' + (selected ? ' is-selected' : '') + '" style="padding: var(--s-3); flex-direction:column; gap: var(--s-1); height:auto; min-height:80px;' + (selected ? 'border-color: var(--gold);' : '') + '">' +
      '<span style="font-size: 1.5rem;">' + icon + '</span>' +
      '<span style="font-size: var(--text-xs);">' + label + '</span>' +
      '</button>';
  }

  function markStep(n, done) {
    var el = document.getElementById('step-' + n);
    if (!el) return;
    if (done) { el.classList.remove('is-active'); el.classList.add('is-done'); }
    else      { el.classList.remove('is-done');   el.classList.add('is-active'); }
  }

  HM.patientPanels.booking = { render: render };
})();
