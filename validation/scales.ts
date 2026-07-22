// Extend the membrane (BRIC/CARA) and fan (VEGGIE) analysis to all three scales.
// For leaf / rosette / canopy: Earth & µg references, a forced-airflow sweep (find
// the Earth-equivalent ventilation speed), and the three enclosures (sealed / tape /
// vented). Writes T9 (fan by scale) and T10 (hardware by scale).
import { writeFileSync } from 'node:fs';
import {
  makeLeafScene,
  leafGeometry,
  rosetteGeometry,
  canopyGeometry,
} from '../src/scenarios/scenarios';

const U_STAR = 166; // cm/s per lattice velocity unit (results/tables/T3)
const STEPS = 22000;
const DOM = { nx: 128, ny: 96, renderScale: 0.2 };

const SCALES = [
  { key: 'leaf', geometry: leafGeometry, sourceScale: 1 },
  { key: 'rosette', geometry: rosetteGeometry, sourceScale: 1 },
  { key: 'canopy', geometry: canopyGeometry, sourceScale: 0.3 },
];

function run(scale: (typeof SCALES)[number], extra: Record<string, unknown>) {
  const inst = makeLeafScene({
    ...DOM,
    id: 'x',
    label: 'x',
    geometry: scale.geometry,
    sourceScale: scale.sourceScale,
    gRatio: 0,
    ...extra,
  })();
  const f = inst.fluid;
  for (let s = 0; s < STEPS; s++) {
    f.collideAndStream();
    inst.postStream();
    inst.onAfterStep(s);
  }
  const d = inst.diagnostics(STEPS);
  const pairAbs = (k: string) => Math.abs(parseFloat(d.find((r) => r.label.startsWith(k))!.value.split('/')[0]));
  const num = (k: string) => {
    const r = d.find((x) => x.label.startsWith(k));
    return r ? parseFloat(r.value) : NaN;
  };
  return { w: pairAbs('ΔC H₂O'), c: pairAbs('ΔC CO₂'), umax: num('u_max'), dish: num('dish-mean') };
}

const FAN = [0.01, 0.02, 0.04, 0.07, 0.11, 0.16, 0.22];
const t9 = ['scale,case,fan_cm_s,dC_H2O,dC_CO2'];
const t10 = ['scale,hardware,surf_dC_H2O,surf_dC_CO2,dishmean_CO2'];
const crossings: Record<string, number> = {};

for (const scale of SCALES) {
  const earth = run(scale, { gRatio: 1 });
  const ug = run(scale, { gRatio: 0 });
  t9.push(`${scale.key},earth,,${earth.w.toFixed(4)},${earth.c.toFixed(4)}`);
  t9.push(`${scale.key},ug_still,0,${ug.w.toFixed(4)},${ug.c.toFixed(4)}`);
  console.log(`[${scale.key}] Earth ΔC_H2O=${earth.w.toFixed(3)}  µg-still=${ug.w.toFixed(3)}`);

  const series: { U: number; w: number }[] = [];
  for (const U of FAN) {
    const r = run(scale, { forcedU: U });
    series.push({ U, w: r.w });
    t9.push(`${scale.key},ug_fan,${(U * U_STAR).toFixed(1)},${r.w.toFixed(4)},${r.c.toFixed(4)}`);
    console.log(`[${scale.key}] fan ${(U * U_STAR).toFixed(1)} cm/s  ΔC_H2O=${r.w.toFixed(3)}`);
  }
  // Earth-equivalent crossing (surface gap back to Earth-1g level)
  let nullU = NaN;
  for (let i = 1; i < series.length; i++) {
    if ((series[i - 1].w - earth.w) * (series[i].w - earth.w) <= 0) {
      const a = series[i - 1];
      const b = series[i];
      nullU = a.U + ((earth.w - a.w) / (b.w - a.w)) * (b.U - a.U);
      break;
    }
  }
  crossings[scale.key] = nullU * U_STAR;

  // Hardware: BRIC (sealed) / CARA (tape) / VEGGIE (vented @ ~8 cm/s)
  const bric = run(scale, { membraneK: 0 });
  const cara = run(scale, { membraneK: 0.01 });
  const veg = run(scale, { forcedU: 0.05 });
  t10.push(`${scale.key},BRIC,${bric.w.toFixed(4)},${bric.c.toFixed(4)},${bric.dish.toFixed(4)}`);
  t10.push(`${scale.key},CARA,${cara.w.toFixed(4)},${cara.c.toFixed(4)},${cara.dish.toFixed(4)}`);
  t10.push(`${scale.key},VEGGIE,${veg.w.toFixed(4)},${veg.c.toFixed(4)},NaN`);
  console.log(`[${scale.key}] BRIC=${bric.w.toFixed(3)} CARA=${cara.w.toFixed(3)} VEGGIE=${veg.w.toFixed(3)}  Earth-equiv fan=${crossings[scale.key].toFixed(1)} cm/s`);
}

t9.push('# Earth-equivalent fan speed (cm/s): ' + Object.entries(crossings).map(([k, v]) => `${k}=${v.toFixed(1)}`).join('  '));
writeFileSync('results/tables/T9_fan_by_scale.csv', t9.join('\n') + '\n');
writeFileSync('results/tables/T10_hardware_by_scale.csv', t10.join('\n') + '\n');
console.log('\nEarth-equivalent ventilation by scale (cm/s):', crossings);
console.log('wrote T9_fan_by_scale.csv, T10_hardware_by_scale.csv');
