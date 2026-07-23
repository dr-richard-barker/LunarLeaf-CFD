import { makeLeafScene, leafGeometry, rosetteGeometry, canopyGeometry } from '../src/scenarios/scenarios';
const DOM = { nx: 128, ny: 96, renderScale: 0.2 };
const Ca = Number(process.argv[2] ?? 8);
const STEPS = 22000;
function run(label: string, geometry: any, extra: any, sScale = 1) {
  const inst = makeLeafScene({ ...DOM, id: 'x', label: 'x', geometry, sourceScale: sScale, gRatio: 0, co2Ambient: Ca, ...extra })();
  const f = inst.fluid;
  for (let s = 0; s < STEPS; s++) { f.collideAndStream(); inst.postStream(); inst.onAfterStep(s); }
  const d = inst.diagnostics(STEPS);
  const g = (k: string) => (d.find((r) => r.label.startsWith(k)) ?? { value: '-' }).value;
  console.log(`${label.padEnd(20)} A_eff=${g('net assimilation')}%  ΔC_CO2=${g('ΔC CO₂')}`);
}
console.log(`=== photosynthesis feedback, Ca=${Ca} model units ===`);
run('leaf Earth', leafGeometry, { gRatio: 1 });
run('leaf µg', leafGeometry, { gRatio: 0 });
run('rosette µg', rosetteGeometry, { gRatio: 0 });
run('canopy µg', canopyGeometry, { gRatio: 0 }, 0.3);
run('leaf µg BRIC', leafGeometry, { membraneK: 0 });
run('leaf µg CARA', leafGeometry, { membraneK: 0.01 });
run('leaf µg VEGGIE', leafGeometry, { forcedU: 0.05 });
