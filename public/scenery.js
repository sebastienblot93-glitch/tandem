// TANDEM — décors : fond en couches (parallaxe), ambiance animée, tuiles texturées et accessoires par chapitre.
// Rien ici n'a d'effet sur le jeu : tout est du dessin, piloté par render.js.
(function (root) {
  'use strict';
  const W = 960, H = 480, TILE = 32, TAU = Math.PI * 2;

  function seeded(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mixc = (a, b, k) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };

  /* ---------- Palettes de décor ---------- */
  const SC = {
    meadow: {
      sky: ['#4d9fdc', '#8fd3e6', '#d8f1d2'], hill: ['#9fd8a8', '#6fc07a', '#43a45a', '#2f8049'],
      tile: '#86593b', tileDark: '#5b3a27', tileLight: '#9d6c49', cap: '#62c850', capLight: '#9be66f', capDark: '#3f9a3c', line: '#4a2f20',
    },
    arcane: {
      sky: ['#1a1450', '#3b2c86', '#8d5cc4'], hill: ['#43347f', '#32276a', '#251d52', '#171236'],
      tile: '#4c4196', tileDark: '#2e2766', tileLight: '#6a5fc0', cap: '#a99cff', capLight: '#d3cbff', capDark: '#6f62d1', line: '#1a1446',
    },
    sky: {
      sky: ['#4f63cf', '#f08fb0', '#ffd7a0'], hill: ['#ffc6b5', '#f5a3b8', '#d482b4', '#a863a9'],
      tile: '#9aa8dd', tileDark: '#6f7cbf', tileLight: '#bfc9f3', cap: '#ffffff', capLight: '#ffffff', capDark: '#cfd8f8', line: '#4b5598',
    },
    forge: {
      sky: ['#1d0a18', '#6a1f1a', '#e2651f'], hill: ['#5a1c18', '#3b1213', '#27090e', '#16060a'],
      tile: '#4b2b2a', tileDark: '#2c1717', tileLight: '#6a3e38', cap: '#8a4332', capLight: '#ffa24c', capDark: '#5a2a22', line: '#190b0c',
    },
    ice: {
      sky: ['#10345a', '#4a9fd6', '#d3f0fc'], hill: ['#c5e6f6', '#93cbe9', '#66abd8', '#3f86b8'],
      tile: '#6fa8cf', tileDark: '#4a7fa8', tileLight: '#a9d6ee', cap: '#f2fbff', capLight: '#ffffff', capDark: '#bfe3f2', line: '#2b5679',
    },
    ruins: {
      sky: ['#35294f', '#b9577a', '#f4b46c'], hill: ['#8f5d6e', '#744659', '#573447', '#3b2536'],
      tile: '#8b7a64', tileDark: '#5e5242', tileLight: '#ac9c84', cap: '#79a35a', capLight: '#a8d27c', capDark: '#4f7a40', line: '#352d24',
    },
    space: {
      sky: ['#04020d', '#150b3d', '#3d1c72'], hill: ['#221a5c', '#17113f', '#0f0b2c', '#080618'],
      tile: '#2b3160', tileDark: '#171b3d', tileLight: '#4b56a4', cap: '#6be0ff', capLight: '#cdf7ff', capDark: '#2f9fc8', line: '#0a0c24',
    },
  };
  const scOf = (name) => SC[name] || SC.meadow;

  /* ---------- Couches de fond (bandes périodiques, générées à la demande) ---------- */
  const SW = W;                                       // largeur d'une bande = un écran ; elle se répète sans couture
  const stripCache = new Map();
  const wrapped = (x, r, f) => { f(x); if (x - r < 0) f(x + SW); if (x + r > SW) f(x - SW); };

  function ridgeFn(rnd, base, amp) {
    const ks = [1, 2, 3, 5].map((n, i) => ({ n, a: amp / (1 + i * 0.9), ph: rnd() * TAU }));
    return (x) => base - ks.reduce((s, k) => s + k.a * (0.5 + 0.5 * Math.sin(TAU * k.n * x / SW + k.ph)), 0);
  }
  function fillRidge(c, fn, color) {
    c.fillStyle = color; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= SW; x += 6) c.lineTo(x, fn(x));
    c.lineTo(SW, H); c.closePath(); c.fill();
  }
  function cloud(c, x, y, s, col, shade) {
    c.fillStyle = shade; [[0, 6, 22], [24, 0, 28], [52, 6, 22], [26, 12, 34]].forEach(([dx, dy, r]) => { c.beginPath(); c.arc(x + dx * s, y + (dy + 4) * s, r * s, 0, TAU); c.fill(); });
    c.fillStyle = col; [[0, 6, 22], [24, 0, 28], [52, 6, 22], [26, 10, 30]].forEach(([dx, dy, r]) => { c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, TAU); c.fill(); });
  }
  function lollipopTree(c, x, y, s, a, b) {
    c.fillStyle = '#6b4630'; c.fillRect(x - 3 * s, y - 20 * s, 6 * s, 22 * s);
    c.fillStyle = b; c.beginPath(); c.arc(x, y - 30 * s, 17 * s, 0, TAU); c.fill();
    c.fillStyle = a; c.beginPath(); c.arc(x - 3 * s, y - 33 * s, 14 * s, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(x - 8 * s, y - 38 * s, 5 * s, 0, TAU); c.fill();
  }
  function pine(c, x, y, s, col) {
    c.fillStyle = col;
    for (let k = 0; k < 3; k++) { const w = (22 - k * 5) * s, top = y - (18 + k * 16) * s; c.beginPath(); c.moveTo(x - w, top + 18 * s); c.lineTo(x, top - 6 * s); c.lineTo(x + w, top + 18 * s); c.closePath(); c.fill(); }
    c.fillRect(x - 2 * s, y - 4 * s, 4 * s, 6 * s);
  }
  function tower(c, x, y, w, h, col, win, rnd) {
    c.fillStyle = col; c.fillRect(x - w / 2, y - h, w, h + 4);
    c.beginPath(); c.moveTo(x - w / 2 - 4, y - h); c.lineTo(x, y - h - w * 1.1); c.lineTo(x + w / 2 + 4, y - h); c.closePath(); c.fill();
    c.fillRect(x - w / 2 - 3, y - h - 2, w + 6, 4);
    c.fillStyle = win;
    for (let k = 0; k < 3; k++) if (rnd() > 0.35) c.fillRect(x - 2, y - h + 10 + k * 18, 4, 7);
  }
  function mountain(c, x, y, w, h, col, snow) {
    c.fillStyle = col; c.beginPath(); c.moveTo(x - w, y + 2); c.lineTo(x - w * 0.12, y - h); c.lineTo(x + w * 0.2, y - h * 0.82); c.lineTo(x + w, y + 2); c.closePath(); c.fill();
    if (snow) { c.fillStyle = snow; c.beginPath(); c.moveTo(x - w * 0.12, y - h); c.lineTo(x + w * 0.2, y - h * 0.82); c.lineTo(x + w * 0.1, y - h * 0.7); c.lineTo(x - w * 0.02, y - h * 0.8); c.lineTo(x - w * 0.2, y - h * 0.68); c.closePath(); c.fill(); }
  }
  function volcano(c, x, y, w, h) {
    c.fillStyle = '#1b0a10'; c.beginPath(); c.moveTo(x - w, y + 2); c.lineTo(x - w * 0.22, y - h); c.lineTo(x + w * 0.22, y - h); c.lineTo(x + w, y + 2); c.closePath(); c.fill();
    const g = c.createLinearGradient(0, y - h - 10, 0, y - h + 36); g.addColorStop(0, 'rgba(255,170,60,.95)'); g.addColorStop(1, 'rgba(255,90,30,0)');
    c.fillStyle = g; c.fillRect(x - w * 0.24, y - h - 8, w * 0.48, 46);
    c.strokeStyle = 'rgba(255,120,40,.7)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 6, y - h + 8); c.quadraticCurveTo(x - 20, y - h * 0.5, x - w * 0.5, y); c.stroke();
    c.beginPath(); c.moveTo(x + 8, y - h + 8); c.quadraticCurveTo(x + 24, y - h * 0.45, x + w * 0.46, y); c.stroke();
  }
  function island(c, x, y, w, col, grass, rnd) {
    c.fillStyle = col; c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x - w * 0.6, y + w * 0.9, x, y + w * 1.15); c.quadraticCurveTo(x + w * 0.6, y + w * 0.9, x + w, y); c.closePath(); c.fill();
    c.fillStyle = grass; c.beginPath(); c.ellipse(x, y, w, w * 0.22, 0, 0, TAU); c.fill();
    if (rnd() > 0.3) lollipopTree(c, x + (rnd() - 0.5) * w, y - 2, 0.55, '#7fd27a', '#4bab62');
  }
  function gear(c, x, y, r, col) {
    c.fillStyle = col; c.beginPath();
    for (let k = 0; k < 12; k++) { const a0 = (k / 12) * TAU, a1 = ((k + 0.5) / 12) * TAU; c.lineTo(x + Math.cos(a0) * r * 1.18, y + Math.sin(a0) * r * 1.18); c.lineTo(x + Math.cos(a1) * r * 1.18, y + Math.sin(a1) * r * 1.18); c.lineTo(x + Math.cos(a1) * r * 0.95, y + Math.sin(a1) * r * 0.95); c.lineTo(x + Math.cos(a0 + TAU / 12) * r * 0.95, y + Math.sin(a0 + TAU / 12) * r * 0.95); }
    c.closePath(); c.fill();
    c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(x, y, r * 0.38, 0, TAU); c.fill(); c.globalCompositeOperation = 'source-over';
  }

  function column(c, x, y, w, h, col, light, broken) {
    c.fillStyle = col; c.fillRect(x - w / 2, y - h, w, h + 3);
    c.fillStyle = light; c.fillRect(x - w / 2, y - h, w * 0.28, h + 3);
    c.fillStyle = col; c.fillRect(x - w / 2 - 3, y - 6, w + 6, 8); c.fillRect(x - w / 2 - 2, y - h - 4, w + 4, 6);
    if (broken) { c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(x - w / 2 - 4, y - h - 6, w + 8, 4); }
  }
  function arch(c, x, y, w, h, col) {
    c.fillStyle = col; c.fillRect(x - w, y - h, 12, h + 3); c.fillRect(x + w - 12, y - h, 12, h + 3);
    c.beginPath(); c.moveTo(x - w, y - h + 6); c.quadraticCurveTo(x, y - h - w * 0.9, x + w, y - h + 6); c.lineTo(x + w - 12, y - h + 6); c.quadraticCurveTo(x, y - h - w * 0.9 + 14, x - w + 12, y - h + 6); c.closePath(); c.fill();
  }
  function planet(c, x, y, r, a, b, ring) {
    const g = c.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, a); g.addColorStop(1, b);
    if (ring) { c.strokeStyle = ring; c.lineWidth = r * 0.12; c.beginPath(); c.ellipse(x, y, r * 1.7, r * 0.42, -0.35, Math.PI, TAU); c.stroke(); }
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    if (ring) { c.strokeStyle = ring; c.lineWidth = r * 0.12; c.beginPath(); c.ellipse(x, y, r * 1.7, r * 0.42, -0.35, 0, Math.PI); c.stroke(); }
  }
  function rock(c, x, y, r, col, hi, rnd) {
    c.fillStyle = col; c.beginPath();
    for (let k = 0; k < 9; k++) { const a = (k / 9) * TAU, rr = r * (0.72 + rnd() * 0.4); c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.78); }
    c.closePath(); c.fill();
    c.fillStyle = hi; c.globalAlpha = 0.35; c.beginPath(); c.ellipse(x - r * 0.25, y - r * 0.3, r * 0.4, r * 0.2, -0.4, 0, TAU); c.fill(); c.globalAlpha = 1;
  }
  function spire(c, x, y, w, h, col, hi) {
    c.fillStyle = col; c.beginPath(); c.moveTo(x - w, y + 2); c.lineTo(x - w * 0.2, y - h); c.lineTo(x + w * 0.4, y - h * 0.7); c.lineTo(x + w, y + 2); c.closePath(); c.fill();
    c.fillStyle = hi; c.globalAlpha = 0.5; c.beginPath(); c.moveTo(x - w * 0.2, y - h); c.lineTo(x + w * 0.05, y - h * 0.5); c.lineTo(x - w * 0.5, y - h * 0.2); c.closePath(); c.fill(); c.globalAlpha = 1;
  }

  // spécification des couches par thème : { f: facteur horizontal, fy: décalage vertical, draw(c, rnd) }
  const LAYERS = {
    meadow: [
      { f: 0.04, fy: 0.25, draw(c, rnd) { const fn = ridgeFn(rnd, 330, 70); fillRidge(c, fn, SC.meadow.hill[0]); } },
      { f: 0.12, fy: 0.45, draw(c, rnd) { const fn = ridgeFn(rnd, 372, 60); fillRidge(c, fn, SC.meadow.hill[1]); for (let k = 0; k < 7; k++) { const x = rnd() * SW; wrapped(x, 30, (xx) => lollipopTree(c, xx, fn(xx) + 4, 0.7, '#86d48a', '#58b36a')); } } },
      { f: 0.26, fy: 0.7, draw(c, rnd) { const fn = ridgeFn(rnd, 412, 44); fillRidge(c, fn, SC.meadow.hill[2]); for (let k = 0; k < 6; k++) { const x = rnd() * SW; wrapped(x, 40, (xx) => lollipopTree(c, xx, fn(xx) + 6, 1, '#5fc46a', '#3b9a52')); } for (let k = 0; k < 16; k++) { const x = rnd() * SW, y = fn(x) + 14 + rnd() * 20; c.fillStyle = ['#ff7ea8', '#ffe066', '#ffffff'][k % 3]; c.beginPath(); c.arc(x, y, 2.4, 0, TAU); c.fill(); } } },
    ],
    arcane: [
      { f: 0.03, fy: 0.2, draw(c, rnd) { for (let k = 0; k < 6; k++) { const x = (k + rnd() * 0.6) * SW / 6; wrapped(x, 150, (xx) => mountain(c, xx, 340, 130 + rnd() * 50, 90 + rnd() * 70, SC.arcane.hill[0], 'rgba(205,190,255,.35)')); } c.fillStyle = SC.arcane.hill[0]; c.fillRect(0, 338, SW, H); } },
      { f: 0.1, fy: 0.42, draw(c, rnd) { const fn = ridgeFn(rnd, 380, 36); fillRidge(c, fn, SC.arcane.hill[1]); for (let k = 0; k < 4; k++) { const x = (k + 0.2 + rnd() * 0.6) * SW / 4; wrapped(x, 30, (xx) => tower(c, xx, fn(xx) + 6, 22 + rnd() * 14, 60 + rnd() * 70, SC.arcane.hill[1], '#ffd77a', rnd)); } } },
      { f: 0.24, fy: 0.7, draw(c, rnd) { const fn = ridgeFn(rnd, 420, 36); fillRidge(c, fn, SC.arcane.hill[2]); for (let k = 0; k < 9; k++) { const x = rnd() * SW; wrapped(x, 30, (xx) => pine(c, xx, fn(xx) + 8, 0.8 + rnd() * 0.5, SC.arcane.hill[3])); } } },
    ],
    sky: [
      { f: 0.03, fy: 0.2, draw(c, rnd) { for (let k = 0; k < 4; k++) { const x = (k + 0.2 + rnd() * 0.6) * SW / 4; wrapped(x, 90, (xx) => island(c, xx, 200 + rnd() * 110, 34 + rnd() * 26, '#b9709f', '#ffb3b8', rnd)); } } },
      { f: 0.1, fy: 0.4, draw(c, rnd) { for (let k = 0; k < 5; k++) { const x = rnd() * SW, y = 300 + rnd() * 70; wrapped(x, 90, (xx) => cloud(c, xx, y, 1 + rnd() * 0.8, 'rgba(255,226,214,.88)', 'rgba(222,150,190,.7)')); } } },
      { f: 0.22, fy: 0.62, draw(c, rnd) { const fn = ridgeFn(rnd, 430, 40); fillRidge(c, fn, 'rgba(236,150,190,.96)'); for (let k = 0; k < 5; k++) { const x = rnd() * SW; wrapped(x, 90, (xx) => cloud(c, xx, 392 + rnd() * 40, 1.3 + rnd() * 0.8, 'rgba(255,240,232,.97)', 'rgba(232,160,200,.9)')); } } },
    ],
    forge: [
      { f: 0.03, fy: 0.2, draw(c, rnd) { for (let k = 0; k < 3; k++) { const x = (k + 0.3 + rnd() * 0.4) * SW / 3; wrapped(x, 220, (xx) => volcano(c, xx, 360, 150 + rnd() * 60, 120 + rnd() * 60)); } c.fillStyle = '#1b0a10'; c.fillRect(0, 358, SW, H); } },
      { f: 0.1, fy: 0.42, draw(c, rnd) { for (let k = 0; k < 7; k++) { const x = (k + rnd() * 0.7) * SW / 7; wrapped(x, 90, (xx) => gear(c, xx, 250 + rnd() * 130, 26 + rnd() * 34, 'rgba(60,20,24,.85)')); } const fn = ridgeFn(rnd, 396, 44); fillRidge(c, fn, SC.forge.hill[1]); } },
      { f: 0.24, fy: 0.7, draw(c, rnd) { const fn = ridgeFn(rnd, 430, 34); fillRidge(c, fn, SC.forge.hill[2]); c.fillStyle = SC.forge.hill[3]; for (let k = 0; k < 12; k++) { const x = rnd() * SW, h = 16 + rnd() * 36; wrapped(x, 20, (xx) => { c.beginPath(); c.moveTo(xx - 10, fn(xx) + 4); c.lineTo(xx, fn(xx) - h); c.lineTo(xx + 10, fn(xx) + 4); c.closePath(); c.fill(); }); } } },
    ],
    ice: [
      { f: 0.03, fy: 0.2, draw(c, rnd) { for (let k = 0; k < 6; k++) { const x = (k + rnd() * 0.6) * SW / 6; wrapped(x, 170, (xx) => mountain(c, xx, 350, 140 + rnd() * 50, 100 + rnd() * 90, SC.ice.hill[0], 'rgba(255,255,255,.85)')); } c.fillStyle = SC.ice.hill[0]; c.fillRect(0, 348, SW, H); } },
      { f: 0.1, fy: 0.42, draw(c, rnd) { const fn = ridgeFn(rnd, 392, 38); fillRidge(c, fn, SC.ice.hill[1]); for (let k = 0; k < 8; k++) { const x = rnd() * SW; wrapped(x, 30, (xx) => pine(c, xx, fn(xx) + 6, 0.8 + rnd() * 0.5, '#e8f7ff')); } } },
      { f: 0.24, fy: 0.7, draw(c, rnd) { const fn = ridgeFn(rnd, 426, 32); fillRidge(c, fn, SC.ice.hill[2]); for (let k = 0; k < 11; k++) { const x = rnd() * SW; wrapped(x, 24, (xx) => spire(c, xx, fn(xx) + 4, 8 + rnd() * 8, 22 + rnd() * 30, 'rgba(210,240,255,.9)', '#ffffff')); } } },
    ],
    ruins: [
      { f: 0.03, fy: 0.2, draw(c, rnd) { const fn = ridgeFn(rnd, 340, 46); fillRidge(c, fn, SC.ruins.hill[0]); for (let k = 0; k < 3; k++) { const x = (k + 0.3 + rnd() * 0.4) * SW / 3; wrapped(x, 90, (xx) => arch(c, xx, fn(xx) + 4, 44 + rnd() * 20, 90 + rnd() * 50, SC.ruins.hill[0])); } } },
      { f: 0.1, fy: 0.42, draw(c, rnd) { const fn = ridgeFn(rnd, 388, 34); fillRidge(c, fn, SC.ruins.hill[1]); for (let k = 0; k < 7; k++) { const x = (k + rnd() * 0.7) * SW / 7; wrapped(x, 20, (xx) => column(c, xx, fn(xx) + 6, 16 + rnd() * 6, 40 + rnd() * 60, SC.ruins.hill[1], 'rgba(255,200,170,.18)', rnd() > 0.5)); } } },
      { f: 0.24, fy: 0.7, draw(c, rnd) { const fn = ridgeFn(rnd, 428, 28); fillRidge(c, fn, SC.ruins.hill[2]); for (let k = 0; k < 8; k++) { const x = rnd() * SW; wrapped(x, 20, (xx) => { c.fillStyle = SC.ruins.hill[3]; c.fillRect(xx - 5, fn(xx) - 14 - rnd() * 18, 10, 30); }); } for (let k = 0; k < 14; k++) { const x = rnd() * SW; wrapped(x, 20, (xx) => { c.fillStyle = '#5d8a4a'; c.beginPath(); c.arc(xx, fn(xx) + 4, 6 + rnd() * 6, Math.PI, 0); c.fill(); }); } } },
    ],
    space: [
      { f: 0.02, fy: 0.15, draw(c, rnd) { for (let k = 0; k < 3; k++) { const x = (k + 0.5) * SW / 3 + (rnd() - 0.5) * 80, y = 120 + rnd() * 200, r = 60 + rnd() * 70; const gg = c.createRadialGradient(x, y, 0, x, y, r * 3); gg.addColorStop(0, ['rgba(130,90,255,.28)', 'rgba(60,200,255,.22)', 'rgba(255,90,170,.2)'][k]); gg.addColorStop(1, 'rgba(0,0,0,0)'); wrapped(x, r * 3, (xx) => { const g2 = c.createRadialGradient(xx, y, 0, xx, y, r * 3); g2.addColorStop(0, ['rgba(130,90,255,.28)', 'rgba(60,200,255,.22)', 'rgba(255,90,170,.2)'][k]); g2.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g2; c.fillRect(xx - r * 3, y - r * 3, r * 6, r * 6); }); } } },
      { f: 0.06, fy: 0.3, draw(c, rnd) { planet(c, 250, 250, 70, '#8f7bff', '#2c1f78', 'rgba(210,190,255,.55)'); planet(c, 720, 170, 36, '#ffb27a', '#7a2f2f', null); planet(c, 880, 340, 22, '#7be0c8', '#1c5a63', null); } },
      { f: 0.16, fy: 0.55, draw(c, rnd) { for (let k = 0; k < 9; k++) { const x = rnd() * SW, y = 260 + rnd() * 190; wrapped(x, 40, (xx) => rock(c, xx, y, 10 + rnd() * 22, SC.space.hill[0], '#8fa0ff', rnd)); } } },
      { f: 0.3, fy: 0.75, draw(c, rnd) { for (let k = 0; k < 12; k++) { const x = rnd() * SW, y = 330 + rnd() * 150; wrapped(x, 30, (xx) => rock(c, xx, y, 5 + rnd() * 12, SC.space.hill[1], '#7684d8', rnd)); } } },
    ],
  };

  function strips(theme, tier) {
    const key = theme + '|' + tier;
    if (stripCache.has(key)) return stripCache.get(key);
    // on ne garde que le thème courant (et le précédent) : les bandes pèsent quelques Mo
    if (stripCache.size > 3) stripCache.delete(stripCache.keys().next().value);
    const rnd = seeded('scenery' + theme);
    const out = (LAYERS[theme] || LAYERS.meadow).map((spec) => {
      const cv = document.createElement('canvas');
      cv.width = Math.round(SW * tier); cv.height = Math.round(H * tier);
      const c = cv.getContext('2d'); c.scale(tier, tier);
      spec.draw(c, rnd);
      return { cv, f: spec.f, fy: spec.fy };
    });
    stripCache.set(key, out);
    return out;
  }

  /* ---------- Ambiance animée (aucun état : tout est calculé à partir du temps) ---------- */
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  function drawSky(c, name, v) {
    const p = scOf(name).sky;
    const g = c.createLinearGradient(0, 0, 0, H);
    // en montant dans un niveau haut, le ciel s'éloigne de l'horizon
    const hi = 1 - v;
    g.addColorStop(0, mixc(p[0], '#000000', 0.18 * hi));
    g.addColorStop(0.55, mixc(p[1], p[0], 0.45 * hi));
    g.addColorStop(1, mixc(p[2], p[1], 0.55 * hi));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }

  function ambientBack(c, name, cam, ms, v) {
    const t = ms / 1000, px = cam.x;
    if (name === 'meadow') {
      // soleil
      const sx = 780 - px * 0.02, sy = 86 + (1 - v) * 90;
      const g = c.createRadialGradient(sx, sy, 6, sx, sy, 150); g.addColorStop(0, 'rgba(255,250,200,.95)'); g.addColorStop(0.18, 'rgba(255,240,170,.55)'); g.addColorStop(1, 'rgba(255,240,170,0)');
      c.fillStyle = g; c.fillRect(sx - 160, sy - 160, 320, 320);
      c.fillStyle = '#fff6c2'; c.beginPath(); c.arc(sx, sy, 26, 0, TAU); c.fill();
      for (let k = 0; k < 6; k++) { const x = ((hash(k + 1) * (W + 260) + t * (7 + hash(k + 9) * 9) - px * (0.05 + k * 0.012)) % (W + 260) + (W + 260)) % (W + 260) - 130; cloud(c, x, 50 + hash(k + 20) * 150 + (1 - v) * 70, 0.9 + hash(k + 30) * 0.7, 'rgba(255,255,255,.92)', 'rgba(188,222,240,.8)'); }
    } else if (name === 'arcane') {
      for (let k = 0; k < 70; k++) {
        const x = (hash(k * 3 + 1) * W - px * 0.015 * (1 + (k % 3)) + W * 4) % W, y = hash(k * 3 + 2) * (H * 0.75);
        const a = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.6 + hash(k) * 1.4) + k)); c.globalAlpha = a * (0.5 + (1 - v) * 0.5);
        c.fillStyle = '#fff'; const s = 1 + hash(k + 40) * 1.8; c.fillRect(x, y + (1 - v) * 0, s, s);
      }
      c.globalAlpha = 1;
      const mx = 190 - px * 0.015, my = 92 + (1 - v) * 60;
      const g = c.createRadialGradient(mx, my, 10, mx, my, 120); g.addColorStop(0, 'rgba(210,200,255,.5)'); g.addColorStop(1, 'rgba(210,200,255,0)');
      c.fillStyle = g; c.fillRect(mx - 130, my - 130, 260, 260);
      c.fillStyle = '#efeaff'; c.beginPath(); c.arc(mx, my, 30, 0, TAU); c.fill();
      c.fillStyle = scOf('arcane').sky[1]; c.beginPath(); c.arc(mx + 13, my - 6, 27, 0, TAU); c.fill();     // croissant
    } else if (name === 'sky') {
      const sx = 700 - px * 0.02, sy = 330 + (1 - v) * 110;
      const g = c.createRadialGradient(sx, sy, 10, sx, sy, 230); g.addColorStop(0, 'rgba(255,240,190,1)'); g.addColorStop(0.25, 'rgba(255,200,150,.55)'); g.addColorStop(1, 'rgba(255,170,150,0)');
      c.fillStyle = g; c.fillRect(sx - 240, sy - 240, 480, 480);
      c.fillStyle = '#fff3c4'; c.beginPath(); c.arc(sx, sy, 38, 0, TAU); c.fill();
      for (let k = 0; k < 5; k++) { const x = ((hash(k + 5) * (W + 260) + t * (9 + hash(k + 11) * 8) - px * 0.06) % (W + 260) + (W + 260)) % (W + 260) - 130; cloud(c, x, 40 + hash(k + 21) * 160 + (1 - v) * 60, 0.8 + hash(k + 31) * 0.6, 'rgba(255,238,230,.9)', 'rgba(232,160,205,.75)'); }
    } else if (name === 'forge') {
      const g = c.createLinearGradient(0, H * 0.45, 0, H); g.addColorStop(0, 'rgba(255,120,40,0)'); g.addColorStop(1, `rgba(255,110,30,${0.28 + 0.1 * Math.sin(t * 1.7)})`);
      c.fillStyle = g; c.fillRect(0, H * 0.45, W, H * 0.55);
    } else if (name === 'ice') {
      for (let b = 0; b < 3; b++) {                               // aurore boréale
        c.beginPath(); c.moveTo(0, 0);
        for (let x = 0; x <= W; x += 20) c.lineTo(x, 60 + b * 34 + (1 - v) * 40 + Math.sin(x / 120 + t * 0.5 + b * 2) * 20);
        c.lineTo(W, 0); c.closePath();
        const g = c.createLinearGradient(0, 0, 0, 160 + b * 34); g.addColorStop(0, 'rgba(120,255,200,0)'); g.addColorStop(1, `rgba(${b % 2 ? '140,200,255' : '110,255,190'},${0.16 + 0.05 * Math.sin(t + b)})`);
        c.fillStyle = g; c.fill();
      }
      const sx = 160 - px * 0.02, sy = 120 + (1 - v) * 80;
      const gs = c.createRadialGradient(sx, sy, 4, sx, sy, 110); gs.addColorStop(0, 'rgba(255,255,255,.9)'); gs.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gs; c.fillRect(sx - 120, sy - 120, 240, 240); c.fillStyle = '#fff'; c.beginPath(); c.arc(sx, sy, 18, 0, TAU); c.fill();
    } else if (name === 'ruins') {
      const sx = 620 - px * 0.02, sy = 300 + (1 - v) * 120;
      const g = c.createRadialGradient(sx, sy, 10, sx, sy, 260); g.addColorStop(0, 'rgba(255,230,170,.95)'); g.addColorStop(0.3, 'rgba(255,170,120,.5)'); g.addColorStop(1, 'rgba(255,120,120,0)');
      c.fillStyle = g; c.fillRect(sx - 270, sy - 270, 540, 540);
      c.fillStyle = '#ffe9b0'; c.beginPath(); c.arc(sx, sy, 46, 0, TAU); c.fill();
      for (let k = 0; k < 4; k++) { const x = ((hash(k + 5) * (W + 260) + t * (6 + hash(k + 11) * 6) - px * 0.05) % (W + 260) + (W + 260)) % (W + 260) - 130; cloud(c, x, 50 + hash(k + 21) * 140 + (1 - v) * 60, 0.8 + hash(k + 31) * 0.6, 'rgba(255,200,170,.55)', 'rgba(190,100,140,.5)'); }
    } else if (name === 'space') {
      for (let k = 0; k < 120; k++) {
        const x = (hash(k * 3 + 1) * W - px * 0.01 * (1 + (k % 4)) + W * 4) % W, y = hash(k * 3 + 2) * H;
        c.globalAlpha = (0.3 + 0.7 * Math.abs(Math.sin(t * (0.5 + hash(k) * 1.6) + k))) * 0.9; c.fillStyle = k % 7 === 0 ? '#9fe8ff' : '#fff';
        const sz = 0.8 + hash(k + 40) * 1.8; c.fillRect(x, y, sz, sz);
      }
      c.globalAlpha = 1;
      const ph = (t * 0.25) % 1;                                  // étoile filante
      if (ph < 0.12) { const k = ph / 0.12, x = 150 + 520 * k + (Math.floor(t * 0.25) % 5) * 90, y = 40 + 120 * k; const g = c.createLinearGradient(x, y, x - 70, y - 24); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.strokeStyle = g; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 70, y - 24); c.stroke(); }
    }
  }

  function ambientFront(c, name, cam, ms, v) {
    const t = ms / 1000, px = cam.x;
    if (name === 'meadow') {                                    // pollen et papillons
      for (let k = 0; k < 18; k++) {
        const x = ((hash(k + 50) * W + t * 6 * (0.5 + hash(k)) - px * 0.3) % W + W) % W, y = (hash(k + 70) * H - t * 8 * (0.4 + hash(k + 2))) % H;
        c.globalAlpha = 0.35 + 0.3 * Math.sin(t * 2 + k); c.fillStyle = '#fff8c8'; c.beginPath(); c.arc(x, (y + H) % H, 1.6, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;
      for (let k = 0; k < 2; k++) {
        const bx = ((hash(k + 90) * W + t * 22 - px * 0.2) % (W + 100) + W + 100) % (W + 100) - 50, by = 230 + hash(k + 99) * 130 + Math.sin(t * 2 + k * 3) * 18 + (1 - v) * 60, fl = Math.abs(Math.sin(t * 14 + k));
        c.fillStyle = k ? '#ff9ad0' : '#ffd166';
        c.beginPath(); c.ellipse(bx - 4 * fl - 1, by, 4 * fl + 1, 5, -0.4, 0, TAU); c.ellipse(bx + 4 * fl + 1, by, 4 * fl + 1, 5, 0.4, 0, TAU); c.fill();
      }
    } else if (name === 'arcane') {                               // lucioles magiques
      for (let k = 0; k < 16; k++) {
        const x = ((hash(k + 5) * W + Math.sin(t * 0.6 + k) * 24 - px * 0.25) % W + W) % W, y = ((hash(k + 8) * H - t * (10 + hash(k) * 12)) % H + H) % H;
        const a = 0.4 + 0.5 * Math.abs(Math.sin(t * 1.3 + k)), col = k % 2 ? '120,230,255' : '190,150,255';
        const g = c.createRadialGradient(x, y, 0, x, y, 9); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
        c.fillStyle = g; c.fillRect(x - 9, y - 9, 18, 18);
      }
    } else if (name === 'sky') {                                  // oiseaux et paillettes
      for (let k = 0; k < 3; k++) {
        const bx = ((hash(k + 60) * (W + 200) + t * (28 + k * 6) - px * 0.1) % (W + 200) + W + 200) % (W + 200) - 100, by = 70 + hash(k + 61) * 150 + Math.sin(t * 1.4 + k) * 8 + (1 - v) * 60, w = Math.sin(t * 9 + k) * 4;
        c.strokeStyle = 'rgba(90,60,120,.8)'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(bx - 9, by + w); c.quadraticCurveTo(bx - 4, by - 4, bx, by); c.quadraticCurveTo(bx + 4, by - 4, bx + 9, by + w); c.stroke();
      }
      for (let k = 0; k < 14; k++) {
        const x = (hash(k + 11) * W - px * 0.12 + W * 3) % W, y = hash(k + 13) * H, a = Math.max(0, Math.sin(t * 2 + k * 1.7));
        c.globalAlpha = a * 0.8; c.fillStyle = '#fff'; c.fillRect(x - 1, y - 4, 2, 8); c.fillRect(x - 4, y - 1, 8, 2);
      }
      c.globalAlpha = 1;
    } else if (name === 'forge') {                                // braises
      for (let k = 0; k < 44; k++) {
        const sp = 18 + hash(k + 3) * 34, x = ((hash(k + 4) * W + Math.sin(t * 0.8 + k) * 16 - px * 0.3) % W + W) % W, y = H - ((hash(k + 7) * H + t * sp) % (H * 1.05));
        const life = 1 - (H - y) / H;
        c.globalAlpha = clamp(life * 1.2, 0, 1) * (0.55 + 0.45 * Math.sin(t * 8 + k));
        c.fillStyle = k % 3 ? '#ffb347' : '#ff6a2c'; const s = 1.4 + hash(k + 9) * 2; c.fillRect(x, y, s, s);
      }
      c.globalAlpha = 1;
    } else if (name === 'ice') {                                  // flocons
      for (let k = 0; k < 60; k++) {
        const sp = 18 + hash(k + 3) * 26, x = ((hash(k + 4) * W + Math.sin(t * 0.9 + k) * 22 + t * 8 - px * (0.25 + hash(k) * 0.3)) % W + W) % W, y = (hash(k + 7) * H + t * sp) % H;
        c.globalAlpha = 0.45 + 0.4 * hash(k + 12); c.fillStyle = '#fff'; const s = 1.2 + hash(k + 9) * 2.2; c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;
    } else if (name === 'ruins') {                                // poussière dorée et feuilles
      for (let k = 0; k < 26; k++) {
        const x = ((hash(k + 50) * W + t * (12 + hash(k) * 16) - px * 0.3) % W + W) % W, y = ((hash(k + 70) * H + Math.sin(t * 0.7 + k) * 20 - t * 4) % H + H) % H;
        c.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t + k)); c.fillStyle = k % 4 === 0 ? '#9ed66a' : '#ffe2a8'; c.fillRect(x, y, k % 4 === 0 ? 3 : 1.8, k % 4 === 0 ? 2 : 1.8);
      }
      c.globalAlpha = 1;
    } else if (name === 'space') {                                // poussières cosmiques
      for (let k = 0; k < 22; k++) {
        const x = ((hash(k + 5) * W + Math.sin(t * 0.5 + k) * 30 - px * 0.3) % W + W) % W, y = ((hash(k + 8) * H - t * (6 + hash(k) * 10)) % H + H) % H;
        const a = 0.3 + 0.5 * Math.abs(Math.sin(t * 1.1 + k)), col = k % 3 === 0 ? '255,140,220' : '110,220,255';
        const g = c.createRadialGradient(x, y, 0, x, y, 8); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
        c.fillStyle = g; c.fillRect(x - 8, y - 8, 16, 16);
      }
    }
  }

  // Appelé par render.draw avec la transformation « écran » (unités logiques 960×480)
  function drawBackground(c, name, cam, L, ms, sc) {
    const tier = clamp(Math.ceil(sc), 1, 2);
    const vh = H / (cam.z || 1), span = L.h - vh;
    const v = span > 1 ? clamp(cam.y / span, 0, 1) : 1;
    drawSky(c, name, v);
    ambientBack(c, name, cam, ms, v);
    strips(name, tier).forEach((ly) => {
      const yo = (1 - v) * ly.fy * 420;
      const xo = -(((cam.x * ly.f) % SW) + SW) % SW;
      c.drawImage(ly.cv, xo, yo, SW, H); c.drawImage(ly.cv, xo + SW, yo, SW, H);
    });
    ambientFront(c, name, cam, ms, v);
  }

  /* ---------- Vignette du menu : ciel + une colline ---------- */
  function drawThumbBackground(c, name, w, h) {
    const p = scOf(name), g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, p.sky[0]); g.addColorStop(0.6, p.sky[1]); g.addColorStop(1, p.sky[2]);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const rnd = seeded('thumb' + name);
    [[0.7, p.hill[1]], [0.84, p.hill[2]]].forEach(([base, col]) => {
      const ph = rnd() * TAU; c.fillStyle = col; c.beginPath(); c.moveTo(0, h);
      for (let x = 0; x <= w; x += 4) c.lineTo(x, h * base - Math.sin(x / w * TAU * 1.5 + ph) * h * 0.06);
      c.lineTo(w, h); c.closePath(); c.fill();
    });
  }

  /* ---------- Tuiles ---------- */
  // nb : { up, down, left, right } = le voisin est plein ; special : ressort / tapis (pas de bord supérieur)
  function drawTile(c, name, x, y, tx, ty, nb, special, rnd) {
    const p = scOf(name), h = (tx * 73856093) ^ (ty * 19349663), h1 = ((h >>> 3) & 7);
    c.fillStyle = p.tile; c.fillRect(x, y, TILE, TILE);
    if (name === 'meadow') {
      c.fillStyle = p.tileLight; c.globalAlpha = 0.5;
      if (h1 < 4) { c.beginPath(); c.ellipse(x + 8 + (h1 * 5) % 14, y + 14 + (h1 * 3) % 9, 3.2, 2.2, 0, 0, TAU); c.fill(); }
      c.globalAlpha = 1; c.fillStyle = p.tileDark; c.globalAlpha = 0.55;
      if (h1 > 3) { c.beginPath(); c.ellipse(x + 20 - (h1 * 3) % 10, y + 22, 4, 2.6, 0, 0, TAU); c.fill(); }
      if (h1 === 2) c.fillRect(x + 6, y + 8, 2, 8);
      c.globalAlpha = 1;
    } else if (name === 'arcane') {
      c.fillStyle = p.tileDark; const off = (ty & 1) ? 16 : 0;
      c.fillRect(x, y + 15, TILE, 2); c.fillRect(x, y + 31, TILE, 1); c.fillRect(x + ((off + 8) % TILE), y, 2, 15); c.fillRect(x + ((off + 24) % TILE), y + 17, 2, 14);
      c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(x, y + 1, TILE, 1); c.fillRect(x, y + 17, TILE, 1);
      if (h1 === 1) { c.fillStyle = 'rgba(120,235,255,.7)'; c.fillRect(x + 12, y + 7, 2, 5); c.fillRect(x + 10, y + 9, 6, 1); }   // petite rune
    } else if (name === 'sky') {
      c.fillStyle = p.tileLight; c.globalAlpha = 0.55; c.beginPath(); c.ellipse(x + 10 + (h1 * 4) % 12, y + 12 + (h1 * 5) % 12, 8, 4, 0, 0, TAU); c.fill();
      c.globalAlpha = 0.35; c.fillStyle = p.tileDark; c.beginPath(); c.ellipse(x + 22 - (h1 * 2) % 8, y + 24, 7, 3, 0, 0, TAU); c.fill(); c.globalAlpha = 1;
    } else if (name === 'ice') {
      c.fillStyle = p.tileLight; c.globalAlpha = 0.5; c.beginPath(); c.moveTo(x + 4, y + 6 + h1); c.lineTo(x + 16, y + 3); c.lineTo(x + 26, y + 12 + h1); c.lineTo(x + 12, y + 16); c.closePath(); c.fill();
      c.globalAlpha = 0.55; c.strokeStyle = '#e6f6ff'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + 6 + h1, y + 18); c.lineTo(x + 14, y + 24); c.lineTo(x + 11, y + 30); c.moveTo(x + 14, y + 24); c.lineTo(x + 24, y + 22); c.stroke();
      c.globalAlpha = 1; if (h1 < 2) { c.fillStyle = '#fff'; c.fillRect(x + 20, y + 8, 2, 2); c.fillRect(x + 19, y + 9, 4, 0.8); }
    } else if (name === 'ruins') {
      c.fillStyle = p.tileDark; const off = (ty & 1) ? 16 : 0;
      c.fillRect(x, y + 15, TILE, 2); c.fillRect(x, y + 31, TILE, 1); c.fillRect(x + ((off + 14) % TILE), y, 2, 15); c.fillRect(x + ((off + 4) % TILE), y + 17, 2, 14);
      c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(x, y + 1, TILE, 1); c.fillRect(x, y + 17, TILE, 1);
      if (h1 < 3) { c.fillStyle = '#5d8a4a'; c.globalAlpha = 0.8; c.beginPath(); c.ellipse(x + 8 + h1 * 6, y + 29, 7, 3.2, 0, Math.PI, 0); c.fill(); c.globalAlpha = 1; }
      if (h1 === 6) { c.fillStyle = p.tileDark; c.fillRect(x + 8, y + 5, 7, 1); c.fillRect(x + 11, y + 4, 1, 4); c.fillRect(x + 20, y + 22, 5, 1); }   // gravures
    } else if (name === 'space') {
      c.fillStyle = p.tileDark; c.fillRect(x + 1, y + 1, TILE - 2, 1); c.fillRect(x + 15, y, 2, TILE); c.fillRect(x, y + 15, TILE, 2);
      c.fillStyle = p.tileLight; c.globalAlpha = 0.5; [[3, 3], [TILE - 5, 3], [3, TILE - 5], [TILE - 5, TILE - 5]].forEach(([dx, dy]) => c.fillRect(x + dx, y + dy, 2, 2)); c.globalAlpha = 1;
      if (h1 < 3) { c.strokeStyle = 'rgba(107,224,255,.55)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x + 4, y + 8 + h1 * 6); c.lineTo(x + 12, y + 8 + h1 * 6); c.lineTo(x + 14, y + 12 + h1 * 6); c.lineTo(x + 26, y + 12 + h1 * 6); c.stroke(); }
    } else {
      c.fillStyle = p.tileDark; c.fillRect(x, y + 15, TILE, 2); c.fillRect(x + 15, y, 2, TILE);
      c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(x + 1, y + 1, 13, 1); c.fillRect(x + 17, y + 17, 13, 1);
      if (h1 < 3) {                                                     // fissure de lave
        c.strokeStyle = 'rgba(255,120,40,.35)'; c.lineWidth = 4; c.beginPath(); c.moveTo(x + 4, y + 8 + h1 * 4); c.lineTo(x + 13, y + 16); c.lineTo(x + 10, y + 26); c.lineTo(x + 22, y + 30); c.stroke();
        c.strokeStyle = '#ffa24c'; c.lineWidth = 1.6; c.stroke();
      }
    }
    // contours
    c.fillStyle = p.line;
    if (!nb.down) c.fillRect(x, y + TILE - 3, TILE, 3);
    if (!nb.left) c.fillRect(x, y, 2, TILE);
    if (!nb.right) c.fillRect(x + TILE - 2, y, 2, TILE);
    // ombre intérieure sous un bord supérieur
    if (!nb.up && !special) cap(c, name, p, x, y, tx, ty, nb);
    else if (!nb.up) { c.fillStyle = p.line; c.fillRect(x, y, TILE, 2); }
  }

  function cap(c, name, p, x, y, tx, ty, nb) {
    if (name === 'meadow') {
      c.fillStyle = p.capDark; c.fillRect(x, y + 5, TILE, 3);
      c.fillStyle = p.cap; c.fillRect(x, y, TILE, 7);
      for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(x + 3 + k * 6.5, y + 7, 3.6, 0, Math.PI); c.fill(); }
      c.fillStyle = p.capLight; c.fillRect(x, y, TILE, 2);
      if (!nb.left) { c.fillStyle = p.cap; c.fillRect(x, y, 2, 12); }
      if (!nb.right) { c.fillStyle = p.cap; c.fillRect(x + TILE - 2, y, 2, 12); }
    } else if (name === 'arcane') {
      c.fillStyle = p.capDark; c.fillRect(x, y + 3, TILE, 4);
      c.fillStyle = p.cap; c.fillRect(x, y, TILE, 5);
      c.fillStyle = p.capLight; c.fillRect(x, y, TILE, 2);
      c.fillStyle = 'rgba(160,140,255,.28)'; c.fillRect(x, y + 7, TILE, 2);
    } else if (name === 'sky') {
      c.fillStyle = p.capDark; c.fillRect(x, y + 4, TILE, 4);
      c.fillStyle = p.cap;
      c.fillRect(x, y + 1, TILE, 6);
      [[5, 3.5], [14, 4.5], [23, 3.5]].forEach(([dx, r]) => { c.beginPath(); c.arc(x + dx, y + 2, r, 0, TAU); c.fill(); });
      c.fillStyle = '#fff'; c.fillRect(x, y, TILE, 1);
    } else if (name === 'ice') {
      c.fillStyle = p.capDark; c.fillRect(x, y + 4, TILE, 4);
      c.fillStyle = p.cap; c.fillRect(x, y, TILE, 6);
      [[4, 4], [13, 6], [22, 4], [29, 5]].forEach(([dx, hh]) => { c.beginPath(); c.moveTo(x + dx - 3, y + 6); c.lineTo(x + dx, y + 6 + hh + 2); c.lineTo(x + dx + 3, y + 6); c.closePath(); c.fill(); });
      c.fillStyle = '#fff'; c.fillRect(x, y, TILE, 2);
    } else if (name === 'ruins') {
      c.fillStyle = p.capDark; c.fillRect(x, y + 4, TILE, 4);
      c.fillStyle = p.cap; c.fillRect(x, y, TILE, 6);
      for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(x + 4 + k * 8, y + 7, 3.2, 0, Math.PI); c.fill(); }
      c.fillStyle = p.capLight; c.fillRect(x, y, TILE, 2);
    } else if (name === 'space') {
      c.fillStyle = p.capDark; c.fillRect(x, y + 3, TILE, 4);
      c.fillStyle = p.cap; c.fillRect(x, y, TILE, 4);
      c.fillStyle = p.capLight; c.fillRect(x, y, TILE, 1.5);
      const g = c.createLinearGradient(0, y + 4, 0, y + 14); g.addColorStop(0, 'rgba(107,224,255,.35)'); g.addColorStop(1, 'rgba(107,224,255,0)'); c.fillStyle = g; c.fillRect(x, y + 4, TILE, 10);
    } else {
      c.fillStyle = p.capDark; c.fillRect(x, y + 2, TILE, 6);
      c.fillStyle = p.cap; c.fillRect(x, y, TILE, 5);
      c.fillStyle = p.capLight; c.globalAlpha = 0.9; c.fillRect(x, y, TILE, 2); c.globalAlpha = 1;
      c.fillStyle = '#2a1311'; c.beginPath(); c.arc(x + 4, y + 4, 1.2, 0, TAU); c.arc(x + TILE - 4, y + 4, 1.2, 0, TAU); c.fill();
    }
  }

  /* ---------- Accessoires (herbe, fleurs, cristaux, braises…) posés sur les tuiles, sans gêner le jeu ---------- */
  function propOnTop(c, name, x, y, r) {          // (x, y) = coin haut-gauche de la tuile porteuse ; on dessine au-dessus
    const base = y, ox = x + 4 + r() * 24;
    if (name === 'meadow') {
      const k = r();
      if (k < 0.5) { c.strokeStyle = '#4fb040'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(ox - 3, base + 1); c.lineTo(ox - 5, base - 7); c.moveTo(ox, base + 1); c.lineTo(ox, base - 9); c.moveTo(ox + 3, base + 1); c.lineTo(ox + 5, base - 6); c.stroke(); }
      else if (k < 0.72) { const col = ['#ff7ea8', '#ffe066', '#ffffff', '#b39dff'][(r() * 4) | 0]; c.strokeStyle = '#3f9a3c'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(ox, base + 1); c.lineTo(ox, base - 8); c.stroke(); c.fillStyle = col; for (let a = 0; a < 5; a++) { c.beginPath(); c.arc(ox + Math.cos(a * 1.2566) * 3, base - 9 + Math.sin(a * 1.2566) * 3, 2, 0, TAU); c.fill(); } c.fillStyle = '#ffcf4a'; c.beginPath(); c.arc(ox, base - 9, 1.5, 0, TAU); c.fill(); }
      else if (k < 0.82) { c.fillStyle = '#f4efe0'; c.fillRect(ox - 1.6, base - 5, 3.2, 6); c.fillStyle = '#e24a4a'; c.beginPath(); c.arc(ox, base - 5, 5.5, Math.PI, 0); c.fill(); c.fillStyle = '#fff'; c.fillRect(ox - 3, base - 8, 2, 2); c.fillRect(ox + 1, base - 7, 2, 2); }
      else if (k < 0.92) { c.fillStyle = '#3f9a52'; [[-5, 4], [0, 6], [5, 4]].forEach(([dx, rr]) => { c.beginPath(); c.arc(ox + dx, base - 2, rr, 0, TAU); c.fill(); }); c.fillStyle = '#6fd07a'; c.beginPath(); c.arc(ox - 2, base - 5, 3, 0, TAU); c.fill(); }
      else { c.fillStyle = '#a9a39a'; c.beginPath(); c.ellipse(ox, base - 1, 4, 3, 0, Math.PI, 0); c.fill(); }
    } else if (name === 'arcane') {
      const k = r();
      if (k < 0.55) {
        const col = k < 0.3 ? ['#b69bff', '#e5dcff'] : ['#6fe6ff', '#d6f9ff'];
        const g = c.createRadialGradient(ox, base - 7, 0, ox, base - 7, 14); g.addColorStop(0, col[0] + '99'); g.addColorStop(1, col[0] + '00'); c.fillStyle = g; c.fillRect(ox - 14, base - 21, 28, 28);
        [[-3, 9, 4], [2, 14, 5], [6, 7, 3.4]].forEach(([dx, hh, w]) => { c.fillStyle = col[0]; c.beginPath(); c.moveTo(ox + dx - w, base + 1); c.lineTo(ox + dx, base - hh); c.lineTo(ox + dx + w, base + 1); c.closePath(); c.fill(); c.fillStyle = col[1]; c.beginPath(); c.moveTo(ox + dx - 1, base); c.lineTo(ox + dx, base - hh); c.lineTo(ox + dx + w * 0.4, base); c.closePath(); c.fill(); });
      } else if (k < 0.8) { const g = c.createRadialGradient(ox, base - 4, 0, ox, base - 4, 11); g.addColorStop(0, 'rgba(120,255,220,.55)'); g.addColorStop(1, 'rgba(120,255,220,0)'); c.fillStyle = g; c.fillRect(ox - 11, base - 15, 22, 22); c.fillStyle = '#e7fff8'; c.fillRect(ox - 1.5, base - 4, 3, 5); c.fillStyle = '#5fe3c4'; c.beginPath(); c.arc(ox, base - 4, 5, Math.PI, 0); c.fill(); }
      else { c.fillStyle = '#6a5fc0'; c.beginPath(); c.ellipse(ox, base, 5, 3.4, 0, Math.PI, 0); c.fill(); }
    } else if (name === 'sky') {
      const k = r();
      if (k < 0.4) { c.fillStyle = '#fff'; [[-4, 3.2], [0, 4.4], [4.5, 3]].forEach(([dx, rr]) => { c.beginPath(); c.arc(ox + dx, base - 1, rr, 0, TAU); c.fill(); }); }
      else if (k < 0.7) { c.strokeStyle = '#7fcf9a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(ox, base + 1); c.lineTo(ox, base - 7); c.stroke(); c.fillStyle = ['#ff8fb8', '#ffd36a', '#fff'][(r() * 3) | 0]; c.beginPath(); c.arc(ox, base - 8, 3, 0, TAU); c.fill(); c.fillStyle = '#ffb347'; c.beginPath(); c.arc(ox, base - 8, 1.2, 0, TAU); c.fill(); }
      else { c.fillStyle = '#ffe9a6'; c.fillRect(ox - 1, base - 9, 2, 8); c.fillRect(ox - 4, base - 6, 8, 2); }
    } else if (name === 'ice') {
      const k = r();
      if (k < 0.35) { c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(ox, base, 8, 4.5, 0, Math.PI, 0); c.fill(); c.fillStyle = '#d3ecfa'; c.beginPath(); c.ellipse(ox + 2, base, 5, 2.4, 0, Math.PI, 0); c.fill(); }
      else if (k < 0.7) { [[-3, 9, 3.2], [2, 14, 4], [6, 7, 2.8]].forEach(([dx, hh, w]) => { c.fillStyle = '#9fdcf7'; c.beginPath(); c.moveTo(ox + dx - w, base + 1); c.lineTo(ox + dx, base - hh); c.lineTo(ox + dx + w, base + 1); c.closePath(); c.fill(); c.fillStyle = '#e8fbff'; c.beginPath(); c.moveTo(ox + dx - 1, base); c.lineTo(ox + dx, base - hh); c.lineTo(ox + dx + w * 0.4, base); c.closePath(); c.fill(); }); }
      else { pine(c, ox, base + 1, 0.42, '#bfe3f2'); c.fillStyle = '#fff'; c.fillRect(ox - 4, base - 9, 8, 2); }
    } else if (name === 'ruins') {
      const k = r();
      if (k < 0.4) { c.strokeStyle = '#5d9a46'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(ox - 3, base + 1); c.lineTo(ox - 5, base - 6); c.moveTo(ox, base + 1); c.lineTo(ox, base - 8); c.moveTo(ox + 3, base + 1); c.lineTo(ox + 5, base - 5); c.stroke(); }
      else if (k < 0.65) { c.fillStyle = '#b5a68e'; c.fillRect(ox - 4, base - 12, 8, 13); c.fillStyle = '#d2c4aa'; c.fillRect(ox - 4, base - 12, 3, 13); c.fillStyle = '#b5a68e'; c.fillRect(ox - 6, base - 3, 12, 4); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(ox + 1, base - 12, 3, 13); c.clearRect(ox - 5, base - 15, 10, 3); }
      else if (k < 0.85) { c.strokeStyle = '#4f8a40'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(ox, base + 1); c.lineTo(ox, base - 6); c.stroke(); c.fillStyle = '#fff'; for (let a = 0; a < 5; a++) { c.beginPath(); c.arc(ox + Math.cos(a * 1.2566) * 2.6, base - 7 + Math.sin(a * 1.2566) * 2.6, 1.7, 0, TAU); c.fill(); } c.fillStyle = '#ffcf4a'; c.beginPath(); c.arc(ox, base - 7, 1.2, 0, TAU); c.fill(); }
      else { c.fillStyle = '#9d8e78'; c.beginPath(); c.ellipse(ox, base, 5, 3.4, 0, Math.PI, 0); c.fill(); }
    } else if (name === 'space') {
      const k = r();
      if (k < 0.4) { const g = c.createRadialGradient(ox, base - 7, 0, ox, base - 7, 14); g.addColorStop(0, 'rgba(107,224,255,.55)'); g.addColorStop(1, 'rgba(107,224,255,0)'); c.fillStyle = g; c.fillRect(ox - 14, base - 21, 28, 28); [[-3, 8, 3.2], [2, 13, 4], [6, 6, 2.8]].forEach(([dx, hh, w]) => { c.fillStyle = '#3fc6f0'; c.beginPath(); c.moveTo(ox + dx - w, base + 1); c.lineTo(ox + dx, base - hh); c.lineTo(ox + dx + w, base + 1); c.closePath(); c.fill(); c.fillStyle = '#d5f8ff'; c.beginPath(); c.moveTo(ox + dx - 1, base); c.lineTo(ox + dx, base - hh); c.lineTo(ox + dx + w * 0.4, base); c.closePath(); c.fill(); }); }
      else if (k < 0.7) { c.fillStyle = '#5a639e'; c.fillRect(ox - 1, base - 13, 2, 14); c.fillStyle = '#ff6fb5'; c.beginPath(); c.arc(ox, base - 14, 2.6, 0, TAU); c.fill(); const g = c.createRadialGradient(ox, base - 14, 0, ox, base - 14, 10); g.addColorStop(0, 'rgba(255,111,181,.5)'); g.addColorStop(1, 'rgba(255,111,181,0)'); c.fillStyle = g; c.fillRect(ox - 10, base - 24, 20, 20); }
      else { c.fillStyle = '#4b56a4'; c.beginPath(); c.ellipse(ox, base, 6, 3.6, 0, Math.PI, 0); c.fill(); c.fillStyle = '#6be0ff'; c.fillRect(ox - 1, base - 4, 2, 2); }
    } else {
      const k = r();
      if (k < 0.4) { c.fillStyle = '#6a5558'; c.beginPath(); c.moveTo(ox - 6, base + 1); c.lineTo(ox - 3, base - 7); c.lineTo(ox + 2, base - 9); c.lineTo(ox + 6, base + 1); c.closePath(); c.fill(); c.fillStyle = '#8b7478'; c.fillRect(ox - 3, base - 7, 4, 2); }
      else if (k < 0.7) { const g = c.createRadialGradient(ox, base - 2, 0, ox, base - 2, 12); g.addColorStop(0, 'rgba(255,150,60,.65)'); g.addColorStop(1, 'rgba(255,150,60,0)'); c.fillStyle = g; c.fillRect(ox - 12, base - 14, 24, 24); c.fillStyle = '#ffb347'; c.beginPath(); c.arc(ox, base - 2, 2.6, 0, TAU); c.fill(); c.fillStyle = '#fff0b0'; c.beginPath(); c.arc(ox, base - 2, 1.2, 0, TAU); c.fill(); }
      else { c.fillStyle = '#3a2022'; c.fillRect(ox - 1, base - 10, 2, 11); c.fillRect(ox - 4, base - 10, 8, 2); }
    }
  }

  function propUnder(c, name, x, y, r) {           // sous un bord inférieur exposé : (x, y) = bas de la tuile
    const ox = x + 5 + r() * 22;
    if (name === 'meadow') { c.strokeStyle = '#3f9a3c'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(ox, y); c.quadraticCurveTo(ox + 4, y + 8, ox - 1, y + 14); c.stroke(); c.fillStyle = '#62c850'; c.beginPath(); c.ellipse(ox + 2, y + 8, 3.4, 1.8, 0.6, 0, TAU); c.ellipse(ox - 1, y + 13, 3, 1.6, -0.5, 0, TAU); c.fill(); }
    else if (name === 'arcane') { c.fillStyle = '#8f7fe6'; c.beginPath(); c.moveTo(ox - 3, y); c.lineTo(ox, y + 11 + r() * 6); c.lineTo(ox + 3, y); c.closePath(); c.fill(); c.fillStyle = '#d6cdff'; c.fillRect(ox - 0.5, y, 1, 7); }
    else if (name === 'sky') { c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(ox - 3, y + 1, 3.6, 0, TAU); c.arc(ox + 3, y + 2, 3.2, 0, TAU); c.arc(ox, y + 4, 3.4, 0, TAU); c.fill(); }
    else if (name === 'ice') { c.fillStyle = '#bfe8fb'; c.beginPath(); c.moveTo(ox - 3, y); c.lineTo(ox, y + 9 + r() * 9); c.lineTo(ox + 3, y); c.closePath(); c.fill(); c.fillStyle = '#fff'; c.fillRect(ox - 0.6, y, 1.2, 7); }
    else if (name === 'ruins') { c.strokeStyle = '#4f8a40'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(ox, y); c.quadraticCurveTo(ox - 4, y + 8, ox + 1, y + 16); c.stroke(); c.fillStyle = '#6fb257'; c.beginPath(); c.ellipse(ox - 2, y + 7, 3.2, 1.8, 0.5, 0, TAU); c.ellipse(ox + 1, y + 15, 3, 1.6, -0.4, 0, TAU); c.fill(); }
    else if (name === 'space') { c.strokeStyle = '#5a639e'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(ox, y); c.lineTo(ox, y + 12); c.stroke(); c.fillStyle = '#6be0ff'; c.beginPath(); c.arc(ox, y + 13, 2.4, 0, TAU); c.fill(); const g = c.createRadialGradient(ox, y + 13, 0, ox, y + 13, 9); g.addColorStop(0, 'rgba(107,224,255,.5)'); g.addColorStop(1, 'rgba(107,224,255,0)'); c.fillStyle = g; c.fillRect(ox - 9, y + 4, 18, 18); }
    else { c.strokeStyle = '#2c1a1c'; c.lineWidth = 2; for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(ox, y + 3 + k * 5, 2.6, 3, 0, 0, TAU); c.stroke(); } c.fillStyle = '#ffa24c'; c.beginPath(); c.arc(ox, y + 22, 3, 0, TAU); c.fill(); }
  }

  root.Scenery = { drawBackground, drawThumbBackground, drawTile, propOnTop, propUnder, seeded, SC };
})(window);
