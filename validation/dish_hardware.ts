/**
 * A leaf inside the real BRIC and CARA dishes (T19).
 *
 * T17 showed the 0 g conductance depends on the distance to the chamber walls, so the
 * hardware scenes are rebuilt as each dish's actual cross-section instead of the generic
 * 36.9 × 27.6 mm box: agar on the floor, the air headspace above it, and the leaf lying
 * 1 mm above the agar.
 *
 * Dish dimensions (supplied by R. Barker, 2026-10-08):
 *   BRIC  60 mm round dish (packed without lid): base O.D. 54.8–55.6 mm, height 13–15 mm,
 *         agar 10–15 mL.
 *   CARA  120 × 120 mm square dish: inner edge 120 mm, height 15–17 mm, agar 70–80 mL.
 * Assumptions added here (TODO: confirm): 1.0 mm wall and base thickness; agar depth =
 * volume / interior floor area; headspace = (height − base) − agar depth.
 * Mid-range values are the defaults. The 0 g hardware cases are also run at the minimum
 * and maximum headspace the ranges allow.
 *
 * Boundaries: 'ambient' = lid and side walls held at cabin air (a dish open to the
 * cabin, the reference); 'sealed' = all walls zero-flux (BRIC); 'taped' = micropore-tape
 * relaxation toward ambient on the lid and sides, k = 0.01 per step (CARA, as in T10).
 * The agar is zero-flux for every species.
 *
 * g_bl is reported twice: against the original ambient (as in T13), and against the
 * enclosure's own bulk air. The second is meaningful in a sealed dish, whose whole
 * atmosphere drifts.
 *
 *   npx esbuild validation/dish_hardware.ts --bundle --format=esm --platform=node \
 *     --loader:.json=json --outfile=validation/dish_hardware.mjs
 *   node validation/dish_hardware.mjs list | xargs -P 12 -I{} node validation/dish_hardware.mjs job {}
 *   node validation/dish_hardware.mjs merge          # -> results/tables/T19_dish_hardware.csv
 */
import { writeFileSync } from 'node:fs';
import { dishLeafGeometry, makeLeafScene } from '../src/scenarios/scenarios';
import { cli, DEFAULT_STEPS, driftPct, num, pair, runScene, val, warnDrift } from './jobs';

const DX = 0.288; // mm per cell (T3)
const WALL = 1.0; // mm, assumed wall and base thickness (TODO: confirm)
const GAP_MM = 1.0; // leaf blade 1 mm above the agar surface
const DRIFT_WINDOW = 30000;

interface Dish { name: string; widthMm: number; floorCm2: number; heightMm: number; agarMl: number }
const cells = (mm: number) => Math.round(mm / DX);

function dishGeom(d: Dish) {
  const agarMm = (d.agarMl / d.floorCm2) * 10; // mL / cm² -> cm -> mm
  const headMm = d.heightMm - WALL - agarMm;
  return { agarMm, headMm, nx: cells(d.widthMm) + 2, agarCells: cells(agarMm), headCells: cells(headMm) };
}

const bricW = (54.8 + 55.6) / 2 - 2 * WALL;
const bricFloor = Math.PI * (bricW / 20) ** 2;
const DISHES: Record<string, Dish> = {
  'BRIC-mid': { name: 'BRIC 60 mm', widthMm: bricW, floorCm2: bricFloor, heightMm: 14, agarMl: 12.5 },
  'BRIC-min': { name: 'BRIC 60 mm', widthMm: bricW, floorCm2: bricFloor, heightMm: 13, agarMl: 15 },
  'BRIC-max': { name: 'BRIC 60 mm', widthMm: bricW, floorCm2: bricFloor, heightMm: 15, agarMl: 10 },
  'CARA-mid': { name: 'CARA 120 mm sq', widthMm: 120, floorCm2: 144, heightMm: 16, agarMl: 75 },
  'CARA-min': { name: 'CARA 120 mm sq', widthMm: 120, floorCm2: 144, heightMm: 15, agarMl: 80 },
  'CARA-max': { name: 'CARA 120 mm sq', widthMm: 120, floorCm2: 144, heightMm: 17, agarMl: 70 },
};

type BC = 'ambient' | 'sealed' | 'taped';
type Job = { id: string; dish: string; bc: BC; g: 0 | 1 };
const JOBS: Job[] = [];
for (const [dish, hw] of [['BRIC-mid', 'sealed'], ['CARA-mid', 'taped']] as const) {
  for (const bc of ['ambient', hw] as BC[]) for (const g of [1, 0] as const) JOBS.push({ id: `${dish}_${bc}_g${g}`, dish, bc, g });
}
for (const [dish, bc] of [['BRIC-min', 'sealed'], ['BRIC-max', 'sealed'], ['CARA-min', 'taped'], ['CARA-max', 'taped']] as const) {
  JOBS.push({ id: `${dish}_${bc}_g0`, dish, bc, g: 0 });
}

cli(
  'dish_hardware',
  JOBS,
  (j) => {
    const d = DISHES[j.dish];
    const geo = dishGeom(d);
    const ny = geo.agarCells + geo.headCells + 2;
    const inst = makeLeafScene({
      id: j.id, label: j.id, gRatio: j.g, nx: geo.nx, ny, renderScale: 0.12,
      geometry: dishLeafGeometry({ agarCells: geo.agarCells, gapCells: cells(GAP_MM) }),
      membraneK: j.bc === 'sealed' ? 0 : j.bc === 'taped' ? 0.01 : undefined,
    })();
    const r = runScene(inst, DEFAULT_STEPS, DEFAULT_STEPS - DRIFT_WINDOW);
    const rd = r.end.readouts;
    const rel = (rows: typeof rd) => num(rows, 'g_bl vs enclosure bulk');
    return {
      ...j, dishName: d.name, widthMm: d.widthMm, headMm: geo.headMm, agarMm: geo.agarMm, nx: geo.nx, ny,
      gbl: num(rd, 'g_bl CO₂'), gblRel: rel(rd), dCco2: pair(rd, 'ΔC CO₂')[0],
      dish: val(rd, 'dish-mean') ? num(rd, 'dish-mean') : NaN,
      drift: driftPct(r, rel),
    };
  },
  (res) => {
    const out = ['job,dish,boundary,gravity_g,width_mm,headspace_mm,agar_mm,nx,ny,g_bl_vs_ambient,g_bl_vs_enclosure_bulk,dC_CO2_surface,dish_mean_CO2,gbl_rel_drift_pct_last_5s'];
    for (const j of JOBS) {
      const r = res.get(j.id) as Record<string, number | string>;
      warnDrift(`T19 ${j.id} g_bl (bulk)`, r.drift as number);
      const f = (k: string, dp: number) => (Number.isFinite(r[k] as number) ? (r[k] as number).toFixed(dp) : 'NaN');
      out.push([j.id, j.dish, j.bc, j.g, f('widthMm', 1), f('headMm', 2), f('agarMm', 2), r.nx, r.ny,
        f('gbl', 3), f('gblRel', 3), f('dCco2', 3), f('dish', 3), f('drift', 2)].join(','));
    }
    writeFileSync('results/tables/T19_dish_hardware.csv', out.join('\n') + '\n');
    console.log(out.join('\n'));
    console.log('wrote T19_dish_hardware.csv');
  },
);
