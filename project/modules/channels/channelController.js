const channelService = require("./channelService");
const serverService = require("./serverService");
const userService = require("../users/userService");
const unreadService = require("./unreadService");

let io = null;

function setIo(ioRef) {
  io = ioRef;
}

// Найти сервер по channelId
function findServerByChannel(channelId) {
  return serverService.loadServers().then((servers) => {
    for (const server of servers) {
      if (server.channels.some((ch) => ch.id === channelId)) {
        return server;
      }
    }
    return null;
  });
}

// Создать канал
async function createChannel(req, res) {
  try {
    const userId = req.user.id;
    const { serverId } = req.params;
    const { name, type } = req.body;

    const result = await channelService.createChannel(serverId, userId, { name, type });
    if (result.error) return res.status(403).json({ error: result.error });

    res.status(201).json({ channel: result });
  } catch (err) {
    console.error("createChannel error:", err);
    res.status(500).json({ error: "Ошибка создания канала" });
  }
}

// Удалить канал
async function deleteChannel(req, res) {
  try {
    const userId = req.user.id;
    const { serverId, channelId } = req.params;

    const result = await channelService.deleteChannel(serverId, userId, channelId);
    if (result.error) return res.status(403).json({ error: result.error });

    res.json(result);
  } catch (err) {
    console.error("deleteChannel error:", err);
    res.status(500).json({ error: "Ошибка удаления канала" });
  }
}

// Переименовать канал
async function renameChannel(req, res) {
  try {
    const userId = req.user.id;
    const { serverId, channelId } = req.params;
    const { name } = req.body;

    const result = await channelService.renameChannel(serverId, userId, channelId, name);
    if (result.error) return res.status(403).json({ error: result.error });

    res.json(result);
  } catch (err) {
    console.error("renameChannel error:", err);
    res.status(500).json({ error: "Ошибка переименования канала" });
  }
}

// Получить сообщения канала
async function getMessages(req, res) {
  try {
    const { channelId } = req.params;
    const messages = await channelService.getChannelMessages(channelId);
    res.json({ messages });
  } catch (err) {
    console.error("getMessages error:", err);
    res.status(500).json({ error: "Ошибка получения сообщений" });
  }
}

// Отправить сообщение в канал
async function sendMessage(req, res) {
  try {
    const userId = req.user.id;
    const { channelId, text, image } = req.body;

    console.log("[sendMessage] channelId:", channelId, "text:", text, "image:", image);

    if (!channelId || (!text && !image)) {
      console.log("[sendMessage] Валидация не прошла!");
      return res.status(400).json({ error: "channelId и text/image обязательны" });
    }

    const message = await channelService.sendChannelMessage(channelId, userId, text || "", image);
    console.log("[sendMessage] Результат:", message);
    if (message.error) return res.status(404).json({ error: message.error });

    // Отправляем через Socket.IO всем участникам сервера
    if (io) {
      const server = await findServerByChannel(channelId);
      if (server) {
        const sender = await userService.getUserById(userId);
        const roomName = `server_${server.id}`;

        // Инкремент непрочитанных для всех кроме отправителя
        for (const member of server.members) {
          if (member.userId !== userId) {
            await unreadService.incrementUnread(member.userId, channelId, message.id);
          }
        }

        io.to(roomName).emit("newChannelMessage", {
          ...message,
          senderName: sender ? sender.username : "Неизвестный",
          serverId: server.id,
          serverName: server.name,
          channelId,
        });

        // Broadcast unread summary обновлён
        for (const member of server.members) {
          if (member.userId !== userId) {
            const summary = await unreadService.getUnreadSummary(member.userId);
            // Эмитим в комнату сервера — клиент сам отфильтрует
            io.to(roomName).emit("unreadSummaryUpdated", { summary });
          }
        }
      }
    }

    res.json({ message });
  } catch (err) {
    console.error("sendMessage error:", err);
    res.status(500).json({ error: "Ошибка отправки сообщения" });
  }
}

// Редактировать сообщение
async function editMessage(req, res) {
  try {
    const userId = req.user.id;
    const { channelId, messageId } = req.params;
    const { text } = req.body;

    const result = await channelService.editMessage(channelId, messageId, userId, text);
    if (result.error) return res.status(403).json({ error: result.error });

    res.json(result);
  } catch (err) {
    console.error("editMessage error:", err);
    res.status(500).json({ error: "Ошибка редактирования" });
  }
}

// Удалить сообщение
async function deleteMessage(req, res) {
  try {
    const userId = req.user.id;
    const { channelId, messageId } = req.params;

    const servers = await serverService.loadServers();
    let isAdmin = false;
    for (const server of servers) {
      const hasChannel = server.channels.some((ch) => ch.id === channelId);
      if (hasChannel) {
        const member = server.members.find((m) => m.userId === userId);
        if (member && (member.role === "owner" || member.role === "admin")) isAdmin = true;
        break;
      }
    }

    const result = await channelService.deleteMessage(channelId, messageId, userId, isAdmin);
    if (result.error) return res.status(403).json({ error: result.error });
    res.json(result);
  } catch (err) {
    console.error("deleteMessage error:", err);
    res.status(500).json({ error: "Ошибка удаления" });
  }
}

// Добавить реакцию
async function addReaction(req, res) {
  try {
    const userId = req.user.id;
    const { channelId, messageId, emoji } = req.params;
    const result = await channelService.addReaction(channelId, messageId, userId, decodeURIComponent(emoji));
    if (result.error) return res.status(404).json({ error: result.error });

    // Broadcast
    if (io) {
      io.emit("channelReactionUpdated", { messageId, reactions: result.reactions, channelId });
    }

    res.json(result);
  } catch (err) {
    console.error("addReaction error:", err);
    res.status(500).json({ error: "Ошибка добавления реакции" });
  }
}

// Убрать реакцию
async function removeReaction(req, res) {
  try {
    const userId = req.user.id;
    const { channelId, messageId, emoji } = req.params;
    const result = await channelService.removeReaction(channelId, messageId, userId, decodeURIComponent(emoji));
    if (result.error) return res.status(404).json({ error: result.error });

    // Broadcast
    if (io) {
      io.emit("channelReactionUpdated", { messageId, reactions: result.reactions, channelId });
    }

    res.json(result);
  } catch (err) {
    console.error("removeReaction error:", err);
    res.status(500).json({ error: "Ошибка удаления реакции" });
  }
}

module.exports = {
  createChannel,
  deleteChannel,
  renameChannel,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  uploadImage,
  markAsRead,
  getUnreadSummary,
  setIo,
};

async function markAsRead(req, res) {
  try {
    const userId = req.user.id;
    const { channelId } = req.body;
    if (!channelId) return res.status(400).json({ error: "channelId обязателен" });
    const result = await unreadService.markAsRead(userId, channelId);
    res.json(result);
  } catch (err) {
    console.error("markAsRead error:", err);
    res.status(500).json({ error: "Ошибка отметки прочитанного" });
  }
}

async function getUnreadSummary(req, res) {
  try {
    const userId = req.user.id;
    const summary = await unreadService.getUnreadSummary(userId);
    res.json({ summary });
  } catch (err) {
    console.error("getUnreadSummary error:", err);
    res.status(500).json({ error: "Ошибка получения сводки" });
  }
}

async function uploadImage(req, res) {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Файл не загружен" });
    const imageUrl = `/uploads/channel_images/${file.filename}`;
    res.json({ imageUrl });
  } catch (err) {
    console.error("uploadImage error:", err);
    res.status(500).json({ error: "Ошибка загрузки изображения" });
  }
}
