import { getToken } from "../utils/storage.js";

const API_URL = "http://localhost:3000";

export async function getChatList() {
  const token = getToken();

  const res = await fetch(`${API_URL}/dm/list`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}
