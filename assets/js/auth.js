/**
 * HansMed Auth
 * Session management, token storage, role guards, navigation.
 */
(function () {
  'use strict';

  window.HM = window.HM || {};
  var api = window.HM.api;
  var cfg = window.HM.config;

  var auth = {
    /** Get cached user (sync) */
    user: function () {
      return api.getUser();
    },

    /** Get current role or null */
    role: function () {
      var u = api.getUser();
      return u ? u.role : null;
    },

    /** Is logged in? */
    isAuthenticated: function () {
      return !!api.getToken();
    },

    /** Log in with email + password */
    login: async function (email, password) {
      var res = await api.authLogin(email, password);
      return res;
    },

    /** Register (patient) */
    register: async function (data) {
      var res = await api.authRegister(data);
      return res;
    },

    /** Log out */
    logout: async function () {
      await api.authLogout();
      window.dispatchEvent(new CustomEvent('hm:logout'));
    },

    /** Refresh cached user from server */
    refresh: async function () {
      try {
        return await api.authMe();
      } catch (e) {
        return null;
      }
    },

    /**
     * Route guard — call at top of each protected page.
     * @param {Object} opts
     * @param {string[]} opts.roles - allowed roles
     * @param {string} opts.redirect - where to redirect if unauthenticated (default index.html)
     */
    requireAuth: function (opts) {
      opts = opts || {};
      var token = api.getToken();
      var user = api.getUser();

      // Not logged in → redirect to landing
      if (!token || !user) {
        window.location.href = opts.redirect || 'index.html#/login';
        return false;
      }

      // Wrong role → redirect to their proper portal
      if (opts.roles && opts.roles.indexOf(user.role) < 0) {
        var map = {
          patient:  'portal.html',
          doctor:   'doctor.html',
          pharmacy: 'pharmacy.html',
          admin:    'admin.html',
        };
        window.location.href = map[user.role] || 'index.html';
        return false;
      }

      // Valid — also refresh user in background
      auth.refresh();
      return true;
    },

    /** Redirect user to their portal based on role */
    redirectToPortal: function () {
      var u = api.getUser();
      if (!u) {
        window.location.href = 'index.html';
        return;
      }
      var map = {
        patient:  'portal.html',
        doctor:   'doctor.html',
        pharmacy: 'pharmacy.html',
        admin:    'admin.html',
      };
      window.location.href = map[u.role] || 'index.html';
    },

    /** Resolve display name from user object */
    displayName: function (user) {
      user = user || api.getUser();
      if (!user) return 'User';
      var pp = user.patient_profile || {};
      var dp = user.doctor_profile || {};
      var ph = user.pharmacy_profile || {};
      return pp.full_name || pp.nickname || dp.full_name || ph.name || user.name || user.email;
    },
  };

  window.HM.auth = auth;

  // Handle 401 — redirect to login
  window.addEventListener('hm:unauthenticated', function () {
    if (window.location.pathname.indexOf('index.html') < 0 && window.location.pathname !== '/') {
      window.location.href = 'index.html?expired=1';
    }
  });
})();
