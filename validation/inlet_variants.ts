/**
 * Forced-airflow inlet variants on the cases the density-matched inlet changed most.
 *
 * Switching the inlet from ρ = 1 equilibrium to density-matched (2026-11-07) made the
 * rosette at 11.6 cm/s (U = 0.07) diverge and raised the canopy's u_max at 6.6 cm/s
 * (U = 0.04) past Mach 0.3. This checks whether either is an artefact of that particular
 * inlet, the collision scheme or the impulsive start:
 *
 *   eq      equilibrium inlet at ρ = 1 (the original; leaks)
 *   dm      equilibrium inlet at the adjacent interior density (the current default)
 *   zh      Zou–He velocity inlet (u = U exactly; ρ from the known populations)
 *   *_mrt   the same with MRT collision (Lallemand & Luo 2000) instead of BGK
 *   ramp    start from rest and raise the inlet speed linearly over `ramp` steps
 *           (default start: the whole domain at U, as in every published run)
 *
 * Flow only (the scenes are at 0 g, where the species exert no force). Divergence is
 * detected every 1 000 steps.
 *
 *   npx esbuild validation/inlet_variants.ts --bundle --format=esm --platform=node \
 *     --loader:.json=json --outfile=validation/inlet_variants.mjs
 *   node validation/inlet_variants.mjs list | xargs -P 16 -I{} node validation/inlet_variants.mjs job {}
 *   node validation/inlet_variants.mjs merge          # -> results/tables/inlet_variants.csv
 */
import { writeFileSync } from 'node:fs';
import { makeLeafScene, rosetteGeometry, canopyGeometry } from '../src/scenarios/scenarios';
import { LBMFluid } from '../src/solver/lbm/LBMFluid';
import { feq } from '../src/solver/lbm/d2q9';
import { cli, DEFAULT_STEPS } from './jobs';

type Variant = 'eq' | 'dm' | 'zh' | 'dm_mrt' | 'zh_mrt';
type Job = { id: string; scale: 'rosette' | 'canopy'; U: number; variant: Variant; ramp: number };
const job = (scale: Job['scale'], U: number, variant: Variant, ramp = 0): Job => ({
  id: `${scale}_U${U}_${variant}${ramp ? `_ramp${ramp / 1000}k` : ''}`,
  scale,
  U,
  variant,
  ramp,
});
const JOBS: Job[] = [
  ...(['eq', 'dm', 'zh', 'dm_mrt', 'zh_mrt'] as Variant[]).map((v) => job('rosette', 0.07, v)),
  job('rosette', 0.07, 'dm', 20000),
  job('rosette', 0.07, 'dm', 50000),
  job('rosette', 0.07, 'dm_mrt', 20000),
  job('rosette', 0.04, 'dm'),
  job('rosette', 0.04, 'dm', 20000),
  ...(['eq', 'dm', 'zh', 'dm_mrt'] as Variant[]).map((v) => job('canopy', 0.04, v)),
  job('canopy', 0.04, 'dm', 20000),
];

const GEOM = { rosette: [rosetteGeometry, 1], canopy: [canopyGeometry, 0.3] } as const;
const CS = Math.sqrt(1 / 3);
const STEPS = DEFAULT_STEPS;

cli(
  'inlet_variants',
  JOBS,
  (j) => {
    if (j.variant.endsWith('_mrt')) LBMFluid.defaultCollision = 'mrt';
    const inst = makeLeafScene({
      nx: 128, ny: 96, renderScale: 0.2, id: 'x', label: 'x', gRatio: 0,
      geometry: GEOM[j.scale][0], sourceScale: GEOM[j.scale][1], forcedU: j.U,
      inletBC: j.variant === 'eq' ? 'equilibrium' : 'densityMatched',
    })();
    const fl = inst.fluid;
    const { nx, ny } = fl;
    const zh = j.variant.startsWith('zh');
    if (j.ramp > 0) fl.setEquilibrium(1, 0, 0);
    let step = 0;
    const save = new Float64Array(ny * 9);
    const sceneBC = inst.postStream.bind(inst);
    const bc = () => {
      if (zh) for (let y = 0; y < ny; y++) for (let i = 0; i < 9; i++) save[y * 9 + i] = fl.f[y * nx * 9 + i];
      sceneBC(); // outlet (and the eq/dm inlet, overwritten below for zh or a ramp)
      const Ue = j.U * (j.ramp > 0 ? Math.min(1, step / j.ramp) : 1);
      for (let y = 1; y < ny - 1; y++) {
        const b = y * nx * 9;
        if (zh) {
          // Zou–He, west face, u = (Ue, 0): known f0, f2, f4 and f3, f6, f7 (streamed from x = 1).
          const s = (i: number) => save[y * 9 + i];
          const rho = (s(0) + s(2) + s(4) + 2 * (s(3) + s(6) + s(7))) / (1 - Ue);
          for (const i of [0, 2, 3, 4, 6, 7]) fl.f[b + i] = s(i);
          fl.f[b + 1] = s(3) + (2 / 3) * rho * Ue;
          fl.f[b + 5] = s(7) - 0.5 * (s(2) - s(4)) + (1 / 6) * rho * Ue;
          fl.f[b + 8] = s(6) + 0.5 * (s(2) - s(4)) + (1 / 6) * rho * Ue;
        } else if (j.ramp > 0) {
          let r = 1;
          if (j.variant !== 'eq') {
            r = 0;
            for (let i = 0; i < 9; i++) r += fl.f[(1 + y * nx) * 9 + i];
          }
          for (let i = 0; i < 9; i++) fl.f[b + i] = feq(i, r, Ue, 0);
        }
      }
    };
    const sample = () => {
      fl.computeMacroscopic();
      let umax = 0;
      let q = 0;
      let open = 0;
      for (let c = 0; c < fl.size; c++) {
        if (fl.solid[c]) continue;
        const v = Math.hypot(fl.ux[c], fl.uy[c]);
        if (!Number.isFinite(v)) return null;
        if (v > umax) umax = v;
      }
      for (let y = 1; y < ny - 1; y++) {
        if (!fl.solid[y * nx] && !fl.solid[1 + y * nx]) open++;
        const c = nx - 1 + y * nx;
        if (!fl.solid[c]) q += fl.rho[c] * fl.ux[c];
      }
      return { umax, tp: q / (j.U * open) };
    };
    let diverged: number | null = null;
    let peakMa = 0;
    let end: { umax: number; tp: number } | null = null;
    for (step = 1; step <= STEPS; step++) {
      fl.collideAndStream();
      bc();
      if (step % 1000 === 0) {
        const s = sample();
        if (!s) {
          diverged = step;
          break;
        }
        peakMa = Math.max(peakMa, s.umax / CS);
        end = s;
      }
    }
    return { diverged, peakMa, endMa: diverged ? null : end!.umax / CS, endTp: diverged ? null : end!.tp };
  },
  (res) => {
    const rows = ['scale,fan_U,fan_cm_s,inlet,collision,start,outcome,diverged_by_step,peak_Ma_before_end,end_Ma,end_throughput_over_set'];
    for (const j of JOBS) {
      const r = res.get(j.id) as { diverged: number | null; peakMa: number; endMa: number | null; endTp: number | null };
      const f = (x: number | null, d: number) => (x === null ? '' : x.toFixed(d));
      rows.push([
        j.scale, j.U, (j.U * 166).toFixed(1),
        j.variant.replace('_mrt', '') === 'eq' ? 'equilibrium rho=1' : j.variant.startsWith('zh') ? 'Zou-He' : 'density-matched',
        j.variant.endsWith('_mrt') ? 'MRT' : 'BGK',
        j.ramp ? `rest then ramp over ${j.ramp} steps` : 'impulsive (domain at U)',
        r.diverged ? 'diverged' : 'ran',
        r.diverged ?? '',
        r.peakMa.toFixed(3),
        f(r.endMa, 3),
        f(r.endTp, 4),
      ].join(','));
    }
    rows.push(`# ${STEPS} steps, flow only (0 g); sampled every 1000 steps; written by validation/inlet_variants.ts`);
    writeFileSync('results/tables/inlet_variants.csv', rows.join('\n') + '\n');
    console.log(rows.join('\n'));
  },
);
