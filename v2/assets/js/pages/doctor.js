/**
 * Doctor Portal bootstrap + router
 */
(function () {
  'use strict';

  if (!HM.auth.requireAuth({ roles: ['doctor'] })) return;

  function panel() { return document.getElementById('panel-container'); }

  async function loadUserInfo() {
    try {
      var user = await HM.auth.refresh();
      var name = HM.auth.displayName(user);
      document.getElementById('sb-avatar').textContent = name.charAt(0).toUpperCase();
      document.getElementById('sb-name').textContent = name;
      document.getElementById('user-greeting').textContent = name;
      var dp = user.doctor_profile || {};
      document.getElementById('sb-since').textContent = dp.specialties || 'Doctor';
    } catch (e) { console.error(e); }
  }
  loadUserInfo();

  async function pollNotifications() {
    try {
      var res = await HM.api.notification.unreadCount();
      var count = res.count || 0;
      var badge = document.getElementById('notif-count');
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
      badge.textContent = count;
    } catch {}
  }
  pollNotifications();
  setInterval(pollNotifications, 60000);

  HM.router.on('#/', function () { HM.doctorPanels.dashboard.render(panel()); });
  HM.router.on('#/queue', function () { HM.doctorPanels.queue.render(panel()); });
  HM.router.on('#/appointments', function () { HM.doctorPanels.appointments.render(panel()); });
  HM.router.on('#/appointments/:id', function (p) { HM.doctorPanels.appointments.renderDetail(panel(), p.id); });
  HM.router.on('#/patients', function () { HM.doctorPanels.patients.render(panel()); });
  HM.router.on('#/patients/:id', function (p) { HM.doctorPanels.patients.renderDetail(panel(), p.id); });
  HM.router.on('#/consult/:id', function (p) { HM.doctorPanels.consult.render(panel(), p.id); });
  HM.router.on('#/prescriptions', function () { HM.doctorPanels.prescriptions.render(panel()); });
  HM.router.on('#/reviews', function () { HM.doctorPanels.reviews.render(panel()); });
  // Legacy URLs redirect to the combined queue
  HM.router.on('#/tongue-reviews', function () { location.hash = '#/reviews'; });
  HM.router.on('#/constitution-reviews', function () { location.hash = '#/reviews'; });
  HM.router.on('#/schedule', function () { HM.doctorPanels.schedule.render(panel()); });
  HM.router.on('#/documents', function () { HM.doctorPanels.documents.render(panel()); });
  HM.router.on('#/earnings', function () { HM.doctorPanels.earnings.render(panel()); });
  HM.router.on('#/messages', function () { HM.doctorPanels.messages.render(panel()); });
  HM.router.on('#/messages/:id', function (p) { HM.doctorPanels.messages.render(panel(), p.id); });
  HM.router.on('#/notifications', function () { HM.doctorPanels.notifications.render(panel()); });
  HM.router.on('#/profile', function () { HM.doctorPanels.profile.render(panel()); });
  HM.router.on('#/help', function () { HM.doctorPanels.help.render(panel()); });

  HM.router.otherwise(function () { HM.router.navigate('#/'); });
  HM.router.start();

  // ── Sidebar tab badges ──
  if (HM.badges) {
    var dCounts = {};
    async function refreshDoctorCounts() {
      try { var res = await HM.api.notification.badges(); dCounts = res.counts || {}; } catch (_) {}
    }
    HM.badges.register([
      { route: '#/queue',         count: function () { return dCounts.queue || 0; } },
      { route: '#/appointments',  count: function () { return dCounts.queue || 0; } },
      { route: '#/reviews',       count: function () { return (dCounts.tongue_reviews || 0) + (dCounts.constitution_reviews || 0); } },
      { route: '#/messages',      count: function () { return dCounts.messages || 0; } },
      { route: '#/notifications', count: function () { return dCounts.notifications || 0; } },
    ]);
    refreshDoctorCounts().then(function () { HM.badges.start(60000); });
    setInterval(refreshDoctorCounts, 60000);
  }

  console.log('[HansMed] Doctor portal ready');
})();
