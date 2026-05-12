/**
 * Doctor Notifications
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Notifications · 通知</div>' +
      '<h1 class="page-title">Updates</h1>' +
      '<div class="mt-3"><button class="btn btn--ghost" id="mark-all">Mark all read</button></div>' +
      '</div><div id="notif-list"></div>';

    document.getElementById('mark-all').addEventListener('click', async function () {
      try { await HM.api.notification.markAllRead(); load(); HM.ui.toast('Marked all as read', 'success'); } catch {}
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
        HM.state.empty(container, { icon: '🔔', title: 'No notifications', text: 'Your alerts will appear here' });
        return;
      }
      container.innerHTML = '';
      items.forEach(function (n) {
        var card = document.createElement('div');
        card.className = 'card mb-2';
        if (!n.read_at) card.style.borderLeft = '3px solid var(--gold)';
        card.innerHTML = '<div class="flex-between">' +
          '<div><strong>' + HM.format.esc(n.title) + '</strong>' +
          (n.body ? '<div class="text-sm text-muted mt-1">' + HM.format.esc(n.body) + '</div>' : '') +
          '</div>' +
          '<div class="text-xs text-muted">' + HM.format.relative(n.created_at) + '</div>' +
          '</div>';
        card.onclick = async function () {
          if (!n.read_at) { try { await HM.api.notification.markRead(n.id); } catch {} }
        };
        container.appendChild(card);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  HM.doctorPanels.notifications = { render: render };
})();
