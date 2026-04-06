const path = require("path");
const fs = require("fs-extra");

const { generateId } = require("../../utils/fileId");
const { hashPassword, comparePassword } = require("../../utils/hash");
const { sign } = require("../../utils/jwt");
const { validateEmail, validatePassword, validateUsername } = require("../../utils/validate");

const USERS_FILE = path.join(__dirname, "../../db/users.json");

/**
 * Загружает всех пользователей
 */
async function loadUsers() {
  await fs.ensureFile(USERS_FILE);

  const data = await fs.readFile(USERS_FILE, "utf8");
  if (!data.trim()) return [];

  return JSON.parse(data);
}

/**
 * Сохраняет всех пользователей
 */
async function saveUsers(users) {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

/**
 * Регистрация пользователя
 */
async function register({ email, username, password }) {
  // Валидация
  const emailCheck = validateEmail(email);
  if (emailCheck !== true) return { error: emailCheck };

  const usernameCheck = validateUsername(username);
  if (usernameCheck !== true) return { error: usernameCheck };

  const passwordCheck = validatePassword(password);
  if (passwordCheck !== true) return { error: passwordCheck };

  const users = await loadUsers();

  // Проверка, что email не занят
  if (users.some((u) => u.email === email)) {
    return { error: "Email уже используется" };
  }

  // Создаём пользователя
  const newUser = {
    id: generateId("u"),
    email,
    username,
    password: await hashPassword(password),
    avatar: null,
    createdAt: Date.now(),
  };

  users.push(newUser);
  await saveUsers(users);

  // Создаём токен
  const token = sign({ id: newUser.id });

  return {
    user: {
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      avatar: newUser.avatar,
    },
    token,
  };
}

/**
 * Логин пользователя
 */
async function login({ email, password }) {
  const users = await loadUsers();

  const user = users.find((u) => u.email === email);
  if (!user) return { error: "Неверный email или пароль" };

  const isValid = await comparePassword(password, user.password);
  if (!isValid) return { error: "Неверный email или пароль" };

  const token = sign({ id: user.id });

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
    },
    token,
  };
}

module.exports = {
  register,
  login,
};
