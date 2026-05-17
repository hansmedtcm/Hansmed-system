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

    // Trigger button — let .nav-link drive font/color/size/letter-spacing
    // so it matches the sibling Home link exactly. Only the bits .nav-link
    // doesn't already cover (flex layout for the chevron) go inline.
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-link';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;';
    btn.innerHTML =
      '<span lang="en">About</span><span lang="zh">關於</span>' +
      '<svg width="9" height="6" viewBox="0 0 9 6" fill="none" aria-hidden="true" style="transition:transform 0.2s;flex-shrink:0;opacity:0.75;">' +
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

  /** Mobile drawer variant — a collapsible row that expands to show
   *  the same 6 links as flat sidebar entries. The desktop dropdown
   *  is awkward inside a vertical drawer (tiny tap target, floats
   *  outside the drawer container), so on mobile we expose the items
   *  inline instead. Mounts on <... data-portal-about-mobile></... >. */
  function buildMobile(host) {
    host.innerHTML = '';
    host.style.display = 'block';

    // Toggle row — looks like every other sidebar-link so it slots in.
    var row = document.createElement('button');
    row.type = 'button';
    row.className = 'sidebar-link';
    row.setAttribute('aria-expanded', 'false');
    // Keep the drawer open when this is tapped (matches the lang toggle).
    row.setAttribute('data-keeps-drawer-open', '');
    row.style.cssText = 'background:none;border:none;width:100%;cursor:pointer;text-align:left;font:inherit;color:inherit;display:flex;align-items:center;gap:0.75rem;padding:0.7rem 1rem;';
    row.innerHTML =
      '<span class="sidebar-link-icon">🏛️</span>' +
      '<span class="sidebar-link-label" style="flex:1;display:flex;align-items:center;justify-content:space-between;gap:6px;">' +
        '<span><span lang="en">About</span><span lang="zh">關於</span></span>' +
        '<svg width="10" height="7" viewBox="0 0 9 6" fill="none" aria-hidden="true" style="transition:transform 0.2s;flex-shrink:0;opacity:0.7;">' +
          '<path d="M1 1L4.5 5L8 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>' +
      '</span>';

    var sub = document.createElement('div');
    sub.style.cssText = 'display:none;padding:2px 0 6px 0;';
    LINKS.forEach(function (l) {
      var a = document.createElement('a');
      a.href = l.href;
      a.className = 'sidebar-link';
      a.style.cssText = 'padding-left:3rem;font-size:0.78rem;opacity:0.92;';
      a.innerHTML = '<span class="sidebar-link-label"><span lang="en">' + l.en + '</span><span lang="zh">' + l.zh + '</span></span>';
      sub.appendChild(a);
    });

    host.appendChild(row);
    host.appendChild(sub);

    row.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = sub.style.display !== 'none';
      sub.style.display = open ? 'none' : 'block';
      row.setAttribute('aria-expanded', open ? 'false' : 'true');
      var chev = row.querySelector('svg');
      if (chev) chev.style.transform = open ? '' : 'rotate(180deg)';
    });
  }

  function mount() {
    document.querySelectorAll('[data-portal-about-menu]').forEach(function (h) {
      if (h.dataset.aboutMounted) return;
      h.dataset.aboutMounted = '1';
      build(h);
    });
    document.querySelectorAll('[data-portal-about-mobile]').forEach(function (h) {
      if (h.dataset.aboutMounted) return;
      h.dataset.aboutMounted = '1';
      buildMobile(h);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
