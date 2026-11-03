// TANDEM — moteur de jeu partagé (serveur, navigateur, tests). 1 tick = 1/60 s, unités en pixels.
// Les joueurs n'ont AUCUNE capacité : gauche, droite, saut. Tout le reste vient du décor et de l'autre joueur.
(function (root) {
  'use strict';

  const TILE = 32, PW = 24, PH = 28, COLS = 30, ROWS = 15;
  const PHYS = { speed: 4, gravity: 0.5, jump: -9.5, spring: -14.2, maxFall: 12, coyote: 5, buffer: 6 };
  const NCOLORS = 8;       // taille de la palette de personnages (voir render.js)
  const RESPAWN = 50;      // ticks avant de réapparaître après une mort
  const WIN_HOLD = 40;     // ticks pendant lesquels les deux joueurs doivent rester dans leur porte
  const SPIKE = { dx: 6, dy: 18, w: 20, h: 14 };
  const DEFAULT_BELL = { dur: 180, door: false };
  const DEFAULT_RHYTHM = { period: 120, on: 50 };
  const DEFAULT_RSPIKE = { period: 100, on: 46 };      // pics rythmés : phase A = sortis pendant les `on` premiers ticks, phase B = pendant la 2e moitié
  const DEFAULT_FRAG = { delay: 26, restore: 200 };
  const DEFAULT_BELT = { speed: 2, flip: 0 };
  const VENT = { lift: 1.1, max: 4.4 };          // courant d'air : accélération vers le haut et vitesse de montée maximale

  // Légende des niveaux
  //   #  mur                    .  vide
  //   1 2 départ du joueur 1 (bleu) / 2 (orange)
  //   D  porte de sortie (il en faut 2 : un joueur dans chacune, en même temps)
  //   G H I  case de porte qui contient AUSSI une plaque de pression (groupes 1 2 3) : qui se tient dans la porte tient la plaque
  //   ^  pics (réapparition au dernier drapeau validé)
  //   F  drapeau : validé quand les DEUX joueurs l'ont touché
  //   a b c  plaques de pression, groupes 1 2 3. Le groupe est « actif » quand TOUTES ses plaques sont pressées
  //   A B C  grilles : ouvertes tant que le groupe est actif (+ minuterie cfg.latch)
  //   X Y Z  marches fantômes : l'inverse d'une grille, elles n'existent QUE tant que le groupe est actif
  //   u v w  cloches, groupes 1 2 3 : bloc plein que l'on frappe PAR-DESSOUS en sautant.
  //          Elle active pour cfg.bell[g].dur ticks les ponts M N O du même groupe
  //          (ou, si cfg.bell[g].door, elle ouvre pendant ce temps les murs M N O du même groupe)
  //   M N O  ponts (apparaissent) ou murs-portes (disparaissent) des groupes 1 2 3
  //   T      tremplin : sauter DEPUIS lui propulse bien plus haut (environ 6 cases)
  //   < >    tapis roulants : entraînent vers la gauche / la droite (cfg.belt : speed, flip = groupe de plaques qui inverse le sens)
  //   f      dalle fragile : s'effondre cfg.frag.delay ticks après qu'on s'y est posé, revient cfg.frag.restore ticks plus tard
  //   =      plateforme traversante : on la traverse par en dessous, on s'y pose par au-dessus
  //   k l m  portails, groupes 1 2 3 : exactement deux par groupe ; entrer dans l'un fait ressortir par l'autre
  //   x y z  interrupteurs à bascule, groupes 1 2 3 : on les enfonce en marchant dessus, chaque pression change l'état du groupe (ouvre / referme les grilles A B C, souffle les courants P Q R)
  //   P Q R  courants d'air, groupes 1 2 3 : tant que le groupe est actif (plaque tenue ou interrupteur basculé), ils emportent vers le haut
  //   e E    pics rythmés : sortis pendant la phase A (e) ou B (E) de cfg.rspike, rentrés le reste du temps (inoffensifs)
  //   r s    blocs « rythme » : r présent pendant la 1re moitié de la période, s pendant la 2e (cfg.rhythm)
  const GROUP = (ch, set) => set.indexOf(ch) + 1;

  function parseLevel(def) {
    const rows = def.rows;
    const NR = rows.length, NC = rows[0].length;
    rows.forEach((r, i) => { if (r.length !== NC) throw new Error(`${def.name} : ligne ${i} fait ${r.length} caractères (attendu ${NC})`); });
    const cfg = def.cfg || {};
    const n = NC * NR;
    const L = {
      name: def.name, rows, cfg, def, cols: NC, nr: NR, w: NC * TILE, h: NR * TILE,
      spring: new Uint8Array(n), vent: new Uint8Array(n), hasVent: false, ventGroups: [0, 0, 0, 0], conv: new Int8Array(n), oneway: new Uint8Array(n), fragAt: new Uint8Array(n), frags: [], portals: [], hasOneway: false,
      frag: Object.assign({}, DEFAULT_FRAG, cfg.frag || {}), belt: Object.assign({}, DEFAULT_BELT, cfg.belt || {}),
      base: new Uint8Array(n), gateG: new Uint8Array(n), inv: new Uint8Array(n), bridgeG: new Uint8Array(n), bellAt: new Uint8Array(n),
      rhA: new Uint8Array(n), rhB: new Uint8Array(n), dynCells: [],
      plates: [], bells: [], spikes: [], flags: [], doors: [], spawns: [null, null],
      rhythm: Object.assign({}, DEFAULT_RHYTHM, cfg.rhythm || {}), rspike: Object.assign({}, DEFAULT_RSPIKE, cfg.rspike || {}), rspikes: [],
      groupsWithPlates: [0, 0, 0, 0], groupsWithToggles: [0, 0, 0, 0], groupsWithBells: [0, 0, 0, 0], bridgeDoor: [0, 0, 0, 0],
    };
    for (let g = 1; g <= 3; g++) L.bridgeDoor[g] = cfg.bell && cfg.bell[g] && cfg.bell[g].door ? 1 : 0;
    const doorCells = [];
    rows.forEach((row, ty) => {
      for (let tx = 0; tx < NC; tx++) {
        const ch = row[tx];
        const idx = ty * NC + tx;
        const px = tx * TILE, py = ty * TILE;
        if (ch === '#') L.base[idx] = 1;
        else if (ch === '1' || ch === '2') L.spawns[Number(ch) - 1] = { x: px + (TILE - PW) / 2, y: py + TILE - PH };
        else if (ch === 'D' || 'GHI'.includes(ch)) {
          doorCells.push({ tx, ty });
          if (ch !== 'D') { const g = 'GHI'.indexOf(ch) + 1; L.plates.push({ g, tx, ty, x: px, y: py + TILE - 8, w: TILE, h: 8 }); L.groupsWithPlates[g]++; }
        }
        else if (GROUP(ch, 'xyz')) { const g = GROUP(ch, 'xyz'); L.plates.push({ g, tx, ty, x: px, y: py + TILE - 8, w: TILE, h: 8, tog: 1 }); L.groupsWithToggles[g]++; }
        else if (GROUP(ch, 'PQR')) { L.vent[idx] = GROUP(ch, 'PQR'); L.hasVent = true; L.ventGroups[L.vent[idx]] = 1; }
        else if (ch === 'e' || ch === 'E') L.rspikes.push({ x: px + SPIKE.dx, y: py + SPIKE.dy, w: SPIKE.w, h: SPIKE.h, tx, ty, b: ch === 'E' });
        else if (ch === '^') L.spikes.push({ x: px + SPIKE.dx, y: py + SPIKE.dy, w: SPIKE.w, h: SPIKE.h, tx, ty });
        else if (ch === 'F') L.flags.push({ tx, ty, x: px + 6, y: py, w: 20, h: TILE, px, py });
        else if (GROUP(ch, 'abc')) { const g = GROUP(ch, 'abc'); L.plates.push({ g, tx, ty, x: px, y: py + TILE - 8, w: TILE, h: 8 }); L.groupsWithPlates[g]++; }
        else if (ch === 'T') { L.base[idx] = 1; L.spring[idx] = 1; }
        else if (ch === '<' || ch === '>') { L.base[idx] = 1; L.conv[idx] = ch === '>' ? 1 : -1; }
        else if (ch === '=') { L.oneway[idx] = 1; L.hasOneway = true; }
        else if (ch === 'f') { L.frags.push({ tx, ty, x: px, y: py }); L.fragAt[idx] = L.frags.length; L.dynCells.push(idx); }
        else if (GROUP(ch, 'klm')) { const g = GROUP(ch, 'klm'); L.portals.push({ g, tx, ty, x: px, y: py, pair: -1 }); }
        else if (GROUP(ch, 'uvw')) { const g = GROUP(ch, 'uvw'); L.base[idx] = 1; L.bells.push({ g, tx, ty, x: px, y: py }); L.bellAt[idx] = L.bells.length; L.groupsWithBells[g]++; }
        else if (GROUP(ch, 'ABC')) { L.gateG[idx] = GROUP(ch, 'ABC'); L.dynCells.push(idx); }
        else if (GROUP(ch, 'XYZ')) { L.gateG[idx] = GROUP(ch, 'XYZ'); L.inv[idx] = 1; L.dynCells.push(idx); }
        else if (GROUP(ch, 'MNO')) { L.bridgeG[idx] = GROUP(ch, 'MNO'); L.dynCells.push(idx); }
        else if (ch === 'r') { L.rhA[idx] = 1; L.dynCells.push(idx); }
        else if (ch === 's') { L.rhB[idx] = 1; L.dynCells.push(idx); }
        else if (ch !== '.') throw new Error(`${def.name} : caractère inconnu « ${ch} » en (${tx},${ty})`);
      }
    });
    for (let g = 1; g <= 3; g++) {
      const ks = []; L.portals.forEach((q, k) => { if (q.g === g) ks.push(k); });
      if (ks.length !== 0 && ks.length !== 2) throw new Error(`${def.name} : le groupe de portails ${g} doit avoir exactement 2 portails (trouvé ${ks.length})`);
      if (ks.length === 2) { L.portals[ks[0]].pair = ks[1]; L.portals[ks[1]].pair = ks[0]; }
    }
    for (let g = 1; g <= 3; g++) if (L.groupsWithPlates[g] && L.groupsWithToggles[g]) throw new Error(`${def.name} : le groupe ${g} mélange plaques et interrupteurs`);
    if (!L.spawns[0] || !L.spawns[1]) throw new Error(`${def.name} : il faut un départ 1 et un départ 2`);
    // Portes : cases D voisines regroupées
    const seen = new Set();
    doorCells.forEach((c) => {
      const k = c.ty * NC + c.tx;
      if (seen.has(k)) return;
      const cells = [];
      const q = [c]; seen.add(k);
      while (q.length) {
        const cur = q.pop(); cells.push(cur);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const nx = cur.tx + dx, ny = cur.ty + dy, nk = ny * NC + nx;
          if (nx < 0 || ny < 0 || nx >= NC || ny >= NR || seen.has(nk)) return;
          if (rows[ny][nx] === 'D' || 'GHI'.includes(rows[ny][nx])) { seen.add(nk); q.push({ tx: nx, ty: ny }); }
        });
      }
      const x0 = Math.min(...cells.map((o) => o.tx)), x1 = Math.max(...cells.map((o) => o.tx));
      const y0 = Math.min(...cells.map((o) => o.ty)), y1 = Math.max(...cells.map((o) => o.ty));
      L.doors.push({ x: x0 * TILE, y: y0 * TILE, w: (x1 - x0 + 1) * TILE, h: (y1 - y0 + 1) * TILE });
    });
    if (L.doors.length !== 2) throw new Error(`${def.name} : il faut exactement 2 portes (trouvé ${L.doors.length})`);
    L.doors.sort((a, b) => a.x - b.x || a.y - b.y);
    return L;
  }

  const bellCfg = (L, g) => Object.assign({}, DEFAULT_BELL, (L.cfg.bell && L.cfg.bell[g]) || {});
  const latchCfg = (L, g) => (L.cfg.latch && L.cfg.latch[g]) || 0;

  function makePlayer(i, L) {
    const s = L.spawns[i];
    return { i, x: s.x, y: s.y, vy: 0, face: i === 0 ? 1 : -1, onGround: false, coyote: 0, jumpBuf: 0, dead: 0, landed: 0, portal: -1 };
  }

  function create(def) {
    const L = def.base ? def : parseLevel(def);
    const G = {
      L, t: 0, players: [makePlayer(0, L), makePlayer(1, L)],
      open: [0, 0, 0, 0], tog: [0, 0, 0, 0], latch: [0, 0, 0, 0], bridge: [0, 0, 0, 0],
      plateOn: L.plates.map(() => 0), bellT: L.bells.map(() => 0),
      flagMask: L.flags.map(() => 0), flagDone: L.flags.map(() => 0), cp: -1,
      doorOcc: [-1, -1], winHold: 0, won: false, wonT: 0, deaths: 0,
      fragT: L.frags.map(() => 0), fragR: L.frags.map(() => 0),
      dyn: new Uint8Array(L.cols * L.nr), events: [],
    };
    for (let g = 1; g <= 3; g++) if (L.ventGroups[g] && !L.groupsWithPlates[g] && !L.groupsWithToggles[g]) G.open[g] = 1;      // courant sans commande : toujours actif
    computeDyn(G);
    return G;
  }

  /* ---------- Décor dynamique ---------- */
  function rhythmOn(L, idx, t) {
    const { period, on } = L.rhythm;
    const ph = t % period;
    if (L.rhA[idx]) return ph < on;
    const half = period / 2;
    return ph >= half && ph < half + on;
  }

  // pics rythmés : 0 = rentrés, 1 = sortis, 2 = vont sortir (avertissement)
  function spikeState(L, sp, t) {
    const { period, on } = L.rspike, half = period / 2;
    const ph = (t - (sp.b ? half : 0) + period * 4) % period;
    if (ph < on) return 1;
    return period - ph <= 14 ? 2 : 0;
  }

  function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // Un bloc dynamique ne se referme / n'apparaît jamais sur un joueur (personne n'est emmuré)
  function computeDyn(G) {
    const L = G.L;
    for (let k = 0; k < L.dynCells.length; k++) {
      const idx = L.dynCells[k];
      let want;
      if (L.gateG[idx]) want = L.inv[idx] ? !!G.open[L.gateG[idx]] : !G.open[L.gateG[idx]];
      else if (L.bridgeG[idx]) { const g = L.bridgeG[idx]; want = (G.bridge[g] > 0) !== !!L.bridgeDoor[g]; }
      else if (L.fragAt[idx]) want = G.fragR[L.fragAt[idx] - 1] === 0;
      else want = rhythmOn(L, idx, G.t);
      if (want) {
        const tx = idx % L.cols, ty = (idx - tx) / L.cols;
        for (const p of G.players) {
          if (!p.dead && overlap(p.x, p.y, PW, PH, tx * TILE, ty * TILE, TILE, TILE)) { want = false; break; }
        }
      }
      G.dyn[idx] = want ? 1 : 0;
    }
  }

  function solidAt(G, tx, ty) {
    const L = G.L;
    if (tx < 0 || ty < 0 || tx >= L.cols || ty >= L.nr) return true;
    const idx = ty * L.cols + tx;
    return L.base[idx] === 1 || G.dyn[idx] === 1;
  }

  function hitsWorld(G, x, y) {
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + PW - 0.001) / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + PH - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solidAt(G, tx, ty)) return true;
    return false;
  }

  // q est posé sur la tête de p
  function resting(q, p) {
    return !q.dead && Math.abs(q.y + PH - p.y) < 0.01 && q.x < p.x + PW && q.x + PW > p.x;
  }

  /* ---------- Déplacements ---------- */
  function moveX(G, i, dx) {
    const p = G.players[i], q = G.players[1 - i];
    let rem = dx;
    while (Math.abs(rem) > 1e-9) {
      const s = Math.abs(rem) > 1 ? Math.sign(rem) : rem;
      const nx = p.x + s;
      if (hitsWorld(G, nx, p.y)) return;
      if (!q.dead && overlap(nx, p.y, PW, PH, q.x, q.y, PW, PH)) return;
      const carry = resting(q, p);
      p.x = nx;
      if (carry && !hitsWorld(G, q.x + s, q.y)) q.x += s; // le joueur sur la tête est porté
      rem -= s;
    }
  }

  // Le joueur se cogne la tête en (x, ny) : si c'est une cloche, elle sonne
  function bump(G, x, ny) {
    const L = G.L, ty = Math.floor(ny / TILE);
    if (ty < 0) return;
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + PW - 0.001) / TILE);
    for (let tx = x0; tx <= x1; tx++) {
      const b = L.bellAt[ty * L.cols + tx];
      if (b) ring(G, b - 1);
    }
  }
  function ring(G, k) {
    const g = G.L.bells[k].g;
    if (G.bridge[g] <= 0) emit(G, 'bridgeOn', g);
    G.bridge[g] = bellCfg(G.L, g).dur;
    const fresh = G.bellT[k] <= 20;                          // un courant d'air qui plaque la tête contre la cloche ne la fait pas sonner en boucle
    G.bellT[k] = 30;
    if (fresh) emit(G, 'bell', k, g);
  }

  // Plateforme traversante : on s'y pose seulement en la franchissant de haut en bas depuis le dessus
  function landsOnOneway(G, p, ny) {
    const L = G.L, f0 = p.y + PH, f1 = ny + PH, r = Math.floor((f1 - 0.001) / TILE);
    if (!(f1 > r * TILE + 0.0005 && f0 <= r * TILE + 0.0005) || r < 0 || r >= L.nr) return -1;
    const x0 = Math.floor(p.x / TILE), x1 = Math.floor((p.x + PW - 0.001) / TILE);
    for (let tx = x0; tx <= x1; tx++) if (tx >= 0 && tx < L.cols && L.oneway[r * L.cols + tx]) return r;
    return -1;
  }
  // Sous les pieds (le joueur est posé) : tremplin ? tapis ?
  function cellsUnder(G, p, arr) {
    const L = G.L, r = Math.floor((p.y + PH + 0.5) / TILE);
    if (r < 0 || r >= L.nr) return 0;
    const x0 = Math.floor(p.x / TILE), x1 = Math.floor((p.x + PW - 0.001) / TILE);
    let v = 0;
    for (let tx = x0; tx <= x1; tx++) if (tx >= 0 && tx < L.cols) v += arr[r * L.cols + tx];
    return v;
  }

  function moveY(G, i, dy) {
    const p = G.players[i], q = G.players[1 - i];
    let rem = dy;
    while (Math.abs(rem) > 1e-9) {
      const s = Math.abs(rem) > 1 ? Math.sign(rem) : rem;
      const ny = p.y + s;
      // En cas de contact on se cale exactement contre l'obstacle (sinon on pourrait rester à < 1 px au-dessus)
      if (hitsWorld(G, p.x, ny)) {
        if (s > 0) { p.onGround = true; p.y = Math.floor((ny + PH - 0.001) / TILE) * TILE - PH; } else { bump(G, p.x, ny); p.y = (Math.floor(ny / TILE) + 1) * TILE; }
        p.vy = 0; return;
      }
      if (s > 0 && G.L.hasOneway) { const r = landsOnOneway(G, p, ny); if (r >= 0) { p.onGround = true; p.y = r * TILE - PH; p.vy = 0; return; } }
      if (!q.dead && overlap(p.x, ny, PW, PH, q.x, q.y, PW, PH)) {
        if (s > 0) { p.onGround = true; p.y = q.y - PH; p.vy = 0; return; } // on retombe sur l'autre joueur
        if (resting(q, p)) {                                  // l'autre est sur notre tête : on le soulève
          if (hitsWorld(G, q.x, q.y + s)) { bump(G, q.x, q.y + s); p.vy = 0; return; }
          q.y += s;
        } else { p.vy = 0; return; }                          // on se cogne sous ses pieds
      }
      p.y = ny;
      rem -= s;
    }
  }

  function emit(G, type, a, b) { G.events.push([type, a === undefined ? 0 : a, b === undefined ? 0 : b]); }

  function kill(G, i) {
    const p = G.players[i];
    if (p.dead) return;
    p.dead = G.practice ? 20 : RESPAWN;                    // entraînement : on repart plus vite
    p.vy = 0;
    p.onGround = false;
    G.deaths++;
    emit(G, 'death', i, Math.round(p.x + PW / 2) * 1000 + Math.round(p.y + PH / 2));
  }

  function respawn(G, i) {
    const p = G.players[i], q = G.players[1 - i], L = G.L;
    let x, y;
    if (G.custom && G.custom[i]) { x = G.custom[i].x; y = G.custom[i].y; }          // entraînement : point posé par les joueurs
    else if (G.cp >= 0) { const f = L.flags[G.cp]; x = f.px + (TILE - PW) / 2; y = f.py + TILE - PH; } else { x = L.spawns[i].x; y = L.spawns[i].y; }
    const offs = [0, 26, -26, 52, -52, 78, -78];
    let placed = false;
    for (const dx of offs) {
      const nx = x + dx;
      if (!hitsWorld(G, nx, y) && (q.dead || !overlap(nx, y, PW, PH, q.x, q.y, PW, PH))) { p.x = nx; p.y = y; placed = true; break; }
    }
    if (!placed) { p.x = x; p.y = y - PH - 2; }
    p.vy = 0; p.dead = 0; p.onGround = false; p.jumpBuf = 0; p.coyote = 0;
    emit(G, 'respawn', i);
  }

  // Retour volontaire au dernier drapeau validé (ou au départ) : pas de mort comptée, pas d'attente
  function recall(G, i) {
    const p = G.players[i];
    emit(G, 'recall', i, Math.round(p.x + PW / 2) * 1000 + Math.round(p.y + PH / 2));
    respawn(G, i);
  }

  // le joueur est-il dans un courant d'air actif ? (le centre de son corps suffit)
  function inVent(G, p) {
    const L = G.L, tx = Math.floor((p.x + PW / 2) / TILE), ty = Math.floor((p.y + PH / 2) / TILE);
    if (tx < 0 || ty < 0 || tx >= L.cols || ty >= L.nr) return false;
    const g = L.vent[ty * L.cols + tx];
    return g > 0 && !!G.open[g];
  }

  function stepPlayer(G, i, inp) {
    const p = G.players[i];
    if (p.dead) { p.dead--; if (p.dead === 0) respawn(G, i); return; }
    if (inp.k) { recall(G, i); return; }
    if (p.onGround) {                                       // tapis roulant : on est entraîné même à l'arrêt
      const b = cellsUnder(G, p, G.L.conv);
      if (b) moveX(G, i, Math.sign(b) * G.L.belt.speed * (G.L.belt.flip && G.open[G.L.belt.flip] ? -1 : 1));
    }
    const dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
    if (dir) p.face = dir;
    if (dir) moveX(G, i, dir * PHYS.speed);

    if (inp.j) p.jumpBuf = PHYS.buffer;
    if (p.onGround) p.coyote = PHYS.coyote; else if (p.coyote > 0) p.coyote--;
    if (p.jumpBuf > 0 && (p.onGround || p.coyote > 0)) {
      const boost = p.onGround && cellsUnder(G, p, G.L.spring) > 0;
      p.vy = boost ? PHYS.spring : PHYS.jump; p.jumpBuf = 0; p.coyote = 0; p.onGround = false;
      emit(G, 'jump', i, boost ? 1 : 0);
    } else if (p.jumpBuf > 0) p.jumpBuf--;

    const wasAir = !p.onGround;
    const vyBefore = p.vy;
    p.vy = Math.min(p.vy + PHYS.gravity, PHYS.maxFall);
    if (G.L.hasVent && inVent(G, p) && p.vy > -VENT.max) p.vy = Math.max(p.vy - VENT.lift, -VENT.max);
    p.onGround = false;
    moveY(G, i, p.vy);
    if (p.onGround && wasAir && vyBefore > 2) emit(G, 'land', i, Math.min(12, Math.round(vyBefore)));
    if (p.onGround) p.landed++; else p.landed = 0;
  }

  /* ---------- Déclencheurs (après les déplacements) ---------- */
  function updateTriggers(G) {
    const L = G.L;
    const alive = G.players.filter((p) => !p.dead);

    // Plaques → grilles
    const pressedPerGroup = [0, 0, 0, 0];
    L.plates.forEach((pl, k) => {
      const on = alive.some((p) => overlap(p.x, p.y, PW, PH, pl.x, pl.y, pl.w, pl.h)) ? 1 : 0;
      if (pl.tog) { if (on && !G.plateOn[k]) { G.tog[pl.g] ^= 1; emit(G, 'toggle', k, pl.g); } }
      else if (on !== G.plateOn[k]) emit(G, on ? 'plateOn' : 'plateOff', k, pl.g);
      G.plateOn[k] = on;
      if (on && !pl.tog) pressedPerGroup[pl.g]++;
    });
    for (let g = 1; g <= 3; g++) {
      if (L.groupsWithToggles[g]) { const was = G.open[g]; G.open[g] = G.tog[g]; if (G.open[g] !== was) emit(G, G.open[g] ? 'gateOpen' : 'gateClose', g); continue; }
      if (!L.groupsWithPlates[g]) continue;
      const was = G.open[g];
      if (pressedPerGroup[g] === L.groupsWithPlates[g]) { G.open[g] = 1; G.latch[g] = latchCfg(L, g); }
      else if (G.latch[g] > 0) { G.latch[g]--; G.open[g] = 1; }
      else G.open[g] = 0;
      if (G.open[g] !== was) emit(G, G.open[g] ? 'gateOpen' : 'gateClose', g);
    }

    // Cloches : minuteries des ponts / portes (la cloche elle-même est armée dans moveY)
    for (let k = 0; k < G.bellT.length; k++) if (G.bellT[k] > 0) G.bellT[k]--;
    for (let g = 1; g <= 3; g++) if (G.bridge[g] > 0) { G.bridge[g]--; if (G.bridge[g] === 0) emit(G, 'bridgeOff', g); }

    // Dalles fragiles : un poids déclenche la chute, puis la dalle revient
    for (let k = 0; k < L.frags.length; k++) {
      const f = L.frags[k];
      if (G.fragR[k] > 0) { G.fragR[k]--; if (G.fragR[k] === 0) emit(G, 'fragBack', k); continue; }
      if (G.fragT[k] > 0) { G.fragT[k]--; if (G.fragT[k] === 0) { G.fragR[k] = L.frag.restore; emit(G, 'fragFall', k); } continue; }
      if (alive.some((p) => p.onGround && Math.abs(p.y + PH - f.y) < 0.01 && p.x < f.x + TILE && p.x + PW > f.x)) { G.fragT[k] = L.frag.delay; emit(G, 'fragCrack', k); }
    }

    // Portails : on est téléporté en ENTRANT dans un portail (il faut en sortir pour pouvoir le reprendre)
    if (L.portals.length) {
      G.players.forEach((p, i) => {
        if (p.dead) { p.portal = -1; return; }
        const cx = p.x + PW / 2, cy = p.y + PH / 2;
        const j = L.portals.findIndex((q) => cx >= q.x && cx < q.x + TILE && cy >= q.y && cy < q.y + TILE);
        if (j < 0) { p.portal = -1; return; }
        if (p.portal === j) return;
        const dst = L.portals[L.portals[j].pair], other = G.players[1 - i];
        const nx = dst.x + (TILE - PW) / 2, ny = dst.y + TILE - PH;
        if (hitsWorld(G, nx, ny) || (!other.dead && overlap(nx, ny, PW, PH, other.x, other.y, PW, PH))) return;
        p.x = nx; p.y = ny; p.portal = L.portals[j].pair;
        emit(G, 'portal', i, j);
      });
    }

    // Drapeaux
    L.flags.forEach((f, k) => {
      if (G.flagDone[k]) return;
      G.players.forEach((p, i) => {
        if (!p.dead && overlap(p.x, p.y, PW, PH, f.x, f.y, f.w, f.h)) {
          if (!(G.flagMask[k] & (1 << i))) { G.flagMask[k] |= 1 << i; emit(G, 'flagTouch', k, i); }
        }
      });
      if (G.flagMask[k] === 3) {
        G.flagDone[k] = 1;
        // le dernier drapeau validé (le plus à droite en cas d'égalité de validation) sert de point de retour
        G.cp = k;
        emit(G, 'flag', k);
      }
    });

    // Pics
    G.players.forEach((p, i) => {
      if (p.dead) return;
      if (L.spikes.some((s) => overlap(p.x, p.y, PW, PH, s.x, s.y, s.w, s.h)) || (L.rspikes.length && L.rspikes.some((s) => spikeState(L, s, G.t) === 1 && overlap(p.x, p.y, PW, PH, s.x, s.y, s.w, s.h))) || p.y > L.nr * TILE + 64) kill(G, i);
    });

    // Portes : un joueur dans chacune, en même temps
    G.doorOcc = L.doors.map((d) => {
      for (const p of G.players) {
        if (p.dead) continue;
        const cx = p.x + PW / 2, cy = p.y + PH / 2;
        if (cx >= d.x && cx <= d.x + d.w && cy >= d.y && cy <= d.y + d.h) return p.i;
      }
      return -1;
    });
    const [o0, o1] = G.doorOcc;
    if (o0 >= 0 && o1 >= 0 && o0 !== o1) {
      if (G.winHold === 0) emit(G, 'doorsFull');
      G.winHold++;
      if (G.winHold >= WIN_HOLD) { G.won = true; G.wonT = 0; emit(G, 'win'); }
    } else G.winHold = Math.max(0, G.winHold - 2);
  }

  // inputs : [{l, r, j}, {l, r, j}] ; j = la touche saut vient d'être pressée à ce tick
  function step(G, inputs) {
    G.events = [];
    if (G.won) { G.wonT++; return; }
    G.t++;
    computeDyn(G);
    if (G.practice && ((inputs[0] && inputs[0].c) || (inputs[1] && inputs[1].c))) G.pendingPoint = 120;
    const order = (G.t & 1) ? [0, 1] : [1, 0];
    for (const i of order) stepPlayer(G, i, inputs[i] || {});
    updateTriggers(G);
    // Entraînement : « poser un point de retour ici » est appliqué dès que les deux joueurs sont posés
    if (G.practice && G.pendingPoint > 0) {
      G.pendingPoint--;
      if (G.players.every((p) => !p.dead && p.onGround)) {
        G.custom = G.players.map((p) => ({ x: p.x, y: p.y }));
        G.pendingPoint = 0;
        emit(G, 'point', 0, 0);
      }
    }
  }

  // Entraînement : repart du début (k = -1) ou d'un drapeau (k ≥ 0), puzzles remis à zéro, chutes conservées
  function practiceGoto(G, k) {
    const F = create(G.L), deaths = G.deaths;
    Object.keys(F).forEach((key) => { if (key !== 'L') G[key] = F[key]; });
    G.deaths = deaths; G.practice = true; G.custom = null; G.pendingPoint = 0;
    if (k >= 0 && k < G.L.flags.length) {
      G.cp = k; G.flagDone[k] = 1; G.flagMask[k] = 3;
      respawn(G, 0); respawn(G, 1);
    }
    G.events.push(['goto', k + 1, 0]);
  }

  /* ---------- Échange réseau (messages compacts) ---------- */
  function pack(G) {
    return {
      k: G.t,
      p: G.players.map((p) => [p.x, p.y, p.vy, p.face, p.onGround ? 1 : 0, p.dead]),
      o: G.open, tg: G.tog, l: G.latch, b: G.bridge, pl: G.plateOn, bt: G.bellT, ft: G.fragT, fr: G.fragR,
      fm: G.flagMask, fd: G.flagDone, cp: G.cp, dr: G.doorOcc, wh: G.winHold,
      w: G.won ? 1 : 0, wt: G.wonT, d: G.deaths, e: G.events, pr: G.practice ? 1 : 0, cu: G.custom || 0,
    };
  }

  function unpack(G, m) {
    G.t = m.k;
    m.p.forEach((a, i) => {
      const p = G.players[i];
      p.x = a[0]; p.y = a[1]; p.vy = a[2]; p.face = a[3]; p.onGround = !!a[4]; p.dead = a[5];
    });
    G.open = m.o; G.tog = m.tg || [0, 0, 0, 0]; G.latch = m.l; G.bridge = m.b; G.plateOn = m.pl; G.bellT = m.bt; G.fragT = m.ft; G.fragR = m.fr;
    G.flagMask = m.fm; G.flagDone = m.fd; G.cp = m.cp; G.doorOcc = m.dr; G.winHold = m.wh;
    G.won = !!m.w; G.wonT = m.wt; G.deaths = m.d; G.events = m.e || []; G.practice = !!m.pr; G.custom = m.cu || null;
    computeDyn(G);
  }

  const API = {
    TILE, PW, PH, COLS, ROWS, PHYS, VENT, RESPAWN, WIN_HOLD, SPIKE, NCOLORS,
    parseLevel, create, step, practiceGoto, pack, unpack, computeDyn, bellCfg, latchCfg, rhythmOn, spikeState, solidAt, hitsWorld, resting, overlap,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Sim = API;
})(typeof window !== 'undefined' ? window : globalThis);
