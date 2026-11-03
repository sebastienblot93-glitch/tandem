// Banc d'essai : fait jouer deux « bots » (générateurs) dans le vrai moteur, sans navigateur.
// Chaque `yield` = fin d'un tick. Les entrées sont remises à zéro à chaque tick : un bot qui ne fait rien reste immobile.
const Sim = require('../public/shared/sim.js');
const { TILE, PW, PH, COLS, ROWS } = Sim;

// Construit un niveau de test : cadre de murs + dessin libre
function makeDef(draw, cfg, cols = COLS, rows = ROWS) {
  const g = Array.from({ length: rows }, () => Array(cols).fill('.'));
  const rect = (x, y, w, h, c = '#') => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) g[y + j][x + i] = c; };
  const put = (x, y, c) => { g[y][x] = c; };
  rect(0, 0, cols, 1); rect(0, rows - 1, cols, 1); rect(0, 0, 1, rows); rect(cols - 1, 0, 1, rows);
  draw({ rect, put });
  return { name: 'test', rows: g.map((r) => r.join('')), cfg: cfg || {} };
}

function makeCtl(G, i, inputs) {
  const me = G.players[i];
  const other = G.players[1 - i];
  const inp = inputs[i];
  const api = {
    G, me, other, i,
    cx: (p = me) => p.x + PW / 2,
    *wait(n) { for (let k = 0; k < n; k++) yield; },
    *until(fn, max = 2400, label = '') {
      let k = 0;
      while (!fn()) { yield; if (++k > max) throw new Error(`bot ${i} : attente trop longue ${label}`); }
    },
    // marche jusqu'à ce que le bord gauche du joueur soit à x (± tol)
    *walkTo(x, tol = 2) {
      let k = 0;
      while (Math.abs(me.x - x) > tol) {
        if (me.x < x) inp.r = 1; else inp.l = 1;
        yield;
        if (++k > 1500) throw new Error(`bot ${i} : walkTo(${x}) bloqué en x=${me.x}`);
      }
    },
    // marche vers le centre de la case tx
    *walkToTile(tx, tol = 2) { yield* api.walkTo(tx * TILE + (TILE - PW) / 2, tol); },
    *hold(dir, n) { for (let k = 0; k < n; k++) { if (dir > 0) inp.r = 1; else if (dir < 0) inp.l = 1; yield; } },
    *jump() { inp.j = 1; yield; },
    *recall() { inp.k = 1; yield; },                          // retour volontaire au dernier drapeau
    // saute en maintenant une direction pendant n ticks (le saut est pressé au 1er tick)
    *hop(dir, n) { for (let k = 0; k < n; k++) { if (k === 0) inp.j = 1; if (dir > 0) inp.r = 1; else if (dir < 0) inp.l = 1; yield; } },
    // saute vers la position x (bord gauche du joueur) : on tient la direction tant qu'on n'y est pas, puis on se laisse tomber
    *hopTo(x, max = 90) {
      let k = 0;
      inp.j = 1;
      for (;;) {
        if (me.x < x - 1) inp.r = 1; else if (me.x > x + 1) inp.l = 1;
        yield;
        k++;
        if (k > 3 && me.onGround) break;
        if (k > max) throw new Error(`bot ${i} : hopTo(${x}) ne retombe pas (x=${me.x}, y=${me.y})`);
      }
    },
    // monte sur la tête du partenaire : on se colle à lui puis on saute vers lui
    *mount(max = 200) {
      const dir = other.x > me.x ? 1 : -1;
      yield* api.walkTo(other.x - dir * PW, 1);
      yield* api.hop(dir, 8);
      let k = 0;
      while (!(me.onGround && Math.abs(me.y + PH - other.y) < 0.01)) { yield; if (++k > max) throw new Error(`bot ${i} : n'arrive pas à monter sur le partenaire (x=${me.x}, y=${me.y})`); }
    },
    // attend que moi et l'autre soyons posés, centrés sur les cases données
    *bothAt(myTx, otherTx, tol = 2) {
      yield* api.until(() => me.onGround && other.onGround && Math.abs(me.x - (myTx * TILE + 4)) <= tol && Math.abs(other.x - (otherTx * TILE + 4)) <= tol, 1800, `(bothAt ${myTx},${otherTx})`);
    },
    // saut synchronisé : on attend d'être en place, puis on saute (delay ticks plus tard pour l'un des deux)
    *syncJump(myTx, otherTx, delay = 0) {
      yield* api.bothAt(myTx, otherTx);
      yield* api.wait(2 + delay);
      yield* api.jump();
    },
    // attend d'être posé au sol
    *land(max = 200) { let k = 0; while (!me.onGround) { yield; if (++k > max) throw new Error(`bot ${i} : ne retombe jamais`); } },
  };
  return api;
}

// scripts : [function*(ctl), function*(ctl)] ; retourne { won, ticks, G, log }
function run(def, scripts, opts = {}) {
  const G = Sim.create(def);
  const inputs = [{ l: 0, r: 0, j: 0, k: 0 }, { l: 0, r: 0, j: 0, k: 0 }];
  const gens = scripts.map((s, i) => (s ? s(makeCtl(G, i, inputs)) : null));
  const max = opts.max || 7200;
  const log = [];
  let err = null;
  for (let tick = 0; tick < max; tick++) {
    inputs.forEach((o) => { o.l = 0; o.r = 0; o.j = 0; o.k = 0; });
    for (let i = 0; i < 2 && !err; i++) {
      if (!gens[i]) continue;
      try { const r = gens[i].next(); if (r.done) gens[i] = null; } catch (e) { err = e; }
    }
    if (err) break;
    Sim.step(G, inputs);
    if (opts.onTick) opts.onTick(G, tick);
    G.events.forEach((e) => log.push([G.t, ...e]));
    if (G.won) return { won: true, ticks: G.t, G, log, deaths: G.deaths };
  }
  return { won: false, ticks: G.t, G, log, deaths: G.deaths, error: err };
}

// Affiche le niveau en ASCII avec les joueurs (pour relire un niveau)
function ascii(G) {
  const rows = G.L.rows.map((r) => r.split(''));
  G.players.forEach((p, i) => {
    const tx = Math.floor((p.x + PW / 2) / TILE), ty = Math.floor((p.y + PH / 2) / TILE);
    if (rows[ty] && rows[ty][tx] !== undefined) rows[ty][tx] = i === 0 ? 'X' : 'Y';
  });
  return rows.map((r, y) => String(y).padStart(2) + ' ' + r.join('')).join('\n');
}

module.exports = { makeDef, run, ascii, Sim, TILE, PW, PH, COLS, ROWS };
