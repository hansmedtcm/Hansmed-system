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

  // ── Sidebar tab badges (per-tab unread/pending counts) ──
  if (HM.badges) {
    var pCounts = {};
    async function refreshPatientCounts() {
      try { var res = await HM.api.notification.badges(); pCounts = res.counts || {}; } catch (_) {}
    }
    HM.badges.register([
      { route: '#/appointments',  count: function () { return pCounts.appointments || 0; } },
      { route: '#/prescriptions', count: function () { return pCounts.prescriptions || 0; } },
      { route: '#/orders',        count: function () { return pCounts.orders || 0; } },
      { route: '#/messages',      count: function () { return pCounts.messages || 0; } },
      { route: '#/notifications', count: function () { return pCounts.notifications || 0; } },
    ]);
    refreshPatientCounts().then(function () { HM.badges.start(60000); });
    setInterval(refreshPatientCounts, 60000);
  }

  // ── Feature flags — admin can hide the Shop pages from the
  // sidebar by setting shop_enabled=false in System Settings.
  // We pull /public/features once on page load and prune the
  // sidebar links + cart badge accordingly.
  (async function applyFeatureFlags() {
    try {
      var res = await HM.api.publicFeatures();
      if (res && res.shop_enabled === false) {
        // Hide Shop, Cart sidebar links + the section header that wraps them.
        var routesToHide = ['#/shop', '#/cart'];
        routesToHide.forEach(function (r) {
          var link = document.querySelector('.sidebar-link[data-route="' + r + '"]');
          if (link) link.style.display = 'none';
        });
        // Hide the "Shop & Medicine" section header if both children are hidden.
        var sectionHeaders = document.querySelectorAll('.sidebar-section');
        sectionHeaders.forEach(function (h) {
          if (h.textContent && /Shop|商店/i.test(h.textContent)) h.style.display = 'none';
        });
        // If the patient happened to land on /shop or /cart, bounce home.
        if (location.hash === '#/shop' || location.hash === '#/cart') {
          location.hash = '#/';
        }
      }
    } catch (_) { /* default to showing everything */ }
  })();

  // ── Cart badge sync ──
  function updateCartBadge() {
    var count = (HM.cart && HM.cart.count) ? HM.cart.count() : 0;
    var badge = document.getElementById('sb-cart-count');
    if (!badge) return;
    if (count > 0) { badge.style.display = 'inline-flex'; badge.textContent = count; }
    else { badge.style.display = 'none'; }
  }
  updateCartBadge();
  if (HM.bus) HM.bus.on('cart:changed', updateCartBadge);
  window.addEventListener('storage', updateCartBadge);

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
  router.on('#/book', function () {
    HM.patientPanels.booking.render(panel());
  });
  router.on('#/shop', function () {
    HM.patientPanels.shop.render(panel());
  });
  router.on('#/shop/:id', function (params) {
    HM.patientPanels.shop.renderDetail(panel(), params.id);
  });
  router.on('#/cart', function () {
    HM.patientPanels.cart.render(panel());
  });
  router.on('#/checkout', function () {
    HM.patientPanels.cart.renderCheckout(panel());
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
  router.on('#/wellness-assessment', function () {
    HM.patientPanels.aiDiagnosis.render(panel());
  });
  router.on('#/wellness-assessment/:id', function (p) {
    HM.patientPanels.aiDiagnosis.renderDetail(panel(), p.id);
  });
  // Legacy aliases — redirect old #/ai-diagnosis links to the new route
  // so bookmarks, email notifications (tongue.approved route payloads),
  // and external docs keep working. Replace the hash so browser Back
  // doesn't ping-pong between old and new.
  router.on('#/ai-diagnosis', function () {
    location.replace('#/wellness-assessment');
  });
  router.on('#/ai-diagnosis/:id', function (p) {
    location.replace('#/wellness-assessment/' + p.id);
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
  router.on('#/invoices', function () {
    HM.patientPanels.invoices.render(panel());
  });
  router.on('#/invoices/:id', function (params) {
    // Deep link directly to a single invoice — render list + pop viewer.
    HM.patientPanels.invoices.render(panel());
    HM.patientPanels.invoices.show(params.id);
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
