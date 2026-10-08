/**
 * Why does the 1 g leaf conductance rise during sealed-BRIC depletion? (T21)
 *
 * In T20 the sealed BRIC dish at 1 g shows g_bl (to the dish air) rising from 0.33 to
 * ≈ 0.40 between 0.5 and 1 min, then holding while photosynthesis fades. Two candidate
 * explanations:
 *   (a) transpiration: H₂O release is CO₂-independent, so H₂O-driven buoyancy keeps the
 *       dish stirred while CO₂ uptake (and its buoyancy) fades;
 *   (b) onset: a convection cell simply takes ~1 min to establish in the shallow dish,
 *       regardless of feedback.
 * Three runs separate them, all sealed BRIC (mid dish) at 1 g with buoyancy measured
 * from the dish mean:
 *   noH2O     feedback on, buoyancy from CO₂ + O₂ only  -> (a) predicts no rise
 *   H2Oonly   feedback on, buoyancy from H₂O only       -> (a) predicts the high value
 *   constflux no feedback (fixed uptake), all species, 120 s -> (b) predicts the same rise
 * The T20 all-species feedback run is the reference (BRIC_sealed_fb_g1).
 *
 *   npx esbuild validation/dish_buoyancy_diag.ts --bundle --format=esm --platform=node \
 *     --loader:.json=json --outfile=validation/dish_buoyancy_diag.mjs
 *   node validation/dish_buoyancy_diag.mjs list | xargs -P 3 -I{} node validation/dish_buoyancy_diag.mjs job {}
 *   node validation/dish_buoyancy_diag.mjs merge     # -> results/tables/T21_dish_buoyancy_diag.csv
 */
import { writeFileSync } from 'node:fs';
import { dishLeafGeometry, makeLeafScene } from '../src/scenarios/scenarios';
import { cli, num } from './jobs';
import { cells, dishGeom, DISHES, GAP_MM } from './dishes';

const DT_S = 0.173e-3;
const CA = 8;
const SAMPLE = 2890; // ≈ 0.5 s
const SCALE = Number(process.env.DISH_DIAG_SCALE ?? 1); // < 1 only for smoke tests

type Sp = 'h2o' | 'co2' | 'o2';
type Job = { id: string; species: Sp[]; feedback: boolean; steps: number };
const JOBS: Job[] = [
  { id: 'noH2O', species: ['co2', 'o2'], feedback: true, steps: 1_450_000 },
  { id: 'H2Oonly', species: ['h2o'], feedback: true, steps: 1_450_000 },
  { id: 'constflux', species: ['h2o', 'co2', 'o2'], feedback: false, steps: 700_000 },
];

const fx = (v: number | null, dp: number) => (v === null || !Number.isFinite(v) ? 'NaN' : v.toFixed(dp));

cli(
  'dish_buoyancy_diag',
  JOBS,
  (j) => {
    const geo = dishGeom(DISHES['BRIC-mid']);
    const inst = makeLeafScene({
      id: j.id, label: j.id, gRatio: 1, nx: geo.nx, ny: geo.ny, renderScale: 0.12,
      geometry: dishLeafGeometry({ agarCells: geo.agarCells, gapCells: cells(GAP_MM) }),
      membraneK: 0,
      co2Ambient: j.feedback ? CA : undefined,
      buoyancyRef: 'enclosureMean',
      buoyancySpecies: j.species,
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
        series.push([s * DT_S, num(d, 'dish-mean'), j.feedback ? num(d, 'net assimilation') : NaN,
          num(d, 'g_bl vs enclosure bulk'), num(d, 'u_max')]);
      }
    }
    return { ...j, series };
  },
  (res) => {
    const rows = ['run,buoyancy_species,feedback,t_s,dish_mean_CO2,net_assimilation_pct,g_bl_vs_dish_air,u_max_lattice'];
    for (const j of JOBS) {
      const s = (res.get(j.id) as { series: number[][] }).series;
      for (const r of s) rows.push([j.id, j.species.join('+'), j.feedback, fx(r[0], 2), fx(r[1], 4), fx(r[2], 1), fx(r[3], 3), fx(r[4], 5)].join(','));
    }
    writeFileSync('results/tables/T21_dish_buoyancy_diag.csv', rows.join('\n') + '\n');
    console.log('wrote T21_dish_buoyancy_diag.csv');
  },
);
