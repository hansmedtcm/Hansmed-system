/**
 * Tongue Capture — photo capture with alignment-frame overlay.
 *
 * Used by both the patient AI-diagnosis step and the standalone tongue
 * scan panel. Presents a tongue-shaped outline the user must position
 * their tongue inside, dramatically improving AI classification accuracy
 * by enforcing consistent framing, distance, and orientation.
 *
 * Two capture modes:
 *   1. Live camera (getUserMedia) — user sees a real-time preview with
 *      the outline overlaid, taps the shutter to snapshot.
 *   2. File upload fallback — user picks/takes a photo with the native
 *      picker; we then show it with the outline overlaid so they can
 *      verify alignment or retake.
 *
 * Usage:
 *   HM.tongueCapture.open({
 *     onCapture: function (fileOrBlob, dataUrl) { ... },
 *     onCancel:  function () { ... },
 *   });
 *
 * Caller receives a File / Blob ready to POST via uploadTongue().
 */
(function () {
  'use strict';
  window.HM = window.HM || {};

  var activeModal = null;
  var mediaStream = null;

  function open(opts) {
    opts = opts || {};
    close(); // always start fresh
    injectStyles();

    activeModal = HM.ui.modal({
      size: 'md',
      title: '📷 Tongue Photo · 舌頭照片',
      content: buildShell(),
      onClose: function () { stopStream(); activeModal = null; },
    });

    wireHandlers(activeModal.element, opts);
    // Default to live camera view — if the user's browser doesn't grant
    // permission we'll auto-fall back to the file picker.
    tryStartCamera(activeModal.element, opts);
  }

  function close() {
    stopStream();
    if (activeModal) {
      try { activeModal.close(); } catch (_) {}
      activeModal = null;
    }
  }

  function buildShell() {
    return (
      '<div class="tc-wrap">' +
        // Tips strip above the viewfinder
        '<div class="tc-tips">' +
          '<span>舌體放鬆 Relax tongue</span><span>·</span>' +
          '<span>舌面平展 Flatten surface</span><span>·</span>' +
          '<span>舌尖略向下 Tip slightly down</span><span>·</span>' +
          '<span>不用力 Don\'t strain</span>' +
        '</div>' +

        // Stage — holds the live video / preview img + overlay
        '<div class="tc-stage" id="tc-stage">' +
          '<video id="tc-video" class="tc-media" autoplay playsinline muted></video>' +
          '<img id="tc-preview" class="tc-media" alt="" style="display:none;">' +
          '<canvas id="tc-canvas" style="display:none;"></canvas>' +
          tongueOverlaySvg() +
          '<div class="tc-hint" id="tc-hint">將舌頭對準框內 · Place tongue inside the frame</div>' +
          '<div class="tc-loading" id="tc-loading" style="display:none;"><div class="tc-spinner"></div>Starting camera…</div>' +
        '</div>' +

        // Controls — swap between capture / re-take states
        '<div class="tc-controls" id="tc-controls">' +
          // Capture mode controls
          '<div class="tc-mode tc-mode--capture" data-mode="capture">' +
            '<button type="button" class="btn btn--ghost btn--sm" id="tc-switch-upload">🖼 Upload Instead · 改為上傳</button>' +
            '<button type="button" class="tc-shutter" id="tc-shutter" title="Take photo"></button>' +
            '<button type="button" class="btn btn--ghost btn--sm" id="tc-flip">🔄 Flip Camera · 翻轉</button>' +
          '</div>' +
          // Upload mode controls (native file picker)
          '<div class="tc-mode tc-mode--upload" data-mode="upload" style="display:none;">' +
            '<label class="btn btn--primary btn--block" style="cursor:pointer;">' +
              '📷 Take or Choose Photo · 拍攝或選擇照片' +
              '<input type="file" id="tc-file" accept="image/*" capture="environment" style="display:none;">' +
            '</label>' +
            '<button type="button" class="btn btn--ghost btn--sm mt-2" id="tc-switch-camera">📹 Use Live Camera · 使用攝像頭</button>' +
          '</div>' +
          // Preview mode controls (after capture/upload)
          '<div class="tc-mode tc-mode--preview" data-mode="preview" style="display:none;">' +
            '<button type="button" class="btn btn--ghost" id="tc-retake">↺ Retake · 重拍</button>' +
            '<button type="button" class="btn btn--primary" id="tc-confirm">✓ Use This Photo · 使用此照片 →</button>' +
          '</div>' +
        '</div>' +

        '<p class="tc-footnote">Your tongue should fill most of the outline, with the tip pointing down and the surface visible. ' +
        '<span style="font-family: var(--font-zh);">舌頭盡量填滿輪廓，舌尖向下，露出整個舌面。</span></p>' +
      '</div>'
    );
  }

  /**
   * Stylised tongue-shaped frame overlay. Broader at the base, tapering
   * toward the tip, drawn as a single rounded SVG path. Positioned
   * absolutely inside the stage so it overlays video + preview alike.
   */
  function tongueOverlaySvg() {
    return (
      '<svg class="tc-overlay" viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<defs>' +
          '<filter id="tc-glow" x="-20%" y="-20%" width="140%" height="140%">' +
            '<feGaussianBlur stdDeviation="3" result="blur"/>' +
            '<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>' +
          '</filter>' +
        '</defs>' +
        // Outer lips / face mask cutout — lighter stroke
        '<path d="M 40 70 Q 40 40 80 35 Q 150 25 220 35 Q 260 40 260 70 ' +
               'Q 260 130 250 180 Q 240 260 210 330 Q 180 380 150 385 ' +
               'Q 120 380 90 330 Q 60 260 50 180 Q 40 130 40 70 Z" ' +
          'fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2.5" filter="url(#tc-glow)"/>' +
        // Inner tongue-body guideline
        '<path d="M 75 100 Q 75 85 110 80 Q 150 75 190 80 Q 225 85 225 100 ' +
               'Q 225 155 218 200 Q 210 265 190 310 Q 170 345 150 350 ' +
               'Q 130 345 110 310 Q 90 265 82 200 Q 75 155 75 100 Z" ' +
          'fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.85)" stroke-width="2" filter="url(#tc-glow)"/>' +
        // Midline hint
        '<path d="M 150 95 L 150 340" stroke="rgba(255,255,255,0.35)" stroke-width="1" stroke-dasharray="4 6"/>' +
        // Corner crop marks
        '<g stroke="rgba(255,255,255,0.7)" stroke-width="2.5" fill="none">' +
          '<path d="M 30 60 L 30 40 L 50 40"/>' +
          '<path d="M 270 60 L 270 40 L 250 40"/>' +
          '<path d="M 30 340 L 30 360 L 50 360"/>' +
          '<path d="M 270 340 L 270 360 L 250 360"/>' +
        '</g>' +
      '</svg>'
    );
  }

  function wireHandlers(root, opts) {
    var video     = root.querySelector('#tc-video');
    var preview   = root.querySelector('#tc-preview');
    var canvas    = root.querySelector('#tc-canvas');
    var shutter   = root.querySelector('#tc-shutter');
    var fileInput = root.querySelector('#tc-file');

    shutter.addEventListener('click', function () { snapshotFromVideo(root, opts); });

    fileInput.addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      showPreviewFromFile(root, f);
    });

    root.querySelector('#tc-switch-upload').addEventListener('click', function () {
      stopStream();
      setMode(root, 'upload');
    });
    root.querySelector('#tc-switch-camera').addEventListener('click', function () {
      setMode(root, 'capture');
      tryStartCamera(root, opts);
    });
    root.querySelector('#tc-retake').addEventListener('click', function () {
      preview.src = '';
      preview.style.display = 'none';
      root._capturedBlob = null;
      // Go back to whichever input the user last used
      if (root._lastMode === 'upload') {
        setMode(root, 'upload');
      } else {
        setMode(root, 'capture');
        tryStartCamera(root, opts);
      }
    });
    root.querySelector('#tc-flip').addEventListener('click', function () {
      root._facingMode = root._facingMode === 'user' ? 'environment' : 'user';
      tryStartCamera(root, opts);
    });
    root.querySelector('#tc-confirm').addEventListener('click', function () {
      if (!root._capturedBlob) return;
      // Convert Blob → File so the existing uploadTongue(file) signature works
      var file = root._capturedBlob instanceof File
        ? root._capturedBlob
        : new File([root._capturedBlob], 'tongue.jpg', { type: root._capturedBlob.type || 'image/jpeg' });
      if (opts.onCapture) opts.onCapture(file, preview.src || '');
      close();
    });
  }

  function setMode(root, mode) {
    root.querySelectorAll('.tc-mode').forEach(function (el) {
      el.style.display = el.getAttribute('data-mode') === mode ? 'flex' : 'none';
    });
    var stage = root.querySelector('#tc-stage');
    stage.classList.toggle('tc-stage--preview', mode === 'preview');
  }

  async function tryStartCamera(root, opts) {
    stopStream();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMode(root, 'upload');
      HM.ui.toast('Camera not available — please upload a photo instead', 'info');
      return;
    }
    setMode(root, 'capture');
    var video = root.querySelector('#tc-video');
    var loading = root.querySelector('#tc-loading');
    var facing = root._facingMode || 'environment';
    loading.style.display = 'flex';
    try {
      var stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      mediaStream = stream;
      video.srcObject = stream;
      video.style.display = 'block';
      root.querySelector('#tc-preview').style.display = 'none';
      loading.style.display = 'none';
      root._lastMode = 'capture';
    } catch (e) {
      loading.style.display = 'none';
      setMode(root, 'upload');
      // Quietly fall back — no need to alarm the user
      console.warn('camera access denied / failed:', e && e.message);
    }
  }

  function snapshotFromVideo(root, opts) {
    var video = root.querySelector('#tc-video');
    var canvas = root.querySelector('#tc-canvas');
    var preview = root.querySelector('#tc-preview');
    if (!video.videoWidth) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(function (blob) {
      root._capturedBlob = blob;
      var url = URL.createObjectURL(blob);
      preview.src = url;
      preview.style.display = 'block';
      video.style.display = 'none';
      stopStream();
      setMode(root, 'preview');
      root._lastMode = 'capture';
    }, 'image/jpeg', 0.92);
  }

  function showPreviewFromFile(root, file) {
    var preview = root.querySelector('#tc-preview');
    var reader = new FileReader();
    reader.onload = function (e) {
      preview.src = e.target.result;
      preview.style.display = 'block';
      root.querySelector('#tc-video').style.display = 'none';
      root._capturedBlob = file;
      stopStream();
      setMode(root, 'preview');
      root._lastMode = 'upload';
    };
    reader.readAsDataURL(file);
  }

  function stopStream() {
    if (mediaStream) {
      try { mediaStream.getTracks().forEach(function (t) { t.stop(); }); } catch (_) {}
      mediaStream = null;
    }
  }

  function injectStyles() {
    if (document.getElementById('tc-style')) return;
    var s = document.createElement('style');
    s.id = 'tc-style';
    s.textContent =
      '.tc-wrap{display:flex;flex-direction:column;gap:var(--s-3);}' +
      '.tc-tips{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;font-size:11px;color:var(--stone);padding:6px 10px;background:var(--washi);border-radius:var(--r-sm);}' +
      '.tc-stage{position:relative;width:100%;aspect-ratio:3/4;background:#0c0c0c;border-radius:var(--r-md);overflow:hidden;}' +
      '.tc-media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;}' +
      '.tc-overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}' +
      '.tc-hint{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.55);color:#fff;font-size:11px;padding:4px 10px;border-radius:999px;letter-spacing:.08em;white-space:nowrap;}' +
      '.tc-stage--preview .tc-hint{background:rgba(45,106,79,0.85);}' +
      '.tc-loading{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--s-2);color:#fff;background:rgba(0,0,0,0.55);font-size:13px;}' +
      '.tc-spinner{width:32px;height:32px;border:3px solid rgba(255,255,255,0.25);border-top-color:#fff;border-radius:50%;animation:tc-spin 0.8s linear infinite;}' +
      '@keyframes tc-spin{to{transform:rotate(360deg);}}' +
      '.tc-controls{display:flex;flex-direction:column;gap:var(--s-2);}' +
      '.tc-mode{display:flex;align-items:center;justify-content:space-between;gap:var(--s-3);}' +
      '.tc-shutter{width:64px;height:64px;border-radius:50%;background:#fff;border:4px solid rgba(255,255,255,0.35);box-shadow:0 0 0 3px var(--gold),0 4px 14px rgba(0,0,0,0.25);cursor:pointer;padding:0;transition:transform .1s ease;}' +
      '.tc-shutter:active{transform:scale(0.92);}' +
      '.tc-mode[data-mode="upload"]{flex-direction:column;align-items:stretch;}' +
      '.tc-mode[data-mode="preview"]{justify-content:space-between;}' +
      '.tc-footnote{font-size:11px;color:var(--stone);text-align:center;line-height:1.5;margin:0;}';
    document.head.appendChild(s);
  }

  HM.tongueCapture = { open: open, close: close };
})();
