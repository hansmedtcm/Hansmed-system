/**
 * HansMed Router
 * Simple hash-based router (per-page). Works on GitHub Pages.
 * Usage:
 *   HM.router.on('#/appointments', loadAppointments);
 *   HM.router.start();
 *   HM.router.navigate('#/appointments');
 */
(function () {
  'use strict';

  window.HM = window.HM || {};

  var routes = {};
  var fallback = null;
  var currentPath = null;

  function parse(hash) {
    if (!hash || hash === '#' || hash === '#/') return '#/';
    // Strip query string
    return hash.split('?')[0];
  }

  function getParams() {
    var hash = window.location.hash;
    var q = hash.indexOf('?');
    if (q < 0) return {};
    var params = {};
    hash.substring(q + 1).split('&').forEach(function (pair) {
      var kv = pair.split('=');
      params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    return params;
  }

  function match(path) {
    // Direct match
    if (routes[path]) return { handler: routes[path], params: {} };

    // Pattern match: #/consult/:id
    for (var key in routes) {
      if (key.indexOf(':') < 0) continue;
      var keyParts = key.split('/');
      var pathParts = path.split('/');
      if (keyParts.length !== pathParts.length) continue;

      var params = {};
      var ok = true;
      for (var i = 0; i < keyParts.length; i++) {
        if (keyParts[i].charAt(0) === ':') {
          params[keyParts[i].substring(1)] = decodeURIComponent(pathParts[i]);
        } else if (keyParts[i] !== pathParts[i]) {
          ok = false;
          break;
        }
      }
      if (ok) return { handler: routes[key], params: params };
    }

    return null;
  }

  function handleRoute() {
    var path = parse(window.location.hash);
    currentPath = path;
    var found = match(path);

    if (found) {
      try {
        found.handler(found.params, getParams());
      } catch (e) {
        console.error('[Router] Handler failed for', path, e);
      }
    } else if (fallback) {
      fallback(path);
    }

    // Update active states on sidebar links
    document.querySelectorAll('[data-route]').forEach(function (el) {
      if (el.getAttribute('data-route') === path) {
        el.classList.add('is-active');
      } else {
        el.classList.remove('is-active');
      }
    });

    // Scroll to top on navigation
    var main = document.querySelector('.main, main');
    if (main) main.scrollTop = 0;
    else window.scrollTo(0, 0);
  }

  var router = {
    /** Register a route handler */
    on: function (path, handler) {
      routes[path] = handler;
      return router;
    },

    /** Set fallback for unmatched routes */
    otherwise: function (handler) {
      fallback = handler;
      return router;
    },

    /** Programmatic navigation */
    navigate: function (path) {
      if (window.location.hash === path) {
        handleRoute();
      } else {
        window.location.hash = path;
      }
    },

    /** Go back */
    back: function () {
      window.history.back();
    },

    /** Start listening — call after registering routes */
    start: function () {
      window.addEventListener('hashchange', handleRoute);
      handleRoute();
    },

    /** Current path */
    current: function () { return currentPath; },

    /** Query string parameters */
    query: getParams,
  };

  window.HM.router = router;
})();
