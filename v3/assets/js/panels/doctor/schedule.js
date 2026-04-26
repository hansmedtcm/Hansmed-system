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
    overrides: [],       // array of { date, type: 'off'|'custom', start?, end? }
  };

  function overrideFor(dateStr) {
    for (var i = 0; i < state.overrides.length; i++) {
      if (state.overrides[i].date === dateStr) return state.overrides[i];
    }
    return null;
  }

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
      var list = res.data || [];
      // Backend may still return legacy strings; normalise to objects.
      state.overrides = list.map(function (e) {
        if (typeof e === 'string') return { date: e, type: 'off' };
        return {
          date:  e.date,
          type:  e.type || 'off',
          start: e.start || null,
          end:   e.end || null,
        };
      });
    } catch (_) { state.overrides = []; }
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

    var overrideByDate = {};
    state.overrides.forEach(function (e) { overrideByDate[e.date] = e; });

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
      var override = overrideByDate[dateStr];
      var isOff = override && override.type === 'off';
      var isCustom = override && override.type === 'custom';
      var appts = apptsByDate[dateStr] || [];

      var classes = ['cal-cell'];
      if (dateStr === todayStr) classes.push('cal-cell--today');
      if (isOff) classes.push('cal-cell--off');
      else if (isCustom) classes.push('cal-cell--custom');
      else if (hasWork) classes.push('cal-cell--work');

      var apptDot = '';
      if (appts.length && !isOff) {
        apptDot = '<div class="cal-appt-count">' + appts.length + ' appt' + (appts.length > 1 ? 's' : '') + '</div>';
      }

      var workTime = '';
      if (isOff) {
        workTime = '<div class="cal-off-label">OFF · 休</div>';
      } else if (isCustom) {
        workTime = '<div class="cal-custom-time">' + override.start + '–' + override.end + '</div>' +
                   '<div class="cal-custom-label">Custom · 自訂</div>';
      } else if (hasWork) {
        workTime = '<div class="cal-work-time">' + weeklySlots[0].start_time.slice(0,5) + '–' + weeklySlots[0].end_time.slice(0,5) + '</div>';
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
      '<span><span class="cal-dot cal-dot--custom"></span> Custom hours · 自訂時段</span>' +
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
    var override = overrideFor(dateStr);
    var isOff = override && override.type === 'off';
    var isCustom = override && override.type === 'custom';

    // Defaults for custom-hours inputs: use override values if set, else weekly pattern, else 09:00-13:00.
    var defaultStart = isCustom ? override.start
                     : (weeklySlots.length ? weeklySlots[0].start_time.slice(0, 5) : '09:00');
    var defaultEnd   = isCustom ? override.end
                     : (weeklySlots.length ? weeklySlots[0].end_time.slice(0, 5) : '13:00');

    // Current status banner
    var statusHtml;
    if (isOff) {
      statusHtml = '<div class="alert alert--danger mb-3" style="margin-top:0;"><div class="alert-body text-sm">' +
        '🚫 <strong>Full Day Off · 全日休息</strong><br>Patients cannot book on this date.</div></div>';
    } else if (isCustom) {
      statusHtml = '<div class="alert alert--warning mb-3" style="margin-top:0;"><div class="alert-body text-sm">' +
        '⏰ <strong>Custom Hours · 自訂時段</strong> — ' + override.start + ' to ' + override.end +
        '<br>Overrides the weekly pattern for this date only.</div></div>';
    } else {
      statusHtml = '<div class="alert alert--info mb-3" style="margin-top:0;"><div class="alert-body text-sm">' +
        '✓ <strong>Normal Working Day · 正常工作日</strong><br>Following the weekly pattern.</div></div>';
    }

    var content = '<div class="mb-3"><strong>' + dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '</strong></div>' +
      statusHtml;

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
        var visitBadge = (a.visit_type === 'walk_in')
          ? '<span class="badge" style="background:rgba(184,150,90,.15);color:var(--gold);font-size:10px;">🏥 Walk-in</span>'
          : '<span class="badge" style="background:rgba(74,144,217,.15);color:#4a90d9;font-size:10px;">📹 Online</span>';
        return '<div class="card mb-2" style="padding: var(--s-2) var(--s-3);">' +
          '<div class="flex-between" style="align-items:center;">' +
          '<div><strong>' + HM.format.time(a.scheduled_start) + '</strong> · ' + HM.format.esc(HM.format.patientLabel(a)) +
          (a.concern_label ? ' · ' + HM.format.esc(a.concern_label) : '') +
          ' ' + visitBadge + '</div>' +
          '<div>' + HM.format.statusBadge(a.status) + '</div>' +
          '</div></div>';
      }).join('');
    } else {
      content += '<p class="text-muted text-sm mb-3">No appointments on this day.</p>';
    }

    // ── Override controls ──
    content += '<div class="text-label mt-4 mb-2">Adjust This Date · 調整此日期</div>' +
      '<div class="card" style="padding: var(--s-4); background: var(--washi);">' +

      // Custom hours
      '<div class="text-sm" style="font-weight: 500; margin-bottom: var(--s-2);">⏰ Custom Hours · 自訂時段</div>' +
      '<div class="text-xs text-muted mb-3">Work only during these hours on this specific date (e.g. half-day).</div>' +
      '<div class="flex gap-2" style="align-items: end;">' +
      '<div><label class="text-xs text-muted">Start · 開始</label>' +
      '<input type="time" id="ov-start" class="field-input field-input--boxed" value="' + defaultStart + '" style="margin:0;"></div>' +
      '<div><label class="text-xs text-muted">End · 結束</label>' +
      '<input type="time" id="ov-end" class="field-input field-input--boxed" value="' + defaultEnd + '" style="margin:0;"></div>' +
      '<button class="btn btn--primary btn--sm" id="save-custom" style="margin-left:auto;">Set Custom Hours · 儲存自訂</button>' +
      '</div>' +

      // Quick half-day buttons
      '<div class="flex gap-2 mt-3 flex-wrap">' +
      '<button class="btn btn--outline btn--sm" data-quick="morning">☀️ Morning Only · 上午</button>' +
      '<button class="btn btn--outline btn--sm" data-quick="afternoon">🌆 Afternoon Only · 下午</button>' +
      '</div>' +

      '<hr style="margin: var(--s-4) 0; border: none; border-top: 1px solid var(--border);">' +

      // Action buttons
      '<div class="flex gap-2 flex-wrap">' +
      (isOff
        ? '<button class="btn btn--primary" id="act-resume">✓ Restore Normal Day · 恢復正常工作日</button>'
        : '<button class="btn btn--danger" id="act-off">✗ Mark as Full-Day Off · 標記為假期</button>') +
      (override
        ? '<button class="btn btn--ghost" id="act-clear">Clear override · 清除調整</button>'
        : '') +
      '</div>' +
      '</div>';

    var m = HM.ui.modal({ title: 'Day Details · ' + dateStr, content: content, size: 'md' });

    function doRequest(type, start, end) {
      var btns = m.element.querySelectorAll('button');
      btns.forEach(function (b) { b.disabled = true; });
      return HM.api.doctor.setDayOverride(dateStr, type, start, end)
        .then(function (res) {
          state.overrides = (res.data || []).map(function (e) {
            if (typeof e === 'string') return { date: e, type: 'off' };
            return e;
          });
          var msg = {
            off:     'Marked as off day · 已標記假期',
            custom:  'Custom hours saved · 自訂時段已儲存',
            cleared: 'Restored to normal day · 已恢復正常',
          }[res.action] || 'Updated';
          HM.ui.toast(msg, 'success');
          m.close();
          renderCalendar();
        })
        .catch(function (e) {
          btns.forEach(function (b) { b.disabled = false; });
          HM.ui.toast(e.message || 'Failed', 'danger');
        });
    }

    // Wire handlers
    var actOff    = m.element.querySelector('#act-off');
    var actResume = m.element.querySelector('#act-resume');
    var actClear  = m.element.querySelector('#act-clear');
    var saveC     = m.element.querySelector('#save-custom');

    if (actOff)    actOff.addEventListener('click', function () { doRequest('off'); });
    if (actResume) actResume.addEventListener('click', function () { doRequest('clear'); });
    if (actClear)  actClear.addEventListener('click', function () { doRequest('clear'); });
    if (saveC) saveC.addEventListener('click', function () {
      var s = m.element.querySelector('#ov-start').value;
      var e = m.element.querySelector('#ov-end').value;
      if (!s || !e) return HM.ui.toast('Please enter both start and end', 'warning');
      if (s >= e) return HM.ui.toast('Start must be before end', 'warning');
      doRequest('custom', s, e);
    });

    m.element.querySelectorAll('[data-quick]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var kind = btn.getAttribute('data-quick');
        // Anchor quick presets to the weekly pattern if available.
        var baseStart = weeklySlots.length ? weeklySlots[0].start_time.slice(0, 5) : '09:00';
        var baseEnd   = weeklySlots.length ? weeklySlots[0].end_time.slice(0, 5)   : '17:00';
        var mid = '13:00';
        // Simple midpoint calc if there's a weekly pattern
        if (weeklySlots.length) {
          var sH = parseInt(baseStart.slice(0, 2), 10);
          var eH = parseInt(baseEnd.slice(0, 2), 10);
          mid = String(Math.round((sH + eH) / 2)).padStart(2, '0') + ':00';
        }
        var s = kind === 'morning' ? baseStart : mid;
        var e = kind === 'morning' ? mid : baseEnd;
        doRequest('custom', s, e);
      });
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
      '.cal-cell--custom{background:rgba(184,150,90,.12);}' +
      '.cal-daynum{font-family:var(--font-display);font-size:var(--text-lg);color:var(--ink);line-height:1;margin-bottom:4px;}' +
      '.cal-work-time{font-size:10px;color:var(--sage);font-weight:500;}' +
      '.cal-custom-time{font-size:10px;color:var(--gold);font-weight:600;}' +
      '.cal-custom-label{font-size:9px;color:var(--gold);letter-spacing:.08em;text-transform:uppercase;}' +
      '.cal-off-label{font-size:10px;color:var(--red-seal);font-weight:600;letter-spacing:.08em;}' +
      '.cal-appt-count{position:absolute;bottom:6px;right:8px;font-size:10px;color:var(--gold);font-weight:500;background:rgba(184,150,90,.15);padding:2px 6px;border-radius:999px;}' +
      '.cal-legend{display:flex;gap:var(--s-4);margin-top:var(--s-3);font-size:var(--text-xs);color:var(--stone);flex-wrap:wrap;}' +
      '.cal-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:middle;}' +
      '.cal-dot--work{background:rgba(122,140,114,.7);}' +
      '.cal-dot--custom{background:rgba(184,150,90,.7);}' +
      '.cal-dot--off{background:rgba(192,57,43,.7);}' +
      '.cal-dot--appt{background:var(--gold);}';
    document.head.appendChild(s);
  }

  HM.doctorPanels.schedule = { render: render };
})();
