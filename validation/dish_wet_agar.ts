/**
 * Wet agar in the BRIC and CARA dishes (T23).
 *
 * T19–T22 treated the agar as inert (zero-flux for every species). Real agar is mostly
 * water, so its surface holds the air above it near saturation. Here the agar surface
 * is a fixed-humidity boundary at the saturation excess (dishLeafGeometry agarH2O),
 * with transpiration humidity-limited at the same level (h2oSatExcess), CO₂-limited
 * photosynthesis (co2Ambient = 8) and buoyancy measured from the dish mean, as in the
 * humidity-capped T20.
 *
 * Expectations:
 * - sealed BRIC: the agar humidifies the whole dish, so transpiration is suppressed from
 *   the start and there is little buoyant forcing at 1 g;
 * - taped CARA: humid air sits on the wet agar under a lid that vents toward ambient
 *   (lighter air below heavier: unstable), which may drive convection at 1 g.
 * Compare with the dry-agar runs in T20 (same settings without agarH2O).
 *
 * The saturation level (1.3 model units) is estimated, not calibrated (see T22).
 *
 * RESULT (2026-10-09), a negative one at 1 g:
 *   - 0 g: wet agar changes nothing. Leaf conductance to the dish air is 0.186–0.189 in
 *     BRIC and 0.192 in CARA, identical to dry agar (T20); the BRIC dish saturates within
 *     26 s and transpiration stops.
 *   - 1 g: both runs are numerically unusable. Sealed BRIC stayed calm until ~87 s (u_max
 *     0.009–0.011 after start-up), then the flow accelerated to 0.34 at 120 s and the run
 *     diverged (NaN from 129.5 s; those rows are NaN). Taped CARA held strong agar-driven
 *     convection (u_max ≈ 0.098, Mach ≈ 0.17) from 5 to ~82 s, then accelerated to 0.34 by 104 s.
 *     Likely cause: the fixed-saturation agar puts the H₂O buoyancy at β·ΔC ≈ 1.3, beyond
 *     the model's small-perturbation range (≲ 0.5). CARA's 0.286 during its steady phase
 *     is not reported as a result.
 *   - Representing wet agar at 1 g needs a calibrated humidity buoyancy coefficient (real
 *     RH values), weaker forcing at a finer lattice, or a more stable collision scheme.
 *
 *   npx esbuild validation/dish_wet_agar.ts --bundle --format=esm --platform=node \
 *     --loader:.json=json --outfile=validation/dish_wet_agar.mjs
 *   node validation/dish_wet_agar.mjs list | xargs -P 4 -I{} node validation/dish_wet_agar.mjs job {}
 *   node validation/dish_wet_agar.mjs merge      # -> results/tables/T23_dish_wet_agar.csv
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
  { id: 'BRIC_wet_g1', dish: 'BRIC-mid', bc: 'sealed', g: 1, steps: 2_400_000 },
  { id: 'BRIC_wet_g0', dish: 'BRIC-mid', bc: 'sealed', g: 0, steps: 2_400_000 },
  { id: 'CARA_wet_g1', dish: 'CARA-mid', bc: 'taped', g: 1, steps: 600_000 },
  { id: 'CARA_wet_g0', dish: 'CARA-mid', bc: 'taped', g: 0, steps: 600_000 },
];

const fx = (v: number | null, dp: number) => (v === null || !Number.isFinite(v) ? 'NaN' : v.toFixed(dp));

cli(
  'dish_wet_agar',
  JOBS,
  (j) => {
    const geo = dishGeom(DISHES[j.dish]);
    const inst = makeLeafScene({
      id: j.id, label: j.id, gRatio: j.g, nx: geo.nx, ny: geo.ny, renderScale: 0.12,
      geometry: dishLeafGeometry({ agarCells: geo.agarCells, gapCells: cells(GAP_MM), agarH2O: SAT }),
      membraneK: j.bc === 'sealed' ? 0 : 0.01,
      co2Ambient: CA, buoyancyRef: 'enclosureMean', h2oSatExcess: SAT,
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
    writeFileSync('results/tables/T23_dish_wet_agar.csv', rows.join('\n') + '\n');
    console.log('wrote T23_dish_wet_agar.csv');
  },
);
