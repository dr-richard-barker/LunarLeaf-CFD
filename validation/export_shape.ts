// Export the leaf-shape sweep (T14): does blade geometry move boundary-layer transport,
// and does the effect grow as gravity falls?
//
// Deliberately a SEPARATE table from T2/T13. Those are the published calibration and the
// handoff to the photorespiration model (fvcb.py consumes T13); the g_bl anchor is pinned
// to the ellipse at 1 g and must not move. Everything here is reported both absolutely and
// as a ratio to the matched reference in its own group.
//
// Two independently controlled groups. Do NOT compare across them: the longitudinal cut has
// a 52-cell chord and the transverse cut a 27-cell one, so their characteristic lengths,
// Rayleigh numbers and Sherwood numbers are on different scales by construction.
//
//   outline group  — ellipse vs real outline, longitudinal cut, identical chord + thickness
//   curl group     — flat vs curled blade, transverse cut, identical chord + thickness
//
// Since 2026-10-07 every case runs to steady state (150 k steps ≈ 26 s; see jobs.ts) and
// T14 records the g_bl drift over the last 5 s. The original 30 k-step snapshot caught the
// µg cases mid-relaxation (the µg ellipse read 0.494 against a steady 0.443).
//
//   npx esbuild validation/export_shape.ts --bundle --format=esm --platform=node \
//     --loader:.json=json --outfile=validation/export_shape.mjs
//   node validation/export_shape.mjs list | xargs -P 8 -I{} node validation/export_shape.mjs job {}
//   node validation/export_shape.mjs merge

import { writeFileSync } from 'node:fs';
import { SCENARIOS } from '../src/scenarios/scenarios';
import { cli, DEFAULT_STEPS, driftPct, num, pair, runScene, val, warnDrift } from './jobs';

// Longer runs for any case that is still drifting at DEFAULT_STEPS.
const STEPS_BY_ID: Record<string, number> = {};
const DRIFT_WINDOW = 30000; // last ~5.2 s

interface Row {
  id: string;
  group: string;
  geometry: string;
  cut: string;
  curl: number;
  gravity: number;
  charLenCells: number;
  uMax: number;
  gbl: number;
  deltaMm: number;
  sh: number;
  dCco2: number;
  dCco2Peak: number;
  drift: number;
  steps: number;
}

const SPEC: Array<{ id: string; group: string; geometry: string; cut: string; curl: number; gravity: number }> = [
  // Outline group — the like-for-like test against the published ellipse.
  { id: 'leaf-earth', group: 'outline', geometry: 'ellipse (reference)', cut: 'longitudinal', curl: 0, gravity: 1 },
  { id: 'shape-flat-earth', group: 'outline', geometry: 'real outline', cut: 'longitudinal', curl: 0, gravity: 1 },
  { id: 'leaf-ug', group: 'outline', geometry: 'ellipse (reference)', cut: 'longitudinal', curl: 0, gravity: 0 },
  { id: 'shape-flat-ug', group: 'outline', geometry: 'real outline', cut: 'longitudinal', curl: 0, gravity: 0 },
  // Curl group — 2x2, curl crossed with gravity.
  { id: 'curl-none-earth', group: 'curl', geometry: 'real outline', cut: 'transverse', curl: 0, gravity: 1 },
  { id: 'curl-strong-earth', group: 'curl', geometry: 'real outline', cut: 'transverse', curl: 0.8, gravity: 1 },
  { id: 'curl-none-ug', group: 'curl', geometry: 'real outline', cut: 'transverse', curl: 0, gravity: 0 },
  { id: 'curl-strong-ug', group: 'curl', geometry: 'real outline', cut: 'transverse', curl: 0.8, gravity: 0 },
];

cli(
  'export_shape',
  SPEC,
  (spec) => {
    const def = SCENARIOS.find((s) => s.id === spec.id);
    if (!def) throw new Error(`scenario '${spec.id}' not found`);
    const steps = STEPS_BY_ID[spec.id] ?? DEFAULT_STEPS;
    const r = runScene(def.build(), steps, steps - DRIFT_WINDOW);
    const d = r.end.readouts;

    // The asset geometries report their resolved section as "<n> x <m> cells"; the ellipse
    // scenarios have no such row, so fall back to the documented 52-cell chord.
    const section = val(d, 'section');
    const charLenCells = section ? parseFloat(section.split('·')[1]) : 52;
    const [dcMean, dcPeak] = pair(d, 'ΔC CO₂');
    const row: Row = {
      ...spec,
      charLenCells,
      uMax: num(d, 'u_max'),
      gbl: num(d, 'g_bl'),
      deltaMm: num(d, 'δ film'),
      sh: num(d, 'Sherwood'),
      dCco2: dcMean,
      dCco2Peak: dcPeak,
      drift: driftPct(r, (rows) => num(rows, 'g_bl')),
      steps,
    };
    return row as unknown as Record<string, unknown>;
  },
  (res) => {
    const rows = SPEC.map((s) => res.get(s.id) as unknown as Row);
    for (const r of rows) {
      warnDrift(`T14 ${r.id} g_bl`, r.drift);
      console.log(
        `${r.id.padEnd(20)} chord=${r.charLenCells.toFixed(0)} cells  u_max=${r.uMax.toExponential(2)}  ` +
          `g_bl=${r.gbl.toFixed(3)}  ΔC=${r.dCco2.toFixed(3)}  drift=${r.drift.toFixed(2)} %  (${r.steps} steps)`,
      );
    }

    // Reference within each group at each gravity: the first row with curl 0.
    const refFor = (r: Row) =>
      rows.find((q) => q.group === r.group && q.gravity === r.gravity && q.curl === 0 && q !== r) ??
      rows.find((q) => q.group === r.group && q.gravity === r.gravity)!;

    const out: string[] = [];
    out.push(
      'scenario,group,geometry,cut,curl,gravity_g,chord_cells,u_max,g_bl_mol_m2_s,delta_mm,Sherwood,dC_CO2_mean,dC_CO2_peak,g_bl_ratio_to_group_ref,gbl_drift_pct_last_5s',
    );
    for (const r of rows) {
      const ref = refFor(r);
      const ratio = ref && ref !== r && ref.gbl > 0 ? r.gbl / ref.gbl : 1;
      out.push(
        [
          r.id,
          r.group,
          `"${r.geometry}"`,
          r.cut,
          r.curl,
          r.gravity,
          r.charLenCells.toFixed(0),
          r.uMax.toExponential(3),
          r.gbl.toFixed(3),
          r.deltaMm.toFixed(2),
          r.sh.toFixed(1),
          r.dCco2.toFixed(4),
          r.dCco2Peak.toFixed(4),
          ratio.toFixed(3),
          r.drift.toFixed(2),
        ].join(','),
      );
    }

    writeFileSync('results/tables/T14_shape_sweep.csv', out.join('\n') + '\n');
    console.log('\nwrote T14_shape_sweep.csv');

    // --- summary -------------------------------------------------------------
    // Reported for both the blade mean and the worst spot, because they do not agree and
    // the disagreement is the finding. g_bl is a blade-mean conductance; the peak surface
    // gap is the trapped interior of the U, which is where a cell actually sits.
    const get = (id: string) => rows.find((r) => r.id === id)!;

    console.log('\n--- outline (longitudinal cut, chord matched at 52 cells) ---');
    for (const g of [1, 0]) {
      const ref = rows.find((r) => r.group === 'outline' && r.gravity === g && r.geometry.startsWith('ellipse'))!;
      const real = rows.find((r) => r.group === 'outline' && r.gravity === g && r.geometry === 'real outline')!;
      console.log(
        `  ${g === 1 ? '1 g ' : 'µg  '}  ellipse g_bl ${ref.gbl.toFixed(3)} → real outline ${real.gbl.toFixed(3)} ` +
          `(${(100 * (real.gbl / ref.gbl - 1)).toFixed(1)}%)`,
      );
    }

    console.log('\n--- curl (transverse cut) ---');
    const meanEarth = get('curl-strong-earth').gbl / get('curl-none-earth').gbl;
    const meanUg = get('curl-strong-ug').gbl / get('curl-none-ug').gbl;
    const peakEarth = get('curl-strong-earth').dCco2Peak / get('curl-none-earth').dCco2Peak;
    const peakUg = get('curl-strong-ug').dCco2Peak / get('curl-none-ug').dCco2Peak;
    console.log(`  blade-mean g_bl:   1 g ×${meanEarth.toFixed(3)}   µg ×${meanUg.toFixed(3)}`);
    console.log(`  peak surface gap:  1 g ×${peakEarth.toFixed(3)}   µg ×${peakUg.toFixed(3)}`);
    console.log(
      `  worst spot overall: ${get('curl-strong-ug').dCco2Peak.toFixed(3)} (curled, µg) vs ` +
        `${get('curl-none-earth').dCco2Peak.toFixed(3)} (flat, 1 g) = ` +
        `${(get('curl-strong-ug').dCco2Peak / get('curl-none-earth').dCco2Peak).toFixed(2)}x`,
    );
    console.log(
      meanUg < meanEarth
        ? '  → curl costs more in the MEAN under microgravity.'
        : '  → curl costs about the same in the MEAN at either gravity; the compounding is in the PEAK.',
    );
    console.log(
      '\n  CAVEAT: chord grows ' +
        `${get('curl-none-earth').charLenCells.toFixed(0)}→${get('curl-strong-earth').charLenCells.toFixed(0)} cells with curl, ` +
        'because the blade thickness is inflated ~11x to be resolvable and that fattens a\n' +
        '  tilted margin sideways. The curl comparison is therefore not perfectly controlled.',
    );
  },
);
