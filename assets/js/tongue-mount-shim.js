/**
 * HM.tongue.mount — shim wrapper used by pre-assessment.js Stage 3.
 *
 * 2026-05-12 — Brief #22 author (me) coded the assessment expecting an
 * HM.tongue.mount(selector, opts) entry point, but the actual module
 * is HM.tongueCapture.open(opts) which only does the capture half (no
 * upload, no polling, no completion callback). This shim bridges the
 * two so Stage 3 can render an inline "Take Tongue Photo" button,
 * drive the existing tongue-capture modal, upload, poll for analysis,
 * then fire opts.onAssessed(diagnosis) when done.
 *
 * Load AFTER tongue-capture.js and api.js, BEFORE pre-assessment.js.
 *
 * Mirrors the upload + poll logic from assets/js/panels/patient/tongue.js
 * but renders inline into a host element rather than into the full
 * tongue panel.
 */
(function () {
  'use strict';
  window.HM = window.HM || {};
  HM.tongue = HM.tongue || {};

  HM.tongue.mount = function (selector, opts) {
    opts = opts || {};
    var host = typeof selector === 'string'
      ? document.querySelector(selector)
      : selector;
    if (!host) {
      console.warn('[HM.tongue.mount] host not found:', selector);
      return;
    }

    host.innerHTML =
      '<div style="text-align: center; padding: var(--s-4) 0;">' +
        '<button id="hm-tongue-mount-btn" class="btn btn--primary btn--lg">' +
          '<span lang="en">📷 Take Tongue Photo</span>' +
          '<span lang="zh"> · 拍摄舌头照片</span>' +
        '</button>' +
        '<div id="hm-tongue-mount-status" style="margin-top: var(--s-4); min-height: 24px;"></div>' +
      '</div>';

    host.querySelector('#hm-tongue-mount-btn').addEventListener('click', function () {
      if (!HM.tongueCapture || !HM.tongueCapture.open) {
        host.querySelector('#hm-tongue-mount-status').innerHTML =
          '<span style="color: var(--danger);">Tongue capture module not loaded. Please refresh.</span>';
        return;
      }
      HM.tongueCapture.open({
        onCapture: function (file) { handleUpload(file, host, opts); },
      });
    });
  };

  async function handleUpload(file, host, opts) {
    var status = host.querySelector('#hm-tongue-mount-status');
    var btn    = host.querySelector('#hm-tongue-mount-btn');
    if (btn) btn.disabled = true;
    status.innerHTML = '<span class="spinner"></span> Uploading photo · 正在上传…';

    try {
      var res = await HM.api.patient.uploadTongue(file);
      var diag = res.diagnosis;
      if (!diag) {
        status.innerHTML = '<span style="color: var(--danger);">Upload returned no diagnosis. Please try again.</span>';
        if (btn) btn.disabled = false;
        return;
      }
      if (diag.status === 'completed') {
        finish(diag, status, opts);
      } else if (diag.status === 'failed') {
        status.innerHTML = '<span style="color: var(--danger);">Analysis failed. Please try a different photo.</span>';
        if (btn) btn.disabled = false;
      } else {
        status.innerHTML = '<span class="spinner"></span> Analyzing tongue · 分析中…';
        pollForResult(diag.id, status, opts, btn);
      }
    } catch (err) {
      status.innerHTML = '<span style="color: var(--danger);">' +
        (err && err.message ? err.message : 'Upload failed') + '</span>';
      if (btn) btn.disabled = false;
    }
  }

  function pollForResult(id, status, opts, btn) {
    var attempts = 0;
    var interval = setInterval(async function () {
      attempts++;
      try {
        var res = await HM.api.patient.getDiagnosis(id);
        var diag = res.diagnosis;
        if (diag && diag.status === 'completed') {
          clearInterval(interval);
          finish(diag, status, opts);
        } else if ((diag && diag.status === 'failed') || attempts > 40) {
          clearInterval(interval);
          status.innerHTML = '<span style="color: var(--danger);">Analysis failed. Please try again.</span>';
          if (btn) btn.disabled = false;
        }
      } catch (_) { /* swallow transient errors; keep polling */ }
    }, 3000);
  }

  function finish(diag, status, opts) {
    status.innerHTML = '<span style="color: var(--success, #5a8a3a);">✓ Tongue analyzed — preparing follow-up questions…</span>';
    if (opts.onAssessed) {
      try { opts.onAssessed(diag); } catch (e) { console.error('[HM.tongue.mount] onAssessed handler threw:', e); }
    }
  }
})();
