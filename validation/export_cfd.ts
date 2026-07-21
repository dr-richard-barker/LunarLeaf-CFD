// Export CFD sweep table + concentration-field grids for the results package.
import { writeFileSync } from 'node:fs';
import { SCENARIOS } from '../src/scenarios/scenarios';

const STEPS = 30000;
const SUMMARY: string[] = [];
SUMMARY.push('scenario,gravity_g,u_max,Ra_H2O,dC_H2O_mean,dC_H2O_peak,dC_CO2_mean,dC_CO2_peak,dC_O2_mean,dC_O2_peak');

const val = (rows: { label: string; value: string }[], key: string) =>
  rows.find((r) => r.label.startsWith(key))?.value ?? '';
const num = (s: string) => parseFloat(s.replace(/[^0-9eE.+-].*$/, ''));
const pair = (s: string) => s.split('/').map((p) => parseFloat(p.trim()));

const exportField = ['leaf-earth', 'leaf-ug', 'canopy-ug'];

for (const id of ['leaf-earth', 'leaf-mars', 'leaf-moon', 'leaf-ug', 'rosette-earth', 'rosette-ug', 'canopy-earth', 'canopy-ug']) {
  const def = SCENARIOS.find((s) => s.id === id)!;
  const inst = def.build();
  const f = inst.fluid;
  for (let s = 0; s < STEPS; s++) {
    f.collideAndStream();
    inst.postStream();
    inst.onAfterStep(s);
  }
  const d = inst.diagnostics(STEPS);
  const g = num(val(d, 'gravity'));
  const umax = num(val(d, 'u_max'));
  const ra = num(val(d, 'Rayleigh'));
  const [wm, wp] = pair(val(d, 'ΔC H₂O'));
  const [cm, cp] = pair(val(d, 'ΔC CO₂'));
  const [om, op] = pair(val(d, 'ΔC O₂'));
  SUMMARY.push([id, g, umax, ra, wm, wp, cm, cp, om, op].join(','));
  console.log(`${id} done  u_max=${umax}  H2O=${wm}/${wp}`);

  if (exportField.includes(id) && inst.scalarField) {
    const { nx, ny } = f;
    const C = inst.scalarField.C;
    const lines: string[] = [];
    for (let y = ny - 1; y >= 0; y--) {
      const row: string[] = [];
      for (let x = 0; x < nx; x++) {
        const c = f.index(x, y);
        row.push(f.solid[c] ? 'NaN' : C[c].toFixed(5));
      }
      lines.push(row.join(','));
    }
    writeFileSync(`results/fields/${id}_h2o.csv`, lines.join('\n'));
    console.log(`  field ${id}_h2o.csv (${nx}x${ny})`);
  }
}

writeFileSync('results/tables/T2_model_sweep.csv', SUMMARY.join('\n') + '\n');
console.log('wrote T2_model_sweep.csv');
