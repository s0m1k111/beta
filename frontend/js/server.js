import { getMyServers, createServer, sendChannelMessage, joinServer, createChannel, getUnreadSummary } from "./api/servers.js";
import { renderServerList, openChannel, addChannelMessageToUI, updateChannelReactions } from "./ui/channelUI.js";
import { initSocket, getSocket } from "./realtime/socket.js";
import { getUserId, getToken } from "./utils/storage.js";
import { openChat as apiOpenChat } from "./api/dm.js";
import {
  joinVoiceChannel,
  leaveVoiceChannel,
  startScreenShare,
  stopScreenShare,
  toggleMute,
  isMuted,
  initVoiceListeners,
  getIsScreenSharing,
  getScreenSharerId,
} from "./realtime/voice.js";

let myId = null;
let serverMembers = [];

document.addEventListener("DOMContentLoaded", () => {
  myId = getUserId();

  // === Модалка создания сервера ===
  setupModal("addServerBtn", "createServerModal", "createServerBtn", "cancelServerBtn", async () => {
    const name = document.getElementById("newServerName").value.trim() || "Новый сервер";
    const result = await createServer(name);
    if (result.error) {
      alert(result.error);
      return false;
    }
    document.getElementById("newServerName").value = "";
    loadServers();
    return true;
  });

  // === Отправка сообщений ===
  const sendBtn = document.getElementById("channelSendBtn");
  const input = document.getElementById("channelMessageInput");
  const imageInput = document.getElementById("imageUploadInput");
  let pendingImage = null;
  let typingTimeout = null;
  let isTyping = false;

  if (sendBtn) sendBtn.onclick = () => sendCurrentMessage();
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        sendCurrentMessage();
      }
    });

    // Typing indicator
    input.addEventListener("input", () => {
      const socket = getSocket();
      if (!socket || !window.currentChannelId) {
        console.log("[typing] skip: socket=", !!socket, "channelId=", window.currentChannelId);
        return;
      }

      if (!isTyping) {
        isTyping = true;
        console.log("[typing] emitting typing for channel:", window.currentChannelId);
        socket.emit("typing", { channelId: window.currentChannelId });
      }

      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        isTyping = false;
        console.log("[typing] emitting stopTyping for channel:", window.currentChannelId);
        socket.emit("stopTyping", { channelId: window.currentChannelId });
      }, 2000);
    });
  }

  // Загрузка изображения
  if (imageInput) {
    imageInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      pendingImage = file;
      input.placeholder = `📷 ${file.name}`;
    });
  }

  async function sendCurrentMessage() {
    const channelId = window.currentChannelId;
    if (!channelId) {
      console.warn("[send] нет channelId");
      return;
    }
    const text = input.value.trim();
    if (!text && !pendingImage) {
      console.warn("[send] пустое сообщение и нет картинки");
      return;
    }

    let imageUrl = null;
    if (pendingImage) {
      const formData = new FormData();
      formData.append("image", pendingImage);
      const token = getToken();
      try {
        console.log("[upload] Загрузка:", pendingImage.name);
        const res = await fetch("http://localhost:3000/channels/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await res.json();
        console.log("[upload] Ответ:", data);
        if (data.error) {
          alert(data.error);
          return;
        }
        imageUrl = data.imageUrl;
      } catch (err) {
        console.error("Ошибка загрузки:", err);
        alert("Ошибка загрузки изображения");
        return;
      }
      pendingImage = null;
      imageInput.value = "";
      input.placeholder = "Написать в канал...";
    }

    try {
      console.log("[send] Отправка:", { channelId, text: text || "", image: imageUrl });
      const res = await sendChannelMessage(channelId, text, imageUrl);
      console.log("[send] Ответ:", res);
      if (res.error) {
        alert(res.error);
        return;
      }
    } catch (err) {
      console.error("Ошибка отправки:", err);
      alert("Ошибка отправки сообщения");
    }
    input.value = "";
  }

  // === Делегирование для динамических кнопок ===
  document.addEventListener("click", (e) => {
    if (e.target.closest("#inviteBtn")) {
      document.getElementById("inviteModal")?.classList.remove("hidden");
      return;
    }
    if (e.target.closest("#createChannelBtn")) {
      if (!window.currentServerId) {
        alert("Сначала выберите сервер");
        return;
      }
      document.getElementById("createChannelModal")?.classList.remove("hidden");
    }
  });

  // === Модалка приглашения ===
  document.getElementById("inviteJoinBtn")?.addEventListener("click", async () => {
    const serverId = document.getElementById("inviteServerId").value.trim();
    if (!serverId) {
      alert("Введите ID сервера");
      return;
    }
    const result = await joinServer(serverId);
    if (result.error) {
      alert(result.error);
      return;
    }
    document.getElementById("inviteModal")?.classList.add("hidden");
    document.getElementById("inviteServerId").value = "";
    alert("Вы вступили на сервер!");
    loadServers();
  });

  document.getElementById("inviteCancelBtn")?.addEventListener("click", () => {
    document.getElementById("inviteModal")?.classList.add("hidden");
  });

  // === Модалка создания канала ===
  document.getElementById("createChannelSubmitBtn")?.addEventListener("click", async () => {
    if (!window.currentServerId) {
      alert("Сначала выберите сервер");
      return;
    }
    const name = document.getElementById("newChannelName").value.trim();
    if (!name) {
      alert("Введите название");
      return;
    }
    const result = await createChannel(window.currentServerId, name);
    if (result.error) {
      alert(result.error);
      return;
    }
    document.getElementById("createChannelModal")?.classList.add("hidden");
    document.getElementById("newChannelName").value = "";
    selectServer(window.currentServerId);
  });

  document.getElementById("cancelChannelBtn")?.addEventListener("click", () => {
    document.getElementById("createChannelModal")?.classList.add("hidden");
  });

  // === Делегирование для edit/delete/reaction каналов ===
  document.addEventListener("click", async (e) => {
    // Реакции
    const reactionBtn = e.target.closest(".reaction-btn");
    if (reactionBtn) {
      e.preventDefault();
      const msgId = reactionBtn.dataset.msg;
      const emoji = reactionBtn.dataset.emoji;

      if (emoji) {
        const isActive = reactionBtn.classList.contains("active");
        const token = getToken();
        const url = `http://localhost:3000/channels/channels/${window.currentChannelId}/messages/${msgId}/react/${encodeURIComponent(
          emoji
        )}`;
        const res = await fetch(url, {
          method: isActive ? "DELETE" : "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.error) alert(data.error);
        return;
      }

      if (reactionBtn.classList.contains("reaction-add")) {
        const msgContent = reactionBtn.closest(".ch-msg-content");
        let picker = msgContent?.querySelector(".reaction-picker");
        if (picker) {
          picker.remove();
          return;
        }

        const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "🤔"];
        picker = document.createElement("div");
        picker.className = "reaction-picker show";
        picker.innerHTML = COMMON_EMOJIS.map((em) => `<button class="reaction-picker-btn" data-emoji="${em}">${em}</button>`).join("");

        picker.onclick = async (ev) => {
          const btn = ev.target.closest(".reaction-picker-btn");
          if (!btn) return;
          const em = btn.dataset.emoji;
          const token = getToken();
          const res = await fetch(
            `http://localhost:3000/channels/channels/${window.currentChannelId}/messages/${msgId}/react/${encodeURIComponent(em)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ emoji: em }),
            }
          );
          const data = await res.json();
          picker.remove();
          if (data.error) alert(data.error);
        };
        if (msgContent) {
          msgContent.style.position = "relative";
          msgContent.appendChild(picker);
        }
      }
      return;
    }

    // Edit
    const chEditBtn = e.target.closest(".ch-msg-edit-btn");
    if (chEditBtn) {
      const msgId = chEditBtn.dataset.msg;
      const msgEl = chEditBtn.closest(".channel-message");
      const textEl = msgEl.querySelector(".channel-msg-text");
      const oldText = textEl.textContent;
      const newText = prompt("Редактировать сообщение:", oldText);
      if (newText && newText !== oldText) {
        const token = getToken();
        const res = await fetch(`http://localhost:3000/channels/channels/${window.currentChannelId}/messages/${msgId}`, {
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
          const sender = msgEl.querySelector(".channel-msg-sender");
          sender.innerHTML += ' <span class="edited-tag">(изм.)</span>';
        }
      }
      return;
    }

    const chDelBtn = e.target.closest(".ch-msg-del-btn");
    if (chDelBtn) {
      const msgId = chDelBtn.dataset.msg;
      const msgEl = chDelBtn.closest(".channel-message");
      if (!confirm("Удалить сообщение?")) return;
      const token = getToken();
      const res = await fetch(`http://localhost:3000/channels/channels/${window.currentChannelId}/messages/${msgId}`, {
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
});

function setupModal(openBtnId, modalId, submitBtnId, cancelBtnId, onSubmit) {
  const modal = document.getElementById(modalId);
  const openBtn = openBtnId ? document.getElementById(openBtnId) : null;
  const submitBtn = document.getElementById(submitBtnId);
  const cancelBtn = document.getElementById(cancelBtnId);

  if (openBtn) openBtn.onclick = () => modal?.classList.remove("hidden");
  if (cancelBtn) cancelBtn.onclick = () => modal?.classList.add("hidden");
  if (submitBtn) {
    submitBtn.onclick = async () => {
      const success = await onSubmit();
      if (success) modal?.classList.add("hidden");
    };
  }
}

async function sendCurrentMessage() {
  const input = document.getElementById("channelMessageInput");
  const channelId = window.currentChannelId;
  if (!channelId) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  try {
    const res = await sendChannelMessage(channelId, text);
    if (res.error) {
      alert(res.error);
      input.value = text;
      return;
    }
  } catch (err) {
    console.error("Ошибка отправки:", err);
    input.value = text;
  }
}

async function loadServers() {
  const data = await getMyServers();
  if (data.error) {
    renderServerList([]);
    return;
  }
  renderServerList(data.servers);

  const socket = getSocket();
  if (socket) {
    data.servers.forEach((server) => {
      socket.emit("subscribeServer", { serverId: server.id });
    });
  }
}

// Рендер участников
function renderMembers(members) {
  const container = document.getElementById("membersList");
  const countEl = document.getElementById("membersCount");
  if (!container) return;
  container.innerHTML = "";
  if (countEl) countEl.textContent = members.length;

  const groups = { owner: [], admin: [], member: [] };
  const roleLabels = { owner: "Владелец", admin: "Администраторы", member: "Участники" };

  members.forEach((m) => {
    if (groups[m.role]) groups[m.role].push(m);
    else groups.member.push(m);
  });

  for (const [role, list] of Object.entries(groups)) {
    if (list.length === 0) continue;
    const section = document.createElement("div");
    section.className = "member-section";
    section.innerHTML = `<div class="member-section-title">${roleLabels[role]}</div>`;

    list.forEach((m) => {
      const status = m.onlineStatus || "offline";
      const hasImage = m.avatar ? true : false;
      const bgStyle = hasImage
        ? `background-image:url(http://localhost:3000/${m.avatar.replace(/^\/+/, "")});background-size:cover;`
        : `background-color:#5865f2;`;
      const letter = hasImage ? "" : m.username.charAt(0).toUpperCase();
      const imageClass = hasImage ? "has-image" : "";

      const div = document.createElement("div");
      div.className = "member-item";
      div.dataset.userId = m.id;
      div.innerHTML = `
        <div class="member-avatar ${imageClass}" style="${bgStyle}">
          ${letter}
          <span class="status-dot ${status}"></span>
        </div>
        <span class="member-name ${role}">${m.username}</span>
      `;

      div.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (m.id !== myId) {
          startChatWithUser(m.id);
        }
      });

      section.appendChild(div);
    });
    container.appendChild(section);
  }
}

async function loadMembers(serverId) {
  try {
    const token = getToken();
    const res = await fetch(`http://localhost:3000/servers/${serverId}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.members) {
      serverMembers = data.members;
      renderMembers(serverMembers);
    }
  } catch (err) {
    console.error("Ошибка загрузки участников:", err);
  }
}

// Выбрать сервер
async function selectServer(serverId) {
  window.currentServerId = serverId;

  document.querySelectorAll(".server-icon").forEach((el) => el.classList.remove("active"));
  const activeEl = document.querySelector(`.server-icon[data-server="${serverId}"]`);
  if (activeEl) activeEl.classList.add("active");

  const { getServer } = await import("./api/servers.js");
  const data = await getServer(serverId);
  if (data.error) {
    alert(data.error);
    return;
  }

  window.currentServerName = data.server.name;

  const { renderChannelList } = await import("./ui/channelUI.js");
  renderChannelList(data.server.channels);

  // Показать панель чата
  document.getElementById("serverChatWindow")?.classList.remove("hidden");

  // Загружаем участников
  loadMembers(serverId);

  // Загрузить непрочитанные
  const unreadData = await getUnreadSummary();
  window.unreadSummary = unreadData.summary || {};

  // Подписываемся на сервер
  const socket = getSocket();
  if (socket) socket.emit("subscribeServer", { serverId });
}

// Начать ЛС с пользователем
async function startChatWithUser(targetId) {
  const data = await apiOpenChat(targetId);
  if (data.error) {
    alert(data.error);
    return;
  }
  alert("Чат создан! Перейдите в ЛС.");
  window.location.href = "chat.html";
}

window.selectServer = selectServer;
window.startChatWithUser = startChatWithUser;
window.currentServerId = null;
window.currentChannelId = null;
window.currentServerName = "";

async function init() {
  try {
    await initSocket();
    const socket = getSocket();
    if (socket) {
      socket.on("newChannelMessage", (message) => {
        if (message.channelId === window.currentChannelId) {
          addChannelMessageToUI(message, myId);
        }
        if (message.mentions && message.mentions.includes(myId) && message.senderId !== myId) {
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
      });

      socket.on("userStatusChanged", (data) => {
        const member = serverMembers.find((m) => m.id === data.userId);
        if (member) {
          member.onlineStatus = data.status;
          renderMembers(serverMembers);
        }
      });

      socket.on("channelReactionUpdated", (data) => {
        if (data.channelId === window.currentChannelId) {
          updateChannelReactions(data.messageId, data.reactions);
        }
      });

      // Typing indicator
      const typingUsers = new Map();
      const usernameCache = {}; // userId -> username

      async function resolveUsername(userId) {
        if (usernameCache[userId]) return usernameCache[userId];
        try {
          const token = getToken();
          const res = await fetch(`http://localhost:3000/users/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.user) {
            usernameCache[userId] = data.user.username;
            return data.user.username;
          }
        } catch (e) {
          console.error("[typing] resolveUsername error:", e);
        }
        return "Кто-то";
      }

      socket.on("userTyping", async (data) => {
        console.log("[typing] userTyping:", data.userId, "channel:", data.channelId);
        if (data.channelId !== window.currentChannelId || data.userId === myId) return;

        const username = await resolveUsername(data.userId);
        console.log("[typing] username:", username);

        if (!typingUsers.has(data.channelId)) {
          typingUsers.set(data.channelId, new Map());
        }
        typingUsers.get(data.channelId).set(data.userId, username);

        updateTypingIndicator(typingUsers.get(data.channelId));
      });

      socket.on("userStoppedTyping", (data) => {
        console.log("[typing] userStoppedTyping:", data.userId);
        if (data.channelId !== window.currentChannelId) return;
        const chTyping = typingUsers.get(data.channelId);
        if (chTyping) chTyping.delete(data.userId);
        updateTypingIndicator(chTyping || new Map());
      });

      function updateTypingIndicator(users) {
        const el = document.getElementById("typingIndicator");
        console.log("[typing] updateTypingIndicator element:", el);
        if (!el) return;
        const names = Array.from(users.values());
        console.log("[typing] updateTypingIndicator names:", names);
        if (names.length === 0) {
          el.style.display = "none";
          el.textContent = "";
        } else if (names.length === 1) {
          el.style.display = "inline";
          el.textContent = `${names[0]} печатает...`;
        } else if (names.length === 2) {
          el.style.display = "inline";
          el.textContent = `${names[0]} и ${names[1]} печатают...`;
        } else {
          el.style.display = "inline";
          el.textContent = `Несколько человек печатают...`;
        }
      }

      socket.on("unreadSummaryUpdated", (data) => {
        window.unreadSummary = data.summary;
        // Обновить бейджи напрямую в DOM без перерисовки каналов
        updateUnreadBadges();
      });

      function updateUnreadBadges() {
        const summary = window.unreadSummary || {};
        document.querySelectorAll(".channel-item").forEach((el) => {
          const chId = el.dataset.channel;
          const count = summary[chId] || 0;
          let badge = el.querySelector(".unread-badge");
          const nameSpan = el.querySelector(".channel-item span:last-child") || el.querySelector("span");
          if (count > 0) {
            if (!badge) {
              badge = document.createElement("span");
              badge.className = "unread-badge";
              el.appendChild(badge);
            }
            badge.textContent = count > 99 ? "99+" : count;
            if (nameSpan) nameSpan.classList.add("channel-item-unread");
          } else {
            if (badge) badge.remove();
            if (nameSpan) nameSpan.classList.remove("channel-item-unread");
          }
        });
      }

      // Heartbeat каждые 30 сек
      setInterval(() => socket.emit("heartbeat"), 30000);
    }
  } catch (err) {
    console.warn("Socket.IO недоступен:", err);
  }

  loadServers();
}

init();

// === Голосовой канал — Discord-style ===
let isInVoice = false;
let isScreenSharing = false;
let callStartTime = null;
let callTimerInterval = null;
const voiceParticipants = new Map();

initVoiceListeners(
  (data) => {
    console.log("[voice] Peer joined:", data);
    const { peerId, userId } = data;
    const member = serverMembers.find((m) => m.id === userId);
    if (member) {
      addParticipant(peerId, member.id, member.username, member.avatar);
    }
  },
  (peerId) => {
    console.log("[voice] Peer left:", peerId);
    voiceParticipants.delete(peerId);
    renderVoiceParticipants();
  },
  () => {
    const sc = document.getElementById("voiceScreenShareContainer");
    if (sc) sc.style.display = "block";
    renderVoiceParticipants();
  },
  () => {
    const sc = document.getElementById("voiceScreenShareContainer");
    if (sc) {
      sc.style.display = "none";
      sc.innerHTML = "";
    }
    const btn = document.getElementById("callScreenShareBtn");
    if (btn) btn.classList.remove("sharing-btn");
    isScreenSharing = false;
    renderVoiceParticipants();
  }
);

const voiceCallModal = document.getElementById("voiceCallModal");
const voiceParticipantsGrid = document.getElementById("voiceParticipants");
const callDurationEl = document.getElementById("callDuration");
const callMuteBtn = document.getElementById("callMuteBtn");
const callMuteIcon = document.getElementById("callMuteIcon");
const callScreenShareBtn = document.getElementById("callScreenShareBtn");
const callScreenIcon = document.getElementById("callScreenIcon");
const callLeaveBtn = document.getElementById("callLeaveBtn");

function openVoiceModal() {
  voiceCallModal.style.display = "flex";
  callStartTime = Date.now();
  stopCallTimer();
  callTimerInterval = setInterval(() => {
    if (!callStartTime) return;
    const e = Math.floor((Date.now() - callStartTime) / 1000);
    if (callDurationEl) callDurationEl.textContent = `${String(Math.floor(e / 60)).padStart(2, "0")}:${String(e % 60).padStart(2, "0")}`;
  }, 1000);
  renderVoiceParticipants();
}

function closeVoiceModal() {
  voiceCallModal.style.display = "none";
  stopCallTimer();
  voiceParticipantsGrid.innerHTML = "";
  const sc = document.getElementById("voiceScreenShareContainer");
  if (sc) {
    sc.style.display = "none";
    sc.innerHTML = "";
  }
}
function stopCallTimer() {
  if (callTimerInterval) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
  }
}

function addParticipant(socketId, userId, username, avatar) {
  voiceParticipants.set(socketId, { userId, username, avatar, socketId });
  renderVoiceParticipants();
}

function renderVoiceParticipants() {
  if (!voiceParticipantsGrid) return;
  voiceParticipantsGrid.innerHTML = "";

  const myUsername = localStorage.getItem("lastUsername") || "Я";
  const myAvatar = localStorage.getItem("userAvatar") || "";
  voiceParticipantsGrid.appendChild(createParticipantEl(myId, "Вы", myAvatar, isMuted(), false));

  const sharerId = getScreenSharerId();
  for (const [socketId, info] of voiceParticipants) {
    if (info.userId === myId) continue;
    voiceParticipantsGrid.appendChild(createParticipantEl(info.userId, info.username, info.avatar, false, sharerId === socketId));
  }
}

function createParticipantEl(userId, username, avatar, muted, isSharing) {
  const div = document.createElement("div");
  div.className = `voice-participant${isSharing ? " screen-sharing" : ""}`;
  const avUrl = avatar && !avatar.startsWith("http") ? `http://localhost:3000/${avatar.replace(/^\/+/, "")}` : avatar;
  const avStyle = avUrl ? `background-image:url(${avUrl});background-size:cover;` : `background:#5865f2;`;
  const letter = avUrl ? "" : username.charAt(0).toUpperCase();
  const mutedHtml = muted ? '<span class="status-indicator muted">🔇</span>' : "";
  div.innerHTML = `<div class="participant-avatar" style="${avStyle}">${letter}${mutedHtml}</div><span class="participant-name">${username}${
    isSharing ? " 🖥️" : ""
  }</span>`;
  return div;
}

window.joinVoice = async function () {
  if (isInVoice || !window.currentChannelId) return;
  try {
    await joinVoiceChannel(window.currentChannelId);
    isInVoice = true;
    openVoiceModal();
  } catch {
    alert("Нет доступа к микрофону");
  }
};

window.leaveVoice = function () {
  if (!isInVoice || !window.currentChannelId) return;
  leaveVoiceChannel(window.currentChannelId);
  isInVoice = false;
  isScreenSharing = false;
  voiceParticipants.clear();
  closeVoiceModal();
};

if (callMuteBtn) {
  callMuteBtn.onclick = () => {
    const muted = toggleMute();
    callMuteIcon.textContent = muted ? "🔇" : "🎤";
    callMuteBtn.classList.toggle("muted-btn", muted);
  };
}

if (callScreenShareBtn) {
  callScreenShareBtn.onclick = async () => {
    if (isScreenSharing) {
      stopScreenShare(window.currentChannelId);
      isScreenSharing = false;
      callScreenShareBtn.classList.remove("sharing-btn");
      return;
    }
    try {
      await startScreenShare(window.currentChannelId);
      isScreenSharing = true;
      callScreenShareBtn.classList.add("sharing-btn");
      const sc = document.getElementById("voiceScreenShareContainer");
      if (sc) sc.style.display = "block";
      renderVoiceParticipants();
    } catch (e) {
      console.error("[screen]", e);
    }
  };
}

if (callLeaveBtn) callLeaveBtn.onclick = () => window.leaveVoice();
