/**
 * Wet agar with MRT collision (T24): does a more stable collision scheme rescue the
 * 1 g runs that diverged with BGK in T23?
 *
 * Same four cases and settings as validation/dish_wet_agar.ts (fixed-saturation agar,
 * humidity-limited transpiration, CO₂-limited photosynthesis, buoyancy from the dish
 * mean), with collision: 'mrt' (Lallemand & Luo 2000; LBMFluid). The 0 g runs check
 * that MRT changes nothing where BGK was already stable.
 *
 * Caveat that MRT cannot remove: with the agar held at saturation the H₂O buoyancy is
 * β·ΔC ≈ 1.3, beyond the Boussinesq small-perturbation range (≲ 0.5). A run that stays
 * finite is numerically stable, not physically validated.
 *
 * RESULT (2026-10-12), negative: MRT does not rescue the 1 g runs; they break down
 * sooner than with BGK. 0 g is unchanged (BRIC 0.186–0.189, CARA 0.192). Sealed BRIC
 * exceeds Mach 0.3 (u_max > 0.17) at 72 s and diverges at 82.5 s (BGK: 109 s, 129.5 s);
 * taped CARA exceeds Mach 0.3 at 64 s and diverges at 78 s (BGK: 86 s, finite to 104 s).
 * The flow genuinely accelerates under the β·ΔC ≈ 1.3 humidity forcing until the lattice
 * speed leaves its valid range; the collision scheme is not the limiting factor.
 *
 *   npx esbuild validation/dish_wet_agar_mrt.ts --bundle --format=esm --platform=node \
 *     --loader:.json=json --outfile=validation/dish_wet_agar_mrt.mjs
 *   node validation/dish_wet_agar_mrt.mjs list | xargs -P 4 -I{} node validation/dish_wet_agar_mrt.mjs job {}
 *   node validation/dish_wet_agar_mrt.mjs merge      # -> results/tables/T24_dish_wet_agar_mrt.csv
 */
import { writeFileSync } from 'node:fs';
import { dishLeafGeometry, makeLeafScene } from '../src/scenarios/scenarios';
import { cli, num } from './jobs';
import { cells, dishGeom, DISHES, GAP_MM } from './dishes';

const DT_S = 0.173e-3;
const CA = 8;
const SAT = 1.3;
const SAMPLE = 2890; // ≈ 0.5 s
const SCALE = Number(process.env.DISH_WET_SCALE ?? 1); // < 1 only for smoke tests

type Job = { id: string; dish: 'BRIC-mid' | 'CARA-mid'; bc: 'sealed' | 'taped'; g: 0 | 1; steps: number };
const JOBS: Job[] = [
  { id: 'BRIC_wet_mrt_g1', dish: 'BRIC-mid', bc: 'sealed', g: 1, steps: 2_400_000 },
  { id: 'BRIC_wet_mrt_g0', dish: 'BRIC-mid', bc: 'sealed', g: 0, steps: 2_400_000 },
  { id: 'CARA_wet_mrt_g1', dish: 'CARA-mid', bc: 'taped', g: 1, steps: 600_000 },
  { id: 'CARA_wet_mrt_g0', dish: 'CARA-mid', bc: 'taped', g: 0, steps: 600_000 },
];

const fx = (v: number | null, dp: number) => (v === null || !Number.isFinite(v) ? 'NaN' : v.toFixed(dp));

cli(
  'dish_wet_agar_mrt',
  JOBS,
  (j) => {
    const geo = dishGeom(DISHES[j.dish]);
    const inst = makeLeafScene({
      id: j.id, label: j.id, gRatio: j.g, nx: geo.nx, ny: geo.ny, renderScale: 0.12,
      geometry: dishLeafGeometry({ agarCells: geo.agarCells, gapCells: cells(GAP_MM), agarH2O: SAT }),
      membraneK: j.bc === 'sealed' ? 0 : 0.01,
      co2Ambient: CA, buoyancyRef: 'enclosureMean', h2oSatExcess: SAT,
      collision: 'mrt',
    })();
    const f = inst.fluid;
    const steps = Math.max(SAMPLE, Math.round(j.steps * SCALE));
    const series: number[][] = [];
    for (let s = 1; s <= steps; s++) {
      f.collideAndStream();
      inst.postStream();
      inst.onAfterStep(s);
      if (s % SAMPLE === 0 || s === steps) {
        const d = inst.diagnostics(s);
        series.push([s * DT_S, num(d, 'dish-mean CO₂'), num(d, 'net assimilation'), num(d, 'dish-mean H₂O'),
          num(d, 'transpiration'), num(d, 'g_bl vs enclosure bulk'), num(d, 'g_bl CO₂'), num(d, 'u_max')]);
      }
    }
    return { ...j, series };
  },
  (res) => {
    const rows = ['run,dish,boundary,gravity_g,t_s,dish_mean_CO2,net_assimilation_pct,dish_mean_H2O,transpiration_pct,g_bl_vs_dish_air,g_bl_vs_ambient,u_max_lattice'];
    for (const j of JOBS) {
      const s = (res.get(j.id) as { series: number[][] }).series;
      for (const r of s) rows.push([j.id, j.dish, j.bc, j.g, fx(r[0], 2), fx(r[1], 4), fx(r[2], 1), fx(r[3], 4), fx(r[4], 1), fx(r[5], 3), fx(r[6], 3), fx(r[7], 5)].join(','));
    }
    writeFileSync('results/tables/T24_dish_wet_agar_mrt.csv', rows.join('\n') + '\n');
    console.log('wrote T24_dish_wet_agar_mrt.csv');
  },
);
