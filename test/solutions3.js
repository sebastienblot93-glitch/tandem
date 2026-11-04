// Solutions des niveaux remaniés (ascenseurs, barques, canons) : 21, 28, 29, 30
const { TILE, PW, PH } = require('./harness');
module.exports = function (S, H) {
  const T = TILE;
  const onLift = (c, k, p = c.other) => p.onGround && Math.abs(p.y + PH - (c.G.L.lifts[k].y0 + c.G.L.lifts[k].sg * c.G.lift[k])) < 0.5;
  const atEnd = (c, k) => c.G.lift[k] >= c.G.L.lifts[k].total;
  const atHome = (c, k) => c.G.lift[k] === 0;

  // ---- Apothéose : canon (îlot 1 → îlot 2) puis barque (îlot 2 → îlot 3) ----------------------------------------
  H.relayP0 = function* (c) {
    yield* c.walkToTile(87);
    yield* c.until(() => c.G.open[1], 3000, '(plaque a tenue)');
    yield* c.walkToTile(88);                                       // canon
    yield* c.until(() => c.me.onGround && c.me.x > 97 * T, 600, '(atterri sur l’îlot 2)');
    yield* c.walkToTile(100);                                      // plaque d'appel du canon
    yield* c.until(() => c.other.onGround && c.other.x > 97 * T && c.other.x < 100 * T, 900, '(l’autre est arrivé)');
    yield* c.walkToTile(103);
    yield* c.until(() => atHome(c, 0), 900, '(barque revenue)');
    yield* c.walkToTile(110);                                      // à bord
    yield* c.until(() => atEnd(c, 0), 1500, '(barque à l’îlot 3)');
    yield* c.walkToTile(122);                                      // je descends sur l'îlot 3, sans toucher la plaque
    yield* c.until(() => c.other.onGround && c.other.x > 109 * T && c.other.x < 111 * T && atHome(c, 0), 2400, '(l’autre est à bord)');
    yield* c.walkToTile(124);                                      // plaque d'appel de la barque
    yield* c.until(() => c.other.onGround && c.other.x > 122 * T, 2400, '(l’autre a traversé)');
  };
  H.relayP1 = function* (c) {
    yield* c.until(() => c.other.x > 85 * T, 3000, '(l’autre mène)');
    yield* c.walkToTile(86);                                       // plaque a
    yield* c.until(() => c.other.onGround && c.other.x > 100 * T - 4 && c.other.x < 101 * T, 3000, '(l’autre tient la plaque d’appel)');
    yield* c.walkToTile(87);
    yield* c.walkToTile(88);                                       // canon
    yield* c.until(() => c.me.onGround && c.me.x > 97 * T, 600, '(atterri sur l’îlot 2)');
    yield* c.until(() => c.other.onGround && c.other.x > 109 * T && c.other.x < 111 * T, 1500, '(l’autre est à bord)');
    yield* c.walkToTile(105);                                      // plaque d'appel de la barque
    yield* c.until(() => atEnd(c, 0) && c.other.x > 122 * T && c.other.onGround, 1800, '(l’autre a traversé)');
    yield* c.walkToTile(103);                                      // je lâche : la barque revient
    yield* c.until(() => atHome(c, 0), 1800, '(barque revenue)');
    yield* c.walkToTile(110);
    yield* c.until(() => atEnd(c, 0), 1800, '(barque à l’îlot 3)');
    yield* c.walkToTile(123);
  };

  /* 21. Monte-charge --------------------------------------------------------------------------------------- */
  const L21 = [
    function* (c) { // monte le premier, puis tient la plaque du haut
      yield* c.walkToTile(10);
      yield* c.until(() => atEnd(c, 0), 1200, '(ascenseur en haut)');
      yield* c.walkToTile(15);                                         // il lâche tout : l'ascenseur redescend
      yield* c.until(() => atHome(c, 0) && c.other.onGround && c.other.x > 10 * T - 2 && c.other.x < 11 * T, 1200, '(l’autre est sur l’ascenseur)');
      yield* c.walkToTile(13);                                         // plaque du haut : l'ascenseur remonte avec l'autre
      yield* c.until(() => atEnd(c, 0), 1200, '(ascenseur en haut, 2)');
      yield* c.until(() => c.other.x > 11 * T + 10, 600, '(l’autre est descendu de l’ascenseur)');
      yield* c.walkToTile(24);
      // barque : l'autre tient la plaque (22,7), je monte à bord
      yield* c.until(() => atHome(c, 1), 600, '(barque revenue)');
      yield* c.walkToTile(26);
      yield* c.until(() => atEnd(c, 1), 1500, '(barque à droite)');
      yield* c.walkToTile(45);
      yield* c.until(() => c.other.x > 25 * T && c.other.x < 27 * T && atHome(c, 1), 1500, '(l’autre est à bord)');
      yield* c.walkToTile(43);                                         // plaque de la rive droite : la barque l'amène
      yield* c.until(() => atEnd(c, 1) && c.other.x > 41 * T, 1500, '(l’autre a débarqué)');
      yield* c.walkToTile(68);
      yield* c.wait(200);
    },
    function* (c) { // tient la plaque du bas, monte en second
      yield* c.until(() => c.other.x > 9 * T, 600, '(l’autre est sur l’ascenseur)');
      yield* c.walkToTile(7);                                          // plaque (7,16)
      yield* c.until(() => c.other.y < 7 * T + 100 && c.other.x > 12 * T, 1500, '(l’autre est en haut, hors de l’ascenseur)');
      yield* c.walkToTile(8);
      yield* c.until(() => atHome(c, 0), 1500, '(ascenseur redescendu)');
      yield* c.walkToTile(10);
      yield* c.until(() => atEnd(c, 0), 1500, '(ascenseur en haut)');
      yield* c.walkToTile(12);
      yield* c.until(() => c.other.x > 25 * T && c.other.x < 27 * T && atHome(c, 1), 1500, '(l’autre est à bord)');
      yield* c.walkToTile(22);                                         // plaque de la barque (22,7)
      yield* c.until(() => atEnd(c, 1) && c.other.x > 41 * T, 2000, '(l’autre a traversé)');
      yield* c.walkToTile(21);                                         // je lâche la plaque : la barque revient
      yield* c.until(() => atHome(c, 1), 1500, '(barque revenue)');
      yield* c.walkToTile(26);
      yield* c.until(() => atEnd(c, 1), 1500, '(barque à droite, 2)');
      yield* c.walkToTile(42);
      yield* c.until(() => c.other.x > 44 * T, 1500);
      yield* c.walkToTile(66);
      yield* c.wait(200);
    },
  ];
  S[20] = [L21[1], L21[0]];          // le joueur 2 (départ à droite) monte le premier

  /* 28. Catapulte ------------------------------------------------------------------------------------------ */
  // tireur : attend que le groupe g soit actif, puis entre dans le canon (par la gauche) et attend d'atterrir à x > landX
  function* shoot(c, g, tx, landX) {
    yield* c.walkToTile(tx - 1);
    yield* c.until(() => c.G.open[g], 1800, `(groupe ${g} actif)`);
    yield* c.walkToTile(tx);
    yield* c.until(() => c.me.onGround && c.me.x > landX, 600, '(atterrissage)');
  }
  S[27] = [
    function* (c) {
      yield* shoot(c, 1, 8, 17 * T);                                   // A : fosse de 7 cases
      yield* c.walkToTile(21);                                         // plaque d'appel de l'îlot 2
      yield* c.until(() => c.other.onGround && c.other.x > 17 * T && c.other.x < 20 * T && c.other.y > 400, 900, '(l’autre a atterri)');
      yield* c.walkToTile(26);
      yield* shoot(c, 2, 27, 31 * T);                                  // B : corniche de 7 cases
      yield* c.walkToTile(34);
      yield* c.until(() => c.other.onGround && c.other.x > 31 * T && c.other.x < 34 * T && c.other.y < 340, 900, '(l’autre est sur la corniche)');
      yield* c.walkToTile(40);
      yield* shoot(c, 3, 41, 65 * T);                                  // C : double tir
      yield* c.walkToTile(68);
      yield* c.until(() => c.other.onGround && c.other.x > 65 * T && c.other.x < 68 * T, 900, '(l’autre a atterri)');
      yield* c.walkToTile(88);
      yield* c.wait(200);
    },
    function* (c) {
      yield* c.walkToTile(5);                                          // plaque (5,16)
      yield* c.until(() => c.other.onGround && c.other.x > 21 * T - 6 && c.other.x < 22 * T, 1500, '(l’autre est sur la plaque d’appel)');
      yield* c.walkToTile(7);
      yield* c.walkToTile(8);                                          // tir
      yield* c.until(() => c.me.onGround && c.me.x > 17 * T, 600, '(atterrissage)');
      yield* c.until(() => c.other.x > 25 * T, 900);
      yield* c.walkToTile(24);                                         // plaque (24,16) : l'autre tire vers la corniche
      yield* c.until(() => c.other.onGround && c.other.x > 31 * T && c.other.y < 340 && c.other.x > 33 * T - 4, 1500, '(l’autre est sur la plaque de la corniche)');
      yield* c.walkToTile(26);
      yield* c.walkToTile(27);
      yield* c.until(() => c.me.onGround && c.me.x > 31 * T, 600, '(corniche)');
      yield* c.until(() => c.other.x > 39 * T, 900);
      yield* c.walkToTile(38);                                         // plaque (38,9)
      yield* c.until(() => c.other.onGround && c.other.x > 65 * T && c.other.x < 69 * T && c.other.x > 67 * T - 4, 1500, '(l’autre est sur la plaque d’arrivée)');
      yield* c.walkToTile(40);
      yield* c.walkToTile(41);                                         // tir
      yield* c.until(() => c.me.onGround && c.me.x > 65 * T, 900, '(atterrissage final)');
      yield* c.walkToTile(86);
      yield* c.wait(200);
    },
  ];

  /* 29. Cordée --------------------------------------------------------------------------------------------- */
  S[28] = [
    function* (c) { // joueur 0 (en haut) : tient la plaque de la barque du bas, traverse ensuite, tient la plaque du canon, saute dans le trou
      yield* c.walkToTile(19);
      yield* c.until(() => c.other.x > 25 * T && c.other.x < 27 * T && c.other.onGround, 1800, '(l’autre est à bord)');
      yield* c.walkToTile(20);                                         // plaque (20,10)
      yield* c.until(() => c.other.onGround && c.other.x > 45 * T && c.other.y > 600, 1800, '(l’autre est de l’autre côté, en bas)');
      yield* c.walkToTile(26);                                         // à bord de la barque du haut
      yield* c.until(() => atEnd(c, 0), 1800, '(barque du haut arrivée)');
      yield* c.walkToTile(47);                                         // plaque du canon (47,10)
      yield* c.until(() => c.other.onGround && c.other.y < 400 && c.other.x > 54 * T && c.other.x < 57 * T, 1500, '(l’autre est monté et tient l’autre plaque)');
      yield* c.walkToTile(49);                                         // je saute dans le trou
      yield* c.until(() => c.me.onGround && c.me.y > 600, 300, '(en bas)');
      yield* c.walkToTile(50);                                         // tir
      yield* c.until(() => c.me.onGround && c.me.y < 400 && c.me.x > 53 * T, 600, '(étage du haut)');
      yield* c.walkToTile(66);
      yield* c.wait(200);
    },
    function* (c) { // joueur 1 (en bas) : monte sur la barque du bas, tient la plaque du haut, tiré par le canon, puis tient l’autre plaque
      yield* c.walkToTile(26);                                         // à bord de la barque du bas
      yield* c.until(() => c.G.open[2] && atEnd(c, 1), 1800, '(barque du bas arrivée)');
      yield* c.walkToTile(45);
      yield* c.until(() => c.other.x > 25 * T && c.other.x < 27 * T && c.other.onGround, 1800, '(l’autre est à bord)');
      yield* c.walkToTile(47);                                         // plaque (47,20) : la barque du haut part
      yield* c.until(() => atEnd(c, 0) && c.other.x > 45 * T, 1800, '(l’autre a débarqué)');
      yield* c.walkToTile(49);
      yield* c.until(() => c.G.open[3], 1800, '(plaque du canon tenue)');
      yield* c.walkToTile(50);                                         // tir
      yield* c.until(() => c.me.onGround && c.me.y < 400 && c.me.x > 53 * T, 600, '(étage du haut)');
      yield* c.walkToTile(56);                                         // plaque (56,10) : tient pour l'autre
      yield* c.until(() => c.other.onGround && c.other.y < 400 && c.other.x > 53 * T, 1500, '(l’autre est monté)');
      yield* c.walkToTile(69);
      yield* c.wait(200);
    },
  ];
};
