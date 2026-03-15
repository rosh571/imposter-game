const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// No caching for JS/HTML so deploys take effect immediately
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.html') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

app.get('/join/:code', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Word List ──────────────────────────────────────────────
const WORDS = {
  animals: [
    'penguin', 'dolphin', 'octopus', 'chameleon', 'flamingo', 'porcupine', 'wolverine',
    'armadillo', 'narwhal', 'platypus', 'pelican', 'scorpion', 'panther', 'raccoon', 'buffalo'
  ],
  food: [
    'pancakes', 'lasagna', 'croissant', 'burrito', 'pretzel', 'waffles', 'tiramisu',
    'falafel', 'kimchi', 'risotto', 'tempura', 'meatloaf', 'guacamole', 'cheesecake', 'quesadilla'
  ],
  places: [
    'lighthouse', 'volcano', 'waterfall', 'pyramid', 'stadium', 'casino', 'museum',
    'cathedral', 'boardwalk', 'canyon', 'glacier', 'plantation', 'observatory', 'dungeon', 'colosseum'
  ],
  objects: [
    'telescope', 'trampoline', 'chandelier', 'microphone', 'compass', 'lantern', 'stethoscope',
    'binoculars', 'hourglass', 'megaphone', 'typewriter', 'metronome', 'periscope', 'kaleidoscope', 'sundial'
  ],
  jobs: [
    'astronaut', 'detective', 'lifeguard', 'magician', 'surgeon', 'bartender', 'blacksmith',
    'locksmith', 'lumberjack', 'puppeteer', 'auctioneer', 'pharmacist', 'electrician', 'translator', 'jeweler'
  ],
  movies: [
    'titanic', 'jaws', 'inception', 'gladiator', 'frozen', 'matrix', 'interstellar',
    'parasite', 'whiplash', 'dunkirk', 'zodiac', 'vertigo', 'arrival', 'gravity', 'ratatouille'
  ],
  activities: [
    'surfing', 'karaoke', 'skydiving', 'bowling', 'snorkeling', 'fencing', 'parkour',
    'bouldering', 'stargazing', 'beekeeping', 'archery', 'skateboarding', 'juggling', 'pottery', 'woodworking'
  ],
  vehicles: [
    'helicopter', 'submarine', 'motorcycle', 'sailboat', 'bulldozer', 'ambulance', 'gondola',
    'hovercraft', 'bobsled', 'chariot', 'kayak', 'trolley', 'steamship', 'jetski', 'rickshaw'
  ],
  science: [
    'volcano', 'tornado', 'glacier', 'asteroid', 'eclipse', 'tsunami', 'earthquake',
    'avalanche', 'dinosaur', 'bacteria', 'skeleton', 'satellite', 'telescope', 'magnet', 'fossil'
  ],
  mythology: [
    'phoenix', 'kraken', 'dragon', 'unicorn', 'werewolf', 'mermaid', 'vampire',
    'griffin', 'cyclops', 'medusa', 'centaur', 'minotaur', 'banshee', 'gargoyle', 'pegasus'
  ]
};

const ALL_WORDS = Object.values(WORDS).flat();

// ── Hint Words (one thematic hint per word for the imposter) ──
const HINT_WORDS = {
  // animals
  penguin: 'iceberg', dolphin: 'coral', octopus: 'tentacle', chameleon: 'camouflage', flamingo: 'pink',
  porcupine: 'quill', wolverine: 'claws', armadillo: 'shell', narwhal: 'tusk', platypus: 'beak',
  pelican: 'pouch', scorpion: 'sting', panther: 'jungle', raccoon: 'mask', buffalo: 'stampede',
  // food
  pancakes: 'syrup', lasagna: 'layers', croissant: 'bakery', burrito: 'wrap', pretzel: 'salt',
  waffles: 'brunch', tiramisu: 'espresso', falafel: 'chickpea', kimchi: 'fermented', risotto: 'creamy',
  tempura: 'batter', meatloaf: 'ketchup', guacamole: 'avocado', cheesecake: 'crust', quesadilla: 'melted',
  // places
  lighthouse: 'beacon', volcano: 'eruption', waterfall: 'cliff', pyramid: 'pharaoh', stadium: 'crowd',
  casino: 'jackpot', museum: 'exhibit', cathedral: 'stained', boardwalk: 'pier', canyon: 'deep',
  glacier: 'frozen', plantation: 'crops', observatory: 'dome', dungeon: 'chains', colosseum: 'gladiator',
  // objects
  telescope: 'stargazing', trampoline: 'bounce', chandelier: 'ceiling', microphone: 'stage', compass: 'north',
  lantern: 'glow', stethoscope: 'heartbeat', binoculars: 'distant', hourglass: 'sand', megaphone: 'loud',
  typewriter: 'keys', metronome: 'tempo', periscope: 'submarine', kaleidoscope: 'patterns', sundial: 'shadow',
  // jobs
  astronaut: 'spacesuit', detective: 'clue', lifeguard: 'whistle', magician: 'wand', surgeon: 'scalpel',
  bartender: 'cocktail', blacksmith: 'anvil', locksmith: 'keys', lumberjack: 'timber', puppeteer: 'strings',
  auctioneer: 'gavel', pharmacist: 'pills', electrician: 'wiring', translator: 'language', jeweler: 'gems',
  // movies
  titanic: 'iceberg', jaws: 'shark', inception: 'dream', gladiator: 'arena', frozen: 'snowflake',
  matrix: 'glitch', interstellar: 'wormhole', parasite: 'basement', whiplash: 'drums', dunkirk: 'evacuation',
  zodiac: 'cipher', vertigo: 'heights', arrival: 'aliens', gravity: 'orbit', ratatouille: 'chef',
  // activities
  surfing: 'wave', karaoke: 'lyrics', skydiving: 'parachute', bowling: 'alley', snorkeling: 'reef',
  fencing: 'sword', parkour: 'rooftop', bouldering: 'chalk', stargazing: 'constellation', beekeeping: 'hive',
  archery: 'bullseye', skateboarding: 'ramp', juggling: 'toss', pottery: 'clay', woodworking: 'chisel',
  // vehicles
  helicopter: 'rotor', submarine: 'torpedo', motorcycle: 'helmet', sailboat: 'wind', bulldozer: 'demolition',
  ambulance: 'siren', gondola: 'venice', hovercraft: 'cushion', bobsled: 'ice', chariot: 'horses',
  kayak: 'paddle', trolley: 'tracks', steamship: 'funnel', jetski: 'splash', rickshaw: 'pedal',
  // science
  tornado: 'funnel', asteroid: 'crater', eclipse: 'shadow', tsunami: 'tidal', earthquake: 'fault',
  avalanche: 'snow', dinosaur: 'fossil', bacteria: 'microscope', skeleton: 'bones', satellite: 'orbit',
  magnet: 'attract', fossil: 'ancient',
  // mythology
  phoenix: 'rebirth', kraken: 'tentacles', dragon: 'fire', unicorn: 'horn', werewolf: 'fullmoon',
  mermaid: 'ocean', vampire: 'fangs', griffin: 'eagle', cyclops: 'eye', medusa: 'stone',
  centaur: 'hooves', minotaur: 'labyrinth', banshee: 'wail', gargoyle: 'cathedral', pegasus: 'wings'
};

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

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getPlayer(room, pid) {
  return room.players.find(p => p.id === pid);
}

function broadcastPlayerList(room) {
  io.to(room.code).emit('player-list', room.players.map(p => ({
    id: p.id,
    name: p.name,
    isHost: p.id === room.hostId
  })));
}

function sendRoleToPlayer(room, player) {
  const sock = io.sockets.sockets.get(player.socketId);
  if (!sock) return;
  if (player.id === room.imposterId) {
    sock.emit('role-assigned', { role: 'imposter', word: null, hint: HINT_WORDS[room.currentWord] });
  } else {
    sock.emit('role-assigned', { role: 'normal', word: room.currentWord });
  }
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

  // Every event from the client includes a stable `pid` (client-generated UUID)
  // This decouples identity from the volatile socket.id

  socket.on('create-room', ({ pid, name }) => {
    if (!name || typeof name !== 'string') return socket.emit('error', 'Name is required.');
    name = name.trim().slice(0, 20);
    if (!name) return socket.emit('error', 'Name is required.');
    if (!pid) return socket.emit('error', 'Missing player ID.');

    const code = generateCode();
    const room = {
      code,
      state: 'LOBBY',
      hostId: pid,
      players: [{ id: pid, name, socketId: socket.id }],
      imposterId: null,
      currentWord: null,
      votes: {},
      usedWords: new Set(),
      lastActivity: Date.now()
    };
    rooms.set(code, room);
    socket.join(code);
    socket.pid = pid;
    socket.roomCode = code;

    socket.emit('room-created', { code });
    broadcastPlayerList(room);
  });

  socket.on('join-room', ({ pid, code, name }) => {
    if (!pid) return socket.emit('error', 'Missing player ID.');
    if (!name || typeof name !== 'string') return socket.emit('error', 'Name is required.');
    name = name.trim().slice(0, 20);
    if (!name) return socket.emit('error', 'Name is required.');
    if (!code || typeof code !== 'string') return socket.emit('error', 'Room code is required.');
    code = code.toUpperCase().trim();

    const room = rooms.get(code);
    if (!room) return socket.emit('error', 'Room not found.');

    // Reconnection — player already in room
    const existing = getPlayer(room, pid);
    if (existing) {
      existing.socketId = socket.id;
      delete existing.disconnectedAt;
      socket.join(code);
      socket.pid = pid;
      socket.roomCode = code;
      room.lastActivity = Date.now();

      socket.emit('joined-room', { code, state: room.state });
      broadcastPlayerList(room);

      // Resend game state if in progress
      if (room.state === 'PLAYING') {
        sendRoleToPlayer(room, existing);
        if (room.turnOrder) socket.emit('turn-order', room.turnOrder);
        socket.emit('vote-update', computeVoteTallies(room));
      } else if (room.state === 'REVEAL') {
        // Resend reveal data
        const imposter = getPlayer(room, room.imposterId);
        const tallies = computeVoteTallies(room);
        let maxVotes = 0, mostVotedId = null;
        for (const [id, count] of Object.entries(tallies)) {
          if (count > maxVotes) { maxVotes = count; mostVotedId = id; }
        }
        socket.emit('imposter-revealed', {
          imposterId: room.imposterId,
          imposterName: imposter ? imposter.name : 'Unknown',
          word: room.currentWord,
          caughtImposter: mostVotedId === room.imposterId,
          tallies
        });
      }
      return;
    }

    // New player joining
    if (room.state !== 'LOBBY') return socket.emit('error', 'Game is already in progress.');
    if (room.players.length >= 20) return socket.emit('error', 'Room is full.');
    if (room.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      return socket.emit('error', 'That name is already taken.');
    }

    room.players.push({ id: pid, name, socketId: socket.id });
    socket.join(code);
    socket.pid = pid;
    socket.roomCode = code;
    room.lastActivity = Date.now();

    socket.emit('joined-room', { code, state: room.state });
    broadcastPlayerList(room);
  });

  socket.on('start-game', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return socket.emit('error', 'Room not found.');
    if (room.hostId !== socket.pid) return socket.emit('error', 'Only the host can start the game.');
    if (room.players.length < 3) return socket.emit('error', 'Need at least 3 players to start.');

    room.state = 'PLAYING';
    room.votes = {};
    room.lastActivity = Date.now();

    const word = pickWord(room);
    room.currentWord = word;
    room.usedWords.add(word);

    const imposterIndex = Math.floor(Math.random() * room.players.length);
    room.imposterId = room.players[imposterIndex].id;

    // Random turn order — imposter can go first, totally random
    room.turnOrder = shuffle(room.players).map(p => ({ id: p.id, name: p.name }));

    // Send roles individually
    for (const player of room.players) {
      sendRoleToPlayer(room, player);
    }

    io.to(room.code).emit('game-started', { turnOrder: room.turnOrder });
  });

  socket.on('cast-vote', (targetId) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.state !== 'PLAYING') return;
    if (!getPlayer(room, targetId)) return;
    if (targetId === socket.pid) return socket.emit('error', 'You cannot vote for yourself.');

    room.votes[socket.pid] = targetId;
    room.lastActivity = Date.now();

    io.to(room.code).emit('vote-update', computeVoteTallies(room));
  });

  socket.on('reveal-imposter', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    if (room.hostId !== socket.pid) return socket.emit('error', 'Only the host can reveal.');
    if (room.state !== 'PLAYING') return;

    room.state = 'REVEAL';
    room.lastActivity = Date.now();

    const imposter = getPlayer(room, room.imposterId);
    const tallies = computeVoteTallies(room);

    let maxVotes = 0, mostVotedId = null;
    for (const [id, count] of Object.entries(tallies)) {
      if (count > maxVotes) { maxVotes = count; mostVotedId = id; }
    }

    io.to(room.code).emit('imposter-revealed', {
      imposterId: room.imposterId,
      imposterName: imposter ? imposter.name : 'Unknown',
      word: room.currentWord,
      caughtImposter: mostVotedId === room.imposterId,
      tallies
    });
  });

  socket.on('new-round', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    if (room.hostId !== socket.pid) return socket.emit('error', 'Only the host can start a new round.');

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
    const pid = socket.pid;

    const player = getPlayer(room, pid);
    if (player) player.disconnectedAt = Date.now();

    setTimeout(() => {
      const room = rooms.get(socket.roomCode);
      if (!room) return;
      const player = getPlayer(room, pid);
      if (!player || !player.disconnectedAt) return;
      // If player reconnected with a new socket, don't remove
      if (player.socketId !== socket.id) return;

      const wasHost = room.hostId === pid;
      room.players = room.players.filter(p => p.id !== pid);

      if (room.players.length === 0) {
        rooms.delete(socket.roomCode);
        return;
      }

      if (wasHost) {
        room.hostId = room.players[0].id;
      }
      broadcastPlayerList(room);
    }, 8000);
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
