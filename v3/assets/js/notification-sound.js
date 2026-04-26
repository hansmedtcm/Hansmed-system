/**
 * HM.notificationSound — polls the notifications API and plays a
 * short audio cue whenever a new notification arrives.
 *
 * Two cue profiles:
 *   'review'    (sound A) — softer bell. Fires on doctor review-pending
 *                          (tongue / constitution) and new appointment
 *                          bookings.
 *   'dispense'  (sound B) — higher chime. Fires on new incoming orders
 *                          that a pharmacy must dispense.
 *
 * Sounds are synthesised with WebAudio at runtime so we don't ship
 * any audio assets — this also keeps the first-play latency low
 * (no network fetch on the first event).
 *
 * The watcher remembers the largest notification ID it has seen in
 * sessionStorage so a page reload doesn't replay old events.
 *
 * Start it from a role-bootstrap file, e.g.
 *   HM.notificationSound.start({
 *     reviewTypes:   ['review.pending.tongue', 'review.pending.constitution', 'appointment.booked'],
 *     dispenseTypes: ['order.incoming'],
 *   });
 */
(function () {
  'use strict';
  window.HM = window.HM || {};

  var timer = null;
  var lastSeenId = 0;
  var config = { reviewTypes: [], dispenseTypes: [] };
  var audioCtx = null;
  var started = false;
  var STORAGE_KEY = 'hm_notif_last_seen_id';

  // ── Audio synthesis ───────────────────────────────────────
  function ctx() {
    if (audioCtx) return audioCtx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (! AC) return null;
      audioCtx = new AC();
      return audioCtx;
    } catch (_) { return null; }
  }

  // Two short tone sequences. Distinct enough to tell apart across
  // a noisy clinic without being irritating on repeat.
  function tone(freq, duration, when, gain) {
    var c = ctx(); if (! c) return;
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.value = 0;
    osc.connect(g); g.connect(c.destination);
    var t = c.currentTime + (when || 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain || 0.12, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  function playReview() {
    // Gentle two-note rise, like a reception bell. (sound A)
    tone(523, 0.22, 0.00, 0.14);  // C5
    tone(784, 0.34, 0.18, 0.12);  // G5
  }

  function playDispense() {
    // Three-note "ding ding ding", brighter — pharmacy pick-up cue. (sound B)
    tone(988, 0.15, 0.00, 0.13); // B5
    tone(988, 0.15, 0.18, 0.13);
    tone(1319, 0.28, 0.36, 0.13); // E6
  }

  // ── Notification polling ──────────────────────────────────
  function matches(type, list) {
    if (! type || ! list || ! list.length) return false;
    for (var i = 0; i < list.length; i++) {
      // Support prefix wildcard: 'review.pending.*' matches any
      // 'review.pending.X' type so we don't have to enumerate every
      // future subtype client-side.
      var t = list[i];
      if (t.slice(-1) === '*') {
        if (type.indexOf(t.slice(0, -1)) === 0) return true;
      } else if (t === type) {
        return true;
      }
    }
    return false;
  }

  async function poll() {
    // HM.auth.token is a property-accessor on some builds and doesn't
    // exist on all — fall back to HM.api.getToken which always does.
    var hasToken = false;
    try {
      if (HM.auth && typeof HM.auth.token === 'function') hasToken = !!HM.auth.token();
      else if (HM.auth && typeof HM.auth.token === 'string') hasToken = !!HM.auth.token;
      else if (HM.api && typeof HM.api.getToken === 'function') hasToken = !!HM.api.getToken();
    } catch (_) {}
    if (! HM.api || ! HM.api.notification || ! hasToken) return;
    try {
      var res = await HM.api.notification.list();
      var items = (res && res.data) || [];
      // Always log so the clinic can F12 and verify cues are firing.
      // Disable once behavior is confirmed: window.HM_NOTIF_DEBUG = false.
      if (window.HM_NOTIF_DEBUG !== false) {
        try { console.log('[HM notif] poll: ' + items.length + ' items, lastSeen=' + lastSeenId + ', top.id=' + (items[0] && items[0].id) + ', top.type=' + (items[0] && items[0].type)); } catch (_) {}
      }
      if (! items.length) return;

      // Find highest id seen this poll.
      var maxId = lastSeenId;
      var newItems = [];
      items.forEach(function (n) {
        if (n.id > lastSeenId) newItems.push(n);
        if (n.id > maxId) maxId = n.id;
      });
      if (newItems.length) {
        // Sort oldest→newest so cue ordering feels natural.
        newItems.sort(function (a, b) { return a.id - b.id; });
        var playedReview = false, playedDispense = false;
        newItems.forEach(function (n) {
          var matched = false;
          if (matches(n.type, config.dispenseTypes)) {
            if (! playedDispense) { playDispense(); playedDispense = true; }
            matched = true;
          } else if (matches(n.type, config.reviewTypes)) {
            if (! playedReview) { playReview(); playedReview = true; }
            matched = true;
          }
          // Show a toast pop-up alongside the sound so the staff see
          // WHAT just came in without having to open the bell menu.
          // Clicking the toast jumps to the notification's route.
          if (matched && HM.ui && HM.ui.toast) {
            var msg = (n.title || 'New notification') + (n.body ? ' — ' + n.body : '');
            try {
              HM.ui.toast(msg, 'info', 6000);
            } catch (_) {}
            // Route hint: if the notification carries a route, advertise
            // it via a second, clickable toast if UI supports it. We
            // keep it simple and just set the hash on double-click of
            // the bell — skipped here to avoid noisy UX.
          }
        });
      }
      if (maxId > lastSeenId) {
        lastSeenId = maxId;
        try { sessionStorage.setItem(STORAGE_KEY, String(maxId)); } catch (_) {}
      }
    } catch (_) { /* swallow — try again next tick */ }
  }

  function start(opts) {
    if (started) return;
    started = true;
    opts = opts || {};
    config.reviewTypes   = opts.reviewTypes   || [];
    config.dispenseTypes = opts.dispenseTypes || [];

    // Seed last-seen from session so a reload doesn't replay events.
    try {
      var stored = parseInt(sessionStorage.getItem(STORAGE_KEY) || '0', 10);
      if (! isNaN(stored)) lastSeenId = stored;
    } catch (_) {}

    // First call establishes the baseline without any sound — we do
    // NOT want a flood on login.
    (async function baseline() {
      try {
        var res = await HM.api.notification.list();
        var items = (res && res.data) || [];
        items.forEach(function (n) { if (n.id > lastSeenId) lastSeenId = n.id; });
        try { sessionStorage.setItem(STORAGE_KEY, String(lastSeenId)); } catch (_) {}
      } catch (_) {}
      timer = setInterval(poll, opts.intervalMs || 25000);
    })();

    // Browsers block audio until the user interacts. Create + resume
    // the AudioContext on the first gesture so every subsequent cue
    // is audible. Handles click, keydown, and touchstart (mobile).
    // Without this the sound queue silently fails even though the
    // notification polling is working correctly.
    var unlocked = false;
    var resume = function () {
      if (unlocked) return;
      var c = ctx();
      if (! c) return;
      var after = function () {
        // Tiny silent blip forces the hardware path open on Safari —
        // some iOS versions won't play the first real tone otherwise.
        try {
          var osc = c.createOscillator(); var g = c.createGain();
          g.gain.value = 0.0001; osc.connect(g); g.connect(c.destination);
          osc.start(); osc.stop(c.currentTime + 0.01);
        } catch (_) {}
        unlocked = true;
        try { console.log('[HM notif] audio unlocked, state=' + c.state); } catch (_) {}
      };
      if (c.state === 'suspended') {
        c.resume().then(after, after);
      } else { after(); }
    };
    ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(function (ev) {
      document.addEventListener(ev, resume, { passive: true });
    });
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    started = false;
  }

  HM.notificationSound = {
    start: start,
    stop:  stop,
    // Exposed for manual testing (e.g. Settings → "Test sound" button):
    playReview:   playReview,
    playDispense: playDispense,
  };
})();
