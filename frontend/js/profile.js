import { getToken } from "./utils/storage.js";

const API_URL = "http://localhost:3000";

document.addEventListener("DOMContentLoaded", async () => {
  const token = getToken();
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  // Загрузка профиля
  await loadProfile();

  // Загрузка количества серверов
  await loadServersCount();

  // Загрузка количества друзей
  await loadFriendsCount();

  // Статус
  const statusSelect = document.getElementById("statusSelect");
  const savedStatus = localStorage.getItem("userStatus") || "online";
  statusSelect.value = savedStatus;

  statusSelect.addEventListener("change", () => {
    localStorage.setItem("userStatus", statusSelect.value);
    updateStatusVisual(statusSelect.value);
  });

  updateStatusVisual(savedStatus);

  // Био
  const bio = localStorage.getItem("userBio") || "";
  document.getElementById("profileBio").value = bio;

  document.getElementById("saveBioBtn").addEventListener("click", () => {
    const bioText = document.getElementById("profileBio").value.trim();
    localStorage.setItem("userBio", bioText);
    alert("Сохранено!");
  });

  // Загрузка аватарки
  const avatarInput = document.getElementById("avatarUploadInput");
  if (avatarInput) {
    avatarInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("avatar", file);

      const token = getToken();
      try {
        const res = await fetch(`${API_URL}/user/avatar`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await res.json();
        if (data.error) {
          alert(data.error);
          return;
        }

        // Обновляем аватар
        if (data.user && data.user.avatar) {
          // Убираем лишний слеш в начале пути
          const avatarPath = data.user.avatar.replace(/^\/+/, "").replace(/\\/g, "/");
          const avatarUrl = data.user.avatar.startsWith("http") ? data.user.avatar : `${API_URL}/${avatarPath}`;

          const avEl = document.getElementById("profileAvatar");
          avEl.style.backgroundImage = `url(${avatarUrl})`;
          avEl.style.backgroundSize = "cover";
          localStorage.setItem("userAvatar", avatarUrl);
          alert("Аватар обновлён!");
        }
      } catch (err) {
        console.error("Ошибка загрузки аватара:", err);
        alert("Ошибка загрузки аватара");
      }
    });
  }
});

async function loadProfile() {
  try {
    const token = getToken();
    const res = await fetch(`${API_URL}/users/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Ошибка");

    const data = await res.json();
    const user = data.user;

    document.getElementById("profileUsername").textContent = user.username;
    document.getElementById("profileEmail").textContent = user.email;

    // Аватар — первая буква
    const initial = user.username?.charAt(0).toUpperCase() || "?";
    document.getElementById("profileAvatar").textContent = initial;

    if (user.avatar) {
      const avatarPath = user.avatar.replace(/^\/+/, "").replace(/\\/g, "/");
      const avatarUrl = user.avatar.startsWith("http") ? user.avatar : `${API_URL}/${avatarPath}`;
      document.getElementById("profileAvatar").style.backgroundImage = `url(${avatarUrl})`;
      document.getElementById("profileAvatar").style.backgroundSize = "cover";
      localStorage.setItem("userAvatar", avatarUrl);
    }
  } catch (err) {
    console.error("Ошибка загрузки профиля:", err);
    document.getElementById("profileUsername").textContent = "Ошибка";
  }
}

async function loadServersCount() {
  try {
    const token = getToken();
    const res = await fetch(`${API_URL}/servers/my`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    document.getElementById("serversCount").textContent = data.servers?.length || 0;
  } catch {
    document.getElementById("serversCount").textContent = "0";
  }
}

async function loadFriendsCount() {
  try {
    const token = getToken();
    const res = await fetch(`${API_URL}/friends/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    document.getElementById("friendsCount").textContent = data.friends?.length || 0;
  } catch {
    document.getElementById("friendsCount").textContent = "0";
  }
}

function updateStatusVisual(status) {
  const avatar = document.getElementById("profileAvatar");
  avatar.classList.remove("status-online", "status-idle", "status-dnd", "status-offline");
  avatar.classList.add(`status-${status}`);
}
