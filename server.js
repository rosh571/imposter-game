const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Shareable join link
app.get('/join/:code', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Word List ──────────────────────────────────────────────
const WORDS = {
  animals: ['elephant', 'penguin', 'dolphin', 'giraffe', 'octopus', 'chameleon', 'kangaroo', 'flamingo', 'porcupine', 'cheetah'],
  food: ['pizza', 'sushi', 'tacos', 'pancakes', 'lasagna', 'croissant', 'dumpling', 'burrito', 'pretzel', 'waffles'],
  places: ['library', 'airport', 'casino', 'museum', 'lighthouse', 'volcano', 'waterfall', 'pyramid', 'subway', 'stadium'],
  objects: ['umbrella', 'telescope', 'trampoline', 'chandelier', 'backpack', 'keyboard', 'hammock', 'microphone', 'compass', 'lantern'],
  jobs: ['astronaut', 'detective', 'lifeguard', 'magician', 'surgeon', 'pilot', 'bartender', 'firefighter', 'architect', 'mechanic'],
  movies: ['titanic', 'jaws', 'inception', 'avatar', 'gladiator', 'frozen', 'matrix', 'rocky', 'shrek', 'interstellar'],
  activities: ['surfing', 'karaoke', 'skydiving', 'bowling', 'camping', 'snorkeling', 'yoga', 'paintball', 'fishing', 'gardening'],
  vehicles: ['helicopter', 'submarine', 'motorcycle', 'sailboat', 'bulldozer', 'ambulance', 'limousine', 'skateboard', 'canoe', 'tractor']
};

const ALL_WORDS = Object.values(WORDS).flat();

// ── Room Management ────────────────────────────────────────
const rooms = new Map();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(code));
  return code;
}

function pickWord(room) {
  const available = ALL_WORDS.filter(w => !room.usedWords.has(w));
  if (available.length === 0) room.usedWords.clear();
  const pool = available.length > 0 ? available : ALL_WORDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function broadcastPlayerList(room) {
  io.to(room.code).emit('player-list', room.players.map(p => ({
    id: p.id,
    name: p.name,
    isHost: p.isHost
  })));
}

function promoteNewHost(room) {
  if (room.players.length === 0) return;
  room.players[0].isHost = true;
  room.hostSocketId = room.players[0].socketId;
  broadcastPlayerList(room);
}

// Cleanup stale rooms every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > 30 * 60 * 1000) {
      io.to(code).emit('error', 'Room closed due to inactivity.');
      rooms.delete(code);
    }
  }
}, 5 * 60 * 1000);

// ── Socket.io ──────────────────────────────────────────────
io.on('connection', (socket) => {

  socket.on('create-room', (name) => {
    if (!name || typeof name !== 'string') return socket.emit('error', 'Name is required.');
    name = name.trim().slice(0, 20);
    if (!name) return socket.emit('error', 'Name is required.');

    const code = generateCode();
    const playerId = socket.id;
    const room = {
      code,
      state: 'LOBBY',
      hostSocketId: socket.id,
      players: [{ id: playerId, name, isHost: true, socketId: socket.id }],
      imposterId: null,
      currentWord: null,
      votes: {},
      usedWords: new Set(),
      lastActivity: Date.now()
    };
    rooms.set(code, room);
    socket.join(code);
    socket.roomCode = code;
    socket.playerId = playerId;

    socket.emit('room-created', { code, playerId });
    broadcastPlayerList(room);
  });

  socket.on('join-room', ({ code, name, reconnectId }) => {
    if (!name || typeof name !== 'string') return socket.emit('error', 'Name is required.');
    name = name.trim().slice(0, 20);
    if (!name) return socket.emit('error', 'Name is required.');
    if (!code || typeof code !== 'string') return socket.emit('error', 'Room code is required.');
    code = code.toUpperCase().trim();

    const room = rooms.get(code);
    if (!room) return socket.emit('error', 'Room not found.');

    // Reconnection
    if (reconnectId) {
      const existing = room.players.find(p => p.id === reconnectId);
      if (existing) {
        existing.socketId = socket.id;
        delete existing.disconnectedAt;
        if (existing.isHost) {
          room.hostSocketId = socket.id;
        }
        socket.join(code);
        socket.roomCode = code;
        socket.playerId = existing.id;
        room.lastActivity = Date.now();
        broadcastPlayerList(room);

        // If game is in progress, resend role
        if (room.state === 'PLAYING') {
          if (existing.id === room.imposterId) {
            socket.emit('role-assigned', { role: 'imposter', word: null, playerCount: room.players.length });
          } else {
            socket.emit('role-assigned', { role: 'normal', word: room.currentWord, playerCount: room.players.length });
          }
          // Resend current vote tallies
          socket.emit('vote-update', computeVoteTallies(room));
        }
        socket.emit('joined-room', { code, playerId: existing.id, state: room.state });
        return;
      }
    }

    if (room.state !== 'LOBBY') return socket.emit('error', 'Game is already in progress.');
    if (room.players.length >= 20) return socket.emit('error', 'Room is full.');
    if (room.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      return socket.emit('error', 'That name is already taken.');
    }

    const playerId = socket.id;
    room.players.push({ id: playerId, name, isHost: false, socketId: socket.id });
    socket.join(code);
    socket.roomCode = code;
    socket.playerId = playerId;
    room.lastActivity = Date.now();

    socket.emit('joined-room', { code, playerId, state: room.state });
    broadcastPlayerList(room);
  });

  socket.on('start-game', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return socket.emit('error', 'Room not found.');
    if (room.hostSocketId !== socket.id) return socket.emit('error', 'Only the host can start the game.');
    if (room.players.length < 3) return socket.emit('error', 'Need at least 3 players to start.');

    room.state = 'PLAYING';
    room.votes = {};
    room.lastActivity = Date.now();

    const word = pickWord(room);
    room.currentWord = word;
    room.usedWords.add(word);

    const imposterIndex = Math.floor(Math.random() * room.players.length);
    room.imposterId = room.players[imposterIndex].id;

    // Send roles individually
    for (const player of room.players) {
      const target = io.sockets.sockets.get(player.socketId);
      if (!target) continue;
      if (player.id === room.imposterId) {
        target.emit('role-assigned', { role: 'imposter', word: null, playerCount: room.players.length });
      } else {
        target.emit('role-assigned', { role: 'normal', word, playerCount: room.players.length });
      }
    }

    io.to(room.code).emit('game-started');
  });

  socket.on('cast-vote', (targetId) => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    if (room.state !== 'PLAYING') return;
    if (!room.players.find(p => p.id === targetId)) return;
    if (targetId === socket.playerId) return socket.emit('error', 'You cannot vote for yourself.');

    room.votes[socket.playerId] = targetId;
    room.lastActivity = Date.now();

    io.to(room.code).emit('vote-update', computeVoteTallies(room));
  });

  socket.on('reveal-imposter', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return socket.emit('error', 'Only the host can reveal.');
    if (room.state !== 'PLAYING') return;

    room.state = 'REVEAL';
    room.lastActivity = Date.now();

    const imposter = room.players.find(p => p.id === room.imposterId);
    const tallies = computeVoteTallies(room);

    // Determine who got the most votes
    let maxVotes = 0;
    let mostVotedId = null;
    for (const [id, count] of Object.entries(tallies)) {
      if (count > maxVotes) {
        maxVotes = count;
        mostVotedId = id;
      }
    }

    const caughtImposter = mostVotedId === room.imposterId;

    io.to(room.code).emit('imposter-revealed', {
      imposterId: room.imposterId,
      imposterName: imposter ? imposter.name : 'Unknown',
      word: room.currentWord,
      caughtImposter,
      tallies
    });
  });

  socket.on('new-round', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return socket.emit('error', 'Only the host can start a new round.');

    room.state = 'LOBBY';
    room.imposterId = null;
    room.currentWord = null;
    room.votes = {};
    room.lastActivity = Date.now();

    io.to(room.code).emit('round-reset');
    broadcastPlayerList(room);
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    const playerId = socket.playerId;

    // Grace period — allow reconnection during page navigation
    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.disconnectedAt = Date.now();
    }

    setTimeout(() => {
      const room = rooms.get(socket.roomCode);
      if (!room) return;
      const player = room.players.find(p => p.id === playerId);
      // If player reconnected (socketId changed), don't remove
      if (!player || player.socketId !== socket.id) return;
      // If still disconnected after grace period, remove
      if (!player.disconnectedAt) return;

      const wasHost = room.hostSocketId === socket.id;
      room.players = room.players.filter(p => p.id !== playerId);

      if (room.players.length === 0) {
        rooms.delete(socket.roomCode);
        return;
      }

      if (wasHost) promoteNewHost(room);
      broadcastPlayerList(room);
    }, 5000);
  });
});

function computeVoteTallies(room) {
  const tallies = {};
  for (const targetId of Object.values(room.votes)) {
    tallies[targetId] = (tallies[targetId] || 0) + 1;
  }
  return tallies;
}

// ── Start Server ───────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Imposter Game running on http://localhost:${PORT}`);
});
