const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const authRoutes = require("./modules/auth/authRoutes");
const userRoutes = require("./modules/users/userRoutes");
const friendRoutes = require("./modules/friends/friendRoutes");
const dmRoutes = require("./modules/dm/dmRoutes");
const dmService = require("./modules/dm/dmService");
const serverRoutes = require("./modules/channels/serverRoutes");
const channelRoutes = require("./modules/channels/channelRoutes");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Static frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// Static uploads (аватарки)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/user", require("./modules/users/userRoutes"));
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/friends", friendRoutes);
app.use("/dm", dmRoutes);
app.use("/servers", serverRoutes);
app.use("/channels", channelRoutes);

// Test route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/login.html"));
});

// Socket.IO — авторизация и хранение пользователей
const userSockets = new Map(); // userId -> socketId

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Нет токена"));
  }

  try {
    const { verify } = require("./utils/jwt");
    const decoded = verify(token);
    if (!decoded) {
      return next(new Error("Неверный токен"));
    }
    socket.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error("Ошибка авторизации"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.userId;
  userSockets.set(userId, socket.id);

  console.log(`[Socket.IO] Пользователь ${userId} подключился`);

  socket.on("disconnect", () => {
    userSockets.delete(userId);
    console.log(`[Socket.IO] Пользователь ${userId} отключился`);
  });
});

// Экспортируем io для использования в других модулях
module.exports.io = io;
module.exports.userSockets = userSockets;

// Передаём ссылки в dmService
dmService.setSocketReferences(io, userSockets);

// Передаём io в channelController
const channelController = require("./modules/channels/channelController");
channelController.setIo(io);

// Передаём io в userController
const userController = require("./modules/users/userController");
userController.setIo(io);

// Передаём io в dmController
const dmController = require("./modules/dm/dmController");
dmController.setIo(io);

// Socket.IO для каналов
// (рассылка идёт из channelController)

// Хранение: какие серверы слушает пользователь
const userServerSubscriptions = new Map(); // userId -> Set<serverId>

const { setUserOnline, setUserOffline, getUserOnlineStatus } = require("./modules/channels/serverService");

// Глобальное хранилище голосовых каналов (ОДИН экземпляр для всех подключений!)
const voiceChannels = new Map(); // channelId -> Set<socketId>

io.on("connection", (socket) => {
  const userId = socket.userId;
  userSockets.set(userId, socket.id);
  setUserOnline(userId);

  console.log(`[Socket.IO] Пользователь ${userId} подключился`);

  // Подписка на сервер
  socket.on("subscribeServer", ({ serverId }) => {
    const roomName = `server_${serverId}`;
    socket.join(roomName);

    if (!userServerSubscriptions.has(userId)) {
      userServerSubscriptions.set(userId, new Set());
    }
    userServerSubscriptions.get(userId).add(serverId);

    console.log(`[Socket.IO] ${userId} подписался на сервер ${serverId}`);
  });

  // Отписка от сервера
  socket.on("unsubscribeServer", ({ serverId }) => {
    const roomName = `server_${serverId}`;
    socket.leave(roomName);

    const subs = userServerSubscriptions.get(userId);
    if (subs) subs.delete(serverId);
  });

  // Heartbeat — обновляем lastSeen
  socket.on("heartbeat", () => {
    setUserOnline(userId);
  });

  // Typing indicator
  socket.on("typing", ({ channelId }) => {
    console.log(`[typing] ${userId} typing in ${channelId}`);
    if (channelId) {
      socket.broadcast.emit("userTyping", { userId, channelId });
    }
  });

  socket.on("stopTyping", ({ channelId }) => {
    console.log(`[typing] ${userId} stopped typing in ${channelId}`);
    if (channelId) {
      socket.broadcast.emit("userStoppedTyping", { userId, channelId });
    }
  });

  // === WebRTC Signaling ===
  socket.on("joinVoice", ({ channelId }) => {
    console.log(`[voice] joinVoice event from ${userId}, socket.id=${socket.id}, channel=${channelId}`);

    const roomName = `voice_${channelId}`;
    socket.join(roomName);

    let members = voiceChannels.get(channelId);
    if (!members) {
      members = new Set();
      voiceChannels.set(channelId, members);
    }

    const existingPeers = Array.from(members).filter((id) => id !== socket.id);
    members.add(socket.id);

    console.log(`[voice] ${userId} joining ${channelId}`);
    console.log(`[voice] Existing peers before add:`, existingPeers);
    console.log(`[voice] Members after add:`, Array.from(members));

    // Отправляем новому участнику список socketId тех кто уже в комнате
    socket.emit("room-peers", { channelId, peers: existingPeers });
    console.log(`[voice] ✅ Sent room-peers to ${socket.id}:`, existingPeers);

    // Всем остальным — новый участник
    console.log(`[voice] Iterating over members to notify...`);
    members.forEach((peerSocketId) => {
      if (peerSocketId === socket.id) return;
      console.log(`[voice] Looking up socket ${peerSocketId}...`);
      const allSockets = Array.from(io.sockets.sockets.values());
      console.log(
        `[voice] All connected sockets:`,
        allSockets.map((s) => s.id)
      );
      const peerSocket = allSockets.find((s) => s.id === peerSocketId);
      console.log(`[voice] Found:`, !!peerSocket);
      if (peerSocket) {
        peerSocket.emit("peer-joined", { roomId: channelId, peerId: socket.id, userId: userId });
        console.log(`[voice] ✅ Sent peer-joined to ${peerSocketId}`);
      } else {
        console.log(`[voice] ❌ Socket ${peerSocketId} not found!`);
      }
    });
  });

  socket.on("leaveVoice", ({ channelId }) => {
    const roomName = `voice_${channelId}`;
    socket.leave(roomName);
    const members = voiceChannels.get(channelId);
    if (members) {
      members.delete(socket.id);
      if (members.size === 0) voiceChannels.delete(channelId);
    }
    socket.to(roomName).emit("peer-left", { roomId: channelId, peerId: socket.id });
    console.log(`[voice] ${userId} left voice ${channelId}`);
  });

  // WebRTC сигнальные события — пересылаем напрямую по socketId
  socket.on("webrtc-offer", ({ to, offer }) => {
    const target = [...io.sockets.sockets.values()].find((s) => s.id === to);
    if (target) target.emit("webrtc-offer", { from: socket.id, offer });
  });

  socket.on("webrtc-answer", ({ to, answer }) => {
    const target = [...io.sockets.sockets.values()].find((s) => s.id === to);
    if (target) target.emit("webrtc-answer", { from: socket.id, answer });
  });

  socket.on("webrtc-candidate", ({ to, candidate }) => {
    const target = [...io.sockets.sockets.values()].find((s) => s.id === to);
    if (target) target.emit("webrtc-candidate", { from: socket.id, candidate });
  });

  // Screen sharing — используем socketId
  socket.on("startScreenShare", ({ channelId }) => {
    const roomName = `voice_${channelId}`;
    socket.to(roomName).emit("userStartedScreenShare", { userId, socketId: socket.id });
    console.log(`[screen] ${userId} (${socket.id}) started screen share in ${channelId}`);
  });

  socket.on("stopScreenShare", ({ channelId }) => {
    const roomName = `voice_${channelId}`;
    socket.to(roomName).emit("userStoppedScreenShare", { userId, socketId: socket.id });
  });

  socket.on("screen-offer", ({ to, offer }) => {
    const target = [...io.sockets.sockets.values()].find((s) => s.id === to);
    if (target) target.emit("screen-offer", { from: socket.id, offer });
  });

  socket.on("screen-answer", ({ to, answer }) => {
    const target = [...io.sockets.sockets.values()].find((s) => s.id === to);
    if (target) target.emit("screen-answer", { from: socket.id, answer });
  });

  socket.on("screen-candidate", ({ to, candidate }) => {
    const target = [...io.sockets.sockets.values()].find((s) => s.id === to);
    if (target) target.emit("screen-candidate", { from: socket.id, candidate });
  });

  socket.on("disconnect", () => {
    // Удаляем из голосовых каналов
    for (const [channelId, members] of voiceChannels.entries()) {
      if (members.has(socket.id)) {
        members.delete(socket.id);
        socket.to(`voice_${channelId}`).emit("peer-left", { roomId: channelId, peerId: socket.id });
        if (members.size === 0) voiceChannels.delete(channelId);
      }
    }

    userSockets.delete(userId);
    userServerSubscriptions.delete(userId);
    setUserOffline(userId);
    io.emit("userStatusChanged", { userId, status: "offline" });
    console.log(`[Socket.IO] Пользователь ${userId} отключился`);
  });
});

// Экспортируем для использования в контроллерах
module.exports.io = io;
module.exports.userSockets = userSockets;

// Start server
server.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
