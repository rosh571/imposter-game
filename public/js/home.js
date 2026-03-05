const socket = io();

const hostNameInput = document.getElementById('host-name');
const joinNameInput = document.getElementById('join-name');
const joinCodeInput = document.getElementById('join-code');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
const errorMsg = document.getElementById('error-msg');

// Check if arriving via /join/:code link
const pathMatch = window.location.pathname.match(/^\/join\/([A-Za-z]{4})$/);
if (pathMatch) {
  joinCodeInput.value = pathMatch[1].toUpperCase();
  joinNameInput.focus();
}

// Check for reconnection
const savedRoom = sessionStorage.getItem('imposter-room');
const savedPlayer = sessionStorage.getItem('imposter-player');
if (savedRoom && savedPlayer) {
  const name = sessionStorage.getItem('imposter-name') || 'Player';
  socket.emit('join-room', { code: savedRoom, name, reconnectId: savedPlayer });
}

createBtn.addEventListener('click', () => {
  const name = hostNameInput.value.trim();
  if (!name) return showError('Please enter your name.');
  socket.emit('create-room', name);
});

joinBtn.addEventListener('click', () => {
  const name = joinNameInput.value.trim();
  const code = joinCodeInput.value.trim().toUpperCase();
  if (!name) return showError('Please enter your name.');
  if (!code || code.length !== 4) return showError('Please enter a 4-letter room code.');
  socket.emit('join-room', { code, name });
});

// Enter key support
hostNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') createBtn.click(); });
joinCodeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinBtn.click(); });
joinNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (joinCodeInput.value.trim().length === 4) joinBtn.click();
    else joinCodeInput.focus();
  }
});

socket.on('room-created', ({ code, playerId }) => {
  saveSession(code, playerId, hostNameInput.value.trim());
  window.location.href = '/lobby.html';
});

socket.on('joined-room', ({ code, playerId, state }) => {
  const name = joinNameInput.value.trim() || hostNameInput.value.trim() || sessionStorage.getItem('imposter-name');
  saveSession(code, playerId, name);
  if (state === 'PLAYING') {
    window.location.href = '/game.html';
  } else {
    window.location.href = '/lobby.html';
  }
});

socket.on('error', (msg) => showError(msg));

function saveSession(code, playerId, name) {
  sessionStorage.setItem('imposter-room', code);
  sessionStorage.setItem('imposter-player', playerId);
  sessionStorage.setItem('imposter-name', name);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
  setTimeout(() => { errorMsg.hidden = true; }, 4000);
}
