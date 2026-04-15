const path = require("path");
const fs = require("fs-extra");

const UNREAD_FILE = path.join(__dirname, "../../db/unread.json");

async function loadUnread() {
  await fs.ensureFile(UNREAD_FILE);
  const data = await fs.readFile(UNREAD_FILE, "utf8");
  if (!data.trim()) return {};
  return JSON.parse(data);
}

async function saveUnread(unread) {
  await fs.writeFile(UNREAD_FILE, JSON.stringify(unread, null, 2));
}

// userId -> { channelId: { count: number, lastMessageId: string } }

function getUnread(userId, channelId) {
  const data = {};
  try {
    const raw = JSON.parse(fs.readFileSync(UNREAD_FILE, "utf8"));
    return raw[userId]?.[channelId] || { count: 0, lastMessageId: null };
  } catch {
    return { count: 0, lastMessageId: null };
  }
}

async function incrementUnread(userId, channelId, messageId) {
  const unread = await loadUnread();
  if (!unread[userId]) unread[userId] = {};
  if (!unread[userId][channelId]) unread[userId][channelId] = { count: 0, lastMessageId: null };
  unread[userId][channelId].count++;
  unread[userId][channelId].lastMessageId = messageId;
  await saveUnread(unread);
}

async function markAsRead(userId, channelId) {
  const unread = await loadUnread();
  if (unread[userId]?.[channelId]) {
    const count = unread[userId][channelId].count;
    unread[userId][channelId] = { count: 0, lastMessageId: null };
    await saveUnread(unread);
    return { count };
  }
  return { count: 0 };
}

async function getUnreadSummary(userId) {
  const unread = await loadUnread();
  const userUnread = unread[userId] || {};
  const summary = {};
  for (const [channelId, data] of Object.entries(userUnread)) {
    if (data.count > 0) {
      summary[channelId] = data.count;
    }
  }
  return summary;
}

module.exports = {
  getUnread,
  incrementUnread,
  markAsRead,
  getUnreadSummary,
};
