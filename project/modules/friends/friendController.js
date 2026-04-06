const friendService = require("./friendService");

async function sendRequest(req, res) {
  const fromId = req.user.id;
  const { toId } = req.body;

  const result = await friendService.sendRequest(fromId, toId);
  res.json(result);
}

async function acceptRequest(req, res) {
  const userId = req.user.id;
  const { fromId } = req.body;

  const result = await friendService.acceptRequest(userId, fromId);
  res.json(result);
}

async function declineRequest(req, res) {
  const userId = req.user.id;
  const { fromId } = req.body;

  const result = await friendService.declineRequest(userId, fromId);
  res.json(result);
}

async function removeFriend(req, res) {
  const userId = req.user.id;
  const { friendId } = req.body;

  const result = await friendService.removeFriend(userId, friendId);
  res.json(result);
}

async function getFriends(req, res) {
  const user = req.user;
  res.json({ friends: user.friends || [] });
}

async function getIncoming(req, res) {
  const user = req.user;
  res.json({ incomingRequests: user.incomingRequests || [] });
}

async function getOutgoing(req, res) {
  const user = req.user;
  res.json({ outgoingRequests: user.outgoingRequests || [] });
}

async function getStatus(req, res) {
  const userId = req.user.id;
  const targetId = req.params.id;

  const result = await friendService.getRelationshipStatus(userId, targetId);
  res.json(result);
}

module.exports = {
  sendRequest,
  acceptRequest,
  declineRequest,
  removeFriend,
  getFriends,
  getIncoming,
  getOutgoing,
  getStatus,
};
