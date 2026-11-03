// TANDEM — client : menus aux flèches, mode local (même clavier) et en ligne (WebSocket).
(function () {
  'use strict';
  const { Sim, Levels, Render, Sfx } = window;
  const { LEVELS, CHAPTERS } = Levels;
  const { TILE, PW, PH } = Sim;
  const W = Render.W, H = Render.H;               // 960 × 480 logiques
  const TICK = 1000 / 60;
  const GOLD = '#ffd24a', INK = '#f3eeff', DIM = '#9b93bd', PANEL = 'rgba(12,8,30,.82)';
  const ARROWS = ['↑', '→', '↓', '←'];
  const CODE_KEYS = 'BCDFGHJKLMNPRSTVWXZ'.split('');   // lettres des codes de salle (4 lettres)
  const canvas = document.getElementById('game');
  const c = canvas.getContext('2d');

  /* ---------- Progression (facultative : le stockage peut être indisponible) ---------- */
  let done = {};
  try { done = JSON.parse(localStorage.getItem('tandem.done') || '{}') || {}; } catch (e) { done = {}; }
  function saveDone(level, ticks, deaths) {
    const old = done[level];
    if (!old || ticks < old.ticks) done[level] = { ticks, deaths };
    try { localStorage.setItem('tandem.done', JSON.stringify(done)); } catch (e) { /* ignore */ }
  }

  /* ---------- Couleurs des personnages (préférence mémorisée) ---------- */
  const NCOL = Sim.NCOLORS;
  let prefs = [0, 1];
  try { const v = JSON.parse(localStorage.getItem('tandem.colors') || 'null'); if (Array.isArray(v) && v.length === 2 && v.every((k) => Number.isInteger(k) && k >= 0 && k < NCOL) && v[0] !== v[1]) prefs = v; } catch (e) { prefs = [0, 1]; }
  function savePrefs() { try { localStorage.setItem('tandem.colors', JSON.stringify(prefs)); } catch (e) { /* ignore */ } }

  /* ---------- État ---------- */
  const S = {
    screen: 'title', menu: 0, mode: null, sel: 0, level: 0, G: null, you: 0, host: true,
    code: '', codeIn: '', count: 1, ws: null, msg: '', msgT: 0, ping: -1, mx: -1, my: -1,
    hd: [0, 0], practice: false, speed: 1, overlay: false, colors: prefs.slice(), row: 0, prev: 'title', confirmT: 0, shake: 0, lastIn: '', connecting: false, resultShown: false,
    chat: [], typing: false, draft: '', chatHint: 0,
  };
  let jumpQ = [0, 0], kQ = [0, 0], cQ = 0;
  let demoG = null;
  const online = location.protocol === 'http:' || location.protocol === 'https:';

  const notify = (m, ms = 3200) => { S.msg = m; S.msgT = performance.now() + ms; };
  const levelTheme = (i) => (CHAPTERS[LEVELS[i].ch] || CHAPTERS[0]).theme;
  const fmtTime = (ticks) => { const s = ticks / 60; return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`; };

  /* ---------- Dimensionnement ---------- */
  function resize() {
    const wrap = document.getElementById('wrap');
    const availW = wrap.clientWidth, availH = window.innerHeight - 90;
    const cssW = Math.max(320, Math.min(availW, availH * 2));
    const dpr = window.devicePixelRatio || 1;
    const px = Math.max(480, Math.round(cssW * dpr / 160) * 160);
    canvas.style.width = cssW + 'px'; canvas.style.height = cssW / 2 + 'px';
    if (canvas.width !== px) { canvas.width = px; canvas.height = px / 2; }
  }
  const scale = () => canvas.width / W;
  window.addEventListener('resize', resize);

  /* ---------- Réseau ---------- */
  function wsSend(o) { if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(o)); }
  function closeWs() {
    const ws = S.ws; S.ws = null; S.connecting = false;
    if (ws) { try { ws.close(); } catch (e) { /* ignore */ } }
  }
  function toTitle(message) {
    closeWs();
    S.chat = []; S.typing = false; S.draft = '';
    S.screen = 'title'; S.mode = null; S.G = null; S.overlay = false; S.hd = [0, 0]; S.codeIn = ''; S.code = '';
    S.colors = prefs.slice(); applyColors();
    FX().clear();
    if (message) notify(message);
  }
  const FX = () => Render.FX;

  function connect(firstMsg) {
    closeWs();
    S.connecting = true;
    let ws;
    try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host); } catch (e) { notify('Connexion impossible.'); S.connecting = false; return; }
    S.ws = ws;
    ws.onopen = () => { S.connecting = false; wsSend(firstMsg); pingLoop(ws); };
    ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onNet(m); };
    ws.onerror = () => {};
    ws.onclose = () => {
      if (S.ws !== ws) return;
      S.ws = null; S.connecting = false;
      if (S.mode === 'online' || S.screen === 'code') toTitle('Connexion au serveur perdue.');
    };
  }
  function pingLoop(ws) {
    const tick = () => { if (S.ws !== ws) return; wsSend({ t: 'ping', ts: performance.now() }); setTimeout(tick, 2000); };
    tick();
  }

  function onNet(m) {
    switch (m.t) {
      case 'pong': S.ping = Math.round(performance.now() - m.ts); break;
      case 'err': Sfx.play('error'); notify(m.m || 'Erreur.'); if (S.screen === 'code') { S.codeIn = ''; } break;
      case 'room':
        S.mode = 'online'; S.code = m.code; S.you = m.you; S.host = m.you === 0; S.count = m.count; S.sel = m.level || 0;
        S.screen = m.count >= 2 ? 'select' : 'wait'; Sfx.play('ok');
        if (m.colors) { S.colors = m.colors.slice(); applyColors(); }
        if (S.colors[S.you] !== prefs[0]) wsSend({ t: 'color', c: prefs[0] });       // on propose sa couleur préférée
        break;
      case 'colors':
        S.colors = m.colors.slice(); applyColors();
        if (m.from === S.you && !m.ok) { prefs[0] = S.colors[S.you]; savePrefs(); Sfx.play('error'); notify('Cette couleur est déjà prise par votre partenaire.'); }
        break;
      case 'peer': if (m.colors) { S.colors = m.colors.slice(); applyColors(); } S.count = 2; if (S.screen === 'wait') { S.screen = 'select'; Sfx.play('ok'); notify('Votre partenaire est là !  (Tab : discuter par écrit)', 4200); } break;
      case 'peerLeft':
        S.count = 1; S.you = 0; S.host = true; S.code = m.code; S.sel = m.level || 0; S.G = null; S.overlay = false;
        if (m.colors) { S.colors = m.colors.slice(); applyColors(); }
        S.typing = false; S.draft = ''; S.screen = 'wait'; notify('Votre partenaire est parti.'); break;
      case 'sel': S.sel = m.level; if (!S.host) Sfx.play('menu'); break;
      case 'start': startOnline(m.level, m.practice); break;
      case 'speed': S.speed = m.v; break;
      case 'chat': addChat(m.from, String(m.m || '')); if (m.from !== S.you) Sfx.play('menu'); break;
      case 'lobby': S.screen = 'select'; S.sel = m.level; S.G = null; S.overlay = false; FX().clear();
        if (m.by !== undefined && m.by >= 0 && m.by !== S.you) notify('Votre partenaire est revenu au choix des niveaux.');
        break;
      case 'win': if (!S.practice) saveDone(m.level, m.ticks, m.deaths); break;
      case 's': if (S.G && S.mode === 'online') { Sim.unpack(S.G, m); handleEvents(S.G); } break;
      default: break;
    }
  }

  /* ---------- Démarrage d'un niveau ---------- */
  function resetPlay(level) {
    S.level = level; S.G = Sim.create(LEVELS[level]); S.G.practice = !!S.practice; S.speed = 1; cQ = 0; S.screen = 'play'; S.cam = Render.newCam(); Render.updateCam(S.cam, S.G, true);
    S.overlay = false; S.hd = [0, 0]; S.resultShown = false; S.shake = 0; jumpQ = [0, 0]; kQ = [0, 0]; S.lastIn = '';
    FX().clear();
  }
  function startOnline(level, practice) { S.practice = !!practice; resetPlay(level); syncInputs(true); }
  function startLocal(level, practice) { S.mode = 'local'; S.practice = !!practice; resetPlay(level); Sfx.play('ok'); }

  /* ---------- Événements du moteur → sons et particules ---------- */
  function handleEvents(G) {
    const L = G.L;
    for (const [type, a, b] of G.events) {
      switch (type) {
        case 'jump': {
          Sfx.play(b ? 'spring' : 'jump', a);
          const p = G.players[a];
          if (b) { FX().ring(p.x + PW / 2, p.y + PH, '#ffd24a', 22, 18); FX().emit(10, p.x + PW / 2, p.y + PH, { dir: -Math.PI / 2, spread: 1.4, speed: 3.2, life: 24, size: 3, color: ['#ffd24a', '#ff5d73', '#fff'], g: 0.05 }); }
          FX().emit(5, p.x + PW / 2, p.y + PH, { dir: -Math.PI / 2, spread: 2.6, speed: 1.6, life: 18, size: 3, color: Render.P_COL[a].light, g: 0.04 });
          break;
        }
        case 'land': {
          const p = G.players[a];
          if (b > 5) Sfx.play('land');
          FX().emit(Math.min(8, 2 + b), p.x + PW / 2, p.y + PH, { dir: -Math.PI / 2, spread: 3.1, speed: 1.4, life: 16, size: 3, color: '#cfc8ee', g: 0.02, w: 10 });
          break;
        }
        case 'bell': {
          Sfx.play('bell', b);
          const bl = L.bells[a];
          FX().ring(bl.x + 16, bl.y + 16, Render.G_COL[b], 30, 26);
          FX().emit(9, bl.x + 16, bl.y + 30, { speed: 2.4, life: 26, size: 3, color: [GOLD, '#fff'], g: 0.06 });
          break;
        }
        case 'bridgeOn': {
          Sfx.play('bridge');
          for (const idx of L.dynCells) if (L.bridgeG[idx] === a) FX().emit(3, (idx % L.cols) * TILE + 16, Math.floor(idx / L.cols) * TILE + 16, { speed: 1.5, life: 22, size: 3, color: Render.G_COL[a], g: -0.02 });
          break;
        }
        case 'bridgeOff': Sfx.play('bridgeOff'); break;
        case 'plateOn': case 'toggle': Sfx.play('plate'); break;
        case 'plateOff': break;
        case 'gateOpen': Sfx.play('gateOpen'); break;
        case 'gateClose': Sfx.play('gateClose'); break;
        case 'death': {
          Sfx.play('death'); S.shake = 14;
          const x = Math.floor(b / 1000), y = b % 1000;
          FX().emit(26, x, y, { speed: 4.2, life: 40, size: 5, color: [Render.P_COL[a].main, Render.P_COL[a].light, '#fff'], g: 0.15 });
          break;
        }
        case 'recall': {
          Sfx.play('respawn');
          const x = Math.floor(b / 1000), y = b % 1000, col = Render.P_COL[a];
          FX().ring(x, y, col.main, 26, 20);
          FX().emit(14, x, y, { speed: 2.6, life: 30, size: 4, color: [col.main, col.light, '#fff'], g: -0.02 });
          break;
        }
        case 'point': {
          Sfx.play('doors');
          G.players.forEach((p, i) => { FX().ring(p.x + PW / 2, p.y + PH, Render.P_COL[i].main, 22, 22); });
          break;
        }
        case 'goto': { FX().clear(); if (S.cam) Render.updateCam(S.cam, G, true); break; }
        case 'respawn': Sfx.play('respawn'); break;
        case 'fragCrack': Sfx.play('crack'); break;
        case 'fragFall': {
          Sfx.play('crumble');
          const f = L.frags[a];
          FX().emit(12, f.x + 16, f.y + 16, { speed: 1.8, life: 34, size: 4, color: ['#c7b185', '#9b8763', '#6b5a3c'], g: 0.2, w: 24 });
          break;
        }
        case 'fragBack': break;
        case 'portal': {
          Sfx.play('portal');
          const q = L.portals[b], d = L.portals[q.pair], col = Render.G_COL[q.g];
          FX().emit(12, q.x + 16, q.y + 16, { speed: 2.4, life: 22, size: 3, color: [col, '#fff'], g: 0 });
          FX().emit(12, d.x + 16, d.y + 16, { speed: 2.4, life: 22, size: 3, color: [col, '#fff'], g: 0 });
          FX().ring(d.x + 16, d.y + 16, col, 24, 18);
          break;
        }
        case 'flagTouch': Sfx.play('doors'); break;
        case 'flag': {
          Sfx.play('flag');
          const f = L.flags[a];
          FX().emit(18, f.px + 16, f.py + 8, { speed: 3, life: 36, size: 4, color: [GOLD, '#fff'], g: 0.05 });
          notify('Point de passage atteint !', 1800);
          break;
        }
        case 'doorsFull': Sfx.play('doors'); break;
        case 'win': {
          Sfx.play('win');
          L.doors.forEach((d) => FX().emit(22, d.x + d.w / 2, d.y + d.h / 2, { speed: 4, life: 55, size: 4, color: [GOLD, '#fff', '#ff9ad0'], g: 0.08 }));
          if (S.mode === 'local' && !S.practice) saveDone(S.level, G.t, G.deaths);
          break;
        }
        default: break;
      }
    }
    G.events = [];
  }

  /* ---------- Entrées ----------
     Flèches ET Z Q S D (ou W A S D sur clavier QWERTY : on lit la position physique de la touche).
     En ligne, les deux jeux de touches font la même chose. En local, flèches = joueur Bleu, ZQSD = joueur Orange. */
  const ARROW = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
  const ALT_CODE = { KeyW: 0, KeyD: 1, KeyS: 2, KeyA: 3 };   // position physique : ZQSD sur AZERTY, WASD sur QWERTY
  const ALT_KEY = { z: 0, d: 1, s: 2, q: 3 };                  // secours si la disposition est inhabituelle
  const arrowOf = (e) => (e.code in ARROW ? ARROW[e.code] : null);
  const altOf = (e) => {
    if (e.code in ALT_CODE) return ALT_CODE[e.code];
    const k = (e.key || '').toLowerCase();
    return k in ALT_KEY ? ALT_KEY[k] : null;
  };
  const dn = { a: [0, 0, 0, 0], z: [0, 0, 0, 0] };            // touches maintenues : a = flèches, z = ZQSD
  const downPressed = () => !!(dn.a[2] || dn.z[2]);

  function inputOf(slot) {
    if (S.overlay) return { l: 0, r: 0 };
    if (S.mode === 'online') return { l: dn.a[3] || dn.z[3] ? 1 : 0, r: dn.a[1] || dn.z[1] ? 1 : 0 };
    const set = slot === 0 ? 'a' : 'z';
    return { l: dn[set][3] ? 1 : 0, r: dn[set][1] ? 1 : 0 };
  }
  function syncInputs(force) {
    if (S.mode !== 'online' || S.screen !== 'play') return;
    const i = inputOf(0), s = i.l + ',' + i.r;
    if (!force && s === S.lastIn) return;
    S.lastIn = s; wsSend({ t: 'in', l: i.l, r: i.r });
  }


  /* ---------- Chat écrit (en ligne) : Tab pour écrire, Entrée envoie, Échap annule ---------- */
  const CHAT_MAX = 120, CHAT_SHOW = 8000, CHAT_FADE = 1200, CHAT_W = 270;
  const chatOk = () => S.mode === 'online' && S.count >= 2 && ['select', 'colors', 'play', 'result'].includes(S.screen);
  function addChat(from, txt) {
    S.chat.push({ from: from === 1 ? 1 : 0, txt, t: performance.now() });
    if (S.chat.length > 8) S.chat.shift();
  }
  function chatOpen() {
    if (!chatOk() || S.typing) return;
    S.typing = true; S.draft = ''; dn.a.fill(0); dn.z.fill(0); syncInputs(true); Sfx.play('menu');
  }
  function chatClose(send) {
    if (send) { const t = S.draft.replace(/\s+/g, ' ').trim(); if (t) wsSend({ t: 'chat', m: t }); }
    S.typing = false; S.draft = ''; dn.a.fill(0); dn.z.fill(0); syncInputs(true);
  }
  function chatKey(e) {                                      // pendant la saisie, toutes les touches vont dans le message
    if (e.code === 'Escape') chatClose(false);
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') { chatClose(true); Sfx.play('ok'); }
    else if (e.code === 'Tab') chatClose(false);
    else if (e.code === 'Backspace') S.draft = S.draft.slice(0, -1);
    else if (e.key && e.key.length === 1 && !e.metaKey && (!e.ctrlKey || e.altKey) && S.draft.length < CHAT_MAX) S.draft += e.key;
    else if (e.ctrlKey && !e.altKey) return;                  // laisse passer Ctrl+V (collage), Ctrl+R…
    e.preventDefault();
  }
  window.addEventListener('paste', (e) => {
    if (!S.typing) return;
    const t = ((e.clipboardData && e.clipboardData.getData('text')) || '').replace(/\s+/g, ' ');
    S.draft = (S.draft + t).slice(0, CHAT_MAX); e.preventDefault();
  });

  function onKeyDown(e) {
    if (S.typing) { if (!chatOk()) { S.typing = false; S.draft = ''; } else { Sfx.unlock(); chatKey(e); return; } }
    if (e.code === 'Tab' && S.mode === 'online') { e.preventDefault(); if (!e.repeat) chatOpen(); return; }
    if (e.code === 'Enter' && !e.repeat && S.screen === 'play' && chatOk()) { e.preventDefault(); chatOpen(); return; }
    if (S.screen === 'code' && !e.ctrlKey && !e.metaKey && !e.altKey && /^[a-zA-Z]$/.test(e.key || '')) {   // saisie du code : lettres du clavier
      e.preventDefault(); Sfx.unlock(); if (!e.repeat) typeCode(e.key.toUpperCase()); return;
    }
    const a = arrowOf(e), z = altOf(e);
    if (a !== null || e.code === 'Space' || e.code === 'Enter' || e.code === 'Backspace') e.preventDefault();
    Sfx.unlock();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (a !== null) dn.a[a] = 1;
    if (z !== null) dn.z[z] = 1;
    if (e.repeat) return;

    if (S.screen === 'play' && S.G && !S.overlay && !S.G.won) {
      if (a === 0 || z === 0) {
        if (S.mode === 'online') wsSend({ t: 'j' });
        else { if (a === 0) jumpQ[0] = 1; if (z === 0) jumpQ[1] = 1; }
      }
      if (S.mode === 'online') syncInputs();
    }
    if (e.code === 'KeyP' && S.screen === 'play' && S.G && !S.G.won) { togglePause(); return; }
    if (e.code === 'KeyT' && S.screen === 'select') { launchSelected(true); return; }
    if (S.screen === 'play' && S.practice && S.G && !S.overlay) {          // entraînement : C = point ici, V = ralenti, 0-9 = départ / drapeaux
      if (e.code === 'KeyC') { practicePoint(); return; }
      if (e.code === 'KeyV') { cycleSpeed(); return; }
      const dm = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
      if (dm) { practiceSlot(Number(dm[1])); return; }
    }
    let dir = null;
    if (a !== null) dir = a;
    else if (z !== null) dir = z;
    else if (e.code === 'Enter' || e.code === 'Space') dir = 'ok';
    else if (e.code === 'Escape' || e.code === 'Backspace') dir = 'back';
    if (dir !== null) onPress(dir);
  }
  function onKeyUp(e) {
    const a = arrowOf(e), z = altOf(e);
    if (a !== null) dn.a[a] = 0;
    if (z !== null) dn.z[z] = 0;
    syncInputs();
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => { dn.a.fill(0); dn.z.fill(0); syncInputs(); });

  function typeCode(ch) {
    if (S.codeIn.length >= 4 || S.connecting) return;
    S.codeIn += ch; Sfx.play('menu');
    if (S.codeIn.length === 4) { S.mode = 'online'; connect({ t: 'join', code: S.codeIn }); }
  }
  // dir : 0 ↑, 1 →, 2 ↓, 3 ←, 'ok', 'back'
  function onPress(dir) {
    const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;
    switch (S.screen) {
      case 'title': {
        const items = titleItems();
        if (dir === UP) { S.menu = (S.menu + items.length - 1) % items.length; Sfx.play('menu'); }
        else if (dir === DOWN) { S.menu = (S.menu + 1) % items.length; Sfx.play('menu'); }
        else if (dir === RIGHT || dir === 'ok') items[S.menu].go();
        break;
      }
      case 'code': {
        if (dir === 'back' || dir === LEFT) { if (S.codeIn.length) S.codeIn = S.codeIn.slice(0, -1); else if (dir === 'back') toTitle(); Sfx.play('menu'); }
        break;
      }
      case 'wait': if (dir === DOWN || dir === LEFT || dir === 'back') { toTitle(); Sfx.play('menu'); } break;
      case 'select': {
        const canPick = S.mode === 'local' || S.host;
        if (dir === LEFT || dir === RIGHT) {
          if (!canPick) break;
          const n = (S.sel + (dir === RIGHT ? 1 : LEVELS.length - 1)) % LEVELS.length;
          S.sel = n; Sfx.play('menu');
          if (S.mode === 'online') wsSend({ t: 'sel', level: n });
        } else if (dir === UP || dir === 'ok') {
          if (!canPick) { notify(`C’est l’hôte (joueur ${Render.P_COL[0].name}) qui lance le niveau.`); break; }
          if (S.mode === 'local') startLocal(S.sel); else wsSend({ t: 'start', level: S.sel });
        } else if (dir === DOWN || dir === 'back') {
          toTitle(); Sfx.play('menu');
        }
        break;
      }
      case 'colors': colorsKey(dir); break;
      case 'play': {
        if (!S.overlay && dir === 'back' && S.G && !S.G.won) { togglePause(); break; }
        if (S.overlay) {
          if (dir === UP || dir === 'back') { S.overlay = false; S.hd = [0, 0]; syncInputs(true); }
          else if (dir === LEFT) { doRestart(); }
          else if (dir === RIGHT) { doLobby(); }
        }
        break;
      }
      case 'result': {
        if (dir === UP || dir === 'ok') doNext();
        else if (dir === RIGHT) doRestart();
        else if (dir === DOWN || dir === 'back') doLobby();
        break;
      }
      default: break;
    }
  }
  /* ---------- Entraînement ---------- */
  const flagOrder = () => (S.G && S.G.L.cfg && S.G.L.cfg.flagOrder) || (S.G ? S.G.L.flags.map((_, k) => k) : []);
  function practicePoint() {
    if (S.mode === 'online') wsSend({ t: 'c' }); else cQ = 1;
    notify('Point de retour posé dès que vous êtes posés tous les deux.', 1800);
  }
  function cycleSpeed() {
    const order = [1, 0.5, 0.25], n = order[(order.indexOf(S.speed) + 1) % order.length];
    if (S.mode === 'online') wsSend({ t: 'speed', v: n }); else S.speed = n;
    Sfx.play('menu');
  }
  function practiceGoto(k) {                                 // k = -1 : début ; sinon indice de drapeau
    if (!S.G || !S.practice) return;
    Sfx.play('ok');
    if (S.mode === 'online') wsSend({ t: 'goto', k });
    else { Sim.practiceGoto(S.G, k); handleEvents(S.G); }
  }
  function practiceSlot(n) {                                 // touche 0 = début ; 1.. = n-ième drapeau dans l'ordre de progression
    if (n === 0) return practiceGoto(-1);
    const f = flagOrder()[n - 1];
    if (f !== undefined) practiceGoto(f);
  }
  function togglePause() {
    S.overlay = !S.overlay; S.hd = [0, 0]; Sfx.play('menu'); syncInputs(true);
  }
  // Retour au dernier drapeau : k = joueur (local) ; en ligne, c'est toujours soi-même. both : les deux (local, bouton souris)
  function doRecall(k, both) {
    if (!S.G || S.G.won || S.screen !== 'play') return;
    if (S.mode === 'online') wsSend({ t: 'k' });
    else if (both) kQ = [1, 1]; else kQ[k] = 1;
  }
  function doRestart() {
    Sfx.play('ok');
    if (S.mode === 'online') wsSend({ t: 'restart' }); else resetPlay(S.level);
  }
  function doLobby() {
    Sfx.play('menu');
    if (S.mode === 'online') wsSend({ t: 'lobby' });
    else { S.screen = 'select'; S.sel = S.level; S.G = null; S.overlay = false; FX().clear(); }
  }
  function doNext() {
    if (S.mode === 'online') { wsSend({ t: 'next' }); return; }
    if (S.level + 1 < LEVELS.length) { startLocal(S.level + 1); } else doLobby();
  }

  function titleItems() {
    return [
      { label: 'Créer une salle en ligne', sub: 'Vous donnez un code de 4 lettres à votre partenaire', off: !online, go() { Sfx.play('ok'); S.mode = 'online'; connect({ t: 'create' }); } },
      { label: 'Rejoindre une salle', sub: 'Saisissez le code de 4 lettres', off: !online, go() { Sfx.play('ok'); S.screen = 'code'; S.codeIn = ''; } },
      { label: 'Jouer en local', sub: `Un seul clavier : ${Render.P_COL[0].name} ← → ↑  ·  ${Render.P_COL[1].name} Z Q D`, go() { Sfx.play('ok'); S.mode = 'local'; S.colors = prefs.slice(); applyColors(); S.screen = 'select'; S.sel = nextUndone(); } },
      { label: 'Couleurs des personnages', sub: 'Choisissez la couleur de votre bonhomme', go() { Sfx.play('ok'); openColors('title'); } },
      { label: 'Son : ' + (Sfx.enabled ? 'oui' : 'non'), sub: '', go() { Sfx.enabled = !Sfx.enabled; Sfx.play('ok'); } },
    ].map((it) => { if (it.off) { const g = it.go; it.go = () => { Sfx.play('error'); notify('Le jeu en ligne demande le serveur (npm start).'); }; it.g0 = g; } return it; });
  }
  function nextUndone() { for (let i = 0; i < LEVELS.length; i++) if (!done[i]) return i; return 0; }

  const HOLD_RECALL = 30, HOLD_PAUSE = 100;                  // ticks : 0,5 s puis 1,7 s

  /* ---------- Boucle 60 Hz ---------- */
  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(100, now - last) * (S.mode === 'local' && S.practice && S.screen === 'play' ? S.speed : 1); last = now;
    while (acc >= TICK) { acc -= TICK; tick(); }
    render(now);
    requestAnimationFrame(frame);
  }
  function tick() {
    FX().update();
    if (S.shake > 0) S.shake--;
    if (S.G && (S.screen === 'play' || S.screen === 'result')) Render.updateCam(S.cam || (S.cam = Render.newCam()), S.G);
    if (S.screen === 'play' && S.G) {
      const G = S.G;
      if (S.mode === 'local') {
        const inp = [0, 1].map((i) => Object.assign(inputOf(i), { j: jumpQ[i], k: kQ[i], c: cQ }));
        jumpQ = [0, 0]; kQ = [0, 0]; cQ = 0;
        Sim.step(G, inp);
        handleEvents(G);
      }
      // Maintenir ↓ (ou S) puis relâcher : retour au dernier drapeau ; maintenir plus longtemps : pause
      if (!S.overlay && !G.won) {
        const keys = S.mode === 'local' ? [!!dn.a[2], !!dn.z[2]] : [downPressed()];
        keys.forEach((d, k) => {
          if (d) { S.hd[k]++; if (S.hd[k] === HOLD_PAUSE) { togglePause(); } }
          else { if (S.hd[k] >= HOLD_RECALL && S.hd[k] < HOLD_PAUSE) { doRecall(k); } S.hd[k] = 0; }
        });
      }
      if (G.won && G.wonT >= 80 && !S.resultShown) { S.resultShown = true; S.screen = 'result'; S.overlay = false; Sfx.play('ok'); }
    } else if (S.screen === 'result' && S.G && S.mode === 'local') {
      Sim.step(S.G, [{}, {}]); S.G.events = [];
    }
  }

  /* ---------- Dessin ---------- */
  function font(size, bold, pix) { return `${bold ? '800 ' : '600 '}${size}px ${pix ? "Silkscreen, 'Courier New', monospace" : "Nunito, system-ui, sans-serif"}`; }
  function text(s, x, y, size, color, align, o) {
    o = o || {};
    c.font = font(size, o.bold !== false, o.pix); c.textAlign = align || 'left'; c.textBaseline = 'middle';
    if (o.shadow) { c.fillStyle = 'rgba(0,0,0,.55)'; c.fillText(s, x + 2, y + 2); }
    c.fillStyle = color || INK; c.fillText(s, x, y);
  }
  function wrap(s, maxW, size) {
    c.font = font(size, false, false);
    const words = s.split(' '), lines = []; let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function rrect(x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function panel(x, y, w, h, fill) { c.fillStyle = fill || PANEL; rrect(x, y, w, h, 14); c.fill(); }
  /* ---------- Souris : zones cliquables reconstruites à chaque image (menus seulement ; le jeu reste au clavier) ---------- */
  let hits = [];
  const addHit = (x, y, w, h, cb, hover) => hits.push({ x, y, w, h, cb, hover });
  const over = (x, y, w, h) => S.mx >= x && S.mx <= x + w && S.my >= y && S.my <= y + h;
  function toLogical(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
  const hitAt = (mx, my) => { for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) return h; } return null; };
  canvas.addEventListener('mousemove', (e) => {
    [S.mx, S.my] = toLogical(e);
    const h = hitAt(S.mx, S.my);
    canvas.style.cursor = h ? 'pointer' : 'default';
    if (h && h.hover) h.hover();
  });
  canvas.addEventListener('mouseleave', () => { S.mx = -1; S.my = -1; canvas.style.cursor = 'default'; });
  canvas.addEventListener('click', (e) => {
    Sfx.unlock();
    [S.mx, S.my] = toLogical(e);
    const h = hitAt(S.mx, S.my);
    if (h) h.cb();
  });
  // Bouton rectangulaire cliquable
  function button(label, x, y, w, h, cb, o) {
    o = o || {};
    const hov = over(x, y, w, h);
    c.fillStyle = o.primary ? (hov ? '#ffe27a' : GOLD) : (hov ? 'rgba(255,210,74,.22)' : 'rgba(255,255,255,.08)');
    rrect(x, y, w, h, 12); c.fill();
    c.strokeStyle = o.primary ? GOLD : hov ? GOLD : '#4a4268'; c.lineWidth = 2; rrect(x, y, w, h, 12); c.stroke();
    text(label, x + w / 2, y + h / 2, o.size || 16, o.primary ? '#1a1530' : INK, 'center');
    addHit(x, y, w, h, cb);
  }
  // Touche fléchée : d = 0 ↑, 1 →, 2 ↓, 3 ←
  function keycap(d, x, y, s, color, filled) {
    c.fillStyle = filled ? color : 'rgba(255,255,255,.08)'; rrect(x - s / 2, y - s / 2, s, s, s * 0.2); c.fill();
    c.strokeStyle = color; c.lineWidth = 2.5; rrect(x - s / 2, y - s / 2, s, s, s * 0.2); c.stroke();
    c.save(); c.translate(x, y); c.rotate(d * Math.PI / 2);
    c.fillStyle = filled ? '#150f2b' : color;
    const a = s * 0.26;
    c.beginPath(); c.moveTo(0, -a * 1.25); c.lineTo(a * 1.1, a * 0.2); c.lineTo(a * 0.4, a * 0.2); c.lineTo(a * 0.4, a * 1.2); c.lineTo(-a * 0.4, a * 1.2); c.lineTo(-a * 0.4, a * 0.2); c.lineTo(-a * 1.1, a * 0.2); c.closePath(); c.fill();
    c.restore();
  }
  // Touche-lettre (code de salle)
  function lettercap(ch, x, y, s, color, filled) {
    c.fillStyle = filled ? color : 'rgba(255,255,255,.08)'; rrect(x - s / 2, y - s / 2, s, s, s * 0.2); c.fill();
    c.strokeStyle = color; c.lineWidth = 2.5; rrect(x - s / 2, y - s / 2, s, s, s * 0.2); c.stroke();
    text(ch, x, y + 1, Math.round(s * 0.62), filled ? '#150f2b' : color, 'center', { pix: true });
  }
  function background(theme, dim) {
    if (!demoG) demoG = Sim.create(LEVELS[0]);
    Render.draw(c, { G: demoG, theme: theme || 'meadow', t: performance.now(), you: -1, scale: scale() });
    c.setTransform(scale(), 0, 0, scale(), 0, 0);
    c.fillStyle = `rgba(8,5,20,${dim})`; c.fillRect(0, 0, W, H);
  }
  function footer(parts) {
    // parts : [[dir|null, 'texte'], ...]
    let total = 0; const widths = parts.map(([d, t]) => { c.font = font(15, true); const w = c.measureText(t).width + (d === null ? 0 : 34); total += w + 26; return w; });
    let x = (W - total + 26) / 2;
    parts.forEach(([d, t], i) => {
      if (d !== null) { keycap(d, x + 13, H - 24, 24, DIM, false); x += 34; }
      text(t, x, H - 24, 15, DIM, 'left'); x += widths[i] - (d === null ? 0 : 34) + 26;
    });
  }

  function drawTitle(now) {
    background('arcane', 0.55);
    const bob = Math.sin(now / 500) * 4;
    // deux petits personnages
    for (let i = 0; i < 2; i++) {
      const x = W / 2 + (i ? 235 : -235), y = 128 + bob * (i ? -1 : 1);
      c.save(); c.translate(x, y); c.scale(2, 2);
      Render.drawCharacter(c, 0, 0, Render.P_COL[i], i, { face: i ? -1 : 1, blink: (now + i * 900) % 3300 < 130, mood: bob * (i ? -1 : 1) > 2 ? 'up' : 'idle', look: { x: i ? -1 : 1, y: 0 } });
      c.restore();
    }
    text('TANDEM', W / 2, 92, 78, '#fff', 'center', { pix: true, shadow: true });
    text('Deux joueurs. Des flèches. Aucun pouvoir, à part sauter.', W / 2, 150, 20, GOLD, 'center', { shadow: true });
    const items = titleItems();
    items.forEach((it, i) => {
      const y = 212 + i * 48, sel = i === S.menu;
      addHit(W / 2 - 250, y - 22, 500, 44, () => { S.menu = i; it.go(); }, () => { if (S.menu !== i) { S.menu = i; Sfx.play('menu'); } });
      if (sel) { panel(W / 2 - 250, y - 22, 500, 44, 'rgba(255,210,74,.14)'); c.strokeStyle = GOLD; c.lineWidth = 2; rrect(W / 2 - 250, y - 22, 500, 44, 14); c.stroke(); }
      text(it.label, W / 2, y - (sel && it.sub ? 6 : 0), sel ? 22 : 20, it.off ? '#6f688f' : sel ? '#fff' : INK, 'center');
      if (sel && it.sub) text(it.sub, W / 2, y + 13, 12, DIM, 'center', { bold: false });
    });
    footer([[0, ''], [2, 'choisir'], [1, 'valider'], [null, 'ou la souris']]);
  }

  function drawCode() {
    background('arcane', 0.88);
    text('Rejoindre une salle', W / 2, 80, 40, '#fff', 'center', { pix: true });
    text('Saisissez le code de 4 lettres donné par votre partenaire', W / 2, 130, 20, INK, 'center');
    for (let i = 0; i < 4; i++) {
      const x = W / 2 - 150 + i * 100, y = 215, ch = S.codeIn[i];
      if (ch !== undefined) lettercap(ch, x, y, 80, GOLD, true);
      else { c.setLineDash([6, 6]); c.strokeStyle = DIM; c.lineWidth = 2.5; rrect(x - 40, y - 40, 80, 80, 16); c.stroke(); c.setLineDash([]); }
    }
    text(S.connecting || (S.ws && S.codeIn.length === 4) ? 'Connexion…' : 'Tapez les lettres au clavier ou cliquez dessus', W / 2, 285, 18, GOLD, 'center');
    CODE_KEYS.forEach((ch, k) => {                 // petit clavier à la souris : 10 + 9 lettres
      const row = k < 10 ? 0 : 1, col = row ? k - 10 : k, n = row ? 9 : 10;
      const x = W / 2 + (col - (n - 1) / 2) * 52, y = 335 + row * 52, hov = over(x - 22, y - 22, 44, 44);
      lettercap(ch, x, y, 44, hov ? '#fff' : GOLD, hov);
      addHit(x - 22, y - 22, 44, 44, () => typeCode(ch));
    });
    button('Effacer', W / 2 + 270, 387, 100, 30, () => onPress('back'), { size: 14 });
    button('‹ Retour', 24, H - 52, 120, 34, () => toTitle(), { size: 15 });
    footer([[null, 'Retour arrière : effacer'], [null, 'Échap : quitter']]);
  }

  function drawWait() {
    background('arcane', 0.88);
    text('Salle créée', W / 2, 70, 40, '#fff', 'center', { pix: true });
    text('Donnez ce code à votre partenaire', W / 2, 120, 20, INK, 'center');
    for (let i = 0; i < 4; i++) lettercap(S.code[i], W / 2 - 150 + i * 100, 210, 80, GOLD, true);
    const dots = '.'.repeat(1 + Math.floor(performance.now() / 400) % 3);
    text('En attente du second joueur' + dots, W / 2, 300, 22, INK, 'center');
    text('Il choisit « Rejoindre une salle » et tape les 4 lettres ci-dessus.', W / 2, 340, 15, DIM, 'center', { bold: false });
    button('‹ Quitter la salle', 24, H - 52, 190, 34, () => toTitle(), { size: 15 });
    footer([[2, 'quitter la salle']]);
  }

  const thumbs = new Map();
  function thumbOf(i, w) {
    const k = i + '|' + w;
    if (!thumbs.has(k)) thumbs.set(k, Render.thumb(LEVELS[i], levelTheme(i), w));
    return thumbs.get(k);
  }

  function selectLevel(n) {
    S.sel = (n + LEVELS.length) % LEVELS.length; Sfx.play('menu');
    if (S.mode === 'online') wsSend({ t: 'sel', level: S.sel });
  }
  function launchSelected(practice) {
    practice = practice === true;
    if (S.mode === 'local') startLocal(S.sel, practice); else if (S.host) wsSend({ t: 'start', level: S.sel, practice });
    else { Sfx.play('error'); notify(`C’est l’hôte (joueur ${Render.P_COL[0].name}) qui lance le niveau.`); }
  }

  function drawSelect() {
    const lv = LEVELS[S.sel], th = levelTheme(S.sel), ch = CHAPTERS[lv.ch];
    background(th, 0.9);
    const canPick = S.mode === 'local' || S.host;
    text(`Chapitre ${lv.ch + 1} · ${ch.name}`, W / 2, 28, 16, Render.THEMES[th].accent, 'center', { pix: true });
    text(`${S.sel + 1}. ${lv.name}`, W / 2, 60, 32, '#fff', 'center');
    const tw = 400, th2 = tw / 2, tx = W / 2 - tw / 2, ty = 86;
    // aperçus voisins (cliquables)
    [-1, 1].forEach((d) => {
      const i = (S.sel + d + LEVELS.length) % LEVELS.length, sw = 150, x = d < 0 ? 40 : W - 40 - sw, y = ty + th2 / 2 - 37;
      const hov = over(x, y, sw, 75 + 24);
      c.globalAlpha = hov ? 0.95 : 0.55; c.drawImage(thumbOf(i, sw), x, y); c.globalAlpha = 1;
      if (hov) { c.strokeStyle = GOLD; c.lineWidth = 2; c.strokeRect(x, y, sw, 75); }
      text(`${i + 1}. ${LEVELS[i].name}`, x + sw / 2, y + 90, 13, hov ? INK : DIM, 'center');
      text(d < 0 ? '‹' : '›', x + sw / 2, y - 18, 28, hov ? GOLD : DIM, 'center');
      if (canPick) addHit(x, y - 34, sw, 75 + 24 + 34, () => selectLevel(S.sel + d));
    });
    const hovMain = over(tx, ty, tw, th2);
    c.fillStyle = '#000'; rrect(tx - 6, ty - 6, tw + 12, th2 + 12, 14); c.fill();
    c.drawImage(thumbOf(S.sel, tw), tx, ty);
    c.strokeStyle = canPick ? GOLD : DIM; c.lineWidth = hovMain && canPick ? 5 : 3; rrect(tx - 6, ty - 6, tw + 12, th2 + 12, 14); c.stroke();
    if (hovMain && canPick) {
      c.fillStyle = 'rgba(8,5,20,.45)'; c.fillRect(tx, ty, tw, th2);
      c.fillStyle = GOLD; c.beginPath(); c.moveTo(W / 2 - 18, ty + th2 / 2 - 26); c.lineTo(W / 2 + 28, ty + th2 / 2); c.lineTo(W / 2 - 18, ty + th2 / 2 + 26); c.closePath(); c.fill();
    }
    addHit(tx, ty, tw, th2, launchSelected);
    if (done[S.sel]) {
      panel(tx + tw - 130, ty + 8, 122, 28, 'rgba(10,6,24,.85)');
      text('✔ ' + fmtTime(done[S.sel].ticks), tx + tw - 69, ty + 22, 15, '#8ef0b4', 'center');
    }
    // indice
    const lines = wrap(lv.hint, 820, 16);
    lines.slice(0, 4).forEach((l, i) => text(l, W / 2, 326 + i * 22, 16, INK, 'center', { bold: false }));
    // pastilles de niveaux (cliquables)
    const n = LEVELS.length, gap = 28, x0 = W / 2 - (n - 1) * gap / 2;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * gap, hov = over(x - 13, 399, 26, 26);
      c.fillStyle = i === S.sel ? GOLD : done[i] ? '#5fcf8f' : hov ? '#8a7fc0' : '#4a4268';
      c.beginPath(); c.arc(x, 412, i === S.sel ? 8 : hov ? 7 : 5.5, 0, 6.2832); c.fill();
      if (canPick) addHit(x - 13, 399, 26, 26, () => { if (S.sel !== i) selectLevel(i); });
    }
    if (S.mode === 'online') {
      panel(14, 10, 190, 36, 'rgba(10,6,24,.75)');
      text('Salle', 28, 28, 14, DIM, 'left');
      for (let i = 0; i < 4; i++) lettercap(S.code[i], 98 + i * 26, 28, 22, GOLD, true);
      const you = Render.P_COL[S.you];
      panel(W - 214, 10, 200, 36, 'rgba(10,6,24,.75)');
      c.fillStyle = you.main; rrect(W - 200, 18, 18, 20, 6); c.fill();
      text(`Vous : ${you.name}${S.host ? ' (hôte)' : ''}`, W - 174, 28, 14, INK, 'left');
    }
    button('‹ Retour', 24, H - 52, 120, 34, () => { toTitle(); Sfx.play('menu'); }, { size: 15 });
    button('', 160, H - 52, 150, 34, () => { Sfx.play('ok'); openColors('select'); }, { size: 15 });
    text('Couleurs', 160 + 94, H - 35, 15, INK, 'center');
    [0, 1].forEach((i) => { c.fillStyle = Render.P_COL[i].main; c.beginPath(); c.arc(160 + 20 + i * 15, H - 35, 6, 0, 6.2832); c.fill(); });
    if (canPick) button('▶ Jouer', W - 144, H - 52, 120, 34, () => launchSelected(false), { size: 15, primary: true });
    if (canPick) button('Entraînement (T)', W - 330, H - 52, 174, 34, () => launchSelected(true), { size: 15 });
    footer(canPick ? [[3, ''], [1, 'choisir'], [0, 'lancer']] : [[null, 'L’hôte choisit le niveau…'], [2, 'quitter']]);
  }

  function drawHud(G) {
    const lv = LEVELS[S.level];
    c.fillStyle = 'rgba(8,5,20,.65)'; c.fillRect(0, 0, 250, 30); c.fillRect(W - 250, 0, 250, 30);
    text(`${S.level + 1} · ${lv.name}`, 12, 15, 14, INK, 'left');
    if (S.practice) {
      text(`☠ ${G.deaths}${S.speed < 1 ? `   ralenti ×${S.speed === 0.5 ? '½' : '¼'}` : ''}`, W - 12, 15, 14, INK, 'right');
      panel(10, 34, 118, 18, 'rgba(255,210,74,.9)'); text('ENTRAÎNEMENT', 69, 43, 10, '#1a1530', 'center', { pix: true });
    } else text(`☠ ${G.deaths}   ${fmtTime(G.t)}`, W - 12, 15, 14, INK, 'right');
    if (!S.overlay) {
      const btn = (x, w, label, cb, hot, flag) => {
        const hov = over(x, 3, w, 24);
        c.fillStyle = hot ? 'rgba(255,210,74,.4)' : hov ? 'rgba(255,210,74,.3)' : 'rgba(8,5,20,.6)'; rrect(x, 3, w, 24, 7); c.fill();
        const col = hov || hot ? GOLD : INK;
        if (flag) { c.fillStyle = col; c.fillRect(x + 10, 8, 2, 14); c.beginPath(); c.moveTo(x + 12, 8); c.lineTo(x + 21, 11.5); c.lineTo(x + 12, 15); c.closePath(); c.fill(); }
        text(label, x + (flag ? 26 : 0) + (w - (flag ? 26 : 0)) / 2, 15, 12, col, 'center');
        addHit(x, 3, w, 24, cb);
      };
      btn(W - 290, 30, 'II', togglePause, false);
      const asking = performance.now() < S.confirmT;
      btn(W - 384, 90, asking ? 'Confirmer ?' : 'Niveaux', () => { if (performance.now() < S.confirmT) { S.confirmT = 0; doLobby(); } else { S.confirmT = performance.now() + 2500; Sfx.play('menu'); } }, asking);
      btn(W - 482, 94, 'Drapeau', () => { doRecall(0, true); Sfx.play('menu'); }, false, true);
    }
    if (S.mode === 'online') {
      const you = Render.P_COL[S.you];
      c.fillStyle = you.main; c.fillRect(W - 250, 0, 4, 30);
      if (S.ping >= 0) text(`${S.ping} ms`, W - 240, 15, 11, S.ping > 120 ? '#ff8a8a' : DIM, 'left', { bold: false });
    }
    // indice : visible au début du niveau, puis s'estompe
    const a = G.t < 300 ? 1 : Math.max(0, 1 - (G.t - 300) / 90);
    if (a > 0 && !G.won) {
      c.globalAlpha = a;
      const tipText = lv.tip || lv.hint;
      c.font = font(15, true);
      const tw = Math.min(900, c.measureText(tipText).width + 40);
      panel(W / 2 - tw / 2, 33, tw, 28, 'rgba(10,6,24,.82)');
      text(tipText, W / 2, 47, 15, INK, 'center');
      c.globalAlpha = 1;
    }
    if (S.msg && performance.now() < S.msgT) { panel(W / 2 - 190, H - 52, 380, 34, 'rgba(10,6,24,.85)'); text(S.msg, W / 2, H - 35, 15, GOLD, 'center'); }
    if (S.practice && !S.overlay) {                           // barre d'outils d'entraînement (souris ou touches)
      const y = H - 36, bw = (x, w, label, cb, hot) => {
        const hov = over(x, y, w, 26);
        c.fillStyle = hot ? 'rgba(255,210,74,.4)' : hov ? 'rgba(255,210,74,.3)' : 'rgba(8,5,20,.72)'; rrect(x, y, w, 26, 8); c.fill();
        text(label, x + w / 2, y + 13, 12, hov || hot ? GOLD : INK, 'center'); addHit(x, y, w, 26, cb);
      };
      let x = 10;
      bw(x, 112, 'Point ici  [C]', practicePoint, !!G.custom); x += 118;
      bw(x, 120, `Ralenti ${S.speed === 1 ? '×1' : S.speed === 0.5 ? '×½' : '×¼'}  [V]`, cycleSpeed, S.speed < 1); x += 126;
      bw(x, 94, 'Début  [0]', () => practiceGoto(-1), false); x += 100;
      flagOrder().forEach((f, n) => { bw(x, 74, `⚑ ${n + 1}  [${n + 1}]`, () => practiceGoto(f), G.cp === f); x += 80; });
    }
    if (!S.overlay) S.hd.forEach((h, k) => {                  // touche ↓ maintenue : barre « drapeau » puis « pause »
      if (h < 10) return;
      const col = Render.P_COL[S.mode === 'online' ? S.you : k], ready = h >= HOLD_RECALL;
      const y = H - 50 - k * 44 - (S.practice ? 40 : 0), w = 270, x = W / 2 - w / 2;
      panel(x - 10, y - 24, w + 20, 44, 'rgba(8,5,20,.88)');
      text(ready ? 'Relâchez : retour au drapeau' : 'Retour au drapeau…', W / 2, y - 10, 13, ready ? '#8ef0b4' : INK, 'center');
      c.fillStyle = 'rgba(255,255,255,.14)'; rrect(x, y + 2, w, 9, 4.5); c.fill();
      c.fillStyle = ready ? '#8ef0b4' : col.main; rrect(x, y + 2, Math.max(9, w * Math.min(1, h / HOLD_PAUSE)), 9, 4.5); c.fill();
      c.fillStyle = '#fff'; c.fillRect(x + w * HOLD_RECALL / HOLD_PAUSE - 1, y, 2, 13);
      if (ready) text('encore : pause', x + w, y + 20, 10, DIM, 'right', { bold: false });
    });
  }

  function drawPlay(now) {
    const G = S.G; if (!G) return;
    const k = S.shake / 14;
    Render.draw(c, { G, theme: levelTheme(S.level), t: now, you: S.mode === 'online' ? S.you : -1, scale: scale(), cam: S.cam, shake: { x: (Math.random() - 0.5) * 9 * k, y: (Math.random() - 0.5) * 9 * k } });
    c.setTransform(scale(), 0, 0, scale(), 0, 0);
    drawHud(G);
    if (S.overlay) {
      c.fillStyle = 'rgba(8,5,20,.72)'; c.fillRect(0, 0, W, H);
      text('Pause', W / 2, 130, 44, '#fff', 'center', { pix: true });
      if (S.mode === 'online') text('Le jeu continue pour votre partenaire.', W / 2, 172, 15, DIM, 'center', { bold: false });
      const acts = [() => { S.overlay = false; S.hd = [0, 0]; syncInputs(true); }, doRestart, doLobby];
      const opts = [[0, 'Reprendre'], [3, 'Recommencer le niveau'], [1, 'Quitter vers les niveaux']];
      opts.forEach(([d, t], i) => {
        const y = 235 + i * 56, hov = over(W / 2 - 250, y - 26, 500, 52);
        if (hov) { panel(W / 2 - 250, y - 26, 500, 52, 'rgba(255,210,74,.14)'); }
        keycap(d, W / 2 - 170, y, 40, GOLD, true); text(t, W / 2 - 130, y, 24, INK, 'left');
        addHit(W / 2 - 250, y - 26, 500, 52, acts[i]);
      });
    }
  }

  /* ---------- Couleurs ---------- */
  function applyColors() {
    Render.setColors(S.colors); thumbs.clear();
    const set = (id, k) => { const el = document.getElementById(id); if (el) { el.textContent = Render.P_COL[k].name; el.style.color = Render.P_COL[k].main; } };
    set('lgA', 0); set('lgB', 0); set('lgC', 1);
  }
  const colorRows = () => (S.mode === 'online' ? [{ slot: S.you, mine: true }, { slot: 1 - S.you, mine: false }] : [{ slot: 0, mine: true }, { slot: 1, mine: true }]);
  const colorOf = (slot) => (S.mode === 'online' ? S.colors[slot] : prefs[slot]);
  function openColors(prev) { S.prev = prev; S.screen = 'colors'; S.row = 0; }
  function leaveColors() { S.screen = S.prev; Sfx.play('menu'); }
  function pickColor(slot, k) {
    if (S.mode === 'online') {
      if (slot !== S.you) return;
      if (k === S.colors[1 - S.you]) { Sfx.play('error'); notify('Cette couleur est déjà prise par votre partenaire.'); return; }
      prefs[0] = k; savePrefs(); wsSend({ t: 'color', c: k }); Sfx.play('menu');
    } else {
      if (k === prefs[1 - slot]) { Sfx.play('error'); notify('L’autre joueur a déjà cette couleur.'); return; }
      prefs[slot] = k; savePrefs(); S.colors = prefs.slice(); applyColors(); Sfx.play('menu');
    }
  }
  function colorsKey(dir) {
    const rows = colorRows();
    if (dir === 1 || dir === 3) {
      const r = rows[S.row]; if (!r || !r.mine) return;
      const other = colorOf(1 - r.slot), d = dir === 1 ? 1 : -1;
      let k = colorOf(r.slot);
      do { k = (k + d + NCOL) % NCOL; } while (k === other);
      pickColor(r.slot, k);
    } else if (dir === 2 && S.mode !== 'online') { S.row = (S.row + 1) % 2; Sfx.play('menu'); }
    else leaveColors();
  }
  function blob(x, y, slot, sc, f, t) {
    const hop = Math.max(0, Math.sin(t / 420 + slot * 2)) * 5;
    c.save(); c.translate(x, y + 24 - hop); c.scale(sc, sc);
    Render.drawCharacter(c, 0, 0, Render.PALETTE[S.mode === 'online' ? S.colors[slot] : prefs[slot]], slot, { face: f, blink: (t + slot * 800) % 3100 < 130, mood: hop > 2.5 ? 'up' : 'idle', look: { x: f, y: 0 } });
    c.restore();
  }
  function drawColors(now) {
    background('arcane', 0.9);
    text('Couleurs', W / 2, 52, 40, '#fff', 'center', { pix: true });
    const online = S.mode === 'online';
    text(online ? 'Votre partenaire voit votre couleur en temps réel.' : 'Chacun choisit la sienne (deux couleurs différentes).', W / 2, 96, 16, DIM, 'center', { bold: false });
    colorRows().forEach((r, ri) => {
      const y = 190 + ri * 125, active = ri === S.row && r.mine, cur = colorOf(r.slot), other = colorOf(1 - r.slot);
      panel(40, y - 54, W - 80, 108, active ? 'rgba(255,210,74,.12)' : 'rgba(12,8,30,.62)');
      if (active) { c.strokeStyle = GOLD; c.lineWidth = 2; rrect(40, y - 54, W - 80, 108, 14); c.stroke(); }
      blob(105, y - 8, r.slot, 1.9, ri ? -1 : 1, now);
      const label = online ? (r.mine ? 'Vous' : 'Votre partenaire') : (r.slot === 0 ? 'Joueur 1 · flèches' : 'Joueur 2 · Z Q D');
      text(label, 170, y - 14, 19, r.mine ? INK : DIM, 'left');
      text(Render.PALETTE[cur].name, 170, y + 14, 16, Render.PALETTE[cur].main, 'left');
      for (let k = 0; k < NCOL; k++) {
        const x = 372 + k * 68, taken = k === other, sel = k === cur, hov = r.mine && !taken && over(x - 25, y - 25, 50, 50);
        c.globalAlpha = taken ? 0.22 : r.mine || sel ? 1 : 0.45;
        c.fillStyle = Render.PALETTE[k].main; rrect(x - 22, y - 22, 44, 44, 13); c.fill();
        c.globalAlpha = 1;
        if (sel) { c.strokeStyle = '#fff'; c.lineWidth = 3.5; rrect(x - 27, y - 27, 54, 54, 16); c.stroke(); }
        else if (hov) { c.strokeStyle = GOLD; c.lineWidth = 2.5; rrect(x - 26, y - 26, 52, 52, 16); c.stroke(); }
        if (taken) text('✕', x, y, 20, '#fff', 'center');
        if (r.mine) addHit(x - 25, y - 25, 50, 50, () => { S.row = ri; pickColor(r.slot, k); });
      }
    });
    button('‹ Retour', 24, H - 52, 120, 34, leaveColors, { size: 15 });
    footer(online ? [[3, ''], [1, 'couleur'], [0, 'valider']] : [[3, ''], [1, 'couleur'], [2, 'autre joueur'], [0, 'valider']]);
  }

  function drawResult() {
    const G = S.G; if (!G) return;
    drawPlay(performance.now());
    hits = [];                                      // le décor de la partie ne doit rien capter pendant l’écran de résultat
    c.fillStyle = 'rgba(8,5,20,.72)'; c.fillRect(0, 0, W, H);
    text(S.practice ? 'Entraînement terminé !' : 'Niveau réussi !', W / 2, 96, S.practice ? 40 : 50, GOLD, 'center', { pix: true, shadow: true });
    text(`${S.level + 1}. ${LEVELS[S.level].name}`, W / 2, 148, 22, INK, 'center');
    text(S.practice ? `Chutes ${G.deaths}  ·  rien n’est enregistré` : `Temps ${fmtTime(G.t)}      Chutes ${G.deaths}`, W / 2, 188, 24, '#fff', 'center');
    const best = done[S.level];
    if (best && !S.practice) text(`Record : ${fmtTime(best.ticks)}`, W / 2, 222, 16, DIM, 'center', { bold: false });
    const last = S.level + 1 >= LEVELS.length;
    const opts = [[0, last ? 'Terminer (retour aux niveaux)' : 'Niveau suivant'], [1, 'Rejouer'], [2, 'Retour aux niveaux']];
    const acts = [doNext, doRestart, doLobby];
    opts.forEach(([d, t], i) => {
      const y = 280 + i * 52, hov = over(W / 2 - 270, y - 25, 540, 50);
      if (hov) panel(W / 2 - 270, y - 25, 540, 50, 'rgba(255,210,74,.14)');
      keycap(d, W / 2 - 190, y, 38, GOLD, d === 0); text(t, W / 2 - 150, y, 23, INK, 'left');
      addHit(W / 2 - 270, y - 25, 540, 50, acts[i]);
    });
    if (last) text('Vous avez fini tous les niveaux. Bravo, à deux !', W / 2, 450, 16, '#8ef0b4', 'center');
  }


  /* ---------- Chat : messages discrets en bas à droite, qui s'effacent seuls ---------- */
  function drawChat(now) {
    if (S.mode !== 'online') return;
    if (S.typing && !chatOk()) { S.typing = false; S.draft = ''; }
    const typing = S.typing, X = W - 10 - CHAT_W;
    let base = S.screen === 'play' ? H - 12 : H - 48;      // en menu : au-dessus de la rangée de boutons
    if (S.screen === 'play' && S.practice) base = H - 44;
    if (typing) base = H - 44;
    c.save();
    const rows = [];
    for (const m of S.chat) {
      const age = now - m.t;
      const a = typing ? (age < 40000 ? 1 : 0) : age < CHAT_SHOW ? 1 : age < CHAT_SHOW + CHAT_FADE ? 1 - (age - CHAT_SHOW) / CHAT_FADE : 0;
      if (a > 0) rows.push({ m, a });
    }
    let y = base;
    for (let i = rows.length - 1; i >= 0; i--) {
      const { m, a } = rows[i];
      const who = Render.P_COL[m.from], name = who.name + ' : ';
      c.font = font(13, true); const nw = c.measureText(name).width;
      c.font = font(13, false);
      const lines = []; let cur = '';
      for (const w of m.txt.split(' ')) {                     // retour à la ligne (le 1er mot suit le nom)
        const t = cur ? cur + ' ' + w : w, lim = CHAT_W - 16 - (lines.length ? 0 : nw);
        if (c.measureText(t).width > lim && cur) { lines.push(cur); cur = w; } else cur = t;
      }
      lines.push(cur);
      const h = lines.length * 17 + 8;
      y -= h;
      if (y < 70) break;
      c.globalAlpha = 0.78 * a; c.fillStyle = 'rgba(8,5,20,.8)'; rrect(X, y, CHAT_W, h, 9); c.fill();
      c.fillStyle = who.main; c.fillRect(X, y + 4, 3, h - 8);
      c.globalAlpha = a;
      lines.forEach((ln, k) => {
        if (k === 0) { text(name, X + 10, y + 4 + 8.5, 13, who.main, 'left'); text(ln, X + 10 + nw, y + 4 + 8.5, 13, INK, 'left', { bold: false }); }
        else text(ln, X + 10, y + 4 + 8.5 + k * 17, 13, INK, 'left', { bold: false });
      });
      y -= 4;
    }
    c.globalAlpha = 1;
    if (typing) {
      const me = Render.P_COL[S.you], by = H - 38, h = 26;
      c.fillStyle = 'rgba(8,5,20,.92)'; rrect(X, by, CHAT_W, h, 9); c.fill();
      c.strokeStyle = me.main; c.lineWidth = 2; rrect(X, by, CHAT_W, h, 9); c.stroke();
      c.font = font(13, false);
      let shown = S.draft;
      while (shown.length > 1 && c.measureText(shown).width > CHAT_W - 34) shown = shown.slice(1);
      const caret = Math.floor(now / 450) % 2 === 0 ? '▏' : '';
      text(shown + caret, X + 10, by + h / 2, 13, INK, 'left', { bold: false });
      if (!S.draft) text('Votre message…  (Entrée : envoyer · Échap : annuler)', X + 10, by + h / 2, 11, DIM, 'left', { bold: false });
      else if (S.draft.length > CHAT_MAX - 25) text(`${CHAT_MAX - S.draft.length}`, X + CHAT_W - 8, by + h / 2, 11, GOLD, 'right');
    }
    c.restore();
  }

  function render(now) {
    c.setTransform(scale(), 0, 0, scale(), 0, 0);
    c.clearRect(0, 0, W, H);
    hits = [];
    switch (S.screen) {
      case 'title': drawTitle(now); break;
      case 'code': drawCode(); break;
      case 'wait': drawWait(); break;
      case 'select': drawSelect(); break;
      case 'colors': drawColors(now); break;
      case 'play': drawPlay(now); break;
      case 'result': drawResult(); break;
      default: break;
    }
    c.setTransform(scale(), 0, 0, scale(), 0, 0);
    drawChat(now);
    if (S.screen !== 'play' && S.msg && now < S.msgT) { panel(W / 2 - 250, 8, 500, 34, 'rgba(10,6,24,.9)'); text(S.msg, W / 2, 25, 15, GOLD, 'center'); }
  }

  // Accès de test / débogage (facultatif)
  window.__tandem = { S, startLocal, onPress, dn };

  applyColors();
  resize();
  requestAnimationFrame(frame);
})();
