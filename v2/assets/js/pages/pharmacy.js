/**
 * Pharmacy Portal bootstrap
 */
(function () {
  'use strict';
  if (!HM.auth.requireAuth({ roles: ['pharmacy'] })) return;

  function panel() { return document.getElementById('panel-container'); }

  async function loadUser() {
    try {
      var user = await HM.auth.refresh();
      var name = HM.auth.displayName(user);
      document.getElementById('sb-avatar').textContent = name.charAt(0).toUpperCase();
      document.getElementById('sb-name').textContent = name;
      document.getElementById('user-greeting').textContent = name;
      var pp = user.pharmacy_profile || {};
      document.getElementById('sb-since').textContent = pp.city || 'Pharmacy';
    } catch {}
  }
  loadUser();

  async function pollNotifs() {
    try {
      var r = await HM.api.notification.unreadCount();
      var b = document.getElementById('notif-count');
      b.style.display = r.count > 0 ? 'inline-flex' : 'none';
      b.textContent = r.count;
    } catch {}
  }
  pollNotifs(); setInterval(pollNotifs, 60000);

  HM.router.on('#/', function () { HM.pharmPanels.dashboard.render(panel()); });
  HM.router.on('#/inbox', function () { HM.pharmPanels.inbox.render(panel()); });
  HM.router.on('#/orders', function () { HM.pharmPanels.orders.render(panel()); });
  HM.router.on('#/orders/:id', function (p) { HM.pharmPanels.orders.renderDetail(panel(), p.id); });
  HM.router.on('#/pos', function () { HM.pharmPanels.pos.render(panel()); });
  HM.router.on('#/products', function () { HM.pharmPanels.products.render(panel()); });
  HM.router.on('#/finance', function () { HM.pharmPanels.finance.render(panel()); });
  HM.router.on('#/profile', function () { HM.pharmPanels.profile.render(panel()); });
  HM.router.on('#/notifications', function () { HM.pharmPanels.notifications.render(panel()); });
  HM.router.on('#/help', function () { HM.pharmPanels.help.render(panel()); });
  HM.router.otherwise(function () { HM.router.navigate('#/'); });
  HM.router.start();

  console.log('[HansMed] Pharmacy portal ready');
})();
