import { getChatList, openChat as apiOpenChat, getMessages, sendMessage } from "./api/dm.js";
import { renderChatList, renderMessages } from "./ui/chatUI.js";
import { initSocket, getSocket } from "./realtime/socket.js";
import { getUserId, getToken } from "./utils/storage.js";

document.addEventListener("DOMContentLoaded", () => {
  const inputArea = document.getElementById("inputArea");
  if (inputArea) inputArea.classList.add("hidden");
});

let currentChatId = null;
let chatList = [];
let myId = null;

const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "🤔"];

async function openChat(chatId) {
  currentChatId = chatId;
  const data = await getMessages(chatId);
  if (data.error) {
    alert(data.error);
    return;
  }

  const chat = chatList.find((c) => c.chatId === chatId);
  const partner = chat?.partner || null;
  const partnerName = partner?.username || "Неизвестный";
  const partnerAvatar = partner?.avatar || null;

  const messagesWithName = data.messages.map((msg) => ({
    ...msg,
    senderName: msg.senderId === myId ? "Вы" : partnerName,
  }));

  renderMessages(messagesWithName, partnerName, partnerAvatar);
}

async function startChatWithUser(targetId) {
  const data = await apiOpenChat(targetId);
  if (data.error) {
    alert(data.error);
    return null;
  }
  await refreshChatList();
  openChat(data.chat.id);
  return data.chat;
}

async function init() {
  myId = getUserId();
  console.log("[init] myId:", myId);

  try {
    await initSocket();
    const socket = getSocket();
    if (socket) {
      socket.on("newMessage", (message) => {
        if (message.chatId === currentChatId) {
          const exists = document.querySelector(`[data-msg-id="${message.id}"]`);
          if (exists) return;
          const chat = chatList.find((c) => c.chatId === currentChatId);
          const partner = chat?.partner || null;
          const partnerName = partner?.username || "Неизвестный";
          addMessageToUI({
            id: message.id,
            senderName: message.senderId === myId ? "Вы" : partnerName,
            text: message.text,
            timestamp: message.timestamp,
            mentions: message.mentions,
            reactions: message.reactions,
          });
          if (message.senderId !== myId) playNotificationSound();
        }
        refreshChatList();
      });

      socket.on("reactionUpdated", (data) => {
        if (data.chatId === currentChatId) {
          updateMessageReactions(data.messageId, data.reactions);
        }
      });

      socket.on("userAvatarUpdated", (data) => {
        const chat = chatList.find((c) => c.partner?.id === data.userId);
        if (chat) chat.partner.avatar = data.avatar;
        if (chat && chat.chatId === currentChatId) openChat(currentChatId);
      });
    }
  } catch (err) {
    console.warn("Socket.IO не доступен:", err);
  }

  const data = await getChatList();
  if (data.error) {
    alert(data.error);
    return;
  }
  chatList = data.chats;
  renderChatList(chatList);

  chatList.forEach((chat) => {
    const el = document.querySelector(`[data-chat="${chat.chatId}"]`);
    if (el) el.addEventListener("click", () => openChat(chat.chatId));
  });
}

async function refreshChatList() {
  const data = await getChatList();
  if (data.error) return;
  chatList = data.chats;
  renderChatList(chatList);
  chatList.forEach((chat) => {
    const el = document.querySelector(`[data-chat="${chat.chatId}"]`);
    if (el) el.replaceWith(el.cloneNode(true));
  });
  chatList.forEach((chat) => {
    const el = document.querySelector(`[data-chat="${chat.chatId}"]`);
    if (el) el.addEventListener("click", () => openChat(chat.chatId));
  });
}

sendBtn.addEventListener("click", () => sendCurrentMessage());
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendCurrentMessage();
  }
});

async function sendCurrentMessage() {
  if (!currentChatId) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  try {
    const res = await sendMessage(currentChatId, text);
    if (res.error || res.message?.error) {
      alert("Ошибка: " + (res.error || res.message.error));
      input.value = text;
    }
  } catch (err) {
    console.error("Ошибка отправки:", err);
    input.value = text;
  }
}

function highlightMentions(text) {
  return text.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 800;
    o.type = "sine";
    g.gain.value = 0.3;
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 150);
  } catch (e) {}
}

function renderReactions(msgId, reactions) {
  const hasReactions = reactions && reactions.length > 0;
  const btns = hasReactions
    ? reactions
        .map((r) => {
          const active = r.users.includes(myId);
          return `<button class="reaction-btn ${active ? "active" : ""}" data-msg="${msgId}" data-emoji="${r.emoji}">${
            r.emoji
          }<span class="reaction-count">${r.users.length}</span></button>`;
        })
        .join("")
    : "";
  return `<div class="msg-reactions">${btns}<button class="reaction-btn reaction-add" data-msg="${msgId}">+</button></div>`;
}

function addMessageToUI(msg) {
  const msgBox = document.getElementById("messages");
  const isYou = msg.senderName === "Вы";
  const div = document.createElement("div");
  div.className = `message ${isYou ? "right" : "left"}`;
  if (msg.id) div.dataset.msgId = msg.id;

  const myAvatar = localStorage.getItem("userAvatar") || "";
  const chat = chatList.find((c) => c.chatId === (window.currentChatId || currentChatId));
  const partnerAvatar = chat?.partner?.avatar || null;
  const avatar = isYou
    ? myAvatar
    : (partnerAvatar && !partnerAvatar.startsWith("http") ? `http://localhost:3000/${partnerAvatar.replace(/^\/+/, "")}` : partnerAvatar) ||
      myAvatar;
  const avatarBg = avatar ? "" : `background: ${isYou ? "#d64545" : "#e0a030"};`;
  const avatarStyle = avatar ? `background-image:url(${avatar});` + avatarBg : avatarBg;
  const avatarLetter = avatar ? "" : isYou ? "Я" : "?";

  const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "";
  const editedLabel = msg.edited ? ' <span class="edited-tag">(изм.)</span>' : "";
  const highlightedText = isYou ? msg.text : highlightMentions(msg.text);
  const wasMentioned = !isYou && msg.mentions && msg.mentions.includes(myId);
  if (wasMentioned) playNotificationSound();

  const reactionsHTML = renderReactions(msg.id, msg.reactions);

  div.innerHTML = `
    <div class="msg-avatar-mini" style="${avatarStyle}">${avatarLetter}</div>
    <div class="msg-content" style="position:relative;">
      <strong>${msg.senderName}${editedLabel}</strong>
      <p class="msg-text">${highlightedText}</p>
      <span class="msg-time">${time}</span>
      ${reactionsHTML}
      ${
        isYou
          ? '<span class="msg-actions"><button class="msg-edit-btn" title="Редактировать">✏️</button><button class="msg-del-btn" title="Удалить">🗑️</button></span>'
          : ""
      }
    </div>
  `;
  msgBox.appendChild(div);
  requestAnimationFrame(() => {
    msgBox.scrollTop = msgBox.scrollHeight;
  });
}

function updateMessageReactions(msgId, reactions) {
  const el = document.querySelector(`[data-msg-id="${msgId}"]`);
  if (!el) return;
  const reactionsContainer = el.querySelector(".msg-reactions");
  if (!reactionsContainer) return;
  const addBtn = reactionsContainer.querySelector(".reaction-add");
  reactionsContainer.innerHTML = renderReactions(msgId, reactions);
  if (addBtn) reactionsContainer.appendChild(addBtn);
}

// Делегирование: реакции, edit, delete
document.addEventListener("click", async (e) => {
  // Реакция
  const reactionBtn = e.target.closest(".reaction-btn");
  if (reactionBtn) {
    e.preventDefault();
    const msgId = reactionBtn.dataset.msg;
    const emoji = reactionBtn.dataset.emoji;

    if (emoji) {
      // Toggle существующую реакцию
      const isActive = reactionBtn.classList.contains("active");
      const token = getToken();
      const url = `http://localhost:3000/dm/msg/${msgId}/react/${encodeURIComponent(emoji)}`;
      const res = await fetch(url, {
        method: isActive ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      return;
    }

    // Кнопка "+" — показать пикер
    if (reactionBtn.classList.contains("reaction-add")) {
      const msgContent = reactionBtn.closest(".msg-content");
      let picker = msgContent.querySelector(".reaction-picker");
      if (picker) {
        picker.remove();
        return;
      }

      picker = document.createElement("div");
      picker.className = "reaction-picker show";
      picker.innerHTML = COMMON_EMOJIS.map((em) => `<button class="reaction-picker-btn" data-emoji="${em}">${em}</button>`).join("");

      picker.onclick = async (ev) => {
        const btn = ev.target.closest(".reaction-picker-btn");
        if (!btn) return;
        const em = btn.dataset.emoji;
        const token = getToken();
        const res = await fetch(`http://localhost:3000/dm/msg/${msgId}/react/${encodeURIComponent(em)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ emoji: em }),
        });
        const data = await res.json();
        picker.remove();
        if (data.error) alert(data.error);
      };

      msgContent.style.position = "relative";
      msgContent.appendChild(picker);
    }
    return;
  }

  // Edit
  const editBtn = e.target.closest(".msg-edit-btn");
  if (editBtn) {
    const msgEl = editBtn.closest(".message");
    const msgId = msgEl.dataset.msgId;
    const textEl = msgEl.querySelector(".msg-text");
    const oldText = textEl.textContent;
    const newText = prompt("Редактировать:", oldText);
    if (newText && newText !== oldText) {
      const token = getToken();
      const res = await fetch(`http://localhost:3000/dm/msg/${msgId}/edit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: newText }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      textEl.textContent = newText;
      if (!msgEl.querySelector(".edited-tag")) {
        msgEl.querySelector("strong").innerHTML += ' <span class="edited-tag">(изм.)</span>';
      }
    }
    return;
  }

  // Delete
  const delBtn = e.target.closest(".msg-del-btn");
  if (delBtn) {
    const msgEl = delBtn.closest(".message");
    const msgId = msgEl.dataset.msgId;
    if (!confirm("Удалить сообщение?")) return;
    const token = getToken();
    const res = await fetch(`http://localhost:3000/dm/msg/${msgId}/delete`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    msgEl.remove();
  }
});

// Закрыть пикер реакций при клике вне
document.addEventListener("click", (e) => {
  if (!e.target.closest(".reaction-picker") && !e.target.closest(".reaction-add")) {
    document.querySelectorAll(".reaction-picker").forEach((p) => p.remove());
  }
});

init();
window.startChatWithUser = startChatWithUser;
