// TANDEM — serveur : fichiers statiques + salles à deux joueurs en WebSocket.
// Le serveur fait tourner le moteur (public/shared/sim.js) à 60 ticks/s et diffuse l'état à chaque tick.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const Sim = require('./public/shared/sim.js');
const { LEVELS } = require('./public/shared/levels.js');

const PORT = process.env.PORT || 3000;
const TICK_MS = 1000 / 60;
const MAX_ROOMS = 500;
const MAX_MSG = 2048;

let VERSION = '?';
try { VERSION = require('./package.json').version; } catch { /* ignore */ }

// Fichiers statiques (le dossier public/) sans dépendance : index.html, game.js, shared/sim.js…
const PUBLIC = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};
function handleHttp(req, res) {
  const headers = { 'Cache-Control': 'no-store, must-revalidate', 'X-Content-Type-Options': 'nosniff' };
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400, headers); return res.end('Requête invalide'); }
  if (pathname === '/healthz') {
    res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, headers));
    return res.end(JSON.stringify({ ok: true, version: VERSION, rooms: rooms.size, levels: LEVELS.length }));
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, headers); return res.end(); }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.normalize(path.join(PUBLIC, pathname));
  if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) { res.writeHead(403, headers); return res.end('Interdit'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, headers); return res.end('Introuvable'); }
    res.writeHead(200, Object.assign({ 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size }, headers));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(handleHttp);
const wss = new WebSocketServer({ server, maxPayload: MAX_MSG });

/** @type {Map<string, any>} */
const rooms = new Map();

const EMOTES = 8;                                           // nombre d'émoticônes (voir public/game.js)
const CHAT_MAX = 120, CHAT_RATE = 5, CHAT_WIN = 6000;      // messages : 120 caractères, 5 par 6 s
// Le code d'une salle : 4 lettres (consonnes seulement : pas de mots, pas de confusion), ex. « KRTB »
const CODE_LETTERS = 'BCDFGHJKLMNPRSTVWXZ';
function newCode() {
  for (let k = 0; k < 200; k++) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
    if (!rooms.has(c)) return c;
  }
  return null;
}

const send = (ws, msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };
const toRoom = (room, msg) => room.players.forEach((ws) => send(ws, msg));

function makeRoom(code) {
  return {
    code, players: [], state: 'lobby', level: 0, G: null,
    held: [{ l: 0, r: 0 }, { l: 0, r: 0 }], jumpQ: [0, 0], kQ: [0, 0], cQ: [0, 0], practice: false, speed: 1, sacc: 0, colors: [0, 1], lastActive: Date.now(), winSent: false,
  };
}

function startLevel(room, level) {
  room.level = level;
  room.G = Sim.create(LEVELS[level]);
  room.state = 'play';
  room.winSent = false;
  room.held = [{ l: 0, r: 0 }, { l: 0, r: 0 }];
  room.jumpQ = [0, 0]; room.kQ = [0, 0]; room.cQ = [0, 0]; room.speed = 1; room.sacc = 0;
  if (room.practice) room.G.practice = true;
  toRoom(room, { t: 'start', level, practice: room.practice });
}

function backToLobby(room, by) {
  room.state = 'lobby';
  room.G = null; room.practice = false; room.speed = 1;
  toRoom(room, { t: 'lobby', level: room.level, by: by === undefined ? -1 : by });
}

function leave(ws) {
  const room = ws.room;
  if (!room) return;
  ws.room = null;
  const i = room.players.indexOf(ws);
  if (i < 0) return;
  room.players.splice(i, 1);
  if (!room.players.length) { rooms.delete(room.code); return; }
  // Il reste un joueur : il redevient l'hôte (joueur 1) et la salle repasse en attente
  room.state = 'lobby';
  room.G = null;
  room.players[0].slot = 0;
  const keep = room.colors[i === 0 ? 1 : 0];                 // le joueur restant garde sa couleur
  room.colors = [keep, keep === 1 ? 0 : 1];
  send(room.players[0], { t: 'peerLeft', you: 0, code: room.code, level: room.level, colors: room.colors });
}

wss.on('connection', (ws) => {
  ws.room = null; ws.slot = -1; ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('close', () => leave(ws));
  ws.on('error', () => {});

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    const room = ws.room;
    if (room) room.lastActive = Date.now();

    switch (m.t) {
      case 'ping': send(ws, { t: 'pong', ts: m.ts }); break;

      case 'create': {
        if (room) leave(ws);
        if (rooms.size >= MAX_ROOMS) return send(ws, { t: 'err', m: 'Le serveur est plein, réessayez plus tard.' });
        const code = newCode();
        if (!code) return send(ws, { t: 'err', m: 'Impossible de créer une salle.' });
        const r = makeRoom(code);
        rooms.set(code, r);
        r.players.push(ws); ws.room = r; ws.slot = 0;
        send(ws, { t: 'room', code, you: 0, level: r.level, count: 1, colors: r.colors });
        break;
      }

      case 'join': {
        const code = String(m.code || '').toUpperCase().replace(/\s+/g, '');
        if (!/^[A-Z]{4}$/.test(code)) return send(ws, { t: 'err', m: 'Code invalide.' });
        const r = rooms.get(code);
        if (!r) return send(ws, { t: 'err', m: 'Aucune salle avec ce code.' });
        if (r.players.length >= 2) return send(ws, { t: 'err', m: 'Cette salle est déjà complète.' });
        if (room) leave(ws);
        r.players.push(ws); ws.room = r; ws.slot = 1;
        send(ws, { t: 'room', code, you: 1, level: r.level, count: 2, colors: r.colors });
        send(r.players[0], { t: 'peer', count: 2, colors: r.colors });
        break;
      }

      case 'sel': { // l'hôte parcourt les niveaux : l'autre joueur voit sa sélection
        if (!room || room.state !== 'lobby' || ws.slot !== 0) return;
        const lv = Number(m.level);
        if (!Number.isInteger(lv) || lv < 0 || lv >= LEVELS.length) return;
        room.level = lv;
        toRoom(room, { t: 'sel', level: lv });
        break;
      }

      case 'start': {
        if (!room || room.players.length < 2 || ws.slot !== 0) return;
        const lv = Number(m.level);
        if (!Number.isInteger(lv) || lv < 0 || lv >= LEVELS.length) return;
        room.practice = !!m.practice;
        startLevel(room, lv);
        break;
      }

      case 'restart': if (room && room.state !== 'lobby' && room.players.length === 2) startLevel(room, room.level); break;

      case 'next': {
        if (!room || room.state !== 'play' || !room.G || !room.G.won || room.players.length < 2) return;
        if (room.level + 1 < LEVELS.length) startLevel(room, room.level + 1); else backToLobby(room);
        break;
      }

      case 'lobby': if (room && room.state !== 'lobby') backToLobby(room, ws.slot); break;

      case 'color': { // choix de la couleur de son personnage (refusé si le partenaire a déjà cette couleur)
        if (!room) return;
        const c = Number(m.c);
        if (!Number.isInteger(c) || c < 0 || c >= Sim.NCOLORS) return;
        if (c !== room.colors[1 - ws.slot]) room.colors[ws.slot] = c;
        toRoom(room, { t: 'colors', colors: room.colors, from: ws.slot, ok: room.colors[ws.slot] === c });
        break;
      }

      case 'in': { // état des touches gauche / droite
        if (!room || room.state !== 'play') return;
        room.held[ws.slot] = { l: m.l ? 1 : 0, r: m.r ? 1 : 0 };
        break;
      }
      case 'j': if (room && room.state === 'play') room.jumpQ[ws.slot] = 1; break;
      case 'c': if (room && room.state === 'play' && room.practice) room.cQ[ws.slot] = 1; break;      // entraînement : poser un point de retour
      case 'goto': { // entraînement : repartir du début (-1) ou d'un drapeau
        if (!room || room.state !== 'play' || !room.practice || !room.G) return;
        const k = Number(m.k);
        if (!Number.isInteger(k) || k < -1 || k >= room.G.L.flags.length) return;
        Sim.practiceGoto(room.G, k);
        break;
      }
      case 'speed': { // entraînement : ralenti
        if (!room || !room.practice || ![1, 0.5, 0.25].includes(m.v)) return;
        room.speed = m.v; toRoom(room, { t: 'speed', v: m.v });
        break;
      }
      case 'k': if (room && room.state === 'play') room.kQ[ws.slot] = 1; break; // retour au dernier drapeau

      case 'emote': { // émoticône (0..7) affichée au-dessus du personnage de l'émetteur chez les deux joueurs
        if (!room || room.players.length < 2) return;
        const i = Number(m.i);
        if (!Number.isInteger(i) || i < 0 || i >= EMOTES) return;
        const now = Date.now();
        if (ws.emoT && now - ws.emoT < 350) return;
        ws.emoT = now;
        toRoom(room, { t: 'emote', i, from: ws.slot });
        break;
      }

      case 'chat': { // message écrit : nettoyé, limité en longueur et en cadence, relayé aux deux joueurs
        if (!room || room.players.length < 2) return;
        const txt = String(m.m == null ? '' : m.m).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
        if (!txt) return;
        const now = Date.now();
        ws.chatT = (ws.chatT || []).filter((t) => now - t < CHAT_WIN);
        if (ws.chatT.length >= CHAT_RATE) return send(ws, { t: 'err', m: 'Doucement : trop de messages à la suite.' });
        ws.chatT.push(now);
        toRoom(room, { t: 'chat', m: txt, from: ws.slot });
        break;
      }
      default: break;
    }
  });
});

/* ---------- Boucle de jeu à 60 Hz (rattrapage borné pour absorber les à-coups) ---------- */
let last = process.hrtime.bigint();
let acc = 0;
function loop() {
  const now = process.hrtime.bigint();
  acc += Number(now - last) / 1e6;
  last = now;
  if (acc > TICK_MS * 6) acc = TICK_MS * 6;
  while (acc >= TICK_MS) {
    acc -= TICK_MS;
    for (const room of rooms.values()) {
      if (room.state !== 'play' || !room.G) continue;
      if (room.speed < 1) { room.sacc += room.speed; if (room.sacc < 1) continue; room.sacc -= 1; }      // ralenti (entraînement)
      const inputs = [0, 1].map((i) => ({ l: room.held[i].l, r: room.held[i].r, j: room.jumpQ[i], k: room.kQ[i], c: room.cQ[i] }));
      room.jumpQ = [0, 0]; room.kQ = [0, 0]; room.cQ = [0, 0];
      const G = room.G;
      const wasWon = G.won;
      Sim.step(G, inputs);
      if (G.won && !wasWon && !room.winSent) {
        room.winSent = true;
        toRoom(room, { t: 'win', level: room.level, ticks: G.t, deaths: G.deaths });
      }
      if (G.wonT > 60 * 20) continue; // inutile de diffuser indéfiniment une salle qui n'avance plus
      const msg = Object.assign({ t: 's' }, Sim.pack(G));
      toRoom(room, msg);
    }
  }
}
const loopTimer = setInterval(loop, 4);

// Nettoyage : connexions mortes et salles abandonnées
const sweep = setInterval(() => {
  wss.clients.forEach((ws) => { if (!ws.alive) return ws.terminate(); ws.alive = false; ws.ping(); });
  const now = Date.now();
  for (const [code, room] of rooms) if (now - room.lastActive > 30 * 60 * 1000) { room.players.forEach((p) => p.close()); rooms.delete(code); }
}, 15000);

function close() { clearInterval(loopTimer); clearInterval(sweep); wss.close(); server.close(); }

if (require.main === module) {
  server.listen(PORT, () => console.log(`TANDEM prêt : http://localhost:${PORT}  (${LEVELS.length} niveaux)`));
}
module.exports = { server, rooms, close };
