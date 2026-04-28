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

  // Toggle 'is-consult-mode' on body whenever the route enters/leaves
  // a consultation. CSS rules in consult.js use this flag to float
  // the portal sidebar off-screen and widen the case-record rail.
  // The sidebar reappears on left-edge hover (peek behaviour wired
  // below), without pushing the page layout — it overlays content.
  function syncConsultMode() {
    var isConsult = /^#\/consult\//.test(location.hash);
    document.body.classList.toggle('is-consult-mode', isConsult);
    if (isConsult) {
      mountConsultEdgePeek();
    } else {
      unmountConsultEdgePeek();
      document.body.classList.remove('consult-sidebar-peek');
    }
  }
  window.addEventListener('hashchange', syncConsultMode);
  syncConsultMode();

  // ── Edge-hover sidebar peek (consult mode only) ──
  // Adds an invisible 12px hot zone at the left edge of the viewport.
  // Mouse enters → body gets .consult-sidebar-peek → sidebar slides
  // in as an overlay (CSS handles the animation). Mouse leaves the
  // sidebar (debounced 250ms so brief excursions don\'t flicker) →
  // class removed → sidebar slides back out. Click on a sidebar link
  // navigates as normal; if it leaves consult mode, syncConsultMode
  // tears the whole peek system down.
  var hideTimer = null;
  function mountConsultEdgePeek() {
    if (document.querySelector('.consult-edge-zone')) return;
    var zone = document.createElement('div');
    zone.className = 'consult-edge-zone';
    document.body.appendChild(zone);

    zone.addEventListener('mouseenter', function () {
      clearTimeout(hideTimer);
      document.body.classList.add('consult-sidebar-peek');
    });

    var sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      // Mouseleave on the sidebar starts the hide timer. Re-entering
      // the sidebar before 250ms cancels it — no flicker if the user
      // briefly grazes the edge.
      sidebar.addEventListener('mouseleave', function () {
        hideTimer = setTimeout(function () {
          document.body.classList.remove('consult-sidebar-peek');
        }, 250);
      });
      sidebar.addEventListener('mouseenter', function () {
        clearTimeout(hideTimer);
      });
    }
  }
  function unmountConsultEdgePeek() {
    var zone = document.querySelector('.consult-edge-zone');
    if (zone) zone.remove();
    clearTimeout(hideTimer);
  }
  HM.router.on('#/prescriptions', function () { HM.doctorPanels.prescriptions.render(panel()); });
  HM.router.on('#/reviews', function () { HM.doctorPanels.reviews.render(panel()); });
  // Legacy URLs redirect to the combined queue
  HM.router.on('#/tongue-reviews', function () { location.hash = '#/reviews'; });
  HM.router.on('#/constitution-reviews', function () { location.hash = '#/reviews'; });
  HM.router.on('#/schedule', function () { HM.doctorPanels.schedule.render(panel()); });
  // Documents are issued from inside a patient's case record now.
  // Old bookmarks of #/documents bounce to the patient list, where
  // the Referral / MC buttons live.
  HM.router.on('#/documents', function () { location.hash = '#/patients'; });
  HM.router.on('#/blog', function () { HM.doctorPanels.blog.render(panel()); });
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

  // ── Notification sound cues ──
  // Plays "review" bell on new appointments and new tongue/constitution
  // reviews in the pool. No dispense types here — that's pharmacy only.
  if (HM.notificationSound) {
    HM.notificationSound.start({
      reviewTypes: [
        'review.pending.*',
        'appointment.booked',
        'appointment.pool.new',
      ],
      dispenseTypes: [],
      intervalMs: 3000,
    });
  }

  console.log('[HansMed] Doctor portal ready');
})();
