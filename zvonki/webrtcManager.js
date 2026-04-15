// webrtcManager.js

class WebRTCManager {
  constructor({ socket, roomId, localMediaConstraints }) {
    this.socket = socket;
    this.roomId = roomId;
    this.localStream = null;
    this.peers = new Map(); // peerId -> RTCPeerConnection
    this.remoteStreams = new Map(); // peerId -> MediaStream
    this.localMediaConstraints = localMediaConstraints || { audio: true, video: false };

    this.iceServers = [
      { urls: "stun:stun.l.google.com:19302" },
      // сюда потом добавишь свой TURN
      // { urls: "turn:your.turn.server:3478", username: "user", credential: "pass" }
    ];

    this._registerSocketEvents();
  }

  async join() {
    this.localStream = await navigator.mediaDevices.getUserMedia(this.localMediaConstraints);

    this._attachLocalStreamToDOM(this.localStream);

    this.socket.emit("join-room", {
      roomId: this.roomId,
      userInfo: { name: "User-" + Math.floor(Math.random() * 1000) }
    });
  }

  leave() {
    this.socket.emit("leave-room", { roomId: this.roomId });
    this._closeAllPeers();
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
  }

  async startScreenShare() {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false
    });

    const screenTrack = screenStream.getVideoTracks()[0];

    // заменяем видеотрек во всех соединениях
    this.peers.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === "video");
      if (sender) sender.replaceTrack(screenTrack);
    });

    this._attachLocalScreenToDOM(screenStream);

    screenTrack.onended = () => {
      // вернуться к камере или убрать видео
      this._restoreCameraVideo();
    };
  }

  async _restoreCameraVideo() {
    if (!this.localStream) return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    this.peers.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === "video");
      if (sender) sender.replaceTrack(videoTrack);
    });

    // тут можешь обновить DOM под камеру
  }

  toggleMute(muted) {
    if (!this.localStream) return;
    this.localStream.getAudioTracks().forEach(t => (t.enabled = !muted));
  }

  async _createPeerConnection(peerId, isInitiator) {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });

    // локальные треки
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
    }

    pc.onicecandidate = e => {
      if (e.candidate) {
        this.socket.emit("webrtc-candidate", {
          to: peerId,
          candidate: e.candidate
        });
      }
    };

    pc.ontrack = e => {
      let stream = this.remoteStreams.get(peerId);
      if (!stream) {
        stream = new MediaStream();
        this.remoteStreams.set(peerId, stream);
        this._attachRemoteStreamToDOM(peerId, stream);
      }
      stream.addTrack(e.track);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        this._removePeer(peerId);
      }
    };

    this.peers.set(peerId, pc);

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit("webrtc-offer", {
        to: peerId,
        offer
      });
    }

    return pc;
  }

  _registerSocketEvents() {
    this.socket.on("room-peers", async ({ roomId, peers }) => {
      if (roomId !== this.roomId) return;
      // создаём соединения к уже сидящим
      for (const peerId of peers) {
        await this._createPeerConnection(peerId, true);
      }
    });

    this.socket.on("peer-joined", async ({ roomId, peerId }) => {
      if (roomId !== this.roomId) return;
      // новый участник — он инициирует к нам, мы ждём offer
      console.log("peer joined:", peerId);
    });

    this.socket.on("peer-left", ({ roomId, peerId }) => {
      if (roomId !== this.roomId) return;
      this._removePeer(peerId);
    });

    this.socket.on("webrtc-offer", async ({ from, offer }) => {
      let pc = this.peers.get(from);
      if (!pc) {
        pc = await this._createPeerConnection(from, false);
      }
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.socket.emit("webrtc-answer", {
        to: from,
        answer
      });
    });

    this.socket.on("webrtc-answer", async ({ from, answer }) => {
      const pc = this.peers.get(from);
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    this.socket.on("webrtc-candidate", async ({ from, candidate }) => {
      const pc = this.peers.get(from);
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("Error adding ICE candidate", e);
      }
    });
  }

  _removePeer(peerId) {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.close();
      this.peers.delete(peerId);
    }
    const stream = this.remoteStreams.get(peerId);
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      this.remoteStreams.delete(peerId);
    }
    this._removeRemoteFromDOM(peerId);
  }

  _closeAllPeers() {
    this.peers.forEach((pc, peerId) => {
      this._removePeer(peerId);
    });
  }

  // ====== DOM-хелперы — тут ты подстроишь под свой UI ======

  _attachLocalStreamToDOM(stream) {
    let video = document.getElementById("local-video");
    if (!video) {
      video = document.createElement("video");
      video.id = "local-video";
      video.autoplay = true;
      video.muted = true;
      document.getElementById("videos").appendChild(video);
    }
    video.srcObject = stream;
  }

  _attachLocalScreenToDOM(stream) {
    let video = document.getElementById("local-screen");
    if (!video) {
      video = document.createElement("video");
      video.id = "local-screen";
      video.autoplay = true;
      video.muted = true;
      document.getElementById("videos").appendChild(video);
    }
    video.srcObject = stream;
  }

  _attachRemoteStreamToDOM(peerId, stream) {
    let video = document.getElementById("remote-" + peerId);
    if (!video) {
      video = document.createElement("video");
      video.id = "remote-" + peerId;
      video.autoplay = true;
      document.getElementById("videos").appendChild(video);
    }
    video.srcObject = stream;
  }

  _removeRemoteFromDOM(peerId) {
    const video = document.getElementById("remote-" + peerId);
    if (video && video.parentNode) {
      video.parentNode.removeChild(video);
    }
  }
}
