/**
 * Portal mobile menu — hamburger toggle + slide-in drawer.
 *
 * Loaded on every portal HTML page (patient, doctor, pharmacy, admin).
 * Only visible at ≤768px (the CSS hides .portal-menu-btn on desktop).
 *
 * Wiring:
 *   1. Injects a hamburger button into the top nav (before the other
 *      nav items) so mobile users can reach the sidebar drawer.
 *   2. Injects a backdrop overlay that dims the page when the drawer
 *      is open, and closes it on tap.
 *   3. Closes the drawer automatically when a sidebar link is tapped
 *      (so you don't have to manually close before the page switches).
 *   4. Reflects the unread-badge count on the hamburger so users know
 *      there's something new inside.
 */
(function () {
  'use strict';

  function init() {
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;             // not a portal page

    // 1. Inject backdrop into body
    var backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);

    // 2. Inject hamburger button into the top nav
    var nav = document.querySelector('.nav-inner, .nav, header .container');
    if (nav) {
      var btn = document.createElement('button');
      btn.className = 'portal-menu-btn';
      btn.setAttribute('aria-label', 'Open menu');
      btn.setAttribute('type', 'button');
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<line x1="4" y1="7" x2="20" y2="7"/>' +
          '<line x1="4" y1="12" x2="20" y2="12"/>' +
          '<line x1="4" y1="17" x2="20" y2="17"/>' +
        '</svg>' +
        '<span class="portal-menu-btn-badge" id="portal-menu-btn-badge" aria-hidden="true"></span>';
      nav.insertBefore(btn, nav.firstChild);

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        open();
      });
    }

    // 3. Wire open/close
    function open() {
      sidebar.classList.add('is-open');
      backdrop.classList.add('is-visible');
      document.body.style.overflow = 'hidden';   // lock page scroll while drawer is open
    }
    function close() {
      sidebar.classList.remove('is-open');
      backdrop.classList.remove('is-visible');
      document.body.style.overflow = '';
    }

    backdrop.addEventListener('click', close);

    // 4. Auto-close when an actual nav link is tapped — but NOT when the
    //    user interacts with non-navigating controls inside the drawer
    //    (the language toggle, in-place toggles, etc.). We detect a real
    //    nav by requiring an <a> with href/data-route OR a <button> that
    //    explicitly opts in via [data-closes-drawer]. This way the
    //    language EN/中 buttons don't accidentally close the drawer.
    sidebar.addEventListener('click', function (e) {
      // Bail if click originated inside an element marked as drawer-stable
      if (e.target.closest('[data-keeps-drawer-open]')) return;
      var a = e.target.closest('a.sidebar-link[href], a.sidebar-link[data-route]');
      var b = e.target.closest('button[data-closes-drawer]');
      if (a || b) close();
    });

    // 5. Close on Esc for keyboard users
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebar.classList.contains('is-open')) close();
    });

    // 6. Close when switching back to desktop width
    var mq = window.matchMedia('(min-width: 769px)');
    if (mq.addEventListener) {
      mq.addEventListener('change', function (e) { if (e.matches) close(); });
    } else if (mq.addListener) {
      mq.addListener(function (e) { if (e.matches) close(); });
    }

    // 7. Mirror any unread-badge count onto the hamburger so users see
    //    a dot when there's something new inside the drawer.
    function refreshBadge() {
      var badge = document.getElementById('portal-menu-btn-badge');
      if (!badge) return;
      // Any sidebar-link-badge currently visible = pending items
      var anyVisible = Array.from(sidebar.querySelectorAll('.sidebar-link-badge')).some(function (el) {
        var s = getComputedStyle(el);
        return s.display !== 'none' && el.textContent.trim() !== '0' && el.textContent.trim() !== '';
      });
      badge.classList.toggle('is-visible', anyVisible);
    }
    // Refresh on a light interval — cheap and robust to sub-panel updates
    setInterval(refreshBadge, 2500);
    refreshBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
