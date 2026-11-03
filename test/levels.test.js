// Valide chaque niveau : parsing, puis solution scriptée à deux bots dans le vrai moteur.
const { run, ascii, Sim } = require('./harness');
const { LEVELS } = require('../public/shared/levels.js');
const SOL = require('./solutions');

const only = process.argv[2] !== undefined ? Number(process.argv[2]) : null;
const show = process.argv.includes('--map');
let fails = 0;

LEVELS.forEach((def, i) => {
  if (only !== null && only !== i) return;
  let label = `Niveau ${i + 1} « ${def.name} »`;
  try { Sim.parseLevel(def); } catch (e) { console.log(`ÉCHEC ${label} : ${e.message}`); fails++; return; }
  if (show) console.log(ascii(Sim.create(def)));
  if (!SOL[i]) { console.log(`  ?   ${label} : pas de solution scriptée`); fails++; return; }
  const r = run(def, SOL[i], { max: 9000 });
  if (r.won) console.log(`  ok  ${label} : réussi en ${(r.ticks / 60).toFixed(1)} s (${r.deaths} mort${r.deaths > 1 ? 's' : ''})`);
  else {
    fails++;
    console.log(`ÉCHEC ${label} : ${r.error ? r.error.message : 'non terminé au tick ' + r.ticks}`);
    console.log(ascii(r.G));
    console.log('  portes :', JSON.stringify(r.G.doorOcc), 'open', JSON.stringify(r.G.open), 'bridge', JSON.stringify(r.G.bridge), 'morts', r.G.deaths);
  }
});
if (fails) { console.log(`\n${fails} niveau(x) en échec`); process.exitCode = 1; } else console.log('\nTous les niveaux sont réussis par les bots');
