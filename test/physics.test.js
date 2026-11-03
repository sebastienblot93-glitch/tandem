// Tests de physique : ce que le jeu autorise vraiment (et ce qu'il interdit)
const assert = require('assert');
const { makeDef, run, ascii, Sim, TILE, PW, PH } = require('./harness');

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log('  ok  ' + name); } catch (e) { console.log('  ÉCHEC ' + name + '\n        ' + e.message); process.exitCode = 1; } };
const doors = (put) => { put(25, 1, 'D'); put(27, 1, 'D'); };

t('un saut seul monte de ~85 px (moins de 3 cases)', () => {
  const def = makeDef(({ put }) => { put(2, 13, '1'); put(27, 13, '2'); doors(put); });
  let minY = 1e9, y0 = null;
  run(def, [function* (c) { y0 = c.me.y; yield* c.wait(3); yield* c.jump(); yield* c.wait(60); }, null], { max: 80, onTick: (G) => { minY = Math.min(minY, G.players[0].y); } });
  const rise = y0 - minY;
  console.log(`        hauteur d'un saut : ${rise} px = ${(rise / TILE).toFixed(2)} cases`);
  assert(rise > 80 && rise < 90, 'hauteur inattendue ' + rise);
});

function wallAlone(h) {
  const def = makeDef(({ rect, put }) => { put(2, 13, '1'); put(27, 13, '2'); rect(10, 14 - h, 2, h); doors(put); });
  let reached = false;
  run(def, [function* (c) {
    yield* c.walkTo(10 * TILE - PW - 2);
    for (let k = 0; k < 6; k++) { yield* c.hop(1, 40); yield* c.land(); yield* c.wait(2); }
  }, null], { max: 600, onTick: (G) => { if (G.players[0].x > 12 * TILE) reached = true; } });
  return reached;
}
t('un mur de 2 cases se franchit seul', () => assert(wallAlone(2)));
t('un mur de 3 cases ne se franchit PAS seul', () => assert(!wallAlone(3)));

// Corniche de h cases : le joueur 0 est en bas (collé à la corniche), le joueur 1 monte sur sa tête, puis saute.
// bottomJumps = false : simple courte-échelle. Sinon, le bas saute et le haut saute `delay` ticks après son décollage.
function ledge(h, delay, bottomJumps) {
  const def = makeDef(({ rect, put }) => { put(8, 13, '1'); put(2, 13, '2'); rect(14, 14 - h, 6, h); doors(put); });
  const edge = 14 * TILE, top = (14 - h) * TILE;
  let ok = false;
  const r = run(def, [
    function* (c) {
      yield* c.walkTo(edge - PW);
      yield* c.until(() => Math.abs(c.other.y + PH - c.me.y) < 0.01 && c.other.onGround, 600, '(rider)');
      yield* c.wait(8);
      if (bottomJumps) yield* c.jump();
      yield* c.wait(120);
    },
    function* (c) {
      yield* c.until(() => c.other.x >= edge - PW && c.other.onGround, 600, '(bottom en place)');
      yield* c.wait(6);
      yield* c.mount();
      yield* c.wait(8);
      if (bottomJumps) { yield* c.until(() => c.other.vy < 0, 300); yield* c.wait(delay); } 
      yield* c.hop(1, 60);
      yield* c.wait(40);
    },
  ], { max: 700, onTick: (G) => { const p = G.players[1]; if (p.x > edge + 2 && Math.abs(p.y + PH - top) < 0.6 && p.onGround) ok = true; } });
  return { ok, G: r.G };
}
t('courte-échelle : une corniche de 3 cases se franchit à deux', () => { const r = ledge(3, 0, false); assert(r.ok, 'échec\n' + ascii(r.G)); });
t('courte-échelle : une corniche de 4 cases NE se franchit PAS sans que le bas saute', () => { assert(!ledge(4, 0, false).ok); });

[4, 5, 6].forEach((h) => {
  const w = [];
  for (let d = 0; d < 45; d++) if (ledge(h, d, true).ok) w.push(d);
  console.log(`        saut en chaîne, corniche de ${h} cases : fenêtre = ${w.length ? `de ${w[0]} à ${w[w.length - 1]} ticks après le décollage (${w.length} ticks = ${(w.length / 60).toFixed(2)} s)` : 'IMPOSSIBLE'}`);
});
t('saut en chaîne : une corniche de 6 cases est possible', () => { let any = false; for (let d = 0; d < 45; d++) if (ledge(6, d, true).ok) any = true; assert(any); });
t('saut en chaîne : une corniche de 7 cases est impossible', () => { let any = false; for (let d = 0; d < 45; d++) if (ledge(7, d, true).ok) any = true; assert(!any); });

t('le joueur sur la tête est porté par celui du bas', () => {
  const def = makeDef(({ put }) => { put(8, 13, '1'); put(2, 13, '2'); doors(put); });
  let carried = false;
  const r = run(def, [
    function* (c) { yield* c.until(() => Math.abs(c.other.y + PH - c.me.y) < 0.01, 600); yield* c.wait(5); yield* c.walkTo(500); yield* c.wait(5); },
    function* (c) { yield* c.wait(20); yield* c.mount(); yield* c.wait(200); },
  ], { max: 600, onTick: (G) => { const a = G.players[0], b = G.players[1]; if (Math.abs(b.y + PH - a.y) < 0.01 && a.x > 450 && Math.abs(b.x - a.x) < PW) carried = true; } });
  assert(carried, 'le joueur du haut n’a pas été porté\n' + ascii(r.G));
});

t('une grille s’ouvre tant qu’une plaque est pressée, puis se referme', () => {
  const def = makeDef(({ rect, put }) => { put(2, 13, '1'); put(26, 13, '2'); put(6, 13, 'a'); rect(12, 1, 1, 13, 'A'); doors(put); });
  let openSeen = false, closedAfter = false;
  run(def, [function* (c) { yield* c.walkToTile(6); yield* c.wait(40); yield* c.walkToTile(3); yield* c.wait(40); }, null],
    { max: 200, onTick: (G) => { if (G.open[1]) openSeen = true; else if (openSeen) closedAfter = true; } });
  assert(openSeen && closedAfter);
});

t('le groupe de plaques n’est actif que si TOUTES les plaques sont pressées', () => {
  const def = makeDef(({ rect, put }) => { put(2, 13, '1'); put(26, 13, '2'); put(6, 13, 'a'); put(9, 13, 'a'); rect(12, 1, 1, 13, 'A'); doors(put); });
  let openWithOne = false;
  run(def, [function* (c) { yield* c.walkToTile(6); yield* c.wait(60); }, null], { max: 120, onTick: (G) => { if (G.open[1]) openWithOne = true; } });
  assert(!openWithOne);
});

// Cloche : un bloc frappé par-dessous. Placée 3 lignes au-dessus du sol : un saut seul l'atteint ; 4 lignes : il faut être deux.
function bellTest(row, stacked) {
  const def = makeDef(({ rect, put }) => { put(8, row, 'u'); rect(14, 13, 4, 1, 'M'); doors(put); put(3, 13, '1'); put(24, 13, '2'); }, { bell: { 1: { dur: 100 } } });
  let rang = false, bridged = 0;
  const scripts = stacked ? [
    function* (c) { yield* c.walkTo(8 * TILE - 2); yield* c.wait(40); },                                         // le bas
    function* (c) { yield* c.walkTo(8 * TILE - 2 - PW); yield* c.wait(6); yield* c.mount(); yield* c.wait(8); yield* c.jump(); yield* c.wait(30); },
  ] : [
    function* (c) { yield* c.walkToTile(8); yield* c.wait(4); yield* c.jump(); yield* c.wait(30); }, null,
  ];
  if (stacked) { scripts[0] = function* (c) { yield* c.walkToTile(8); yield* c.wait(60); }; scripts[1] = function* (c) { yield* c.until(() => Math.abs(c.other.x - (8 * TILE + 4)) < 3, 300); yield* c.wait(4); yield* c.mount(); yield* c.wait(8); yield* c.jump(); yield* c.wait(30); }; }
  run(def, scripts, { max: 260, onTick: (G) => { if (G.bridge[1] > 0) bridged++; G.events.forEach((e) => { if (e[0] === 'bell') rang = true; }); } });
  return { rang, bridged };
}
t('cloche à 3 lignes du sol : un joueur seul la fait sonner, le pont dure bien dur ticks', () => {
  const r = bellTest(10, false);                 // cloche en ligne 10 ; debout en ligne 13 → 3 lignes
  assert(r.rang, 'la cloche n’a pas sonné');
  assert(r.bridged >= 98 && r.bridged <= 100, 'durée du pont : ' + r.bridged);
});
t('cloche à 4 lignes du sol : impossible seul, possible à deux (courte-échelle)', () => {
  assert(!bellTest(9, false).rang, 'sonnée seul');
  assert(bellTest(9, true).rang, 'pas sonnée à deux');
});

t('marches fantômes : elles n’existent que tant que la plaque est tenue', () => {
  const def = makeDef(({ rect, put }) => { put(4, 13, 'a'); put(8, 12, 'X'); doors(put); put(2, 13, '1'); put(20, 13, '2'); });
  let withPlate = 0, without = 0;
  run(def, [function* (c) { yield* c.wait(10); yield* c.walkToTile(4); yield* c.wait(30); yield* c.walkToTile(2); yield* c.wait(30); }, null],
    { max: 140, onTick: (G, k) => { const cell = G.dyn[12 * 30 + 8]; if (G.players[0].x < 4 * TILE + 8 && G.plateOn[0] && cell) withPlate++; if (!G.plateOn[0] && cell) without++; } });
  assert(withPlate > 10, 'la marche n’apparaît pas');
  assert(without <= 2, 'la marche reste sans la plaque (' + without + ' ticks)');   // 1 tick de décalage normal
});

t('porte à cloche : le mur disparaît pendant dur ticks, puis revient', () => {
  const def = makeDef(({ rect, put }) => { put(4, 10, 'u'); rect(10, 10, 1, 4, 'M'); doors(put); put(3, 13, '1'); put(20, 13, '2'); }, { bell: { 1: { dur: 60, door: true } } });
  let closedAtStart = false, openMid = false, closedAfter = false;
  run(def, [function* (c) { yield* c.wait(5); yield* c.walkToTile(4); yield* c.wait(3); yield* c.jump(); yield* c.wait(150); }, null],
    { max: 200, onTick: (G, k) => { const cell = G.dyn[13 * 30 + 10]; if (k === 2 && cell) closedAtStart = true; if (G.bridge[1] > 20 && !cell) openMid = true; if (k > 170 && cell) closedAfter = true; } });
  assert(closedAtStart && openMid && closedAfter);
});

// ---- Nouvelles mécaniques (les blocs spéciaux remplacent le sol : ligne 14, on marche dessus en ligne 13)
t('tremplin : un saut depuis un tremplin monte à ~6 cases', () => {
  const def = makeDef(({ put }) => { put(5, 14, 'T'); put(2, 13, '1'); put(24, 13, '2'); doors(put); });
  let minY = 1e9, y0 = null;
  run(def, [function* (c) { yield* c.walkToTile(5); yield* c.wait(6); y0 = c.me.y; yield* c.jump(); yield* c.wait(80); }, null], { max: 120, onTick: (G) => { if (y0 !== null) minY = Math.min(minY, G.players[0].y); } });
  const rise = y0 - minY;
  console.log(`        saut de tremplin : ${rise} px = ${(rise / TILE).toFixed(2)} cases`);
  assert(rise > 180 && rise < 215, 'hauteur ' + rise);
});
t('tremplin : le joueur du bas qui saute emporte celui du haut', () => {
  const def = makeDef(({ put }) => { put(8, 14, 'T'); put(2, 13, '1'); put(24, 13, '2'); doors(put); });
  let minTop = 1e9;
  run(def, [
    function* (c) { yield* c.walkToTile(8); yield* c.until(() => Math.abs(c.other.y + PH - c.me.y) < 0.01 && c.other.onGround, 400); yield* c.wait(8); yield* c.jump(); yield* c.wait(60); },
    function* (c) { yield* c.until(() => Math.abs(c.other.x - (8 * TILE + 4)) < 3 && c.other.onGround, 400); yield* c.wait(4); yield* c.mount(); yield* c.wait(300); },
  ], { max: 400, onTick: (G) => { minTop = Math.min(minTop, G.players[1].y); } });
  assert(minTop < 13 * TILE + 4 - 28 - 150, 'le haut est monté trop peu : ' + minTop);
});
t('tapis roulant : il entraîne un joueur immobile ; on peut le remonter à pied', () => {
  const def = makeDef(({ rect, put }) => { rect(8, 14, 8, 1, '>'); put(2, 13, '1'); put(24, 13, '2'); doors(put); }, { belt: { speed: 2 } });
  let xStill = null, xWalk = null;
  run(def, [function* (c) { yield* c.walkToTile(9); const x0 = c.me.x; yield* c.wait(30); xStill = c.me.x - x0; }, null], { max: 200 });
  run(def, [function* (c) { yield* c.walkToTile(14); const x0 = c.me.x; yield* c.hold(-1, 30); xWalk = c.me.x - x0; }, null], { max: 300 });
  assert(xStill > 50 && xStill < 70, 'dérive ' + xStill);
  assert(xWalk < -50 && xWalk > -70, 'remontée ' + xWalk);
});
t('dalle fragile : elle tombe delay ticks après qu’on s’y est posé, puis revient', () => {
  const def = makeDef(({ rect, put }) => { rect(8, 14, 3, 1, 'f'); put(2, 13, '1'); put(24, 13, '2'); doors(put); }, { frag: { delay: 20, restore: 100 } });
  let fell = 0, back = 0;
  run(def, [function* (c) { yield* c.walkToTile(9); yield* c.wait(200); }, null], { max: 260, onTick: (G, k) => { if (G.fragR[1] > 0 && !fell) fell = k; if (fell && G.fragR[1] === 0 && !back) back = k; } });
  assert(fell > 0 && back > fell + 90, `chute ${fell}, retour ${back}`);
});
t('plateforme traversante : on la traverse en sautant par en dessous, on s’y pose par au-dessus', () => {
  const def = makeDef(({ rect, put }) => { rect(6, 12, 6, 1, '='); put(2, 13, '1'); put(24, 13, '2'); doors(put); });
  let top = false;
  run(def, [function* (c) { yield* c.walkToTile(8); yield* c.hop(0, 30); yield* c.land(); yield* c.wait(10); }, null], { max: 120, onTick: (G) => { const p = G.players[0]; if (p.onGround && Math.abs(p.y + PH - 12 * TILE) < 0.01) top = true; } });
  assert(top, 'pas posé sur la plateforme');
});
t('portail : on ressort par l’autre, une seule fois ; il faut sortir pour le reprendre', () => {
  const def = makeDef(({ put }) => { put(5, 13, 'k'); put(20, 13, 'k'); put(2, 13, '1'); put(26, 13, '2'); doors(put); });
  let first = null, n1 = 0, n2 = 0;
  const r = run(def, [function* (c) { yield* c.hold(1, 20); first = c.me.x; yield* c.wait(30); n1 = c.G.events.length; yield* c.hold(1, 20); yield* c.hold(-1, 60); yield* c.wait(10); }, null], { max: 200 });
  const ports = r.log.filter((e) => e[1] === 'portal');
  assert(first > 18 * TILE && first < 23 * TILE, 'pas téléporté : ' + first);
  assert(ports.length === 2, 'téléportations : ' + ports.length);          // une à l'aller, une au retour, pas de rebond
});

t('une grille ne se referme jamais sur un joueur', () => {
  const def = makeDef(({ rect, put }) => { put(2, 13, '1'); put(26, 13, '2'); put(4, 13, 'a'); rect(6, 1, 1, 13, 'A'); doors(put); }, { latch: { 1: 30 } });
  let stuck = false;
  run(def, [function* (c) { yield* c.walkToTile(4); yield* c.wait(5); yield* c.walkToTile(6); yield* c.wait(100); }, null],
    { max: 150, onTick: (G) => { if (Sim.hitsWorld(G, G.players[0].x, G.players[0].y)) stuck = true; } });
  assert(!stuck);
});

t('les pics tuent ; on réapparaît au départ, puis au drapeau une fois validé par les DEUX joueurs', () => {
  const def = makeDef(({ put }) => { put(4, 13, '1'); put(2, 13, '2'); put(6, 13, 'F'); put(8, 13, '^'); doors(put); });
  const flagX = 6 * TILE + (TILE - PW) / 2;
  let respawnedAtFlag = false, firstRespawnAtSpawn = false;
  const r = run(def, [
    // joueur 0 : touche le drapeau, puis va mourir sur les pics
    function* (c) { yield* c.walkToTile(6); yield* c.wait(10); yield* c.walkToTile(9); yield* c.wait(200); },
    // joueur 1 : touche le drapeau (valide), puis va mourir à son tour
    function* (c) { yield* c.wait(70); yield* c.walkToTile(6); yield* c.wait(10); yield* c.walkToTile(9); yield* c.wait(200); },
  ], { max: 420, onTick: (G) => {
    G.events.forEach((e) => {
      if (e[0] === 'respawn') {
        const p = G.players[e[1]];
        if (G.cp < 0 && Math.abs(p.x - G.L.spawns[e[1]].x) < 40) firstRespawnAtSpawn = true;
        if (G.cp >= 0 && Math.abs(p.x - flagX) < 60) respawnedAtFlag = true;
      }
    });
  } });
  assert(r.deaths >= 2, 'morts : ' + r.deaths);
  assert(r.G.cp === 0, 'drapeau non validé');
  assert(firstRespawnAtSpawn, 'pas de retour au départ avant validation');
  assert(respawnedAtFlag, 'pas de retour au drapeau après validation');
});

t('retour volontaire : au départ avant tout drapeau, puis au drapeau validé ; instantané et sans mort', () => {
  const def = makeDef(({ put }) => { put(2, 13, '1'); put(4, 13, '2'); put(8, 13, 'F'); doors(put); });
  const flagX = 8 * TILE + (TILE - PW) / 2;
  const seen = { recalls: 0, atSpawn: false, atFlag: false, deadAfter: false };
  const r = run(def, [
    function* (c) {
      yield* c.walkToTile(6); yield* c.wait(4);
      yield* c.recall();                                       // avant validation : retour au départ
      yield* c.wait(3);
      seen.atSpawn = Math.abs(c.me.x - c.G.L.spawns[0].x) < 40;
      yield* c.walkToTile(8);                                  // touche le drapeau (l'autre l'a déjà touché : validé)
      yield* c.until(() => c.G.cp === 0, 400, '(drapeau)');
      yield* c.walkToTile(7); yield* c.wait(4);
      yield* c.recall();                                       // après validation : retour au drapeau
      seen.deadAfter = c.me.dead > 0;
      yield* c.wait(3);
      seen.atFlag = Math.abs(c.me.x - flagX) < 60 && Math.abs(c.me.x - c.G.players[1].x) >= 1;
      yield* c.wait(30);
    },
    function* (c) { yield* c.walkToTile(10); yield* c.wait(400); },
  ], { max: 500, onTick: (G) => { G.events.forEach((e) => { if (e[0] === 'recall') seen.recalls++; }); } });
  assert(!r.error, r.error && r.error.message);
  assert.strictEqual(seen.recalls, 2, 'recalls ' + seen.recalls);
  assert(seen.atSpawn, 'pas au départ');
  assert(seen.atFlag, 'pas au drapeau');
  assert(!seen.deadAfter, 'le retour ne doit pas passer par l’état mort');
  assert.strictEqual(r.G.deaths, 0, 'le retour volontaire ne compte pas comme une chute');
});

t('entraînement : point posé (C), retour à ce point après une chute (rapide, sans perdre le drapeau)', () => {
  const def = makeDef(({ put }) => { put(2, 13, '1'); put(4, 13, '2'); put(8, 13, 'F'); put(20, 13, 'F'); doors(put); });
  const G = Sim.create(def); G.practice = true;
  const idle = () => [{ l: 0, r: 0, j: 0, k: 0, c: 0 }, { l: 0, r: 0, j: 0, k: 0, c: 0 }];
  for (let k = 0; k < 20; k++) Sim.step(G, idle());
  assert(!G.custom, 'point posé sans demande');
  const inp = idle(); inp[0].c = 1; Sim.step(G, inp);
  for (let k = 0; k < 10; k++) Sim.step(G, idle());
  assert(G.custom && G.custom.length === 2, 'point non posé');
  const want = G.custom[0].x;
  // le joueur 0 marche puis tombe hors du niveau
  for (let k = 0; k < 30; k++) { const i = idle(); i[0].r = 1; Sim.step(G, i); }
  assert(G.players[0].x > want + 30, 'le joueur n’a pas bougé');
  G.players[0].y = G.L.h + 100;
  for (let k = 0; k < 60; k++) Sim.step(G, idle());
  assert(!G.players[0].dead && Math.abs(G.players[0].x - want) < 3, 'pas de retour au point posé (x=' + G.players[0].x + ' / ' + want + ')');
  assert.strictEqual(G.deaths, 1);
  // hors entraînement, « c » ne fait rien
  const H = Sim.create(def);
  const i2 = idle(); i2[0].c = 1; Sim.step(H, i2); for (let k = 0; k < 20; k++) Sim.step(H, idle());
  assert(!H.custom, 'le point de retour ne doit exister qu’en entraînement');
});

t('entraînement : repartir du début ou d’un drapeau (practiceGoto) efface le point et garde le compteur de chutes', () => {
  const def = makeDef(({ put }) => { put(2, 13, '1'); put(4, 13, '2'); put(8, 13, 'F'); put(20, 13, 'F'); doors(put); });
  const G = Sim.create(def); G.practice = true; G.deaths = 3; G.custom = [{ x: 100, y: 100 }, { x: 120, y: 100 }];
  const G2 = Sim.practiceGoto(G, 1) || G;
  assert(G2.practice === true && G2.custom === null, 'point non effacé');
  assert.strictEqual(G2.deaths, 3);
  assert.strictEqual(G2.cp, 1);
  const fx = 20 * TILE;
  G2.players.forEach((p) => assert(Math.abs(p.x - fx) < TILE * 1.2, 'joueur loin du drapeau : ' + p.x));
  const G3 = Sim.practiceGoto(G2, -1) || G2;
  assert.strictEqual(G3.cp, -1);
  assert(Math.abs(G3.players[0].x - G3.L.spawns[0].x) < 40, 'pas de retour au départ');
});

t('courant d’air : emporte vers le haut tant que la plaque est tenue par l’autre, et seulement alors', () => {
  const def = makeDef(({ rect, put }) => {
    put(2, 13, '2'); put(4, 13, '1'); put(8, 13, 'a'); rect(11, 4, 1, 10, 'P'); doors(put);
    // le courant est dans le groupe 1 : plaque a (groupe 1) → courant P (groupe 1)
  });
  let topY = 1e9, ridden = false;
  const r = run(def, [
    function* (c) { yield* c.walkToTile(8); yield* c.wait(200); },                       // tient la plaque
    function* (c) { yield* c.until(() => c.G.open[1], 600); yield* c.walkTo(8 * TILE - PW - 4); yield* c.hopTo(10 * TILE + 4, 90); yield* c.land(); yield* c.walkToTile(11); yield* c.wait(140); },
  ], { max: 260, onTick: (G) => { topY = Math.min(topY, G.players[1].y); if (G.players[1].y < 8 * TILE) ridden = true; } });
  assert(!r.error, r.error && r.error.message);
  assert(ridden, 'le courant n’a pas emporté le joueur (y min ' + topY + ')');
  // sans plaque tenue, rien
  const G = Sim.create(def);
  for (let k = 0; k < 120; k++) Sim.step(G, [{ l: 0, r: 0, j: 0 }, { l: 0, r: 0, j: 0 }]);
  assert(G.players[1].y > 10 * TILE, 'le courant fonctionne sans plaque');
});

t('interrupteur : chaque pression bascule le groupe (une seule fois tant qu’on reste dessus) et la grille suit', () => {
  const def = makeDef(({ rect, put }) => { put(2, 13, '2'); put(4, 13, '1'); put(10, 13, 'x'); rect(16, 8, 1, 6, 'A'); doors(put); });
  const G = Sim.create(def);
  const idle = () => [{ l: 0, r: 0, j: 0 }, { l: 0, r: 0, j: 0 }];
  const walk = (n, dir) => { for (let k = 0; k < n; k++) { const i = idle(); if (dir > 0) i[0].r = 1; else i[0].l = 1; Sim.step(G, i); } };
  for (let k = 0; k < 10; k++) Sim.step(G, idle());
  assert.strictEqual(G.open[1], 0);
  walk(46, 1);                                         // on arrive sur l’interrupteur (case 10)
  for (let k = 0; k < 20; k++) Sim.step(G, idle());   // on reste dessus : pas de re-bascule
  assert.strictEqual(G.open[1], 1, 'grille non ouverte');
  assert.strictEqual(G.dyn[8 * G.L.cols + 16], 0, 'la grille est restée fermée');
  walk(16, 1); walk(16, -1);                           // on repart et on repasse dessus
  for (let k = 0; k < 10; k++) Sim.step(G, idle());
  assert.strictEqual(G.open[1], 0, 'seconde pression sans effet');
  const m = Sim.pack(G), H = Sim.create(def); Sim.unpack(H, m);
  assert.deepStrictEqual(H.tog, G.tog, 'état des interrupteurs non transmis');
  assert.throws(() => Sim.parseLevel(makeDef(({ put }) => { put(2, 13, '1'); put(4, 13, '2'); put(8, 13, 'x'); put(9, 13, 'a'); doors(put); })), /mélange/);
});

t('pics rythmés : mortels seulement quand ils sont sortis, et cadencés par cfg.rspike', () => {
  const def = makeDef(({ put }) => { put(2, 13, '2'); put(4, 13, '1'); put(9, 13, 'e'); put(10, 13, 'E'); doors(put); }, { rspike: { period: 100, on: 46 } });
  const G = Sim.create(def);
  const L = G.L, A = L.rspikes[0], B = L.rspikes[1];
  let aOn = 0, bOn = 0, both = 0;
  for (let k = 0; k < 400; k++) { const a = Sim.spikeState(L, A, k) === 1, b = Sim.spikeState(L, B, k) === 1; if (a) aOn++; if (b) bOn++; if (a && b) both++; }
  assert(aOn === 184 && bOn === 184 && both === 0, `cadence : ${aOn}/${bOn}/${both}`);
  // un joueur posé sur la case e meurt quand les pointes sortent, et pas avant
  let diedAt = -1;
  const r = run(def, [function* (c) { yield* c.walkTo(9 * TILE + 4, 1); yield* c.wait(160); }, null], { max: 200, onTick: (G2) => { G2.events.forEach((e) => { if (e[0] === 'death' && diedAt < 0) diedAt = G2.t; }); } });
  assert(diedAt > 0, 'jamais mort sur la case e');
  assert(r.G.deaths >= 1);
});

console.log(`\n${passed} tests passés`);
