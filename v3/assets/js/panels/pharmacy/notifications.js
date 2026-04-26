/**
 * Pharmacy Notifications — own implementation (can't reuse doctor's
 * because doctor panels aren't loaded on the pharmacy page, so the
 * previous reuse stub left the page stuck on "Loading…").
 */
(function () {
  'use strict';
  HM.pharmPanels = HM.pharmPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Notifications · 通知</div>' +
      '<h1 class="page-title">Updates</h1>' +
      '<div class="mt-3 flex flex-gap-2">' +
      '<button class="btn btn--ghost" id="mark-all">Mark all read · 全部已讀</button>' +
      '<button class="btn btn--outline" id="test-sound">🔊 Test sound · 測試聲音</button>' +
      '</div>' +
      '</div><div id="notif-list"></div>';

    document.getElementById('mark-all').addEventListener('click', async function () {
      try { await HM.api.notification.markAllRead(); load(); HM.ui.toast('Marked all as read · 已全部設為已讀', 'success'); } catch (_) {}
    });
    // Lets the pharmacist verify their speakers are on and the
    // browser has unlocked audio. Plays the dispense chime.
    document.getElementById('test-sound').addEventListener('click', function () {
      if (HM.notificationSound && HM.notificationSound.playDispense) {
        HM.notificationSound.playDispense();
        HM.ui.toast('If you didn\'t hear anything, turn up your volume. · 若無聲音請調高音量。', 'info', 4000);
      }
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
        HM.state.empty(container, { icon: '🔔', title: 'No notifications', text: 'New prescriptions and orders will appear here · 新處方和訂單將顯示於此' });
        return;
      }
      container.innerHTML = '';
      items.forEach(function (n) {
        var card = document.createElement('div');
        card.className = 'card mb-2';
        card.style.cursor = 'pointer';
        if (!n.read_at) card.style.borderLeft = '3px solid var(--gold)';
        card.innerHTML = '<div class="flex-between">' +
          '<div><strong>' + HM.format.esc(n.title || '') + '</strong>' +
          (n.body ? '<div class="text-sm text-muted mt-1">' + HM.format.esc(n.body) + '</div>' : '') +
          '</div>' +
          '<div class="text-xs text-muted">' + HM.format.relative(n.created_at) + '</div>' +
          '</div>';
        card.addEventListener('click', async function () {
          if (!n.read_at) { try { await HM.api.notification.markRead(n.id); } catch (_) {} }
          // Route hint — each notification payload can carry a `route`
          // (e.g. '#/inbox' for a new prescription). Navigate there so
          // one click takes the pharmacist straight to the work.
          var route = n.data && n.data.route;
          if (route) location.hash = route;
        });
        container.appendChild(card);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  HM.pharmPanels.notifications = { render: render };
})();
