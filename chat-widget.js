(function () {
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function getVisitorId() {
    let id = localStorage.getItem('infopedia_chat_visitor_id');
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : 'v-' + Date.now() + '-' + Math.random().toString(16).slice(2));
      localStorage.setItem('infopedia_chat_visitor_id', id);
    }
    return id;
  }

  const visitorId = getVisitorId();
  let panelOpen = false;
  let lastMessageId = null;
  let pollTimer = null;

  // ---- DOM ----
  const btn = document.createElement('button');
  btn.className = 'chat-widget-btn';
  btn.setAttribute('aria-label', 'Open live chat');
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
    <span class="chat-widget-dot" hidden></span>
  `;
  document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.className = 'chat-widget-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="chat-widget-head">
      <div>
        <strong>Chat with us</strong>
        <span class="chat-widget-sub">We usually reply within a few minutes</span>
      </div>
      <button class="chat-widget-close" aria-label="Close chat">&times;</button>
    </div>
    <div class="chat-widget-messages" id="chatWidgetMessages"></div>
    <form class="chat-widget-form" id="chatWidgetForm">
      <input type="text" id="chatWidgetName" placeholder="Your name (optional)" autocomplete="name" maxlength="100">
      <div class="chat-widget-inputrow">
        <input type="text" id="chatWidgetInput" placeholder="Type a message…" autocomplete="off" maxlength="2000" required>
        <button type="submit" aria-label="Send">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </form>
  `;
  document.body.appendChild(panel);

  const messagesEl = panel.querySelector('#chatWidgetMessages');
  const formEl = panel.querySelector('#chatWidgetForm');
  const inputEl = panel.querySelector('#chatWidgetInput');
  const nameEl = panel.querySelector('#chatWidgetName');
  const dotEl = btn.querySelector('.chat-widget-dot');

  const savedName = localStorage.getItem('infopedia_chat_visitor_name');
  if (savedName) nameEl.value = savedName;

  function formatTime(iso) {
    try { return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  }

  function renderMessages(messages) {
    const wasAtBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 40;
    if (!messages.length) {
      messagesEl.innerHTML = '<p class="chat-widget-empty">Send us a message — we\'ll reply here.</p>';
      return;
    }
    messagesEl.innerHTML = messages.map((m) => `
      <div class="chat-msg ${m.sender === 'admin' ? 'admin' : 'visitor'}">
        <div class="chat-msg-bubble">${escapeHtml(m.body)}</div>
        <div class="chat-msg-time">${formatTime(m.createdAt)}</div>
      </div>
    `).join('');
    if (wasAtBottom || panelOpen) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function poll() {
    try {
      const res = await fetch(`/api/chat/${visitorId}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      const messages = data.messages || [];
      const latest = messages[messages.length - 1];

      if (panelOpen) {
        renderMessages(messages);
      } else if (latest && latest.sender === 'admin' && latest.id !== lastMessageId) {
        dotEl.hidden = false;
      }
      if (latest) lastMessageId = latest.id;
    } catch (e) {
      // Silent — a missed poll just gets retried on the next tick.
    }
  }

  function startPolling() {
    if (pollTimer) return;
    poll();
    pollTimer = setInterval(poll, panelOpen ? 3000 : 12000);
  }

  function restartPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    startPolling();
  }

  function openPanel() {
    panelOpen = true;
    panel.hidden = false;
    dotEl.hidden = true;
    restartPolling();
    poll();
    setTimeout(() => inputEl.focus(), 50);
  }
  function closePanel() {
    panelOpen = false;
    panel.hidden = true;
    restartPolling();
  }

  btn.addEventListener('click', () => (panelOpen ? closePanel() : openPanel()));
  panel.querySelector('.chat-widget-close').addEventListener('click', closePanel);

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = inputEl.value.trim();
    if (!body) return;
    const name = nameEl.value.trim();
    if (name) localStorage.setItem('infopedia_chat_visitor_name', name);

    inputEl.value = '';
    inputEl.disabled = true;
    try {
      await fetch(`/api/chat/${visitorId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, name: name || undefined }),
      });
      await poll();
    } catch (e) {
      inputEl.value = body; // restore so nothing typed is lost
    } finally {
      inputEl.disabled = false;
      inputEl.focus();
    }
  });

  startPolling();
})();
