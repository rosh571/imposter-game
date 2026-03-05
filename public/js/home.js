const socket = io();

const hostNameInput = document.getElementById('host-name');
const joinNameInput = document.getElementById('join-name');
const joinCodeInput = document.getElementById('join-code');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
const errorMsg = document.getElementById('error-msg');

// Stable player ID — persists across page navigations
function getPlayerId() {
  let pid = sessionStorage.getItem('imposter-pid');
  if (!pid) {
    pid = crypto.randomUUID();
    sessionStorage.setItem('imposter-pid', pid);
  }
  return pid;
}
const pid = getPlayerId();

// Check if arriving via /join/:code link
const pathMatch = window.location.pathname.match(/^\/join\/([A-Za-z]{4})$/);
if (pathMatch) {
  joinCodeInput.value = pathMatch[1].toUpperCase();
  joinNameInput.focus();
}

// Check for reconnection (already in a room)
const savedRoom = sessionStorage.getItem('imposter-room');
const savedName = sessionStorage.getItem('imposter-name');
if (savedRoom && savedName) {
  socket.emit('join-room', { pid, code: savedRoom, name: savedName });
}

createBtn.addEventListener('click', () => {
  const name = hostNameInput.value.trim();
  if (!name) return showError('Please enter your name.');
  sessionStorage.setItem('imposter-name', name);
  socket.emit('create-room', { pid, name });
});

joinBtn.addEventListener('click', () => {
  const name = joinNameInput.value.trim();
  const code = joinCodeInput.value.trim().toUpperCase();
  if (!name) return showError('Please enter your name.');
  if (!code || code.length !== 4) return showError('Please enter a 4-letter room code.');
  sessionStorage.setItem('imposter-name', name);
  socket.emit('join-room', { pid, code, name });
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

socket.on('room-created', ({ code }) => {
  sessionStorage.setItem('imposter-room', code);
  window.location.href = '/lobby.html';
});

socket.on('joined-room', ({ code, state }) => {
  sessionStorage.setItem('imposter-room', code);
  if (state === 'PLAYING' || state === 'REVEAL') {
    window.location.href = '/game.html';
  } else {
    window.location.href = '/lobby.html';
  }
});

socket.on('error', (msg) => showError(msg));

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
  setTimeout(() => { errorMsg.hidden = true; }, 4000);
}
