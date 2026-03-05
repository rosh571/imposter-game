const socket = io();

const roleCard = document.getElementById('role-card');
const roleLabel = document.getElementById('role-label');
const roleWord = document.getElementById('role-word');
const roleHint = document.getElementById('role-hint');
const voteButtons = document.getElementById('vote-buttons');
const hostControls = document.getElementById('host-controls');
const revealBtn = document.getElementById('reveal-btn');
const revealOverlay = document.getElementById('reveal-overlay');
const revealResult = document.getElementById('reveal-result');
const revealName = document.getElementById('reveal-name');
const revealWord = document.getElementById('reveal-word');
const voteSummary = document.getElementById('vote-summary');
const newRoundBtn = document.getElementById('new-round-btn');
const revealWait = document.getElementById('reveal-wait');
const errorMsg = document.getElementById('error-msg');

const pid = sessionStorage.getItem('imposter-pid');
const roomCode = sessionStorage.getItem('imposter-room');
const playerName = sessionStorage.getItem('imposter-name');

let players = [];
let myVote = null;
let isHost = false;

if (!roomCode || !pid || !playerName) {
  window.location.href = '/';
}

// Reconnect to room — server will resend role + game state
socket.emit('join-room', { pid, code: roomCode, name: playerName });

socket.on('role-assigned', ({ role, word }) => {
  if (role === 'imposter') {
    roleCard.classList.add('imposter');
    roleLabel.textContent = 'You are the';
    roleWord.textContent = 'IMPOSTER';
    roleHint.textContent = "You don't know the word. Blend in!";
  } else {
    roleCard.classList.remove('imposter');
    roleLabel.textContent = 'The secret word is';
    roleWord.textContent = word.toUpperCase();
    roleHint.textContent = "Find who doesn't know this word!";
  }
});

socket.on('player-list', (playerList) => {
  players = playerList;
  isHost = players.find(p => p.id === pid)?.isHost || false;
  hostControls.hidden = !isHost;
  renderVoteButtons();
});

socket.on('vote-update', (tallies) => {
  renderVoteButtons(tallies);
});

socket.on('imposter-revealed', ({ imposterId, imposterName, word, caughtImposter, tallies }) => {
  // Guard against empty/invalid reveal data
  if (!imposterName || !word) return;
  revealOverlay.hidden = false;

  if (caughtImposter) {
    revealResult.textContent = 'Imposter Caught!';
    revealResult.className = 'reveal-result caught';
  } else {
    revealResult.textContent = 'Imposter Wins!';
    revealResult.className = 'reveal-result wins';
  }

  revealName.textContent = imposterName;
  revealWord.textContent = word.toUpperCase();

  // Vote summary
  voteSummary.innerHTML = '<h3>Vote Results</h3>';
  players.forEach(p => {
    const votes = tallies[p.id] || 0;
    const div = document.createElement('div');
    div.className = 'vote-result-row';
    div.innerHTML = `<span>${p.name}${p.id === imposterId ? ' (IMPOSTER)' : ''}</span><span>${votes} vote${votes !== 1 ? 's' : ''}</span>`;
    if (p.id === imposterId) div.classList.add('is-imposter');
    voteSummary.appendChild(div);
  });

  if (isHost) {
    newRoundBtn.hidden = false;
    revealWait.hidden = true;
  } else {
    newRoundBtn.hidden = true;
    revealWait.hidden = false;
  }
});

socket.on('round-reset', () => {
  window.location.href = '/lobby.html';
});

socket.on('game-started', () => {
  // Already on game page
});

revealBtn.addEventListener('click', () => {
  socket.emit('reveal-imposter');
});

newRoundBtn.addEventListener('click', () => {
  socket.emit('new-round');
});

socket.on('error', (msg) => {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
  setTimeout(() => { errorMsg.hidden = true; }, 4000);
});

function renderVoteButtons(tallies = {}) {
  voteButtons.innerHTML = '';
  players.forEach(p => {
    if (p.id === pid) return; // Can't vote for yourself
    const btn = document.createElement('button');
    const votes = tallies[p.id] || 0;
    btn.className = 'vote-btn' + (myVote === p.id ? ' voted' : '');
    btn.innerHTML = `<span class="vote-name">${p.name}</span><span class="vote-count">${votes > 0 ? votes + ' vote' + (votes !== 1 ? 's' : '') : ''}</span>`;
    btn.addEventListener('click', () => {
      myVote = p.id;
      socket.emit('cast-vote', p.id);
      renderVoteButtons(tallies);
    });
    voteButtons.appendChild(btn);
  });
}
