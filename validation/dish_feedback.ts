/**
 * Sealed BRIC dish with CO₂-limited photosynthesis (T20): does the depletion self-limit,
 * how fast, and what does the boundary layer do meanwhile?
 *
 * T19's sealed BRIC runs used a fixed stomatal flux, so the dish CO₂ fell without bound
 * and the 1 g case left the Boussinesq range. Here:
 *   - co2Ambient = 8 (model units; the feedback presets' value): uptake follows a
 *     rectangular-hyperbola CO₂ response and stops at the compensation point (0.125 Ca);
 *   - buoyancyRef = 'enclosureMean': only deviations from the dish's own mean drive flow,
 *     the correct Boussinesq reference in a closed dish.
 * Each run records a time series every ~0.5 s: dish-mean CO₂ excess, net assimilation
 * (% of potential), and g_bl against the dish air and against cabin ambient.
 *
 * The analytic sealed-dish model (T8) says a lit 30 cm³ BRIC dish fixes its CO₂ in about
 * 7 min, and this run is long enough to compare against it.
 *
 *   npx esbuild validation/dish_feedback.ts --bundle --format=esm --platform=node \
 *     --loader:.json=json --outfile=validation/dish_feedback.mjs
 *   node validation/dish_feedback.mjs list | xargs -P 6 -I{} node validation/dish_feedback.mjs job {}
 *   node validation/dish_feedback.mjs merge     # -> results/tables/T20_dish_feedback.csv (+ summary)
 */
import { writeFileSync } from 'node:fs';
import { dishLeafGeometry, makeLeafScene, Readout } from '../src/scenarios/scenarios';
import { cli, num } from './jobs';
import { cells, dishGeom, DISHES, GAP_MM } from './dishes';

const DT_S = 0.173e-3;
const CA = 8; // ambient CO₂ in model units (feedback presets, scenarios.ts)
const GAMMA_EXCESS = 0.125 * CA - CA; // compensation point as excess over ambient (= -7)
const SAMPLE = 2890; // ≈ 0.5 s
// DISH_FB_SCALE=0.01 shortens every run for a smoke test (results are then not meaningful).
const SCALE = Number(process.env.DISH_FB_SCALE ?? 1);

type Job = { id: string; dish: string; bc: 'sealed' | 'taped'; g: 0 | 1; feedback: boolean; steps: number };
const JOBS: Job[] = [
  { id: 'BRIC_sealed_fb_g1', dish: 'BRIC-mid', bc: 'sealed', g: 1, feedback: true, steps: 2_400_000 },
  { id: 'BRIC_sealed_fb_g0', dish: 'BRIC-mid', bc: 'sealed', g: 0, feedback: true, steps: 2_400_000 },
  { id: 'CARA_taped_fb_g1', dish: 'CARA-mid', bc: 'taped', g: 1, feedback: true, steps: 300_000 },
  { id: 'CARA_taped_fb_g0', dish: 'CARA-mid', bc: 'taped', g: 0, feedback: true, steps: 300_000 },
  // Buoyancy-reference fix alone (no feedback), same length as T19, to isolate its effect.
  { id: 'BRIC_sealed_nofb_g1', dish: 'BRIC-mid', bc: 'sealed', g: 1, feedback: false, steps: 150_000 },
];

const rd = (d: Readout[], k: string) => num(d, k);

cli(
  'dish_feedback',
  JOBS,
  (j) => {
    const geo = dishGeom(DISHES[j.dish]);
    const inst = makeLeafScene({
      id: j.id, label: j.id, gRatio: j.g, nx: geo.nx, ny: geo.ny, renderScale: 0.12,
      geometry: dishLeafGeometry({ agarCells: geo.agarCells, gapCells: cells(GAP_MM) }),
      membraneK: j.bc === 'sealed' ? 0 : 0.01,
      co2Ambient: j.feedback ? CA : undefined,
      buoyancyRef: 'enclosureMean',
    })();
    const f = inst.fluid;
    const series: number[][] = [];
    const steps = Math.max(SAMPLE, Math.round(j.steps * SCALE));
    for (let s = 1; s <= steps; s++) {
      f.collideAndStream();
      inst.postStream();
      inst.onAfterStep(s);
      if (s % SAMPLE === 0 || s === steps) {
        const d = inst.diagnostics(s);
        series.push([s * DT_S, rd(d, 'dish-mean'), j.feedback ? rd(d, 'net assimilation') : NaN, rd(d, 'g_bl vs enclosure bulk'), rd(d, 'g_bl CO₂')]);
      }
    }
    return { ...j, series };
  },
  (res) => {
    const rows = ['job,t_s,dish_mean_CO2,net_assimilation_pct,g_bl_vs_dish_air,g_bl_vs_ambient'];
    const summary = ['job,gravity_g,boundary,feedback,t_end_s,dish_mean_CO2_end,A_end_pct,t_A_below_10pct_s,t_dish_to_compensation_s,g_bl_dish_air_at_5s,g_bl_dish_air_at_26s,g_bl_dish_air_end'];
    const fx = (v: number | null, dp: number) => (v === null || !Number.isFinite(v) ? 'NaN' : v.toFixed(dp));
    const at = (s: number[][], t: number, k: number) => {
      let best = s[0];
      for (const r of s) if (Math.abs(r[0] - t) < Math.abs(best[0] - t)) best = r;
      return best[k];
    };
    for (const j of JOBS) {
      const s = (res.get(j.id) as { series: number[][] }).series;
      // NaN is stored as null in the job JSON: g_bl is undefined once the surface gap
      // vanishes (assimilation stopped), so format defensively.
      for (const r of s) rows.push([j.id, fx(r[0], 2), fx(r[1], 4), fx(r[2], 1), fx(r[3], 3), fx(r[4], 3)].join(','));
      const last = s[s.length - 1];
      const tA = s.find((r) => r[2] !== null && Number.isFinite(r[2]) && r[2] < 10);
      const tC = s.find((r) => r[1] <= GAMMA_EXCESS * 0.95);
      summary.push([j.id, j.g, j.bc, j.feedback, fx(last[0], 1), fx(last[1], 3), fx(last[2], 1),
        tA ? tA[0].toFixed(1) : 'not reached', tC ? tC[0].toFixed(1) : 'not reached',
        fx(at(s, 5.2, 3), 3), fx(at(s, 26, 3), 3), fx(last[3], 3)].join(','));
    }
    writeFileSync('results/tables/T20_dish_feedback.csv', rows.join('\n') + '\n');
    writeFileSync('results/tables/T20_dish_feedback_summary.csv', summary.join('\n') + '\n');
    console.log(summary.join('\n'));
    console.log('wrote T20_dish_feedback.csv, T20_dish_feedback_summary.csv');
  },
);
