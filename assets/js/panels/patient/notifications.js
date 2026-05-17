/**
 * Notifications
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Notifications · 通知</div>' +
      '<h1 class="page-title">Your Updates</h1>' +
      '<div class="mt-3"><button class="btn btn--ghost" id="mark-all">Mark all as read · 全部已讀</button></div>' +
      '</div><div id="notif-list"></div>';

    document.getElementById('mark-all').addEventListener('click', async function () {
      try {
        await HM.api.notification.markAllRead();
        HM.ui.toast('Marked all as read', 'success');
        load();
      } catch (e) { HM.ui.toast('Failed', 'danger'); }
    });

    await load();
  }

  async function load() {
    var container = document.getElementById('notif-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.notification.list();
      var items = res.data || [];
      if (!items.length) {
        HM.state.empty(container, {
          icon: '🔔',
          title: 'No notifications',
          text: 'Updates about your appointments and prescriptions will appear here',
        });
        return;
      }
      container.innerHTML = '';
      items.forEach(function (n) {
        var node = HM.render.fromTemplate('tpl-notif-item', n);
        if (!n.read_at) {
          node.firstElementChild.style.borderLeft = '3px solid var(--gold)';
        }
        node.firstElementChild.addEventListener('click', async function () {
          if (!n.read_at) {
            try { await HM.api.notification.markRead(n.id); } catch {}
          }
        });
        container.appendChild(node);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  HM.patientPanels.notifications = { render: render };
})();
