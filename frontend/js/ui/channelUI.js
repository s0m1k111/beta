export function renderChatList(chats) {
  const container = document.getElementById("chatList");
  container.innerHTML = "";

  // Кнопка возврата на серверы
  const backLink = document.createElement("a");
  backLink.href = "server.html";
  backLink.className = "back-link";
  backLink.textContent = "← Серверы";
  container.appendChild(backLink);

  chats.forEach((chat) => {
    const div = document.createElement("div");
    div.className = "chat-item";
    div.dataset.chat = chat.chatId;

    const name = chat.partner ? chat.partner.username : "Неизвестный";
    const last = chat.lastMessage ? chat.lastMessage.text : "Нет сообщений";
    const time = chat.lastMessage ? formatTime(chat.lastMessage.timestamp) : "";

    div.innerHTML = `
      <strong>${name}</strong><br>
      <span>${last}</span>
      <span class="msg-time">${time}</span>
    `;

    container.appendChild(div);
  });
}

// Фикс URL аватара
function fixAvatarUrl(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `http://localhost:3000/${url.replace(/^\/+/, "").replace(/\\/g, "/")}`;
}

export function renderMessages(messages, partnerName, partnerAvatar) {
  const header = document.getElementById("chatHeader");
  const msgBox = document.getElementById("messages");
  const inputArea = document.getElementById("inputArea");

  header.innerHTML = `<h2>${partnerName}</h2>`;
  inputArea.classList.remove("hidden");
  msgBox.innerHTML = "";

  const myAvatar = localStorage.getItem("userAvatar") || "";
  const fixedPartnerAvatar = fixAvatarUrl(partnerAvatar);

  messages.forEach((msg) => {
    const div = document.createElement("div");
    const isYou = msg.senderName === "Вы";
    div.className = `message ${isYou ? "right" : "left"}`;
    if (msg.id) div.dataset.msgId = msg.id;
    if (isYou) div.dataset.editable = "1";

    const avatar = isYou ? myAvatar : fixedPartnerAvatar;
    const avatarBg = avatar ? "" : `background: ${isYou ? "#d64545" : "#e0a030"};`;
    const avatarStyle = avatar ? `background-image:url(${avatar});${avatarBg}` : avatarBg;
    const avatarLetter = avatar ? "" : isYou ? "Я" : partnerName ? partnerName.charAt(0) : "?";

    const editedLabel = msg.edited ? ' <span class="edited-tag">(изм.)</span>' : "";

    div.innerHTML = `
      <div class="msg-avatar-mini" style="${avatarStyle}">${avatarLetter}</div>
      <div class="msg-content">
        <strong>${msg.senderName}${editedLabel}</strong>
        <p class="msg-text">${msg.text}</p>
        <span class="msg-time">${formatTime(msg.timestamp)}</span>
        ${
          isYou
            ? '<span class="msg-actions"><button class="msg-edit-btn" title="Редактировать">✏️</button><button class="msg-del-btn" title="Удалить">🗑️</button></span>'
            : ""
        }
      </div>
    `;
    msgBox.appendChild(div);
  });

  requestAnimationFrame(() => {
    msgBox.scrollTop = msgBox.scrollHeight;
  });
}

function highlightChannelMentions(text) {
  return text.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
}

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "🤔"];

function renderReactions(msgId, reactions) {
  const hasReactions = reactions && reactions.length > 0;
  const btns = hasReactions
    ? reactions
        .map((r) => {
          const active = r.users && r.users.length > 0;
          return `<button class="reaction-btn ${active ? "active" : ""}" data-msg="${msgId}" data-emoji="${r.emoji}">${
            r.emoji
          }<span class="reaction-count">${r.users ? r.users.length : 0}</span></button>`;
        })
        .join("")
    : "";
  return `<div class="msg-reactions">${btns}<button class="reaction-btn reaction-add" data-msg="${msgId}">+</button></div>`;
}

// Звук уведомления
function playMentionSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 1000;
    osc.type = "sine";
    gain.gain.value = 0.3;
    osc.start();
    setTimeout(() => {
      osc.stop();
      audioCtx.close();
    }, 200);
  } catch (e) {}
}

// Рендер сообщений канала (без звука — это загрузка истории)
export async function renderChannelMessages(messages) {
  const msgBox = document.getElementById("channelMessages");
  if (!msgBox) return;
  msgBox.innerHTML = "";

  const myId = localStorage.getItem("userId");
  const serverId = window.currentServerId;

  // Загрузим имена и аватары участников сервера
  const userMap = await loadServerUserNames(serverId);

  messages.forEach((msg) => {
    const div = document.createElement("div");
    div.className = "channel-message";
    if (msg.id) div.dataset.msgId = msg.id;

    const isYou = msg.senderId === myId;
    const userData = userMap[msg.senderId] || {};
    const senderName = isYou ? "Вы" : userData.username || "Неизвестный";
    const senderAvatar = userData.avatar || null;
    const editedLabel = msg.edited ? ' <span class="edited-tag">(изм.)</span>' : "";

    // Подсветка упоминаний (без звука при загрузке истории)
    const highlightedText = isYou ? msg.text : highlightChannelMentions(msg.text);
    const reactionsHTML = renderReactions(msg.id, msg.reactions);
    const imageHTML = msg.image
      ? `<img class="msg-image" src="http://localhost:3000${msg.image}" alt="image" onclick="window.open(this.src,'_blank')" />`
      : "";

    const avatarStyle = senderAvatar ? `background-image:url(${senderAvatar});` : `background: ${isYou ? "#d64545" : "#e0a030"};`;
    const avatarLetter = senderAvatar ? "" : isYou ? "Я" : userData.username ? userData.username.charAt(0) : "?";

    div.innerHTML = `
      <div class="ch-avatar-mini" style="${avatarStyle}">${avatarLetter}</div>
      <div class="ch-msg-content" style="position:relative;">
        <span class="channel-msg-sender" style="color: ${isYou ? "#d64545" : "#e0a030"}">${senderName}${editedLabel}</span>
        ${imageHTML}
        <span class="channel-msg-text">${highlightedText}</span>
        <span class="channel-msg-time">${formatTime(msg.timestamp)}</span>
        ${reactionsHTML}
        <span class="ch-msg-actions"><button class="ch-msg-edit-btn" data-msg="${
          msg.id
        }">✏️</button><button class="ch-msg-del-btn" data-msg="${msg.id}">🗑️</button></span>
      </div>
    `;

    msgBox.appendChild(div);
  });

  requestAnimationFrame(() => {
    msgBox.scrollTop = msgBox.scrollHeight;
  });
}

// Загрузить имена и аватары участников сервера
async function loadServerUserNames(serverId) {
  if (!serverId) return {};
  try {
    const token = (await import("../utils/storage.js")).getToken();
    const res = await fetch(`http://localhost:3000/servers/${serverId}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const map = {};
    (data.members || []).forEach((m) => {
      let avatar = m.avatar || null;
      if (avatar && !avatar.startsWith("http")) {
        avatar = `http://localhost:3000/${avatar.replace(/^\/+/, "").replace(/\\/g, "/")}`;
      }
      map[m.id] = { username: m.username, avatar };
    });
    return map;
  } catch {
    return {};
  }
}

// Выбрать сервер
export async function selectServer(serverId) {
  window.currentServerId = serverId;

  // Подсветка активного сервера
  document.querySelectorAll(".server-icon").forEach((el) => el.classList.remove("active"));
  const activeEl = document.querySelector(`.server-icon[data-server="${serverId}"]`);
  if (activeEl) activeEl.classList.add("active");

  // Загрузить сервер и отобразить каналы
  const { getServer } = await import("../api/servers.js");
  const data = await getServer(serverId);

  if (data.error) {
    alert(data.error);
    return;
  }

  window.currentServerName = data.server.name;
  renderChannelList(data.server.channels);
}

// Рендер списка серверов (боковая панель иконок, как в Discord)
export function renderServerList(servers) {
  const container = document.getElementById("serverList");
  if (!container) return;

  // Удаляем всё кроме первых двух детей (ЛС кнопка и разделитель)
  while (container.children.length > 2) {
    container.removeChild(container.lastChild);
  }

  servers.forEach((server) => {
    const icon = document.createElement("div");
    icon.className = "server-icon";
    icon.dataset.server = server.id;
    icon.title = server.name;

    if (server.icon) {
      icon.style.backgroundImage = `url(${server.icon})`;
      icon.style.backgroundSize = "cover";
    } else {
      icon.textContent = server.name.charAt(0).toUpperCase();
    }

    icon.onclick = () => selectServer(server.id);
    container.appendChild(icon);
  });
}

// Ренер списка каналов (как в Discord — слева)
export function renderChannelList(channels) {
  const container = document.getElementById("channelList");
  if (!container) return;
  container.innerHTML = "";

  const serverName = window.currentServerName || "Сервер";
  const serverId = window.currentServerId || "";
  const header = document.createElement("div");
  header.className = "channel-header";
  header.id = "channelHeader";
  header.innerHTML = `<h3>${serverName}</h3><div class="server-id-hint">ID: ${
    window.currentServerId || "—"
  }</div><span id="typingIndicator" class="typing-indicator" style="display:none"></span>`;
  container.appendChild(header);

  // Навигация
  const nav = document.createElement("div");
  nav.className = "server-nav";
  nav.innerHTML = `
    <a href="chat.html" class="server-nav-link">💬 Личные сообщения</a>
    <a href="profile.html" class="server-nav-link">👤 Профиль</a>
    <button id="inviteBtn" class="server-nav-btn" style="display:block">📧 Пригласить</button>
    <button id="createChannelBtn" class="server-nav-btn" style="display:block">➕ Канал</button>
  `;
  container.appendChild(nav);

  const textChannels = channels.filter((ch) => ch.type === "text");

  const section = document.createElement("div");
  section.className = "channel-section";
  section.innerHTML = `<span class="channel-section-title">ТЕКСТОВЫЕ КАНАЛЫ</span>`;
  container.appendChild(section);

  textChannels.forEach((channel) => {
    const div = document.createElement("div");
    div.className = "channel-item";
    div.dataset.channel = channel.id;

    const unreadCount = window.unreadSummary?.[channel.id] || 0;
    const badgeHTML = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : "";
    const boldClass = unreadCount > 0 ? "channel-item-unread" : "";

    div.innerHTML = `<span class="channel-hash">#</span> <span class="${boldClass}">${channel.name}</span> ${badgeHTML}`;
    div.onclick = () => openChannel(channel);
    container.appendChild(div);
  });
}

// Открыть канал
export async function openChannel(channel) {
  window.currentChannelId = channel.id;

  // Подсветка активного канала
  document.querySelectorAll(".channel-item").forEach((el) => el.classList.remove("active"));
  const activeEl = document.querySelector(`.channel-item[data-channel="${channel.id}"]`);
  if (activeEl) activeEl.classList.add("active");

  // Показать область чата
  const chatWindow = document.getElementById("serverChatWindow");
  if (chatWindow) chatWindow.classList.remove("hidden");

  const header = document.getElementById("channelHeader");
  if (header) header.innerHTML = `<span class="channel-hash">#</span> ${channel.name}`;

  // Загрузить сообщения
  const { getChannelMessages } = await import("../api/servers.js");
  const data = await getChannelMessages(channel.id);

  if (data.error) {
    alert(data.error);
    return;
  }

  renderChannelMessages(data.messages);

  // Отметить как прочитанное
  const { markChannelAsRead } = await import("../api/servers.js");
  await markChannelAsRead(channel.id);

  // Обновить бейдж напрямую
  if (window.unreadSummary) {
    window.unreadSummary[channel.id] = 0;
  }
  const channelItem = document.querySelector(`.channel-item[data-channel="${channel.id}"]`);
  if (channelItem) {
    const badge = channelItem.querySelector(".unread-badge");
    if (badge) badge.remove();
    const nameSpans = channelItem.querySelectorAll("span");
    nameSpans.forEach((s) => s.classList.remove("channel-item-unread"));
  }

  // Фокус на поле ввода
  const input = document.getElementById("channelMessageInput");
  if (input) input.focus();
}

// Добавить сообщение в UI
export function addChannelMessageToUI(msg, myId) {
  const msgBox = document.getElementById("channelMessages");
  if (!msgBox) return;

  // Проверка дублей
  if (msg.id && document.querySelector(`[data-msg-id="${msg.id}"]`)) return;

  const isYou = msg.senderId === myId;
  const div = document.createElement("div");
  div.className = "channel-message";
  if (msg.id) div.dataset.msgId = msg.id;

  const senderName = msg.senderName || (isYou ? "Вы" : "...");
  const editedLabel = msg.edited ? ' <span class="edited-tag">(изм.)</span>' : "";

  // Подсветка упоминаний + звук
  const highlightedText = isYou ? msg.text : highlightChannelMentions(msg.text);
  const wasMentioned = !isYou && msg.mentions && msg.mentions.includes(myId);
  if (wasMentioned) playMentionSound();

  const reactionsHTML = renderReactions(msg.id, msg.reactions);
  const imageHTML = msg.image
    ? `<img class="msg-image" src="http://localhost:3000${msg.image}" alt="image" onclick="window.open(this.src,'_blank')" />`
    : "";

  const avatarStyle = `background: ${isYou ? "#d64545" : "#e0a030"};`;
  const avatarLetter = isYou ? "Я" : senderName ? senderName.charAt(0) : "?";

  div.innerHTML = `
    <div class="ch-avatar-mini" style="${avatarStyle}">${avatarLetter}</div>
    <div class="ch-msg-content" style="position:relative;">
      <span class="channel-msg-sender" style="color: ${isYou ? "#d64545" : "#e0a030"}">${senderName}${editedLabel}</span>
      ${imageHTML}
      <span class="channel-msg-text">${msg.text}</span>
      <span class="channel-msg-time">${formatTime(msg.timestamp)}</span>
      ${reactionsHTML}
      <span class="ch-msg-actions"><button class="ch-msg-edit-btn" data-msg="${
        msg.id
      }">✏️</button><button class="ch-msg-del-btn" data-msg="${msg.id}">🗑️</button></span>
    </div>
  `;

  msgBox.appendChild(div);
  requestAnimationFrame(() => {
    msgBox.scrollTop = msgBox.scrollHeight;
  });
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

// Обновить реакции у сообщения (для Socket.IO)
export function updateChannelReactions(messageId, reactions) {
  const msgEl = document.querySelector(`[data-msg-id="${messageId}"]`);
  if (!msgEl) return;
  const reactionsContainer = msgEl.querySelector(".msg-reactions");
  if (!reactionsContainer) return;
  reactionsContainer.innerHTML = renderReactions(messageId, reactions);
}

// Экспорт для server.js
window.updateChannelReactions = updateChannelReactions;
