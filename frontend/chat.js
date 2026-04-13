/**
 * HansMed Chat System
 * --------------------
 * In-app messaging between patient and doctor.
 * Features: thread list, real-time polling, image sharing, read receipts.
 */
(function () {
  'use strict';
  var A = window.HansMedAPI;
  if (!A) return;

  var _currentThreadId = null;
  var _pollInterval = null;
  var _lastMessageId = 0;

  // ── Open chat window ──
  window.openChat = async function (doctorId, patientId, appointmentId) {
    try {
      var payload = {};
      if (doctorId) payload.doctor_id = doctorId;
      if (patientId) payload.patient_id = patientId;
      if (appointmentId) payload.appointment_id = appointmentId;

      var res = await A.api.post('/chat/thread', payload);
      _currentThreadId = res.thread.id;
      showChatWindow(res.thread);
      loadMessages(_currentThreadId);
      startPolling();
    } catch (e) { showToast(e.message || 'Failed to open chat'); }
  };

  // ── Chat threads list (for portal) ──
  window.loadChatThreads = async function (containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    try {
      var res = await A.api.get('/chat/threads');
      var threads = res.threads || [];
      if (!threads.length) {
        el.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--stone);">No conversations yet · 暫無對話</div>';
        return;
      }
      el.innerHTML = threads.map(function (t) {
        var last = t.last_message;
        var user = A.getUser();
        var otherLabel = user && user.role === 'patient' ? 'Doctor #' + t.doctor_id : 'Patient #' + t.patient_id;
        return '<div onclick="openChatThread(' + t.id + ')" style="padding:.8rem;border-bottom:1px solid var(--mist);cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:background .2s;" onmouseenter="this.style.background=\'var(--washi)\'" onmouseleave="this.style.background=\'transparent\'">'
          + '<div>'
          + '  <div style="font-size:.9rem;color:var(--ink);">' + otherLabel + '</div>'
          + '  <div style="font-size:.78rem;color:var(--stone);margin-top:.2rem;">' + (last ? truncate(last.message, 50) : 'No messages') + '</div>'
          + '</div>'
          + '<div style="text-align:right;">'
          + (t.unread_count > 0 ? '<div style="background:var(--red-seal);color:#fff;font-size:.6rem;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;">' + t.unread_count + '</div>' : '')
          + '<div style="font-size:.65rem;color:var(--stone);margin-top:.2rem;">' + (last ? timeAgo(last.created_at) : '') + '</div>'
          + '</div>'
          + '</div>';
      }).join('');
    } catch {}
  };

  window.openChatThread = function (threadId) {
    _currentThreadId = threadId;
    var thread = { id: threadId };
    showChatWindow(thread);
    loadMessages(threadId);
    startPolling();
  };

  // ── Chat Window UI ──
  function showChatWindow(thread) {
    var existing = document.getElementById('chat-window');
    if (existing) existing.remove();

    var html = ''
      + '<div id="chat-window" style="position:fixed;bottom:0;right:1.5rem;width:380px;height:520px;background:var(--cream);border:1px solid var(--mist);border-bottom:none;box-shadow:0 -4px 20px rgba(0,0,0,.1);display:flex;flex-direction:column;z-index:900;border-radius:12px 12px 0 0;">'
      // Header
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:.8rem 1rem;background:var(--ink);color:var(--washi);border-radius:12px 12px 0 0;">'
      + '  <div style="font-size:.85rem;">💬 Chat · 對話</div>'
      + '  <div style="display:flex;gap:.5rem;">'
      + '    <button onclick="minimizeChat()" style="background:none;border:none;color:var(--washi);cursor:pointer;font-size:1rem;">─</button>'
      + '    <button onclick="closeChat()" style="background:none;border:none;color:var(--washi);cursor:pointer;font-size:1rem;">✕</button>'
      + '  </div>'
      + '</div>'
      // Messages
      + '<div id="chat-messages" style="flex:1;overflow-y:auto;padding:.8rem;"></div>'
      // Input
      + '<div style="border-top:1px solid var(--mist);padding:.6rem;display:flex;gap:.5rem;align-items:end;">'
      + '  <label style="cursor:pointer;font-size:1.2rem;color:var(--stone);" title="Send image · 傳送圖片">'
      + '    📎<input type="file" accept="image/*" style="display:none;" onchange="sendChatImage(this)">'
      + '  </label>'
      + '  <textarea id="chat-input" rows="1" placeholder="Type a message... · 輸入訊息..." style="flex:1;padding:.5rem;border:1px solid var(--mist);background:var(--washi);outline:none;resize:none;font-size:.85rem;max-height:80px;" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();sendChatMessage();}"></textarea>'
      + '  <button onclick="sendChatMessage()" style="padding:.5rem .8rem;background:var(--ink);color:var(--washi);border:none;cursor:pointer;font-size:.85rem;border-radius:4px;">Send</button>'
      + '</div>'
      + '</div>';

    document.body.insertAdjacentHTML('beforeend', html);
  }

  // ── Load messages ──
  async function loadMessages(threadId) {
    var el = document.getElementById('chat-messages');
    if (!el) return;
    try {
      var res = await A.api.get('/chat/threads/' + threadId + '/messages');
      var msgs = res.messages || [];
      var userId = A.getUser() ? A.getUser().id : 0;

      el.innerHTML = msgs.map(function (m) {
        var isMine = m.sender_id === userId;
        _lastMessageId = Math.max(_lastMessageId, m.id);
        return '<div style="display:flex;justify-content:' + (isMine ? 'flex-end' : 'flex-start') + ';margin-bottom:.5rem;">'
          + '<div style="max-width:75%;padding:.5rem .8rem;border-radius:' + (isMine ? '12px 12px 0 12px' : '12px 12px 12px 0') + ';background:' + (isMine ? 'var(--ink)' : 'var(--washi)') + ';color:' + (isMine ? '#fff' : 'var(--ink)') + ';font-size:.85rem;">'
          + (m.image_url ? '<img src="' + m.image_url + '" style="max-width:100%;border-radius:4px;margin-bottom:.3rem;" onclick="window.open(\'' + m.image_url + '\')">' : '')
          + '<div>' + escHtml(m.message) + '</div>'
          + '<div style="font-size:.6rem;opacity:.6;margin-top:.2rem;text-align:right;">' + timeAgo(m.created_at) + (m.read_at && isMine ? ' ✓✓' : '') + '</div>'
          + '</div></div>';
      }).join('');

      if (!msgs.length) {
        el.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--stone);font-size:.85rem;">Start the conversation · 開始對話</div>';
      }

      el.scrollTop = el.scrollHeight;
    } catch {}
  }

  // ── Send message ──
  window.sendChatMessage = async function () {
    var input = document.getElementById('chat-input');
    if (!input || !input.value.trim() || !_currentThreadId) return;
    var text = input.value.trim();
    input.value = '';

    try {
      await A.api.post('/chat/threads/' + _currentThreadId + '/messages', { message: text });
      loadMessages(_currentThreadId);
    } catch (e) { showToast(e.message || 'Failed to send'); }
  };

  // ── Send image ──
  window.sendChatImage = async function (input) {
    if (!input.files || !input.files[0] || !_currentThreadId) return;
    var fd = new FormData();
    fd.append('image', input.files[0]);
    fd.append('message', '');
    try {
      await A.api.post('/chat/threads/' + _currentThreadId + '/messages', fd);
      loadMessages(_currentThreadId);
    } catch (e) { showToast(e.message || 'Failed to send image'); }
    input.value = '';
  };

  // ── Poll for new messages ──
  function startPolling() {
    stopPolling();
    _pollInterval = setInterval(function () {
      if (_currentThreadId) loadMessages(_currentThreadId);
    }, 5000);
  }

  function stopPolling() {
    if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
  }

  window.minimizeChat = function () {
    var win = document.getElementById('chat-window');
    if (win) win.style.height = win.style.height === '40px' ? '520px' : '40px';
  };

  window.closeChat = function () {
    stopPolling();
    var win = document.getElementById('chat-window');
    if (win) win.remove();
    _currentThreadId = null;
  };

  // ── Utilities ──
  function escHtml(s) { return String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function truncate(s, n) { return s && s.length > n ? s.substring(0, n) + '...' : (s || ''); }
  function timeAgo(str) {
    if (!str) return '';
    var d = new Date(str); var now = new Date();
    var diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    return Math.floor(diff / 86400) + 'd';
  }

  console.log('[HansMed] Chat system loaded');
})();
