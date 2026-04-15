const userService = require("./userService");
const friendService = require("../friends/friendService");

let io = null;
function setIo(ioRef) {
  io = ioRef;
}

async function getProfile(req, res) {
  try {
    const user = req.user; // authCheck уже положил сюда данные
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: "Ошибка получения профиля" });
  }
}

async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const updates = req.body;

    const updatedUser = await userService.updateUser(userId, updates);

    if (!updatedUser) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    res.json({ user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: "Ошибка обновления профиля" });
  }
}

async function getUserById(req, res) {
  try {
    const targetId = req.params.id;
    const currentUserId = req.user.id;

    const user = await userService.getUserById(targetId);

    if (!user) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    // Получаем статус отношений
    const relationship = await friendService.getRelationshipStatus(currentUserId, targetId);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar || null,
      },
      relationship,
    });
  } catch (err) {
    res.status(500).json({ error: "Ошибка получения пользователя" });
  }
}

async function searchUsers(req, res) {
  try {
    const query = (req.query.query || "").toLowerCase();
    const currentUserId = req.user.id;

    if (!query.trim()) {
      return res.json({ results: [] });
    }

    const users = await userService.getAllUsers();

    const results = users
      .filter((u) => u.id !== currentUserId && (u.username.toLowerCase().includes(query) || u.email.toLowerCase().includes(query)))
      .map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        avatar: u.avatar,
      }));

    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: "Ошибка поиска пользователей" });
  }
}

async function uploadAvatar(req, res) {
  try {
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "Файл не загружен" });
    }

    // Формируем URL-путь
    const avatarUrl = `/uploads/avatars/${file.filename}`;

    const updatedUser = await userService.updateUser(userId, {
      avatar: avatarUrl,
    });

    // Broadcast: аватар обновлён
    if (io) {
      io.emit("userAvatarUpdated", {
        userId: updatedUser.id,
        avatar: avatarUrl,
      });
    }

    res.json({ user: updatedUser });
  } catch (err) {
    console.error("uploadAvatar error:", err);
    res.status(500).json({ error: "Ошибка загрузки аватара" });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  getUserById,
  searchUsers,
  uploadAvatar,
  setIo,
};
