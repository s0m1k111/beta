import { getToken } from "../utils/storage.js";

const API_URL = "http://localhost:3000";

// Получить мои серверы
export async function getMyServers() {
  const token = getToken();
  const res = await fetch(`${API_URL}/servers/my`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// Создать сервер
export async function createServer(name, icon) {
  const token = getToken();
  const res = await fetch(`${API_URL}/servers/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, icon }),
  });
  return res.json();
}

// Получить сервер по ID
export async function getServer(serverId) {
  const token = getToken();
  const res = await fetch(`${API_URL}/servers/${serverId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// Присоединиться к серверу
export async function joinServer(serverId, inviteCode) {
  const token = getToken();
  const res = await fetch(`${API_URL}/servers/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ serverId, inviteCode }),
  });
  return res.json();
}

// Покинуть сервер
export async function leaveServer(serverId) {
  const token = getToken();
  const res = await fetch(`${API_URL}/servers/leave`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ serverId }),
  });
  return res.json();
}

// Удалить сервер
export async function deleteServer(serverId) {
  const token = getToken();
  const res = await fetch(`${API_URL}/servers/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ serverId }),
  });
  return res.json();
}

// Получить участников сервера
export async function getServerMembers(serverId) {
  const token = getToken();
  const res = await fetch(`${API_URL}/servers/${serverId}/members`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// === Каналы ===

// Создать канал
export async function createChannel(serverId, name, type = "text") {
  const token = getToken();
  const res = await fetch(`${API_URL}/channels/${serverId}/channels`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, type }),
  });
  return res.json();
}

// Удалить канал
export async function deleteChannel(serverId, channelId) {
  const token = getToken();
  const res = await fetch(`${API_URL}/channels/${serverId}/channels/${channelId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// Переименовать канал
export async function renameChannel(serverId, channelId, name) {
  const token = getToken();
  const res = await fetch(`${API_URL}/channels/${serverId}/channels/${channelId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

// Получить сообщения канала
export async function getChannelMessages(channelId) {
  const token = getToken();
  const res = await fetch(`${API_URL}/channels/channels/${channelId}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// Отправить сообщение в канал
export async function sendChannelMessage(channelId, text, image) {
  const token = getToken();
  const res = await fetch(`${API_URL}/channels/channels/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channelId, text, image }),
  });
  return res.json();
}

// Отметить канал как прочитанный
export async function markChannelAsRead(channelId) {
  const token = getToken();
  const res = await fetch(`${API_URL}/channels/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channelId }),
  });
  return res.json();
}

// Получить сводку непрочитанных
export async function getUnreadSummary() {
  const token = getToken();
  const res = await fetch(`${API_URL}/channels/unread`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}
