// Export CFD sweep table + concentration-field grids for the results package.
import { writeFileSync } from 'node:fs';
import { SCENARIOS } from '../src/scenarios/scenarios';

const STEPS = 30000;
const SUMMARY: string[] = [];
SUMMARY.push('scenario,gravity_g,u_max,Ra_H2O,dC_H2O_mean,dC_H2O_peak,dC_CO2_mean,dC_CO2_peak,dC_O2_mean,dC_O2_peak');

// Boundary-layer conductance export (the handoff to the photorespiration model).
// g_bl / δ / Sh are computed by the scenario diagnostics; O2 excess in ppm reuses
// the T5 concentration calibration (≈23.6 ppm per model unit). Consumed by
// Photorespiration_multiomics_microgravity/fvcb.py.
const BL: string[] = [];
BL.push('scenario,scale,gravity_g,g_bl_mol_m2_s,delta_mm,Sherwood,dC_CO2_mean,o2_excess_ppm');
const PPM_PER_UNIT = 23.6; // model concentration unit → ppm (T5 calibration)
const scaleOf = (id: string) => (id.startsWith('canopy') ? 'canopy' : id.startsWith('rosette') ? 'rosette' : 'leaf');

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

  // Boundary-layer row: g_bl / δ / Sh straight from the diagnostics; O2 excess → ppm.
  const gbl = num(val(d, 'g_bl'));
  const delta = num(val(d, 'δ film'));
  const sh = num(val(d, 'Sherwood'));
  const o2ppm = (Math.abs(om) * PPM_PER_UNIT).toFixed(1);
  BL.push([id, scaleOf(id), g, gbl.toFixed(3), delta.toFixed(2), sh.toFixed(1), cm, o2ppm].join(','));
  console.log(`${id} done  u_max=${umax}  g_bl=${gbl.toFixed(3)}`);

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

writeFileSync('results/tables/T13_boundary_layer.csv', BL.join('\n') + '\n');
console.log('wrote T13_boundary_layer.csv');
