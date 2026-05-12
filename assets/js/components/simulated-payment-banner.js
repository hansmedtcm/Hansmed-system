/**
 * HansMed — Simulated Payment Banner
 *
 * During pilot (PAYMENTS_PILOT_MODE=true on the backend), no real money
 * changes hands. This banner is REQUIRED on every page that shows a
 * checkout, POS, or payment UI so users are never misled.
 *
 * See docs/ux/simulated-payment-banner.md for visual spec and removal
 * criteria. Removal criteria: ALL of:
 *   1. Live payment provider tested with real webhook
 *   2. BNM e-money license obtained (or PSP agreement)
 *   3. Refund flow tested end-to-end
 *   4. Terms of Service updated for real commerce
 *   5. Finance ledger reconciled against PSP dashboard
 *
 * Usage:
 *   HM.simulatedPaymentBanner.render(hostEl)   // appends into container
 *   HM.simulatedPaymentBanner.html()            // returns HTML string
 *   HM.simulatedPaymentBanner.inject('top')     // inserts at document top
 */
(function () {
  'use strict';
  window.HM = window.HM || {};

  var STYLE_ID = 'hm-sim-pay-banner-style';
  var INJECTED_FLAG = 'hmSimPayBannerInjected';

  // Single CSS install, idempotent.
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.hm-sim-banner{' +
        'background:#FFF4CC;' +
        'border:2px solid #D97706;' +
        'color:#78350F;' +
        'padding:12px 16px;' +
        'border-radius:6px;' +
        'margin:0 0 16px 0;' +
        'font-family:inherit;' +
        'line-height:1.35;' +
      '}' +
      '.hm-sim-banner--sticky{' +
        'position:sticky;top:0;z-index:40;margin:0 0 12px 0;border-radius:0;' +
      '}' +
      '.hm-sim-banner__title{' +
        'font-weight:700;font-size:15px;margin:0 0 2px 0;' +
      '}' +
      '.hm-sim-banner__sub{' +
        'font-size:13px;margin:0;opacity:.9;' +
      '}' +
      '.hm-sim-banner__icon{margin-right:6px;}';
    document.head.appendChild(style);
  }

  function t(key) {
    if (window.HM && HM.i18n && typeof HM.i18n.t === 'function') {
      return HM.i18n.t(key);
    }
    // Fallback if i18n isn't loaded yet.
    var fallback = {
      'banner.simulated.line1': 'SIMULATED PAYMENT — NO REAL CHARGES WILL BE MADE',
      'banner.simulated.line2': 'This is a pilot build for testing only. No money will be deducted and no goods will be dispatched commercially.',
    };
    return fallback[key] || key;
  }

  function html(opts) {
    opts = opts || {};
    var sticky = opts.sticky === true;
    var cls = 'hm-sim-banner' + (sticky ? ' hm-sim-banner--sticky' : '');
    return (
      '<div class="' + cls + '" role="note" aria-live="polite">' +
        '<div class="hm-sim-banner__title">' +
          '<span class="hm-sim-banner__icon" aria-hidden="true">⚠️</span>' +
          escapeHtml(t('banner.simulated.line1')) +
        '</div>' +
        '<div class="hm-sim-banner__sub">' +
          escapeHtml(t('banner.simulated.line2')) +
        '</div>' +
      '</div>'
    );
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * Render banner inside a host element (appended).
   */
  function render(hostEl, opts) {
    if (!hostEl) return;
    ensureStyles();
    var wrapper = document.createElement('div');
    wrapper.innerHTML = html(opts);
    hostEl.insertBefore(wrapper.firstChild, hostEl.firstChild);
  }

  /**
   * Inject once at top of body, sticky. Idempotent.
   */
  function injectSticky() {
    if (window[INJECTED_FLAG]) return;
    ensureStyles();
    var wrap = document.createElement('div');
    wrap.innerHTML = html({ sticky: true });
    document.body.insertBefore(wrap.firstChild, document.body.firstChild);
    window[INJECTED_FLAG] = true;
  }

  // Refresh banner copy when language changes.
  window.addEventListener('hm:lang-changed', function () {
    document.querySelectorAll('.hm-sim-banner').forEach(function (el) {
      var sticky = el.classList.contains('hm-sim-banner--sticky');
      var newNode = document.createElement('div');
      newNode.innerHTML = html({ sticky: sticky });
      el.parentNode.replaceChild(newNode.firstChild, el);
    });
  });

  HM.simulatedPaymentBanner = {
    html: html,
    render: render,
    injectSticky: injectSticky,
  };
})();
