/**
 * Doctor Schedule — manage weekly slots
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  var weekdays = ['Sunday·週日','Monday·週一','Tuesday·週二','Wednesday·週三','Thursday·週四','Friday·週五','Saturday·週六'];

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Schedule · 排班</div>' +
      '<h1 class="page-title">Manage Your Availability</h1>' +
      '<p class="page-subtitle">Set when patients can book with you</p>' +
      '</div>' +
      '<div class="card card--pad-lg mb-6" style="max-width: 600px;">' +
      '<h3 class="mb-3">Add Time Slot · 新增時段</h3>' +
      '<div class="field-grid field-grid--3">' +
      '<div class="field"><label class="field-label">Weekday · 星期</label>' +
      '<select id="sch-day" class="field-input field-input--boxed">' +
      weekdays.map(function (d, i) { return '<option value="' + i + '">' + d + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field"><label class="field-label">Start · 開始</label><input id="sch-start" type="time" class="field-input field-input--boxed" value="09:00"></div>' +
      '<div class="field"><label class="field-label">End · 結束</label><input id="sch-end" type="time" class="field-input field-input--boxed" value="17:00"></div>' +
      '</div>' +
      '<div class="field"><label class="field-label">Slot Length · 時段長度</label>' +
      '<select id="sch-len" class="field-input field-input--boxed"><option value="15">15 min</option><option value="20">20 min</option><option value="30" selected>30 min</option><option value="45">45 min</option><option value="60">60 min</option></select>' +
      '</div>' +
      '<button class="btn btn--primary" id="sch-add">Add · 新增</button>' +
      '</div>' +
      '<div class="text-label mb-3">Your Schedule · 您的排班</div>' +
      '<div id="sch-list"></div>';

    document.getElementById('sch-add').addEventListener('click', addSchedule);
    await load();
  }

  async function load() {
    var container = document.getElementById('sch-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.doctor.listSchedules();
      var schedules = res.schedules || [];
      if (!schedules.length) {
        HM.state.empty(container, {
          icon: '⏰',
          title: 'No schedule set',
          text: 'Add time slots above so patients can book appointments with you',
        });
        return;
      }
      container.innerHTML = '';
      schedules.forEach(function (s) {
        var card = document.createElement('div');
        card.className = 'card mb-2';
        card.innerHTML = '<div class="flex-between">' +
          '<div><strong>' + weekdays[s.weekday] + '</strong> · ' + s.start_time + ' - ' + s.end_time + ' (' + s.slot_minutes + ' min slots)</div>' +
          '<button class="btn btn--ghost btn--sm" style="color: var(--red-seal);" data-id="' + s.id + '">Delete</button>' +
          '</div>';
        card.querySelector('button').addEventListener('click', async function () {
          try {
            await HM.api.doctor.deleteSchedule(s.id);
            HM.ui.toast('Removed', 'success');
            load();
          } catch (e) { HM.ui.toast('Failed', 'danger'); }
        });
        container.appendChild(card);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  async function addSchedule() {
    try {
      await HM.api.doctor.createSchedule({
        weekday: parseInt(document.getElementById('sch-day').value),
        start_time: document.getElementById('sch-start').value,
        end_time: document.getElementById('sch-end').value,
        slot_minutes: parseInt(document.getElementById('sch-len').value),
      });
      HM.ui.toast('Schedule added · 已新增', 'success');
      load();
    } catch (e) { HM.ui.toast(e.message || 'Failed', 'danger'); }
  }

  HM.doctorPanels.schedule = { render: render };
})();
