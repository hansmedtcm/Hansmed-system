/* About-dropdown toggle — shared on all 8 landing pages.
   Previously the toggle function lived inline on only 4 of the 8
   pages, so the dropdown was dead on about/services/shop/contact.
   Consolidated here so every page gets the same behaviour. */
(function () {
  var open = false;

  window.toggleAboutMenu = function (e) {
    if (e && e.stopPropagation) e.stopPropagation();
    open = !open;
    var dd  = document.getElementById('about-dropdown');
    var chv = document.getElementById('about-chevron');
    if (dd)  dd.style.display = open ? 'block' : 'none';
    if (chv) chv.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
  };

  /* Close on outside click so the menu doesn't linger open when the
     user clicks anywhere else on the page. */
  document.addEventListener('click', function (e) {
    if (!open) return;
    var wrap = document.getElementById('about-wrap');
    if (wrap && !wrap.contains(e.target)) {
      open = false;
      var dd  = document.getElementById('about-dropdown');
      var chv = document.getElementById('about-chevron');
      if (dd)  dd.style.display = 'none';
      if (chv) chv.style.transform = 'rotate(0deg)';
    }
  });

  /* Close on Escape for keyboard users. */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open) {
      open = false;
      var dd  = document.getElementById('about-dropdown');
      var chv = document.getElementById('about-chevron');
      if (dd)  dd.style.display = 'none';
      if (chv) chv.style.transform = 'rotate(0deg)';
    }
  });
})();
