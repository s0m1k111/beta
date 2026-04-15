import { getSocket } from "./socket.js";
import { getUserId } from "../utils/storage.js";

const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
};

let localStream = null;
let screenStream = null;
let peers = new Map();
let screenPeers = new Map();
let remoteStreams = new Map();
let currentChannelId = null;
let myId = null;
let mySocketId = null;
let screenSharerId = null;
let isScreenSharing = false;

export async function joinVoiceChannel(channelId) {
  myId = getUserId();
  currentChannelId = channelId;
  const socket = getSocket();
  if (!socket) return;

  mySocketId = socket.id;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    socket.emit("joinVoice", { channelId });
    console.log("[voice] Joined:", channelId, "socketId:", mySocketId);
    return localStream;
  } catch (err) {
    console.error("[voice] Mic error:", err);
    throw err;
  }
}

export function leaveVoiceChannel(channelId) {
  currentChannelId = null;
  const socket = getSocket();
  if (socket) socket.emit("leaveVoice", { channelId });

  peers.forEach((pc) => pc.close());
  peers.clear();
  screenPeers.forEach((pc) => pc.close());
  screenPeers.clear();
  remoteStreams.clear();

  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  if (screenStream) {
    screenStream.getTracks().forEach((t) => t.stop());
    screenStream = null;
  }

  // Очистка DOM
  document.querySelectorAll(".voice-remote-audio").forEach((el) => el.remove());
  document.querySelectorAll(".voice-remote-video").forEach((el) => el.remove());

  isScreenSharing = false;
  screenSharerId = null;
}

export async function startScreenShare(channelId) {
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: "always" },
      audio: false,
    });

    isScreenSharing = true;
    screenSharerId = myId;

    // Создаём screen peer connection для каждого участника
    for (const [peerSocketId] of peers) {
      await createScreenPeerConnection(peerSocketId, true);
    }

    getSocket()?.emit("startScreenShare", { channelId });
    return screenStream;
  } catch (err) {
    console.error("[screen] Error:", err);
    throw err;
  }
}

export function stopScreenShare(channelId) {
  getSocket()?.emit("stopScreenShare", { channelId });
  if (screenStream) {
    screenStream.getTracks().forEach((t) => t.stop());
    screenStream = null;
  }
  screenPeers.forEach((pc) => pc.close());
  screenPeers.clear();
  isScreenSharing = false;
  screenSharerId = null;
}

export function toggleMute() {
  if (!localStream) return false;
  const track = localStream.getAudioTracks()[0];
  if (track) {
    track.enabled = !track.enabled;
    return !track.enabled;
  }
  return false;
}

export function isMuted() {
  if (!localStream) return true;
  const track = localStream.getAudioTracks()[0];
  return track ? !track.enabled : true;
}

export function getIsScreenSharing() {
  return isScreenSharing;
}
export function getScreenSharerId() {
  return screenSharerId;
}

// === Слушатели ===
export function initVoiceListeners(onUserJoined, onUserLeft, onScreenStarted, onScreenStopped) {
  const socket = getSocket();
  if (!socket) return;
  myId = getUserId();
  mySocketId = socket.id;

  socket.on("room-peers", async ({ peers: peerSocketIds }) => {
    console.log("[voice] Existing peers:", peerSocketIds);
    for (const peerSocketId of peerSocketIds) {
      await createAudioPeerConnection(peerSocketId, true);
    }
  });

  socket.on("peer-joined", async (data) => {
    console.log("[voice] Peer joined:", data);
    onUserJoined?.(data);
  });

  socket.on("peer-left", ({ peerId }) => {
    console.log("[voice] Peer left:", peerId);
    onUserLeft?.(peerId);
    removeAudioPeer(peerId);
    removeScreenPeer(peerId);
  });

  socket.on("webrtc-offer", async ({ from, offer }) => {
    console.log("[voice] Received offer from:", from);
    let pc = peers.get(from);
    if (!pc) pc = await createAudioPeerConnection(from, false);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc-answer", { to: from, answer });
    } catch (e) {
      console.error("[voice] Answer error:", e);
    }
  });

  socket.on("webrtc-answer", async ({ from, answer }) => {
    console.log("[voice] Received answer from:", from);
    const pc = peers.get(from);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (e) {}
    }
  });

  socket.on("webrtc-candidate", async ({ from, candidate }) => {
    const pc = peers.get(from);
    if (pc && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {}
    }
  });

  // Screen share signaling
  socket.on("screen-offer", async ({ from, offer }) => {
    console.log("[screen] Received offer from:", from);
    let pc = screenPeers.get(from);
    if (!pc) pc = await createScreenPeerConnection(from, false);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("screen-answer", { to: from, answer });
    } catch (e) {
      console.error("[screen] Answer error:", e);
    }
  });

  socket.on("screen-answer", async ({ from, answer }) => {
    const pc = screenPeers.get(from);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (e) {}
    }
  });

  socket.on("screen-candidate", async ({ from, candidate }) => {
    const pc = screenPeers.get(from);
    if (pc && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {}
    }
  });

  socket.on("userStartedScreenShare", ({ userId }) => {
    console.log("[screen] Started by:", userId);
    screenSharerId = userId;
    isScreenSharing = true;
    onScreenStarted?.(userId);
  });

  socket.on("userStoppedScreenShare", ({ userId }) => {
    console.log("[screen] Stopped by:", userId);
    if (screenSharerId === userId) {
      screenSharerId = null;
      isScreenSharing = false;
      onScreenStopped?.();
    }
    removeScreenPeer(userId);
  });
}

async function createAudioPeerConnection(peerSocketId, isInitiator) {
  const socket = getSocket();
  if (peers.has(peerSocketId)) return peers.get(peerSocketId);

  console.log("[voice] Creating audio PC for:", peerSocketId, isInitiator ? "(offering)" : "(answering)");
  const pc = new RTCPeerConnection(rtcConfig);

  if (localStream) {
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  }

  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit("webrtc-candidate", { to: peerSocketId, candidate: e.candidate });
  };

  pc.ontrack = (e) => {
    console.log("[voice] Received audio from:", peerSocketId);
    if (e.track.kind === "audio") {
      let audio = document.querySelector(`.voice-remote-audio[data-peer="${peerSocketId}"]`);
      if (!audio) {
        audio = document.createElement("audio");
        audio.className = "voice-remote-audio";
        audio.dataset.peer = peerSocketId;
        audio.autoplay = true;
        document.body.appendChild(audio);
      }
      audio.srcObject = e.streams[0];
      audio.play().catch(() => {});
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "disconnected") removeAudioPeer(peerSocketId);
  };

  peers.set(peerSocketId, pc);

  if (isInitiator) {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("webrtc-offer", { to: peerSocketId, offer });
    } catch (e) {
      console.error("[voice] Offer error:", e);
    }
  }

  return pc;
}

function removeAudioPeer(peerSocketId) {
  const pc = peers.get(peerSocketId);
  if (pc) {
    pc.close();
    peers.delete(peerSocketId);
  }
  const audio = document.querySelector(`.voice-remote-audio[data-peer="${peerSocketId}"]`);
  if (audio) audio.remove();
}

async function createScreenPeerConnection(peerSocketId, isInitiator) {
  const socket = getSocket();
  if (screenPeers.has(peerSocketId)) return screenPeers.get(peerSocketId);

  console.log("[screen] Creating screen PC for:", peerSocketId);
  const pc = new RTCPeerConnection(rtcConfig);

  if (screenStream) {
    screenStream.getTracks().forEach((track) => pc.addTrack(track, screenStream));
  }

  pc.ontrack = (e) => {
    console.log("[screen] Received screen from:", peerSocketId);
    let video = document.querySelector(`.voice-remote-video[data-peer="${peerSocketId}"]`);
    if (!video) {
      video = document.createElement("video");
      video.className = "voice-remote-video";
      video.dataset.peer = peerSocketId;
      video.autoplay = true;
      video.style.width = "100%";
      video.style.borderRadius = "8px";
      const container = document.getElementById("voiceScreenShareContainer");
      if (container) container.appendChild(video);
    }
    video.srcObject = e.streams[0];
    video.play().catch(() => {});
  };

  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit("screen-candidate", { to: peerSocketId, candidate: e.candidate });
  };

  screenPeers.set(peerSocketId, pc);

  if (isInitiator) {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("screen-offer", { to: peerSocketId, offer });
    } catch (e) {
      console.error("[screen] Offer error:", e);
    }
  }

  return pc;
}

function removeScreenPeer(peerSocketId) {
  const pc = screenPeers.get(peerSocketId);
  if (pc) {
    pc.close();
    screenPeers.delete(peerSocketId);
  }
  const video = document.querySelector(`.voice-remote-video[data-peer="${peerSocketId}"]`);
  if (video) video.remove();
}
