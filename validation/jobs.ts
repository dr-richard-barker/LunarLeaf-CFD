// Shared runner for the export scripts (export_cfd, fan_sweep, scales).
//
// Each script defines named jobs. `node <script>.mjs list` prints the job ids,
// `node <script>.mjs job <id>` runs one job and writes results/tables/.partials/<script>/<id>.json,
// and `node <script>.mjs merge` assembles the tables from the partials. With no
// arguments a script runs every job in turn and then merges. Run in parallel with:
//
//   node validation/<script>.mjs list | xargs -P 16 -I{} node validation/<script>.mjs job {}
//   node validation/<script>.mjs merge
//
// Steady-state cases run DEFAULT_STEPS (150 k ≈ 26 s). The 0 g scenes need ~15 s to
// stop drifting (results/tables/T15_stationarity.csv); the original 30 k / 22 k steps
// (≈ 5.2 / 3.8 s) reported them mid-relaxation. Every job also records the diagnostics
// at DRIFT_CHECK_STEPS, and merge() warns when the last ~5 s moved a value by > 0.5 %.

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import type { Readout, ScenarioInstance } from '../src/scenarios/scenarios';

export const DEFAULT_STEPS = 150000;
export const DRIFT_CHECK_STEPS = 120000;
export const DRIFT_TOL_PCT = 0.5;

export interface Snapshot {
  steps: number;
  readouts: Readout[];
}

/** Run a scene for `steps`, returning the diagnostics at the end and (when reached) at `checkAt`. */
export function runScene(inst: ScenarioInstance, steps: number, checkAt = DRIFT_CHECK_STEPS): { end: Snapshot; check?: Snapshot } {
  const f = inst.fluid;
  let check: Snapshot | undefined;
  for (let s = 0; s < steps; s++) {
    f.collideAndStream();
    inst.postStream();
    inst.onAfterStep(s);
    if (s + 1 === checkAt && checkAt < steps) check = { steps: checkAt, readouts: inst.diagnostics(checkAt) };
  }
  return { end: { steps, readouts: inst.diagnostics(steps) }, check };
}

export const val = (rows: Readout[], key: string) => rows.find((r) => r.label.startsWith(key))?.value ?? '';
export const num = (rows: Readout[], key: string) => {
  const s = val(rows, key);
  return s ? parseFloat(s.replace(/[^0-9eE.+-].*$/, '')) : NaN;
};
export const pair = (rows: Readout[], key: string) => val(rows, key).split('/').map((p) => parseFloat(p.trim()));

/** Percent change of a readout between the drift checkpoint and the end of the run. */
export function driftPct(r: { end: Snapshot; check?: Snapshot }, read: (rows: Readout[]) => number): number {
  if (!r.check) return NaN;
  const a = read(r.check.readouts);
  const b = read(r.end.readouts);
  return a ? (100 * (b - a)) / Math.abs(a) : NaN;
}

export function cli<J extends { id: string }>(
  name: string,
  jobs: J[],
  runJob: (job: J) => Record<string, unknown>,
  merge: (results: Map<string, Record<string, unknown>>) => void,
): void {
  const dir = `results/tables/.partials/${name}`;
  const [cmd, arg] = process.argv.slice(2);
  const doJob = (j: J) => {
    const t0 = Date.now();
    const out = runJob(j);
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${j.id}.json`, JSON.stringify(out));
    console.log(`${name}/${j.id} done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  };
  const doMerge = () => {
    const results = new Map<string, Record<string, unknown>>();
    const have = new Set(readdirSync(dir));
    const missing = jobs.filter((j) => !have.has(`${j.id}.json`)).map((j) => j.id);
    if (missing.length) throw new Error(`${name}: missing partials for ${missing.join(', ')}`);
    for (const j of jobs) results.set(j.id, JSON.parse(readFileSync(`${dir}/${j.id}.json`, 'utf8')));
    merge(results);
  };
  if (cmd === 'list') {
    for (const j of jobs) console.log(j.id);
  } else if (cmd === 'job') {
    const j = jobs.find((x) => x.id === arg);
    if (!j) throw new Error(`${name}: unknown job ${arg}`);
    doJob(j);
  } else if (cmd === 'merge') {
    doMerge();
  } else {
    jobs.forEach(doJob);
    doMerge();
  }
}

export function warnDrift(label: string, pct: number): string {
  if (Number.isFinite(pct) && Math.abs(pct) > DRIFT_TOL_PCT) {
    const msg = `WARNING ${label}: changed ${pct.toFixed(2)} % over the last ${(((DEFAULT_STEPS - DRIFT_CHECK_STEPS) * 0.173e-3)).toFixed(1)} s — not steady`;
    console.warn(msg);
    return msg;
  }
  return '';
}
