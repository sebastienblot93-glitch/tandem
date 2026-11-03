// TANDEM — sons synthétisés (aucun fichier audio). Le navigateur n'autorise le son qu'après une touche : unlock() à la 1re touche.
(function (root) {
  'use strict';
  let ctx = null;
  let enabled = true;
  try { enabled = localStorage.getItem('tandem.sound') !== '0'; } catch (e) { /* stockage indisponible */ }

  function unlock() {
    if (!ctx) { try { ctx = new (root.AudioContext || root.webkitAudioContext)(); } catch (e) { ctx = null; } }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }
  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.03);
  }
  const arp = (notes, step, type, vol, dur) => notes.forEach((f, i) => tone(f, dur || 0.16, type || 'triangle', vol || 0.06, null, i * step));

  const SOUNDS = {
    jump: (who) => tone(who ? 380 : 320, 0.13, 'square', 0.035, who ? 760 : 640),
    spring: () => { tone(220, 0.28, 'square', 0.04, 880); tone(440, 0.2, 'triangle', 0.05, 1320, 0.03); },
    crack: () => { tone(180, 0.05, 'sawtooth', 0.05, 90); tone(140, 0.06, 'square', 0.04, 70, 0.07); },
    crumble: () => { tone(110, 0.3, 'sawtooth', 0.05, 40); tone(80, 0.25, 'square', 0.04, 35, 0.04); },
    portal: () => { tone(300, 0.18, 'sine', 0.06, 900); tone(900, 0.18, 'sine', 0.05, 300, 0.1); },
    land: () => tone(130, 0.07, 'triangle', 0.07, 70),
    bell: (g) => { tone(880 + (g || 1) * 110, 0.5, 'sine', 0.09); tone(1760 + (g || 1) * 220, 0.35, 'sine', 0.04, null, 0.01); },
    bridge: () => arp([440, 554, 659, 880], 0.055, 'triangle', 0.07, 0.2),
    bridgeOff: () => tone(300, 0.25, 'triangle', 0.05, 120),
    plate: () => tone(210, 0.06, 'square', 0.045, 160),
    gateOpen: () => arp([330, 495], 0.07, 'sawtooth', 0.035, 0.18),
    gateClose: () => tone(240, 0.2, 'sawtooth', 0.04, 90),
    death: () => tone(320, 0.45, 'sawtooth', 0.06, 50),
    respawn: () => arp([392, 523], 0.06, 'sine', 0.05, 0.12),
    flag: () => arp([523, 659, 784], 0.07, 'triangle', 0.07, 0.18),
    doors: () => tone(660, 0.12, 'sine', 0.05),
    win: () => arp([523, 659, 784, 1047, 784, 1047], 0.1, 'triangle', 0.08, 0.28),
    menu: () => tone(520, 0.05, 'square', 0.03),
    ok: () => arp([660, 880], 0.05, 'square', 0.035, 0.08),
    error: () => tone(160, 0.2, 'sawtooth', 0.05, 90),
  };

  root.Sfx = {
    unlock,
    play(name, a) { try { if (SOUNDS[name]) SOUNDS[name](a); } catch (e) { /* ignore */ } },
    get enabled() { return enabled; },
    set enabled(v) { enabled = !!v; try { localStorage.setItem('tandem.sound', enabled ? '1' : '0'); } catch (e) { /* ignore */ } },
  };
})(window);
