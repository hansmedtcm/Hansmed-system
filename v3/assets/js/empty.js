/**
 * HansMed Empty/Loading/Error/Skeleton State Helpers (v3).
 *
 * Standardised state UIs for every panel. v3 adds skeleton loading
 * presets so panels can show shimmer placeholders that match the
 * shape of the eventual content (card / list / table) instead of a
 * generic "Loading…" spinner.
 *
 *   HM.state.loading(el)                   – generic spinner
 *   HM.state.loading(el, { skeleton: 'card', count: 3 })
 *   HM.state.loading(el, { skeleton: 'list', count: 6 })
 *   HM.state.loading(el, { skeleton: 'table', cols: 5, rows: 5 })
 *
 * Skeleton CSS lives in patterns.css (.skeleton-* classes).
 */
(function () {
  'use strict';

  window.HM = window.HM || {};

  function loading(el, opts) {
    if (!el) return;
    // Backward-compat: HM.state.loading(el, "Loading…") used to take a
    // string. Honour that.
    if (typeof opts === 'string') {
      el.innerHTML = '<div class="state state--loading">' +
        '<div class="state-icon"></div>' +
        '<div class="state-text">' + opts + '</div>' +
        '</div>';
      return;
    }
    opts = opts || {};
    if (opts.skeleton) {
      el.innerHTML = skeleton(opts.skeleton, opts);
      return;
    }
    el.innerHTML = '<div class="state state--loading">' +
      '<div class="state-icon"></div>' +
      '<div class="state-text">' + (opts.message || 'Loading…') + '</div>' +
      '</div>';
  }

  /** Build the skeleton markup for the requested preset. */
  function skeleton(kind, opts) {
    if (kind === 'card') return cardSkeleton(opts.count || 3);
    if (kind === 'list') return listSkeleton(opts.count || 6);
    if (kind === 'table') return tableSkeleton(opts.cols || 5, opts.rows || 5);
    return cardSkeleton(3);
  }

  function cardSkeleton(n) {
    var cards = '';
    for (var i = 0; i < n; i++) {
      cards +=
        '<div class="sk-card">' +
          '<div class="sk-line sk-line--title"></div>' +
          '<div class="sk-line"></div>' +
          '<div class="sk-line sk-line--short"></div>' +
        '</div>';
    }
    return '<div class="sk-grid" aria-busy="true" aria-label="Loading content">' + cards + '</div>';
  }

  function listSkeleton(n) {
    var rows = '';
    for (var i = 0; i < n; i++) {
      rows +=
        '<div class="sk-row">' +
          '<div class="sk-circle"></div>' +
          '<div style="flex:1;">' +
            '<div class="sk-line sk-line--title"></div>' +
            '<div class="sk-line sk-line--short"></div>' +
          '</div>' +
        '</div>';
    }
    return '<div class="sk-list" aria-busy="true" aria-label="Loading list">' + rows + '</div>';
  }

  function tableSkeleton(cols, rows) {
    var hdr = '';
    for (var c = 0; c < cols; c++) hdr += '<div class="sk-line sk-line--title"></div>';
    var body = '';
    for (var r = 0; r < rows; r++) {
      var row = '';
      for (var c2 = 0; c2 < cols; c2++) row += '<div class="sk-line"></div>';
      body += '<div class="sk-trow">' + row + '</div>';
    }
    return '<div class="sk-table" aria-busy="true" aria-label="Loading table">' +
      '<div class="sk-trow sk-trow--head">' + hdr + '</div>' +
      body +
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
    el.innerHTML = '<div class="state state--error" role="alert">' +
      '<div class="state-icon">⚠️</div>' +
      '<div class="state-title">Couldn\'t load this page · 無法載入</div>' +
      '<div class="state-text">' + HM.format.esc(message) + '</div>' +
      '<div class="state-actions"><button class="btn btn--outline" onclick="location.reload()">Retry · 重試</button></div>' +
      '</div>';
  }

  window.HM.state = {
    loading:  loading,
    skeleton: skeleton,  // exported so callers can use raw markup if needed
    empty:    empty,
    error:    error,
  };
})();
