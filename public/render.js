// TANDEM — rendu canvas (aucune logique de jeu ici : on dessine l'état du moteur).
(function (root) {
  'use strict';
  const { TILE, PW, PH, WIN_HOLD } = root.Sim;
  const W = 960, H = 480;          // taille logique de l'écran (la « vue »), indépendante de la taille du niveau

  // Palette des personnages (le choix de chacun se fait dans le menu « Couleurs »). light / dark sont calculées.
  const mix = (hex, to, k) => {
    const a = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)), b = [1, 3, 5].map((i) => parseInt(to.slice(i, i + 2), 16));
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join('');
  };
  const PALETTE = [
    ['Bleu', '#4aa8ff'], ['Orange', '#ff9d3d'], ['Rose', '#ff6fae'], ['Vert', '#4fd37f'],
    ['Violet', '#a98bff'], ['Jaune', '#f2d24a'], ['Rouge', '#ee5a5a'], ['Turquoise', '#3ed6c8'],
  ].map(([name, main]) => ({ name, main, dark: mix(main, '#000000', 0.32), light: mix(main, '#ffffff', 0.62), line: mix(main, '#1a0f2e', 0.62), top: mix(main, '#ffffff', 0.28) }));
  const P_COL = [Object.assign({}, PALETTE[0]), Object.assign({}, PALETTE[1])];     // objets modifiés sur place par setColors
  function setColors(ci) { ci.forEach((k, i) => Object.assign(P_COL[i], PALETTE[k % PALETTE.length])); }
  const G_COL = [null, '#ff6b9d', '#5fe0a3', '#c39bff'];
  const RHY = { r: '#ffc247', s: '#4fd8ff' };
  const GOLD = '#ffd24a';

  const THEMES = {
    meadow: { bgTop: '#1d4034', bgBot: '#0c211b', tile: '#35493c', tileTop: '#7ccf7a', tileEdge: '#223226', deco: '#2f6a50', accent: '#7ccf7a', label: 'Prairie' },
    arcane: { bgTop: '#2a2163', bgBot: '#110d2f', tile: '#383070', tileTop: '#9a8cff', tileEdge: '#231e4b', deco: '#4a3fa0', accent: '#9a8cff', label: 'Arcane' },
    sky: { bgTop: '#4b86c9', bgBot: '#1d3c68', tile: '#54627e', tileTop: '#bfe3ff', tileEdge: '#33405a', deco: '#8fc4f0', accent: '#8fd0ff', label: 'Ciel' },
    forge: { bgTop: '#401c10', bgBot: '#180a06', tile: '#5a372a', tileTop: '#ff9a4d', tileEdge: '#38211a', deco: '#7a3418', accent: '#ff9a4d', label: 'Forge' },
    ice: { bgTop: '#10345a', bgBot: '#081a30', tile: '#4a7fa8', tileTop: '#e6f6ff', tileEdge: '#2b5679', deco: '#6aa7d0', accent: '#9fdcf7', label: 'Glace' },
    ruins: { bgTop: '#35294f', bgBot: '#170f26', tile: '#6d5f4e', tileTop: '#8bc062', tileEdge: '#352d24', deco: '#8f5d6e', accent: '#f4b46c', label: 'Ruines' },
    space: { bgTop: '#150b3d', bgBot: '#04020d', tile: '#2b3160', tileTop: '#6be0ff', tileEdge: '#0a0c24', deco: '#4b56a4', accent: '#6be0ff', label: 'Cosmos' },
  };

  const rr = (c, x, y, w, h, r) => {
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  };
  function seeded(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /* ---------- Couche fixe : fond, murs, pics (dessinée une fois par niveau) ---------- */
  const layers = new Map();
  function staticLayer(L, themeName, scale) {
    const key = `${L.name}|${themeName}|${scale}`;
    if (layers.has(key)) return layers.get(key);
    const th = THEMES[themeName] || THEMES.meadow, pal = root.Scenery.SC[themeName] || root.Scenery.SC.meadow;
    const LW = L.w, LH = L.h, COLS = L.cols, ROWS = L.nr;
    const cv = document.createElement('canvas');
    cv.width = Math.round(LW * scale); cv.height = Math.round(LH * scale);
    const c = cv.getContext('2d');
    c.scale(scale, scale);
    const SCN = root.Scenery, rnd = SCN.seeded(L.name + themeName);
    // murs : tuiles texturées + accessoires (herbe, cristaux…) posés dessus
    const solid = (tx, ty) => tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS && L.base[ty * COLS + tx] === 1 && !L.bellAt[ty * COLS + tx];
    const props = [];
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        if (!solid(tx, ty)) continue;
        const x = tx * TILE, y = ty * TILE, special = L.spring[ty * COLS + tx] || L.conv[ty * COLS + tx];
        const nb = { up: solid(tx, ty - 1) || ty === 0, down: solid(tx, ty + 1), left: solid(tx - 1, ty), right: solid(tx + 1, ty) };
        SCN.drawTile(c, themeName, x, y, tx, ty, nb, special, rnd);
        if (!nb.up && !special && rnd() < 0.55) props.push([0, x, y]);
        if (!nb.down && ty < ROWS - 1 && rnd() < 0.22) props.push([1, x, y + TILE]);
      }
    }
    // les accessoires se dessinent après les tuiles (ils dépassent sur la case voisine, vide)
    props.forEach(([k, x, y]) => (k ? SCN.propUnder(c, themeName, x, y, rnd) : SCN.propOnTop(c, themeName, x, y, rnd)));
    // plateformes traversantes
    for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
      if (!L.oneway[ty * COLS + tx]) continue;
      const x = tx * TILE, y = ty * TILE;
      c.fillStyle = pal.line; c.fillRect(x, y + 6, TILE, 4);
      c.fillStyle = pal.tileDark; c.fillRect(x, y + 3, TILE, 4);
      c.fillStyle = pal.cap; c.fillRect(x, y, TILE, 6);
      c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(x, y, TILE, 2);
      c.fillStyle = 'rgba(255,255,255,.22)';
      for (let k = 0; k < 3; k++) c.fillRect(x + 4 + k * 10, y + 11, 3, 3);
    }
    // pics
    L.spikes.forEach((s) => {
      const x = s.tx * TILE, y = s.ty * TILE;
      for (let k = 0; k < 3; k++) {
        const bx = x + 2 + k * 10.5;
        c.fillStyle = '#d7dbe8'; c.beginPath(); c.moveTo(bx, y + TILE); c.lineTo(bx + 5.2, y + 14); c.lineTo(bx + 10.4, y + TILE); c.closePath(); c.fill();
        c.fillStyle = '#8d94ad'; c.beginPath(); c.moveTo(bx + 5.2, y + 14); c.lineTo(bx + 10.4, y + TILE); c.lineTo(bx + 5.2, y + TILE); c.closePath(); c.fill();
      }
    });
    layers.set(key, cv);
    return cv;
  }

  /* ---------- Particules ---------- */
  const FX = {
    list: [],
    emit(n, x, y, o) {
      for (let i = 0; i < n; i++) {
        const a = o.dir !== undefined ? o.dir + (Math.random() - 0.5) * (o.spread || 1) : Math.random() * Math.PI * 2;
        const sp = (o.speed || 2) * (0.4 + Math.random() * 0.8);
        this.list.push({ x: x + (Math.random() - 0.5) * (o.w || 0), y: y + (Math.random() - 0.5) * (o.h || 0), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: o.g === undefined ? 0.08 : o.g, life: (o.life || 30) * (0.7 + Math.random() * 0.6), max: o.life || 30, s: (o.size || 3) * (0.6 + Math.random() * 0.8), c: Array.isArray(o.color) ? o.color[(Math.random() * o.color.length) | 0] : o.color || '#fff', ring: !!o.ring });
      }
    },
    ring(x, y, color, r = 26, life = 20) { this.list.push({ x, y, vx: 0, vy: 0, g: 0, life, max: life, s: r, c: color, ringOnly: true }); },
    update() {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life--;
        if (p.life <= 0) this.list.splice(i, 1);
      }
      if (this.list.length > 600) this.list.splice(0, this.list.length - 600);
    },
    draw(c) {
      for (const p of this.list) {
        const k = Math.max(0, p.life / p.max);
        c.globalAlpha = k;
        if (p.ringOnly) { c.strokeStyle = p.c; c.lineWidth = 3 * k + 1; c.beginPath(); c.arc(p.x, p.y, p.s * (1.2 - k * 0.9) + 4, 0, 6.2832); c.stroke(); }
        else { c.fillStyle = p.c; c.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
      }
      c.globalAlpha = 1;
    },
    clear() { this.list.length = 0; },
  };

  /* ---------- Éléments animés ---------- */
  function drawGateCell(c, x, y, g, solid, t) {
    const col = G_COL[g];
    if (solid) {
      c.fillStyle = '#17112a'; c.fillRect(x + 1, y, TILE - 2, TILE);
      c.fillStyle = col;
      for (let k = 0; k < 3; k++) c.fillRect(x + 4 + k * 9, y, 5, TILE);
      c.fillStyle = 'rgba(255,255,255,.35)';
      for (let k = 0; k < 3; k++) c.fillRect(x + 4 + k * 9, y, 2, TILE);
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x + 1, y + TILE / 2 - 1, TILE - 2, 3);
    } else {
      c.fillStyle = 'rgba(20,10,50,.16)'; c.fillRect(x + 3, y + 1, TILE - 6, TILE - 2);
      c.strokeStyle = col; c.globalAlpha = 0.75; c.setLineDash([3, 5]); c.lineWidth = 2.2;
      c.strokeRect(x + 3, y + 1, TILE - 6, TILE - 2); c.setLineDash([]); c.globalAlpha = 1;
    }
  }

  function drawBridgeCell(c, x, y, g, solid, rem, t) {
    const col = G_COL[g];
    if (solid) {
      const flick = rem < 70 && ((t >> 2) & 1);
      c.globalAlpha = flick ? 0.3 : 1;
      c.fillStyle = col; c.globalAlpha *= 0.55; c.fillRect(x, y, TILE, TILE);
      c.globalAlpha = flick ? 0.3 : 1;
      c.fillStyle = '#fff'; c.fillRect(x, y, TILE, 4);
      c.fillStyle = col; c.fillRect(x, y + 4, TILE, 3);
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      c.globalAlpha = 1;
    } else {
      c.fillStyle = 'rgba(20,10,50,.14)'; c.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      c.strokeStyle = col; c.globalAlpha = 0.7 + 0.1 * Math.sin(t / 14); c.setLineDash([2, 4]); c.lineWidth = 2.2;
      c.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2); c.setLineDash([]); c.globalAlpha = 1;
    }
  }

  function drawRhythmCell(c, x, y, kind, solid, warn, soon, t) {
    const col = RHY[kind];
    if (solid) {
      if (warn && ((t >> 1) & 1)) { c.globalAlpha = 0.45; }
      c.fillStyle = col; c.fillRect(x, y, TILE, TILE);
      c.fillStyle = 'rgba(255,255,255,.45)'; c.fillRect(x, y, TILE, 5);
      c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(x, y + TILE - 5, TILE, 5);
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x + 10, y + 11, 12, 10);
      c.globalAlpha = 1;
    } else {
      c.fillStyle = 'rgba(20,10,50,.14)'; c.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      c.strokeStyle = col; c.globalAlpha = soon ? 0.95 : 0.6; c.lineWidth = soon ? 3 : 2.2; c.setLineDash(soon ? [] : [3, 4]);
      c.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4); c.setLineDash([]); c.globalAlpha = 1;
    }
  }



  // Pics rythmés : plaque percée ; les pointes sortent en cadence (clignotent juste avant)
  function drawRSpike(c, sp, state, t) {
    const x = sp.tx * TILE, y = sp.ty * TILE;
    c.fillStyle = '#241a2e'; c.fillRect(x + 2, y + TILE - 5, TILE - 4, 5);
    c.fillStyle = '#3a2c48'; c.fillRect(x + 2, y + TILE - 5, TILE - 4, 2);
    const h = state === 1 ? 17 : state === 2 ? 5 + 3 * ((t >> 1) & 1) : 3;
    for (let k = 0; k < 3; k++) {
      const bx = x + 3 + k * 9.6;
      c.fillStyle = state === 1 ? '#e9edf7' : state === 2 ? '#ffb0b0' : '#6c6480';
      c.beginPath(); c.moveTo(bx, y + TILE - 4); c.lineTo(bx + 4.8, y + TILE - 4 - h); c.lineTo(bx + 9.6, y + TILE - 4); c.closePath(); c.fill();
      if (state === 1) { c.fillStyle = '#9aa1bd'; c.beginPath(); c.moveTo(bx + 4.8, y + TILE - 4 - h); c.lineTo(bx + 9.6, y + TILE - 4); c.lineTo(bx + 4.8, y + TILE - 4); c.closePath(); c.fill(); }
    }
    if (state === 2) { c.globalAlpha = 0.25 + 0.2 * ((t >> 1) & 1); c.fillStyle = '#ff4d5e'; c.fillRect(x + 2, y + TILE - 22, TILE - 4, 18); c.globalAlpha = 1; }
  }

  // Interrupteur à bascule : socle + manette qui penche d'un côté ou de l'autre (on = penchée à droite)
  function drawToggle(c, pl, on, t) {
    const col = G_COL[pl.g], x = pl.x, y = pl.y - 0, cx = x + TILE / 2;
    c.fillStyle = '#16102a'; rr(c, x + 3, y + 3, TILE - 6, 6, 3); c.fill();
    c.fillStyle = on ? col : '#5a5478'; rr(c, x + 4, y + 4, TILE - 8, 4, 2); c.fill();
    const ang = on ? 0.62 : -0.62;
    c.save(); c.translate(cx, y + 4); c.rotate(ang);
    c.strokeStyle = '#d9d4ea'; c.lineWidth = 3.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -15); c.stroke();
    c.fillStyle = col; c.strokeStyle = '#16102a'; c.lineWidth = 1.6; c.beginPath(); c.arc(0, -16, 4.6, 0, 6.2832); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(-1.4, -17.4, 1.5, 0, 6.2832); c.fill();
    c.restore();
    if (on) { c.globalAlpha = 0.18 + 0.1 * Math.sin(t / 8); c.fillStyle = col; c.beginPath(); c.arc(cx, y - 8, 17, 0, 6.2832); c.fill(); c.globalAlpha = 1; }
  }

  // Courant d'air : colonne de chevrons qui montent quand le groupe est actif
  function drawVentCell(c, x, y, g, active, t, top, hasFloor) {
    const col = G_COL[g];
    if (!active) {
      c.fillStyle = 'rgba(20,10,50,.10)'; c.fillRect(x + 4, y, TILE - 8, TILE);
      c.strokeStyle = col; c.globalAlpha = 0.55; c.lineWidth = 2; c.setLineDash([2, 5]);
      c.beginPath(); c.moveTo(x + 4, y); c.lineTo(x + 4, y + TILE); c.moveTo(x + TILE - 4, y); c.lineTo(x + TILE - 4, y + TILE); c.stroke();
      c.setLineDash([]); c.globalAlpha = 1;
      c.fillStyle = col; c.globalAlpha = 0.45; c.beginPath(); c.moveTo(x + 16, y + 11); c.lineTo(x + 22, y + 19); c.lineTo(x + 10, y + 19); c.closePath(); c.fill(); c.globalAlpha = 1;
      return;
    }
    const gr = c.createLinearGradient(0, y, 0, y + TILE);
    gr.addColorStop(0, col + (top ? '10' : '40')); gr.addColorStop(1, col + '40');
    c.fillStyle = gr; c.fillRect(x + 3, y, TILE - 6, TILE);
    c.strokeStyle = '#ffffff'; c.lineWidth = 2.2; c.lineCap = 'round'; c.lineJoin = 'round';
    for (let k = 0; k < 2; k++) {
      const off = ((t * 1.6 + k * 16) % TILE), yy = y + TILE - off, a = Math.min(1, off / 8, (TILE - off) / 8 + 0.2);
      c.globalAlpha = 0.75 * Math.max(0.15, a);
      c.beginPath(); c.moveTo(x + 9, yy + 5); c.lineTo(x + 16, yy - 2); c.lineTo(x + 23, yy + 5); c.stroke();
    }
    c.globalAlpha = 0.5; c.fillStyle = '#fff';
    for (let k = 0; k < 3; k++) { const px = x + 7 + ((k * 9 + (t >> 2)) % 18), py = y + TILE - ((t * 2 + k * 11) % TILE); c.fillRect(px, py, 2, 2); }
    c.globalAlpha = 1;
  }

  function drawPlate(c, pl, pressed) {
    const col = G_COL[pl.g];
    const h = pressed ? 3 : 8;
    c.fillStyle = '#16102a'; c.fillRect(pl.x + 2, pl.y + 6, pl.w - 4, 2);
    c.fillStyle = col; rr(c, pl.x + 3, pl.y + 8 - h, pl.w - 6, h, 2); c.fill();
    if (pressed) { c.globalAlpha = 0.35; c.fillRect(pl.x - 2, pl.y + 3, pl.w + 4, 5); c.globalAlpha = 1; }
    else { c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(pl.x + 5, pl.y + 1, pl.w - 10, 2); }
  }

  // Cloche : bloc plein, frappé par-dessous. ringT (30 → 0) anime le balancement
  function drawBell(c, b, ringT, t) {
    const x = b.x, y = b.y, col = G_COL[b.g];
    c.fillStyle = '#241c48'; rr(c, x + 1, y + 1, TILE - 2, TILE - 2, 6); c.fill();
    c.strokeStyle = col; c.lineWidth = 2.5; rr(c, x + 2.5, y + 2.5, TILE - 5, TILE - 5, 5); c.stroke();
    if (ringT > 0) { c.globalAlpha = ringT / 30 * 0.45; c.fillStyle = col; rr(c, x + 1, y + 1, TILE - 2, TILE - 2, 6); c.fill(); c.globalAlpha = 1; }
    c.save(); c.translate(x + 16, y + 6); c.rotate(Math.sin(ringT * 0.95) * 0.55 * (ringT / 30));
    c.fillStyle = GOLD; c.beginPath(); c.moveTo(-9, 17); c.quadraticCurveTo(-8, 1, 0, 0); c.quadraticCurveTo(8, 1, 9, 17); c.closePath(); c.fill();
    c.fillStyle = '#e0a92a'; c.fillRect(-11, 16, 22, 3);
    c.fillStyle = '#fff5c8'; c.fillRect(-5, 5, 2, 8);
    c.fillStyle = '#e0a92a'; c.beginPath(); c.arc(0, 22, 3, 0, 6.2832); c.fill();
    c.restore();
    // chevron « frappez par-dessous »
    const bob = Math.sin(t / 10 + b.tx) * 1.5;
    c.fillStyle = col; c.globalAlpha = 0.65;
    c.beginPath(); c.moveTo(x + 16, y + TILE + 3 + bob); c.lineTo(x + 21, y + TILE + 10 + bob); c.lineTo(x + 11, y + TILE + 10 + bob); c.closePath(); c.fill();
    c.globalAlpha = 1;
  }

  function drawFlag(c, f, mask, done, t) {
    const x = f.px + 10, y = f.py;
    c.fillStyle = '#c9c3d9'; c.fillRect(x, y + 2, 3, TILE - 2);
    const wave = Math.sin(t / 10) * 2;
    const col = done ? GOLD : '#7d7896';
    c.fillStyle = col; c.beginPath(); c.moveTo(x + 3, y + 3); c.lineTo(x + 20, y + 8 + wave); c.lineTo(x + 3, y + 15); c.closePath(); c.fill();
    if (!done) {
      if (mask & 1) { c.fillStyle = P_COL[0].main; c.fillRect(x + 6, y + 6, 4, 4); }
      if (mask & 2) { c.fillStyle = P_COL[1].main; c.fillRect(x + 11, y + 7, 4, 4); }
    } else { c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(x + 6, y + 6, 4, 2); }
  }

  function drawDoor(c, d, occ, hold, t, won) {
    const x = d.x + 3, y = d.y + 3, w = d.w - 6, h = d.h - 3;
    c.fillStyle = '#0d0a1c';
    c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, y + w / 2); c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); c.lineTo(x + w, y + h); c.closePath(); c.fill();
    const k = Math.min(1, hold / WIN_HOLD);
    if (occ >= 0) {
      c.globalAlpha = 0.45 + 0.3 * k; c.fillStyle = P_COL[occ].main; c.fill();
      c.globalAlpha = 1;
    }
    c.strokeStyle = GOLD; c.lineWidth = 3; c.globalAlpha = 0.65 + 0.35 * Math.sin(t / 15) * (occ >= 0 ? 1 : 0.4); c.stroke(); c.globalAlpha = 1;
    // petites étoiles
    c.fillStyle = GOLD; c.globalAlpha = 0.6;
    c.fillRect(x + w / 2 - 1, y + h / 2 - 8 + Math.sin(t / 9) * 3, 3, 3);
    c.globalAlpha = 1;
    if (won) { c.globalAlpha = 0.5; c.fillStyle = '#fff'; c.fill(); c.globalAlpha = 1; }
  }

  /* ---------- Personnages ----------
     drawCharacter dessine un bonhomme, pieds posés en (x, y). st : { sx, sy, face, walk, look:{x,y}, blink, mood, bob }
     Joueur 0 : oreilles rondes (ourson) ; joueur 1 : oreilles pointues (chaton). */
  function drawCharacter(c, x, y, col, slot, st) {
    st = st || {};
    const f = st.face === undefined ? 1 : st.face, sx = st.sx || 1, sy = st.sy || 1;
    const walk = st.walk || 0, bob = st.bob || 0, mood = st.mood || 'idle';
    c.save(); c.translate(x, y); c.scale(sx, sy);
    // ombre
    c.fillStyle = 'rgba(0,0,0,.26)'; c.beginPath(); c.ellipse(0, 0, 12, 3.2, 0, 0, 6.2832); c.fill();
    c.lineJoin = 'round'; c.lineCap = 'round';
    const stroke = () => { c.strokeStyle = col.line; c.lineWidth = 2.2; c.stroke(); };
    // pieds (alternés quand on marche)
    const lift = (k) => (st.walking ? Math.max(0, Math.sin(walk + k * Math.PI)) * 3.2 : 0);
    [-1, 1].forEach((k) => {
      c.fillStyle = col.dark; c.beginPath(); c.ellipse(k * 6.2 + f * 0.6, -2.6 - lift(k > 0 ? 0 : 1), 5.4, 3.4, 0, 0, 6.2832); c.fill(); stroke();
    });
    c.translate(0, -bob);
    // oreilles (derrière le corps)
    c.fillStyle = col.main;
    if (slot === 0) {
      [-1, 1].forEach((k) => {
        c.beginPath(); c.arc(k * 8.4, -28.6, 4.8, 0, 6.2832); c.fill(); stroke();
        c.fillStyle = 'rgba(255,170,200,.75)'; c.beginPath(); c.arc(k * 8.4, -28.2, 2.2, 0, 6.2832); c.fill(); c.fillStyle = col.main;
      });
    } else {
      [-1, 1].forEach((k) => {
        c.beginPath(); c.moveTo(k * 12.2, -24); c.lineTo(k * 9.6, -35.6); c.lineTo(k * 3.6, -27.6); c.closePath(); c.fill(); stroke();
        c.fillStyle = 'rgba(255,170,200,.8)'; c.beginPath(); c.moveTo(k * 10.2, -26); c.lineTo(k * 9, -32); c.lineTo(k * 5.8, -27.4); c.closePath(); c.fill(); c.fillStyle = col.main;
      });
    }
    // bras (petites boules)
    const armUp = mood === 'up' || mood === 'joy' ? 1 : 0, sw = st.walking ? Math.sin(walk) * 2 : 0;
    [-1, 1].forEach((k) => {
      c.fillStyle = col.main; c.beginPath(); c.arc(k * 13.2, -12 - armUp * 5 + (k > 0 ? sw : -sw), 3.4, 0, 6.2832); c.fill(); stroke();
    });
    // corps
    const g = c.createLinearGradient(0, -30, 0, -3);
    g.addColorStop(0, col.top); g.addColorStop(0.55, col.main); g.addColorStop(1, col.dark);
    c.fillStyle = g; rr(c, -13, -30, 26, 27, 12.5); c.fill(); stroke();
    c.fillStyle = 'rgba(255,255,255,.32)'; c.beginPath(); c.ellipse(-6.6, -25, 3.6, 2, -0.5, 0, 6.2832); c.fill();   // reflet
    c.fillStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.ellipse(0, -9.6, 7.4, 5.2, 0, 0, 6.2832); c.fill();       // ventre
    // joues
    c.fillStyle = 'rgba(255,105,150,.5)';
    [-1, 1].forEach((k) => { c.beginPath(); c.ellipse(k * 9.2 + f * 1.2, -11.6, 3.1, 2, 0, 0, 6.2832); c.fill(); });
    // yeux
    const ex = (k) => k * 5.2 + f * 1.7;
    if (st.blink || mood === 'joy') {
      c.strokeStyle = '#1a1530'; c.lineWidth = 2; c.beginPath();
      [-1, 1].forEach((k) => { if (mood === 'joy') { c.moveTo(ex(k) - 3.4, -16.4); c.quadraticCurveTo(ex(k), -21.6, ex(k) + 3.4, -16.4); } else { c.moveTo(ex(k) - 3.4, -17.6); c.quadraticCurveTo(ex(k), -15.2, ex(k) + 3.4, -17.6); } });
      c.stroke();
    } else {
      const lx = (st.look ? st.look.x : f) * 1.1, ly = st.look ? st.look.y : 0;
      [-1, 1].forEach((k) => {
        c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex(k), -18.4, 4.5, 5.5, 0, 0, 6.2832); c.fill();
        c.fillStyle = '#1a1530'; c.beginPath(); c.ellipse(ex(k) + lx, -18 + ly, 3.1, 3.9, 0, 0, 6.2832); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(ex(k) + lx - 1, -19.6 + ly, 1.25, 0, 6.2832); c.fill();
        c.globalAlpha = 0.85; c.beginPath(); c.arc(ex(k) + lx + 1.1, -16.4 + ly, 0.65, 0, 6.2832); c.fill(); c.globalAlpha = 1;
      });
    }
    // bouche
    const mx = f * 1.8;
    c.fillStyle = '#1a1530'; c.strokeStyle = '#1a1530'; c.lineWidth = 1.7;
    if (mood === 'down') { c.beginPath(); c.ellipse(mx, -11.4, 2.3, 3, 0, 0, 6.2832); c.fill(); }
    else if (mood === 'up') { c.beginPath(); c.ellipse(mx, -11.8, 1.7, 2.1, 0, 0, 6.2832); c.fill(); }
    else if (mood === 'joy') {
      c.beginPath(); c.moveTo(mx - 3.2, -12.6); c.quadraticCurveTo(mx, -6.4, mx + 3.2, -12.6); c.closePath(); c.fill();
      c.fillStyle = '#ff7d9b'; c.beginPath(); c.ellipse(mx, -9.2, 1.7, 1, 0, 0, 6.2832); c.fill();
    } else { c.beginPath(); c.moveTo(mx - 2.4, -12.4); c.quadraticCurveTo(mx, -9.8, mx + 2.4, -12.4); c.stroke(); }
    c.restore();
  }

  const pstate = [{}, {}];
  function drawPlayer(c, p, i, t, isYou, now, joy) {
    if (p.dead) { pstate[i].wasGround = false; return; }
    const st = pstate[i];
    if (st.t === undefined || now < st.t) Object.assign(st, { wasGround: p.onGround, lastX: p.x, lastVy: 0, walk: 0, landAt: -1e9, blinkAt: now + 1500 + i * 700, fd: p.face || 1, joyAt: -1e9 });
    // atterrissage → écrasement
    if (p.onGround && !st.wasGround && st.lastVy > 3) { st.landAt = now; st.landPow = Math.min(1, st.lastVy / 10); }
    const moved = Math.abs(p.x - st.lastX);
    const walking = p.onGround && moved > 0.4 && moved < 12;
    if (walking) st.walk += moved * 0.34;
    st.wasGround = p.onGround; st.lastX = p.x; st.lastVy = p.vy; st.t = now;
    st.fd += ((p.face || 1) - st.fd) * 0.35;
    // clignement
    if (now > st.blinkAt) { st.blinkOn = now + 130; st.blinkAt = now + 2200 + ((now * 7 + i * 13) % 2600); }
    const blink = now < (st.blinkOn || 0);
    // forme : étirement en l'air, écrasement à l'atterrissage, respiration à l'arrêt
    let sx = 1, sy = 1;
    if (!p.onGround) { const k = Math.min(1, Math.abs(p.vy) / 11); sy = 1 + 0.16 * k; sx = 1 - 0.11 * k; }
    else {
      const k = Math.max(0, 1 - (now - st.landAt) / 170);
      if (k > 0) { const a = 0.22 * (st.landPow || 0.5) * Math.sin(k * 1.57); sy = 1 - a; sx = 1 + a * 0.8; }
      else if (!walking) sy = 1 + 0.025 * Math.sin(now / 330 + i);
    }
    const mood = joy ? 'joy' : !p.onGround ? (p.vy < -1.5 ? 'up' : p.vy > 5 ? 'down' : 'idle') : (now - st.landAt < 160 ? 'joy' : 'idle');
    drawCharacter(c, p.x + PW / 2, p.y + PH, P_COL[i], i, {
      sx, sy, face: st.fd, walk: st.walk, walking, bob: walking ? Math.abs(Math.sin(st.walk)) * 1.4 : 0, blink,
      mood, look: { x: Math.max(-1, Math.min(1, st.fd)) * (0.6 + 0.4 * Math.min(1, moved)), y: Math.max(-1.2, Math.min(1.4, p.vy / 6)) },
    });
    if (isYou) {
      const bobY = Math.sin(t / 8) * 2, cx = p.x + PW / 2, col = P_COL[i];
      c.fillStyle = col.main; c.strokeStyle = '#0d0a1c'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx, p.y - 12 + bobY); c.lineTo(cx - 6, p.y - 21 + bobY); c.lineTo(cx + 6, p.y - 21 + bobY); c.closePath(); c.stroke(); c.fill();
    }
  }

  /* ---------- Nouveaux éléments : tremplin, tapis, dalle fragile, portail ---------- */
  function drawSpring(c, x, y, pressed, t) {
    const sq = pressed ? 0.45 : 1;
    c.fillStyle = '#3b2430'; c.fillRect(x + 2, y + 18, TILE - 4, 14);
    c.fillStyle = '#ff5d73';                                   // ressort : 3 spires
    const top = y + 30 - 16 * sq;
    for (let k = 0; k < 3; k++) { const yy = top + k * (16 * sq / 3) + 2; c.fillRect(x + 5, yy, TILE - 10, 3.2); }
    c.fillStyle = '#ffd24a'; c.fillRect(x + 1, top - 5, TILE - 2, 5);
    c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(x + 1, top - 5, TILE - 2, 2);
    if (!pressed) {                                            // chevrons « saute ici »
      const bob = Math.sin(t / 7) * 2;
      c.fillStyle = '#ffd24a'; c.globalAlpha = 0.7;
      c.beginPath(); c.moveTo(x + 16, y - 16 + bob); c.lineTo(x + 22, y - 9 + bob); c.lineTo(x + 10, y - 9 + bob); c.closePath(); c.fill();
      c.globalAlpha = 1;
    }
  }

  function drawBelt(c, x, y, dir, t, flipped) {
    c.fillStyle = '#2a2236'; c.fillRect(x, y, TILE, TILE);
    c.fillStyle = flipped ? '#ffd24a' : '#bfc3d9'; c.fillRect(x, y, TILE, 7);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x, y + 7, TILE, 3);
    c.save(); c.beginPath(); c.rect(x, y, TILE, 7); c.clip();
    c.fillStyle = flipped ? '#8a5a00' : '#4a4868';
    const off = ((t * 0.6 * dir) % 16 + 16) % 16;
    for (let k = -1; k < 3; k++) {
      const cx = x + k * 16 + off;
      c.beginPath(); c.moveTo(cx, y + 1); c.lineTo(cx + 5 * dir, y + 3.5); c.lineTo(cx, y + 6); c.lineTo(cx + 2 * dir, y + 3.5); c.closePath(); c.fill();
    }
    c.restore();
    c.fillStyle = '#6a6788'; c.beginPath(); c.arc(x + 6, y + 21, 5, 0, 6.2832); c.arc(x + 26, y + 21, 5, 0, 6.2832); c.fill();
  }

  // état : 0 intacte, 1 se fissure (fragT), 2 tombée (restore)
  function drawFrag(c, x, y, k, G, t) {
    const T = G.fragT[k], R = G.fragR[k], L = G.L;
    if (R > 0) {
      const soon = R < 40 && ((t >> 2) & 1);
      c.strokeStyle = '#d9c28f'; c.globalAlpha = soon ? 0.8 : 0.22; c.setLineDash([2, 4]); c.lineWidth = 2;
      c.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4); c.setLineDash([]); c.globalAlpha = 1;
      return;
    }
    const sh = T > 0 ? (Math.random() - 0.5) * 2.4 * (1 - T / L.frag.delay + 0.3) : 0;
    c.save(); c.translate(sh, 0);
    c.fillStyle = '#9b8763'; c.fillRect(x, y, TILE, TILE);
    c.fillStyle = '#c7b185'; c.fillRect(x, y, TILE, 6);
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x, y, TILE, 2);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x, y + TILE - 4, TILE, 4);
    c.strokeStyle = '#4a3c26'; c.lineWidth = 1.5; c.beginPath();
    c.moveTo(x + 8, y + 8); c.lineTo(x + 13, y + 15); c.lineTo(x + 10, y + 22);
    if (T > 0) { c.moveTo(x + 24, y + 7); c.lineTo(x + 19, y + 14); c.lineTo(x + 23, y + 26); c.moveTo(x + 13, y + 15); c.lineTo(x + 20, y + 17); }
    c.stroke();
    c.restore();
  }

  function drawPortal(c, q, t) {
    const col = G_COL[q.g], cx = q.x + 16, cy = q.y + 16;
    c.fillStyle = '#0d0a1c'; c.globalAlpha = 0.55; c.beginPath(); c.ellipse(cx, cy, 13, 15, 0, 0, 6.2832); c.fill(); c.globalAlpha = 1;
    for (let k = 0; k < 3; k++) {
      const a = t / 14 + k * 2.09, r = 5 + k * 3.5;
      c.strokeStyle = col; c.globalAlpha = 0.9 - k * 0.2; c.lineWidth = 2.4;
      c.beginPath(); c.ellipse(cx, cy, r * 0.85, r * 1.05, a, a, a + 4.2); c.stroke();
    }
    c.globalAlpha = 0.8; c.strokeStyle = '#fff'; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(cx, cy, 14, 16, 0, 0, 6.2832); c.stroke(); c.globalAlpha = 1;
    c.strokeStyle = col; c.lineWidth = 3; c.globalAlpha = 0.6 + 0.25 * Math.sin(t / 8);
    c.beginPath(); c.ellipse(cx, cy, 15.5, 17.5, 0, 0, 6.2832); c.stroke(); c.globalAlpha = 1;
  }

  // Les minuteries vont à l'écran (jamais dans le monde) : on les dessine avec la transformation « écran »
  function drawTimers(c, G, t) {
    const L = G.L, items = [];
    for (let g = 1; g <= 3; g++) {
      if (G.bridge[g] > 0 && L.groupsWithBells[g]) items.push({ g, f: Math.min(1, G.bridge[g] / root.Sim.bellCfg(L, g).dur), kind: 'cloche' });
      const lc = root.Sim.latchCfg(L, g);
      if (lc > 0 && G.open[g] && G.latch[g] > 0 && G.latch[g] < lc) items.push({ g, f: G.latch[g] / lc, kind: 'grille' });
    }
    if (!items.length) return;
    const bw = 120, gap = 10, total = items.length * bw + (items.length - 1) * gap;
    let x = (W - total) / 2;
    items.forEach((it) => {
      const urgent = it.f < 0.25 && ((t >> 3) & 1);
      c.fillStyle = 'rgba(10,6,24,.82)'; rr(c, x, 10, bw, 14, 7); c.fill();
      c.fillStyle = urgent ? '#fff' : G_COL[it.g]; rr(c, x + 2, 12, Math.max(6, (bw - 4) * it.f), 10, 5); c.fill();
      x += bw + gap;
    });
  }

  /* ---------- Caméra : suit le milieu des joueurs vivants, dézoome quand ils s'écartent ---------- */
  const ZMIN = 0.6;
  const zoomOf = (L) => (L.cfg && L.cfg.zoom) || ((L.cols > 32 || L.nr > 16) ? 0.86 : 1);
  function newCam() { return { x: 0, y: 0, z: 1, init: false }; }
  function camTarget(G) {
    const L = G.L, zMax = zoomOf(L);
    const ps = G.players.filter((p) => !p.dead);
    const use = ps.length ? ps : G.players;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    use.forEach((p) => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x + PW); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y + PH); });
    const need = Math.max((x1 - x0 + 300) / W, (y1 - y0 + 200) / H);
    const z = Math.max(ZMIN, Math.min(zMax, 1 / need));
    const vw = W / z, vh = H / z;
    let tx = (x0 + x1) / 2 - vw / 2, ty = (y0 + y1) / 2 - vh / 2 - 14;
    tx = L.w > vw ? Math.max(0, Math.min(L.w - vw, tx)) : (L.w - vw) / 2;
    ty = L.h > vh ? Math.max(0, Math.min(L.h - vh, ty)) : (L.h - vh) / 2;
    return { x: tx, y: ty, z };
  }
  function updateCam(cam, G, snap) {
    const t = camTarget(G);
    if (snap || !cam.init) { cam.x = t.x; cam.y = t.y; cam.z = t.z; cam.init = true; return cam; }
    cam.z += (t.z - cam.z) * 0.06;
    const vw = W / cam.z, vh = H / cam.z, L = G.L;
    cam.x += (t.x - cam.x) * 0.14; cam.y += (t.y - cam.y) * 0.14;
    // le zoom qui bouge ne doit jamais découvrir le vide autour du niveau
    if (L.w > vw) cam.x = Math.max(0, Math.min(L.w - vw, cam.x)); else cam.x = (L.w - vw) / 2;
    if (L.h > vh) cam.y = Math.max(0, Math.min(L.h - vh, cam.y)); else cam.y = (L.h - vh) / 2;
    return cam;
  }

  /* ---------- Dessin complet d'une image ----------
     S = { G, theme, t (ms), you (0|1|-1), scale, cam:{x,y,z}, shake:{x,y} } */
  function draw(c, S) {
    const G = S.G, L = G.L, t = Math.floor(S.t / 16.67), sc = S.scale || 1;
    const th = THEMES[S.theme] || THEMES.meadow;
    const cam = S.cam || { x: Math.max(0, (L.w - W) / 2), y: Math.max(0, (L.h - H) / 2), z: 1 };
    const layer = staticLayer(L, S.theme, Math.min(2, Math.max(1, sc)));
    c.save();
    c.setTransform(sc, 0, 0, sc, 0, 0);
    root.Scenery.drawBackground(c, S.theme in THEMES ? S.theme : 'meadow', cam, L, S.t, sc);
    if (S.shake && (S.shake.x || S.shake.y)) c.translate(S.shake.x, S.shake.y);
    c.setTransform(sc * cam.z, 0, 0, sc * cam.z, (S.shake ? S.shake.x * sc : 0) - cam.x * sc * cam.z, (S.shake ? S.shake.y * sc : 0) - cam.y * sc * cam.z);
    c.drawImage(layer, 0, 0, L.w, L.h);

    // éléments décoratifs animés : tremplins, tapis, portails
    const rs = L._rs || (L._rs = (() => {
      const o = { springs: [], belts: [], vents: [] };
      for (let idx = 0; idx < L.base.length; idx++) {
        const tx = idx % L.cols, ty = (idx - tx) / L.cols;
        if (L.spring[idx]) o.springs.push({ tx, ty }); else if (L.conv[idx]) o.belts.push({ tx, ty, dir: L.conv[idx] });
        if (L.vent[idx]) o.vents.push({ tx, ty, g: L.vent[idx], top: L.vent[idx - L.cols] !== L.vent[idx] });
      }
      return o;
    })());
    const standOn = (tx, ty) => G.players.some((p) => !p.dead && p.onGround && Math.abs(p.y + PH - ty * TILE) < 0.6 && p.x < (tx + 1) * TILE && p.x + PW > tx * TILE);
    rs.springs.forEach((s) => drawSpring(c, s.tx * TILE, s.ty * TILE, standOn(s.tx, s.ty), t));
    const fl = L.belt.flip && G.open[L.belt.flip] ? -1 : 1;
    rs.belts.forEach((b) => drawBelt(c, b.tx * TILE, b.ty * TILE, b.dir * fl, t, fl < 0));

    // portes, drapeaux
    L.doors.forEach((d, k) => drawDoor(c, d, G.doorOcc[k], G.winHold, t, G.won));
    L.flags.forEach((f, k) => drawFlag(c, f, G.flagMask[k], G.flagDone[k], t));
    L.portals.forEach((q) => drawPortal(c, q, t));
    L.rspikes.forEach((sp) => drawRSpike(c, sp, root.Sim.spikeState(L, sp, G.t), t));
    rs.vents.forEach((v) => drawVentCell(c, v.tx * TILE, v.ty * TILE, v.g, !!G.open[v.g], t, v.top));
    // plaques, interrupteurs et pastilles
    L.plates.forEach((pl, k) => (pl.tog ? drawToggle(c, pl, G.tog[pl.g], t) : drawPlate(c, pl, G.plateOn[k])));
    L.bells.forEach((b, k) => drawBell(c, b, G.bellT[k], t));
    // cases dynamiques
    const per = L.rhythm.period, on = L.rhythm.on, half = per / 2, ph = G.t % per;
    const WARN = 14;
    for (let k = 0; k < L.dynCells.length; k++) {
      const idx = L.dynCells[k], tx = idx % L.cols, ty = (idx - tx) / L.cols, x = tx * TILE, y = ty * TILE;
      const solid = G.dyn[idx] === 1;
      if (L.fragAt[idx]) { drawFrag(c, x, y, L.fragAt[idx] - 1, G, t); continue; }
      if (L.gateG[idx]) { if (L.inv[idx]) drawBridgeCell(c, x, y, L.gateG[idx], solid, 999, t); else drawGateCell(c, x, y, L.gateG[idx], solid, t); }
      else if (L.bridgeG[idx]) { const g = L.bridgeG[idx]; if (L.bridgeDoor[g]) drawGateCell(c, x, y, g, solid, t); else drawBridgeCell(c, x, y, g, solid, G.bridge[g], t); }
      else {
        const isA = L.rhA[idx] === 1;
        const start = isA ? 0 : half;
        const rel = (ph - start + per) % per;           // ticks écoulés depuis le début de la phase « présent »
        const present = rel < on;
        const warn = present && on - rel <= WARN;
        const soon = !present && per - rel <= WARN;
        drawRhythmCell(c, x, y, isA ? 'r' : 's', solid, warn, soon, t);
      }
    }
    if (G.custom) G.custom.forEach((q, i) => {                  // entraînement : point de retour posé
      const bx = q.x + PW / 2, by = q.y + PH;
      c.strokeStyle = P_COL[i].main; c.lineWidth = 2; c.globalAlpha = 0.55 + 0.25 * Math.sin(t / 10); c.setLineDash([3, 4]);
      c.beginPath(); c.ellipse(bx, by - 1, 15, 4.5, 0, 0, 6.2832); c.stroke(); c.setLineDash([]);
      c.fillStyle = P_COL[i].main; c.fillRect(bx - 1, by - 22, 2, 18); c.beginPath(); c.moveTo(bx + 1, by - 22); c.lineTo(bx + 9, by - 18.5); c.lineTo(bx + 1, by - 15); c.closePath(); c.fill();
      c.globalAlpha = 1;
    });
    // joueurs
    G.players.forEach((p, i) => drawPlayer(c, p, i, t, S.you === i, S.t, G.won));
    FX.draw(c);
    c.setTransform(sc, 0, 0, sc, 0, 0);
    drawTimers(c, G, t);
    c.restore();
  }

  // Vignette d'un niveau (menu de sélection) : le niveau entier, à son échelle, centré dans w × h
  function thumb(def, themeName, w, h) {
    const L = root.Sim.parseLevel(def);
    h = h || Math.round(w * 0.5);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    const k = Math.min(w / L.w, h / L.h), tw = L.w * k, th = L.h * k, ox = (w - tw) / 2, oy = (h - th) / 2;
    root.Scenery.drawThumbBackground(c, themeName in THEMES ? themeName : 'meadow', w, h);
    c.drawImage(staticLayer(L, themeName, 1), ox, oy, tw, th);
    c.translate(ox, oy); c.scale(k, k);
    L.dynCells.forEach((idx) => {
      const tx = idx % L.cols, ty = (idx - tx) / L.cols;
      c.globalAlpha = 0.85;
      c.fillStyle = L.fragAt[idx] ? '#c7b185' : L.gateG[idx] ? G_COL[L.gateG[idx]] : L.bridgeG[idx] ? G_COL[L.bridgeG[idx]] : (L.rhA[idx] ? RHY.r : RHY.s);
      c.fillRect(tx * TILE + 4, ty * TILE + (L.bridgeG[idx] ? 0 : 3), TILE - 8, L.bridgeG[idx] ? 8 : TILE - 6);
    });
    c.globalAlpha = 1;
    for (let idx = 0; idx < L.base.length; idx++) {
      const tx = idx % L.cols, ty = (idx - tx) / L.cols;
      if (L.spring[idx]) { c.fillStyle = '#ff5d73'; c.fillRect(tx * TILE, ty * TILE, TILE, 12); }
      else if (L.conv[idx]) { c.fillStyle = '#bfc3d9'; c.fillRect(tx * TILE, ty * TILE, TILE, 8); }
    }
    L.portals.forEach((q) => { c.strokeStyle = G_COL[q.g]; c.lineWidth = 6; c.beginPath(); c.ellipse(q.x + 16, q.y + 16, 11, 14, 0, 0, 6.2832); c.stroke(); });
    for (let idx = 0; idx < L.base.length; idx++) if (L.vent[idx]) { const tx = idx % L.cols, ty = (idx - tx) / L.cols; c.globalAlpha = 0.4; c.fillStyle = G_COL[L.vent[idx]]; c.fillRect(tx * TILE + 6, ty * TILE, TILE - 12, TILE); c.globalAlpha = 1; }
    L.rspikes.forEach((sp) => { c.fillStyle = '#ff6b7a'; c.globalAlpha = 0.8; c.beginPath(); c.moveTo(sp.tx * TILE + 3, sp.ty * TILE + TILE); c.lineTo(sp.tx * TILE + 16, sp.ty * TILE + 12); c.lineTo(sp.tx * TILE + 29, sp.ty * TILE + TILE); c.closePath(); c.fill(); c.globalAlpha = 1; });
    L.plates.forEach((p) => { c.fillStyle = G_COL[p.g]; if (p.tog) { c.beginPath(); c.arc(p.x + 16, p.y - 4, 9, 0, 6.2832); c.fill(); } else c.fillRect(p.x, p.y, p.w, 8); });
    L.bells.forEach((b) => { c.fillStyle = GOLD; c.beginPath(); c.arc(b.x + 16, b.y + 16, 14, 0, 6.2832); c.fill(); c.strokeStyle = G_COL[b.g]; c.lineWidth = 5; c.stroke(); });
    L.doors.forEach((d) => { c.strokeStyle = GOLD; c.lineWidth = 5; c.strokeRect(d.x + 4, d.y + 4, d.w - 8, d.h - 4); });
    L.spawns.forEach((s, i) => { c.fillStyle = P_COL[i].main; c.fillRect(s.x, s.y, PW, PH); });
    return cv;
  }

  root.Render = { draw, thumb, FX, THEMES, P_COL, PALETTE, setColors, drawCharacter, G_COL, W, H, newCam, updateCam };
})(window);
