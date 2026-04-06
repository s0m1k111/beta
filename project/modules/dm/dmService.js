const path = require("path");
const fs = require("fs-extra");

const CHATS_FILE = path.join(__dirname, "./chats.json");
const userService = require("../users/userService");

async function loadChats() {
  await fs.ensureFile(CHATS_FILE);
  const data = await fs.readFile(CHATS_FILE, "utf8");
  if (!data.trim()) return [];
  return JSON.parse(data);
}

async function saveChats(chats) {
  await fs.writeFile(CHATS_FILE, JSON.stringify(chats, null, 2));
}

function generateId(prefix = "chat") {
  return prefix + "_" + Math.random().toString(36).substring(2, 10);
}

// Найти или создать чат между двумя пользователями
async function openChat(user1, user2) {
  const chats = await loadChats();

  let chat = chats.find((c) => c.members.includes(user1) && c.members.includes(user2) && c.members.length === 2);

  if (!chat) {
    chat = {
      id: generateId(),
      members: [user1, user2],
      messages: [],
    };

    chats.push(chat);
    await saveChats(chats);
  }

  return chat;
}

// Отправить сообщение
async function sendMessage(chatId, senderId, text) {
  const chats = await loadChats();
  const chat = chats.find((c) => c.id === chatId);

  if (!chat) return { error: "Чат не найден" };

  const message = {
    id: generateId("msg"),
    senderId,
    text,
    timestamp: Date.now(),
  };

  chat.messages.push(message);
  await saveChats(chats);

  return message;
}

// Получить историю сообщений
async function getMessages(chatId) {
  const chats = await loadChats();
  const chat = chats.find((c) => c.id === chatId);

  if (!chat) return null;

  return chat.messages;
}

// Получить список чатов пользователя
async function getUserChats(userId) {
  const chats = await loadChats();

  // Фильтруем чаты, где участвует пользователь
  const userChats = chats.filter((c) => c.members.includes(userId));

  const result = [];

  for (const chat of userChats) {
    // Находим собеседника
    const partnerId = chat.members.find((m) => m !== userId);
    const partner = await userService.getUserById(partnerId);

    // Находим последнее сообщение
    const lastMessage = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1] : null;

    result.push({
      chatId: chat.id,
      partner: partner
        ? {
            id: partner.id,
            username: partner.username,
            avatar: partner.avatar || null,
          }
        : null,
      lastMessage: lastMessage
        ? {
            text: lastMessage.text,
            timestamp: lastMessage.timestamp,
          }
        : null,
    });
  }

  // Сортировка по последнему сообщению
  result.sort((a, b) => {
    const t1 = a.lastMessage ? a.lastMessage.timestamp : 0;
    const t2 = b.lastMessage ? b.lastMessage.timestamp : 0;
    return t2 - t1;
  });

  return result;
}

module.exports = {
  openChat,
  sendMessage,
  getMessages,
  getUserChats,
};
