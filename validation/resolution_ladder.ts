/**
 * Resolution ladder for the single-leaf scenes (grid-convergence study).
 *
 * Runs the leaf at r = 1, 1.5, 2 (dx = 0.288, 0.192, 0.144 mm) with identical physics
 * under diffusive scaling (dt ∝ dx², same relaxation time), for the same physical
 * time, and records g_bl / δ / ΔC_CO2 every SAMPLE_S seconds. analysis/gci.py turns
 * the three end-of-run window means into an observed order and a GCI.
 *
 * Mirrors the m0/m1/m2 mesh ladder in the microgreen-chamber-cfd project
 * (validation/mesh_independence.md, microgreen-chamber-cfd @ 6ac89c1).
 *
 *   npx esbuild validation/resolution_ladder.ts --bundle --format=esm --platform=node \
 *     --loader:.json=json --outfile=validation/resolution_ladder.mjs && \
 *   node validation/resolution_ladder.mjs <gRatio> <r> [t_end_s]
 *
 * Writes results/resolution/leaf_g<gRatio>_r<r>.csv
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { makeLeafScene, leafGeometryRefined, Readout } from '../src/scenarios/scenarios';

const DT_S = 0.173e-3; // s per step at r = 1 (T3 calibration)
const SAMPLE_S = 0.1;

const gRatio = Number(process.argv[2] ?? 1);
const r = Number(process.argv[3] ?? 1);
const T_END = Number(process.argv[4] ?? 26);

const dt = DT_S / (r * r);
const steps = Math.round(T_END / dt);
const sample = Math.max(1, Math.round(SAMPLE_S / dt));

const val = (rows: Readout[], key: string) => rows.find((x) => x.label.startsWith(key))?.value ?? '';
const num = (s: string) => (s ? parseFloat(s.replace(/[^0-9eE.+-].*$/, '')) : NaN);
const pair = (s: string) => s.split('/').map((p) => parseFloat(p.trim()));

const id = `leaf_g${gRatio}_r${r}`;
const inst = makeLeafScene({
  id,
  label: id,
  gRatio,
  nx: Math.round(128 * r),
  ny: Math.round(96 * r),
  renderScale: 0.12,
  geometry: leafGeometryRefined(r),
  refine: r,
})();
const f = inst.fluid;

const rows = ['step,t_s,g_bl_mol_m2_s,delta_mm,Sherwood,dC_CO2_mean,u_max_lattice'];
const t0 = Date.now();
for (let s = 1; s <= steps; s++) {
  f.collideAndStream();
  inst.postStream();
  inst.onAfterStep(s);
  if (s % sample === 0) {
    const d = inst.diagnostics(s);
    const [cm] = pair(val(d, 'ΔC CO₂'));
    rows.push([s, (s * dt).toFixed(3), num(val(d, 'g_bl')), num(val(d, 'δ film')), num(val(d, 'Sherwood')), cm, num(val(d, 'u_max'))].join(','));
  }
}
mkdirSync('results/resolution', { recursive: true });
writeFileSync(`results/resolution/${id}.csv`, rows.join('\n') + '\n');
console.log(`${id}: ${f.nx}x${f.ny}, ${steps} steps (${T_END} s) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
