/**
 * Doctor Messages — chat with patients.
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  var pollTimer = null;
  var currentThreadId = null;

  async function render(el, threadIdParam) {
    stopPoll();
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Messages · 訊息</div>' +
      '<h1 class="page-title">Patient Conversations</h1>' +
      '</div>' +
      '<div class="grid-2" style="grid-template-columns: 320px 1fr; gap: var(--s-4); min-height: 540px;">' +
      '<div id="thread-list" class="card" style="padding: var(--s-3); overflow-y: auto; max-height: 72vh;"></div>' +
      '<div id="thread-view" class="card" style="display: flex; flex-direction: column; max-height: 72vh;"></div>' +
      '</div>';

    await loadThreads();
    if (threadIdParam) openThread(parseInt(threadIdParam, 10));
    else document.getElementById('thread-view').innerHTML = emptyView();
  }

  function emptyView() {
    return '<div class="state state--empty" style="margin: auto;">' +
      '<div class="state-icon">💬</div>' +
      '<div class="state-text">Select a conversation to start chatting · 選擇對話</div>' +
      '</div>';
  }

  async function loadThreads() {
    var container = document.getElementById('thread-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.chat.threads();
      var threads = res.threads || res.data || [];
      if (!threads.length) {
        HM.state.empty(container, {
          icon: '💬',
          title: 'No conversations · 暫無對話',
          text: 'Chats will appear here when patients message you.',
        });
        return;
      }
      container.innerHTML = '<div class="text-label mb-2">Patients · 患者</div>';
      threads.forEach(function (t) {
        var div = document.createElement('div');
        div.style.cssText = 'padding: var(--s-3); border-bottom: 1px solid var(--border); cursor: pointer; border-radius: var(--r-sm);';
        div.onmouseenter = function () { div.style.background = 'var(--washi)'; };
        div.onmouseleave = function () { div.style.background = 'transparent'; };
        div.onclick = function () { openThread(t.id); };
        var last = t.last_message;
        var name = 'Patient #' + t.patient_id;
        if (t.patient && t.patient.patient_profile && t.patient.patient_profile.full_name) {
          name = t.patient.patient_profile.full_name;
        }
        div.innerHTML = '<div class="flex-between">' +
          '<div><strong style="font-size: var(--text-sm);">' + HM.format.esc(name) + '</strong>' +
          '<div class="text-xs text-muted mt-1">' +
          (last ? HM.format.truncate(HM.format.esc(last.message || ''), 40) : 'No messages yet') + '</div></div>' +
          (t.unread_count > 0 ? '<span class="sidebar-link-badge">' + t.unread_count + '</span>' : '') +
          '</div>';
        container.appendChild(div);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  async function openThread(threadId) {
    currentThreadId = threadId;
    var view = document.getElementById('thread-view');
    // Header is populated once we have the thread data back (in loadMessages).
    view.innerHTML = '' +
      '<div id="chat-header" style="padding: var(--s-4); border-bottom: 1px solid var(--border);">' +
      '<strong>Conversation · 對話</strong>' +
      '</div>' +
      '<div id="chat-messages" style="flex: 1; overflow-y: auto; padding: var(--s-3);"></div>' +
      '<div style="padding: var(--s-3); border-top: 1px solid var(--border); display: flex; gap: var(--s-2);">' +
      '<input id="chat-input" class="field-input field-input--boxed" placeholder="Type a message… · 輸入訊息…" style="flex: 1; margin: 0;">' +
      '<button class="btn btn--primary" id="chat-send">Send · 發送</button>' +
      '</div>';

    document.getElementById('chat-send').onclick = sendMessage;
    document.getElementById('chat-input').addEventListener('keypress', function (e) {
      if (e.key === 'Enter') sendMessage();
    });

    await loadMessages();
    pollTimer = setInterval(loadMessages, 5000);
  }

  async function loadMessages() {
    if (!currentThreadId) return;
    try {
      var res = await HM.api.chat.messages(currentThreadId);
      var msgs = res.messages || res.data || [];

      // Patient name in the chat header — populated once per thread open.
      var header = document.getElementById('chat-header');
      if (header && res.thread) {
        var pname = res.thread.patient_name || ('Patient #' + res.thread.patient_id);
        header.innerHTML =
          '<strong>' + HM.format.esc(pname) + '</strong>' +
          '<div class="text-xs text-muted">Patient #' + res.thread.patient_id + '</div>';
      }
      var user = HM.auth.user();
      var userId = user ? user.id : null;
      var container = document.getElementById('chat-messages');
      if (!container) return;

      if (!msgs.length) {
        container.innerHTML = '<p class="text-center text-muted" style="padding: 2rem;">Start the conversation · 開始對話</p>';
        return;
      }

      container.innerHTML = msgs.map(function (m) {
        var isMine = m.sender_id === userId;
        return '<div style="display: flex; justify-content: ' + (isMine ? 'flex-end' : 'flex-start') + '; margin-bottom: var(--s-2);">' +
          '<div style="max-width: 75%; padding: var(--s-2) var(--s-3); border-radius: var(--r-lg); background: ' + (isMine ? 'var(--ink)' : 'var(--washi)') + '; color: ' + (isMine ? 'var(--washi)' : 'var(--ink)') + '; font-size: var(--text-sm);">' +
          (m.image_url ? '<img src="' + HM.format.esc(m.image_url) + '" style="max-width: 220px; border-radius: var(--r-md); margin-bottom: var(--s-1);">' : '') +
          '<div>' + HM.format.esc(m.message || '') + '</div>' +
          '<div style="font-size: 0.6rem; opacity: 0.6; margin-top: var(--s-1); text-align: right;">' + HM.format.relative(m.created_at) + '</div>' +
          '</div></div>';
      }).join('');
      container.scrollTop = container.scrollHeight;
    } catch (_) { /* poll errors are silent */ }
  }

  async function sendMessage() {
    var input = document.getElementById('chat-input');
    var text = (input.value || '').trim();
    if (!text || !currentThreadId) return;
    input.value = '';
    try {
      await HM.api.chat.sendMessage(currentThreadId, { message: text });
      loadMessages();
    } catch (e) { HM.ui.toast('Failed to send · 發送失敗', 'danger'); }
  }

  function stopPoll() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  window.addEventListener('hashchange', function () {
    if (location.hash.indexOf('#/messages') !== 0) stopPoll();
  });

  HM.doctorPanels.messages = { render: render };
})();
