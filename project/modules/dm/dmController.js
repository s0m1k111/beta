const dmService = require("./dmService");

let io = null;
function setIo(ioRef) {
  io = ioRef;
}

async function openChat(req, res) {
  const userId = req.user.id;
  const { targetId } = req.body;
  if (!targetId) return res.status(400).json({ error: "targetId обязателен" });
  const chat = await dmService.openChat(userId, targetId);
  if (chat.error) return res.status(403).json({ error: chat.error });
  res.json({ chat });
}

async function sendMessage(req, res) {
  try {
    const userId = req.user.id;
    const { chatId, text } = req.body;
    if (!chatId || !text) return res.status(400).json({ error: "chatId и text обязательны" });
    const message = await dmService.sendMessage(chatId, userId, text);
    if (message.error) return res.status(404).json({ error: message.error });
    res.json({ message });
  } catch (err) {
    console.error("sendMessage error:", err);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
}

async function getMessages(req, res) {
  const { chatId } = req.params;
  const messages = await dmService.getMessages(chatId);
  if (!messages) return res.status(404).json({ error: "Чат не найден" });
  res.json({ messages });
}

async function listChats(req, res) {
  const userId = req.user.id;
  const chats = await dmService.getUserChats(userId);
  res.json({ chats });
}

async function editMessage(req, res) {
  const userId = req.user.id;
  const { messageId } = req.params;
  const { text } = req.body;
  const result = await dmService.editMessage(messageId, userId, text);
  if (result.error) return res.status(403).json({ error: result.error });
  res.json(result);
}

async function deleteMessage(req, res) {
  const userId = req.user.id;
  const { messageId } = req.params;
  const result = await dmService.deleteMessage(messageId, userId);
  if (result.error) return res.status(403).json({ error: result.error });
  res.json(result);
}

async function addReaction(req, res) {
  const userId = req.user.id;
  const { messageId } = req.params;
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: "emoji обязателен" });
  const result = await dmService.addReaction(messageId, userId, emoji);
  if (result.error) return res.status(404).json({ error: result.error });

  // Broadcast
  if (io) {
    io.emit("reactionUpdated", { messageId, reactions: result.reactions, chatId: "" });
  }

  res.json(result);
}

async function removeReaction(req, res) {
  const userId = req.user.id;
  const { messageId, emoji } = req.params;
  const result = await dmService.removeReaction(messageId, userId, emoji);
  if (result.error) return res.status(404).json({ error: result.error });

  // Broadcast
  if (io) {
    io.emit("reactionUpdated", { messageId, reactions: result.reactions, chatId: "" });
  }

  res.json(result);
}

module.exports = {
  openChat,
  sendMessage,
  getMessages,
  listChats,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  setIo,
};
