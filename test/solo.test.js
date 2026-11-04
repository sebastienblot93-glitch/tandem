// Garde-fous « coop obligatoire » : seul, on ne franchit pas les murs, on n'atteint pas les cloches hautes,
// et un joueur qui erre au hasard ne finit jamais un niveau. (Ce n'est pas une preuve : ce sont des tests de non-régression.)
const assert = require('assert');
const { run, Sim, TILE, PH } = require('./harness');
const { LEVELS } = require('../public/shared/levels.js');
const SOL = require('./solutions');
let n = 0;
const t = (name, fn) => { try { fn(); n++; console.log('  ok  ' + name); } catch (e) { console.log('  ÉCHEC ' + name + '\n        ' + e.message); process.exitCode = 1; } };

// Rangée du premier sol plein sous (tx, ty)
function floorRow(idx, tx, ty) {
  const rows = LEVELS[idx].rows;
  for (let y = ty; y < rows.length; y++) { if (rows[y][tx] === '#') return y; if (rows[y][tx] === '^') return -1; }
  return -1;
}
// Le joueur 0, seul et téléporté en (tx) sur le sol, saute sans arrêt (avec un pas vers la droite si dir≠0).
// Retourne { maxX, minY, rang }
function spam(idx, tx, ty, dir, ticks = 1500) {
  const fr = floorRow(idx, tx, ty);
  assert(fr > 0, `pas de sol sous (${tx},${ty}) niveau ${idx + 1}`);
  const out = { maxX: 0, minY: 1e9, rang: false };
  run(LEVELS[idx], [function* (c) {
    for (;;) { yield* c.hop(dir, 14); yield* c.wait(2); }
  }, null], {
    max: ticks,
    onTick: (G, k) => {
      const p = G.players[0];
      if (k === 0) { p.x = tx * TILE + 4; p.y = fr * TILE - PH - 1; G.players[1].x = 2 * TILE; }
      out.maxX = Math.max(out.maxX, p.x); out.minY = Math.min(out.minY, p.y);
      G.events.forEach((e) => { if (e[0] === 'bell') out.rang = true; });
    },
  });
  return out;
}

// 1. Les murs : seul, on reste du bon côté, même en sautant sans arrêt contre eux
t('niveau 1 : seul, le mur de 3 cases est infranchissable', () => { const r = spam(0, 8, 8, 1); assert(r.maxX < 12 * TILE, `x=${r.maxX}`); });
t('niveau 1 : seul, le mur de 4 cases est infranchissable', () => { const r = spam(0, 26, 8, 1); assert(r.maxX < 30 * TILE, `x=${r.maxX}`); });
t('niveau 11 : seul, le mur de 6 cases est infranchissable', () => { const r = spam(10, 30, 8, 1); assert(r.maxX < 36 * TILE, `x=${r.maxX}`); });

// 2. Les cloches hautes : un seul joueur, debout sur le sol, ne les atteint pas
[[3, 5, 7], [3, 41, 6], [4, 9, 7], [4, 36, 6], [9, 34, 8], [10, 68, 12]].forEach(([idx, tx, ty]) => {
  t(`niveau ${idx + 1} : seul, on ne sonne pas la cloche (${tx},${ty})`, () => { const r = spam(idx, tx, ty, 0, 400); assert(!r.rang); });
});

// 2b. Niveau 18 : seul sur le ressort, on ne sonne pas la cloche à 9 cases (il faut le saut en chaîne)
t('niveau 18 : seul, même depuis le ressort, on ne sonne pas la cloche', () => {
  let rang = false;
  let jumped = 0;
  run(LEVELS[17], [function* (c) { for (;;) { yield* c.hop(0, 14); yield* c.wait(30); } }, null], {
    max: 900, onTick: (G, k) => {
      const p = G.players[0];
      if (k === 0) { p.x = 37 * TILE + 4; p.y = 12 * TILE - PH - 1; G.players[1].x = 2 * TILE; }
      G.events.forEach((e) => { if (e[0] === 'bell') rang = true; if (e[0] === 'jump' && e[2] === 1) jumped++; });
    },
  });
  assert(jumped > 3, 'le bot doit bien sauter depuis le ressort');
  assert(!rang);
});

// 2c. Pas de raccourci par le sol : sous les chemins suspendus des niveaux 19 et 20, il n'y a que le vide
[[18, 28, 50, 6], [19, 100, 138, 6]].forEach(([idx, x0, x1, row]) => {
  t(`niveau ${idx + 1} : personne ne marche sous le chemin suspendu (cases ${x0}-${x1})`, () => {
    let under = 0;
    run(LEVELS[idx], SOL[idx], { onTick: (G) => G.players.forEach((p) => { const tx = (p.x + 12) / TILE; if (!p.dead && tx > x0 + 1 && tx < x1 && p.y > (row + 1) * TILE) under++; }) });
    assert.strictEqual(under, 0);
  });
});

// 2d. Niveaux 21 à 30 : murs, grilles et cloches hautes restent infranchissables seul
[[21, 86, 90, 'mur 1 (Lune)'], [21, 102, 106, 'mur 2 (Lune)'], [22, 58, 62, 'mur à tunnel (Plomb)'], [23, 20, 24, 'mur de 7 cases (Serrures)']].forEach(([idx, tx, wallTx, label]) => {
  t(`niveau ${idx + 1} : seul, on ne passe pas le ${label}`, () => { const r = spam(idx, tx, 6, 1); assert(r.maxX < wallTx * TILE, `x=${r.maxX}`); });
});
[[22, 121, 11], [24, 30, 9], [24, 62, 9], [24, 182, 9]].forEach(([idx, tx, ty]) => {
  t(`niveau ${idx + 1} : seul, on ne sonne pas la cloche haute (${tx},${ty})`, () => { const r = spam(idx, tx, ty, 0, 500); assert(!r.rang); });
});
// Niveaux 21, 28, 29, 30 : ascenseur, barque, canons — seul, on ne passe pas
t('niveau 21 : seul, on ne monte jamais par l’ascenseur (plaque puis course vers lui)', () => {
  let minY = 1e9;
  run(LEVELS[20], [function* (c) {
    for (let k = 0; k < 6; k++) {
      yield* c.walkToTile(7); yield* c.wait(40);                    // plaque
      yield* c.walkToTile(9); yield* c.hop(1, 20); yield* c.wait(10);
      yield* c.walkToTile(5);
    }
  }, null], { max: 2400, onTick: (G) => { minY = Math.min(minY, G.players[0].y); } });
  assert(minY > 9 * TILE, `y=${minY}`);
});
t('niveau 21 : seul, on ne traverse pas les pics (la barque ne part pas avec soi)', () => {
  let maxX = 0;
  run(LEVELS[20], [function* (c) {
    for (;;) { yield* c.walkToTile(22); yield* c.wait(20); yield* c.hop(1, 30); yield* c.wait(30); yield* c.walkToTile(21); }
  }, null], { max: 2400, onTick: (G, k) => { const p = G.players[0]; if (k === 0) { p.x = 20 * TILE; p.y = 7 * TILE - PH - 1; G.players[1].x = 2 * TILE; } maxX = Math.max(maxX, p.x); } });
  assert(maxX < 41 * TILE, `x=${maxX}`);
});
t('niveau 28 : seul, on ne franchit pas la fosse de 7 cases (canon éteint)', () => { const r = spam(27, 6, 14, 1, 1200); assert(r.maxX < 17 * TILE, `x=${r.maxX}`); });
t('niveau 28 : seul, on ne monte pas sur la corniche', () => { const r = spam(27, 22, 14, 1, 1500); assert(r.minY > 12 * TILE, `y=${r.minY}`); });
t('niveau 29 : seul, en haut ou en bas, on ne traverse pas', () => {
  const a = spam(28, 10, 10, 1, 1200); assert(a.maxX < 45 * TILE, `x=${a.maxX}`);
  const b = spam(28, 10, 20, 1, 1200); assert(b.maxX < 45 * TILE, `x=${b.maxX}`);
});
t('niveau 30 : seul, on ne franchit pas la fosse du canon', () => { const r = spam(29, 87, 12, 1, 1200); assert(r.maxX < 97 * TILE, `x=${r.maxX}`); });
// Serrures : seul, on ne bascule jamais l'interrupteur en haut de la plate-forme (60,7), et le mur du niveau « Portails » ne se passe pas
t('niveau 24 : seul, on n’atteint pas l’interrupteur de la plate-forme', () => {
  const r = spam(23, 55, 6, 1, 1500); assert(r.minY > 5 * TILE, `y=${r.minY}`);
});

// 3. Errance aléatoire, seul : on ne gagne jamais
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
LEVELS.forEach((def, idx) => {
  t(`niveau ${idx + 1} : un joueur qui erre seul ne gagne pas`, () => {
    for (const seed of [1, 2, 3]) {
      const rnd = lcg(seed * 7919 + idx);
      let won = false;
      const G = Sim.create(def);
      let dir = 0, hold = 0;
      for (let k = 0; k < 4000 && !won; k++) {
        if (hold-- <= 0) { dir = Math.floor(rnd() * 3) - 1; hold = 10 + Math.floor(rnd() * 50); }
        Sim.step(G, [{ l: dir < 0 ? 1 : 0, r: dir > 0 ? 1 : 0, j: rnd() < 0.05 ? 1 : 0 }, { l: 0, r: 0, j: 0 }]);
        won = !!G.won;
      }
      assert(!won);
    }
  });
});

// 4. Chaque bot de solution, laissé seul (partenaire immobile au départ), ne termine jamais un niveau
LEVELS.forEach((def, idx) => {
  if (!SOL[idx]) return;
  [0, 1].forEach((who) => {
    t(`niveau ${idx + 1} : le script du joueur ${who + 1} ne gagne pas sans partenaire`, () => {
      const scripts = [null, null]; scripts[who] = SOL[idx][who];
      const r = run(def, scripts, { max: 3500 });
      assert(!r.won);
    });
  });
});
console.log(`\n${n} garde-fous passés`);
