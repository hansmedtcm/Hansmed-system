/**
 * Doctor Schedule — calendar view + weekly availability + off-day manager.
 *
 * Top: month-view calendar that merges
 *   (a) the doctor's weekly working-hour pattern (e.g. "Mon 9-5")
 *   (b) actual booked appointments for each day
 *   (c) ad-hoc off-days the doctor has marked
 * Bottom: weekly slot manager (add / remove weekly working hours).
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  var WEEK = ['Sun · 日','Mon · 一','Tue · 二','Wed · 三','Thu · 四','Fri · 五','Sat · 六'];
  var WEEKDAYS_FULL = ['Sunday · 週日','Monday · 週一','Tuesday · 週二','Wednesday · 週三','Thursday · 週四','Friday · 週五','Saturday · 週六'];

  var state = {
    year: 0, month: 0,   // current month view
    schedules: [],       // weekly recurring availability
    appointments: [],    // this month's appointments
    offDays: [],         // array of 'YYYY-MM-DD'
  };

  async function render(el) {
    var now = new Date();
    state.year = now.getFullYear();
    state.month = now.getMonth();

    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Schedule · 排班</div>' +
      '<h1 class="page-title">My Calendar &amp; Availability</h1>' +
      '<p class="text-muted mt-1">Calendar shows your weekly availability, booked appointments, and any off days. Click a day to mark or un-mark it as off. ' +
      '<span style="font-family: var(--font-zh);">行事曆同步顯示週排班、預約與個人假期。點擊日期可切換假期狀態。</span></p>' +
      '</div>' +

      '<div id="cal-wrap" class="card card--pad-lg mb-6"></div>' +

      '<div class="text-label mb-3">Weekly Availability · 每週固定時段</div>' +
      '<div class="card card--pad-lg mb-4" style="max-width: 720px;">' +
      '<h3 class="mb-3">Add Time Slot · 新增時段</h3>' +
      '<div class="field-grid field-grid--3">' +
      '<div class="field"><label class="field-label">Weekday · 星期</label>' +
      '<select id="sch-day" class="field-input field-input--boxed">' +
      WEEKDAYS_FULL.map(function (d, i) { return '<option value="' + i + '">' + d + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field"><label class="field-label">Start · 開始</label><input id="sch-start" type="time" class="field-input field-input--boxed" value="09:00"></div>' +
      '<div class="field"><label class="field-label">End · 結束</label><input id="sch-end" type="time" class="field-input field-input--boxed" value="17:00"></div>' +
      '</div>' +
      '<div class="field"><label class="field-label">Slot Length · 時段長度</label>' +
      '<select id="sch-len" class="field-input field-input--boxed"><option value="15">15 min</option><option value="20">20 min</option><option value="30" selected>30 min</option><option value="45">45 min</option><option value="60">60 min</option></select>' +
      '</div>' +
      '<button class="btn btn--primary" id="sch-add">+ Add · 新增</button>' +
      '</div>' +

      '<div id="sch-list"></div>';

    injectStyle();
    document.getElementById('sch-add').addEventListener('click', addSchedule);

    await refreshAll();
  }

  async function refreshAll() {
    await Promise.all([loadSchedules(), loadAppointments(), loadOffDays()]);
    renderCalendar();
    renderWeeklyList();
  }

  async function loadSchedules() {
    try {
      var res = await HM.api.doctor.listSchedules();
      state.schedules = res.schedules || res.data || [];
    } catch (_) { state.schedules = []; }
  }

  async function loadAppointments() {
    try {
      // Broad fetch — backend paginates/filters on its side.
      var res = await HM.api.doctor.listAppointments();
      state.appointments = res.data || [];
    } catch (_) { state.appointments = []; }
  }

  async function loadOffDays() {
    try {
      var res = await HM.api.doctor.listOffDays();
      state.offDays = res.data || [];
    } catch (_) { state.offDays = []; }
  }

  // ── Calendar ────────────────────────────────────────────────
  function renderCalendar() {
    var wrap = document.getElementById('cal-wrap');
    if (!wrap) return;

    var first = new Date(state.year, state.month, 1);
    var last = new Date(state.year, state.month + 1, 0);
    var monthLabel = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    var daysInMonth = last.getDate();
    var startOffset = first.getDay();

    // Build weekday-to-slots map from schedules
    var slotsByWeekday = {};
    state.schedules.forEach(function (s) {
      var w = s.weekday;
      if (!slotsByWeekday[w]) slotsByWeekday[w] = [];
      slotsByWeekday[w].push(s);
    });

    // Appointments by YYYY-MM-DD for this month
    var apptsByDate = {};
    state.appointments.forEach(function (a) {
      var d = (a.scheduled_start || '').slice(0, 10);
      if (!d) return;
      if (!apptsByDate[d]) apptsByDate[d] = [];
      apptsByDate[d].push(a);
    });

    var offSet = {};
    state.offDays.forEach(function (d) { offSet[d] = true; });

    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    var html = '<div class="cal-head">' +
      '<button class="btn btn--ghost btn--sm" data-nav="prev">← Prev</button>' +
      '<div class="cal-title">' + monthLabel + '</div>' +
      '<button class="btn btn--ghost btn--sm" data-nav="next">Next →</button>' +
      '<button class="btn btn--outline btn--sm" data-nav="today" style="margin-left:auto;">Today · 今日</button>' +
      '</div>' +

      '<div class="cal-grid cal-grid-head">' +
      WEEK.map(function (w) { return '<div class="cal-weekhead">' + w + '</div>'; }).join('') +
      '</div>' +

      '<div class="cal-grid">';

    // Leading blank cells
    for (var i = 0; i < startOffset; i++) html += '<div class="cal-cell cal-cell--empty"></div>';

    for (var d = 1; d <= daysInMonth; d++) {
      var dateObj = new Date(state.year, state.month, d);
      var dateStr = state.year + '-' + String(state.month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var weekday = dateObj.getDay();
      var weeklySlots = slotsByWeekday[weekday] || [];
      var hasWork = weeklySlots.length > 0;
      var isOff = !!offSet[dateStr];
      var appts = apptsByDate[dateStr] || [];
      var classes = ['cal-cell'];
      if (dateStr === todayStr) classes.push('cal-cell--today');
      if (isOff) classes.push('cal-cell--off');
      else if (hasWork) classes.push('cal-cell--work');

      var apptDot = '';
      if (appts.length && !isOff) {
        apptDot = '<div class="cal-appt-count">' + appts.length + ' appt' + (appts.length > 1 ? 's' : '') + '</div>';
      }

      var workTime = '';
      if (hasWork && !isOff) {
        workTime = '<div class="cal-work-time">' + weeklySlots[0].start_time.slice(0,5) + '–' + weeklySlots[0].end_time.slice(0,5) + '</div>';
      } else if (isOff) {
        workTime = '<div class="cal-off-label">OFF · 休</div>';
      }

      html += '<div class="' + classes.join(' ') + '" data-date="' + dateStr + '">' +
        '<div class="cal-daynum">' + d + '</div>' +
        workTime +
        apptDot +
        '</div>';
    }

    html += '</div>';

    // Legend
    html += '<div class="cal-legend">' +
      '<span><span class="cal-dot cal-dot--work"></span> Working day · 工作日</span>' +
      '<span><span class="cal-dot cal-dot--off"></span> Off day · 假期</span>' +
      '<span><span class="cal-dot cal-dot--appt"></span> Has appointments · 有預約</span>' +
      '</div>';

    wrap.innerHTML = html;

    wrap.querySelectorAll('[data-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dir = btn.getAttribute('data-nav');
        if (dir === 'prev') { state.month--; if (state.month < 0) { state.month = 11; state.year--; } }
        else if (dir === 'next') { state.month++; if (state.month > 11) { state.month = 0; state.year++; } }
        else { var n = new Date(); state.year = n.getFullYear(); state.month = n.getMonth(); }
        renderCalendar();
      });
    });

    wrap.querySelectorAll('.cal-cell[data-date]').forEach(function (cell) {
      cell.addEventListener('click', function () { openDayModal(cell.getAttribute('data-date')); });
    });
  }

  function openDayModal(dateStr) {
    var dateObj = new Date(dateStr + 'T00:00:00');
    var weekday = dateObj.getDay();
    var weeklySlots = state.schedules.filter(function (s) { return s.weekday === weekday; });
    var appts = state.appointments.filter(function (a) { return (a.scheduled_start || '').slice(0, 10) === dateStr; });
    var isOff = state.offDays.indexOf(dateStr) >= 0;

    var content = '<div class="mb-3"><strong>' + dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '</strong></div>';

    // Weekly availability info
    content += '<div class="text-label mb-2">Weekly Availability · 每週可用時段</div>';
    if (weeklySlots.length) {
      content += weeklySlots.map(function (s) {
        return '<div class="card mb-2" style="padding: var(--s-2) var(--s-3);">' +
          s.start_time.slice(0, 5) + '–' + s.end_time.slice(0, 5) +
          ' · ' + (s.slot_minutes || 30) + ' min slots</div>';
      }).join('');
    } else {
      content += '<p class="text-muted text-sm mb-3">No weekly slots configured for ' + WEEKDAYS_FULL[weekday] + '.</p>';
    }

    // Appointments on this day
    content += '<div class="text-label mt-4 mb-2">Appointments · 當日預約</div>';
    if (appts.length) {
      content += appts.map(function (a) {
        return '<div class="card mb-2" style="padding: var(--s-2) var(--s-3);">' +
          '<div class="flex-between">' +
          '<div><strong>' + HM.format.time(a.scheduled_start) + '</strong> · Patient #' + a.patient_id +
          (a.concern_label ? ' · ' + HM.format.esc(a.concern_label) : '') + '</div>' +
          '<div>' + HM.format.statusBadge(a.status) + '</div>' +
          '</div></div>';
      }).join('');
    } else {
      content += '<p class="text-muted text-sm mb-3">No appointments on this day.</p>';
    }

    // Off-day toggle
    content += '<div class="alert alert--info mt-4">' +
      '<div class="alert-body text-sm">' +
      (isOff
        ? 'This day is marked as <strong>OFF</strong>. Patients cannot book into your weekly slots on this specific day.'
        : 'This day follows your normal weekly availability. You can mark it as OFF to block bookings on this specific date only.') +
      '</div></div>' +
      '<div class="flex gap-2">' +
      '<button class="btn btn--' + (isOff ? 'outline' : 'danger') + '" id="toggle-off">' +
      (isOff ? '✓ Resume as working day · 恢復工作' : '✗ Mark as off day · 標記為假期') +
      '</button>' +
      '</div>';

    var m = HM.ui.modal({ title: 'Day Details · ' + dateStr, content: content });

    m.element.querySelector('#toggle-off').addEventListener('click', async function () {
      this.disabled = true;
      try {
        var res = await HM.api.doctor.toggleOffDay(dateStr);
        state.offDays = res.data || [];
        HM.ui.toast(res.action === 'added' ? 'Marked as off day · 已標記假期' : 'Restored as working day · 恢復工作', 'success');
        m.close();
        renderCalendar();
      } catch (e) {
        this.disabled = false;
        HM.ui.toast(e.message || 'Failed', 'danger');
      }
    });
  }

  // ── Weekly slots ────────────────────────────────────────────
  function renderWeeklyList() {
    var container = document.getElementById('sch-list');
    if (!container) return;
    if (!state.schedules.length) {
      container.innerHTML = '<div class="card"><p class="text-muted text-center">No weekly slots set yet · 尚未設定每週排班</p></div>';
      return;
    }
    container.innerHTML = '';
    state.schedules.forEach(function (s) {
      var card = document.createElement('div');
      card.className = 'card mb-2';
      card.innerHTML = '<div class="flex-between">' +
        '<div><strong>' + WEEKDAYS_FULL[s.weekday] + '</strong> · ' + s.start_time.slice(0, 5) + ' – ' + s.end_time.slice(0, 5) +
        ' <span class="text-muted text-xs">(' + (s.slot_minutes || 30) + ' min slots)</span></div>' +
        '<button class="btn btn--ghost btn--sm" style="color: var(--red-seal);">Delete</button>' +
        '</div>';
      card.querySelector('button').addEventListener('click', async function () {
        try {
          await HM.api.doctor.deleteSchedule(s.id);
          HM.ui.toast('Removed · 已移除', 'success');
          await refreshAll();
        } catch (e) { HM.ui.toast('Failed', 'danger'); }
      });
      container.appendChild(card);
    });
  }

  async function addSchedule() {
    try {
      await HM.api.doctor.createSchedule({
        weekday:      parseInt(document.getElementById('sch-day').value, 10),
        start_time:   document.getElementById('sch-start').value,
        end_time:     document.getElementById('sch-end').value,
        slot_minutes: parseInt(document.getElementById('sch-len').value, 10),
      });
      HM.ui.toast('Schedule added · 已新增', 'success');
      await refreshAll();
    } catch (e) { HM.ui.toast(e.message || 'Failed', 'danger'); }
  }

  // ── Styles ─────────────────────────────────────────────────
  function injectStyle() {
    if (document.getElementById('cal-style')) return;
    var s = document.createElement('style');
    s.id = 'cal-style';
    s.textContent =
      '.cal-head{display:flex;align-items:center;gap:var(--s-3);margin-bottom:var(--s-4);}' +
      '.cal-title{font-family:var(--font-display);font-size:var(--text-xl);color:var(--ink);}' +
      '.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden;}' +
      '.cal-grid-head{margin-bottom:0;}' +
      '.cal-weekhead{background:var(--washi);padding:8px 6px;text-align:center;font-size:var(--text-xs);font-weight:500;color:var(--stone);letter-spacing:.06em;}' +
      '.cal-cell{background:#fff;min-height:84px;padding:6px 8px;cursor:pointer;transition:background .15s;position:relative;}' +
      '.cal-cell:hover{background:var(--washi);}' +
      '.cal-cell--empty{background:var(--washi);cursor:default;}' +
      '.cal-cell--empty:hover{background:var(--washi);}' +
      '.cal-cell--today{outline:2px solid var(--gold);outline-offset:-2px;}' +
      '.cal-cell--work{background:rgba(122,140,114,.07);}' +
      '.cal-cell--off{background:rgba(192,57,43,.08);}' +
      '.cal-daynum{font-family:var(--font-display);font-size:var(--text-lg);color:var(--ink);line-height:1;margin-bottom:4px;}' +
      '.cal-work-time{font-size:10px;color:var(--sage);font-weight:500;}' +
      '.cal-off-label{font-size:10px;color:var(--red-seal);font-weight:600;letter-spacing:.08em;}' +
      '.cal-appt-count{position:absolute;bottom:6px;right:8px;font-size:10px;color:var(--gold);font-weight:500;background:rgba(184,150,90,.15);padding:2px 6px;border-radius:999px;}' +
      '.cal-legend{display:flex;gap:var(--s-4);margin-top:var(--s-3);font-size:var(--text-xs);color:var(--stone);flex-wrap:wrap;}' +
      '.cal-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:middle;}' +
      '.cal-dot--work{background:rgba(122,140,114,.7);}' +
      '.cal-dot--off{background:rgba(192,57,43,.7);}' +
      '.cal-dot--appt{background:var(--gold);}';
    document.head.appendChild(s);
  }

  HM.doctorPanels.schedule = { render: render };
})();
