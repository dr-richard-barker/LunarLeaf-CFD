// Forced-airflow sweep: a leaf in microgravity ventilated at increasing fan
// speeds. Finds the fan speed at which the surface gas gaps fall back to the
// Earth-1 g (buoyant-convection) level — the ventilation needed to null the
// microgravity penalty.
//
// Since 2026-10-07: pressure outlet (the default in makeLeafScene) and 150 k steps.
// The original T6 (copy outlet, 30 k steps) let the through-flow decay and caught the
// 0 g reference mid-relaxation, giving an Earth-equivalent speed of 2.8 cm/s.
// Set LUNARLEAF_LEGACY=1 to reproduce that original table (written to
// T6_forced_airflow_legacy.csv, never over the current one).
//
//   node validation/fan_sweep.mjs list | xargs -P 11 -I{} node validation/fan_sweep.mjs job {}
//   node validation/fan_sweep.mjs merge
import { writeFileSync } from 'node:fs';
import { makeLeafScene, leafGeometry } from '../src/scenarios/scenarios';
import { cli, DEFAULT_STEPS, driftPct, num, pair, runScene, warnDrift } from './jobs';

const LEGACY = process.env.LUNARLEAF_LEGACY === '1';
const STEPS = LEGACY ? 30000 : DEFAULT_STEPS;
const OUTLET = LEGACY ? 'copy' : 'pressure';
const OUT = LEGACY ? 'T6_forced_airflow_legacy.csv' : 'T6_forced_airflow.csv';

const U_STAR_CM_S = 166; // lattice→physical velocity (results/tables/T3)
const DOM = { nx: 128, ny: 96, renderScale: 0.12, geometry: leafGeometry };
const Us = [0.005, 0.01, 0.02, 0.03, 0.04, 0.05, 0.07, 0.1, 0.15];

type Job = { id: string; gRatio: number; forcedU?: number };
const JOBS: Job[] = [
  { id: 'earth_1g', gRatio: 1 },
  { id: 'ug_still', gRatio: 0 },
  ...Us.map((U) => ({ id: `ug_fan_${U}`, gRatio: 0, forcedU: U })),
];

cli(
  LEGACY ? 'fan_sweep_legacy' : 'fan_sweep',
  JOBS,
  (j) => {
    const inst = makeLeafScene({ ...DOM, id: 'x', label: 'x', outletBC: OUTLET, gRatio: j.gRatio, forcedU: j.forcedU })();
    const r = runScene(inst, STEPS);
    const d = r.end.readouts;
    const w = (rows: typeof d) => Math.abs(pair(rows, 'ΔC H₂O')[0]);
    return {
      umax: num(d, 'u_max'),
      w: w(d),
      c: Math.abs(pair(d, 'ΔC CO₂')[0]),
      drift: driftPct(r, w),
    };
  },
  (res) => {
    const get = (id: string) => res.get(id) as { umax: number; w: number; c: number; drift: number };
    const earth = get('earth_1g');
    const ug = get('ug_still');
    const rows = ['case,fan_U,fan_cm_s,u_max,dC_H2O_mean,dC_CO2_mean'];
    rows.push(`earth_1g,,,${earth.umax.toExponential(3)},${earth.w.toFixed(4)},${earth.c.toFixed(4)}`);
    rows.push(`ug_still,0,0,0,${ug.w.toFixed(4)},${ug.c.toFixed(4)}`);
    const warnings = [warnDrift('earth_1g', earth.drift), warnDrift('ug_still', ug.drift)];
    const series = Us.map((U) => {
      const r = get(`ug_fan_${U}`);
      rows.push(`ug_fan,${U},${(U * U_STAR_CM_S).toFixed(1)},${r.umax.toExponential(3)},${r.w.toFixed(4)},${r.c.toFixed(4)}`);
      warnings.push(warnDrift(`ug_fan ${U}`, r.drift));
      return { U, w: r.w };
    });

    // Interpolate the fan speed that matches the Earth-1g surface gap.
    let nullU = NaN;
    for (let i = 1; i < series.length; i++) {
      const a = series[i - 1];
      const b = series[i];
      if ((a.w - earth.w) * (b.w - earth.w) <= 0) {
        nullU = a.U + ((earth.w - a.w) / (b.w - a.w)) * (b.U - a.U);
        break;
      }
    }
    const nullCm = nullU * U_STAR_CM_S;
    rows.push(`# Earth-equivalent fan speed = ${nullU.toFixed(3)} lattice = ${nullCm.toFixed(1)} cm/s`);
    rows.push(`# ${OUTLET} outlet, ${STEPS} steps${warnings.some(Boolean) ? '; DRIFT WARNINGS — see log' : '; all cases steady (<0.5 % over last ~5 s)'}`);
    writeFileSync(`results/tables/${OUT}`, rows.join('\n') + '\n');
    console.log(`=> Earth-equivalent ventilation: ${nullU.toFixed(3)} lattice ≈ ${nullCm.toFixed(1)} cm/s`);
    console.log(`wrote ${OUT}`);
  },
);
