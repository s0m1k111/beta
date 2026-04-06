import { getToken } from "../utils/storage.js";

const API_URL = "http://localhost:3000";

export async function getMessages(chatId) {
  const token = getToken();

  const res = await fetch(`${API_URL}/dm/${chatId}/messages`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}

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
