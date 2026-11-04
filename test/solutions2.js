// Solutions des niveaux 21 à 30 (précision, coordination, casse-têtes)
const { TILE, PW, PH } = require('./harness');
module.exports = function (S, H) {
  const { standAt, mountAt, chainLow, chainTopRing, stones14, crossBed } = H;

  // ---- Pylônes : saut précis d'un pylône à l'autre -------------------------------------------------------
  // pl = { tx, w, top } (top = rangée du dessus). On décolle au bord du pylône (1 tick de « coyote »), on retombe sur le suivant.
  const edgeX = (p) => (p.tx + p.w) * TILE;
  function* hopTo(c, p) { yield* c.walkTo(edgeX(p.from) - 1, 1); yield* c.hopTo(p.tx * TILE + 4, 90); yield* c.land(); }
  // suite de pylônes ; wait(i) = condition d'attente avant le saut vers le pylône i (le suiveur laisse la place)
  function* hopSeq(c, from, seq, wait) {
    let cur = from;
    for (let i = 0; i < seq.length; i++) {
      if (wait) yield* wait(i, cur);
      yield* hopTo(c, Object.assign({ from: cur }, seq[i]));
      cur = seq[i];
    }
    return cur;
  }
  H.hopSeq = hopSeq; H.edgeX = edgeX;

  /* 21. Pylônes ------------------------------------------------------------------------------------------ */
  const A = [{ tx: 14, w: 1 }, { tx: 19, w: 1 }, { tx: 25, w: 1 }, { tx: 29, w: 2 }, { tx: 35, w: 1 }, { tx: 41, w: 1 }];
  const B = [{ tx: 60, w: 2 }, { tx: 65, w: 1 }, { tx: 70, w: 2 }, { tx: 76, w: 1 }, { tx: 81, w: 1 }];
  const C = [{ tx: 97, w: 1 }, { tx: 102, w: 1 }, { tx: 107, w: 1 }];
  const D = [123, 128, 132, 137, 141, 146, 150, 155, 160, 164, 169, 173].map((tx) => ({ tx, w: 1 }));
  const GROUND0 = { tx: 1, w: 9 }, GROUND1 = { tx: 47, w: 10 }, GROUND2 = { tx: 86, w: 7 }, GROUND3 = { tx: 111, w: 8 }, GROUND4 = { tx: 178, w: 11 };
  const follow = (leaderSeq) => (i, cur) => function* () {}; // (non utilisé)
  S[20] = [
    function* (c) { // joueur 0 : mène
      yield* c.walkToTile(8);
      let cur = yield* hopSeq(c, GROUND0, A);
      yield* hopTo(c, Object.assign({ from: cur }, GROUND1));
      yield* c.walkToTile(55);
      cur = GROUND1;
      cur = yield* hopSeq(c, Object.assign({}, GROUND1, { w: 10 }), B.slice(0, 3));
      yield* c.walkTo(70 * TILE + 4);                                 // plaque du pylône avant
      yield* c.until(() => c.G.open[1], 3000, '(plaque arrière tenue)');
      cur = yield* hopSeq(c, B[2], B.slice(3));
      yield* hopTo(c, Object.assign({ from: cur }, GROUND2));
      yield* c.walkToTile(90);
      yield* hopSeq(c, Object.assign({}, GROUND2, { w: 7 }), C);
      yield* hopTo(c, Object.assign({ from: C[2] }, GROUND3));
      cur = yield* hopSeq(c, GROUND3, D);
      yield* hopTo(c, Object.assign({ from: cur }, GROUND4));
      yield* c.walkToTile(186);
      yield* c.wait(300);
    },
    function* (c) { // joueur 1 : suit
      yield* c.walkToTile(6);
      yield* c.until(() => c.other.x > 20 * TILE, 3000, '(l’autre avance)');
      let cur = yield* hopSeq(c, GROUND0, A, function* (i) { yield* c.until(() => c.other.onGround && c.other.x > (A[Math.min(i + 1, A.length - 1)].tx + (i + 1 >= A.length ? 6 : 0)) * TILE - 8, 3000, '(le pylône suivant est libre)'); });
      yield* c.until(() => c.other.onGround && c.other.x > 50 * TILE, 3000, '(l’autre est au sol)');
      yield* hopTo(c, Object.assign({ from: cur }, GROUND1));
      yield* c.walkToTile(55);
      yield* c.until(() => c.other.onGround && Math.abs(c.other.x - (70 * TILE + 4)) < 2, 3000, '(l’autre est sur la plaque)');
      yield* hopSeq(c, GROUND1, [B[0]]);
      yield* c.walkTo(60 * TILE + 4);                                // plaque arrière
      yield* c.until(() => c.G.open[1], 3000, '(plaques tenues)');
      cur = yield* hopSeq(c, B[0], B.slice(1));
      yield* hopTo(c, Object.assign({ from: cur }, GROUND2));
      yield* c.walkToTile(90);
      yield* hopSeq(c, Object.assign({}, GROUND2, { w: 7 }), C, function* (i) { yield* c.until(() => c.other.onGround && c.other.x > (C[Math.min(i + 1, C.length - 1)].tx) * TILE - 8, 3000, '(libre)'); });
      yield* hopTo(c, Object.assign({ from: C[2] }, GROUND3));
      cur = yield* hopSeq(c, GROUND3, D, function* (i) { yield* c.until(() => c.other.onGround && c.other.x > (i + 1 < D.length ? D[i + 1].tx : 178) * TILE - 8, 3000, '(libre)'); });
      yield* hopTo(c, Object.assign({ from: cur }, GROUND4));
      yield* c.walkToTile(183);
      yield* c.wait(300);
    },
  ];

  /* 22. Lune -------------------------------------------------------------------------------------------- */
  const LA = [[16, 13], [24, 12], [32, 13], [39, 11], [47, 12], [55, 13], [62, 11], [70, 12]].map(([tx, top]) => ({ tx, w: 1, top }));
  const LG0 = { tx: 1, w: 9 }, LG1 = { tx: 78, w: 41 };
  const LQ = [{ tx: 124, w: 2 }, { tx: 132, w: 1 }, { tx: 139, w: 2 }, { tx: 148, w: 1 }];
  const LG2 = { tx: 155, w: 25 };
  const LD1 = Number(process.env.LD1 || 26), LD2 = Number(process.env.LD2 || 22);
  // mur à tunnel : bas = celui qui reste au pied ; haut = celui qui monte sur la corniche et tient la plaque
  function* wallBottom(c, wallTx, exitTx, gateGroup, settle) {
    yield* standAt(c, wallTx);
    yield* chainLow(c, settle);
    yield* c.until(() => c.G.open[gateGroup], 900, '(plaque de la corniche)');
    yield* c.wait(4);
    yield* c.walkToTile(exitTx);
  }
  function* wallTop(c, wallTx, plateTx, exitTx, delay, gateGroup) {
    yield* mountAt(c, wallTx);
    yield* c.until(() => c.other.vy < 0, 300, '(décollage du bas)');
    yield* c.wait(delay);
    yield* c.hop(1, 16);
    yield* c.land();
    yield* c.walkTo(plateTx * TILE + 4);
    yield* c.until(() => c.other.x > (exitTx - 1) * TILE, 900, '(le bas est passé)');
    yield* c.wait(6);
    yield* c.walkToTile(exitTx + 1);
  }
  S[21] = [
    function* (c) { // joueur 0 : mène sur les pylônes, bas au mur 1, haut au mur 2, tient la plaque du pylône 139
      yield* c.walkToTile(8);
      let cur = yield* hopSeq(c, LG0, LA);
      yield* hopTo(c, Object.assign({ from: cur }, LG1));
      yield* c.walkToTile(86);
      yield* wallBottom(c, 90, 98, 1, 8);
      yield* c.walkToTile(103);
      yield* wallTop(c, 106, 108, 113, LD2, 2);
      yield* c.walkToTile(116);
      yield* c.until(() => c.other.onGround && c.other.x > 112 * TILE, 3000, '(l’autre arrive)');
      yield* hopTo(c, Object.assign({ from: { tx: 78, w: 41 } }, LQ[0]));
      cur = LQ[0];
      cur = yield* hopSeq(c, LQ[0], LQ.slice(1, 3));
      yield* c.walkTo(139 * TILE + 4);                                // plaque c (haut)
      yield* c.until(() => c.G.open[3], 3000, '(plaques tenues)');
      cur = yield* hopSeq(c, LQ[2], [LQ[3]]);
      yield* hopTo(c, Object.assign({ from: cur }, LG2));
      yield* c.walkToTile(176);
      yield* c.wait(300);
    },
    function* (c) { // joueur 1 : suit, haut au mur 1, bas au mur 2, tient la plaque du pylône 124
      yield* c.walkToTile(6);
      yield* c.until(() => c.other.x > 22 * TILE, 3000, '(l’autre avance)');
      let cur = yield* hopSeq(c, LG0, LA, function* (i) { yield* c.until(() => c.other.onGround && c.other.x > (LA[Math.min(i + 1, LA.length - 1)].tx + (i + 1 >= LA.length ? 6 : 0)) * TILE - 8, 3000, '(le pylône suivant est libre)'); });
      yield* c.until(() => c.other.onGround && c.other.x > 80 * TILE, 3000, '(l’autre est au sol)');
      yield* hopTo(c, Object.assign({ from: cur }, LG1));
      yield* c.walkToTile(86);
      yield* wallTop(c, 90, 93, 98, LD1, 1);
      yield* c.land(); yield* c.walkTo(100 * TILE); yield* c.wait(2);       // saute par-dessus l'autre, qui attend
      yield* c.hopTo(106 * TILE - PW - 2, 120);
      yield* c.land();
      yield* wallBottom(c, 106, 113, 2, 8);
      yield* c.walkToTile(114);
      yield* c.until(() => c.other.onGround && c.other.x > 130 * TILE, 3000, '(l’autre est au pylône 2)');
      yield* hopTo(c, Object.assign({ from: { tx: 78, w: 41 } }, LQ[0]));
      yield* c.walkTo(124 * TILE + 4);                                // plaque c (bas)
      yield* c.until(() => c.G.open[3], 3000, '(plaques tenues)');
      yield* c.until(() => c.other.x > 148 * TILE, 3000, '(l’autre est parti)');
      cur = yield* hopSeq(c, LQ[0], LQ.slice(1, 3).map((q, i) => i === 1 ? { tx: 140, w: 1 } : q));
      yield* c.until(() => c.other.onGround && c.other.x > 150 * TILE, 3000, '(libre)');
      yield* hopSeq(c, { tx: 139, w: 2 }, [LQ[3]]);
      yield* hopTo(c, Object.assign({ from: LQ[3] }, LG2));
      yield* c.walkToTile(172);
      yield* c.wait(300);
    },
  ];

  /* 23. Plomb -------------------------------------------------------------------------------------------- */
  const PA = [[13, 15], [17, 15], [21, 14], [25, 14], [29, 15], [33, 14], [37, 13], [41, 14], [45, 15], [49, 15]].map(([tx, top]) => ({ tx, w: 1, top }));
  const PG0 = { tx: 1, w: 9 }, PG1 = { tx: 53, w: 72 };
  const PSTEPS = [{ tx: 77, w: 2 }, { tx: 81, w: 2 }, { tx: 86, w: 2 }, { tx: 90, w: 2 }, { tx: 95, w: 2 }, { tx: 99, w: 20 }];
  const PD = Number(process.env.PD || 10), PW23 = Number(process.env.PW23 || 8);
  S[22] = [
    function* (c) { // joueur 0 (derrière sur les pylônes) : haut au mur, tient la plaque b, passe la grille C, bas sous la cloche
      yield* c.walkToTile(4);
      yield* c.until(() => c.other.x > 20 * TILE, 3000, '(l’autre avance)');
      let cur = yield* hopSeq(c, PG0, PA, function* (i) { yield* c.until(() => c.other.onGround && c.other.x > (PA[Math.min(i + 1, PA.length - 1)].tx + (i + 1 >= PA.length ? 6 : 0)) * TILE - 8, 3000, '(libre)'); });
      yield* c.until(() => c.other.onGround && c.other.x > 56 * TILE, 3000, '(l’autre est au sol)');
      yield* hopTo(c, Object.assign({ from: cur }, PG1));
      yield* c.walkToTile(58);
      yield* wallTop(c, 62, 65, 70, PD, 1);
      yield* c.walkTo(74 * TILE + 4);                                // plaque b : l’escalier apparaît
      yield* c.until(() => c.G.open[3], 3000, '(plaque c)');
      yield* c.wait(4);
      yield* c.walkToTile(118);
      yield* c.walkTo(121 * TILE + 4);                               // sous la cloche : on est le bas
      yield* chainLow(c, 8);
      yield* c.until(() => c.G.bridge[1] > 0, 200, '(pont)');
      yield* c.walkToTile(150);
      yield* c.walkToTile(174);
      yield* c.wait(300);
    },
    function* (c) { // joueur 1 (devant) : mène, bas au mur, grimpe l’escalier, tient la plaque c, haut sous la cloche
      yield* c.walkToTile(8);
      let cur = yield* hopSeq(c, PG0, PA);
      yield* hopTo(c, Object.assign({ from: cur }, PG1));
      yield* c.walkToTile(58);
      yield* wallBottom(c, 62, 70, 1, 8);
      yield* c.walkTo(75 * TILE + 8);
      yield* c.until(() => c.G.open[2], 3000, '(plaque b tenue)');
      yield* hopSeq(c, { tx: 76, w: 0 }, PSTEPS);
      yield* c.walkTo(110 * TILE + 4);                               // plaque c
      yield* c.until(() => c.other.x > 116 * TILE, 3000, '(l’autre est passé sous la grille)');
      yield* c.wait(6);
      yield* c.walkToTile(120);
      yield* c.land();
      yield* c.walkToTile(119);
      yield* c.until(() => Math.abs(c.other.x - (121 * TILE + 4)) < 3 && c.other.onGround, 900, '(bas en place)');
      yield* chainTopRing(c, PW23);
      yield* c.until(() => c.G.bridge[1] > 0, 200, '(pont)');
      yield* c.land();
      yield* c.walkToTile(150);
      yield* c.walkToTile(170);
      yield* c.wait(300);
    },
  ];

  /* 24. Serrures ----------------------------------------------------------------------------------------- */
  const SD = Number(process.env.SD || 15);
  const beltPits = [[111, 4], [129, 4], [147, 5]];
  S[23] = [
    function* (c) { // joueur 0 : tient la plaque a, grimpe l’escalier, saute par-dessus z, monte sur la plate-forme et bascule z (haut)
      yield* c.walkTo(14 * TILE + 4);
      yield* c.until(() => c.G.open[2], 3000, '(interrupteur y)');
      yield* c.walkTo(16 * TILE);
      for (const [tx, from] of [[17, 16 * TILE], [19, 19 * TILE - PW - 6], [21, 21 * TILE - PW - 6]]) { yield* c.walkTo(from, 2); yield* c.hopTo(tx * TILE + 4, 90); yield* c.land(); yield* c.wait(2); }
      yield* c.walkTo(23 * TILE - 1);
      yield* c.hopTo(24 * TILE + 4, 90); yield* c.land();
      yield* c.walkToTile(27);
      yield* c.walkToTile(31);
      yield* c.land();
      yield* c.walkToTile(43);
      yield* c.until(() => c.G.open[3] && c.other.x > 51 * TILE, 3000, '(z du bas)');
      yield* c.walkTo(47 * TILE, 2);
      yield* c.hopTo(51 * TILE + 4, 90); yield* c.land();            // on saute par-dessus z
      yield* c.walkToTile(56);
      yield* mountAt(c, 58);
      yield* c.until(() => c.other.vy < 0, 300, '(décollage du bas)');
      yield* c.wait(SD);
      yield* c.hop(1, 16);
      yield* c.land();
      yield* c.walkTo(60 * TILE + 4);                                // z (haut) : g3 inactif
      yield* c.until(() => !c.G.open[3], 120, '(bascule)');
      yield* c.walkToTile(63);
      yield* c.walkToTile(66);
      yield* c.land();
      yield* c.walkToTile(72);
      yield* c.walkToTile(94);
      for (const [tx, w] of beltPits) { yield* c.walkTo(tx * TILE - (w > 4 ? 3 : PW), 2); yield* c.hopTo((tx + w) * TILE + 4, 90); yield* c.land(); }
      yield* c.walkToTile(169);
      yield* c.wait(300);
    },
    function* (c) { // joueur 1 : passe la grille, bascule y, bascule z (bas), reste le bas sous la plate-forme
      yield* c.walkTo(10 * TILE);
      yield* c.until(() => c.G.open[1], 3000, '(plaque a tenue)');
      yield* c.hopTo(16 * TILE + 4, 90); yield* c.land();
      yield* c.walkToTile(30);
      yield* c.walkToTile(33);                                       // y : l’escalier apparaît
      yield* c.walkToTile(37);
      yield* c.until(() => c.other.x > 31 * TILE && c.other.onGround, 3000, '(l’autre est passé)');
      yield* c.walkToTile(50);                                       // z (bas) : g3 actif
      yield* c.walkToTile(56);
      yield* standAt(c, 58);
      yield* chainLow(c, 8);
      yield* c.until(() => !c.G.open[3], 600, '(z du haut)');
      yield* c.walkToTile(72);
      yield* c.until(() => c.other.x > 90 * TILE, 3000, '(l’autre avance)');
      yield* c.walkToTile(94);
      for (const [tx, w] of beltPits) {
        yield* c.until(() => c.other.onGround && c.other.x > (tx + w) * TILE, 3000, '(libre)');
        yield* c.walkTo(tx * TILE - (w > 4 ? 3 : PW), 2); yield* c.hopTo((tx + w) * TILE + 4, 90); yield* c.land();
      }
      yield* c.walkToTile(166);
      yield* c.wait(300);
    },
  ];

  /* 25. Relais ------------------------------------------------------------------------------------------- */
  const RW = Number(process.env.RW || 10);
  const RP = [[100, 13], [105, 12], [110, 13], [115, 13], [120, 12], [125, 13]].map(([tx, top]) => ({ tx, w: 1, top }));
  const RG1 = { tx: 82, w: 14 }, RG2 = { tx: 130, w: 16 };
  function* jumpRing(c) { yield* c.jump(); yield* c.wait(14); }
  function* aheadPart(c) {   // devant à partir de la cloche v : bas, mène les pylônes, passe le premier le grand pont, sonne w, bas encore
    yield* c.walkTo(62 * TILE + 4);
    yield* chainLow(c, 8);
    yield* c.until(() => c.G.bridge[2] > 0, 120, '(pont)');
    yield* c.walkToTile(84);
    let cur = yield* hopSeq(c, RG1, RP);
    yield* hopTo(c, Object.assign({ from: cur }, RG2));
    yield* c.walkTo(145 * TILE + 4);                               // au bord du grand pont
    yield* c.until(() => c.G.bridge[3] > 0, 3000, '(pont O)');
    yield* c.walkToTile(172);
    yield* c.walkTo(173 * TILE + 4);
    yield* jumpRing(c);                                            // ressort : on sonne pour rappeler l’autre
    yield* c.land();
    yield* c.walkTo(182 * TILE + 4);
    yield* chainLow(c, 8);
    yield* c.until(() => c.G.bridge[1] > 0, 120, '(dernière porte)');
    yield* c.walkToTile(197);
    yield* c.walkTo(199 * TILE - PW, 2); yield* c.hopTo(203 * TILE + 4, 90); yield* c.land();
    yield* c.walkToTile(211);
    yield* c.wait(300);
  }
  function* behindPart(c) {  // derrière : haut à la cloche v, suit les pylônes, sonne la cloche w (ressort), traverse en second
    yield* c.walkToTile(58);
    yield* c.until(() => Math.abs(c.other.x - (62 * TILE + 4)) < 3 && c.other.onGround, 3000, '(bas en place)');
    yield* chainTopRing(c, RW);
    yield* c.until(() => c.G.bridge[2] > 0, 120, '(pont)');
    yield* c.land();
    yield* c.wait(14);
    yield* c.walkToTile(83);
    yield* c.until(() => c.other.x > 100 * TILE, 3000);
    let cur = yield* hopSeq(c, RG1, RP, function* (i) { yield* c.until(() => c.other.onGround && c.other.x > (RP[Math.min(i + 1, RP.length - 1)].tx + (i + 1 >= RP.length ? 6 : 0)) * TILE - 8, 3000, '(libre)'); });
    yield* c.until(() => c.other.onGround && c.other.x > 132 * TILE, 3000, '(l’autre est au sol)');
    yield* hopTo(c, Object.assign({ from: cur }, RG2));
    yield* c.walkTo(141 * TILE + 4);                               // sur le ressort, sous la cloche w
    yield* c.until(() => c.other.x > 144 * TILE, 3000, '(l’autre est au bord)');
    yield* jumpRing(c);
    yield* c.land();
    yield* c.walkTo(145 * TILE + 4);
    yield* c.until(() => c.other.x > 168 * TILE, 3000, '(l’autre a traversé)');
    yield* c.until(() => c.G.bridge[3] > 225, 3000, '(pont rappelé)');
    yield* c.walkToTile(171);
    yield* c.walkToTile(178);
    yield* c.until(() => Math.abs(c.other.x - (182 * TILE + 4)) < 3 && c.other.onGround, 3000, '(bas en place)');
    yield* chainTopRing(c, RW);
    yield* c.until(() => c.G.bridge[1] > 0, 120, '(dernière porte)');
    yield* c.land();
    yield* c.wait(14);
    yield* c.walkToTile(196);
    yield* c.until(() => c.other.onGround && c.other.x > 203 * TILE, 3000, '(libre)');
    yield* c.walkTo(199 * TILE - PW, 2); yield* c.hopTo(203 * TILE + 4, 90); yield* c.land();
    yield* c.walkToTile(208);
    yield* c.wait(300);
  }
  S[24] = [
    function* (c) { // joueur 0 : bas à la cloche u, puis derrière
      yield* c.walkTo(30 * TILE + 4);
      yield* chainLow(c, 8);
      yield* c.until(() => c.G.bridge[1] > 0, 120, '(porte)');
      yield* c.walkToTile(48);
      yield* behindPart(c);
    },
    function* (c) { // joueur 1 : haut à la cloche u, puis devant
      yield* c.walkToTile(26);
      yield* c.until(() => Math.abs(c.other.x - (30 * TILE + 4)) < 3 && c.other.onGround, 3000, '(bas en place)');
      yield* chainTopRing(c, RW);
      yield* c.until(() => c.G.bridge[1] > 0, 120, '(porte)');
      yield* c.land();
      yield* c.walkToTile(50);
      yield* aheadPart(c);
    },
  ];

  /* 26. Portails croisés ------------------------------------------------------------------------------- */
  const GP = [[129, 13], [134, 12], [139, 13], [144, 13], [149, 12], [154, 13], [159, 12], [164, 13]].map(([tx, top]) => ({ tx, w: 1, top }));
  const GPG0 = { tx: 121, w: 5 }, GPG1 = { tx: 169, w: 21 };
  function* through(c, dir, cond) { for (let k = 0; k < 400 && !cond(); k++) yield* c.hold(dir, 1); if (!cond()) throw new Error('bot ' + c.i + ' : le portail ne répond pas'); }
  S[25] = [
    function* (c) { // joueur 0 : chambre 1 (plaque a), puis la petite plaque de la grande chambre ; mène les pylônes
      yield* c.walkToTile(12);
      yield* through(c, 1, () => c.me.y < 10 * TILE);                // portail k
      yield* c.walkTo(42 * TILE + 4);                                // plaque a : la grille A s’ouvre
      yield* c.until(() => c.G.open[2], 3000, '(trappe B)');
      yield* c.walkToTile(45);                                       // on tombe par la trappe
      yield* c.land();
      yield* c.walkTo(65 * TILE);
      yield* c.hopTo(71 * TILE + 4, 90); yield* c.land();            // par-dessus le portail l
      yield* c.until(() => c.other.y < 10 * TILE && c.other.x > 92 * TILE, 3000, '(l’autre est dans la grande chambre)');
      yield* c.walkToTile(78);
      yield* through(c, 1, () => c.me.y < 10 * TILE);                // portail m
      yield* c.walkTo(93 * TILE + 4);                                // petite plaque c
      yield* c.until(() => c.G.open[3], 3000, '(plaques c)');
      yield* c.walkToTile(91);
      yield* through(c, -1, () => c.me.y > 10 * TILE);               // retour par le portail m
      yield* c.walkToTile(124);
      let cur = yield* hopSeq(c, GPG0, GP);
      yield* hopTo(c, Object.assign({ from: cur }, GPG1));
      yield* c.walkToTile(181);
      yield* c.wait(300);
    },
    function* (c) { // joueur 1 : chambre 2 (plaque b), puis la grande plaque c
      yield* c.walkTo(11 * TILE);
      yield* c.until(() => c.G.open[1], 3000, '(plaque a tenue)');
      yield* c.hopTo(16 * TILE + 4, 90); yield* c.land();           // on saute par-dessus le portail k
      yield* c.walkToTile(66);
      yield* through(c, 1, () => c.me.y < 10 * TILE);                // portail l
      yield* c.walkTo(58 * TILE + 4);                                // plaque b : la trappe B s’ouvre
      yield* c.until(() => c.other.y > 10 * TILE && c.other.onGround, 3000, '(l’autre est tombé)');
      yield* c.wait(10);
      yield* c.walkToTile(56);
      yield* through(c, -1, () => c.me.y > 10 * TILE);               // retour par le portail l
      yield* c.walkToTile(78);
      yield* through(c, 1, () => c.me.y < 10 * TILE);                // portail m
      yield* c.walkTo(107 * TILE + 4);                               // grande plaque c
      yield* c.until(() => c.G.open[3], 3000, '(plaques c)');
      yield* c.until(() => c.other.y > 10 * TILE || c.other.x < 91 * TILE, 3000, '(l’autre est parti)');
      yield* c.walkToTile(91);
      yield* through(c, -1, () => c.me.y > 10 * TILE);
      yield* c.walkToTile(124);
      yield* c.until(() => c.other.onGround && c.other.x > 128 * TILE, 3000, '(l’autre mène)');
      let cur = yield* hopSeq(c, GPG0, GP, function* (i) { yield* c.until(() => c.other.onGround && c.other.x > (GP[Math.min(i + 1, GP.length - 1)].tx + (i + 1 >= GP.length ? 6 : 0)) * TILE - 8, 3000, '(libre)'); });
      yield* c.until(() => c.other.onGround && c.other.x > 170 * TILE, 3000, '(l’autre est au sol)');
      yield* hopTo(c, Object.assign({ from: cur }, GPG1));
      yield* c.walkToTile(178);
      yield* c.wait(300);
    },
  ];

  /* 27. Marée -------------------------------------------------------------------------------------------- */
  S[26] = [
    function* (c) { // joueur 0 : tient la plaque a, puis ressort, grille B et passerelle
      yield* c.walkTo(10 * TILE + 4);
      yield* c.until(() => c.other.x > 159 * TILE, 3000, '(l’autre est au bout)');
      yield* c.walkTo(3 * TILE + 4);
      yield* c.wait(6);
      yield* c.hopTo(8 * TILE + 4, 150); yield* c.land();            // ressort → corniche
      yield* c.walkTo(13 * TILE);
      yield* c.until(() => c.G.open[2], 3000, '(grille B)');
      yield* c.walkToTile(15);
      for (let k = 0; k < 9; k++) {
        const c0 = 15 + 16 * k;
        yield* c.walkTo((c0 + 3) * TILE - PW, 2);
        yield* c.hopTo((c0 + 7) * TILE + 4, 90);
        yield* c.land();
        yield* c.walkToTile(c0 + 14);
      }
      yield* c.walkToTile(158);
      yield* c.walkToTile(172);
      yield* c.wait(300);
    },
    function* (c) { // joueur 1 : emporté par les tapis, tient la plaque b
      yield* c.until(() => c.G.open[1], 3000, '(plaque a)');
      yield* c.walkToTile(159);
      yield* c.walkTo(161 * TILE);
      yield* c.hopTo(163 * TILE + 4, 90); yield* c.land();           // sur la corniche, plaque b
      yield* c.until(() => c.other.x > 158 * TILE, 4000, '(l’autre est arrivé)');
      yield* c.walkToTile(166);
      yield* c.walkToTile(175);
      yield* c.wait(300);
    },
  ];

  /* 28. Les quatre épreuves ---------------------------------------------------------------------------- */
  const QP = [[13, 1], [18, 1], [23, 1], [28, 1], [33, 2], [40, 1], [45, 1], [50, 1]].map(([tx, w]) => ({ tx, w }));
  const QG0 = { tx: 1, w: 9 }, QG1 = { tx: 55, w: 28 }, QG2 = { tx: 112, w: 60 };
  const QB = [{ tx: 86, w: 2 }, { tx: 91, w: 1 }, { tx: 96, w: 2 }, { tx: 102, w: 1 }, { tx: 107, w: 1 }];
  const QD = Number(process.env.QD || 15);
  S[27] = [
    function* (c) { // joueur 0 : mène les pylônes, bas du mur, puis tient la plaque du 1er pylône, saute par-dessus z, haut sous le sas
      yield* c.walkToTile(8);
      let cur = yield* hopSeq(c, QG0, QP);
      yield* hopTo(c, Object.assign({ from: cur }, QG1));
      yield* c.walkToTile(62);
      yield* wallBottom(c, 66, 74, 1, 8);
      // rush : plaque sur le pylône 86
      yield* c.until(() => c.other.onGround && c.other.x > 80 * TILE, 3000, '(l’autre prend la tête)');
      yield* c.until(() => c.other.onGround && Math.abs(c.other.x - (96 * TILE + 4)) < 2, 3000, '(l’autre est sur la plaque)');
      yield* c.walkToTile(80);
      cur = yield* hopSeq(c, QG1, [QB[0]]);
      yield* c.walkTo(86 * TILE + 4);                                // plaque b
      yield* c.until(() => c.G.open[2], 3000, '(plaques tenues)');
      cur = yield* hopSeq(c, QB[0], QB.slice(1));
      yield* hopTo(c, Object.assign({ from: cur }, QG2));
      // sas : on saute par-dessus z (bas), puis haut sur la plate-forme
      yield* c.walkToTile(118);
      yield* c.until(() => c.G.open[3] && c.other.x > 126 * TILE, 3000, '(z du bas)');
      yield* c.walkTo(122 * TILE, 2);
      yield* c.hopTo(126 * TILE + 4, 90); yield* c.land();
      yield* c.walkToTile(131);
      yield* mountAt(c, 133);
      yield* c.until(() => c.other.vy < 0, 300, '(décollage du bas)');
      yield* c.wait(QD);
      yield* c.hop(1, 16);
      yield* c.land();
      yield* c.walkTo(135 * TILE + 4);                               // z (haut)
      yield* c.until(() => !c.G.open[3], 120, '(bascule)');
      yield* c.walkToTile(138);
      yield* c.walkToTile(141);
      yield* c.land();
      yield* c.walkToTile(147);
      yield* c.walkToTile(163);
      yield* c.wait(300);
    },
    function* (c) { // joueur 1 : suit, haut du mur, mène le rush (plaque du pylône 96), presse z (bas), bas sous le sas
      yield* c.walkToTile(6);
      yield* c.until(() => c.other.x > 20 * TILE, 3000, '(l’autre avance)');
      let cur = yield* hopSeq(c, QG0, QP, function* (i) { yield* c.until(() => c.other.onGround && c.other.x > (QP[Math.min(i + 1, QP.length - 1)].tx + (i + 1 >= QP.length ? 6 : 0)) * TILE - 8, 3000, '(le pylône suivant est libre)'); });
      yield* c.until(() => c.other.onGround && c.other.x > 57 * TILE, 3000, '(l’autre est au sol)');
      yield* hopTo(c, Object.assign({ from: cur }, QG1));
      yield* c.walkToTile(60);
      yield* wallTop(c, 66, 69, 74, QD, 1);
      yield* c.walkToTile(80);
      cur = yield* hopSeq(c, QG1, QB.slice(0, 3));
      yield* c.walkTo(96 * TILE + 4);                                // plaque b (pylône 96)
      yield* c.until(() => c.G.open[2], 3000, '(plaques tenues)');
      cur = yield* hopSeq(c, QB[2], QB.slice(3));
      yield* c.until(() => c.other.x > 100 * TILE, 3000);
      yield* hopTo(c, Object.assign({ from: cur }, QG2));
      yield* c.walkToTile(123);
      yield* c.walkToTile(125);                                      // z (bas) : g3 actif
      yield* c.walkToTile(131);
      yield* standAt(c, 133);
      yield* chainLow(c, 8);
      yield* c.until(() => !c.G.open[3], 600, '(z du haut)');
      yield* c.walkToTile(147);
      yield* c.walkToTile(160);
      yield* c.wait(300);
    },
  ];

  /* 29. Cordée ------------------------------------------------------------------------------------------- */
  const CW = Number(process.env.CW || 9);
  const CB = [{ tx: 95, w: 2 }, { tx: 100, w: 1 }, { tx: 105, w: 2 }, { tx: 111, w: 1 }, { tx: 116, w: 1 }];
  const CG0 = { tx: 87, w: 5 }, CG2 = { tx: 121, w: 15 }, CG3 = { tx: 176, w: 15 };
  const CP = [140, 145, 150, 155, 160, 165, 170].map((tx) => ({ tx, w: 1 }));
  S[28] = [
    function* (c) { // joueur 0 : grimpe l’escalier fantôme, tient la plaque c ; haut sous la cloche ; suit le rush ; suit les pylônes
      yield* c.walkTo(15 * TILE - 6);
      yield* c.until(() => c.G.open[2], 3000, '(plaque b)');
      yield* c.hopTo(16 * TILE + 4, 90); yield* c.land();
      yield* hopSeq(c, { tx: 16, w: 2 }, [{ tx: 21, w: 2 }, { tx: 27, w: 20 }]);
      yield* c.walkTo(38 * TILE + 4);                                // plaque c
      yield* c.until(() => c.other.x > 43 * TILE, 3000, '(l’autre est passé sous la grille)');
      yield* c.wait(6);
      yield* c.walkToTile(48);
      yield* c.land();
      yield* c.walkToTile(58);
      yield* c.until(() => Math.abs(c.other.x - (62 * TILE + 4)) < 3 && c.other.onGround, 3000, '(bas en place)');
      yield* chainTopRing(c, CW);
      yield* c.until(() => c.G.bridge[1] > 0, 120, '(porte)');
      yield* c.land();
      yield* c.wait(14);
      yield* c.walkToTile(80);
      yield* c.until(() => c.other.onGround && c.other.x > 87 * TILE, 3000, '(l’autre a franchi la fosse)');
      yield* c.walkTo(82 * TILE - 3, 2); yield* c.hopTo(87 * TILE + 4, 90); yield* c.land();
      // rush : plaque du 1er pylône
      yield* c.walkToTile(90);
      yield* c.until(() => c.other.onGround && Math.abs(c.other.x - (105 * TILE + 4)) < 2, 3000, '(l’autre est sur la plaque)');
      yield* hopSeq(c, CG0, [CB[0]]);
      yield* c.walkTo(95 * TILE + 4);
      yield* c.until(() => c.G.open[1], 3000, '(plaques tenues)');
      let cur = yield* hopSeq(c, CB[0], CB.slice(1));
      yield* hopTo(c, Object.assign({ from: cur }, CG2));
      yield* c.walkToTile(130);
      yield* c.until(() => c.other.onGround && c.other.x > 142 * TILE, 3000, '(l’autre mène les pylônes)');
      cur = yield* hopSeq(c, CG2, CP, function* (i) { yield* c.until(() => c.other.onGround && c.other.x > (CP[Math.min(i + 1, CP.length - 1)].tx + (i + 1 >= CP.length ? 6 : 0)) * TILE - 8, 3000, '(libre)'); });
      yield* c.until(() => c.other.onGround && c.other.x > 177 * TILE, 3000, '(l’autre est au sol)');
      yield* hopTo(c, Object.assign({ from: cur }, CG3));
      yield* c.walkToTile(182);
      yield* c.wait(300);
    },
    function* (c) { // joueur 1 : tient la plaque b, passe la grille, bas sous la cloche, mène le rush (plaque du 3e pylône) et les pylônes
      yield* c.walkTo(12 * TILE + 4);                                // plaque b : l’escalier apparaît
      yield* c.until(() => c.G.open[3], 3000, '(plaque c)');
      yield* c.wait(4);
      yield* c.walkToTile(48);
      yield* c.walkTo(62 * TILE + 4);
      yield* chainLow(c, 8);
      yield* c.until(() => c.G.bridge[1] > 0, 120, '(porte)');
      yield* c.walkToTile(80);
      yield* c.walkTo(82 * TILE - 3, 2); yield* c.hopTo(87 * TILE + 4, 90); yield* c.land();
      yield* c.walkToTile(90);
      let cur = yield* hopSeq(c, CG0, CB.slice(0, 3));
      yield* c.walkTo(105 * TILE + 4);                               // plaque a (3e pylône)
      yield* c.until(() => c.G.open[1], 3000, '(plaques tenues)');
      cur = yield* hopSeq(c, CB[2], CB.slice(3));
      yield* hopTo(c, Object.assign({ from: cur }, CG2));
      yield* c.walkToTile(135);
      cur = yield* hopSeq(c, CG2, CP);
      yield* hopTo(c, Object.assign({ from: cur }, CG3));
      yield* c.walkToTile(185);
      yield* c.wait(300);
    },
  ];

  /* 30. Apothéose ---------------------------------------------------------------------------------------- */
  const AP = [[89, 13], [94, 13], [99, 12], [104, 11], [110, 11], [115, 12], [120, 12], [125, 13]].map(([tx, top]) => ({ tx, w: 1, top }));
  const AG0 = { tx: 1, w: 84 }, AG1 = { tx: 130, w: 16 };
  S[29] = [
    function* (c) { // joueur 0 : chambre 1, mène les pylônes, passe le premier le grand pont, bas du sas
      yield* c.walkToTile(12);
      yield* through(c, 1, () => c.me.y < 10 * TILE);                // portail k
      yield* c.walkTo(42 * TILE + 4);                                // plaque a
      yield* c.until(() => c.G.open[2], 3000, '(trappe B)');
      yield* c.walkToTile(45);
      yield* c.land();
      yield* c.walkTo(65 * TILE);
      yield* c.hopTo(71 * TILE + 4, 90); yield* c.land();            // par-dessus le portail l
      yield* c.walkToTile(80);
      yield* H.relayP0(c);                                           // canon, barque
      yield* c.walkTo(145 * TILE + 4);                               // au bord du grand pont
      yield* c.until(() => c.G.bridge[3] > 0, 3000, '(pont O)');
      yield* c.walkToTile(172);
      yield* c.walkTo(173 * TILE + 4);
      yield* jumpRing(c);                                            // ressort : on sonne pour rappeler l’autre
      yield* c.land();
      yield* c.walkToTile(183);
      yield* c.walkToTile(185);                                      // z (bas) : g3 actif
      yield* c.walkToTile(191);
      yield* standAt(c, 193);
      yield* chainLow(c, 8);
      yield* c.until(() => !c.G.open[3], 600, '(z du haut)');
      yield* c.walkToTile(207);
      yield* c.until(() => c.other.onGround && c.other.x > 214 * TILE, 3000, '(l’autre a franchi)');
      yield* c.walkTo(209 * TILE - 3, 2); yield* c.hopTo(214 * TILE + 4, 90); yield* c.land();
      yield* c.walkToTile(222);
      yield* c.wait(300);
    },
    function* (c) { // joueur 1 : chambre 2, suit les pylônes, sonne la cloche (ressort), haut du sas, mène la dernière fosse
      yield* c.walkTo(11 * TILE);
      yield* c.until(() => c.G.open[1], 3000, '(plaque a tenue)');
      yield* c.hopTo(16 * TILE + 4, 90); yield* c.land();            // par-dessus le portail k
      yield* c.walkToTile(66);
      yield* through(c, 1, () => c.me.y < 10 * TILE);                // portail l
      yield* c.walkTo(58 * TILE + 4);                                // plaque b
      yield* c.until(() => c.other.y > 10 * TILE && c.other.onGround, 3000, '(l’autre est tombé)');
      yield* c.wait(10);
      yield* c.walkToTile(56);
      yield* through(c, -1, () => c.me.y > 10 * TILE);               // retour par le portail l
      yield* c.walkToTile(69);
      yield* H.relayP1(c);                                           // canon, barque
      yield* c.walkTo(141 * TILE + 4);                               // ressort, sous la cloche w
      yield* c.until(() => c.other.x > 144 * TILE, 3000, '(l’autre est au bord)');
      yield* jumpRing(c);
      yield* c.land();
      yield* c.walkTo(145 * TILE + 4);
      yield* c.until(() => c.other.x > 168 * TILE, 3000, '(l’autre a traversé)');
      yield* c.until(() => c.G.bridge[3] > 235, 3000, '(pont rappelé)');
      yield* c.walkToTile(171);
      yield* c.walkToTile(180);
      yield* c.until(() => c.G.open[3] && c.other.x > 186 * TILE, 3000, '(z du bas)');
      yield* c.walkTo(182 * TILE, 2);
      yield* c.hopTo(186 * TILE + 4, 90); yield* c.land();
      yield* c.walkToTile(191);
      yield* mountAt(c, 193);
      yield* c.until(() => c.other.vy < 0, 300, '(décollage du bas)');
      yield* c.wait(SD);
      yield* c.hop(1, 16);
      yield* c.land();
      yield* c.walkTo(195 * TILE + 4);                               // z (haut)
      yield* c.until(() => !c.G.open[3], 120, '(bascule)');
      yield* c.walkToTile(198);
      yield* c.walkToTile(201);
      yield* c.land();
      yield* c.walkToTile(207);
      yield* c.walkTo(209 * TILE - 3, 2); yield* c.hopTo(214 * TILE + 4, 90); yield* c.land();
      yield* c.walkToTile(226);
      yield* c.wait(300);
    },
  ];
};
