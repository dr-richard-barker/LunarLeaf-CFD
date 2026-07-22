// Forced-airflow sweep: a leaf in microgravity ventilated at increasing fan
// speeds. Finds the fan speed at which the surface gas gaps fall back to the
// Earth-1 g (buoyant-convection) level — the ventilation needed to null the
// microgravity penalty.
import { writeFileSync } from 'node:fs';
import { makeLeafScene, leafGeometry } from '../src/scenarios/scenarios';

const U_STAR_CM_S = 166; // lattice→physical velocity (results/tables/T3)
const STEPS = 30000;
const DOM = { nx: 128, ny: 96, renderScale: 0.12, geometry: leafGeometry };

function run(cfgExtra: { gRatio: number; forcedU?: number }) {
  const inst = makeLeafScene({ ...DOM, id: 'x', label: 'x', ...cfgExtra })();
  const f = inst.fluid;
  for (let s = 0; s < STEPS; s++) {
    f.collideAndStream();
    inst.postStream();
    inst.onAfterStep(s);
  }
  const d = inst.diagnostics(STEPS);
  const pair = (k: string) => parseFloat(d.find((r) => r.label.startsWith(k))!.value.split('/')[0]);
  const num = (k: string) => parseFloat(d.find((r) => r.label.startsWith(k))!.value);
  return { umax: num('u_max'), w: Math.abs(pair('ΔC H₂O')), c: Math.abs(pair('ΔC CO₂')) };
}

const earth = run({ gRatio: 1 });
const ugStill = run({ gRatio: 0 });
console.log(`Earth-1g   ΔC_H2O=${earth.w.toFixed(3)}  u_max=${earth.umax.toExponential(2)}`);
console.log(`µg (still) ΔC_H2O=${ugStill.w.toFixed(3)}`);

const Us = [0.005, 0.01, 0.02, 0.03, 0.04, 0.05, 0.07, 0.1, 0.15];
const rows = ['case,fan_U,fan_cm_s,u_max,dC_H2O_mean,dC_CO2_mean'];
rows.push(`earth_1g,,,${earth.umax.toExponential(3)},${earth.w.toFixed(4)},${earth.c.toFixed(4)}`);
rows.push(`ug_still,0,0,0,${ugStill.w.toFixed(4)},${ugStill.c.toFixed(4)}`);

const series: { U: number; w: number }[] = [];
for (const U of Us) {
  const r = run({ gRatio: 0, forcedU: U });
  series.push({ U, w: r.w });
  rows.push(`ug_fan,${U},${(U * U_STAR_CM_S).toFixed(1)},${r.umax.toExponential(3)},${r.w.toFixed(4)},${r.c.toFixed(4)}`);
  console.log(`fan U=${U} (${(U * U_STAR_CM_S).toFixed(1)} cm/s)  ΔC_H2O=${r.w.toFixed(3)}  u_max=${r.umax.toExponential(2)}`);
}

// Interpolate the fan speed that matches the Earth-1g surface gap.
let nullU = NaN;
for (let i = 1; i < series.length; i++) {
  const a = series[i - 1];
  const b = series[i];
  if ((a.w - earth.w) * (b.w - earth.w) <= 0) {
    nullU = a.U + ((earth.w - a.w) / (b.w - a.w)) * (b.U - a.U);
    break;
  }
}
const nullCm = nullU * U_STAR_CM_S;
rows.push(`# Earth-equivalent fan speed = ${nullU.toFixed(3)} lattice = ${nullCm.toFixed(1)} cm/s`);
writeFileSync('results/tables/T6_forced_airflow.csv', rows.join('\n') + '\n');
console.log(`\n=> Earth-equivalent ventilation: ${nullU.toFixed(3)} lattice ≈ ${nullCm.toFixed(1)} cm/s`);
console.log('wrote T6_forced_airflow.csv');
