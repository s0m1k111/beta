const path = require("path");
const fs = require("fs-extra");
const serverService = require("./serverService");
const userService = require("../users/userService");

const MESSAGES_FILE = path.join(__dirname, "../../db/channel_messages.json");

function generateId(prefix = "ch") {
  return prefix + "_" + Math.random().toString(36).substring(2, 10);
}

async function loadMessages() {
  await fs.ensureFile(MESSAGES_FILE);
  const data = await fs.readFile(MESSAGES_FILE, "utf8");
  if (!data.trim()) return {};
  return JSON.parse(data);
}

async function saveMessages(messages) {
  await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

// Создать канал на сервере
async function createChannel(serverId, userId, { name, type }) {
  const servers = await serverService.loadServers();
  const server = servers.find((s) => s.id === serverId);

  if (!server) return { error: "Сервер не найден" };

  // Проверка прав
  const member = server.members.find((m) => m.userId === userId);
  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    return { error: "Нет прав на создание каналов" };
  }

  const channelName = (name || "новый-канал")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-zа-яё0-9\-]/gi, "");

  // Проверка уникальности имени
  if (server.channels.some((ch) => ch.name.toLowerCase() === channelName.toLowerCase())) {
    return { error: "Канал с таким именем уже существует" };
  }

  const newChannel = {
    id: generateId("ch"),
    name: channelName,
    type: type || "text",
    createdAt: Date.now(),
  };

  server.channels.push(newChannel);
  await serverService.saveServers(servers);

  return newChannel;
}

// Удалить канал
async function deleteChannel(serverId, userId, channelId) {
  const servers = await serverService.loadServers();
  const server = servers.find((s) => s.id === serverId);

  if (!server) return { error: "Сервер не найден" };

  const member = server.members.find((m) => m.userId === userId);
  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    return { error: "Нет прав на удаление каналов" };
  }

  // Нельзя удалить general
  const channel = server.channels.find((ch) => ch.id === channelId);
  if (!channel) return { error: "Канал не найден" };
  if (channel.name === "general") return { error: "Нельзя удалить канал #general" };

  server.channels = server.channels.filter((ch) => ch.id !== channelId);
  await serverService.saveServers(servers);

  // Удаляем сообщения канала
  const allMessages = await loadMessages();
  delete allMessages[channelId];
  await saveMessages(allMessages);

  return { success: true };
}

// Переименовать канал
async function renameChannel(serverId, userId, channelId, newName) {
  const servers = await serverService.loadServers();
  const server = servers.find((s) => s.id === serverId);

  if (!server) return { error: "Сервер не найден" };

  const member = server.members.find((m) => m.userId === userId);
  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    return { error: "Нет прав на переименование" };
  }

  const channel = server.channels.find((ch) => ch.id === channelId);
  if (!channel) return { error: "Канал не найден" };
  if (channel.name === "general") return { error: "Нельзя переименовать #general" };

  channel.name = newName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-zа-яё0-9\-]/gi, "");
  await serverService.saveServers(servers);

  return { success: true, channel };
}

// Получить сообщения канала
async function getChannelMessages(channelId) {
  const allMessages = await loadMessages();
  return allMessages[channelId] || [];
}

// Отправить сообщение в канал
async function sendChannelMessage(channelId, senderId, text, imageUrl) {
  const servers = await serverService.loadServers();

  // Находим канал
  let foundChannel = null;
  let foundServer = null;
  for (const server of servers) {
    foundChannel = server.channels.find((ch) => ch.id === channelId);
    if (foundChannel) {
      foundServer = server;
      break;
    }
  }

  if (!foundChannel) return { error: "Канал не найден" };

  // Определяем упоминания
  const members = foundServer ? foundServer.members : [];
  const memberIds = members.map((m) => m.userId);
  const allUsers = await userService.getAllUsers();
  const mentionedUsernames = {};
  allUsers.forEach((u) => {
    mentionedUsernames[u.username.toLowerCase()] = u.id;
  });

  const mentions = [];
  const regex = /@(\w+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const name = match[1].toLowerCase();
    for (const [username, id] of Object.entries(mentionedUsernames)) {
      if ((username === name || username.includes(name)) && memberIds.includes(id) && id !== senderId) {
        if (!mentions.includes(id)) mentions.push(id);
      }
    }
  }

  const allMessages = await loadMessages();
  if (!allMessages[channelId]) allMessages[channelId] = [];

  const message = {
    id: generateId("msg"),
    senderId,
    text: text || "",
    image: imageUrl || undefined,
    timestamp: Date.now(),
    edited: false,
    mentions: mentions.length > 0 ? mentions : undefined,
  };

  allMessages[channelId].push(message);
  await saveMessages(allMessages);

  return { ...message, channelId };
}

// Редактировать сообщение
async function editMessage(channelId, messageId, userId, newText) {
  const allMessages = await loadMessages();
  const messages = allMessages[channelId];

  if (!messages) return { error: "Сообщение не найдено" };

  const msg = messages.find((m) => m.id === messageId);
  if (!msg) return { error: "Сообщение не найдено" };
  if (msg.senderId !== userId) return { error: "Можно редактировать только свои сообщения" };

  msg.text = newText;
  msg.edited = true;
  msg.editedAt = Date.now();

  await saveMessages(allMessages);
  return { success: true, message: msg };
}

// Удалить сообщение
async function deleteMessage(channelId, messageId, userId, isAdmin) {
  const allMessages = await loadMessages();
  const messages = allMessages[channelId];

  if (!messages) return { error: "Сообщение не найдено" };

  const idx = messages.findIndex((m) => m.id === messageId);
  if (idx === -1) return { error: "Сообщение не найдено" };

  if (!isAdmin && messages[idx].senderId !== userId) {
    return { error: "Можно удалять только свои сообщения" };
  }

  messages.splice(idx, 1);
  await saveMessages(allMessages);
  return { success: true };
}

// Добавить реакцию
async function addReaction(channelId, messageId, userId, emoji) {
  const allMessages = await loadMessages();
  const messages = allMessages[channelId];
  if (!messages) return { error: "Сообщение не найдено" };

  const msg = messages.find((m) => m.id === messageId);
  if (!msg) return { error: "Сообщение не найдено" };

  if (!msg.reactions) msg.reactions = [];
  let reaction = msg.reactions.find((r) => r.emoji === emoji);
  if (!reaction) {
    reaction = { emoji, users: [] };
    msg.reactions.push(reaction);
  }
  if (!reaction.users.includes(userId)) {
    reaction.users.push(userId);
  }
  await saveMessages(allMessages);
  return { success: true, reactions: msg.reactions };
}

// Убрать реакцию
async function removeReaction(channelId, messageId, userId, emoji) {
  const allMessages = await loadMessages();
  const messages = allMessages[channelId];
  if (!messages) return { error: "Сообщение не найдено" };

  const msg = messages.find((m) => m.id === messageId);
  if (!msg || !msg.reactions) return { error: "Сообщение не найдено" };

  const reaction = msg.reactions.find((r) => r.emoji === emoji);
  if (reaction) {
    reaction.users = reaction.users.filter((u) => u !== userId);
    if (reaction.users.length === 0) {
      msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji);
    }
  }
  await saveMessages(allMessages);
  return { success: true, reactions: msg.reactions };
}

module.exports = {
  createChannel,
  deleteChannel,
  renameChannel,
  getChannelMessages,
  sendChannelMessage,
  editMessage,
  deleteMessage,
  loadMessages,
  saveMessages,
  addReaction,
  removeReaction,
};
