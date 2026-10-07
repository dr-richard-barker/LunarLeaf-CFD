// Extend the membrane (BRIC/CARA) and fan (VEGGIE) analysis to all three scales.
// For leaf / rosette / canopy: Earth & µg references, a forced-airflow sweep (find
// the Earth-equivalent ventilation speed), and the three enclosures (sealed / tape /
// vented). Writes T9 (fan by scale) and T10 (hardware by scale).
//
// Since 2026-10-07: the references, fan sweep and VEGGIE rows use the pressure outlet
// and run to steady state (150 k steps). BRIC and CARA keep the original 22 k steps
// (≈ 3.8 s): a sealed BRIC dish never reaches steady state, so its value is defined
// by run length, and CARA had not settled by 26 s either (T15). Their T10 rows are
// therefore unchanged from the original table.
//
//   node validation/scales.mjs list | xargs -P 16 -I{} node validation/scales.mjs job {}
//   node validation/scales.mjs merge
import { writeFileSync } from 'node:fs';
import {
  makeLeafScene,
  leafGeometry,
  rosetteGeometry,
  canopyGeometry,
} from '../src/scenarios/scenarios';
import { cli, DEFAULT_STEPS, driftPct, num, pair, runScene, warnDrift } from './jobs';

const U_STAR = 166; // cm/s per lattice velocity unit (results/tables/T3)
const MEMBRANE_STEPS = 22000; // original run length, kept for BRIC/CARA (see header)
const DOM = { nx: 128, ny: 96, renderScale: 0.2 };

const SCALES = [
  { key: 'leaf', geometry: leafGeometry, sourceScale: 1 },
  { key: 'rosette', geometry: rosetteGeometry, sourceScale: 1 },
  { key: 'canopy', geometry: canopyGeometry, sourceScale: 0.3 },
];
const FAN = [0.01, 0.02, 0.04, 0.07, 0.11, 0.16, 0.22];
// Lattice Boltzmann is only valid at low Mach number. With the pressure outlet the full
// fan flow squeezes between rosette leaves / canopy shoots, so the faster runs exceed
// Ma 0.3 (or blow up to NaN). Those rows are kept for the record, flagged by ma_max,
// and excluded from the Earth-equivalent crossing.
const MA_VALID = 0.3;
const CS = Math.sqrt(1 / 3);
const fmt = (x: number | null, d: number) => (x === null || !Number.isFinite(x) ? 'NaN' : x.toFixed(d));
// The 0 g canopy relaxes by diffusion across the whole domain (no nearby ambient walls);
// at 150 k steps it was still moving 1.1 % per 5 s, so it gets a longer run.
const STEPS_BY_ID: Record<string, number> = { canopy__ug: 900000 };
const DRIFT_WINDOW = 30000;

type Job = { id: string; scale: string; extra: Record<string, unknown>; steps: number };
const JOBS: Job[] = SCALES.flatMap((s) => [
  { id: `${s.key}__earth`, scale: s.key, extra: { gRatio: 1 }, steps: DEFAULT_STEPS },
  { id: `${s.key}__ug`, scale: s.key, extra: { gRatio: 0 }, steps: STEPS_BY_ID[`${s.key}__ug`] ?? DEFAULT_STEPS },
  ...FAN.map((U) => ({ id: `${s.key}__fan_${U}`, scale: s.key, extra: { forcedU: U }, steps: DEFAULT_STEPS })),
  { id: `${s.key}__bric`, scale: s.key, extra: { membraneK: 0 }, steps: MEMBRANE_STEPS },
  { id: `${s.key}__cara`, scale: s.key, extra: { membraneK: 0.01 }, steps: MEMBRANE_STEPS },
  { id: `${s.key}__veggie`, scale: s.key, extra: { forcedU: 0.05 }, steps: DEFAULT_STEPS },
]);

type R = { w: number | null; c: number | null; umax: number; dish: number | null; drift: number | null };
const mach = (r: R) => (r.w === null ? NaN : r.umax / CS); // NaN run: u_max only reads the pinned inlet

cli(
  'scales',
  JOBS,
  (j) => {
    const scale = SCALES.find((s) => s.key === j.scale)!;
    const inst = makeLeafScene({
      ...DOM,
      id: 'x',
      label: 'x',
      geometry: scale.geometry,
      sourceScale: scale.sourceScale,
      gRatio: 0,
      ...j.extra,
    })();
    const r = runScene(inst, j.steps, j.steps - DRIFT_WINDOW);
    const d = r.end.readouts;
    const w = (rows: typeof d) => Math.abs(pair(rows, 'ΔC H₂O')[0]);
    return { w: w(d), c: Math.abs(pair(d, 'ΔC CO₂')[0]), umax: num(d, 'u_max'), dish: num(d, 'dish-mean'), drift: driftPct(r, w) };
  },
  (res) => {
    const t9 = ['scale,case,fan_cm_s,dC_H2O,dC_CO2,ma_max'];
    const t10 = ['scale,hardware,surf_dC_H2O,surf_dC_CO2,dishmean_CO2,ma_max'];
    const crossings: Record<string, number> = {};
    let drifting = false;
    for (const scale of SCALES) {
      const get = (k: string) => res.get(`${scale.key}__${k}`) as R;
      const earth = get('earth');
      const ug = get('ug');
      t9.push(`${scale.key},earth,,${fmt(earth.w, 4)},${fmt(earth.c, 4)},${fmt(mach(earth), 2)}`);
      t9.push(`${scale.key},ug_still,0,${fmt(ug.w, 4)},${fmt(ug.c, 4)},0.00`);
      drifting = !!warnDrift(`${scale.key} earth`, earth.drift ?? NaN) || drifting;
      drifting = !!warnDrift(`${scale.key} ug`, ug.drift ?? NaN) || drifting;

      const series = FAN.flatMap((U) => {
        const r = get(`fan_${U}`);
        const ma = mach(r);
        t9.push(`${scale.key},ug_fan,${(U * U_STAR).toFixed(1)},${fmt(r.w, 4)},${fmt(r.c, 4)},${fmt(ma, 2)}`);
        if (!(ma <= MA_VALID)) {
          console.warn(`[${scale.key}] fan ${(U * U_STAR).toFixed(1)} cm/s ${r.w === null ? 'blew up (NaN)' : `Ma ${ma.toFixed(2)} > ${MA_VALID}`} — excluded from crossing`);
          return [];
        }
        drifting = !!warnDrift(`${scale.key} fan ${U}`, r.drift ?? NaN) || drifting;
        return [{ U, w: r.w as number }];
      });
      // Earth-equivalent crossing (surface gap back to Earth-1g level)
      let nullU = NaN;
      for (let i = 1; i < series.length; i++) {
        if ((series[i - 1].w - (earth.w as number)) * (series[i].w - (earth.w as number)) <= 0) {
          const a = series[i - 1];
          const b = series[i];
          nullU = a.U + (((earth.w as number) - a.w) / (b.w - a.w)) * (b.U - a.U);
          break;
        }
      }
      crossings[scale.key] = nullU * U_STAR;

      const bric = get('bric');
      const cara = get('cara');
      const veg = get('veggie');
      drifting = !!warnDrift(`${scale.key} veggie`, veg.drift ?? NaN) || drifting;
      if (mach(veg) > MA_VALID) console.warn(`[${scale.key}] VEGGIE Ma ${mach(veg).toFixed(2)} > ${MA_VALID} — treat with caution`);
      t10.push(`${scale.key},BRIC,${fmt(bric.w, 4)},${fmt(bric.c, 4)},${fmt(bric.dish, 4)},0.00`);
      t10.push(`${scale.key},CARA,${fmt(cara.w, 4)},${fmt(cara.c, 4)},${fmt(cara.dish, 4)},0.00`);
      t10.push(`${scale.key},VEGGIE,${fmt(veg.w, 4)},${fmt(veg.c, 4)},NaN,${fmt(mach(veg), 2)}`);
      console.log(`[${scale.key}] BRIC=${fmt(bric.w, 3)} CARA=${fmt(cara.w, 3)} VEGGIE=${fmt(veg.w, 3)}  Earth-equiv fan=${crossings[scale.key].toFixed(1)} cm/s`);
    }

    t9.push('# Earth-equivalent fan speed (cm/s): ' + Object.entries(crossings).map(([k, v]) => `${k}=${v.toFixed(1)}`).join('  '));
    t9.push(`# pressure outlet, ${DEFAULT_STEPS} steps (canopy ug_still ${STEPS_BY_ID.canopy__ug})${drifting ? '; DRIFT WARNINGS — see log' : '; all valid cases steady (<0.5 % over last ~5 s)'}`);
    t9.push(`# crossings use only runs with ma_max <= ${MA_VALID}; NaN crossing = Earth level not reached within the valid range`);
    writeFileSync('results/tables/T9_fan_by_scale.csv', t9.join('\n') + '\n');
    writeFileSync('results/tables/T10_hardware_by_scale.csv', t10.join('\n') + '\n');
    console.log('\nEarth-equivalent ventilation by scale (cm/s):', crossings);
    console.log('wrote T9_fan_by_scale.csv, T10_hardware_by_scale.csv');
  },
);
