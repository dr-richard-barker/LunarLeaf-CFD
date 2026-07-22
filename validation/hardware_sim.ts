// Spaceflight-hardware comparison: BRIC (sealed) vs CARA (micropore tape) vs
// VEGGIE (vented), all in microgravity. Logs the whole-enclosure mean CO2 excess
// (does it drift or settle?) and the leaf-surface gap over time.
import { writeFileSync } from 'node:fs';
import { SCENARIOS } from '../src/scenarios/scenarios';

const CASES = [
  ['hw-bric-light', 'BRIC light'],
  ['hw-bric-dark', 'BRIC dark'],
  ['hw-cara', 'CARA tape'],
  ['hw-veggie', 'VEGGIE vented'],
  ['leaf-ug', 'open (ref)'],
];
const STEPS = 40000;
const EVERY = 1000;
const rows = ['case,step,dishmean_co2,surf_co2_mean'];
const summary: Record<string, { dish: number; surf: number }> = {};

for (const [id, name] of CASES) {
  const inst = SCENARIOS.find((s) => s.id === id)!.build();
  const f = inst.fluid;
  const dishOf = (d: { label: string; value: string }[]) =>
    parseFloat((d.find((r) => r.label.startsWith('dish-mean')) ?? { value: 'NaN' }).value);
  const surfOf = (d: { label: string; value: string }[]) =>
    parseFloat(d.find((r) => r.label.startsWith('ΔC CO₂'))!.value.split('/')[0]);
  for (let s = 0; s <= STEPS; s++) {
    if (s % EVERY === 0) {
      const d = inst.diagnostics(s);
      rows.push(`${name},${s},${dishOf(d).toFixed(4)},${surfOf(d).toFixed(4)}`);
    }
    f.collideAndStream();
    inst.postStream();
    inst.onAfterStep(s);
  }
  const d = inst.diagnostics(STEPS);
  const dish = parseFloat((d.find((r) => r.label.startsWith('dish-mean')) ?? { value: 'NaN' }).value);
  const surf = parseFloat(d.find((r) => r.label.startsWith('ΔC CO₂'))!.value.split('/')[0]);
  summary[name] = { dish, surf };
  console.log(`${name.padEnd(14)} dish-mean CO2=${dish.toFixed(3)}  surf ΔC CO2=${surf.toFixed(3)}`);
}
writeFileSync('results/tables/T7_hardware_timeseries.csv', rows.join('\n') + '\n');
console.log('wrote T7_hardware_timeseries.csv');
