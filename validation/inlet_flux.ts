/**
 * Forced-airflow throughput check: does the ventilation inlet deliver the flow it claims?
 *
 * Every forced scene states a fan speed U (lattice units; × 166 cm/s), i.e. a nominal
 * through-flow Q_nom = U · (open inlet rows). This runs each scene to steady state and
 * measures what actually leaves through the outlet column:
 *
 *   face_out  exact mass flux across the last face (nx−2 | nx−1) during one streaming
 *             step: populations streamed fluid→fluid rightward minus leftward
 *   face_in   the same across the first face (0 | 1)
 *   u_out     Σ u_x over the outlet cells after the boundary condition (the
 *             deepspace-seed-twin definition, velocity × width)
 *   rho_in    mean density of the first interior column (x = 1); an equilibrium inlet
 *             held at ρ = 1 leaks mass back across the inlet face by ≈ (ρ_in − 1)/3
 *             per row and step once the interior pressurises to drive the flow
 *
 * and reports each as a ratio to Q_nom. A run is off when face_out / Q_nom leaves
 * 0.95–1.05 (memory: finding-lbm-equilibrium-inlet-leak).
 *
 * All forced scenes are at 0 g, where the species fields exert no buoyancy force, so the
 * flow does not depend on them. `flow` jobs step the fluid alone (bit-identical flow,
 * about half the cost); the named UI scenes and the age-of-air scene run the full scene.
 *
 *   npx esbuild validation/inlet_flux.ts --bundle --format=esm --platform=node \
 *     --loader:.json=json --outfile=validation/inlet_flux.mjs
 *   node validation/inlet_flux.mjs list | xargs -P 16 -I{} node validation/inlet_flux.mjs job {}
 *   node validation/inlet_flux.mjs merge
 *
 * INLET_FLUX_TAG=<tag> names the output (results/tables/inlet_flux_<tag>.csv; default
 * 'current') and the partials folder, so a before/after pair never overwrite each other.
 * INLET_FLUX_BC=equilibrium|densityMatched forces that inlet on every job (default: each
 * scene's own). inlet_flux_before.csv was run on the original code, whose only inlet was
 * the ρ = 1 equilibrium; reproduce it with
 *   INLET_FLUX_TAG=before INLET_FLUX_BC=equilibrium node validation/inlet_flux.mjs ...
 * (the named scenes are then rebuilt from their SCENARIOS configuration with that inlet).
 */
import { writeFileSync } from 'node:fs';
import {
  SCENARIOS,
  makeLeafScene,
  leafGeometry,
  rosetteGeometry,
  canopyGeometry,
  type ScenarioInstance,
} from '../src/scenarios/scenarios';
import { CX, CY } from '../src/solver/lbm/d2q9';
import { cli, DEFAULT_STEPS, DRIFT_CHECK_STEPS } from './jobs';

const TAG = process.env.INLET_FLUX_TAG ?? 'current';
const BC = process.env.INLET_FLUX_BC as 'equilibrium' | 'densityMatched' | undefined;
if (BC && BC !== 'equilibrium' && BC !== 'densityMatched') throw new Error(`INLET_FLUX_BC=${BC}?`);
const DT_S = 0.173e-3;
const U_STAR_CM_S = 166;
const DOM = { nx: 128, ny: 96, renderScale: 0.12 };

type Job = { id: string; source: string; build: () => ScenarioInstance; U: number; full: boolean };

const GEOM = { leaf: [leafGeometry, 1], rosette: [rosetteGeometry, 1], canopy: [canopyGeometry, 0.3] } as const;
// The forced UI scenes' configuration (src/scenarios/scenarios.ts SCENARIOS), used only to
// rebuild them with a forced inlet (INLET_FLUX_BC).
const SCENE_CFG: Record<string, { scale: keyof typeof GEOM; renderScale: number }> = {
  'leaf-ug-fan-lo': { scale: 'leaf', renderScale: 0.12 },
  'leaf-ug-fan-mid': { scale: 'leaf', renderScale: 0.12 },
  'leaf-ug-fan-hi': { scale: 'leaf', renderScale: 0.12 },
  'hw-veggie': { scale: 'leaf', renderScale: 0.12 },
  'hw-rosette-veggie': { scale: 'rosette', renderScale: 0.18 },
  'hw-canopy-veggie': { scale: 'canopy', renderScale: 0.3 },
};
const scene = (id: string, U: number): Job => {
  const c = SCENE_CFG[id];
  return {
    id,
    source: 'SCENARIOS',
    build: BC
      ? makeLeafScene({ ...DOM, renderScale: c.renderScale, id, label: id, gRatio: 0, geometry: GEOM[c.scale][0], sourceScale: GEOM[c.scale][1], forcedU: U, inletBC: BC })
      : SCENARIOS.find((s) => s.id === id)!.build,
    U,
    full: true,
  };
};
const sweep = (source: string, scale: keyof typeof GEOM, U: number): Job => ({
  id: `${scale}_U${U}`,
  source,
  build: makeLeafScene({ ...DOM, id: 'x', label: 'x', gRatio: 0, geometry: GEOM[scale][0], sourceScale: GEOM[scale][1], forcedU: U, inletBC: BC }),
  U,
  full: false,
});

const T6_U = [0.005, 0.01, 0.02, 0.03, 0.04, 0.05, 0.07, 0.1, 0.15];
const T9_U = [0.01, 0.02, 0.04, 0.07, 0.11, 0.16, 0.22];
const JOBS: Job[] = [
  scene('leaf-ug-fan-lo', 0.02),
  scene('leaf-ug-fan-mid', 0.05),
  scene('leaf-ug-fan-hi', 0.1),
  scene('hw-veggie', 0.05),
  scene('hw-rosette-veggie', 0.05),
  scene('hw-canopy-veggie', 0.05),
  ...[0.02, 0.1].map((U) => ({
    id: `age_U${U}`,
    source: 'age_check',
    build: makeLeafScene({ ...DOM, id: 'age', label: 'age', gRatio: 0, geometry: leafGeometry, forcedU: U, ageOfAir: true, outletBC: 'pressure', inletBC: BC }),
    U,
    full: true,
  })),
  // Sweep points behind T6 (leaf) and T9 (all three scales), deduplicated.
  ...[...new Set([...T6_U, ...T9_U])].sort((a, b) => a - b).map((U) => sweep('T6/T9 sweep', 'leaf', U)),
  ...T9_U.map((U) => sweep('T9 sweep', 'rosette', U)),
  ...T9_U.map((U) => sweep('T9 sweep', 'canopy', U)),
];

interface Probe {
  t_s: number;
  face_in: number;
  face_out: number;
  u_out: number;
  rho_in: number;
  q_nom: number;
}

/** Exact mass flux across the face between columns x and x+1 for the streaming step just
 * taken (call after collideAndStream, before the boundary hook overwrites columns 0 and
 * nx−1). Bounce-back slots are skipped: a population that hit a wall never crossed. */
function faceFlux(inst: ScenarioInstance, x: number): number {
  const { f, solid, nx, ny } = inst.fluid;
  const fluidAt = (xx: number, yy: number) => xx >= 0 && xx < nx && yy >= 0 && yy < ny && !solid[xx + yy * nx];
  let q = 0;
  for (let y = 0; y < ny; y++) {
    if (fluidAt(x + 1, y)) {
      const b = (x + 1 + y * nx) * 9;
      for (const i of [1, 5, 8]) if (fluidAt(x, y - CY[i])) q += f[b + i];
    }
    if (fluidAt(x, y)) {
      const b = (x + y * nx) * 9;
      for (const i of [3, 6, 7]) if (fluidAt(x + 1, y - CY[i])) q -= f[b + i];
    }
  }
  return q;
}

function probe(inst: ScenarioInstance, U: number, step: number): Omit<Probe, 'face_in' | 'face_out'> {
  const { f, solid, nx, ny } = inst.fluid;
  let uOut = 0;
  let rhoIn = 0;
  let nIn = 0;
  let open = 0;
  for (let y = 0; y < ny; y++) {
    const ci = y * nx; // x = 0
    if (!solid[ci] && !solid[ci + 1]) open++;
    const c1 = 1 + y * nx;
    if (!solid[c1]) {
      let r = 0;
      for (let i = 0; i < 9; i++) r += f[c1 * 9 + i];
      rhoIn += r;
      nIn++;
    }
    const co = nx - 1 + y * nx;
    if (!solid[co]) {
      let r = 0;
      let mx = 0;
      for (let i = 0; i < 9; i++) {
        r += f[co * 9 + i];
        mx += CX[i] * f[co * 9 + i];
      }
      uOut += mx / r;
    }
  }
  return { t_s: step * DT_S, u_out: uOut, rho_in: rhoIn / nIn, q_nom: U * open };
}

const STEPS = DEFAULT_STEPS;
const SAMPLE_AT = new Set([5000, 30000, 60000, 90000, DRIFT_CHECK_STEPS, STEPS]);

cli(
  `inlet_flux_${TAG}`,
  JOBS,
  (j) => {
    const inst = j.build();
    const probes: Probe[] = [];
    for (let s = 1; s <= STEPS; s++) {
      inst.fluid.collideAndStream();
      const sample = SAMPLE_AT.has(s);
      const faceIn = sample ? faceFlux(inst, 0) : 0;
      const faceOut = sample ? faceFlux(inst, inst.fluid.nx - 2) : 0;
      inst.postStream();
      if (j.full) inst.onAfterStep(s);
      if (sample) probes.push({ ...probe(inst, j.U, s), face_in: faceIn, face_out: faceOut } as Probe);
    }
    let ok = true;
    for (let c = 0; c < inst.fluid.size; c++) if (!inst.fluid.solid[c] && !Number.isFinite(inst.fluid.ux[c])) ok = false;
    return { probes, finite: ok && probes.every((p) => Number.isFinite(p.face_out)) };
  },
  (res) => {
    const rows = [
      'job,source,fan_U,fan_cm_s,q_nom,face_out_over_nom,face_in_over_nom,u_out_over_nom,rho_in_minus_1,face_out_over_nom_t5s,face_out_drift_pct_last_5s',
    ];
    for (const j of JOBS) {
      const r = res.get(j.id) as { probes: Probe[]; finite: boolean };
      const end = r.probes[r.probes.length - 1];
      const chk = r.probes.find((p) => Math.abs(p.t_s - DRIFT_CHECK_STEPS * DT_S) < 1e-9)!;
      const t5 = r.probes.find((p) => Math.abs(p.t_s - 30000 * DT_S) < 1e-9)!;
      const fmt = (x: number, d: number) => (r.finite && Number.isFinite(x) ? x.toFixed(d) : 'NaN');
      const drift = (100 * (end.face_out - chk.face_out)) / Math.abs(chk.face_out);
      rows.push(
        [
          j.id,
          j.source,
          j.U,
          (j.U * U_STAR_CM_S).toFixed(1),
          end.q_nom.toFixed(3),
          fmt(end.face_out / end.q_nom, 4),
          fmt(end.face_in / end.q_nom, 4),
          fmt(end.u_out / end.q_nom, 4),
          fmt(end.rho_in - 1, 5),
          fmt(t5.face_out / t5.q_nom, 4),
          fmt(drift, 3),
        ].join(','),
      );
    }
    rows.push(`# ${STEPS} steps (${(STEPS * DT_S).toFixed(1)} s); ratios at the end of the run; inlet: ${BC ?? "each scene's default"}`);
    const out = `results/tables/inlet_flux_${TAG}.csv`;
    writeFileSync(out, rows.join('\n') + '\n');
    console.log(rows.join('\n'));
    console.log(`wrote ${out}`);
  },
);
