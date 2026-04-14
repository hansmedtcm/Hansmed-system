/**
 * HansMed Empty/Loading/Error State Helpers
 * Standardized state UIs for every panel.
 */
(function () {
  'use strict';

  window.HM = window.HM || {};

  function loading(el, message) {
    if (!el) return;
    el.innerHTML = '<div class="state state--loading">' +
      '<div class="state-icon"></div>' +
      '<div class="state-text">' + (message || 'Loading…') + '</div>' +
      '</div>';
  }

  function empty(el, opts) {
    if (!el) return;
    opts = typeof opts === 'string' ? { title: opts } : (opts || {});
    el.innerHTML = '<div class="state state--empty">' +
      (opts.icon ? '<div class="state-icon">' + opts.icon + '</div>' : '<div class="state-icon">📭</div>') +
      (opts.title ? '<div class="state-title">' + opts.title + '</div>' : '') +
      (opts.text ? '<div class="state-text">' + opts.text + '</div>' : '') +
      (opts.actionText && opts.actionHref ?
        '<div class="state-actions"><a href="' + opts.actionHref + '" class="btn btn--primary">' + opts.actionText + '</a></div>' : '') +
      '</div>';
  }

  function error(el, err) {
    if (!el) return;
    var message = err && err.message ? err.message : (typeof err === 'string' ? err : 'Something went wrong');
    el.innerHTML = '<div class="state state--error">' +
      '<div class="state-icon">⚠️</div>' +
      '<div class="state-title">Couldn\'t load this page</div>' +
      '<div class="state-text">' + HM.format.esc(message) + '</div>' +
      '<div class="state-actions"><button class="btn btn--outline" onclick="location.reload()">Retry · 重試</button></div>' +
      '</div>';
  }

  window.HM.state = {
    loading: loading,
    empty: empty,
    error: error,
  };
})();
