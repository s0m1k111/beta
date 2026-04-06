const path = require("path");
const fs = require("fs-extra");

const USERS_FILE = path.join(__dirname, "../../db/users.json");

async function loadUsers() {
  await fs.ensureFile(USERS_FILE);
  const data = await fs.readFile(USERS_FILE, "utf8");
  if (!data.trim()) return [];
  return JSON.parse(data);
}

async function saveUsers(users) {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

async function getUserById(id) {
  const users = await loadUsers();
  return users.find((u) => u.id === id) || null;
}

async function updateUser(id, updates) {
  const users = await loadUsers();
  const index = users.findIndex((u) => u.id === id);

  if (index === -1) return null;

  users[index] = { ...users[index], ...updates };
  await saveUsers(users);

  return users[index];
}

async function getAllUsers() {
  return await loadUsers();
}

module.exports = {
  loadUsers,
  saveUsers,
  getUserById,
  updateUser,
  getAllUsers,
};
