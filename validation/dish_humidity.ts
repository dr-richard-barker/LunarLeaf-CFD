/**
 * Sealed BRIC dish with humidity-limited transpiration (T22).
 *
 * T21 found the sealed 1 g runs develop an accelerating flow after ~3.7 min (u_max →
 * 0.165, near the Mach limit). The suspected cause: transpiration is CO₂-independent
 * and constant, so the sealed dish accumulates humidity without bound. Here
 * transpiration is driven by the leaf-to-air humidity gap (h2oSatExcess), so it stops
 * as the dish saturates, as the closed-chamber measurement in T1 suggests
 * (0.005 mmol m⁻² s⁻¹ near saturation, vs ~1–2 open).
 *
 * The saturation excess in model H₂O units is NOT calibrated (TODO). It is estimated
 * from an open leaf at 25 °C and 40–70 % RH: transpiration 1–2 mmol m⁻² s⁻¹ raises the
 * surface humidity by ~1,000–2,000 ppm against a ~9,500–19,000 ppm saturation deficit,
 * so the open Earth-leaf surface excess (0.128 model units, T2) is ~5–20 % of the
 * deficit, giving a saturation excess of ≈ 1.3 units (range 0.65–2.6).
 *
 * Runs (sealed BRIC mid dish, CO₂-limited photosynthesis co2Ambient = 8, buoyancy from
 * the dish mean, 415 s): sat 1.3 at 1 g and 0 g; sat 0.65 and 2.6 at 1 g.
 *
 *   npx esbuild validation/dish_humidity.ts --bundle --format=esm --platform=node \
 *     --loader:.json=json --outfile=validation/dish_humidity.mjs
 *   node validation/dish_humidity.mjs list | xargs -P 4 -I{} node validation/dish_humidity.mjs job {}
 *   node validation/dish_humidity.mjs merge      # -> results/tables/T22_dish_humidity.csv
 */
import { writeFileSync } from 'node:fs';
import { dishLeafGeometry, makeLeafScene } from '../src/scenarios/scenarios';
import { cli, num } from './jobs';
import { cells, dishGeom, DISHES, GAP_MM } from './dishes';

const DT_S = 0.173e-3;
const CA = 8;
const SAMPLE = 2890; // ≈ 0.5 s
const SCALE = Number(process.env.DISH_HUM_SCALE ?? 1); // < 1 only for smoke tests

type Job = { id: string; g: 0 | 1; sat: number; steps: number };
const JOBS: Job[] = [
  { id: 'sat1.3_g1', g: 1, sat: 1.3, steps: 2_400_000 },
  { id: 'sat1.3_g0', g: 0, sat: 1.3, steps: 2_400_000 },
  { id: 'sat0.65_g1', g: 1, sat: 0.65, steps: 2_400_000 },
  { id: 'sat2.6_g1', g: 1, sat: 2.6, steps: 2_400_000 },
];

const fx = (v: number | null, dp: number) => (v === null || !Number.isFinite(v) ? 'NaN' : v.toFixed(dp));

cli(
  'dish_humidity',
  JOBS,
  (j) => {
    const geo = dishGeom(DISHES['BRIC-mid']);
    const inst = makeLeafScene({
      id: j.id, label: j.id, gRatio: j.g, nx: geo.nx, ny: geo.ny, renderScale: 0.12,
      geometry: dishLeafGeometry({ agarCells: geo.agarCells, gapCells: cells(GAP_MM) }),
      membraneK: 0, co2Ambient: CA, buoyancyRef: 'enclosureMean', h2oSatExcess: j.sat,
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
          num(d, 'transpiration'), num(d, 'g_bl vs enclosure bulk'), num(d, 'u_max')]);
      }
    }
    return { ...j, series };
  },
  (res) => {
    const rows = ['run,gravity_g,h2o_sat_excess,t_s,dish_mean_CO2,net_assimilation_pct,dish_mean_H2O,transpiration_pct,g_bl_vs_dish_air,u_max_lattice'];
    for (const j of JOBS) {
      const s = (res.get(j.id) as { series: number[][] }).series;
      for (const r of s) rows.push([j.id, j.g, j.sat, fx(r[0], 2), fx(r[1], 4), fx(r[2], 1), fx(r[3], 4), fx(r[4], 1), fx(r[5], 3), fx(r[6], 5)].join(','));
    }
    writeFileSync('results/tables/T22_dish_humidity.csv', rows.join('\n') + '\n');
    console.log('wrote T22_dish_humidity.csv');
  },
);
