// Solutions scriptées : chaque niveau doit pouvoir être terminé par deux « bots » dans le vrai moteur.
// Les bots ne trichent pas : ils n'ont que gauche / droite / saut, comme les joueurs.
const { TILE, PW, PH } = require('./harness');

const S = {};
const px = (tx) => tx * TILE + 4;                               // x (bord gauche) pour être centré sur la case tx

// Coup de tête dans une cloche : on saute sur place et on attend que la tête ait touché (sinon on dérive hors de la cloche)
function* ring(c) { yield* c.jump(); yield* c.wait(14); }
// Franchit une fosse ou un champ de pics : décollage juste avant le bord (tx = 1re case dangereuse, w = largeur), on retombe après
function* leap(c, tx, w, pitOnly) { yield* c.walkTo(tx * TILE - (pitOnly ? PW : 30), 2); yield* c.hopTo((tx + w) * TILE + (pitOnly ? 4 : 2), 90); yield* c.land(); }
// Le joueur du bas se colle au pied d'un mur dont la face gauche est en `wallTx`
function* standAt(c, wallTx) { yield* c.walkTo(wallTx * TILE - PW, 1); yield* c.until(() => c.me.onGround, 60); }
// Le joueur du haut monte sur la tête du partenaire (déjà collé au mur)
function* mountAt(c, wallTx) {
  yield* c.until(() => Math.abs(c.other.x - (wallTx * TILE - PW)) < 2 && c.other.onGround, 900, '(bas en place)');
  yield* c.wait(6);
  yield* c.mount();
  yield* c.wait(6);
}

/* 1. Courte-échelle ------------------------------------------------------- */
S[0] = [
  function* (c) { // joueur 0 (devant) : en bas au 1er mur, en haut au 2e
    yield* standAt(c, 12);
    yield* c.until(() => c.G.open[1], 1500, '(grille A)');
    yield* c.walkToTile(16);
    yield* leap(c, 19, 3);                                   // fosse
    yield* c.walkToTile(25);
    // 2e mur (4 cases) : on reste en bas, collé au mur
    yield* standAt(c, 30);
    yield* c.until(() => Math.abs(c.other.y + PH - c.me.y) < 0.01 && c.other.onGround, 1500, '(haut monté)');
    yield* c.wait(8);
    yield* c.jump();                                         // le bas saute, le haut le suit
    yield* c.wait(50);
    yield* c.until(() => c.G.open[2], 900, '(grille B)');
    yield* c.walkToTile(39);
    yield* c.walkToTile(41);
    yield* c.wait(200);
  },
  function* (c) { // joueur 1 (derrière) : en haut au 1er mur, en bas au 2e
    yield* mountAt(c, 12);
    yield* c.hop(1, 26);
    yield* c.land();
    yield* c.walkTo(12 * TILE + 4);                          // plaque a
    yield* c.until(() => c.other.x > 14 * TILE + 8, 900, '(bas passé la grille A)');
    yield* c.wait(10);
    yield* c.walkToTile(15); yield* c.hold(1, 10); yield* c.land();
    yield* leap(c, 19, 3);
    // 2e mur (4 cases) : on est le joueur du haut
    yield* mountAt(c, 30);
    yield* c.until(() => c.other.vy < 0, 300, '(décollage du bas)');
    yield* c.wait(8);
    yield* c.hop(1, 16);
    yield* c.land();
    yield* c.walkTo(30 * TILE + 4);                          // plaque b
    yield* c.until(() => c.other.x > 32 * TILE, 900, '(bas passé la grille B)');
    yield* c.wait(8);
    yield* c.walkToTile(33); yield* c.hold(1, 10); yield* c.land();
    yield* c.walkToTile(39);
    yield* c.wait(200);
  },
];

/* 2. Verrous croisés ------------------------------------------------------ */
S[1] = [
  function* (c) { // joueur 0 : couloir du haut
    yield* c.walkToTile(5);                    // plaque a : ouvre la grille du bas
    yield* c.until(() => c.G.open[2], 900, '(grille B)');
    yield* c.wait(4);
    yield* c.walkToTile(8);                    // devant la grille B
    yield* c.walkToTile(11);
    yield* leap(c, 12, 3);                     // pics 12..14
    yield* c.walkToTile(16);
    yield* c.until(() => c.G.open[3], 1500, '(grille C)');
    yield* c.walkToTile(19);
    yield* leap(c, 21, 3);                     // pics 21..23
    yield* c.walkToTile(28);
    yield* leap(c, 31, 3);                     // pics 31..33
    yield* c.walkToTile(37);
    yield* c.wait(300);
  },
  function* (c) { // joueur 1 : couloir du bas
    yield* c.walkToTile(5);                    // plaque b
    yield* c.until(() => c.G.open[1], 900, '(grille A)');
    yield* c.wait(4);
    yield* c.walkToTile(11);
    yield* leap(c, 13, 3);                     // pics 13..15
    yield* c.walkToTile(17);                   // plaque c : on la tient
    yield* c.until(() => c.other.x > 27 * TILE + 8, 1500, '(haut passé la grille C)');
    yield* c.wait(4);
    yield* c.walkToTile(19);
    yield* leap(c, 21, 3);                     // pics 21..23
    yield* c.walkToTile(26);
    yield* leap(c, 29, 3);                     // pics 29..31
    yield* c.walkToTile(37);
    yield* c.wait(300);
  },
];

/* 3. Marches fantômes ----------------------------------------------------- */
const STEPS1 = [6, 10, 14, 18, 22];               // x gauche des marches X (2 cases chacune)
const STEPS2 = [22, 18, 14, 10, 6];               // marches Y, de la corniche vers la tour
S[2] = [
  function* (c) { // joueur 0 : grimpe
    yield* c.until(() => c.G.open[1], 600, '(escalier 1)');
    for (const tx of STEPS1) { yield* c.hopTo(tx * TILE + 20); yield* c.wait(2); }
    yield* c.hopTo(27 * TILE + 4);               // corniche
    yield* c.walkToTile(27);                     // plaque c : ouvre la grille C
    yield* c.until(() => c.other.x > 29 * TILE, 1800, '(l’autre est passé)');
    yield* c.until(() => c.G.open[2], 1800, '(escalier 2)');
    yield* c.walkTo(26 * TILE);
    for (const tx of STEPS2) { yield* c.hopTo(tx * TILE + 20, 120); yield* c.wait(2); }
    yield* c.hopTo(3 * TILE + 4, 120);           // tour
    yield* c.walkToTile(2);
    yield* c.wait(300);
  },
  function* (c) { // joueur 1 : tient les plaques
    yield* c.walkToTile(3);                      // plaque a
    yield* c.until(() => c.other.onGround && c.other.x > 26 * TILE && c.other.y < 14 * TILE, 1800, '(l’autre est sur la corniche)');
    yield* c.wait(10);
    yield* c.walkToTile(11);
    yield* leap(c, 12, 2);
    yield* c.walkToTile(15);
    yield* leap(c, 17, 2);
    yield* c.walkToTile(20);
    yield* leap(c, 22, 2);
    yield* c.until(() => c.G.open[3], 1800, '(grille C)');
    yield* c.walkToTile(31);                     // porte + plaque b
    yield* c.wait(1500);
  },
];


/* Aides communes : montées d'escaliers et sauts en chaîne ------------------- */
// Attend que le haut soit retombé sur notre tête (sinon, en marchant, on le laisse derrière nous)
function* backOn(c) { yield* c.until(() => Math.abs(c.other.y + PH - c.me.y) < 0.01 && c.other.onGround, 120, '(le haut retombe)'); yield* c.wait(3); }
// steps : [[tx gauche, rangée de la dalle], ...] puis la plate-forme d'arrivée [tx d'atterrissage, rangée] ; dir = +1 vers la droite, -1 vers la gauche
// lead : celui qui monte en tête ; l'autre part quand le premier est déjà sur la marche suivante (sinon ils se gênent)
function* climb(c, steps, dest, dir, lead, originX) {
  const all = steps.concat([dest]);
  for (let k = 0; k < all.length; k++) {
    const [tx, row] = all[k];
    if (!lead) {
      yield* c.until(() => c.other.onGround && c.other.y + PH <= all[k][1] * TILE + 0.6, 600, `(le premier monte, marche ${k})`);
    }
    if (k === 0 && originX !== undefined) yield* c.walkTo(originX, 2);
    if (k > 0) yield* c.walkTo(dir > 0 ? all[k - 1][0] * TILE + 2 * TILE - PW : all[k - 1][0] * TILE, 2);   // on décolle du bord de la marche
    const off = k === all.length - 1 ? (dir > 0 ? 4 : 28) : (lead ? (dir > 0 ? 36 : 4) : (dir > 0 ? 4 : 36));
    yield* c.hopTo(tx * TILE + off, 120);
    yield* c.wait(2);
  }
}
// Saut en chaîne sur place : le bas saute, le haut saute `wait` ticks après le décollage (pour taper dans une cloche au-dessus)
function* chainLow(c, settle = 8) {
  yield* c.until(() => Math.abs(c.other.y + PH - c.me.y) < 0.01 && c.other.onGround, 900, '(haut monté)');
  yield* c.wait(settle);
  yield* c.jump();
}
function* chainTopRing(c, wait) {
  yield* c.mount();
  yield* c.wait(8);
  yield* c.until(() => c.other.vy < 0, 300, '(décollage du bas)');
  yield* c.wait(wait);
  yield* c.jump();
}

/* 4. Première cloche ------------------------------------------------------ */
const W4 = Number(process.env.W4 || 10);                                    // délai du haut dans le saut en chaîne (cloche à 5 cases)
S[3] = [
  function* (c) { // joueur 0 (devant : sous la cloche u, puis il traverse en premier)
    yield* c.until(() => Math.abs(c.other.y + PH - c.me.y) < 0.01 && c.other.onGround, 900, '(haut monté)');
    yield* c.wait(14);                                       // l'autre frappe
    yield* c.until(() => c.G.bridge[1] > 0, 300, '(pont 1)');
    yield* c.walkTo(27 * TILE + 4);                          // au bord du gouffre 2, prêt à courir
    yield* c.until(() => c.G.bridge[2] > 0, 1500, '(pont 2)');
    yield* c.walkToTile(38);
    yield* ring(c);                                          // cloche de la rive droite : l'autre peut traverser
    // saut en chaîne sous la cloche (41,6) : on est le bas
    yield* c.walkTo(41 * TILE + 4);
    yield* chainLow(c, 6);
    yield* c.until(() => c.G.bridge[3] > 0, 120, '(pont 3)');
    yield* c.walkToTile(55);
    yield* c.walkToTile(59);
    yield* c.wait(300);
  },
  function* (c) { // joueur 1 (derrière : frappe la cloche u, puis la cloche de gauche du 2e gouffre)
    yield* c.walkTo(5 * TILE - PW);                          // colle au joueur 0, qui est sous la cloche
    yield* c.wait(4);
    yield* c.mount();
    yield* c.wait(8);
    yield* c.jump();                                         // coup de tête : pont 1
    yield* c.until(() => c.G.bridge[1] > 0, 60, '(pont 1)');
    yield* c.land();
    yield* c.walkToTile(21);
    yield* c.until(() => c.other.x >= 27 * TILE && c.other.onGround, 1500, '(l’autre au bord)');
    yield* c.wait(4);
    yield* ring(c);
    yield* c.walkToTile(25);
    yield* c.until(() => c.other.x > 36 * TILE, 900, '(l’autre a traversé)');
    yield* c.walkTo(27 * TILE + 4);                          // on prend sa place au bord
    yield* c.until(() => c.other.x > 37 * TILE && c.G.bridge[2] > 90, 900, '(2e coup de cloche)');
    yield* c.walkToTile(39);
    // saut en chaîne : on est le haut
    yield* c.until(() => Math.abs(c.other.x - (41 * TILE + 4)) < 3 && c.other.onGround, 900, '(bas en place)');
    yield* c.wait(6);
    yield* chainTopRing(c, W4);
    yield* c.until(() => c.G.bridge[3] > 0, 60, '(pont 3)');
    yield* c.land();
    yield* c.walkToTile(55);
    yield* c.walkToTile(57);
    yield* c.wait(300);
  },
];

/* 5. Les sas ------------------------------------------------------------- */
// joueur 0 (devant) = le bas à chaque cloche ; joueur 1 = le haut, qui frappe puis se laisse porter
const W5 = Number(process.env.W5 || 10);
S[4] = [
  function* (c) {
    yield* c.walkTo(9 * TILE + 4);                           // sous la cloche u (9,7)
    yield* c.until(() => Math.abs(c.other.y + PH - c.me.y) < 0.01 && c.other.onGround, 900, '(haut monté)');
    yield* c.wait(14);
    yield* c.until(() => c.G.bridge[1] > 0, 120, '(mur 1 ouvert)');
    yield* backOn(c);
    yield* c.walkToTile(21);                                 // sous la cloche v
    yield* c.wait(20);
    yield* c.until(() => c.G.bridge[2] > 0, 120, '(pont 2)');
    yield* backOn(c);
    yield* c.walkToTile(33);
    yield* c.walkTo(36 * TILE + 4);                          // sous la cloche w (chaîne)
    yield* chainLow(c, 6);
    yield* c.until(() => c.G.bridge[3] > 0, 120, '(mur 3 ouvert)');
    yield* c.walkToTile(46);
    yield* c.walkToTile(50);
    yield* c.wait(300);
  },
  function* (c) {
    yield* c.walkTo(9 * TILE - PW);
    yield* c.until(() => Math.abs(c.other.x - (9 * TILE + 4)) < 3 && c.other.onGround, 900, '(bas en place)');
    yield* c.wait(4);
    yield* c.mount();
    yield* c.wait(8);
    yield* c.jump();                                         // coup de tête dans u : mur 1
    yield* c.until(() => Math.abs(c.other.x - (21 * TILE + 4)) < 3 && c.other.onGround && c.me.onGround, 900, '(sous v)');
    yield* c.wait(8);
    yield* c.jump();                                         // coup de tête dans v : pont 2
    yield* c.until(() => Math.abs(c.other.x - (36 * TILE + 4)) < 3 && c.other.onGround && c.me.onGround, 900, '(sous w)');
    yield* c.wait(8);
    yield* c.until(() => c.other.vy < 0, 300, '(décollage du bas)');
    yield* c.wait(W5);
    yield* c.jump();                                         // saut en chaîne dans w : mur 3
    yield* c.until(() => c.G.bridge[3] > 0, 60, '(mur 3 ouvert)');
    yield* c.land();
    yield* c.walkToTile(46);
    yield* c.walkToTile(48);
    yield* c.wait(300);
  },
];

/* 6. Le clocher ---------------------------------------------------------- */
const ST1 = [[7, 25], [11, 23]], P1 = [15, 21];
const ST2 = [[11, 19], [7, 17]], P2 = [3, 15];
const ST3 = [[7, 13], [11, 11]], P3 = [15, 9];
const W6 = Number(process.env.W6 || 14);                                    // délai du haut dans le saut en chaîne depuis le tremplin
// 3e cloche : le plus à gauche (sur le tremplin) est le bas, l'autre le haut ; puis on grimpe l'escalier 3
function* stage3(c) {
  yield* c.until(() => c.me.onGround && c.other.onGround && c.me.y + PH <= 15 * TILE + 0.6 && c.other.y + PH <= 15 * TILE + 0.6, 900, '(sur la plate-forme 2)');
  yield* c.wait(12);
  if (c.me.x < c.other.x) {                                  // bas
    yield* c.walkTo(2 * TILE + 4);
    yield* chainLow(c, 6);
    yield* c.until(() => c.G.bridge[3] > 0, 120, '(escalier 3)');
    yield* stage3Climb(c);
  } else {                                                   // haut
    yield* c.until(() => Math.abs(c.other.x - (2 * TILE + 4)) < 3 && c.other.onGround, 900, '(bas sur le tremplin)');
    yield* c.wait(6);
    yield* c.mount();
    yield* c.wait(8);
    yield* c.until(() => c.other.vy < 0, 300, '(décollage du bas)');
    yield* c.wait(W6);
    yield* c.jump();                                         // coup de tête dans la cloche w (2,6)
    yield* c.until(() => c.G.bridge[3] > 0, 120, '(escalier 3)');
    yield* stage3Climb(c);
  }
  yield* c.wait(300);
}
// Après le coup de cloche, ils se retrouvent côte à côte : celui qui est le plus à droite monte en tête
function* stage3Climb(c) {
  yield* c.until(() => c.me.onGround && c.other.onGround && c.me.y + PH <= 15 * TILE + 0.6 && c.other.y + PH <= 15 * TILE + 0.6, 200, '(retombés)');
  const lead = c.me.x > c.other.x;
  if (lead) yield* c.walkTo(4 * TILE + 8); else yield* c.wait(1);
  yield* climb(c, ST3, P3, 1, lead, 4 * TILE + 8);
  yield* c.walkToTile(lead ? 25 : 20);
}
S[5] = [
  function* (c) { // joueur 0 : haut (1re cloche), bas (2e), haut (3e)
    yield* c.walkTo(3 * TILE + 4 + PW);                      // se colle à droite du joueur 1, sous la cloche (3,22)
    yield* c.wait(4);
    yield* c.mount();
    yield* c.wait(8);
    yield* c.jump();                                         // coup de tête : escalier 1
    yield* c.until(() => c.G.bridge[1] > 0, 60, '(escalier 1)');
    yield* c.land();
    yield* climb(c, ST1, P1, 1, true);
    // plate-forme 1 : on est le bas sous la cloche v (22,14)
    yield* c.walkTo(22 * TILE + 4);
    yield* chainLow(c, 6);
    yield* c.until(() => c.G.bridge[2] > 0, 120, '(escalier 2)');
    yield* c.walkTo(15 * TILE);
    yield* climb(c, ST2, P2, -1, true, 15 * TILE);
    yield* stage3(c);
  },
  function* (c) { // joueur 1 : bas (1re cloche), haut (2e), bas (3e)
    yield* c.until(() => Math.abs(c.other.y + PH - c.me.y) < 0.01 && c.other.onGround, 900, '(haut monté)');
    yield* c.until(() => c.G.bridge[1] > 0, 120, '(escalier 1)');
    yield* c.wait(10);
    yield* climb(c, ST1, P1, 1, false);
    // plate-forme 1 : on est le haut
    yield* c.until(() => Math.abs(c.other.x - (22 * TILE + 4)) < 3 && c.other.onGround, 900, '(bas sous la cloche)');
    yield* c.wait(6);
    yield* chainTopRing(c, W4);
    yield* c.until(() => c.G.bridge[2] > 0, 60, '(escalier 2)');
    yield* c.land();
    yield* c.walkTo(17 * TILE);
    yield* climb(c, ST2, P2, -1, false, 15 * TILE);
    yield* stage3(c);
  },
];

/* 7. Tremplin ------------------------------------------------------------ */
const W7 = Number(process.env.W7 || 18);                                    // délai du haut dans le saut en chaîne depuis le tremplin
S[6] = [
  function* (c) { // joueur 0 : monte sur le mur par le tremplin, tient la plaque ; bas du saut en chaîne
    yield* c.walkTo(8 * TILE + 4);
    yield* c.hopTo(11 * TILE + 4, 120);                      // tremplin → sommet du mur
    yield* c.walkTo(11 * TILE + 4);                          // plaque a
    yield* c.until(() => c.other.x > 13 * TILE + 8, 900, '(l’autre est passé la grille)');
    yield* c.wait(6);
    yield* c.hop(1, 20); yield* c.land();
    yield* c.walkTo(17 * TILE);
    // gouffre de 6 cases : tremplin au bord
    yield* c.walkTo(22 * TILE + 8, 2);
    yield* c.hopTo(29 * TILE + 8, 120); yield* c.land();
    // tremplin de la grande corniche : on est le bas
    yield* c.walkTo(33 * TILE + 4);
    yield* chainLow(c, 8);
    yield* c.until(() => c.G.open[2], 900, '(grille B)');
    yield* c.walkToTile(43);
    yield* c.wait(300);
  },
  function* (c) { // joueur 1
    yield* c.until(() => c.G.open[1], 900, '(grille A)');
    yield* c.walkToTile(14);
    yield* c.until(() => c.other.x > 23 * TILE, 900, '(l’autre a sauté le gouffre)');
    yield* c.walkTo(22 * TILE + 8, 2);
    yield* c.hopTo(29 * TILE + 8, 120); yield* c.land();
    yield* c.walkToTile(31);
    // saut en chaîne : on est le haut
    yield* c.until(() => Math.abs(c.other.x - (33 * TILE + 4)) < 3 && c.other.onGround, 900, '(bas sur le tremplin)');
    yield* c.wait(6);
    yield* c.mount();
    yield* c.wait(8);
    yield* c.until(() => c.other.vy < -5, 300, '(décollage du bas)');
    yield* c.wait(W7);
    yield* c.hop(1, 46);
    yield* c.land();
    yield* c.walkTo(36 * TILE + 4);                          // plaque b
    yield* c.until(() => c.other.x > 41 * TILE, 900, '(bas passé la grille)');
    yield* c.walkToTile(42);
    yield* c.wait(300);
  },
];

/* 8. Pont de verre ------------------------------------------------------- */
// Franchit un trou de w cases dont la 1re case est tx (on décolle du bord de la dalle précédente)
function* hole(c, tx, w) { yield* c.walkTo(tx * TILE - PW, 2); yield* c.hopTo((tx + w) * TILE + 4, 90); yield* c.land(); }
function* bridge8(c) {
  yield* c.walkTo(15 * TILE);
  yield* hole(c, 19, 2);
  yield* c.walkTo(23 * TILE);
  yield* hole(c, 25, 1);
  yield* c.walkTo(27 * TILE);
  yield* hole(c, 29, 2);
  yield* c.walkToTile(34);
}
S[7] = [
  function* (c) { // joueur 0 : traverse en premier, tient la plaque
    yield* bridge8(c);
    yield* c.walkTo(36 * TILE + 4);                          // plaque a
    yield* c.until(() => c.other.x > 12 * TILE, 900, '(l’autre est passé le mur)');
    yield* c.wait(30);
    yield* c.walkToTile(39);
    yield* c.until(() => c.other.x > 34 * TILE, 900, '(l’autre a traversé)');
    yield* c.wait(10);
    yield* leap(c, 41, 4, true);
    yield* c.walkToTile(46);
    yield* leap(c, 47, 4, true);
    yield* c.walkToTile(54);
    yield* c.wait(300);
  },
  function* (c) { // joueur 1 : attend la grille, traverse à son tour
    yield* c.until(() => c.G.open[1], 1500, '(grille A)');
    yield* c.walkToTile(12);
    yield* bridge8(c);
    yield* c.walkToTile(40);
    yield* leap(c, 41, 4, true);
    yield* c.walkToTile(46);
    yield* leap(c, 47, 4, true);
    yield* c.walkToTile(52);
    yield* c.wait(300);
  },
];

/* 9. Chambre forte ------------------------------------------------------- */
S[8] = [
  function* (c) { // joueur 0 : le bas du pilier, puis seul vers le coffre n°2
    yield* c.walkToTile(9);
    yield* leap(c, 10, 4, true);
    yield* c.walkTo(19 * TILE - PW, 2);                       // collé au pilier 1
    yield* chainLow(c, 8);
    yield* c.until(() => c.G.open[1], 900, '(grille A)');
    yield* c.walkToTile(26);
    yield* c.walkTo(27 * TILE + 4);                          // sur le tremplin
    yield* c.wait(4);
    yield* c.hopTo(31 * TILE + 4, 120);                      // sur le pilier 2
    yield* c.land();
    for (let k = 0; k < 60 && c.me.x < 34 * TILE; k++) yield* c.hold(c.me.x > 31 * TILE + 8 ? -1 : 1, 1);   // on rejoint la case du portail
    yield* c.wait(10);
    yield* c.walkToTile(41);
    yield* c.wait(300);
  },
  function* (c) { // joueur 1 : le haut, qui passe par le portail du coffre n°1 et tient la porte-plaque
    yield* c.walkToTile(9);
    yield* leap(c, 10, 4, true);
    yield* mountAt(c, 19);
    yield* c.until(() => c.other.vy < 0, 300, '(décollage du bas)');
    yield* c.wait(8);
    yield* c.hop(1, 16);
    yield* c.land();
    for (let k = 0; k < 60 && c.me.x > 12 * TILE; k++) yield* c.hold(c.me.x > 19 * TILE + 8 ? -1 : 1, 1);     // on rejoint la case du portail
    yield* c.until(() => c.me.x < 12 * TILE, 60, '(téléporté)');
    yield* c.walkToTile(8);                                  // porte + plaque
    yield* c.wait(1500);
  },
];

/* 10. Pulsations --------------------------------------------------------- */
// Les pierres : r présente aux ticks 0..35 (mod 90), s aux ticks 45..80. Un saut dure ~36 ticks : on vise le milieu de la fenêtre d'arrivée.
const phase = (c) => c.G.t % 90;
function* atPhase(c, ph) { const lo = ph - 12, hi = ph + 6; yield* c.until(() => { const p = phase(c); return p >= lo && p <= hi; }, 200, `(phase ${ph})`); }
function* stoneRun(c, lead) {
  const off = lead ? 20 : 4;                                 // où l'on retombe sur la pierre
  yield* c.walkTo(7 * TILE - PW, 2);                         // bord du départ
  yield* atPhase(c, 70);
  yield* c.hopTo(8 * TILE + off, 60); yield* c.land();       // 1re pierre (r)
  // r → s : décollage à la phase 27 ; s → r : phase 72
  const stones = [[14, 's'], [20, 'r'], [26, 's']];
  let prev = 8;
  for (const [tx, kind] of stones) {
    yield* c.walkTo((prev + 2) * TILE - PW, 2);              // bord droit de la pierre
    yield* atPhase(c, kind === 's' ? 27 : 72);
    yield* c.hopTo(tx * TILE + off, 90); yield* c.land();
    prev = tx;
  }
  yield* c.walkTo(28 * TILE - PW, 2);
  yield* atPhase(c, 72);                                      // s → îlot (arrivée sans contrainte)
  yield* c.hopTo(32 * TILE + off, 90); yield* c.land();
}
S[9] = [
  function* (c) { // joueur 0 : mène, puis est le bas sous la cloche
    yield* stoneRun(c, true);
    yield* c.walkTo(34 * TILE + 4);
    yield* c.until(() => Math.abs(c.other.y + PH - c.me.y) < 0.01 && c.other.onGround, 1500, '(haut monté)');
    yield* c.wait(14);
    yield* c.until(() => c.G.bridge[1] > 0, 120, '(pont)');
    yield* backOn(c);
    yield* c.walkToTile(49);
    yield* c.walkToTile(52);
    yield* c.wait(300);
  },
  function* (c) { // joueur 1 : suit, puis frappe la cloche
    yield* c.until(() => c.other.x > 14 * TILE, 1500, '(l’autre est sur la 2e pierre)');
    yield* stoneRun(c, false);
    yield* c.until(() => Math.abs(c.other.x - (34 * TILE + 4)) < 3 && c.other.onGround, 900, '(bas en place)');
    yield* c.wait(6);
    yield* c.mount();
    yield* c.wait(8);
    yield* c.jump();
    yield* c.until(() => c.G.bridge[1] > 0, 60, '(pont)');
    yield* c.land();
    yield* c.walkToTile(49);
    yield* c.walkToTile(55);
    yield* c.wait(300);
  },
];

/* 11. Métronome ----------------------------------------------------------- */
// Pierres : r présent aux ticks 0..35 (mod 80), s aux ticks 40..75. Un saut dure ~38 ticks.
const W11 = Number(process.env.W11 || 18);                                  // délai du haut dans le saut en chaîne (mur de 6 cases)
const ph80 = (c) => c.G.t % 80;
function* inPh(c, lo, hi) { yield* c.until(() => { const p = ph80(c); return p >= lo && p <= hi; }, 200, `(phase ${lo}-${hi})`); }
function* stoneRun11(c, lead) {
  const off = lead ? 20 : 4, back = lead ? 0 : 26;           // le suiveur décolle juste derrière le meneur
  yield* c.walkTo(41 * TILE - PW - back, 2);
  yield* inPh(c, 44, 48);                                     // sol → r : on retombe vers la phase 2..6
  yield* c.hopTo(43 * TILE + off, 60); yield* c.land();
  let prev = 43;
  for (const [tx, kind] of [[48, 's'], [53, 'r'], [58, 's'], [63, 'r']]) {
    yield* c.walkTo((prev + 2) * TILE - PW - back, 2);
    if (kind === 's') yield* inPh(c, 4, 33); else yield* inPh(c, 44, 72);
    yield* c.hopTo(tx * TILE + off, 90); yield* c.land();
    prev = tx;
  }
  yield* c.walkTo(65 * TILE - PW - back, 2);
  yield* inPh(c, 4, 33);
  yield* c.hopTo(66 * TILE + off, 90); yield* c.land();
}
S[10] = [
  function* (c) { // joueur 0 : le bas du mur, mène sur les pierres, bas sous la cloche
    yield* c.walkToTile(5);
    yield* c.walkToTile(11 - 1);
    yield* leap(c, 11, 3, true);
    yield* c.walkToTile(14);
    yield* leap(c, 19, 3, true);
    yield* c.walkToTile(27);
    yield* standAt(c, 36);
    yield* chainLow(c, 6);
    yield* c.until(() => c.G.open[2], 200, '(grille B)');
    yield* c.walkToTile(38);
    yield* c.walkToTile(40);
    yield* stoneRun11(c, true);
    yield* c.walkToTile(68);
    yield* c.until(() => c.G.bridge[1] > 0, 400, '(pont)');
    yield* c.walkToTile(81);
    yield* c.walkToTile(87);
    yield* c.wait(300);
  },
  function* (c) { // joueur 1 : le haut du mur, plaque, puis frappe la cloche
    yield* c.until(() => c.me.x < 6 * TILE, 5, '');
    yield* c.walkToTile(4);
    yield* c.until(() => c.other.x > 6 * TILE, 600, '(l’autre part)');
    yield* c.walkToTile(5);
    yield* c.walkTo(9 * TILE, 2);
    yield* leap(c, 11, 3, true);
    yield* c.walkToTile(14);
    yield* leap(c, 19, 3, true);
    yield* c.walkToTile(27);
    yield* mountAt(c, 36);
    yield* c.until(() => c.other.vy < 0, 300, '(décollage du bas)');
    yield* c.wait(W11);
    yield* c.hop(1, 16);
    yield* c.land();
    yield* c.walkTo(36 * TILE + 4);                          // plaque b
    yield* c.until(() => c.other.x > 38 * TILE, 900, '(bas passé la grille)');
    yield* c.wait(8);
    yield* c.walkToTile(39);
    yield* c.until(() => c.other.x > 42 * TILE, 900, '(l’autre est sur la 1re pierre)');
    yield* stoneRun11(c, false);
    yield* c.until(() => Math.abs(c.other.x - (68 * TILE + 4)) < 3 && c.other.onGround, 900, '(bas en place)');
    yield* c.wait(6);
    yield* c.mount();
    yield* c.wait(8);
    yield* c.jump();
    yield* c.until(() => c.G.bridge[1] > 0, 60, '(pont)');
    yield* c.land();
    yield* c.walkToTile(81);
    yield* c.walkToTile(84);
    yield* c.wait(300);
  },
];

/* 12. Premier souffle ------------------------------------------------------- */
S[11] = [
  function* (c) { // joueur 0 : monte le premier par le courant P, bascule l'interrupteur, puis est le bas du dernier mur
    yield* c.walkToTile(9);
    yield* leap(c, 10, 3, true);
    yield* c.walkToTile(15);
    yield* c.walkToTile(22);
    yield* c.until(() => c.G.open[1], 2000, '(plaque tenue)');
    yield* c.walkToTile(24);
    yield* c.until(() => c.me.y + PH < 5 * TILE - 4, 200, '(au-dessus du mur)');
    yield* c.walkToTile(28);                                   // interrupteur : souffle Q
    yield* c.walkToTile(30);
    yield* c.until(() => c.other.x > 26 * TILE && c.other.onGround, 600, '(l’autre est monté)');
    yield* c.wait(20);
    yield* c.walkToTile(33);
    yield* leap(c, 34, 3, false);
    yield* c.walkToTile(41);
    yield* c.walkToTile(44);
    yield* c.walkToTile(46);
    // dernier mur (4 cases) : on reste en bas
    yield* standAt(c, 48);
    yield* c.until(() => Math.abs(c.other.y + PH - c.me.y) < 0.01 && c.other.onGround, 1500, '(haut monté)');
    yield* c.wait(8);
    yield* c.jump();
    yield* c.wait(50);
    yield* c.until(() => c.G.open[3], 900, '(grille C)');
    yield* c.walkToTile(51);
    yield* c.walkToTile(59);
    yield* c.wait(300);
  },
  function* (c) { // joueur 1 : tient la plaque, monte par Q, puis est le haut du dernier mur
    yield* c.walkToTile(9);
    yield* leap(c, 10, 3, true);
    yield* c.walkToTile(15);
    yield* c.walkToTile(18);                                   // plaque a
    yield* c.until(() => c.G.open[2], 3000, '(interrupteur basculé)');
    yield* c.walkToTile(23);
    yield* c.until(() => c.me.y + PH < 5 * TILE - 4, 200, '(au-dessus du mur)');
    yield* c.walkToTile(30);
    yield* c.until(() => c.other.x > 33 * TILE, 900, '(l’autre franchit les pics)');
    yield* c.walkToTile(33);
    yield* leap(c, 34, 3, false);
    yield* c.walkToTile(41);
    yield* c.walkToTile(44);
    yield* mountAt(c, 48);
    yield* c.until(() => c.other.vy < 0, 300, '(décollage du bas)');
    yield* c.wait(8);
    yield* c.hop(1, 16);
    yield* c.land();
    yield* c.walkTo(48 * TILE + 4);                            // plaque c
    yield* c.until(() => c.other.x > 50 * TILE, 900, '(bas passé la grille)');
    yield* c.wait(8);
    yield* c.walkToTile(51);
    yield* c.hold(1, 10); yield* c.land();
    yield* c.walkToTile(56);
    yield* c.wait(300);
  },
];

/* 13. Cloches d'altitude ----------------------------------------------------- */
const W13 = Number(process.env.W13 || 12);                                  // délai du haut dans le saut en chaîne (mur de 5 cases)
S[12] = [
  function* (c) { // joueur 0 : monte par les courants (cloches), puis est le bas du mur de 5 cases
    yield* c.walkToTile(9);
    yield* c.walkToTile(15);
    yield* c.until(() => c.G.open[1], 2000, '(plaque a tenue)');
    yield* c.walkToTile(16);
    yield* c.until(() => c.G.bridge[1] > 0, 300, '(pont M)');
    yield* c.until(() => !c.G.open[1], 600, '(l’autre court)');
    yield* c.walkToTile(30);
    yield* c.walkToTile(38);
    yield* standAt(c, 40);
    yield* c.until(() => Math.abs(c.other.y + PH - c.me.y) < 0.01 && c.other.onGround, 1500, '(haut monté)');
    yield* c.wait(8);
    yield* c.jump();
    yield* c.wait(50);
    yield* c.until(() => c.G.open[3], 900, '(grille C)');
    yield* c.walkToTile(44);
    yield* c.walkToTile(57);
    // fosse n°3 : on s'envole le premier
    yield* c.until(() => c.G.open[2], 3000, '(plaque b tenue)');
    yield* c.walkToTile(58);
    yield* c.until(() => c.G.bridge[2] > 0, 300, '(pont N)');
    yield* c.walkToTile(72);                                  // îlot : colonne de la cloche w
    yield* c.until(() => c.G.bridge[3] > 0, 300, '(pont O)');
    yield* c.until(() => !c.G.open[2], 600, '(l’autre court)');
    yield* c.walkToTile(86);
    yield* c.walkToTile(100);
    yield* c.wait(300);
  },
  function* (c) { // joueur 1 : tient les plaques, puis est le haut du mur de 5 cases
    yield* c.walkToTile(9);
    yield* c.walkToTile(13);                                  // plaque a
    yield* c.until(() => c.G.bridge[1] > 0, 3000, '(pont M)');
    yield* c.wait(6);
    yield* c.walkToTile(30);
    yield* c.walkToTile(38);
    yield* mountAt(c, 40);
    yield* c.until(() => c.other.vy < 0, 300, '(décollage du bas)');
    yield* c.wait(W13);
    yield* c.hop(1, 16);
    yield* c.land();
    yield* c.walkTo(40 * TILE + 4);                           // plaque c
    yield* c.until(() => c.other.x > 42 * TILE, 900, '(bas passé la grille)');
    yield* c.wait(8);
    yield* c.walkToTile(43);
    yield* c.hold(1, 10); yield* c.land();
    yield* c.walkToTile(56);                                  // plaque b
    yield* c.until(() => c.G.bridge[3] > 0, 3000, '(pont O)');
    yield* c.wait(4);
    yield* c.walkToTile(86);
    yield* c.walkToTile(97);
    yield* c.wait(300);
  },
];

/* 14. Ascenseur ------------------------------------------------------------- */
const W14 = Number(process.env.W14 || 12);                                  // délai du haut dans le saut en chaîne (mur de 5 cases)
// Franchit un trou vers la GAUCHE : la 1re case du trou (la plus à gauche) est tx, il fait w cases
function* leapL(c, tx, w) { yield* c.walkTo((tx + w) * TILE - 20, 2); yield* c.hopTo(tx * TILE - 20, 90); yield* c.land(); }
const ph90 = (c) => c.G.t % 90;
function* at90(c, ph) { const lo = ph - 12, hi = ph + 6; yield* c.until(() => { const p = ph90(c); return p >= lo && p <= hi; }, 200, `(phase ${ph})`); }
function* stones14(c, lead, base = 0) {
  const off = lead ? 20 : 4;
  yield* c.walkTo((10 + base) * TILE - PW, 2);                // bord du trou
  yield* at90(c, 70);
  yield* c.hopTo((11 + base) * TILE + off, 60); yield* c.land();       // 1re pierre (r)
  let prev = 11 + base;
  for (const [tx, kind] of [[17 + base, 's'], [23 + base, 'r']]) {
    yield* c.walkTo((prev + 2) * TILE - PW, 2);
    yield* at90(c, kind === 's' ? 27 : 72);
    yield* c.hopTo(tx * TILE + off, 90); yield* c.land();
    prev = tx;
  }
  yield* c.walkTo((25 + base) * TILE - PW, 2);
  yield* at90(c, 27);                                         // r → sol (arrivée sans contrainte)
  yield* c.hopTo((29 + base) * TILE + off, 90); yield* c.land();
}
S[13] = [
  function* (c) { // joueur 0 : monte le premier (P), détient la plaque c à l'étage 1, puis monte par Q ; haut du mur de 5 cases
    // étage 0
    yield* c.walkToTile(9);
    yield* leap(c, 10, 4, true);
    yield* c.walkToTile(15);
    yield* c.until(() => c.other.onGround && c.other.x > 13 * TILE && c.other.x < 16 * TILE, 600, '(l’autre a franchi la fosse)');
    yield* c.walkToTile(26);                                  // pont de dalles : on court sans s'arrêter
    yield* c.walkToTile(31);
    yield* c.until(() => c.G.open[1], 2500, '(plaque a tenue)');
    yield* c.walkToTile(33);
    yield* c.until(() => c.me.y + PH < 21 * TILE - 4, 300, '(étage 1)');
    // étage 1 : vers la gauche, jusqu'à la plaque c
    yield* c.walkToTile(27);
    yield* leapL(c, 16, 4);
    yield* c.walkToTile(7);                                   // plaque c
    yield* c.until(() => c.G.open[2], 3000, '(interrupteur y2)');
    yield* c.walkToTile(2);                                   // courant Q
    yield* c.until(() => c.me.y + PH < 12 * TILE - 4, 300, '(étage 2)');
    yield* c.walkToTile(5);
    yield* c.wait(4);
    // étage 2 : le 2e à arriver suit
    yield* c.until(() => c.other.x > 17 * TILE, 3000, '(l’autre est sur la 2e pierre)');
    yield* stones14(c, false);
    yield* mountAt(c, 30);
    yield* c.until(() => c.other.vy < 0, 300, '(décollage du bas)');
    yield* c.wait(W14);
    yield* c.hop(1, 16);
    yield* c.land();
    yield* c.walkToTile(31);                                  // interrupteur y3
    yield* c.walkToTile(34);
    yield* c.wait(300);
  },
  function* (c) { // joueur 1 : tient la plaque a, monte par Q, monte par R, puis est le bas du mur de 5 cases
    yield* c.walkToTile(9);
    yield* leap(c, 10, 4, true);
    yield* c.until(() => c.other.x > 15 * TILE + 8, 1500, '(l’autre part sur le pont)');
    yield* c.walkToTile(26);                                  // on le suit de près
    yield* c.walkToTile(29);                                  // plaque a
    yield* c.until(() => c.G.open[2], 3000, '(interrupteur y)');
    yield* c.walkToTile(34);
    yield* c.until(() => c.me.y + PH < 21 * TILE - 4, 300, '(étage 1)');
    yield* c.walkToTile(27);
    yield* leapL(c, 16, 4);
    yield* c.walkTo(8 * TILE + 4);                            // juste à droite de l'autre, qui est sur la plaque c
    yield* c.hopTo(4 * TILE + 4, 90); yield* c.land();        // on saute par-dessus lui
    yield* c.walkToTile(1);                                   // courant R
    yield* c.until(() => c.me.y + PH < 12 * TILE - 4, 300, '(étage 2)');
    yield* c.walkToTile(4);                                   // interrupteur y2
    yield* c.walkToTile(6);
    yield* stones14(c, true);
    yield* standAt(c, 30);
    yield* chainLow(c, 8);
    yield* c.until(() => c.G.open[2], 1500, '(courant Q3)');
    yield* c.until(() => c.me.y + PH < 7 * TILE - 4, 300, '(sur la corniche)');
    yield* c.walkToTile(32);
    yield* c.wait(300);
  },
];

/* 15. Allée des pics ---------------------------------------------------------- */
const W15 = Number(process.env.W15 || 12);                                  // délai du haut dans le saut en chaîne (mur de 5 cases)
// Traverse un lit de pics de w cases dont la 1re case est tx ; kind 'e' (phase A) ou 'E' (phase B). Le second part juste derrière le premier.
function* crossBed(c, tx, w, kind, lead) {
  const off = kind === 'E' ? 55 : 0;
  yield* c.walkTo(tx * TILE - 27 - (lead ? 0 : 28), 1);
  if (!lead) yield* c.until(() => c.other.x > tx * TILE - 27 + 6, 600, '(le premier s’engage)');
  else yield* c.until(() => { const p = (c.G.t + off) % 110; return p >= Number(process.env.P15 || 52) && p <= Number(process.env.P15 || 52) + 3; }, 600, '(phase)');
  yield* c.walkTo((tx + w) * TILE + 2, 2);
}
S[14] = [
  function* (c) { // joueur 0 : mène dans les allées, bas du mur de 5 cases
    yield* crossBed(c, 10, 4, 'e', true);
    yield* crossBed(c, 19, 4, 'E', true);
    yield* crossBed(c, 28, 4, 'e', true);
    yield* c.walkToTile(41);
    yield* standAt(c, 44);
    yield* chainLow(c, 8);
    yield* c.wait(50);
    yield* c.until(() => c.G.open[3], 900, '(grille C)');
    yield* c.walkToTile(47);
    yield* crossBed(c, 52, 4, 'E', true);
    yield* crossBed(c, 60, 4, 'e', true);
    yield* c.walkToTile(71);
    yield* c.wait(300);
  },
  function* (c) { // joueur 1 : suit, haut du mur de 5 cases, plaque c
    yield* crossBed(c, 10, 4, 'e', false);
    yield* crossBed(c, 19, 4, 'E', false);
    yield* crossBed(c, 28, 4, 'e', false);
    yield* c.walkToTile(40);
    yield* mountAt(c, 44);
    yield* c.until(() => c.other.vy < 0, 300, '(décollage du bas)');
    yield* c.wait(W15);
    yield* c.hop(1, 16);
    yield* c.land();
    yield* c.walkTo(44 * TILE + 4);                           // plaque c
    yield* c.until(() => c.other.x > 46 * TILE, 900, '(bas passé la grille)');
    yield* c.wait(8);
    yield* c.walkToTile(47);
    yield* c.hold(1, 10); yield* c.land();
    yield* c.walkToTile(48);
    yield* crossBed(c, 52, 4, 'E', false);
    yield* crossBed(c, 60, 4, 'e', false);
    yield* c.walkToTile(68);
    yield* c.wait(300);
  },
];

/* 16. Prêts ? Partez ! --------------------------------------------------------- */
const W16 = Number(process.env.W16 || 12);                                  // délai du haut dans le saut en chaîne (mur de 4 cases)
S[15] = [
  function* (c) { // joueur 0 : plaque a2, plaque b2 au sol, plaque c2 ; bas du mur
    yield* c.walkToTile(9);
    yield* leap(c, 13, 4, true);
    yield* c.walkToTile(22);                                  // plaque a (2)
    yield* c.until(() => c.G.open[1], 2500, '(grille A)');
    yield* c.walkToTile(26);
    yield* c.walkToTile(37);
    yield* standAt(c, 38);
    yield* chainLow(c, 8);
    yield* c.wait(40);
    yield* c.walkToTile(50);                                  // plaque b (2)
    yield* c.until(() => c.G.open[2], 2500, '(grille B)');
    yield* c.walkToTile(57);
    yield* c.walkToTile(62);                                  // plaque c (2)
    yield* c.until(() => c.G.open[3], 2500, '(grille C)');
    yield* c.walkToTile(65);
    yield* leap(c, 72, 3, true);
    yield* c.walkTo(80 * TILE + 8);
    yield* leap(c, 81, 3, true);
    yield* c.walkToTile(88);
    yield* c.walkToTile(91);
    yield* c.wait(300);
  },
  function* (c) { // joueur 1 : plaque a1, haut du mur (plaque b1), plaque c1
    yield* c.walkToTile(8);                                   // plaque a (1)
    yield* c.until(() => c.G.open[1], 2500, '(grille A)');
    yield* c.walkToTile(9);
    yield* leap(c, 13, 4, true);
    yield* c.walkToTile(26);
    yield* c.walkToTile(36);
    yield* mountAt(c, 38);
    yield* c.until(() => c.other.vy < 0, 300, '(décollage du bas)');
    yield* c.wait(W16);
    yield* c.hop(1, 16);
    yield* c.land();
    yield* c.walkTo(38 * TILE + 4);                           // plaque b (1)
    yield* c.until(() => c.G.open[2], 2500, '(grille B)');
    yield* c.walkToTile(41);
    yield* c.hold(1, 10); yield* c.land();
    yield* c.walkToTile(57);
    yield* c.walkToTile(60);                                  // plaque c (1)
    yield* c.until(() => c.G.open[3], 2500, '(grille C)');
    yield* c.walkToTile(65);
    yield* leap(c, 72, 3, true);
    yield* c.walkTo(80 * TILE + 8);
    yield* leap(c, 81, 3, true);
    yield* c.walkToTile(88);
    yield* c.walkToTile(89);
    yield* c.wait(300);
  },
];

/* 17. Chacun son couloir --------------------------------------------------------- */
S[16] = [
  function* (c) { // joueur 0 : couloir du haut (pics rythmés, pierres, interrupteurs x et z)
    yield* crossBed(c, 10, 4, 'e', true);
    yield* crossBed(c, 19, 4, 'E', true);
    yield* c.walkToTile(33);                                  // interrupteur x : grille A du bas
    yield* c.walkToTile(37);
    yield* c.until(() => c.G.open[2], 4000, '(grille B)');
    yield* c.walkToTile(40);
    yield* stones14(c, true, 32);
    yield* c.walkToTile(70);                                  // interrupteur z : grille C du bas
    yield* crossBed(c, 73, 4, 'e', true);
    yield* c.walkToTile(79);
    yield* c.wait(300);
  },
  function* (c) { // joueur 1 : couloir du bas (dalles fragiles, tapis, interrupteur y)
    yield* c.walkToTile(9);
    yield* c.walkToTile(21);                                  // pont de dalles : on court sans s'arrêter
    yield* c.walkToTile(33);                                  // interrupteur y : grille B du haut
    yield* c.walkToTile(37);
    yield* c.until(() => c.G.open[1], 4000, '(grille A)');
    yield* c.walkToTile(40);
    yield* leap(c, 49, 3, true);
    yield* c.walkToTile(65);
    yield* c.until(() => c.G.open[3], 4000, '(grille C)');
    yield* c.walkToTile(71);
    yield* leap(c, 72, 3, true);
    yield* c.walkToTile(79);
    yield* c.wait(300);
  },
];

/* 18. Orbite -------------------------------------------------------------------- */
// Franchit une fosse de 6 cases avec le ressort (case sx, fosse à partir de sx+1)
function* springLeap(c, sx) {
  yield* c.walkTo((sx + 1) * TILE - 6, 3);
  yield* c.hop(1, 62);
  yield* c.land();
}
const W18 = Number(process.env.W18 || 18);
S[17] = [
  function* (c) { // joueur 0 : mène sur les pierres, est le bas du saut en chaîne depuis le ressort
    yield* stones14(c, true);
    yield* c.walkToTile(35);
    yield* c.walkToTile(37);                                   // sur le ressort
    yield* c.until(() => Math.abs(c.other.y + PH - c.me.y) < 0.01 && c.other.onGround, 1500, '(haut monté)');
    yield* c.wait(8);
    yield* c.jump();
    yield* c.until(() => c.me.onGround, 200, '(retombé)');
    yield* c.walkToTile(40);
    yield* c.walkToTile(54);                                   // le pont ne dure pas : on court
    yield* crossBed(c, 58, 4, 'e', true);
    yield* crossBed(c, 66, 4, 'E', true);
    yield* c.walkToTile(75);
    yield* springLeap(c, 76);
    yield* c.walkToTile(86);
    yield* stones14(c, true, 80);
    yield* c.walkToTile(111);
    yield* c.walkToTile(115);
    yield* c.wait(300);
  },
  function* (c) { // joueur 1 : suit, est le haut du saut en chaîne (sonne la cloche)
    yield* c.walkToTile(8);
    yield* c.until(() => c.other.x > 17 * TILE, 3000, '(l’autre est sur la 2e pierre)');
    yield* stones14(c, false);
    yield* c.walkToTile(34);
    yield* c.until(() => c.other.x > 36 * TILE && c.other.onGround, 900, '(le bas est sur le ressort)');
    yield* c.mount();
    yield* c.wait(8);
    yield* c.until(() => c.other.vy < 0, 300, '(décollage du bas)');
    yield* c.wait(W18);
    yield* c.jump();
    yield* c.until(() => c.me.onGround, 200, '(retombé)');
    yield* c.walkToTile(40);
    yield* c.walkToTile(54);
    yield* crossBed(c, 58, 4, 'e', false);
    yield* crossBed(c, 66, 4, 'E', false);
    yield* c.walkToTile(75);
    yield* springLeap(c, 76);
    yield* c.walkToTile(86);
    yield* c.until(() => c.other.x > 97 * TILE, 3000, '(l’autre est sur la 2e pierre)');
    yield* stones14(c, false, 80);
    yield* c.walkToTile(111);
    yield* c.walkToTile(112);
    yield* c.wait(300);
  },
];

/* 19. Funambules ----------------------------------------------------------------- */
const W19 = Number(process.env.W19 || 12);
// Saute depuis le ressort (case sx) vers le chemin suspendu à droite
function* springUp(c, sx) {
  yield* c.walkTo((sx + 1) * TILE - 6, 3);
  yield* c.hop(1, 41);
  yield* c.land();
}
S[18] = [
  function* (c) { // joueur 0 : mène, bas des deux murs
    yield* c.walkToTile(9);
    yield* c.until(() => c.other.x > 7 * TILE, 900, '(l’autre est prêt)');
    yield* c.walkToTile(23);
    yield* c.walkToTile(24);
    yield* springUp(c, 25);
    yield* c.walkToTile(31);
    yield* crossBed(c, 35, 4, 'e', true);
    yield* crossBed(c, 43, 4, 'E', true);
    yield* c.walkTo(51 * TILE, 2); yield* c.land();
    yield* c.walkToTile(54);
    yield* standAt(c, 58);
    yield* chainLow(c, 8);
    yield* c.wait(50);
    yield* c.until(() => c.G.open[3], 900, '(grille C)');
    yield* c.walkToTile(61);
    yield* c.walkToTile(63);
    yield* c.until(() => c.other.onGround && c.other.x > 61 * TILE + 16, 900, '(l’autre est prêt)');
    yield* c.walkToTile(77);
    yield* c.walkToTile(80);
    yield* standAt(c, 84);
    yield* chainLow(c, 8);
    yield* c.wait(50);
    yield* c.until(() => c.G.open[2], 900, '(grille B)');
    yield* c.walkToTile(87);
    yield* c.walkToTile(95);
    yield* c.wait(300);
  },
  function* (c) { // joueur 1 : suit, haut des deux murs
    yield* c.walkToTile(8);
    yield* c.until(() => c.other.x > 10 * TILE + 8, 1500, '(l’autre part sur le pont)');
    yield* c.walkToTile(23);
    yield* c.walkToTile(24);
    yield* c.until(() => c.other.x > 29 * TILE, 900, '(l’autre est sur le chemin)');
    yield* springUp(c, 25);
    yield* c.walkToTile(31);
    yield* crossBed(c, 35, 4, 'e', false);
    yield* crossBed(c, 43, 4, 'E', false);
    yield* c.walkTo(51 * TILE, 2); yield* c.land();
    yield* c.walkToTile(54);
    yield* mountAt(c, 58);
    yield* c.until(() => c.other.vy < 0, 300, '(décollage du bas)');
    yield* c.wait(W15);
    yield* c.hop(1, 16);
    yield* c.land();
    yield* c.walkTo(58 * TILE + 4);                            // plaque c
    yield* c.until(() => c.other.x > 60 * TILE, 900, '(bas passé la grille)');
    yield* c.wait(8);
    yield* c.walkToTile(61);
    yield* c.hold(1, 10); yield* c.land();
    yield* c.walkToTile(62);
    yield* c.until(() => c.other.x > 63 * TILE + 16, 900, '(l’autre part sur le pont)');
    yield* c.walkToTile(77);
    yield* c.walkToTile(80);
    yield* mountAt(c, 84);
    yield* c.until(() => c.other.vy < 0, 300, '(décollage du bas)');
    yield* c.wait(W16);
    yield* c.hop(1, 16);
    yield* c.land();
    if (!c.G.open[2]) yield* c.walkTo(84 * TILE + 4);          // interrupteur y
    yield* c.until(() => c.G.open[2] && c.other.x > 86 * TILE, 900, '(bas passé la grille)');
    yield* c.wait(8);
    yield* c.walkToTile(87);
    yield* c.hold(1, 10); yield* c.land();
    yield* c.walkToTile(92);
    yield* c.wait(300);
  },
];

/* 20. Tandem (ascension en trois étages) ------------------------------------------- */
S[19] = [
  function* (c) { // joueur 0 : mène partout, monte le premier dans le courant
    yield* stones14(c, true);
    yield* c.walkToTile(35);
    yield* c.walkToTile(42);
    yield* c.until(() => c.G.open[1], 3000, '(plaque tenue)');
    yield* c.walkToTile(44);
    yield* c.until(() => c.me.y + PH < 11 * TILE - 4, 200, '(au-dessus du mur)');
    yield* c.walkToTile(48);                                   // interrupteur : souffle Q
    yield* c.walkToTile(50);
    yield* c.until(() => c.other.x > 46 * TILE && c.other.onGround, 600, '(l’autre est monté)');
    yield* c.wait(20);
    yield* c.walkToTile(53);
    yield* leap(c, 54, 3, false);
    yield* c.walkToTile(58);
    yield* crossBed(c, 65, 4, 'e', true);
    yield* crossBed(c, 73, 4, 'E', true);
    yield* c.walkToTile(82);
    yield* c.walkToTile(83);
    yield* c.until(() => c.other.x > 82 * TILE && c.other.onGround, 900, '(l’autre est prêt)');
    yield* c.walkToTile(96);                                   // long pont de verre : on court
    yield* springUp(c, 97);
    yield* c.walkToTile(103);
    yield* stones14(c, true, 98);
    yield* c.walkToTile(133);
    yield* c.walkToTile(137);
    yield* c.wait(300);
  },
  function* (c) { // joueur 1 : tient la plaque, monte par Q, suit partout
    yield* c.walkToTile(8);
    yield* c.until(() => c.other.x > 17 * TILE, 3000, '(l’autre est sur la 2e pierre)');
    yield* stones14(c, false);
    yield* c.walkToTile(35);
    yield* c.walkToTile(38);                                   // plaque a
    yield* c.until(() => c.G.open[2], 3000, '(interrupteur basculé)');
    yield* c.walkToTile(43);
    yield* c.until(() => c.me.y + PH < 11 * TILE - 4, 200, '(au-dessus du mur)');
    yield* c.walkToTile(50);
    yield* c.until(() => c.other.x > 53 * TILE, 900, '(l’autre franchit les pics)');
    yield* c.walkToTile(53);
    yield* leap(c, 54, 3, false);
    yield* c.walkToTile(58);
    yield* crossBed(c, 65, 4, 'e', false);
    yield* crossBed(c, 73, 4, 'E', false);
    yield* c.walkToTile(82);
    yield* c.until(() => c.other.x > 84 * TILE + 8, 900, '(l’autre part sur le pont)');
    yield* c.walkToTile(96);
    yield* c.until(() => c.other.x > 100 * TILE && c.other.onGround, 900, '(l’autre est en haut)');
    yield* springUp(c, 97);
    yield* c.walkToTile(102);
    yield* c.until(() => c.other.x > (17 + 98) * TILE, 3000, '(l’autre est sur la 2e pierre)');
    yield* stones14(c, false, 98);
    yield* c.walkToTile(133);
    yield* c.walkToTile(134);
    yield* c.wait(300);
  },
];

// ---- Niveaux 21 et suivants : voir solutions2.js ----
Object.defineProperty(S, 'H', { enumerable: false, value: { ring, leap, standAt, mountAt, chainLow, chainTopRing, stones14, crossBed, springLeap, springUp, leapL, at90 } });
require('./solutions2')(S, S.H);
require('./solutions3')(S, S.H);
module.exports = S;
