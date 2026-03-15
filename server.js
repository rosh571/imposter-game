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
    'platypus', 'axolotl', 'pangolin', 'narwhal', 'capybara', 'quokka', 'okapi',
    'wolverine', 'manatee', 'armadillo', 'chinchilla', 'komodo', 'lemur', 'ibex', 'jackal'
  ],
  food: [
    'gnocchi', 'tempura', 'ceviche', 'risotto', 'kimchi', 'brioche', 'gazpacho',
    'prosciutto', 'tiramisu', 'falafel', 'poutine', 'ratatouille', 'baklava', 'mochi', 'edamame'
  ],
  places: [
    'catacombs', 'fjord', 'bazaar', 'archipelago', 'colosseum', 'kremlin', 'oasis',
    'pagoda', 'citadel', 'minaret', 'boardwalk', 'observatory', 'plantation', 'quarry', 'ravine'
  ],
  objects: [
    'kaleidoscope', 'metronome', 'sextant', 'gramophone', 'abacus', 'stethoscope',
    'periscope', 'theremin', 'sundial', 'astrolabe', 'bellows', 'gyroscope', 'monocle', 'pendulum', 'prism'
  ],
  jobs: [
    'taxidermist', 'cartographer', 'sommelier', 'locksmith', 'coroner', 'blacksmith',
    'auctioneer', 'stenographer', 'midwife', 'chimneysweep', 'lumberjack', 'geologist',
    'puppeteer', 'falconer', 'curator'
  ],
  movies: [
    'memento', 'zodiac', 'arrival', 'whiplash', 'amelie', 'oldboy', 'vertigo',
    'moonlight', 'parasite', 'casablanca', 'psycho', 'rashomon', 'stalker', 'dunkirk', 'tenet'
  ],
  activities: [
    'fencing', 'parkour', 'taxidermy', 'falconry', 'calligraphy', 'orienteering',
    'beekeeping', 'glassblowing', 'spelunking', 'foraging', 'whittling', 'stargazing',
    'geocaching', 'blacksmithing', 'bouldering'
  ],
  vehicles: [
    'zeppelin', 'gondola', 'hovercraft', 'rickshaw', 'catamaran', 'bobsled',
    'chariot', 'dirigible', 'sampan', 'funicular', 'dragster', 'kayak', 'trolley', 'triplane', 'schooner'
  ],
  science: [
    'centrifuge', 'nebula', 'isotope', 'tectonic', 'genome', 'quasar', 'enzyme',
    'photon', 'catalyst', 'prion', 'osmosis', 'mitosis', 'synapse', 'entropy', 'magnetar'
  ],
  mythology: [
    'minotaur', 'valkyrie', 'cerberus', 'phoenix', 'kraken', 'banshee', 'chimera',
    'griffin', 'hydra', 'sphinx', 'cyclops', 'medusa', 'centaur', 'gargoyle', 'wendigo'
  ]
};

const ALL_WORDS = Object.values(WORDS).flat();

// ── Hint Words (one thematic hint per word for the imposter) ──
const HINT_WORDS = {
  // animals
  platypus: 'beak', axolotl: 'gills', pangolin: 'scales', narwhal: 'tusk', capybara: 'rodent',
  quokka: 'smile', okapi: 'stripes', wolverine: 'claws', manatee: 'seagrass', armadillo: 'shell',
  chinchilla: 'fur', komodo: 'venom', lemur: 'madagascar', ibex: 'horns', jackal: 'scavenger',
  // food
  gnocchi: 'potato', tempura: 'batter', ceviche: 'lime', risotto: 'arborio', kimchi: 'fermented',
  brioche: 'butter', gazpacho: 'cold', prosciutto: 'cured', tiramisu: 'espresso', falafel: 'chickpea',
  poutine: 'gravy', ratatouille: 'vegetables', baklava: 'phyllo', mochi: 'sticky', edamame: 'soybean',
  // places
  catacombs: 'skulls', fjord: 'glacier', bazaar: 'haggle', archipelago: 'islands', colosseum: 'gladiator',
  kremlin: 'moscow', oasis: 'desert', pagoda: 'temple', citadel: 'fortress', minaret: 'mosque',
  boardwalk: 'pier', observatory: 'dome', plantation: 'crops', quarry: 'stone', ravine: 'gorge',
  // objects
  kaleidoscope: 'patterns', metronome: 'tempo', sextant: 'navigation', gramophone: 'vinyl', abacus: 'beads',
  stethoscope: 'heartbeat', periscope: 'submarine', theremin: 'antenna', sundial: 'shadow', astrolabe: 'celestial',
  bellows: 'forge', gyroscope: 'spin', monocle: 'lens', pendulum: 'swing', prism: 'rainbow',
  // jobs
  taxidermist: 'mounted', cartographer: 'maps', sommelier: 'wine', locksmith: 'keys', coroner: 'autopsy',
  blacksmith: 'anvil', auctioneer: 'gavel', stenographer: 'shorthand', midwife: 'delivery', chimneysweep: 'soot',
  lumberjack: 'timber', geologist: 'rocks', puppeteer: 'strings', falconer: 'hawk', curator: 'gallery',
  // movies
  memento: 'backwards', zodiac: 'cipher', arrival: 'linguistics', whiplash: 'drums', amelie: 'paris',
  oldboy: 'revenge', vertigo: 'heights', moonlight: 'chapters', parasite: 'basement', casablanca: 'piano',
  psycho: 'shower', rashomon: 'testimony', stalker: 'zone', dunkirk: 'evacuation', tenet: 'inversion',
  // activities
  fencing: 'foil', parkour: 'rooftop', taxidermy: 'preservation', falconry: 'raptor', calligraphy: 'ink',
  orienteering: 'compass', beekeeping: 'hive', glassblowing: 'furnace', spelunking: 'cave', foraging: 'mushroom',
  whittling: 'knife', stargazing: 'constellation', geocaching: 'coordinates', blacksmithing: 'anvil', bouldering: 'chalk',
  // vehicles
  zeppelin: 'hydrogen', gondola: 'venice', hovercraft: 'cushion', rickshaw: 'pedal', catamaran: 'hull',
  bobsled: 'ice', chariot: 'horses', dirigible: 'airship', sampan: 'river', funicular: 'cable',
  dragster: 'nitro', kayak: 'paddle', trolley: 'tracks', triplane: 'wings', schooner: 'mast',
  // science
  centrifuge: 'spin', nebula: 'dust', isotope: 'atom', tectonic: 'plates', genome: 'dna',
  quasar: 'luminous', enzyme: 'protein', photon: 'light', catalyst: 'reaction', prion: 'misfolded',
  osmosis: 'membrane', mitosis: 'division', synapse: 'neuron', entropy: 'disorder', magnetar: 'magnetic',
  // mythology
  minotaur: 'labyrinth', valkyrie: 'warrior', cerberus: 'threeheaded', phoenix: 'rebirth', kraken: 'tentacles',
  banshee: 'wail', chimera: 'hybrid', griffin: 'eagle', hydra: 'regrow', sphinx: 'riddle',
  cyclops: 'eye', medusa: 'stone', centaur: 'hooves', gargoyle: 'cathedral', wendigo: 'hunger'
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
