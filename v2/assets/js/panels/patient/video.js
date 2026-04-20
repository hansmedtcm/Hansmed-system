/**
 * Video Consultation — embedded Jitsi
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  async function render(el, appointmentId) {
    HM.state.loading(el);
    try {
      // Pick provider — admin-controlled at /public/features.
      var features = {};
      try { features = await HM.api.publicFeatures(); } catch (_) {}
      var provider = (features && features.video_provider) || 'jitsi';

      // For Google Meet we need the doctor's pasted URL from the
      // appointment record. Fetch it via the patient appointments
      // list (we don't have a single-appt endpoint on patient side).
      var meetingUrl = null;
      if (provider === 'google_meet') {
        try {
          var apptRes = await HM.api.patient.listAppointments();
          var match = (apptRes.data || []).find(function (x) { return x.id == appointmentId; });
          if (match) meetingUrl = match.meeting_url || null;
        } catch (_) {}
      }

      var user = HM.auth.user();
      var displayName = HM.auth.displayName(user);

      // ── Google Meet path: doctor pastes URL, patient sees Join button ──
      if (provider === 'google_meet') {
        var hdr = '<div class="page-header">' +
          '<button class="btn btn--ghost" onclick="location.hash=\'#/appointments\'">← Back</button>' +
          '</div>';
        if (! meetingUrl) {
          el.innerHTML = hdr +
            '<div class="alert alert--warning"><div class="alert-icon">⏳</div><div class="alert-body">' +
            '<div class="alert-title">Doctor hasn\'t shared the meeting link yet · 醫師尚未提供會議連結</div>' +
            'Please refresh in a moment. The doctor will paste the Google Meet URL when they start the consultation. ' +
            '<span style="font-family: var(--font-zh);">請稍後重新整理，醫師將於開始時提供連結。</span>' +
            '<div class="mt-3"><button class="btn btn--outline" onclick="HM.patientPanels.video.render(document.getElementById(\'panel-container\'), ' + appointmentId + ')">↻ Refresh · 重新整理</button></div>' +
            '</div></div>';
          return;
        }
        el.innerHTML = hdr +
          '<div class="card card--pad-lg" style="text-align:center;max-width: 720px;background:linear-gradient(135deg,rgba(74,144,217,.05),rgba(255,255,255,.5));">' +
          '<div style="font-size:4rem;margin-bottom:var(--s-3);">📹</div>' +
          '<h2 class="mb-2">Google Meet · Google 視訊</h2>' +
          '<p class="text-muted mb-4">Click below to join the consultation in a new tab. ' +
          '<span style="font-family: var(--font-zh);">點擊下方按鈕於新分頁加入問診。</span></p>' +
          '<a href="' + HM.format.esc(meetingUrl) + '" target="_blank" rel="noopener" class="btn btn--primary btn--lg" style="font-size:var(--text-lg);padding:var(--s-3) var(--s-5);">' +
          '▶ Join Google Meet · 加入會議</a>' +
          '<div class="text-xs text-muted mt-3" style="font-family: var(--font-mono); word-break: break-all;">' + HM.format.esc(meetingUrl) + '</div>' +
          '<div class="flex flex-gap-2 mt-4" style="justify-content:center;">' +
          '<button class="btn btn--outline btn--sm" onclick="HM.patientPanels.video._copyLink(\'' + meetingUrl.replace(/'/g, "\\'") + '\')">📋 Copy Link</button>' +
          '<button class="btn btn--danger btn--sm" id="end-call">End Consultation · 結束</button>' +
          '</div>' +
          '</div>';

        document.getElementById('end-call').addEventListener('click', async function () {
          var ok = await HM.ui.confirm('End this consultation? · 確定結束？', { danger: true });
          if (!ok) return;
          try { await HM.api.consultation.finish(appointmentId, { duration_seconds: 0 }); } catch (_) {}
          location.hash = '#/appointments';
        });
        return;
      }

      // ── Default: embedded Jitsi ──
      var rtc = {};
      try {
        var res = await HM.api.consultation.joinToken(appointmentId);
        rtc = res.rtc || {};
      } catch (e) {
        console.warn('joinToken failed, falling back:', e.message);
      }

      var roomName = rtc.channel || ('HansMed-Consult-' + appointmentId);
      var domain = (features && features.jitsi_domain) || HM.config.JITSI_DOMAIN || 'meet.jit.si';
      var jitsiUrl = 'https://' + domain + '/' + encodeURIComponent(roomName) +
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
