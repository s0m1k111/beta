const serverService = require("./serverService");
const userService = require("../users/userService");

// Получить участников сервера
async function getMembers(req, res) {
  try {
    const members = await serverService.getServerMembers(req.params.id);
    if (!members) return res.status(404).json({ error: "Сервер не найден" });

    // Добавляем онлайн-статус
    const membersWithStatus = members.map((m) => ({
      ...m,
      onlineStatus: serverService.getUserOnlineStatus(m.id),
    }));

    res.json({ members: membersWithStatus });
  } catch (err) {
    console.error("getMembers error:", err);
    res.status(500).json({ error: "Ошибка получения участников" });
  }
}

// Создать сервер
async function createServer(req, res) {
  try {
    const ownerId = req.user.id;
    const { name, icon } = req.body;

    const server = await serverService.createServer(ownerId, { name, icon });
    res.status(201).json({ server });
  } catch (err) {
    console.error("createServer error:", err);
    res.status(500).json({ error: "Ошибка создания сервера" });
  }
}

// Получить серверы пользователя
async function getMyServers(req, res) {
  try {
    const userId = req.user.id;
    const servers = await serverService.getUserServers(userId);
    res.json({ servers });
  } catch (err) {
    console.error("getMyServers error:", err);
    res.status(500).json({ error: "Ошибка получения серверов" });
  }
}

// Получить сервер по ID
async function getServer(req, res) {
  try {
    const server = await serverService.getServerById(req.params.id);
    if (!server) return res.status(404).json({ error: "Сервер не найден" });

    // Проверяем, что пользователь состоит на сервере
    const member = server.members.find((m) => m.userId === req.user.id);
    if (!member) return res.status(403).json({ error: "Вы не состоите на этом сервере" });

    res.json({ server });
  } catch (err) {
    console.error("getServer error:", err);
    res.status(500).json({ error: "Ошибка получения сервера" });
  }
}

// Присоединиться к серверу
async function joinServer(req, res) {
  try {
    const userId = req.user.id;
    const { serverId, inviteCode } = req.body;

    const result = await serverService.joinServer(serverId, userId, inviteCode);
    if (result.error) return res.status(400).json({ error: result.error });

    res.json(result);
  } catch (err) {
    console.error("joinServer error:", err);
    res.status(500).json({ error: "Ошибка присоединения" });
  }
}

// Покинуть сервер
async function leaveServer(req, res) {
  try {
    const userId = req.user.id;
    const { serverId } = req.body;

    const result = await serverService.leaveServer(serverId, userId);
    if (result.error) return res.status(400).json({ error: result.error });

    res.json(result);
  } catch (err) {
    console.error("leaveServer error:", err);
    res.status(500).json({ error: "Ошибка выхода с сервера" });
  }
}

// Удалить сервер
async function deleteServer(req, res) {
  try {
    const userId = req.user.id;
    const { serverId } = req.body;

    const result = await serverService.deleteServer(serverId, userId);
    if (result.error) return res.status(403).json({ error: result.error });

    res.json(result);
  } catch (err) {
    console.error("deleteServer error:", err);
    res.status(500).json({ error: "Ошибка удаления сервера" });
  }
}

// Получить участников сервера
async function getMembers(req, res) {
  try {
    const members = await serverService.getServerMembers(req.params.id);
    if (!members) return res.status(404).json({ error: "Сервер не найден" });

    res.json({ members });
  } catch (err) {
    console.error("getMembers error:", err);
    res.status(500).json({ error: "Ошибка получения участников" });
  }
}

// Изменить роль
async function changeRole(req, res) {
  try {
    const userId = req.user.id;
    const { serverId } = req.params;
    const { targetId, role } = req.body;

    const result = await serverService.changeMemberRole(serverId, userId, targetId, role);
    if (result.error) return res.status(403).json({ error: result.error });

    res.json(result);
  } catch (err) {
    console.error("changeRole error:", err);
    res.status(500).json({ error: "Ошибка изменения роли" });
  }
}

module.exports = {
  createServer,
  getMyServers,
  getServer,
  joinServer,
  leaveServer,
  deleteServer,
  getMembers,
  changeRole,
};
