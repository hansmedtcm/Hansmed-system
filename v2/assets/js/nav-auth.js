/* Nav auth awareness — shared across all 8 landing pages.
   Works with the inline pre-paint check in <head> that adds
   html.is-auth + html[data-role] based on localStorage (no flash on
   first paint — the label swap is handled by CSS in dropdown.css).
   This file wires the click behaviour so a signed-in user who clicks
   "My Portal" is routed to their role-appropriate portal instead of
   the login screen. */
(function () {
  var PORTAL = {
    patient:  'portal.html',
    doctor:   'doctor.html',
    pharmacy: 'pharmacy.html',
    admin:    'admin.html',
  };

  function portalHref() {
    var role = document.documentElement.dataset.role;
    return PORTAL[role] || 'portal.html';
  }

  /* Every page defines its own go() with a routes map. Wrap it so
     go('login') re-routes to the portal when the user is signed in. */
  function install() {
    var isAuth = document.documentElement.classList.contains('is-auth');
    if (!isAuth) return;

    var orig = window.go;
    window.go = function (id) {
      if (id === 'login') {
        location.href = portalHref();
        return;
      }
      if (typeof orig === 'function') return orig.apply(this, arguments);
      // Fallback if the page's own go() hasn't defined this id
      location.href = 'index.html';
    };

    /* Also update any <a class="nav-signin"> href so middle-click /
       right-click "open in new tab" lands on the portal, not /login. */
    document.querySelectorAll('a.nav-signin').forEach(function (a) {
      a.setAttribute('href', portalHref());
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();
