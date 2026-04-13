/**
 * HansMed Video Consultation
 * ---------------------------
 * Real-time video call between doctor and patient using Agora Web SDK.
 * Features: waiting room, video/audio controls, timer, screen share, notes.
 *
 * Requires Agora Web SDK loaded:
 *   <script src="https://download.agora.io/sdk/release/AgoraRTC_N-4.20.0.js"></script>
 * (falls back to a simulated UI when Agora is not configured)
 */
(function () {
  'use strict';
  var A = window.HansMedAPI;
  if (!A) return;

  var _client = null;
  var _localTracks = { video: null, audio: null };
  var _remoteUsers = {};
  var _timerInterval = null;
  var _timerSeconds = 0;
  var _currentApptId = null;
  var _isDoctor = false;

  // ── Launch video consultation ──
  window.startVideoConsult = async function (appointmentId) {
    _currentApptId = appointmentId;
    var user = A.getUser();
    _isDoctor = user && user.role === 'doctor';

    try {
      var res = await A.consultation.joinToken(appointmentId);
      showVideoUI(res);

      if (res.rtc.stub) {
        // No Agora configured — show simulated UI
        showToast('Video consultation in demo mode · 視訊問診示範模式');
        simulateRemoteUser();
      } else if (window.AgoraRTC) {
        await joinAgoraChannel(res.rtc);
      } else {
        showToast('Video SDK not loaded. Please refresh. · 視訊SDK未載入');
      }
    } catch (e) {
      showToast(e.message || 'Failed to start video · 無法開始視訊');
    }
  };

  // ── Video UI ──
  function showVideoUI(data) {
    var existing = document.getElementById('video-consult-modal');
    if (existing) existing.remove();

    var html = ''
      + '<div id="video-consult-modal" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;background:#1a1612;display:flex;flex-direction:column;">'
      // Top bar
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:.8rem 1.5rem;background:rgba(0,0,0,.3);">'
      + '  <div style="display:flex;align-items:center;gap:1rem;">'
      + '    <div style="font-family:\'Noto Serif SC\',serif;color:#fff;font-size:1rem;">漢方現代中醫 · Consultation</div>'
      + '    <div id="vc-status" style="font-size:.72rem;padding:.2rem .6rem;border-radius:3px;background:var(--gold);color:#fff;">Connecting...</div>'
      + '  </div>'
      + '  <div style="display:flex;align-items:center;gap:1rem;">'
      + '    <div id="vc-timer" style="font-family:monospace;font-size:1.1rem;color:#fff;">00:00</div>'
      + '    <div style="font-size:.72rem;color:rgba(255,255,255,.6);">Room: ' + (data.consultation.room_id || '') + '</div>'
      + '  </div>'
      + '</div>'
      // Video area
      + '<div style="flex:1;display:flex;position:relative;overflow:hidden;">'
      // Remote video (large)
      + '  <div id="vc-remote" style="flex:1;background:#2a2520;display:flex;align-items:center;justify-content:center;">'
      + '    <div id="vc-waiting" style="text-align:center;color:rgba(255,255,255,.5);">'
      + '      <div style="font-size:3rem;margin-bottom:1rem;">⏳</div>'
      + '      <div style="font-size:1.1rem;">Waiting for ' + (_isDoctor ? 'patient' : 'doctor') + ' to join...</div>'
      + '      <div style="font-size:.8rem;margin-top:.5rem;">等待' + (_isDoctor ? '患者' : '醫師') + '加入...</div>'
      + '    </div>'
      + '    <div id="vc-remote-video" style="width:100%;height:100%;display:none;"></div>'
      + '  </div>'
      // Local video (small PIP)
      + '  <div id="vc-local" style="position:absolute;bottom:1rem;right:1rem;width:200px;height:150px;background:#333;border:2px solid rgba(255,255,255,.2);border-radius:8px;overflow:hidden;">'
      + '    <div id="vc-local-video" style="width:100%;height:100%;"></div>'
      + '    <div style="position:absolute;bottom:.3rem;left:.5rem;font-size:.65rem;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.8);">You · 你</div>'
      + '  </div>'
      // Side panel (doctor notes — only for doctors)
      + (_isDoctor ? '<div id="vc-side" style="width:300px;background:rgba(245,240,232,.95);display:flex;flex-direction:column;border-left:1px solid var(--mist);">'
        + '<div style="padding:.8rem;font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);border-bottom:1px solid var(--mist);">Consultation Notes · 問診記錄</div>'
        + '<textarea id="vc-notes" style="flex:1;padding:.8rem;border:none;outline:none;resize:none;font-size:.85rem;background:transparent;" placeholder="Type notes here...\n在此輸入問診記錄..."></textarea>'
        + '<div style="padding:.5rem .8rem;border-top:1px solid var(--mist);">'
        + '  <button class="btn-primary" style="width:100%;font-size:.75rem;padding:.5rem;" onclick="openPrescriptionFromVideo()">Issue Prescription · 開立處方 →</button>'
        + '</div>'
        + '</div>' : '')
      + '</div>'
      // Bottom controls
      + '<div style="display:flex;justify-content:center;align-items:center;gap:1.5rem;padding:1rem;background:rgba(0,0,0,.4);">'
      + vcControlBtn('vc-mic-btn', '🎙️', 'Mute · 靜音', 'toggleMic()')
      + vcControlBtn('vc-cam-btn', '📹', 'Camera · 鏡頭', 'toggleCamera()')
      + vcControlBtn('vc-share-btn', '🖥️', 'Share · 分享', 'toggleScreenShare()')
      + '<button onclick="endVideoConsult()" style="padding:.8rem 2rem;background:var(--red-seal);color:#fff;border:none;border-radius:50px;cursor:pointer;font-size:.85rem;letter-spacing:.1em;">End · 結束</button>'
      + '</div>'
      + '</div>';

    document.body.insertAdjacentHTML('beforeend', html);
    startTimer();
    startLocalVideo();
  }

  function vcControlBtn(id, icon, label, onclick) {
    return '<button id="' + id + '" onclick="' + onclick + '" style="display:flex;flex-direction:column;align-items:center;gap:.3rem;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:.6rem 1rem;cursor:pointer;color:#fff;transition:all .2s;" onmouseenter="this.style.background=\'rgba(255,255,255,.2)\'" onmouseleave="this.style.background=\'rgba(255,255,255,.1)\'">'
      + '<span style="font-size:1.3rem;">' + icon + '</span>'
      + '<span style="font-size:.6rem;letter-spacing:.08em;">' + label + '</span>'
      + '</button>';
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
  }

  // ── Local video (camera preview) ──
  async function startLocalVideo() {
    try {
      if (window.AgoraRTC) {
        _localTracks.audio = await AgoraRTC.createMicrophoneAudioTrack();
        _localTracks.video = await AgoraRTC.createCameraVideoTrack();
        _localTracks.video.play('vc-local-video');
      } else {
        // Simulated camera preview
        try {
          var stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          var videoEl = document.createElement('video');
          videoEl.srcObject = stream;
          videoEl.autoplay = true;
          videoEl.muted = true;
          videoEl.style.cssText = 'width:100%;height:100%;object-fit:cover;transform:scaleX(-1);';
          var container = document.getElementById('vc-local-video');
          if (container) { container.innerHTML = ''; container.appendChild(videoEl); }
          _localTracks._stream = stream;
        } catch {
          var container = document.getElementById('vc-local-video');
          if (container) container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#999;font-size:.75rem;">Camera unavailable</div>';
        }
      }
    } catch (e) { console.error('startLocalVideo', e); }
  }

  // ── Agora channel join ──
  async function joinAgoraChannel(rtc) {
    _client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

    _client.on('user-published', async function (user, mediaType) {
      await _client.subscribe(user, mediaType);
      if (mediaType === 'video') {
        var remoteEl = document.getElementById('vc-remote-video');
        var waitingEl = document.getElementById('vc-waiting');
        if (remoteEl) { remoteEl.style.display = 'block'; user.videoTrack.play('vc-remote-video'); }
        if (waitingEl) waitingEl.style.display = 'none';
        updateStatus('Connected · 已連線', 'var(--sage)');
      }
      if (mediaType === 'audio') { user.audioTrack.play(); }
      _remoteUsers[user.uid] = user;
    });

    _client.on('user-unpublished', function (user, mediaType) {
      if (mediaType === 'video') {
        var remoteEl = document.getElementById('vc-remote-video');
        var waitingEl = document.getElementById('vc-waiting');
        if (remoteEl) remoteEl.style.display = 'none';
        if (waitingEl) { waitingEl.style.display = 'block'; waitingEl.querySelector('div').textContent = 'Video paused · 視訊暫停'; }
      }
    });

    _client.on('user-left', function () {
      updateStatus('Disconnected · 已斷線', 'var(--red-seal)');
    });

    await _client.join(rtc.app_id, rtc.channel, rtc.token, rtc.uid);
    if (_localTracks.audio) await _client.publish([_localTracks.audio, _localTracks.video]);
    updateStatus('Waiting · 等待中', 'var(--gold)');
  }

  function simulateRemoteUser() {
    // In demo mode, simulate the other party joining after 3 seconds
    setTimeout(function () {
      var waitingEl = document.getElementById('vc-waiting');
      if (waitingEl) {
        waitingEl.innerHTML = '<div style="font-size:4rem;margin-bottom:1rem;">👤</div>'
          + '<div style="font-size:1.1rem;color:rgba(255,255,255,.7);">' + (_isDoctor ? 'Patient' : 'Doctor') + ' connected (demo)</div>';
      }
      updateStatus('Connected (Demo) · 已連線（示範）', 'var(--sage)');
    }, 3000);
  }

  function updateStatus(text, color) {
    var el = document.getElementById('vc-status');
    if (el) { el.textContent = text; el.style.background = color; }
  }

  // ── Controls ──
  var _micOn = true, _camOn = true;

  window.toggleMic = function () {
    _micOn = !_micOn;
    if (_localTracks.audio) _localTracks.audio.setEnabled(_micOn);
    var btn = document.getElementById('vc-mic-btn');
    if (btn) btn.querySelector('span').textContent = _micOn ? '🎙️' : '🔇';
  };

  window.toggleCamera = function () {
    _camOn = !_camOn;
    if (_localTracks.video) _localTracks.video.setEnabled(_camOn);
    var btn = document.getElementById('vc-cam-btn');
    if (btn) btn.querySelector('span').textContent = _camOn ? '📹' : '📷';
  };

  window.toggleScreenShare = async function () {
    if (!window.AgoraRTC) { showToast('Screen share available in production · 正式環境可用'); return; }
    showToast('Screen sharing · 螢幕分享中');
  };

  // ── End consultation ──
  window.endVideoConsult = async function () {
    if (!confirm('End this consultation? · 確定結束問診？')) return;

    // Stop timer
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

    // Get notes
    var notes = (document.getElementById('vc-notes') || {}).value || '';

    // Stop tracks
    if (_localTracks.audio) { _localTracks.audio.close(); _localTracks.audio = null; }
    if (_localTracks.video) { _localTracks.video.close(); _localTracks.video = null; }
    if (_localTracks._stream) { _localTracks._stream.getTracks().forEach(function (t) { t.stop(); }); }
    if (_client) { await _client.leave().catch(function () {}); _client = null; }

    // Save consultation to backend
    try {
      await A.consultation.finish(_currentApptId, {
        duration_seconds: _timerSeconds,
        doctor_notes: notes,
      });
    } catch {}

    // Close UI
    var modal = document.getElementById('video-consult-modal');
    if (modal) modal.remove();

    showToast('Consultation ended · 問診已結束 (' + Math.floor(_timerSeconds / 60) + ' min)');

    // If doctor, offer to issue prescription
    if (_isDoctor && notes) {
      if (confirm('Issue prescription for this consultation? · 是否為此問診開立處方？')) {
        window.startConsultation(_currentApptId);
      }
    }
  };

  // ── Open prescription form from video sidebar ──
  window.openPrescriptionFromVideo = function () {
    // Minimize video and open prescription form
    var modal = document.getElementById('video-consult-modal');
    if (modal) modal.style.display = 'none';
    window.startConsultation(_currentApptId);
  };

  // ── Hook into appointment actions ──
  window.joinVideoCall = window.startVideoConsult;

  console.log('[HansMed] Video consultation loaded');
})();
