/**
 * error-monitor.js — HansMed frontend error monitor
 *
 * Catches unhandled JS errors and promise rejections, fingerprints them
 * locally, and batches them to POST /api/errors every 10 seconds.
 *
 * Design goals:
 *   - Never interfere with normal app execution
 *   - Deduplicate: same error hit multiple times = one report per session
 *   - Rate limit: max 20 distinct errors per page load to prevent flooding
 *   - Silent failure: if the API is down, errors are simply dropped
 *
 * Load this script early — ideally as the second <script> tag in <head>
 * after config.js, before any application code.
 */
(function () {
  'use strict';

  var MAX_ERRORS_PER_SESSION = 20;
  var FLUSH_INTERVAL_MS      = 10 * 1000; // 10 seconds
  var MAX_STACK_LENGTH       = 2000;

  // ─── State ────────────────────────────────────────────────────────────────

  var seenFingerprints = {};   // dedupe within this page load
  var queue            = [];   // pending entries waiting for flush
  var errorCount       = 0;    // total distinct errors this session

  // ─── Fingerprint (matches server-side hash logic) ─────────────────────────

  /**
   * Simple FNV-1a 32-bit hash — not SHA-256, but good enough for
   * client-side dedup within a single session. The server re-fingerprints
   * with SHA-256 for its own dedup storage.
   */
  function fnv32(str) {
    var hash = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16);
  }

  function fingerprint(type, file, line) {
    return fnv32((type || '') + '|' + (file || '') + '|' + (line || 0));
  }

  // ─── Core enqueue ─────────────────────────────────────────────────────────

  function enqueue(entry) {
    if (errorCount >= MAX_ERRORS_PER_SESSION) return;

    var fp = fingerprint(entry.type, entry.file, entry.line);
    if (seenFingerprints[fp]) return;
    seenFingerprints[fp] = true;
    errorCount++;

    queue.push(entry);
  }

  // ─── Handlers ─────────────────────────────────────────────────────────────

  window.addEventListener('error', function (event) {
    try {
      var err = event.error;
      enqueue({
        type:    err ? (err.name || 'Error') : 'ScriptError',
        message: event.message || (err && err.message) || 'Unknown error',
        file:    event.filename || null,
        line:    event.lineno   || null,
        col:     event.colno    || null,
        stack:   err && err.stack
                   ? err.stack.slice(0, MAX_STACK_LENGTH)
                   : null,
        url:     window.location.href,
        level:   'error',
      });
    } catch (_) { /* never throw from an error handler */ }
  });

  window.addEventListener('unhandledrejection', function (event) {
    try {
      var reason = event.reason;
      var message, stack, type;

      if (reason instanceof Error) {
        type    = reason.name || 'UnhandledRejection';
        message = reason.message;
        stack   = reason.stack ? reason.stack.slice(0, MAX_STACK_LENGTH) : null;
      } else {
        type    = 'UnhandledRejection';
        message = String(reason);
        stack   = null;
      }

      enqueue({
        type:    type,
        message: message,
        file:    null,
        line:    null,
        col:     null,
        stack:   stack,
        url:     window.location.href,
        level:   'error',
      });
    } catch (_) { /* never throw */ }
  });

  // ─── Flush queue to backend ───────────────────────────────────────────────

  function getApiBase() {
    return (window.HM && window.HM.config && window.HM.config.API_BASE)
      ? window.HM.config.API_BASE
      : 'https://hansmed-system-production.up.railway.app/api';
  }

  function flush() {
    if (queue.length === 0) return;
    var toSend = queue.splice(0);   // drain the queue atomically

    toSend.forEach(function (entry) {
      try {
        // fire-and-forget — we don't care about the response
        fetch(getApiBase() + '/errors', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(entry),
          // keepalive allows the request to outlive a page unload
          keepalive: true,
        }).catch(function () { /* silent */ });
      } catch (_) { /* silent */ }
    });
  }

  // Flush on interval and on page unload
  setInterval(flush, FLUSH_INTERVAL_MS);
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);

  // ─── Manual report API (for try/catch in app code) ────────────────────────

  /**
   * window.HM.reportError(err, level)
   * Call from catch blocks to report a caught error that would otherwise be
   * swallowed. level: 'warning' | 'error' | 'critical' (default: 'error').
   *
   * Example:
   *   try { ... } catch (e) { window.HM.reportError(e, 'warning'); }
   */
  window.HM = window.HM || {};
  window.HM.reportError = function (err, level) {
    try {
      enqueue({
        type:    (err && err.name)    || 'CaughtError',
        message: (err && err.message) || String(err),
        file:    null,
        line:    null,
        col:     null,
        stack:   (err && err.stack)
                   ? err.stack.slice(0, MAX_STACK_LENGTH)
                   : null,
        url:     window.location.href,
        level:   level || 'error',
      });
    } catch (_) { /* silent */ }
  };

})();
