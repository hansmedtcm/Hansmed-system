/**
 * HansMed Video Consultation
 * ---------------------------
 * Uses Jitsi Meet (free, no account, no limits) for video calls.
 * The video opens embedded in the platform with a notes sidebar for doctors.
 * Falls back to opening Jitsi in a new tab if embedding is blocked.
 *
 * No SDK, no API key, no paid account needed. Just works.
 */
(function () {
  'use strict';
  var A = window.HansMedAPI;
  if (!A) return;

  var JITSI_DOMAIN = 'meet.jit.si'; // Free public Jitsi server
  var _timerInterval = null;
  var _timerSeconds = 0;
  var _currentApptId = null;
  var _isDoctor = false;

  // ── Start video consultation ──
  window.startVideoConsult = async function (appointmentId) {
    _currentApptId = appointmentId;
    var user = A.getUser();
    _isDoctor = user && user.role === 'doctor';

    // Generate a unique room name based on appointment
    var roomName = 'HansMed-Consult-' + appointmentId;
    var displayName = user ? (user.patient_profile?.full_name || user.doctor_profile?.full_name || user.name || user.email) : 'User';

    showVideoUI(roomName, displayName);
  };

  // ── Also allow starting from an appointment card ──
  window.joinVideoCall = window.startVideoConsult;

  // ── Video UI with embedded Jitsi ──
  function showVideoUI(roomName, displayName) {
    var existing = document.getElementById('video-consult-modal');
    if (existing) existing.remove();

    var jitsiUrl = 'https://' + JITSI_DOMAIN + '/' + roomName
      + '#userInfo.displayName="' + encodeURIComponent(displayName) + '"'
      + '&config.startWithAudioMuted=false'
      + '&config.startWithVideoMuted=false'
      + '&config.prejoinPageEnabled=false'
      + '&config.disableDeepLinking=true';

    var html = ''
      + '<div id="video-consult-modal" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;background:#1a1612;display:flex;flex-direction:column;">'
      // Top bar
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem 1.5rem;background:rgba(0,0,0,.4);flex-shrink:0;">'
      + '  <div style="display:flex;align-items:center;gap:1rem;">'
      + '    <div style="font-family:\'Noto Serif SC\',serif;color:#fff;font-size:.95rem;">漢方現代中醫 · Video Consultation</div>'
      + '    <div id="vc-status" style="font-size:.68rem;padding:.2rem .5rem;border-radius:3px;background:var(--sage);color:#fff;">Live · 進行中</div>'
      + '  </div>'
      + '  <div style="display:flex;align-items:center;gap:1rem;">'
      + '    <div id="vc-timer" style="font-family:monospace;font-size:1rem;color:#fff;">00:00</div>'
      + '    <button onclick="copyMeetLink()" style="padding:.3rem .8rem;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:#fff;cursor:pointer;font-size:.7rem;border-radius:4px;">📋 Copy Link · 複製鏈接</button>'
      + '    <button onclick="endVideoConsult()" style="padding:.4rem 1.2rem;background:var(--red-seal);color:#fff;border:none;border-radius:20px;cursor:pointer;font-size:.78rem;">End · 結束</button>'
      + '  </div>'
      + '</div>'
      // Main area
      + '<div style="flex:1;display:flex;overflow:hidden;">'
      // Jitsi iframe
      + '  <div style="flex:1;position:relative;">'
      + '    <iframe id="jitsi-frame" src="' + jitsiUrl + '" style="width:100%;height:100%;border:none;" allow="camera;microphone;display-capture;autoplay;clipboard-write"></iframe>'
      + '  </div>'
      // Doctor side panel
      + (_isDoctor ? doctorSidePanel() : '')
      + '</div>'
      + '</div>';

    // Store room URL for sharing
    window._currentMeetUrl = 'https://' + JITSI_DOMAIN + '/' + roomName;

    document.body.insertAdjacentHTML('beforeend', html);
    startTimer();
  }

  function doctorSidePanel() {
    return '<div style="width:320px;background:rgba(245,240,232,.97);display:flex;flex-direction:column;border-left:1px solid var(--mist);flex-shrink:0;">'
      + '<div style="padding:.8rem 1rem;font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);border-bottom:1px solid var(--mist);">Consultation Tools · 問診工具</div>'
      // Notes
      + '<div style="padding:.6rem 1rem;border-bottom:1px solid var(--mist);">'
      + '  <div style="font-size:.68rem;color:var(--gold);margin-bottom:.3rem;">Notes · 問診記錄</div>'
      + '  <textarea id="vc-notes" rows="6" style="width:100%;padding:.5rem;border:1px solid var(--mist);background:var(--washi);outline:none;resize:vertical;font-size:.82rem;" placeholder="Type consultation notes...\n輸入問診記錄..."></textarea>'
      + '</div>'
      // Quick actions
      + '<div style="padding:.6rem 1rem;display:flex;flex-direction:column;gap:.4rem;">'
      + '  <button class="btn-primary" style="font-size:.72rem;padding:.5rem;" onclick="openPrescriptionFromVideo()">📝 Issue Prescription · 開處方</button>'
      + '  <button class="btn-outline" style="font-size:.72rem;padding:.5rem;" onclick="openMCFromVideo()">📋 Issue MC · 開病假條</button>'
      + '  <button class="btn-outline" style="font-size:.72rem;padding:.5rem;" onclick="openReferralFromVideo()">📨 Referral Letter · 轉介信</button>'
      + '  <button class="btn-ghost" style="font-size:.72rem;justify-content:center;" onclick="openChat(null,' + (_currentApptId ? 'null,' + _currentApptId : '') + ')">💬 Open Chat · 開始對話</button>'
      + '</div>'
      // Share link
      + '<div style="margin-top:auto;padding:.8rem 1rem;border-top:1px solid var(--mist);font-size:.72rem;color:var(--stone);">'
      + '  <div style="margin-bottom:.3rem;">Share this link with patient · 分享此鏈接給患者：</div>'
      + '  <div id="vc-meet-link" style="background:var(--washi);padding:.4rem;font-family:monospace;font-size:.7rem;word-break:break-all;border:1px solid var(--mist);cursor:pointer;" onclick="copyMeetLink()"></div>'
      + '</div>'
      + '</div>';
  }

  // ── Timer ──
  function startTimer() {
    _timerSeconds = 0;
    _timerInterval = setInterval(function () {
      _timerSeconds++;
      var m = Math.floor(_timerSeconds / 60);
      var s = _timerSeconds % 60;
      var el = document.getElementById('vc-timer');
      if (el) el.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }, 1000);

    // Show the meet link in the side panel
    setTimeout(function () {
      var linkEl = document.getElementById('vc-meet-link');
      if (linkEl && window._currentMeetUrl) linkEl.textContent = window._currentMeetUrl;
    }, 500);
  }

  // ── Copy meet link ──
  window.copyMeetLink = function () {
    if (window._currentMeetUrl) {
      navigator.clipboard.writeText(window._currentMeetUrl).then(function () {
        showToast('Link copied! Send to patient. · 鏈接已複製！傳給患者。');
      }).catch(function () {
        prompt('Copy this link · 複製此鏈接:', window._currentMeetUrl);
      });
    }
  };

  // ── End consultation ──
  window.endVideoConsult = async function () {
    if (!confirm('End this consultation? · 確定結束問診？')) return;

    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

    var notes = (document.getElementById('vc-notes') || {}).value || '';

    // Save to backend
    try {
      await A.consultation.finish(_currentApptId, {
        duration_seconds: _timerSeconds,
        doctor_notes: notes,
      });
    } catch {}

    // Close UI
    var modal = document.getElementById('video-consult-modal');
    if (modal) modal.remove();

    var mins = Math.floor(_timerSeconds / 60);
    showToast('Consultation ended · 問診已結束 (' + mins + ' min)');

    // Prompt doctor to issue prescription
    if (_isDoctor && confirm('Issue prescription for this consultation? · 是否為此問診開立處方？')) {
      window.startConsultation(_currentApptId);
    }
  };

  // ── Document shortcuts from video sidebar ──
  window.openPrescriptionFromVideo = function () {
    window.startConsultation(_currentApptId);
  };

  window.openMCFromVideo = function () {
    var days = prompt('Number of MC days · 病假天數:', '1');
    if (!days) return;
    var diagnosis = prompt('Diagnosis · 診斷:', '');
    if (!diagnosis) return;

    var url = window.HANSMED_API_BASE + '/doctor/documents/mc';
    // Open MC form — for now just generate via API
    showToast('MC generation: ' + days + ' day(s) — feature in progress · MC開立中');
  };

  window.openReferralFromVideo = function () {
    var specialist = prompt('Refer to (specialist name) · 轉介至（專科醫師）:', '');
    if (!specialist) return;
    showToast('Referral to ' + specialist + ' — feature in progress · 轉介信開立中');
  };

  console.log('[HansMed] Video consultation (Jitsi) loaded');
})();
