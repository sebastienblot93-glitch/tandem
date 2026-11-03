// Cherche (phase de saut, durée de maintien) pour chaque saut des pierres du niveau 9 (période 96).
// Usage : node test/search-stones.js   → affiche les paramètres à reporter dans solutions.js (ST9)
const { run } = require('./harness');
const { LEVELS } = require('../public/shared/levels.js');
const def = LEVELS[8];
const PER = def.cfg.rhythm.period;
const minX = [200, 300, 400, 480];

function tryParams(list) {
  let ok = false, stage = 0;
  const r = run(def, [null, function* (c) {
    yield* c.walkTo(168);
    for (const [p, h] of list) {
      yield* c.until(() => c.G.t % PER === p, 400);
      yield* c.hop(1, h); yield* c.land();
      if (c.me.x < minX[stage] || c.G.deaths > 0) throw new Error('raté');
      stage++;
    }
    ok = true;
  }], { max: 900 });
  return ok;
}
const good = (list, k) => tryParams(list);
const robust = (list) => {
  const last = list[list.length - 1];
  for (const dp of [-2, 2]) if (!tryParams([...list.slice(0, -1), [(last[0] + dp + PER) % PER, last[1]]])) return false;
  for (const dh of [-1, 1]) if (!tryParams([...list.slice(0, -1), [last[0], last[1] + dh]])) return false;
  return true;
};
function dfs(list, depth) {
  if (depth === 3) return list;
  const cands = [];
  for (let p = 0; p < PER; p += 2) for (let h = 8; h <= 34; h += 2) {
    const l = [...list, [p, h]];
    if (tryParams(l) && robust(l)) cands.push(l);
  }
  if (process.env.DBG) console.log('profondeur', depth, 'candidats', cands.length);
  // on garde les candidats les plus « centrés » (voisins nombreux)
  for (const l of cands.slice(0, 12)) { const r = dfs(l, depth + 1); if (r) return r; }
  return null;
}
const res = dfs([], 0);
console.log(res ? 'ST9 =' + JSON.stringify(res) : 'aucune solution trouvée');
