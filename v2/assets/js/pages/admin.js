/**
 * Admin Console bootstrap
 */
(function () {
  'use strict';
  if (!HM.auth.requireAuth({ roles: ['admin'] })) return;

  function panel() { return document.getElementById('panel-container'); }

  (async function () {
    try {
      var user = await HM.auth.refresh();
      var name = HM.auth.displayName(user);
      document.getElementById('sb-avatar').textContent = name.charAt(0).toUpperCase();
      document.getElementById('sb-name').textContent = name;
      document.getElementById('user-greeting').textContent = name;
    } catch {}
  })();

  HM.router.on('#/', function () { HM.adminPanels.dashboard.render(panel()); });
  HM.router.on('#/verifications', function () { HM.adminPanels.verifications.render(panel()); });
  HM.router.on('#/accounts', function () { HM.adminPanels.accounts.render(panel()); });
  HM.router.on('#/patients', function () { HM.adminPanels.patients.render(panel()); });
  HM.router.on('#/patients/:id', function (p) { HM.adminPanels.patients.renderDetail(panel(), p.id); });
  HM.router.on('#/doctors', function () { HM.adminPanels.doctors.render(panel()); });
  HM.router.on('#/appointments', function () { HM.adminPanels.appointments.render(panel()); });
  HM.router.on('#/prescriptions', function () { HM.adminPanels.prescriptions.render(panel()); });
  HM.router.on('#/orders', function () { HM.adminPanels.orders.render(panel()); });
  HM.router.on('#/shop-catalog', function () { HM.adminPanels.shopCatalog.render(panel()); });
  HM.router.on('#/medicine-catalog', function () { HM.adminPanels.medicineCatalog.render(panel()); });
  HM.router.on('#/finance', function () { HM.adminPanels.finance.render(panel()); });
  HM.router.on('#/withdrawals', function () { HM.adminPanels.withdrawals.render(panel()); });
  HM.router.on('#/content', function () { HM.adminPanels.content.render(panel()); });
  HM.router.on('#/tongue-config', function () { HM.adminPanels.tongueConfig.render(panel()); });
  HM.router.on('#/permissions', function () { HM.adminPanels.permissions.render(panel()); });
  HM.router.on('#/audit', function () { HM.adminPanels.audit.render(panel()); });
  HM.router.on('#/config', function () { HM.adminPanels.config.render(panel()); });
  HM.router.otherwise(function () { HM.router.navigate('#/'); });
  HM.router.start();

  // ── Sidebar tab badges ──
  if (HM.badges) {
    var aCounts = {};
    async function refreshAdminCounts() {
      try { var res = await HM.api.notification.badges(); aCounts = res.counts || {}; } catch (_) {}
    }
    HM.badges.register([
      { route: '#/verifications', count: function () { return aCounts.verifications || 0; } },
      { route: '#/withdrawals',   count: function () { return aCounts.withdrawals || 0; } },
      { route: '#/appointments',  count: function () { return aCounts.appointments || 0; } },
    ]);
    refreshAdminCounts().then(function () { HM.badges.start(60000); });
    setInterval(refreshAdminCounts, 60000);
  }

  console.log('[HansMed] Admin console ready');
})();
