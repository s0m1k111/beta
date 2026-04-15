import { getToken } from "../utils/storage.js";

let socket = null;

export function initSocket() {
  return new Promise((resolve, reject) => {
    try {
      const token = getToken();
      if (!token) {
        reject(new Error("Нет токена"));
        return;
      }

      // Проверяем, что socket.io загружен из CDN
      if (typeof io === "undefined") {
        reject(new Error("Socket.IO не загружен из CDN"));
        return;
      }

      socket = io("http://localhost:3000", {
        auth: { token },
      });

      socket.on("connect", () => {
        console.log("Socket.IO подключён, ID:", socket.id);
        resolve(socket);
      });

      socket.on("connect_error", (err) => {
        console.warn("Socket.IO ошибка подключения:", err.message);
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
