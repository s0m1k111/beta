// signaling-server.js
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// roomId: Set<socketId>
const rooms = new Map();

io.on("connection", socket => {
  console.log("connected:", socket.id);

  socket.on("join-room", ({ roomId, userInfo }) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    const members = rooms.get(roomId);
    members.add(socket.id);

    // сообщаем новому — кто уже в комнате
    const otherPeers = [...members].filter(id => id !== socket.id);
    socket.emit("room-peers", {
      roomId,
      peers: otherPeers
    });

    // всем остальным — что новый участник пришёл
    socket.to(roomId).emit("peer-joined", {
      roomId,
      peerId: socket.id,
      userInfo: userInfo || null
    });
  });

  socket.on("webrtc-offer", ({ to, offer }) => {
    io.to(to).emit("webrtc-offer", {
      from: socket.id,
      offer
    });
  });

  socket.on("webrtc-answer", ({ to, answer }) => {
    io.to(to).emit("webrtc-answer", {
      from: socket.id,
      answer
    });
  });

  socket.on("webrtc-candidate", ({ to, candidate }) => {
    io.to(to).emit("webrtc-candidate", {
      from: socket.id,
      candidate
    });
  });

  socket.on("leave-room", ({ roomId }) => {
    leaveRoom(socket, roomId);
  });

  socket.on("disconnect", () => {
    console.log("disconnected:", socket.id);
    // выкидываем из всех комнат
    for (const [roomId, members] of rooms.entries()) {
      if (members.has(socket.id)) {
        leaveRoom(socket, roomId, { fromDisconnect: true });
      }
    }
  });
});

function leaveRoom(socket, roomId, opts = {}) {
  const members = rooms.get(roomId);
  if (!members) return;

  members.delete(socket.id);
  socket.leave(roomId);

  // всем — что участник вышел
  socket.to(roomId).emit("peer-left", {
    roomId,
    peerId: socket.id
  });

  if (members.size === 0) {
    rooms.delete(roomId);
  }
}

const PORT = 4000;
server.listen(PORT, () => {
  console.log("Signaling server on", PORT);
});
