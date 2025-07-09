const socket = io();
const url = new URLSearchParams(window.location.search);
const pseudo = url.get('pseudo');
const room = url.get('room');
const useEco = url.get('eco') === 'true';

let localStream;
let peer = new RTCPeerConnection();
let bytesSent = 0;

const remoteAudio = document.getElementById('remoteAudio');
const status = document.getElementById('status');
const micStatus = document.getElementById('micStatus');
const dataUsage = document.getElementById('dataUsage');
const muteBtn = document.getElementById('muteBtn');
const hangupBtn = document.getElementById('hangupBtn');

start();

async function start() {
  const constraints = useEco
    ? {
        sampleRate: 8000,
        channelCount: 1,
        noiseSuppression: true,
        echoCancellation: true
      }
    : true;

  localStream = await navigator.mediaDevices.getUserMedia({ audio: constraints });

  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

  peer.onicecandidate = e => {
    if (e.candidate) socket.emit('signal', { room, data: { candidate: e.candidate } });
  };

  peer.ontrack = e => {
    const remoteStream = e.streams[0];
    remoteAudio.srcObject = remoteStream;
    detectMicActivity(remoteStream);
  };

  socket.emit('join', { room, pseudo });

  socket.on('ready', async () => {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit('signal', { room, data: { desc: peer.localDescription } });
  });

  socket.on('signal', async ({ data }) => {
    if (data.desc) {
      await peer.setRemoteDescription(data.desc);
      if (data.desc.type === 'offer') {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit('signal', { room, data: { desc: peer.localDescription } });
      }
    } else if (data.candidate) {
      await peer.addIceCandidate(data.candidate);
    }
  });

  trackDataUsage();
  status.textContent = "✅ Connecté à la room : " + room;
}

function detectMicActivity(stream) {
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  const source = ctx.createMediaStreamSource(stream);
  analyser.fftSize = 64;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);

  function update() {
    analyser.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    micStatus.textContent = avg > 10 ? "🎙️ Micro actif" : "😶 Silencieux";
    requestAnimationFrame(update);
  }

  update();
}

function trackDataUsage() {
  setInterval(async () => {
    const stats = await peer.getStats();
    stats.forEach(report => {
      if (report.type === 'outbound-rtp' && report.kind === 'audio') {
        if (report.bytesSent) {
          bytesSent = report.bytesSent;
          const mo = (bytesSent / 1024 / 1024).toFixed(2);
          dataUsage.textContent = `💾 ${mo} Mo utilisés`;
        }
      }
    });
  }, 1000);
}

muteBtn.onclick = () => {
  const track = localStream.getAudioTracks()[0];
  track.enabled = !track.enabled;
  muteBtn.textContent = track.enabled ? "🔇 Mute" : "🔊 Unmute";
};

hangupBtn.onclick = () => {
  peer.close();
  socket.disconnect();
  status.textContent = "📴 Appel terminé.";
};
