// Caméra : à chaque instant, chaque joueur vivant doit être visible (vue commune, ou moitié d'écran en écran partagé).
// On rejoue les solutions des 30 niveaux et on ajoute des positions extrêmes (joueurs aux deux bouts du niveau).
global.window = global;
const Sim = require('../public/shared/sim.js');
global.Sim = Sim;
const { run } = require('./harness');
const { LEVELS } = require('../public/shared/levels.js');
const SOL = require('./solutions');
let Render;
try { require('../public/scenery.js'); require('../public/render.js'); Render = global.Render; } catch (e) { console.log('Chargement du rendu impossible hors navigateur :', e.message); process.exit(1); }
const { W, H } = Render;
const PW = Sim.PW, PH = Sim.PH;

// Zone du monde visible pour le joueur i, d'après la caméra
function visibleBox(cam, i, you) {
  if (cam.split) {
    const z = cam.sz;
    return { x0: cam.sub[i].x, x1: cam.sub[i].x + (W / 2) / z, y0: cam.sub[i].y, y1: cam.sub[i].y + H / z };
  }
  return { x0: cam.x, x1: cam.x + W / cam.z, y0: cam.y, y1: cam.y + H / cam.z };
}
const inside = (p, b) => p.x + PW > b.x0 && p.x < b.x1 && p.y + PH > b.y0 && p.y < b.y1;

let fails = 0, splitTicks = 0, ticks = 0;
function check(label, G, cam) {
  G.players.forEach((p, i) => { if (!p.dead && !inside(p, visibleBox(cam, i))) { fails++; if (fails < 8) console.log(`ÉCHEC ${label} : joueur ${i + 1} hors champ en (${Math.round(p.x)}, ${Math.round(p.y)}), split=${!!cam.split}`); } });
}
LEVELS.forEach((def, li) => {
  if (!SOL[li]) return;
  const cam = Render.newCam();
  run(def, SOL[li], { max: 9000, onTick: (G, tick) => {
    Render.updateCam(cam, G, tick === 0);
    if (tick > 40) { ticks++; if (cam.split) splitTicks++; check(`niveau ${li + 1} tick ${tick}`, G, cam); }   // le temps que la caméra se stabilise
  } });
});
// positions extrêmes : un joueur à chaque bout de chaque niveau
LEVELS.forEach((def, li) => {
  const G = Sim.create(def), cam = Render.newCam();
  Render.updateCam(cam, G, true);
  G.players[0].x = 40; G.players[0].y = G.L.h - 100;
  G.players[1].x = G.L.w - 80; G.players[1].y = 40;
  for (let k = 0; k < 120; k++) Render.updateCam(cam, G);
  check(`niveau ${li + 1} (joueurs aux deux bouts)`, G, cam);
});
if (fails) { console.log(`${fails} cas où un joueur n'est pas visible`); process.exitCode = 1; }
else console.log(`Caméra : les deux joueurs sont toujours visibles (${ticks} images analysées, dont ${splitTicks} en écran partagé)`);
