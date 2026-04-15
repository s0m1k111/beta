const path = require("path");
const fs = require("fs-extra");

const CHATS_FILE = path.join(__dirname, "./chats.json");
const userService = require("../users/userService");
const friendService = require("../friends/friendService");

// Ссылки на io и userSockets — устанавливаются из server.js
let io = null;
let userSockets = null;

function setSocketReferences(ioRef, userSocketsRef) {
  io = ioRef;
  userSockets = userSocketsRef;
}

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
  // Проверяем, являются ли пользователи друзьями
  const status = await friendService.getRelationshipStatus(user1, user2);

  if (status.error) {
    return { error: status.error };
  }

  if (!status.isFriend) {
    return { error: "Вы можете писать только друзьям" };
  }

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

// Найти пользователя по @username в тексте
function detectMentions(text, users) {
  const mentions = [];
  const regex = /@(\w+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const name = match[1].toLowerCase();
    const user = users.find((u) => u.username.toLowerCase() === name || u.username.toLowerCase().includes(name));
    if (user && user.id !== senderId) {
      mentions.push({ userId: user.id, username: user.username });
    }
  }
  return mentions;
}

// Отправить сообщение
async function sendMessage(chatId, senderId, text) {
  const chats = await loadChats();
  const chat = chats.find((c) => c.id === chatId);

  if (!chat) return { error: "Чат не найден" };

  // Проверяем, что отправитель — участник чата
  if (!chat.members.includes(senderId)) {
    return { error: "Вы не участник этого чата" };
  }

  // Определяем упоминания
  const users = await userService.getAllUsers();
  const mentionedUsers = [];
  const regex = /@(\w+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const name = match[1].toLowerCase();
    const user = users.find((u) => u.username.toLowerCase() === name || u.username.toLowerCase().includes(name));
    if (user && user.id !== senderId && !mentionedUsers.find((m) => m.userId === user.id)) {
      mentionedUsers.push({ userId: user.id, username: user.username });
    }
  }

  const message = {
    id: generateId("msg"),
    senderId,
    text,
    timestamp: Date.now(),
    mentions: mentionedUsers.length > 0 ? mentionedUsers.map((m) => m.userId) : undefined,
  };

  chat.messages.push(message);
  await saveChats(chats);

  // Отправляем сообщение всем участникам через Socket.IO
  if (io) {
    const sender = users.find((u) => u.id === senderId);
    const messageWithChat = {
      ...message,
      chatId,
      senderName: sender ? sender.username : "Неизвестный",
    };

    // Находим всех участников чата и отправляем им
    chat.members.forEach((memberId) => {
      const socketId = userSockets?.get(memberId);
      if (socketId) {
        io.to(socketId).emit("newMessage", messageWithChat);
      }
    });
  }

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

// Редактировать сообщение
async function editMessage(messageId, userId, newText) {
  const chats = await loadChats();
  for (const chat of chats) {
    const msg = chat.messages.find((m) => m.id === messageId);
    if (msg) {
      if (msg.senderId !== userId) return { error: "Можно редактировать только свои сообщения" };
      msg.text = newText;
      msg.edited = true;
      msg.editedAt = Date.now();
      await saveChats(chats);
      return { success: true, message: msg };
    }
  }
  return { error: "Сообщение не найдено" };
}

// Удалить сообщение
async function deleteMessage(messageId, userId) {
  const chats = await loadChats();
  for (const chat of chats) {
    const idx = chat.messages.findIndex((m) => m.id === messageId);
    if (idx !== -1) {
      if (chat.messages[idx].senderId !== userId) return { error: "Можно удалять только свои сообщения" };
      chat.messages.splice(idx, 1);
      await saveChats(chats);
      return { success: true };
    }
  }
  return { error: "Сообщение не найдено" };
}

// Добавить реакцию
async function addReaction(messageId, userId, emoji) {
  const chats = await loadChats();
  for (const chat of chats) {
    const msg = chat.messages.find((m) => m.id === messageId);
    if (msg) {
      if (!msg.reactions) msg.reactions = [];
      let reaction = msg.reactions.find((r) => r.emoji === emoji);
      if (!reaction) {
        reaction = { emoji, users: [] };
        msg.reactions.push(reaction);
      }
      if (!reaction.users.includes(userId)) {
        reaction.users.push(userId);
      }
      await saveChats(chats);
      return { success: true, reactions: msg.reactions };
    }
  }
  return { error: "Сообщение не найдено" };
}

// Убрать реакцию
async function removeReaction(messageId, userId, emoji) {
  const chats = await loadChats();
  for (const chat of chats) {
    const msg = chat.messages.find((m) => m.id === messageId);
    if (msg && msg.reactions) {
      const reaction = msg.reactions.find((r) => r.emoji === emoji);
      if (reaction) {
        reaction.users = reaction.users.filter((u) => u !== userId);
        if (reaction.users.length === 0) {
          msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji);
        }
      }
      await saveChats(chats);
      return { success: true, reactions: msg.reactions };
    }
  }
  return { error: "Сообщение не найдено" };
}

module.exports = {
  openChat,
  sendMessage,
  getMessages,
  getUserChats,
  setSocketReferences,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
};
