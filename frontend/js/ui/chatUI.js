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

export function renderMessages(messages, partnerName, partnerAvatar) {
  const header = document.getElementById("chatHeader");
  const msgBox = document.getElementById("messages");
  const inputArea = document.getElementById("inputArea");

  header.innerHTML = `<h2>${partnerName}</h2>`;
  inputArea.classList.remove("hidden");
  msgBox.innerHTML = "";

  const myAvatar = localStorage.getItem("userAvatar") || "";

  messages.forEach((msg) => {
    const div = document.createElement("div");
    const isYou = msg.senderName === "Вы";
    div.className = `message ${isYou ? "right" : "left"}`;
    if (msg.id) div.dataset.msgId = msg.id;
    if (isYou) div.dataset.editable = "1";

    const avatar = isYou ? myAvatar : partnerAvatar || "";
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

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}
