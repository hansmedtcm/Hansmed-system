/**
 * Doctor Dashboard
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  async function render(el) {
    HM.state.loading(el);
    try {
      var results = await Promise.allSettled([
        HM.api.doctor.listAppointments(),
        HM.api.doctor.getEarnings(),
        HM.api.doctor.listPrescriptions(),
      ]);
      var appts = results[0].status === 'fulfilled' ? (results[0].value.data || []) : [];
      var earnings = results[1].status === 'fulfilled' ? results[1].value : {};
      var rxs = results[2].status === 'fulfilled' ? (results[2].value.data || []) : [];

      var today = new Date().toDateString();
      var todayAppts = appts.filter(function (a) { return new Date(a.scheduled_start).toDateString() === today; });
      var upcoming = appts.filter(function (a) {
        return ['confirmed','pending_payment','in_progress'].indexOf(a.status) >= 0;
      }).sort(function (a, b) { return new Date(a.scheduled_start) - new Date(b.scheduled_start); });

      var user = HM.auth.user();
      var name = HM.auth.displayName(user);
      var hour = new Date().getHours();
      var greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

      el.innerHTML = '<div class="page-header">' +
        '<div class="page-header-label">Dashboard · 總覽</div>' +
        '<h1 class="page-title">' + greeting + ', ' + HM.format.esc(name) + '</h1>' +
        '<p class="page-subtitle">Here\'s your practice at a glance</p>' +
        '</div>' +

        '<div class="stats-grid mb-6">' +
        stat(todayAppts.length, "Today's Appts · 今日") +
        stat(upcoming.length, 'Upcoming · 即將') +
        stat(rxs.length, 'Prescriptions · 處方') +
        stat(HM.format.money(earnings.available_balance), 'Available · 可提現') +
        '</div>' +

        '<div class="grid-auto" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">' +
        todayCard(todayAppts) +
        earningsCard(earnings) +
        '</div>' +

        '<div class="mt-6">' +
        '<div class="text-label mb-3">Quick Actions · 快捷操作</div>' +
        '<div class="grid-auto" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">' +
        action('📅', 'Today\'s Queue', '#/queue') +
        action('👥', 'My Patients', '#/patients') +
        action('📝', 'Prescriptions', '#/prescriptions') +
        action('⏰', 'Schedule', '#/schedule') +
        '</div></div>';
    } catch (e) {
      HM.state.error(el, e);
    }
  }

  function stat(num, label) {
    return '<div class="stat-card"><div class="stat-number">' + num + '</div><div class="stat-label">' + label + '</div></div>';
  }

  function todayCard(appts) {
    var html = '<div><div class="text-label mb-3">Today · 今日</div>';
    if (!appts.length) {
      html += '<div class="card"><p class="text-muted text-center">No appointments today<br><span style="font-family: var(--font-zh);">今日無預約</span></p></div>';
    } else {
      html += '<div class="card">';
      appts.slice(0, 5).forEach(function (a) {
        html += '<div class="flex-between mb-2" style="padding: var(--s-2) 0; border-bottom: 1px solid var(--border);">' +
          '<div><strong>' + HM.format.time(a.scheduled_start) + '</strong><br>' +
          '<span class="text-xs text-muted">Patient #' + a.patient_id + '</span></div>' +
          HM.format.statusBadge(a.status) +
          '</div>';
      });
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function earningsCard(e) {
    return '<div><div class="text-label mb-3">Earnings · 收入</div>' +
      '<div class="card card--bordered" style="border-left-color: var(--sage);">' +
      '<div class="flex-between mb-2"><span class="text-muted">Gross</span><span>' + HM.format.money(e.gross_revenue) + '</span></div>' +
      '<div class="flex-between mb-2"><span class="text-muted">Net Earnings</span><strong>' + HM.format.money(e.net_earnings) + '</strong></div>' +
      '<div class="flex-between"><span class="text-muted">Available</span><strong style="color: var(--gold);">' + HM.format.money(e.available_balance) + '</strong></div>' +
      '<button class="btn btn--outline btn--sm btn--block mt-4" onclick="location.hash=\'#/earnings\'">View Details</button>' +
      '</div></div>';
  }

  function action(icon, title, href) {
    return '<div class="card card--clickable text-center" onclick="location.hash=\'' + href + '\'">' +
      '<div style="font-size: 2rem; margin-bottom: var(--s-2);">' + icon + '</div>' +
      '<div style="font-family: var(--font-display);">' + title + '</div></div>';
  }

  HM.doctorPanels.dashboard = { render: render };
})();
