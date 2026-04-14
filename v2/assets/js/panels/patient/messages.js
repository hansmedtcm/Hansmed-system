/**
 * Messages — chat threads + chat view
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  var pollTimer = null;
  var currentThreadId = null;

  async function render(el, threadIdParam) {
    stopPoll();
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Messages · 訊息</div>' +
      '<h1 class="page-title">Chat with Your Doctors</h1>' +
      '</div>' +
      '<div class="grid-2" style="grid-template-columns: 300px 1fr; gap: var(--s-4); min-height: 500px;">' +
      '<div id="thread-list" class="card" style="padding: var(--s-3); overflow-y: auto; max-height: 70vh;"></div>' +
      '<div id="thread-view" class="card" style="display: flex; flex-direction: column; max-height: 70vh;"></div>' +
      '</div>';

    await loadThreads();
    if (threadIdParam) openThread(parseInt(threadIdParam));
    else document.getElementById('thread-view').innerHTML = emptyView();
  }

  function emptyView() {
    return '<div class="state state--empty" style="margin: auto;">' +
      '<div class="state-icon">💬</div>' +
      '<div class="state-text">Select a conversation to start chatting</div>' +
      '</div>';
  }

  async function loadThreads() {
    var container = document.getElementById('thread-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.chat.threads();
      var threads = res.threads || [];
      if (!threads.length) {
        HM.state.empty(container, {
          icon: '💬',
          title: 'No conversations',
          text: 'Start a chat from your doctor\'s profile',
        });
        return;
      }
      container.innerHTML = '<div class="text-label mb-2">Conversations · 對話</div>';
      threads.forEach(function (t) {
        var div = document.createElement('div');
        div.style.cssText = 'padding: var(--s-3); border-bottom: 1px solid var(--border); cursor: pointer; transition: background var(--dur-fast);';
        div.onmouseenter = function () { div.style.background = 'var(--washi)'; };
        div.onmouseleave = function () { div.style.background = 'transparent'; };
        div.onclick = function () { openThread(t.id); };
        var last = t.last_message;
        div.innerHTML = '<div class="flex-between">' +
          '<div><strong style="font-size: var(--text-sm);">Doctor #' + t.doctor_id + '</strong>' +
          '<div class="text-xs text-muted mt-1">' + (last ? HM.format.truncate(HM.format.esc(last.message), 40) : 'No messages') + '</div></div>' +
          (t.unread_count > 0 ? '<span class="sidebar-link-badge">' + t.unread_count + '</span>' : '') +
          '</div>';
        container.appendChild(div);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  async function openThread(threadId) {
    currentThreadId = threadId;
    var view = document.getElementById('thread-view');
    view.innerHTML = '' +
      '<div style="padding: var(--s-4); border-bottom: 1px solid var(--border);">' +
      '<strong>Conversation</strong>' +
      '</div>' +
      '<div id="chat-messages" style="flex: 1; overflow-y: auto; padding: var(--s-3);"></div>' +
      '<div style="padding: var(--s-3); border-top: 1px solid var(--border); display: flex; gap: var(--s-2);">' +
      '<input id="chat-input" class="field-input field-input--boxed" placeholder="Type a message…" style="flex: 1; margin: 0;">' +
      '<button class="btn btn--primary" id="chat-send">Send</button>' +
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
      var msgs = res.messages || [];
      var userId = HM.auth.user().id;
      var container = document.getElementById('chat-messages');
      if (!container) return;

      if (!msgs.length) {
        container.innerHTML = '<p class="text-center text-muted" style="padding: 2rem;">Start the conversation</p>';
        return;
      }

      container.innerHTML = msgs.map(function (m) {
        var isMine = m.sender_id === userId;
        return '<div style="display: flex; justify-content: ' + (isMine ? 'flex-end' : 'flex-start') + '; margin-bottom: var(--s-2);">' +
          '<div style="max-width: 75%; padding: var(--s-2) var(--s-3); border-radius: var(--r-lg); background: ' + (isMine ? 'var(--ink)' : 'var(--washi)') + '; color: ' + (isMine ? 'var(--washi)' : 'var(--ink)') + '; font-size: var(--text-sm);">' +
          (m.image_url ? '<img src="' + HM.format.esc(m.image_url) + '" style="max-width: 200px; border-radius: var(--r-md); margin-bottom: var(--s-1);">' : '') +
          '<div>' + HM.format.esc(m.message) + '</div>' +
          '<div style="font-size: 0.6rem; opacity: 0.6; margin-top: var(--s-1); text-align: right;">' + HM.format.relative(m.created_at) + '</div>' +
          '</div></div>';
      }).join('');
      container.scrollTop = container.scrollHeight;
    } catch {}
  }

  async function sendMessage() {
    var input = document.getElementById('chat-input');
    var text = input.value.trim();
    if (!text || !currentThreadId) return;
    input.value = '';
    try {
      await HM.api.chat.sendMessage(currentThreadId, { message: text });
      loadMessages();
    } catch (e) { HM.ui.toast('Failed to send', 'danger'); }
  }

  function stopPoll() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  window.addEventListener('hashchange', function () {
    if (location.hash.indexOf('#/messages') !== 0) stopPoll();
  });

  HM.patientPanels.messages = { render: render };
})();
