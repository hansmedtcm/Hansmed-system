/**
 * HansMed Event Bus
 * Simple pub/sub for cross-panel coordination.
 */
(function () {
  'use strict';

  window.HM = window.HM || {};

  var listeners = {};

  function on(event, handler) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(handler);
    return function off() {
      listeners[event] = (listeners[event] || []).filter(function (h) { return h !== handler; });
    };
  }

  function emit(event, payload) {
    (listeners[event] || []).forEach(function (h) {
      try { h(payload); } catch (e) { console.error('[bus]', event, e); }
    });
  }

  function off(event, handler) {
    if (!listeners[event]) return;
    if (!handler) { delete listeners[event]; return; }
    listeners[event] = listeners[event].filter(function (h) { return h !== handler; });
  }

  window.HM.bus = { on: on, emit: emit, off: off };
})();
