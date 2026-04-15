import { getToken } from "../utils/storage.js";

const API_URL = "http://localhost:3000";

// Получить список чатов пользователя
export async function getChatList() {
  const token = getToken();

  const res = await fetch(`${API_URL}/dm/list`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}

// Открыть или создать чат с пользователем
export async function openChat(targetId) {
  const token = getToken();

  const res = await fetch(`${API_URL}/dm/open`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ targetId }),
  });

  return res.json();
}

// Получить сообщения чата
export async function getMessages(chatId) {
  const token = getToken();

  const res = await fetch(`${API_URL}/dm/${chatId}/messages`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}

// Отправить сообщение
export async function sendMessage(chatId, text) {
  const token = getToken();

  const res = await fetch(`${API_URL}/dm/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ chatId, text }),
  });

  return res.json();
}
