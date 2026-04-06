const { verify } = require("../utils/jwt");
const path = require("path");
const fs = require("fs-extra");

const USERS_FILE = path.join(__dirname, "../db/users.json");

async function loadUsers() {
  await fs.ensureFile(USERS_FILE);
  const data = await fs.readFile(USERS_FILE, "utf8");
  if (!data.trim()) return [];
  return JSON.parse(data);
}

async function authCheck(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Нет токена" });
  }

  const token = authHeader.replace("Bearer ", "");
  const decoded = verify(token);

  if (!decoded) {
    return res.status(401).json({ error: "Неверный токен" });
  }

  const users = await loadUsers();
  const user = users.find((u) => u.id === decoded.id);

  if (!user) {
    return res.status(401).json({ error: "Пользователь не найден" });
  }

  req.user = user;
  next();
}

module.exports = authCheck;
