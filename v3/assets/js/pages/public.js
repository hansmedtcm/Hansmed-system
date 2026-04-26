/**
 * Shared bootstrap for public (no-login-required) pages:
 *   - services.html
 *   - shop.html
 *   - contact.html
 *
 * Handles: mobile nav toggle, WhatsApp URL, cart-badge sync, auth-slot
 * ("Sign In" vs "My Portal"), contact form, public config (clinic email/phone).
 */
(function () {
  'use strict';

  var cfg = (window.HM && HM.config) || {};
  var clinic = cfg.CLINIC || {};

  // ── Mobile nav toggle ──
  var nav = document.getElementById('nav');
  window.toggleNav = function () {
    if (!nav) return;
    var isOpen = nav.classList.toggle('is-open');
    var btn = document.querySelector('.nav-toggle');
    if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };
  if (nav) {
    document.addEventListener('click', function (e) {
      if (!nav.classList.contains('is-open')) return;
      if (nav.contains(e.target)) return;
      nav.classList.remove('is-open');
      var btn = document.querySelector('.nav-toggle');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
    window.addEventListener('scroll', function () {
      if (window.scrollY > 20) nav.classList.add('is-scrolled');
      else nav.classList.remove('is-scrolled');
    });
  }

  // ── WhatsApp URL ──
  var waNum = (clinic.whatsapp || '').replace(/\D/g, '');
  var waMsg = encodeURIComponent(clinic.whatsappMessage || 'Hi HansMed, I would like to book an appointment.');
  var waUrl = waNum ? ('https://wa.me/' + waNum + '?text=' + waMsg) : null;
  var fab = document.getElementById('hm-whatsapp-fab');
  if (fab) {
    if (waUrl) fab.setAttribute('href', waUrl);
    else fab.style.display = 'none';
  }
  // Page-specific WhatsApp links — set href so the browser handles the click natively
  ['hero-whatsapp', 'services-whatsapp', 'contact-whatsapp'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (!waUrl) { el.style.display = 'none'; return; }
    el.setAttribute('href', waUrl);
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener');
  });

  // ── Auth slot (Sign In vs My Portal) ──
  var authSlot = document.getElementById('nav-auth-slot');
  if (authSlot && HM.api && HM.api.getToken && HM.api.getToken()) {
    // User is signed in — swap to My Portal
    authSlot.innerHTML = '<button class="btn btn--primary btn--sm" onclick="HM.auth.redirectToPortal()">My Portal · 我的帳號</button>';
  }

  // ── Cart badge sync ──
  function updateCartBadge() {
    var count = (HM.cart && HM.cart.count) ? HM.cart.count() : 0;
    var el = document.getElementById('nav-cart');
    var num = document.getElementById('nav-cart-count');
    if (el) el.setAttribute('data-count', String(count));
    if (num) num.textContent = count;
  }
  updateCartBadge();
  window.addEventListener('storage', updateCartBadge);
  if (HM.bus) HM.bus.on('cart:changed', updateCartBadge);
  // Periodic fallback in case bus isn't set up
  setInterval(updateCartBadge, 1000);

  // ── Contact info (email/phone/whatsapp) — populate links on contact.html ──
  var contactEmail = document.getElementById('contact-email');
  if (contactEmail) {
    var email = clinic.email || '';
    contactEmail.textContent = email || '—';
    if (email) contactEmail.setAttribute('href', 'mailto:' + email);
  }
  var contactPhone = document.getElementById('contact-phone');
  if (contactPhone) {
    var phone = clinic.phone || '';
    contactPhone.textContent = phone || '—';
    if (phone) contactPhone.setAttribute('href', 'tel:' + phone.replace(/\s+/g, ''));
  }
  var contactWa = document.getElementById('contact-whatsapp');
  if (contactWa && waUrl) contactWa.setAttribute('href', waUrl);

  // ── Contact form ──
  var cForm = document.getElementById('contact-form');
  if (cForm) {
    cForm.addEventListener('submit', function (e) {
      e.preventDefault();
      HM.ui.toast("Thank you! We'll get back to you soon. · 感謝您的訊息，我們會盡快回覆。", 'success', 5000);
      cForm.reset();
    });
  }
})();
