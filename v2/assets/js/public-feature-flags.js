/**
 * Public-page feature flag enforcement.
 *
 * Mirrors the patient-portal flag check (pages/patient.js) but runs on
 * the public landing pages (index, about, services, shop, contact,
 * practitioners, blog, faq). Reads /public/features once on load and:
 *
 *   - Hides every Shop link in the desktop nav, About dropdown, mobile
 *     drawer, and footer when shop_enabled === false.
 *   - On shop.html itself: redirects the user to index.html so they
 *     don't land on a "shop disabled" dead-end page.
 *
 * Doesn't touch any backend logic — purely a UI prune. Admin keeps
 * sole control via System Settings → "Show shop in patient sidebar".
 */
(function () {
  'use strict';

  var API_BASE = (window.HM && HM.config && HM.config.API_BASE) ||
                 'https://hansmed-system-production.up.railway.app/api';

  function applyShopDisabled() {
    // 1. Hide every nav anchor + button that points at shop.html or
    //    triggers go('shop'). Catches:
    //      <a href="shop.html">
    //      <a href="shop.html?something">
    //      <button onclick="go('shop')...">
    //      <button onclick="go('shop');closeMob();">
    var selectors = [
      'a[href="shop.html"]',
      'a[href^="shop.html"]',
      'a[href="./shop.html"]',
      // Relative path used by pages in subfolders (e.g. /v2/blog/*).
      'a[href="../shop.html"]',
      'a[href$="/shop.html"]',
      '[onclick*="go(\'shop\')"]',
      '[onclick*="go(\\"shop\\")"]',
    ];
    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        el.style.display = 'none';
      });
    });

    // 2. Hide the Shop entry inside the About dropdown if present.
    //    The dropdown items have <span lang="en">Shop</span> as
    //    children, so target the parent <a class="dd-item">.
    document.querySelectorAll('.dd-item').forEach(function (el) {
      var t = (el.textContent || '').trim();
      if (/^(Shop|商店)/i.test(t)) el.style.display = 'none';
    });

    // 3. If we're ON shop.html, get out — there's nothing to show.
    var onShopPage = /\/shop\.html(\?|#|$)/i.test(location.pathname + location.search);
    if (onShopPage) {
      // Show a brief message via sessionStorage so index.html can
      // render a toast on arrival, then redirect.
      try { sessionStorage.setItem('hm-shop-disabled-toast', '1'); } catch (_) {}
      location.replace('index.html');
    }
  }

  function init() {
    // Use fetch directly so this script doesn't depend on api.js load
    // order. Race with the page render is fine — we hide AFTER paint
    // (briefly visible Shop link is acceptable; admin disables shop
    // expecting some staleness on already-loaded tabs).
    try {
      fetch(API_BASE + '/public/features', { credentials: 'omit' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (res) {
          if (! res) return;
          // Persist the value so the sync head <script> on the NEXT
          // page load can hide the Shop link before paint — kills the
          // 'flash of Shop link' that runtime hiding alone caused.
          try {
            if (res.shop_enabled === false) {
              localStorage.setItem('hm-shop-enabled', '0');
            } else {
              localStorage.removeItem('hm-shop-enabled');
            }
          } catch (_) {}
          if (res.shop_enabled === false) {
            // Also re-enforce on this page load in case the cache was
            // out of date and the Shop link painted briefly.
            document.documentElement.classList.add('shop-disabled');
            applyShopDisabled();
          } else {
            document.documentElement.classList.remove('shop-disabled');
          }
        })
        .catch(function () { /* network error → assume cached value */ });
    } catch (_) { /* legacy browser */ }

    // Render shop-disabled toast on next-page arrival, if any.
    try {
      if (sessionStorage.getItem('hm-shop-disabled-toast')) {
        sessionStorage.removeItem('hm-shop-disabled-toast');
        var t = document.createElement('div');
        t.style.cssText = 'position:fixed;left:50%;top:80px;transform:translateX(-50%);' +
          'background:rgba(36,22,8,0.92);color:#fff;padding:12px 20px;border-radius:8px;' +
          'font-family:DM Sans,sans-serif;font-size:14px;z-index:9999;box-shadow:0 6px 24px rgba(0,0,0,0.2);';
        t.innerHTML = '<span lang="en">Shop is currently unavailable.</span>' +
                      '<span lang="zh">商店暫時無法使用。</span>';
        document.body.appendChild(t);
        setTimeout(function () { t.style.transition = 'opacity 0.4s'; t.style.opacity = '0'; }, 4000);
        setTimeout(function () { t.remove(); }, 4500);
      }
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
