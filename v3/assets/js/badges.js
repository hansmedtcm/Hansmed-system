/**
 * HM.badges — sidebar tab notification counts.
 *
 * Each role registers a list of badge sources, e.g.
 *   HM.badges.register([
 *     { route: '#/prescriptions', label: 'rx', count: function () { return getPrescriptionUnread(); } },
 *     { route: '#/messages',      label: 'msg', count: function () { return chatUnread(); } },
 *   ]);
 *
 * Then HM.badges.start() begins polling and updating <span class="sidebar-link-badge">
 * inside each <a class="sidebar-link" data-route="…"> matching the registered routes.
 * Every count function may return a number OR a Promise<number>.
 *
 * The patient/doctor/pharmacy/admin pages call register() with their own
 * specific set of badges in their respective bootstrap files.
 */
(function () {
  'use strict';
  window.HM = window.HM || {};

  var sources = [];
  var pollTimer = null;

  function register(items) {
    if (Array.isArray(items)) {
      items.forEach(function (it) { sources.push(it); });
    }
  }

  async function refresh() {
    for (var i = 0; i < sources.length; i++) {
      var src = sources[i];
      try {
        var n = await Promise.resolve(typeof src.count === 'function' ? src.count() : 0);
        applyBadge(src.route, parseInt(n, 10) || 0);
      } catch (_) { applyBadge(src.route, 0); }
    }
  }

  function applyBadge(route, n) {
    var link = document.querySelector('a.sidebar-link[data-route="' + route + '"]');
    if (!link) return;
    var labelEl = link.querySelector('.sidebar-link-label');
    if (!labelEl) return;
    var existing = labelEl.querySelector('.tab-badge');
    if (n <= 0) {
      if (existing) existing.remove();
      return;
    }
    if (!existing) {
      existing = document.createElement('span');
      existing.className = 'tab-badge';
      labelEl.appendChild(existing);
    }
    existing.textContent = n > 99 ? '99+' : String(n);
  }

  function start(intervalMs) {
    refresh();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(refresh, intervalMs || 60000);
    // Refresh whenever the route changes too — clearing of unread counts
    // typically happens when a panel loads, so we re-poll on hashchange.
    window.addEventListener('hashchange', function () { setTimeout(refresh, 800); });
    if (HM.bus) {
      HM.bus.on('badges:refresh', refresh);
    }
  }

  function stop() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  // Expose
  HM.badges = {
    register: register,
    refresh:  refresh,
    start:    start,
    stop:     stop,
  };

  // Inject minimal CSS once
  function inject() {
    if (document.getElementById('tab-badge-style')) return;
    var s = document.createElement('style');
    s.id = 'tab-badge-style';
    s.textContent =
      '.tab-badge{display:inline-flex;align-items:center;justify-content:center;' +
      'min-width:18px;height:18px;padding:0 5px;margin-left:6px;' +
      'font-size:10px;font-weight:600;color:#fff;background:var(--red-seal);' +
      'border-radius:9px;line-height:1;letter-spacing:0;' +
      'animation:badge-pop .3s ease-out;}' +
      '@keyframes badge-pop{0%{transform:scale(0);}80%{transform:scale(1.15);}100%{transform:scale(1);}}';
    document.head.appendChild(s);
  }
  if (document.head) inject();
  else document.addEventListener('DOMContentLoaded', inject);
})();
