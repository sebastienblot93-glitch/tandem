// Test d'intégration réseau : deux vrais clients WebSocket jouent le niveau 1 sur le vrai serveur.
const assert = require('assert');
const WebSocket = require('ws');
const { server, close, rooms } = require('../server');
const Sim = require('../public/shared/sim.js');
const { LEVELS } = require('../public/shared/levels.js');
const { TILE, PW, PH } = Sim;

function client(port) {
  const ws = new WebSocket(`ws://localhost:${port}`);
  const c = { ws, q: [], last: null, G: null, you: -1, got: {} };
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    c.q.push(m); c.got[m.t] = m;
    if (m.t === 's' && c.G) Sim.unpack(c.G, m);
    if (m.t === 'room') c.you = m.you;
  });
  c.open = new Promise((res) => ws.on('open', res));
  c.send = (o) => ws.send(JSON.stringify(o));
  c.waitFor = (t, ms = 3000) => new Promise((res, rej) => {
    const t0 = Date.now();
    const id = setInterval(() => {
      const i = c.q.findIndex((m) => m.t === t);
      if (i >= 0) { clearInterval(id); res(c.q.splice(i, 1)[0]); } else if (Date.now() - t0 > ms) { clearInterval(id); rej(new Error('timeout en attendant ' + t)); }
    }, 5);
  });
  return c;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  let ok = 0;
  const step = (n) => { ok++; console.log('  ok  ' + n); };

  const a = client(port), b = client(port);
  await Promise.all([a.open, b.open]);

  // /healthz : version et nombre de niveaux
  const health = await new Promise((res, rej) => require('http').get(`http://localhost:${port}/healthz`, (r) => { let d = ''; r.on('data', (x) => (d += x)); r.on('end', () => res(JSON.parse(d))); }).on('error', rej));
  assert.strictEqual(health.version, require('../package.json').version); assert.strictEqual(health.levels, LEVELS.length); step(`/healthz : version ${health.version}, ${health.levels} niveaux`);

  // code invalide / salle inexistante
  b.send({ t: 'join', code: '1234' }); assert.strictEqual((await b.waitFor('err')).t, 'err'); step('code invalide refusé');
  b.send({ t: 'join', code: 'BCDFG' }); assert((await b.waitFor('err')).m); step('code trop long refusé');

  a.send({ t: 'create' });
  const room = await a.waitFor('room');
  assert(/^[BCDFGHJKLMNPRSTVWXZ]{4}$/.test(room.code) && room.you === 0); step(`salle créée, code ${room.code}`);

  b.send({ t: 'join', code: room.code.toLowerCase() });      // le code est insensible à la casse
  const joined = await b.waitFor('room'); assert.strictEqual(joined.you, 1);
  await a.waitFor('peer'); step('le 2e joueur rejoint, l’hôte est prévenu');

  const c = client(port); await c.open; c.send({ t: 'join', code: room.code });
  assert((await c.waitFor('err')).m.includes('complète')); step('un 3e joueur est refusé'); c.ws.close();

  // couleurs : refus si le partenaire a déjà la couleur, sinon diffusion aux deux
  b.send({ t: 'color', c: 0 }); const refused = await b.waitFor('colors'); await a.waitFor('colors');
  assert(!refused.ok && refused.colors[1] === 1); step('couleur déjà prise refusée');
  b.send({ t: 'color', c: 4 }); const chosen = await a.waitFor('colors'); await b.waitFor('colors');
  assert(chosen.ok && chosen.colors.join() === '0,4'); step('la couleur choisie est vue par le partenaire');
  b.send({ t: 'color', c: 99 }); await sleep(100); assert(!b.q.some((m) => m.t === 'colors')); step('couleur hors palette ignorée');

  // le joueur 2 ne peut pas lancer la partie ; l'hôte oui
  b.send({ t: 'start', level: 0 }); await sleep(100); assert(!b.q.some((m) => m.t === 'start')); step('seul l’hôte peut lancer');
  a.G = Sim.create(LEVELS[0]); b.G = Sim.create(LEVELS[0]);
  a.send({ t: 'start', level: 0 });
  await a.waitFor('start'); await b.waitFor('start'); step('niveau lancé pour les deux');

  // les états arrivent à ~60 Hz
  await sleep(500);
  const t0 = a.G.t; await sleep(1000); const rate = a.G.t - t0;
  assert(rate > 50 && rate < 70, 'cadence ' + rate); step(`cadence serveur : ${rate} ticks/s`);

  // retour volontaire au départ/drapeau : l'événement revient dans l'état, sans mort
  a.send({ t: 'k' }); await sleep(250);
  assert(a.q.some((m) => m.t === 's' && m.e && m.e.some((e) => e[0] === 'recall' && e[1] === 0))); assert.strictEqual(a.G.deaths, 0); step('retour au drapeau demandé par le joueur : événement reçu, 0 mort');

  // Jeu : joueur 0 (a) = haut, joueur 1 (b) = bas. Mêmes gestes que le bot du niveau 1, mais en temps réel et par le réseau.
  const press = (cl, l, r) => cl.send({ t: 'in', l, r });
  const jump = (cl) => cl.send({ t: 'j' });
  const waitCond = async (fn, ms = 6000, what = '') => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('délai dépassé : ' + what); await sleep(8); } };
  const walkTo = async (cl, idx, x, tol = 3) => {
    const p = () => cl.G.players[idx];
    for (let k = 0; k < 800 && Math.abs(p().x - x) > tol; k++) { press(cl, p().x > x ? 1 : 0, p().x < x ? 1 : 0); await sleep(10); }
    press(cl, 0, 0);
  };

  const hop = async (cl, dir, ticks) => { cl.send({ t: 'j' }); press(cl, dir < 0 ? 1 : 0, dir > 0 ? 1 : 0); await sleep(ticks * 16.7); press(cl, 0, 0); };
  const grounded = (cl, idx) => waitCond(() => cl.G.players[idx].onGround, 3000, 'joueur posé');
  // a = joueur 0 (devant) = le « bas » ; b = joueur 1 = le « haut ». Les joueurs sont solides : on ne se dépasse pas.
  const stackOn = async (low, lowIdx, top, topIdx) => {       // le haut se colle au bas puis saute sur sa tête
    await walkTo(top, topIdx, low.G.players[lowIdx].x - PW, 3);
    press(top, 0, 1); jump(top); await sleep(8 * 16.7); press(top, 0, 0);
    await waitCond(() => { const A = a.G.players[0], B = a.G.players[1]; return A.onGround && B.onGround && Math.abs(B.y + PH - A.y) < 0.01; }, 3000, 'haut sur la tête');
  };
  // 1er mur (3 cases)
  await walkTo(a, 0, 12 * TILE - PW, 4);
  await grounded(a, 0);
  await stackOn(a, 0, b, 1);
  step('courte-échelle réussie à travers le réseau');
  await hop(b, 1, 24);                                          // le haut saute sur le mur, va sur la plaque
  await waitCond(() => b.G.players[1].onGround && b.G.players[1].y + PH <= 9 * TILE + 0.5, 3000, 'haut sur le mur');
  await walkTo(b, 1, 12 * TILE + 4, 4);
  await waitCond(() => a.G.open[1], 2000, 'grille ouverte');
  step('la plaque ouvre la grille (état reçu par les deux clients)');
  await walkTo(a, 0, 16 * TILE, 4);                              // le bas passe la grille, le haut redescend et le rejoint
  await walkTo(b, 1, 14 * TILE + 8, 4);
  await grounded(b, 1);
  await walkTo(b, 1, 15 * TILE, 4);
  for (const [cl, idx] of [[a, 0], [b, 1]]) {                    // fosse de 3 cases (19..21)
    await walkTo(cl, idx, 19 * TILE - PW, 3);
    await hop(cl, 1, 34);
    await grounded(cl, idx);
    await walkTo(cl, idx, idx === 0 ? 27 * TILE : 25 * TILE, 4);
  }
  // 2e mur (4 cases) : saut en chaîne, le haut saute 8 ticks après le bas
  await walkTo(a, 0, 30 * TILE - PW, 4);
  await grounded(a, 0);
  await stackOn(a, 0, b, 1);
  await sleep(150);
  jump(a); await sleep(8 * 16.7); await hop(b, 1, 16);
  await waitCond(() => b.G.players[1].onGround && b.G.players[1].y + PH <= 8 * TILE + 0.5, 3000, 'haut sur le 2e mur');
  await walkTo(b, 1, 30 * TILE + 4, 4);
  await waitCond(() => a.G.open[2], 2000, 'grille B ouverte');
  await walkTo(a, 0, 41 * TILE, 4);                              // le bas traverse jusqu’à sa porte, puis le haut redescend vers la sienne
  await walkTo(b, 1, 33 * TILE, 4);
  await grounded(b, 1);
  await walkTo(b, 1, 39 * TILE + 4, 4);
  const win = await a.waitFor('win', 8000);
  assert(win.level === 0); await b.waitFor('win');
  step(`victoire annoncée aux deux joueurs (${(win.ticks / 60).toFixed(1)} s, ${win.deaths} mort)`);

  // niveau suivant, puis retour au menu
  a.send({ t: 'next' }); const st = await a.waitFor('start'); assert.strictEqual(st.level, 1); step('niveau suivant');
  b.send({ t: 'lobby' }); const lob = await a.waitFor('lobby'); assert.strictEqual(lob.by, 1); step('retour au choix des niveaux (le partenaire sait qui l’a demandé)');

  // entraînement : seul l'hôte lance ; ralenti, point de retour et départ à un drapeau se pilotent par le réseau
  a.send({ t: 'start', level: 5, practice: true });
  const pst = await a.waitFor('start'); await b.waitFor('start'); assert(pst.practice === true); step('entraînement lancé pour les deux');
  a.G = Sim.create(LEVELS[5]); b.G = Sim.create(LEVELS[5]);
  b.send({ t: 'speed', v: 7 }); await sleep(100); assert(!a.q.some((m) => m.t === 'speed')); step('ralenti hors liste refusé');
  b.send({ t: 'speed', v: 0.5 }); assert.strictEqual((await a.waitFor('speed')).v, 0.5); await b.waitFor('speed');
  await sleep(500); const q0 = a.G.t; await sleep(1000); const slow = a.G.t - q0;
  assert(slow > 22 && slow < 38, 'cadence au ralenti ' + slow); step(`ralenti ×½ côté serveur : ${slow} ticks/s`);
  a.send({ t: 'speed', v: 1 }); await a.waitFor('speed');
  b.send({ t: 'c' }); await sleep(600); assert(a.G.custom && a.G.custom.length === 2); step('point de retour posé (touche C) et vu par les deux');
  a.send({ t: 'goto', k: 99 }); await sleep(100); assert(a.G.custom, 'goto hors plage accepté'); step('départ à un drapeau inexistant refusé');
  a.send({ t: 'goto', k: 1 }); await sleep(200); assert(!a.G.custom && a.G.cp === 1 && a.G.practice); step('départ à un drapeau : point effacé, drapeau validé');
  a.send({ t: 'lobby' }); await a.waitFor('lobby'); await b.waitFor('lobby');
  a.send({ t: 'start', level: 0 }); const nrm = await a.waitFor('start'); assert(!nrm.practice); await b.waitFor('start');
  a.G = Sim.create(LEVELS[0]); await sleep(200);
  b.send({ t: 'c' }); await sleep(300); assert(!a.G.custom); step('hors entraînement : le point de retour est ignoré');
  b.send({ t: 'lobby' }); await a.waitFor('lobby');

  // chat écrit : relayé aux deux, nettoyé, tronqué, limité en cadence
  a.send({ t: 'chat', m: '  Salut   toi \u0007 ! ' });
  const c1 = await a.waitFor('chat'), c2 = await b.waitFor('chat');
  assert.deepStrictEqual([c1.m, c1.from, c2.m, c2.from], ['Salut toi !', 0, 'Salut toi !', 0]); step('chat : message nettoyé et reçu par les deux, avec l’auteur');
  b.send({ t: 'chat', m: 'x'.repeat(500) }); assert.strictEqual((await a.waitFor('chat')).m.length, 120); await b.waitFor('chat'); step('chat : message tronqué à 120 caractères');
  a.send({ t: 'chat', m: '   ' }); a.send({ t: 'chat' }); await sleep(120); assert(!a.q.some((m) => m.t === 'chat') && !b.q.some((m) => m.t === 'chat')); step('chat : message vide ignoré');
  for (let i = 0; i < 8; i++) b.send({ t: 'chat', m: 'spam ' + i });
  await sleep(250);
  const gotSpam = a.q.filter((m) => m.t === 'chat').length; assert(gotSpam >= 2 && gotSpam <= 4, 'spam relayé : ' + gotSpam);
  assert(b.q.some((m) => m.t === 'err')); a.q.length = 0; b.q.length = 0; step(`chat : anti-spam (${gotSpam + 1} messages passés sur 9, le reste refusé)`);

  // émoticônes : relayées aux deux avec l'auteur, indices hors plage refusés, cadence limitée
  a.send({ t: 'emote', i: 6 });
  const e1 = await a.waitFor('emote'), e2 = await b.waitFor('emote');
  assert.deepStrictEqual([e1.i, e1.from, e2.i, e2.from], [6, 0, 6, 0]); step('émoticône reçue par les deux, avec l’auteur');
  b.send({ t: 'emote', i: 8 }); b.send({ t: 'emote', i: -1 }); b.send({ t: 'emote', i: 'x' }); await sleep(120);
  assert(!a.q.some((m) => m.t === 'emote')); step('émoticône hors liste refusée');
  b.send({ t: 'emote', i: 1 }); b.send({ t: 'emote', i: 2 }); b.send({ t: 'emote', i: 3 }); await sleep(150);
  assert.strictEqual(a.q.filter((m) => m.t === 'emote').length, 1); a.q.length = 0; b.q.length = 0; step('émoticônes : cadence limitée');

  // départ d'un joueur
  b.ws.close(); const left = await a.waitFor('peerLeft'); assert.strictEqual(left.you, 0); assert.strictEqual(rooms.size, 1); step('départ du partenaire géré');
  a.ws.close(); await sleep(100); assert.strictEqual(rooms.size, 0); step('salle supprimée quand tout le monde est parti');

  console.log(`\n${ok} vérifications réseau passées`);
  close();
  process.exit(0);
})().catch((e) => { console.error('ÉCHEC réseau :', e.message); close(); process.exit(1); });
