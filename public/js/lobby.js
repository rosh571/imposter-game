const socket = io();

const roomCodeEl = document.getElementById('room-code');
const playerListEl = document.getElementById('player-list');
const playerCountEl = document.getElementById('player-count');
const hostControls = document.getElementById('host-controls');
const waitingMsg = document.getElementById('waiting-msg');
const startBtn = document.getElementById('start-btn');
const copyLinkBtn = document.getElementById('copy-link-btn');
const copyFeedback = document.getElementById('copy-feedback');
const errorMsg = document.getElementById('error-msg');

const pid = sessionStorage.getItem('imposter-pid');
const roomCode = sessionStorage.getItem('imposter-room');
const playerName = sessionStorage.getItem('imposter-name');

if (!roomCode || !pid || !playerName) {
  window.location.href = '/';
}

roomCodeEl.textContent = roomCode;

// Reconnect to room
socket.emit('join-room', { pid, code: roomCode, name: playerName });

socket.on('player-list', (players) => {
  playerCountEl.textContent = `(${players.length})`;
  playerListEl.innerHTML = '';

  let isHost = false;

  players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = p.name;
    if (p.isHost) {
      li.innerHTML += ' <span class="badge badge-host">HOST</span>';
      if (p.id === pid) isHost = true;
    }
    if (p.id === pid) {
      li.innerHTML += ' <span class="badge badge-you">YOU</span>';
    }
    playerListEl.appendChild(li);
  });

  if (isHost) {
    hostControls.hidden = false;
    waitingMsg.hidden = true;
    startBtn.disabled = players.length < 3;
  } else {
    hostControls.hidden = true;
    waitingMsg.hidden = false;
  }
});

startBtn.addEventListener('click', () => {
  socket.emit('start-game');
});

copyLinkBtn.addEventListener('click', () => {
  const link = `${window.location.origin}/join/${roomCode}`;
  navigator.clipboard.writeText(link).then(() => {
    copyFeedback.hidden = false;
    setTimeout(() => { copyFeedback.hidden = true; }, 2000);
  }).catch(() => {
    prompt('Copy this link:', link);
  });
});

socket.on('game-started', () => {
  window.location.href = '/game.html';
});

socket.on('round-reset', () => {
  // Already on lobby
});

socket.on('error', (msg) => {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
  setTimeout(() => { errorMsg.hidden = true; }, 4000);
});
