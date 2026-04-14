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

  // ── Redirect logged-in users to their portal ──
  if (auth.isAuthenticated()) {
    auth.refresh().then(function () {
      // Only redirect if URL isn't explicitly ?stay
      if (location.search.indexOf('stay') < 0) {
        auth.redirectToPortal();
      }
    });
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
    nav.classList.toggle('is-open');
  };

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

  // ── Load doctors ──
  async function loadDoctors() {
    var el = document.getElementById('doctors-grid');
    if (!el) return;
    try {
      var res = await api.patient.listDoctors('sort=rating');
      var doctors = (res.data || []).slice(0, 4);

      if (!doctors.length) {
        HM.state.empty(el, {
          icon: '👨‍⚕️',
          title: 'No doctors available yet',
          text: 'Doctors will appear here once admins onboard them.',
        });
        return;
      }

      el.innerHTML = '';
      doctors.forEach(function (d) {
        var data = {
          id: d.user_id,
          full_name: d.full_name || 'Doctor',
          initial: (d.full_name || 'D').charAt(0),
          specialties: d.specialties || 'TCM Practitioner',
          rating: parseFloat(d.rating || 0).toFixed(1),
          consultation_count: d.consultation_count || 0,
          fee_formatted: fmt.money(d.consultation_fee),
        };
        var node = HM.render.fromTemplate('tpl-doctor-card', data);
        node.querySelector('[data-action="view"]').addEventListener('click', function () {
          if (!auth.isAuthenticated()) location.hash = '#/register';
          else auth.redirectToPortal();
        });
        el.appendChild(node);
      });
    } catch (e) {
      HM.state.empty(el, {
        icon: '👨‍⚕️',
        title: 'Unable to load doctors',
        text: 'Please try again shortly.',
      });
    }
  }
  loadDoctors();

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

    // Login submit
    activeModal.element.querySelector('[data-panel="login"]').addEventListener('submit', async function (e) {
      e.preventDefault();
      var formEl = e.target;
      if (!form.validate(formEl, { email: ['required', 'email'], password: ['required'] })) return;
      form.setLoading(formEl, true);
      form.clearGeneralError(formEl);
      try {
        var data = form.serialize(formEl);
        var res = await auth.login(data.email, data.password);
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

    // Register submit
    activeModal.element.querySelector('[data-panel="register"]').addEventListener('submit', async function (e) {
      e.preventDefault();
      var formEl = e.target;
      if (!form.validate(formEl, { nickname: ['required'], email: ['required', 'email'], password: ['required', 'min:8'] })) return;
      form.setLoading(formEl, true);
      form.clearGeneralError(formEl);
      try {
        var data = form.serialize(formEl);
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
      if (!form.validate(formEl, { email: ['required', 'email'], password: ['required'] })) return;
      form.setLoading(formEl, true);
      try {
        var data = form.serialize(formEl);
        var res = await auth.login(data.email, data.password);
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
  router.start();

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
