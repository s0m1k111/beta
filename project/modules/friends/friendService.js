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

function ensureFriendFields(user) {
  if (!user.friends) user.friends = [];
  if (!user.incomingRequests) user.incomingRequests = [];
  if (!user.outgoingRequests) user.outgoingRequests = [];
}

async function sendRequest(fromId, toId) {
  const users = await loadUsers();

  if (fromId === toId) {
    return { error: "Нельзя отправить заявку самому себе" };
  }

  const from = users.find((u) => u.id === fromId);
  const to = users.find((u) => u.id === toId);

  if (!from || !to) return { error: "Пользователь не найден" };

  ensureFriendFields(from);
  ensureFriendFields(to);

  if (from.friends.includes(toId)) {
    return { error: "Пользователь уже в друзьях" };
  }

  if (from.outgoingRequests.includes(toId)) {
    return { error: "Заявка уже отправлена" };
  }

  if (to.incomingRequests.includes(fromId)) {
    return { error: "Заявка уже отправлена" };
  }

  from.outgoingRequests.push(toId);
  to.incomingRequests.push(fromId);

  await saveUsers(users);

  return { success: true };
}

async function acceptRequest(userId, fromId) {
  const users = await loadUsers();

  const user = users.find((u) => u.id === userId);
  const from = users.find((u) => u.id === fromId);

  if (!user || !from) return { error: "Пользователь не найден" };

  ensureFriendFields(user);
  ensureFriendFields(from);

  if (!user.incomingRequests.includes(fromId)) {
    return { error: "Нет входящей заявки от этого пользователя" };
  }

  user.incomingRequests = user.incomingRequests.filter((id) => id !== fromId);
  from.outgoingRequests = from.outgoingRequests.filter((id) => id !== userId);

  user.friends.push(fromId);
  from.friends.push(userId);

  await saveUsers(users);

  return { success: true };
}

async function declineRequest(userId, fromId) {
  const users = await loadUsers();

  const user = users.find((u) => u.id === userId);
  const from = users.find((u) => u.id === fromId);

  if (!user || !from) return { error: "Пользователь не найден" };

  ensureFriendFields(user);
  ensureFriendFields(from);

  user.incomingRequests = user.incomingRequests.filter((id) => id !== fromId);
  from.outgoingRequests = from.outgoingRequests.filter((id) => id !== userId);

  await saveUsers(users);

  return { success: true };
}

async function removeFriend(userId, friendId) {
  const users = await loadUsers();

  const user = users.find((u) => u.id === userId);
  const friend = users.find((u) => u.id === friendId);

  if (!user || !friend) return { error: "Пользователь не найден" };

  ensureFriendFields(user);
  ensureFriendFields(friend);

  user.friends = user.friends.filter((id) => id !== friendId);
  friend.friends = friend.friends.filter((id) => id !== userId);

  await saveUsers(users);

  return { success: true };
}

async function getRelationshipStatus(userId, targetId) {
  const users = await loadUsers();

  const user = users.find((u) => u.id === userId);
  const target = users.find((u) => u.id === targetId);

  if (!user || !target) {
    return { error: "Пользователь не найден" };
  }

  ensureFriendFields(user);
  ensureFriendFields(target);

  const isFriend = user.friends.includes(targetId);
  const incoming = user.incomingRequests.includes(targetId);
  const outgoing = user.outgoingRequests.includes(targetId);

  return {
    isFriend,
    incoming,
    outgoing,
    canSend: !isFriend && !incoming && !outgoing && userId !== targetId,
    canAccept: incoming,
    canDecline: incoming,
    canRemove: isFriend,
  };
}

module.exports = {
  sendRequest,
  acceptRequest,
  declineRequest,
  removeFriend,
  getRelationshipStatus,
};
