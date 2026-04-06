// frontend/js/theme.js

// Восстанавливаем тему из localStorage
const root = document.documentElement;
const saved = localStorage.getItem("theme");
if (saved === "dark" || saved === "light") {
  root.setAttribute("data-theme", saved);
} else {
  root.setAttribute("data-theme", "light");
}

function toggleTheme() {
  const current = root.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
}

window.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.addEventListener("click", toggleTheme);
  }
});
