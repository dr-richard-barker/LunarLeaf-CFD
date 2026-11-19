import { writeFileSync } from 'node:fs';
import { makeLeafScene, leafGeometry, rosetteGeometry, canopyGeometry } from '../src/scenarios/scenarios';
import { DEFAULT_STEPS } from './jobs';
const DOM = { nx: 128, ny: 96, renderScale: 0.2 };
const Ca = Number(process.argv[2] ?? 8);
const rows: string[] = ['scenario,net_assimilation_pct,dC_CO2_mean'];
function run(label: string, geometry: any, extra: any, sScale = 1, steps = DEFAULT_STEPS) {
  const inst = makeLeafScene({ ...DOM, id: 'x', label: 'x', geometry, sourceScale: sScale, gRatio: 0, co2Ambient: Ca, ...extra })();
  const f = inst.fluid;
  for (let s = 0; s < steps; s++) { f.collideAndStream(); inst.postStream(); inst.onAfterStep(s); }
  const d = inst.diagnostics(steps);
  const g = (k: string) => (d.find((r) => r.label.startsWith(k)) ?? { value: '-' }).value;
  const aPct = g('net assimilation').replace('%', '').trim();
  const dC = g('ΔC CO₂').split('/')[0].trim();
  console.log(`${label.padEnd(20)} A_eff=${aPct}%  ΔC_CO2=${dC}`);
  rows.push(`${label},${aPct},${dC}`);
}
console.log(`=== photosynthesis feedback, Ca=${Ca} model units ===`);
run('leaf Earth', leafGeometry, { gRatio: 1 });
run('leaf ug', leafGeometry, { gRatio: 0 });
run('rosette ug', rosetteGeometry, { gRatio: 0 });
run('canopy ug', canopyGeometry, { gRatio: 0 }, 0.3, 900000);
run('leaf ug BRIC', leafGeometry, { membraneK: 0 }, 1, 22000);
run('leaf ug CARA', leafGeometry, { membraneK: 0.01 }, 1, 22000);
run('leaf ug VEGGIE', leafGeometry, { forcedU: 0.05 });
writeFileSync('results/tables/T12_feedback_spatial.csv', rows.join('\n') + '\n');
