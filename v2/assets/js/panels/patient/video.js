/**
 * Video Consultation — embedded Jitsi
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  async function render(el, appointmentId) {
    HM.state.loading(el);
    try {
      // Try to fetch a proper join token. Degrade gracefully if the backend
      // refuses — Jitsi can still host the call with a deterministic room.
      var rtc = {};
      try {
        var res = await HM.api.consultation.joinToken(appointmentId);
        rtc = res.rtc || {};
      } catch (e) {
        console.warn('joinToken failed, falling back:', e.message);
      }

      var user = HM.auth.user();
      var displayName = HM.auth.displayName(user);
      var roomName = rtc.channel || ('HansMed-Consult-' + appointmentId);

      var jitsiUrl = 'https://' + HM.config.JITSI_DOMAIN + '/' + encodeURIComponent(roomName) +
        '#userInfo.displayName="' + encodeURIComponent(displayName) + '"' +
        '&config.prejoinPageEnabled=false' +
        '&config.disableDeepLinking=true';

      el.innerHTML = '<div class="page-header">' +
        '<button class="btn btn--ghost" onclick="location.hash=\'#/appointments\'">← Back</button>' +
        '</div>' +
        '<div class="alert alert--info mb-4">' +
        '<div class="alert-icon">📹</div>' +
        '<div class="alert-body">' +
        '<div class="alert-title">Video Consultation Ready · 視訊問診就緒</div>' +
        'Please allow camera and microphone access when prompted. If the video doesn\'t load below, <a href="' + jitsiUrl + '" target="_blank">open in new tab</a>.' +
        '</div></div>' +
        '<div style="aspect-ratio: 16/9; background: var(--ink); border-radius: var(--r-md); overflow: hidden; max-width: 1000px;">' +
        '<iframe src="' + HM.format.esc(jitsiUrl) + '" style="width:100%;height:100%;border:none;" allow="camera;microphone;display-capture;autoplay"></iframe>' +
        '</div>' +
        '<div class="mt-4" style="max-width: 1000px;">' +
        '<div class="flex flex-gap-3">' +
        '<button class="btn btn--outline" onclick="HM.patientPanels.video._copyLink(\'' + jitsiUrl.replace(/'/g, "\\'") + '\')">📋 Copy Link</button>' +
        '<button class="btn btn--danger" id="end-call">End Consultation · 結束</button>' +
        '</div>' +
        '</div>';

      document.getElementById('end-call').addEventListener('click', async function () {
        var ok = await HM.ui.confirm('End this consultation? · 確定結束？', { danger: true });
        if (!ok) return;
        try {
          await HM.api.consultation.finish(appointmentId, { duration_seconds: 0 });
        } catch {}
        location.hash = '#/appointments';
      });
    } catch (e) {
      HM.state.error(el, e);
    }
  }

  HM.patientPanels.video = {
    render: render,
    _copyLink: function (url) {
      navigator.clipboard.writeText(url).then(function () {
        HM.ui.toast('Link copied! · 鏈接已複製', 'success');
      });
    },
  };
})();
