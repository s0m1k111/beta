import { login } from "./api/auth.js";
import { saveToken } from "./utils/storage.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    const result = await login(email, password);

    if (result.token) {
      saveToken(result.token);
      window.location.href = "chat.html";
    } else {
      alert(result.error || "Неверный email или пароль");
    }
  });
});
