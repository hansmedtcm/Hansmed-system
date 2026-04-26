/**
 * Landing page bootstrap
 * Handles: nav, doctor list, auth modal, contact form, language switcher
 */
(function () {
  'use strict';

  var api = HM.api;
  var auth = HM.auth;
  var ui = HM.ui;
  var router = HM.router;
  var form = HM.form;
  var fmt = HM.format;

  // ── Keep the session fresh but DO NOT auto-redirect ──
  // Logged-in users should be able to browse the public home page.
  // They can click "My Portal" in the nav to enter their portal.
  // (Only auto-redirect immediately after login — see landing.js login handler.)
  if (auth.isAuthenticated()) {
    auth.refresh().catch(function () { /* token invalid: ignore, nav will show Sign In */ });
  }

  // ── Build WhatsApp URL from config ──
  var waCfg = (HM.config && HM.config.CLINIC) || {};
  var waNum = (waCfg.whatsapp || '').replace(/\D/g, '');
  var waMsg = encodeURIComponent(waCfg.whatsappMessage || 'Hi HansMed, I would like to book an appointment.');
  var waUrl = waNum ? ('https://wa.me/' + waNum + '?text=' + waMsg) : null;

  // Wire the hero CTA + the floating FAB — set href so the OS opens WhatsApp directly
  var heroWa = document.getElementById('hero-whatsapp');
  if (heroWa) {
    if (waUrl) {
      heroWa.setAttribute('href', waUrl);
      heroWa.setAttribute('target', '_blank');
      heroWa.setAttribute('rel', 'noopener');
    } else heroWa.style.display = 'none';
  }
  var fab = document.getElementById('hm-whatsapp-fab');
  if (fab) {
    if (waUrl) fab.setAttribute('href', waUrl);
    else fab.style.display = 'none';
  }

  // ── Session expired message ──
  if (location.search.indexOf('expired') >= 0) {
    setTimeout(function () {
      ui.toast('Session expired. Please sign in again. · 登入已過期，請重新登入。', 'warning', 5000);
    }, 300);
  }

  // ── Nav ──
  var nav = document.getElementById('nav');
  window.addEventListener('scroll', function () {
    if (window.scrollY > 20) nav.classList.add('is-scrolled');
    else nav.classList.remove('is-scrolled');
  });

  window.toggleNav = function () {
    var isOpen = nav.classList.toggle('is-open');
    var btn = document.querySelector('.nav-toggle');
    if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };

  // Close mobile menu when tapping outside it
  document.addEventListener('click', function (e) {
    if (!nav.classList.contains('is-open')) return;
    if (nav.contains(e.target)) return;
    nav.classList.remove('is-open');
    var btn = document.querySelector('.nav-toggle');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });

  window.scrollTo = function (id) {
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (nav.classList.contains('is-open')) nav.classList.remove('is-open');
  };

  // Close mobile menu on link click
  document.querySelectorAll('.nav-menu a').forEach(function (a) {
    a.addEventListener('click', function () {
      if (window.innerWidth <= 768) nav.classList.remove('is-open');
    });
  });

  // ── Language switcher ──
  document.querySelectorAll('.lang-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.lang-btn').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      HM.i18n.setLang(btn.getAttribute('data-lang'));
    });
  });
  // Set initial active
  var currentLang = HM.i18n.currentLang();
  document.querySelectorAll('.lang-btn').forEach(function (b) {
    if (b.getAttribute('data-lang') === currentLang) {
      b.classList.add('is-active');
    } else {
      b.classList.remove('is-active');
    }
  });

  // ── Featured shop items (previewed on landing) ──
  // Curated fallback used if the backend catalog isn't wired up yet.
  var FEATURED_FALLBACK = [
    { emoji: '🍵', category: 'Tea · 茶飲', name: 'Ginger Wellness Tea', name_zh: '薑母養生茶', price: 28 },
    { emoji: '🌿', category: 'Herbs · 草藥', name: 'Astragalus Root', name_zh: '黃芪', price: 45 },
    { emoji: '💊', category: 'OTC · 成藥', name: 'Cough & Cold Formula', name_zh: '止咳感冒方', price: 32 },
    { emoji: '🧴', category: 'Topical · 外用', name: 'Meridian Balm', name_zh: '經絡膏', price: 38 },
  ];

  async function loadShopPreview() {
    var el = document.getElementById('shop-preview-grid');
    if (!el) return;
    var items = FEATURED_FALLBACK;
    try {
      // Try the curated catalog endpoint; if unavailable, use fallback.
      if (api.pages && api.shop && api.shop.featured) {
        var res = await api.shop.featured();
        if (res.data && res.data.length) items = res.data.slice(0, 4);
      }
    } catch (_) { /* fall through to fallback */ }

    el.innerHTML = '';
    items.forEach(function (p) {
      var data = {
        id: p.id || p.name,
        emoji: p.emoji || '🌿',
        category: p.category || 'Remedy',
        name: p.name,
        name_zh: p.name_zh || '',
        price_formatted: fmt.money(p.price),
      };
      var node = HM.render.fromTemplate('tpl-product-card', data);
      var cardEl = node.firstElementChild;
      if (cardEl) cardEl.addEventListener('click', function () {
        location.href = 'portal.html#/shop';
      });
      el.appendChild(node);
    });
  }
  loadShopPreview();

  // ── Nav state: if logged-in, swap Sign In button for My Portal ──
  function updateNavAuthState() {
    var slot = document.getElementById('nav-auth-slot');
    if (!slot) return;
    if (auth.isAuthenticated()) {
      var user = api.getUser();
      var name = user ? auth.displayName(user) : 'Portal';
      slot.innerHTML = '<button class="btn btn--primary btn--sm" onclick="HM.auth.redirectToPortal()">' +
        'My Portal · 我的帳號</button>';
    }
  }
  updateNavAuthState();

  // ── Cart badge: sync count from localStorage ──
  function updateCartBadge() {
    var cart = [];
    try { cart = JSON.parse(localStorage.getItem('hm_cart') || '[]'); } catch (_) { cart = []; }
    var count = cart.reduce(function (s, it) { return s + (it.qty || 1); }, 0);
    var el = document.getElementById('nav-cart');
    var num = document.getElementById('nav-cart-count');
    if (el) el.setAttribute('data-count', String(count));
    if (num) num.textContent = count;
  }
  updateCartBadge();
  window.addEventListener('storage', updateCartBadge);

  // ── Auth Modal ──
  var activeModal = null;

  function openAuthModal(initialTab) {
    if (activeModal) activeModal.close();
    var tpl = document.getElementById('tpl-auth-modal');
    var content = tpl.content.cloneNode(true);
    activeModal = ui.modal({
      size: 'lg',
      content: content,
      onClose: function () { activeModal = null; if (location.hash.indexOf('/login') >= 0 || location.hash.indexOf('/register') >= 0) location.hash = '#/'; },
    });

    // Tab switching
    var tabs = activeModal.element.querySelectorAll('.tab');
    var panels = activeModal.element.querySelectorAll('.tab-panel');
    function showTab(name) {
      tabs.forEach(function (t) { t.classList.toggle('is-active', t.getAttribute('data-tab') === name); });
      panels.forEach(function (p) { p.classList.toggle('is-active', p.getAttribute('data-panel') === name); });
      form.clearErrors(activeModal.element);
      form.clearGeneralError(activeModal.element.querySelector('[data-panel="' + name + '"]'));
    }
    tabs.forEach(function (t) {
      t.addEventListener('click', function () { showTab(t.getAttribute('data-tab')); });
    });
    showTab(initialTab || 'login');

    // Shared password-complexity check: ≥8, ≥1 uppercase, ≥1 number.
    function passwordOk(pw) {
      return typeof pw === 'string' && pw.length >= 8 && /[A-Z]/.test(pw) && /\d/.test(pw);
    }

    // Login submit — identifier can be email OR phone
    activeModal.element.querySelector('[data-panel="login"]').addEventListener('submit', async function (e) {
      e.preventDefault();
      var formEl = e.target;
      if (!form.validate(formEl, { identifier: ['required'], password: ['required'] })) return;
      form.setLoading(formEl, true);
      form.clearGeneralError(formEl);
      try {
        var data = form.serialize(formEl);
        var res = await auth.login(data.identifier, data.password);
        ui.toast('Welcome back · 歡迎回來', 'success');
        setTimeout(function () { auth.redirectToPortal(); }, 500);
      } catch (err) {
        form.setLoading(formEl, false);
        if (err.data && err.data.errors) {
          form.showErrors(formEl, err.data.errors);
        } else {
          form.showGeneralError(formEl, err.message || 'Sign in failed. Please try again.');
        }
      }
    });

    // WhatsApp fallback button — opens the clinic chat in a new tab
    var waBtn = activeModal.element.querySelector('[data-action="whatsapp-book"]');
    if (waBtn) {
      var waNumber = (HM.config && HM.config.CLINIC && HM.config.CLINIC.whatsapp) || '';
      var waMsg = encodeURIComponent('Hi HansMed, I\'d like to book an appointment.');
      var waHref = waNumber
        ? 'https://wa.me/' + String(waNumber).replace(/[^\d]/g, '') + '?text=' + waMsg
        : 'https://wa.me/?text=' + waMsg;
      waBtn.setAttribute('href', waHref);
    }

    // "Forgot password?" links — show the forgot panel
    activeModal.element.querySelectorAll('[data-action="forgot"]').forEach(function (link) {
      link.addEventListener('click', function (e) { e.preventDefault(); showTab('forgot'); });
    });
    var backLink = activeModal.element.querySelector('[data-action="back-to-login"]');
    if (backLink) backLink.addEventListener('click', function (e) { e.preventDefault(); showTab('login'); });

    // Forgot-password submit
    var forgotPanel = activeModal.element.querySelector('[data-panel="forgot"]');
    if (forgotPanel) forgotPanel.addEventListener('submit', async function (e) {
      e.preventDefault();
      var formEl = e.target;
      if (!form.validate(formEl, { email: ['required', 'email'] })) return;
      form.setLoading(formEl, true);
      form.clearGeneralError(formEl);
      var successEl = formEl.querySelector('[data-general-success]');
      if (successEl) successEl.style.display = 'none';
      try {
        var data = form.serialize(formEl);
        var res = await HM.api.authForgotPassword(data.email);
        form.setLoading(formEl, false);
        if (successEl) {
          successEl.textContent = res.message || 'If that email is registered, a reset link has been sent.';
          successEl.style.display = 'block';
        }
        formEl.querySelector('input[name="email"]').value = '';
      } catch (err) {
        form.setLoading(formEl, false);
        form.showGeneralError(formEl, (err && err.message) || 'Could not send reset link.');
      }
    });

    // Register submit — now requires phone & enforces password complexity
    activeModal.element.querySelector('[data-panel="register"]').addEventListener('submit', async function (e) {
      e.preventDefault();
      var formEl = e.target;
      if (!form.validate(formEl, {
        nickname: ['required'],
        phone:    ['required'],
        email:    ['required', 'email'],
        password: ['required', 'min:8'],
      })) return;
      var data = form.serialize(formEl);
      if (!passwordOk(data.password)) {
        form.showErrors(formEl, { password: ['Password must be at least 8 characters and include 1 uppercase letter and 1 number.'] });
        return;
      }
      form.setLoading(formEl, true);
      form.clearGeneralError(formEl);
      try {
        data.role = 'patient';
        await auth.register(data);
        ui.toast('Account created · 帳號已建立', 'success');
        setTimeout(function () { auth.redirectToPortal(); }, 500);
      } catch (err) {
        form.setLoading(formEl, false);
        if (err.data && err.data.errors) {
          form.showErrors(formEl, err.data.errors);
        } else {
          form.showGeneralError(formEl, err.message || 'Registration failed.');
        }
      }
    });

    // Professional login submit
    activeModal.element.querySelector('[data-panel="professional"]').addEventListener('submit', async function (e) {
      e.preventDefault();
      var formEl = e.target;
      if (!form.validate(formEl, { identifier: ['required'], password: ['required'] })) return;
      form.setLoading(formEl, true);
      try {
        var data = form.serialize(formEl);
        var res = await auth.login(data.identifier, data.password);
        if (res.user.role === 'patient') {
          form.setLoading(formEl, false);
          form.showGeneralError(formEl, 'This is a patient account. Please use the Sign In tab.');
          return;
        }
        ui.toast('Welcome, ' + auth.displayName(res.user), 'success');
        setTimeout(function () { auth.redirectToPortal(); }, 500);
      } catch (err) {
        form.setLoading(formEl, false);
        if (err.data && err.data.errors) {
          form.showErrors(formEl, err.data.errors);
        } else {
          form.showGeneralError(formEl, err.message || 'Sign in failed.');
        }
      }
    });
  }

  // ── Router ──
  router.on('#/', function () { if (activeModal) activeModal.close(); });
  router.on('#/login', function () { openAuthModal('login'); });
  router.on('#/register', function () { openAuthModal('register'); });
  router.on('#/professional', function () { openAuthModal('professional'); });
  router.on('#/reset-password', function () { openResetPasswordModal(); });
  router.start();

  // ── Auto-popup sign-in on landing ──
  // First-time visitors (not logged in, no deep link) see the sign-in
  // modal automatically to encourage account creation. We remember
  // the dismissal in sessionStorage so it doesn't pop back up while
  // the user is browsing the site.
  (function autoPopup() {
    if (auth.isAuthenticated()) return;           // already signed in
    if (location.hash && location.hash !== '#/' && location.hash !== '') return;  // deep-linked elsewhere
    if (sessionStorage.getItem('hm_auth_dismissed') === '1') return;  // already closed it this session

    // Small delay so the page has painted first
    setTimeout(function () {
      if (activeModal) return;
      openAuthModal('login');
      // Mark dismissed as soon as it's closed so we don't re-popup
      var prevOnClose = activeModal && activeModal.element && activeModal.element._onClose;
      // The modal API already tracks onClose; we piggy-back via DOM event
      activeModal.element.addEventListener('hm-modal-close', function () {
        sessionStorage.setItem('hm_auth_dismissed', '1');
      }, { once: true });
      // Fallback — observe removal from DOM
      var mo = new MutationObserver(function () {
        if (!document.body.contains(activeModal && activeModal.element)) {
          sessionStorage.setItem('hm_auth_dismissed', '1');
          mo.disconnect();
        }
      });
      mo.observe(document.body, { childList: true, subtree: false });
    }, 600);
  })();

  // ── Reset-password page modal (opened via #/reset-password?email=…&token=…) ──
  function openResetPasswordModal() {
    if (activeModal) activeModal.close();
    // Pull token + email from the URL query (before the hash router strips it)
    var qs = location.search || '';
    var email = (qs.match(/[?&]email=([^&]+)/) || [])[1] || '';
    var token = (qs.match(/[?&]token=([^&]+)/) || [])[1] || '';
    email = decodeURIComponent(email); token = decodeURIComponent(token);

    activeModal = ui.modal({
      size: 'md',
      content:
        '<h2 style="text-align:center; margin-bottom: var(--s-2);">Set New Password · 設定新密碼</h2>' +
        '<p style="text-align:center; color: var(--stone); margin-bottom: var(--s-5); font-size: var(--text-sm);">Enter a new password for your account. · 為帳號設定新密碼。</p>' +
        '<form id="rp-form">' +
        '<input type="hidden" name="email" value="' + fmt.esc(email) + '">' +
        '<input type="hidden" name="token" value="' + fmt.esc(token) + '">' +
        '<div class="field"><label class="field-label" data-required>Email</label>' +
          '<input type="email" class="field-input" value="' + fmt.esc(email) + '" readonly></div>' +
        '<div class="field"><label class="field-label" data-required>New Password · 新密碼</label>' +
          '<input type="password" name="password" class="field-input" required minlength="8" autocomplete="new-password">' +
          '<div class="field-hint">Minimum 8 characters, with at least 1 uppercase letter and 1 number.</div>' +
          '<div class="field-error"></div></div>' +
        '<div class="field"><label class="field-label" data-required>Confirm Password · 確認密碼</label>' +
          '<input type="password" name="password_confirm" class="field-input" required minlength="8">' +
          '<div class="field-error"></div></div>' +
        '<div data-general-error class="alert alert--danger" style="display:none; margin-bottom: var(--s-3);"></div>' +
        '<button type="submit" class="btn btn--primary btn--block">Set New Password</button>' +
        '</form>',
    });

    var rpForm = activeModal.element.querySelector('#rp-form');
    rpForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var d = form.serialize(rpForm);
      if (d.password !== d.password_confirm) {
        form.showGeneralError(rpForm, 'Passwords do not match.'); return;
      }
      if (d.password.length < 8 || !/[A-Z]/.test(d.password) || !/\d/.test(d.password)) {
        form.showGeneralError(rpForm, 'Password must be at least 8 characters with 1 uppercase letter and 1 number.'); return;
      }
      form.setLoading(rpForm, true);
      try {
        await HM.api.authResetPassword(d.email, d.token, d.password);
        ui.toast('Password reset · 密碼已重設', 'success');
        activeModal.close();
        setTimeout(function () { openAuthModal('login'); }, 400);
      } catch (err) {
        form.setLoading(rpForm, false);
        if (err.data && err.data.errors) form.showErrors(rpForm, err.data.errors);
        else form.showGeneralError(rpForm, (err && err.message) || 'Reset failed.');
      }
    });
  }

  // ── Content pages (privacy, terms, FAQ) ──
  window.showPage = async function (slug) {
    try {
      var res = await api.pages.show(slug);
      var page = res.page;
      ui.modal({
        size: 'lg',
        title: page.title,
        content: '<div style="line-height: var(--leading-relaxed); font-size: var(--text-sm);">' + page.body_html + '</div>',
      });
    } catch (e) {
      // Page doesn't exist yet
      var titles = {
        'privacy-policy': 'Privacy Policy · 隱私政策',
        'terms': 'Terms of Service · 服務條款',
        'faq': 'Frequently Asked Questions · 常見問題',
      };
      ui.modal({
        title: titles[slug] || 'Page not found',
        content: '<p class="text-muted">This page has not been published yet. Please check back soon.</p>',
      });
    }
  };

  // ── Contact form ──
  document.getElementById('contact-form').addEventListener('submit', function (e) {
    e.preventDefault();
    // For now, show a thank-you (backend endpoint for contact not yet built)
    ui.toast('Thank you! We\'ll get back to you soon. · 感謝您的訊息，我們會盡快回覆。', 'success', 5000);
    e.target.reset();
  });

  console.log('[HansMed] Landing page ready');
})();
