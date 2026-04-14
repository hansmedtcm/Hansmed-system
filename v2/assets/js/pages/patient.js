/**
 * Patient Portal — page bootstrap + router
 * Requires all panel scripts to be loaded first.
 */
(function () {
  'use strict';

  var auth = HM.auth;
  var api = HM.api;
  var router = HM.router;

  // ── Auth guard ──
  if (!auth.requireAuth({ roles: ['patient'] })) return;

  // ── Render panel helper ──
  function panel() { return document.getElementById('panel-container'); }

  // ── Load user info into sidebar/nav ──
  async function loadUserInfo() {
    try {
      var user = await auth.refresh();
      var name = auth.displayName(user);
      var initial = name.charAt(0).toUpperCase();

      document.getElementById('sb-avatar').textContent = initial;
      document.getElementById('sb-name').textContent = name;
      document.getElementById('user-greeting').textContent = name;

      if (user.created_at) {
        var year = new Date(user.created_at).getFullYear();
        document.getElementById('sb-since').textContent = 'Member since ' + year;
      }

      // Check registration complete
      var pp = user.patient_profile || {};
      if (!pp.registration_completed) {
        HM.patientPanels.registrationWall.show(user);
      }
    } catch (e) {
      console.error(e);
    }
  }
  loadUserInfo();

  // ── Notification polling ──
  var pollTimer = null;
  async function pollNotifications() {
    try {
      var res = await api.notification.unreadCount();
      var count = res.count || 0;
      var badge = document.getElementById('notif-count');
      if (count > 0) {
        badge.style.display = 'inline-flex';
        badge.textContent = count;
      } else {
        badge.style.display = 'none';
      }
    } catch {}
  }
  pollNotifications();
  pollTimer = setInterval(pollNotifications, 60000);

  // ── Routes ──
  router.on('#/', function () {
    HM.patientPanels.overview.render(panel());
  });
  router.on('#/profile', function () {
    HM.patientPanels.profile.render(panel());
  });
  router.on('#/health', function () {
    HM.patientPanels.health.render(panel());
  });
  router.on('#/doctors', function () {
    HM.patientPanels.doctors.render(panel());
  });
  router.on('#/doctors/:id', function (params) {
    HM.patientPanels.doctors.renderDetail(panel(), params.id);
  });
  router.on('#/book', function () {
    HM.patientPanels.booking.render(panel());
  });
  router.on('#/book/:doctorId', function (params) {
    HM.patientPanels.booking.render(panel(), params.doctorId);
  });
  router.on('#/appointments', function () {
    HM.patientPanels.appointments.render(panel());
  });
  router.on('#/appointments/:id', function (params) {
    HM.patientPanels.appointments.renderDetail(panel(), params.id);
  });
  router.on('#/consult/:id', function (params) {
    HM.patientPanels.video.render(panel(), params.id);
  });
  router.on('#/tongue', function () {
    HM.patientPanels.tongue.render(panel());
  });
  router.on('#/tongue/:id', function (params) {
    HM.patientPanels.tongue.renderDetail(panel(), params.id);
  });
  router.on('#/prescriptions', function () {
    HM.patientPanels.prescriptions.render(panel());
  });
  router.on('#/prescriptions/:id', function (params) {
    HM.patientPanels.prescriptions.renderDetail(panel(), params.id);
  });
  router.on('#/orders', function () {
    HM.patientPanels.orders.render(panel());
  });
  router.on('#/orders/:id', function (params) {
    HM.patientPanels.orders.renderDetail(panel(), params.id);
  });
  router.on('#/messages', function () {
    HM.patientPanels.messages.render(panel());
  });
  router.on('#/messages/:id', function (params) {
    HM.patientPanels.messages.render(panel(), params.id);
  });
  router.on('#/notifications', function () {
    HM.patientPanels.notifications.render(panel());
  });
  router.on('#/settings', function () {
    HM.patientPanels.settings.render(panel());
  });
  router.on('#/help', function () {
    HM.patientPanels.help.render(panel());
  });

  router.otherwise(function () {
    router.navigate('#/');
  });

  router.start();

  // ── Cleanup ──
  window.addEventListener('beforeunload', function () {
    if (pollTimer) clearInterval(pollTimer);
  });

  console.log('[HansMed] Patient portal ready');
})();
