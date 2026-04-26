/**
 * Portal About menu — small click-to-open dropdown that mirrors the
 * homepage navbar's "About" menu. Mounts itself wherever it finds a
 * <li data-portal-about-menu></li> in the portal nav.
 *
 * Self-contained: builds its own markup so the four portal HTML files
 * (portal / doctor / pharmacy / admin) only need a single placeholder
 * <li> and this script tag — no inline JS, no styling assumptions.
 */
(function () {
  'use strict';

  var LINKS = [
    { href: 'about.html',         en: 'About HansMed', zh: '關於我們' },
    { href: 'practitioners.html', en: 'Our Practitioners', zh: '醫師' },
    { href: 'services.html',      en: 'Our Services', zh: '服務' },
    { href: 'blog.html',          en: 'Blog', zh: '部落格' },
    { href: 'faq.html',           en: 'FAQ', zh: '常見問題' },
    { href: 'contact.html',       en: 'Contact Us', zh: '聯絡' },
  ];

  function build(host) {
    host.style.position = 'relative';

    // Trigger button — same visual weight as the Home link nearby.
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-link';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.style.cssText = 'background:none;border:none;padding:0;font:inherit;color:inherit;cursor:pointer;font-size:var(--text-sm);display:inline-flex;align-items:center;gap:5px;';
    btn.innerHTML =
      '<span lang="en">About</span><span lang="zh">關於</span>' +
      '<svg width="9" height="6" viewBox="0 0 9 6" fill="none" aria-hidden="true" style="transition:transform 0.2s;flex-shrink:0;">' +
        '<path d="M1 1L4.5 5L8 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';

    var dd = document.createElement('div');
    dd.setAttribute('role', 'menu');
    dd.style.cssText = [
      'display:none',
      'position:absolute',
      'top:calc(100% + 8px)',
      'left:0',
      'min-width:210px',
      'background:#FEFCF8',
      'border:1px solid #D8C9AE',
      'border-radius:12px',
      'box-shadow:0 8px 32px rgba(36,22,8,0.14)',
      'z-index:9999',
      'overflow:hidden',
      'padding:4px 0',
    ].join(';') + ';';

    // Subtle gold separator line, matching the homepage menu look.
    var bar = document.createElement('div');
    bar.style.cssText = 'height:2px;background:linear-gradient(90deg,transparent,#9A7A3E,transparent);';
    dd.appendChild(bar);

    LINKS.forEach(function (l) {
      var a = document.createElement('a');
      a.href = l.href;
      a.setAttribute('role', 'menuitem');
      a.style.cssText = 'display:block;padding:10px 16px;font-size:13px;color:#241608;text-decoration:none;font-weight:500;transition:background 0.15s;';
      a.innerHTML = '<span lang="en">' + l.en + '</span><span lang="zh">' + l.zh + '</span>';
      a.addEventListener('mouseenter', function () { a.style.background = '#F3EDE1'; });
      a.addEventListener('mouseleave', function () { a.style.background = ''; });
      dd.appendChild(a);
    });

    host.appendChild(btn);
    host.appendChild(dd);

    function setOpen(open) {
      dd.style.display = open ? 'block' : 'none';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      var chev = btn.querySelector('svg');
      if (chev) chev.style.transform = open ? 'rotate(180deg)' : '';
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(dd.style.display !== 'block');
    });

    document.addEventListener('click', function (e) {
      if (!host.contains(e.target)) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });
  }

  function mount() {
    var hosts = document.querySelectorAll('[data-portal-about-menu]');
    hosts.forEach(function (h) {
      if (h.dataset.aboutMounted) return;
      h.dataset.aboutMounted = '1';
      build(h);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
