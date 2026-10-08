/**
 * Domain-size sensitivity of the leaf/rosette boundary-layer conductance.
 *
 * At 0 g the steady H₂O/CO₂ halo reaches the ambient-held chamber walls, so g_bl may
 * depend on how far away those walls are. This runs the same leaf / rosette (same
 * dx, same blade) in chambers 1.5× and 2× the production 128 × 96 lattice
 * (36.9 × 27.6 mm), at 1 g and 0 g, each to steady state with the jobs.ts drift check.
 * The 1× values are T13. Diffusive settling time grows as L², hence the longer runs.
 *
 * In 2-D pure diffusion to a fixed-value wall at distance R, the flux from a body of
 * size a falls as 1/ln(R/a), with no size-independent limit, so a slow downward drift
 * of the 0 g g_bl with chamber size is expected rather than a sign of error.
 *
 *   npx esbuild validation/domain_size.ts --bundle --format=esm --platform=node \
 *     --loader:.json=json --outfile=validation/domain_size.mjs
 *   node validation/domain_size.mjs list | xargs -P 8 -I{} node validation/domain_size.mjs job {}
 *   node validation/domain_size.mjs merge          # -> results/tables/T17_domain_size.csv
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { leafGeometry, makeLeafScene, rosetteGeometry } from '../src/scenarios/scenarios';
import { cli, driftPct, num, pair, runScene, warnDrift } from './jobs';

const DX_MM = 0.288;
const BASE = { nx: 128, ny: 96 };
const STEPS: Record<string, number> = { '1.5': 300000, '2': 500000 };
const DRIFT_WINDOW = 30000; // last ~5.2 s
const GEOM = { leaf: leafGeometry, rosette: rosetteGeometry };

type Job = { id: string; scale: 'leaf' | 'rosette'; g: 0 | 1; f: '1.5' | '2' };
const JOBS: Job[] = [];
for (const scale of ['leaf', 'rosette'] as const)
  for (const g of [1, 0] as const)
    for (const f of ['1.5', '2'] as const) JOBS.push({ id: `${scale}_g${g}_x${f}`, scale, g, f });

cli(
  'domain_size',
  JOBS,
  (j) => {
    const k = Number(j.f);
    const nx = Math.round(BASE.nx * k);
    const ny = Math.round(BASE.ny * k);
    const inst = makeLeafScene({ id: j.id, label: j.id, gRatio: j.g, nx, ny, renderScale: 0.12, geometry: GEOM[j.scale] })();
    const steps = STEPS[j.f];
    const r = runScene(inst, steps, steps - DRIFT_WINDOW);
    const d = r.end.readouts;
    return {
      nx, ny, steps,
      gbl: num(d, 'g_bl'),
      delta: num(d, 'δ film'),
      dCco2: pair(d, 'ΔC CO₂')[0],
      drift: driftPct(r, (rows) => num(rows, 'g_bl')),
    };
  },
  (res) => {
    // 1× reference values straight from T13 (same scenes, 150 k steps, steady).
    const t13 = readFileSync('results/tables/T13_boundary_layer.csv', 'utf8').trim().split('\n').slice(1)
      .map((l) => l.split(','));
    const ref = (scale: string, g: number) => {
      const row = t13.find((c) => c[0] === `${scale}-${g === 1 ? 'earth' : 'ug'}`)!;
      return { gbl: parseFloat(row[3]), delta: parseFloat(row[4]), dCco2: parseFloat(row[6]) };
    };
    const out = ['scale,gravity_g,domain_factor,nx,ny,width_mm,height_mm,steps,g_bl_mol_m2_s,delta_mm,dC_CO2_mean,g_bl_ratio_to_1x,gbl_drift_pct_last_5s'];
    for (const scale of ['leaf', 'rosette'] as const) {
      for (const g of [1, 0] as const) {
        const r1 = ref(scale, g);
        out.push([scale, g, 1, BASE.nx, BASE.ny, (BASE.nx * DX_MM).toFixed(1), (BASE.ny * DX_MM).toFixed(1), 150000,
          r1.gbl.toFixed(3), r1.delta.toFixed(2), r1.dCco2, '1.000', '0.00'].join(','));
        for (const f of ['1.5', '2'] as const) {
          const r = res.get(`${scale}_g${g}_x${f}`) as Record<string, number>;
          warnDrift(`${scale} g${g} x${f}`, r.drift);
          out.push([scale, g, f, r.nx, r.ny, (r.nx * DX_MM).toFixed(1), (r.ny * DX_MM).toFixed(1), r.steps,
            r.gbl.toFixed(3), r.delta.toFixed(2), r.dCco2, (r.gbl / r1.gbl).toFixed(3), r.drift.toFixed(2)].join(','));
        }
      }
    }
    writeFileSync('results/tables/T17_domain_size.csv', out.join('\n') + '\n');
    console.log(out.join('\n'));
    console.log('wrote T17_domain_size.csv');
  },
);
