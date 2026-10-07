// Export CFD sweep table + concentration-field grids for the results package.
//
// Runs each scenario to steady state (150 k steps ≈ 26 s; see validation/jobs.ts) —
// the original 30 k-step snapshot caught the 0 g scenes mid-relaxation and overstated
// their g_bl (leaf +11 %, rosette +7 %; results/tables/T15_stationarity.csv).
// T13 carries a drift column: the % change of g_bl over the last ~5 s of the run.
//
//   npx esbuild validation/export_cfd.ts --bundle --format=esm --platform=node \
//     --loader:.json=json --outfile=validation/export_cfd.mjs
//   node validation/export_cfd.mjs list | xargs -P 8 -I{} node validation/export_cfd.mjs job {}
//   node validation/export_cfd.mjs merge
import { writeFileSync } from 'node:fs';
import { SCENARIOS } from '../src/scenarios/scenarios';
import { cli, DEFAULT_STEPS, driftPct, num, pair, runScene, warnDrift } from './jobs';

// Boundary-layer conductance export (the handoff to the photorespiration model).
// g_bl / δ / Sh are computed by the scenario diagnostics; O2 excess in ppm reuses
// the T5 concentration calibration (≈23.6 ppm per model unit). Consumed by
// Photorespiration_multiomics_microgravity/fvcb.py.
const PPM_PER_UNIT = 23.6; // model concentration unit → ppm (T5 calibration)
const scaleOf = (id: string) => (id.startsWith('canopy') ? 'canopy' : id.startsWith('rosette') ? 'rosette' : 'leaf');

const exportField = ['leaf-earth', 'leaf-ug', 'canopy-ug'];
// The 0 g canopy has no nearby ambient walls and relaxes by diffusion across the whole
// domain; at 150 k steps it was still moving 3.2 % per 5 s, so it gets a longer run.
const STEPS_BY_ID: Record<string, number> = { 'canopy-ug': 900000 };
const DRIFT_WINDOW = 30000; // last ~5.2 s

const IDS = ['leaf-earth', 'leaf-mars', 'leaf-moon', 'leaf-ug', 'rosette-earth', 'rosette-ug', 'canopy-earth', 'canopy-ug'];

cli(
  'export_cfd',
  IDS.map((id) => ({ id })),
  ({ id }) => {
    const inst = SCENARIOS.find((s) => s.id === id)!.build();
    const steps = STEPS_BY_ID[id] ?? DEFAULT_STEPS;
    const r = runScene(inst, steps, steps - DRIFT_WINDOW);
    const d = r.end.readouts;
    const g = num(d, 'gravity');
    const umax = num(d, 'u_max');
    const ra = num(d, 'Rayleigh');
    const [wm, wp] = pair(d, 'ΔC H₂O');
    const [cm, cp] = pair(d, 'ΔC CO₂');
    const [om, op] = pair(d, 'ΔC O₂');
    const t2 = [id, g, umax, ra, wm, wp, cm, cp, om, op].join(',');

    // Boundary-layer row: g_bl / δ / Sh straight from the diagnostics; O2 excess → ppm.
    const gbl = num(d, 'g_bl');
    const drift = driftPct(r, (rows) => num(rows, 'g_bl'));
    const t13 = [id, scaleOf(id), g, gbl.toFixed(3), num(d, 'δ film').toFixed(2), num(d, 'Sherwood').toFixed(1), cm,
      (Math.abs(om) * PPM_PER_UNIT).toFixed(1), drift.toFixed(2)].join(',');

    if (exportField.includes(id) && inst.scalarField) {
      const f = inst.fluid;
      const C = inst.scalarField.C;
      const lines: string[] = [];
      for (let y = f.ny - 1; y >= 0; y--) {
        const row: string[] = [];
        for (let x = 0; x < f.nx; x++) {
          const c = f.index(x, y);
          row.push(f.solid[c] ? 'NaN' : C[c].toFixed(5));
        }
        lines.push(row.join(','));
      }
      writeFileSync(`results/fields/${id}_h2o.csv`, lines.join('\n'));
    }
    return { t2, t13, gbl, drift, steps };
  },
  (res) => {
    const T2 = ['scenario,gravity_g,u_max,Ra_H2O,dC_H2O_mean,dC_H2O_peak,dC_CO2_mean,dC_CO2_peak,dC_O2_mean,dC_O2_peak'];
    const T13 = ['scenario,scale,gravity_g,g_bl_mol_m2_s,delta_mm,Sherwood,dC_CO2_mean,o2_excess_ppm,gbl_drift_pct_last_5s'];
    for (const id of IDS) {
      const r = res.get(id)!;
      T2.push(r.t2 as string);
      T13.push(r.t13 as string);
      warnDrift(`T13 ${id} g_bl`, r.drift as number);
      console.log(`${id}  g_bl=${(r.gbl as number).toFixed(3)}  drift=${(r.drift as number).toFixed(2)} %  (${r.steps ?? DEFAULT_STEPS} steps)`);
    }
    writeFileSync('results/tables/T2_model_sweep.csv', T2.join('\n') + '\n');
    writeFileSync('results/tables/T13_boundary_layer.csv', T13.join('\n') + '\n');
    console.log(`wrote T2_model_sweep.csv, T13_boundary_layer.csv (${DEFAULT_STEPS} steps; canopy-ug ${STEPS_BY_ID['canopy-ug']})`);
  },
);

