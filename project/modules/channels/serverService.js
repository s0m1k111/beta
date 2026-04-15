const path = require("path");
const fs = require("fs-extra");

const SERVERS_FILE = path.join(__dirname, "../../db/servers.json");
const userService = require("../users/userService");

function generateId(prefix = "srv") {
  return prefix + "_" + Math.random().toString(36).substring(2, 10);
}

async function loadServers() {
  await fs.ensureFile(SERVERS_FILE);
  const data = await fs.readFile(SERVERS_FILE, "utf8");
  if (!data.trim()) return [];
  return JSON.parse(data);
}

async function saveServers(servers) {
  await fs.writeFile(SERVERS_FILE, JSON.stringify(servers, null, 2));
}

// Создать сервер
async function createServer(ownerId, { name, icon }) {
  const servers = await loadServers();

  const newServer = {
    id: generateId("srv"),
    name: name || "Новый сервер",
    icon: icon || null,
    ownerId,
    members: [
      {
        userId: ownerId,
        role: "owner",
        joinedAt: Date.now(),
      },
    ],
    channels: [
      {
        id: generateId("ch"),
        name: "general",
        type: "text",
        createdAt: Date.now(),
      },
    ],
    roles: [
      { name: "owner", color: "#d64545", permissions: ["all"] },
      { name: "admin", color: "#e0a030", permissions: ["manage_channels", "kick", "ban", "manage_messages"] },
      { name: "member", color: "#808080", permissions: ["send_messages", "view_channels"] },
    ],
    createdAt: Date.now(),
  };

  servers.push(newServer);
  await saveServers(servers);

  return newServer;
}

// Получить сервер по ID
async function getServerById(serverId) {
  const servers = await loadServers();
  return servers.find((s) => s.id === serverId) || null;
}

// Получить все серверы пользователя
async function getUserServers(userId) {
  const servers = await loadServers();
  const result = [];

  for (const server of servers) {
    const member = server.members.find((m) => m.userId === userId);
    if (member) {
      result.push({
        id: server.id,
        name: server.name,
        icon: server.icon,
        role: member.role,
        channels: server.channels,
        memberCount: server.members.length,
      });
    }
  }

  return result;
}

// Пригласить пользователя на сервер
async function joinServer(serverId, userId, inviteCode) {
  const servers = await loadServers();
  const server = servers.find((s) => s.id === serverId);

  if (!server) return { error: "Сервер не найден" };

  // Проверяем, не состоит ли уже
  if (server.members.some((m) => m.userId === userId)) {
    return { error: "Вы уже на этом сервере" };
  }

  server.members.push({
    userId,
    role: "member",
    joinedAt: Date.now(),
  });

  await saveServers(servers);
  return { success: true, server };
}

// Покинуть сервер
async function leaveServer(serverId, userId) {
  const servers = await loadServers();
  const server = servers.find((s) => s.id === serverId);

  if (!server) return { error: "Сервер не найден" };

  // Владелец не может покинуть — должен удалить сервер
  if (server.ownerId === userId) {
    return { error: "Владелец не может покинуть сервер. Удалите сервер вместо этого." };
  }

  server.members = server.members.filter((m) => m.userId !== userId);

  // Если никого не осталось — удаляем сервер
  if (server.members.length === 0) {
    const idx = servers.indexOf(server);
    servers.splice(idx, 1);
  }

  await saveServers(servers);
  return { success: true };
}

// Удалить сервер
async function deleteServer(serverId, userId) {
  const servers = await loadServers();
  const server = servers.find((s) => s.id === serverId);

  if (!server) return { error: "Сервер не найден" };
  if (server.ownerId !== userId) return { error: "Только владелец может удалить сервер" };

  const idx = servers.indexOf(server);
  servers.splice(idx, 1);

  await saveServers(servers);
  return { success: true };
}

// Получить участников сервера
async function getServerMembers(serverId) {
  const server = await getServerById(serverId);
  if (!server) return null;

  const members = [];
  for (const member of server.members) {
    const user = await userService.getUserById(member.userId);
    if (user) {
      members.push({
        id: user.id,
        username: user.username,
        avatar: user.avatar || null,
        role: member.role,
        joinedAt: member.joinedAt,
      });
    }
  }

  return members;
}

// Изменить роль участника
async function changeMemberRole(serverId, userId, targetId, newRole) {
  const server = await getServerById(serverId);
  if (!server) return { error: "Сервер не найден" };

  // Только владелец и админы могут менять роли
  const member = server.members.find((m) => m.userId === userId);
  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    return { error: "Нет прав на изменение ролей" };
  }

  const target = server.members.find((m) => m.userId === targetId);
  if (!target) return { error: "Пользователь не найден на сервере" };
  if (target.role === "owner") return { error: "Нельзя изменить роль владельца" };

  const validRoles = ["admin", "member"];
  if (!validRoles.includes(newRole)) return { error: "Недопустимая роль" };

  target.role = newRole;
  await saveServers(await loadServers()); // перезаписываем

  return { success: true, role: newRole };
}

module.exports = {
  createServer,
  getServerById,
  getUserServers,
  joinServer,
  leaveServer,
  deleteServer,
  getServerMembers,
  changeMemberRole,
  loadServers,
  saveServers,
  generateId,
};

// Онлайн-статус пользователей (in-memory)
const userOnlineStatus = new Map(); // userId -> { status, lastSeen }

function setUserOnline(userId, status = "online") {
  userOnlineStatus.set(userId, { status, lastSeen: Date.now() });
}

function setUserOffline(userId) {
  userOnlineStatus.set(userId, { status: "offline", lastSeen: Date.now() });
}

function getUserOnlineStatus(userId) {
  const data = userOnlineStatus.get(userId);
  if (!data) return "offline";

  // Если lastSeen > 5 мин — считаем неактивным
  if (data.status === "online" && Date.now() - data.lastSeen > 5 * 60 * 1000) {
    return "idle";
  }

  return data.status;
}

function getAllOnlineStatuses() {
  const result = {};
  userOnlineStatus.forEach((data, userId) => {
    result[userId] = getUserOnlineStatus(userId);
  });
  return result;
}

module.exports = {
  createServer,
  getServerById,
  getUserServers,
  joinServer,
  leaveServer,
  deleteServer,
  getServerMembers,
  changeMemberRole,
  loadServers,
  saveServers,
  generateId,
  setUserOnline,
  setUserOffline,
  getUserOnlineStatus,
  getAllOnlineStatuses,
};
