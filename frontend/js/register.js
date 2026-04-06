import { register } from "./api/auth.js";
import { saveToken } from "./utils/storage.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    const result = await register(email, username, password);

    if (result.token) {
      saveToken(result.token);
      window.location.href = "chat.html";
    } else {
      alert(result.error || "Ошибка регистрации");
    }
  });
});
