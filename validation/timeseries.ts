/**
 * Time-series + field-frame export for the leaf-scale scenarios.
 *
 * export_cfd.ts reports each scenario as a single end-state snapshot at 30 k steps
 * (≈ 5.2 s). That is only safe if the run has become stationary by then. This
 * runner samples the same diagnostics (u_max, ΔC, g_bl, δ) every SAMPLE steps
 * over a longer record and dumps the H₂O field every FRAME steps, so that
 * analysis/transient_stats.py can test stationarity and attach an
 * autocorrelation-aware error bar, and analysis/animate_fields.py can render
 * pinned-colour-scale animations.
 *
 * The approach (sample long, discard a start-up window, average with an
 * N_eff-corrected standard error) follows the microgreen-chamber-cfd project
 * Phase 1 transient study (microgreen-chamber-cfd @ 6ac89c1).
 *
 *   npx esbuild validation/timeseries.ts --bundle --format=esm --platform=node \
 *     --loader:.json=json --outfile=validation/timeseries.mjs && \
 *   node validation/timeseries.mjs [steps] [sample] [frame] [id ...]
 *
 * Outputs (results/timeseries/):
 *   <id>.csv                 step, t_s, u_max, dC_*_mean, g_bl, delta_mm, Sh
 *   <id>_h2o_frames.f32      raw little-endian float32, frames × ny × nx (row 0 = top), NaN = solid
 *   <id>_h2o_frames.json     { nx, ny, steps: [...], dt_s }
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { SCENARIOS, Readout, makeLeafScene, leafGeometry } from '../src/scenarios/scenarios';

// Variants not in the UI preset list: the fan scenes with the corrected pressure outlet.
const EXTRA: Record<string, () => ReturnType<(typeof SCENARIOS)[number]['build']>> = {
  'leaf-ug-fan-lo-pressure': makeLeafScene({
    id: 'leaf-ug-fan-lo-pressure', label: 'Leaf — µg + fan ~3 cm/s (pressure outlet)', gRatio: 0,
    nx: 128, ny: 96, renderScale: 0.12, geometry: leafGeometry, forcedU: 0.02, outletBC: 'pressure',
  }),
  'leaf-ug-fan-mid-pressure': makeLeafScene({
    id: 'leaf-ug-fan-mid-pressure', label: 'Leaf — µg + fan ~8 cm/s (pressure outlet)', gRatio: 0,
    nx: 128, ny: 96, renderScale: 0.12, geometry: leafGeometry, forcedU: 0.05, outletBC: 'pressure',
  }),
};

const DT_S = 0.173e-3; // s per lattice step (T3 calibration)

const argv = process.argv.slice(2);
const STEPS = Number(argv[0] ?? 150000);
const SAMPLE = Number(argv[1] ?? 250);
const FRAME = Number(argv[2] ?? 2500);
const IDS = argv.length > 3 ? argv.slice(3) : ['leaf-earth', 'leaf-ug', 'rosette-earth', 'rosette-ug'];

const OUT = 'results/timeseries';
mkdirSync(OUT, { recursive: true });

const val = (rows: Readout[], key: string) => rows.find((r) => r.label.startsWith(key))?.value ?? '';
const num = (s: string) => parseFloat(s.replace(/[^0-9eE.+-].*$/, ''));
const pair = (s: string) => s.split('/').map((p) => parseFloat(p.trim()));

for (const id of IDS) {
  const build = EXTRA[id] ?? SCENARIOS.find((s) => s.id === id)?.build;
  if (!build) throw new Error(`unknown scenario ${id}`);
  const inst = build();
  const f = inst.fluid;
  const { nx, ny } = f;

  const rows: string[] = ['step,t_s,u_max,dC_H2O_mean,dC_CO2_mean,dC_O2_mean,g_bl_mol_m2_s,delta_mm,Sherwood'];
  const frameSteps: number[] = [];
  const frames: Float32Array[] = [];

  const snapFrame = (step: number) => {
    const C = inst.scalarField!.C;
    const out = new Float32Array(nx * ny);
    let k = 0;
    for (let y = ny - 1; y >= 0; y--) {
      for (let x = 0; x < nx; x++) {
        const c = f.index(x, y);
        out[k++] = f.solid[c] ? NaN : C[c];
      }
    }
    frames.push(out);
    frameSteps.push(step);
  };

  const t0 = Date.now();
  for (let s = 1; s <= STEPS; s++) {
    f.collideAndStream();
    inst.postStream();
    inst.onAfterStep(s);
    if (s % SAMPLE === 0) {
      const d = inst.diagnostics(s);
      const [wm] = pair(val(d, 'ΔC H₂O'));
      const [cm] = pair(val(d, 'ΔC CO₂'));
      const [om] = pair(val(d, 'ΔC O₂'));
      const gbl = val(d, 'g_bl') ? num(val(d, 'g_bl')) : NaN;
      const delta = val(d, 'δ film') ? num(val(d, 'δ film')) : NaN;
      const sh = val(d, 'Sherwood') ? num(val(d, 'Sherwood')) : NaN;
      rows.push([s, (s * DT_S).toFixed(4), num(val(d, 'u_max')), wm, cm, om, gbl, delta, sh].join(','));
    }
    if (inst.scalarField && s % FRAME === 0) snapFrame(s);
  }

  writeFileSync(`${OUT}/${id}.csv`, rows.join('\n') + '\n');
  if (frames.length) {
    const buf = new Float32Array(frames.length * nx * ny);
    frames.forEach((fr, i) => buf.set(fr, i * nx * ny));
    writeFileSync(`${OUT}/${id}_h2o_frames.f32`, Buffer.from(buf.buffer));
    writeFileSync(`${OUT}/${id}_h2o_frames.json`, JSON.stringify({ id, nx, ny, dt_s: DT_S, steps: frameSteps }));
  }
  console.log(`${id}: ${STEPS} steps in ${((Date.now() - t0) / 1000).toFixed(0)} s, ${rows.length - 1} samples, ${frames.length} frames`);
}
