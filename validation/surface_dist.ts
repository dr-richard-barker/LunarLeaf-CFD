/**
 * Surface-distribution metrics of the leaf-surface CO₂ gap (T18).
 *
 * T2/T13 report the surface MEAN gap. Following the tray-plane CoV and target-band
 * fraction used by the microgreen-chamber-cfd project, this records how uneven the gap
 * is over the plant surface: CoV, 10th/50th/90th percentiles of |ΔC CO₂|, and the
 * fraction of surface cells whose gap exceeds an isolated Earth leaf's mean (0.161).
 * Steady-state scenes only (150 k steps; the 0 g canopy 900 k), with the jobs.ts drift
 * check. BRIC/CARA are left out: a sealed dish has no steady state.
 *
 *   npx esbuild validation/surface_dist.ts --bundle --format=esm --platform=node \
 *     --loader:.json=json --outfile=validation/surface_dist.mjs
 *   node validation/surface_dist.mjs list | xargs -P 8 -I{} node validation/surface_dist.mjs job {}
 *   node validation/surface_dist.mjs merge          # -> results/tables/T18_surface_distribution.csv
 */
import { writeFileSync } from 'node:fs';
import { SCENARIOS } from '../src/scenarios/scenarios';
import { cli, DEFAULT_STEPS, driftPct, num, pair, runScene, val, warnDrift } from './jobs';

const STEPS_BY_ID: Record<string, number> = { 'canopy-ug': 900000 };
const DRIFT_WINDOW = 30000;

const SPEC = [
  { id: 'leaf-earth', scale: 'leaf', gravity: 1, hardware: 'open' },
  { id: 'leaf-ug', scale: 'leaf', gravity: 0, hardware: 'open' },
  { id: 'rosette-earth', scale: 'rosette', gravity: 1, hardware: 'open' },
  { id: 'rosette-ug', scale: 'rosette', gravity: 0, hardware: 'open' },
  { id: 'canopy-earth', scale: 'canopy', gravity: 1, hardware: 'open' },
  { id: 'canopy-ug', scale: 'canopy', gravity: 0, hardware: 'open' },
  { id: 'hw-veggie', scale: 'leaf', gravity: 0, hardware: 'VEGGIE' },
  { id: 'hw-rosette-veggie', scale: 'rosette', gravity: 0, hardware: 'VEGGIE' },
];

cli(
  'surface_dist',
  SPEC,
  (s) => {
    const def = SCENARIOS.find((x) => x.id === s.id);
    if (!def) throw new Error(`scenario '${s.id}' not found`);
    const steps = STEPS_BY_ID[s.id] ?? DEFAULT_STEPS;
    const r = runScene(def.build(), steps, steps - DRIFT_WINDOW);
    const d = r.end.readouts;
    const [p10, p50, p90] = val(d, 'surface |ΔC CO₂| p10').split('/').map((x) => parseFloat(x));
    const cov = (rows: typeof d) => num(rows, 'surface |ΔC CO₂| CoV');
    return {
      ...s,
      steps,
      meanAbs: Math.abs(pair(d, 'ΔC CO₂')[0]),
      peakAbs: Math.abs(pair(d, 'ΔC CO₂')[1]),
      cov: cov(d),
      p10, p50, p90,
      fracWorse: num(d, 'surface frac > Earth-leaf mean'),
      drift: driftPct(r, cov),
    };
  },
  (res) => {
    const out = ['scenario,scale,gravity_g,hardware,steps,dC_CO2_mean_abs,dC_CO2_peak_abs,surface_cov,p10_abs,p50_abs,p90_abs,p90_over_p10,frac_surface_worse_than_earth_leaf_mean,cov_drift_pct_last_5s'];
    for (const s of SPEC) {
      const r = res.get(s.id) as Record<string, number | string>;
      warnDrift(`T18 ${s.id} CoV`, r.drift as number);
      const n = (k: string, dp: number) => (r[k] as number).toFixed(dp);
      out.push([s.id, s.scale, s.gravity, s.hardware, r.steps, n('meanAbs', 3), n('peakAbs', 3), n('cov', 4), n('p10', 4), n('p50', 4), n('p90', 4),
        ((r.p90 as number) / (r.p10 as number)).toFixed(3), n('fracWorse', 4), n('drift', 2)].join(','));
    }
    writeFileSync('results/tables/T18_surface_distribution.csv', out.join('\n') + '\n');
    console.log(out.join('\n'));
    console.log('wrote T18_surface_distribution.csv');
  },
);
