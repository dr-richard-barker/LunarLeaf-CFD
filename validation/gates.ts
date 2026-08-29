/**
 * Headless runner for the four textbook validation gates.
 *
 * The gates have always been checkable in the UI, one scenario at a time, by watching
 * a readout turn green. That is fine for a demo and useless as a regression test — so
 * this runs all four to convergence and exits non-zero if any is off target. Run it
 * after touching anything the solver reaches: geometry rasterisation, boundary
 * conditions, the scalar transport, or the buoyancy coupling.
 *
 *   npx esbuild validation/gates.ts --bundle --format=esm --platform=node \
 *     --loader:.json=json --outfile=validation/gates.mjs && node validation/gates.mjs
 *
 * Gate 1  lid-driven cavity      Ghia et al. (1982), Re 100     L2 < 0.05
 * Gate 2  flow past a cylinder   Strouhal, Re 100, 17% blockage 0.16–0.22
 * Gate 3  differentially heated  de Vahl Davis (1983), Ra 1e4   Nu ≈ 2.24
 * Gate 4  pure diffusion         erfc similarity solution       L2 < 0.02
 */

import { Readout, SCENARIOS } from '../src/scenarios/scenarios';

interface GateSpec {
  id: string;
  steps: number;
  /** Readout label prefix carrying the measured number. */
  metric: string;
  min: number;
  max: number;
}

const GATES: GateSpec[] = [
  { id: 'cavity', steps: 8000, metric: 'Ghia L2 error', min: 0, max: 0.05 },
  { id: 'cylinder', steps: 26000, metric: 'Strouhal', min: 0.16, max: 0.22 },
  { id: 'natconv', steps: 30000, metric: 'Nu (hot wall)', min: 2.1, max: 2.4 },
  { id: 'diffusion', steps: 1200, metric: 'erfc L2 error', min: 0, max: 0.02 },
];

const read = (rows: Readout[], key: string): Readout | undefined =>
  rows.find((r) => r.label.startsWith(key));

let failures = 0;

for (const gate of GATES) {
  const def = SCENARIOS.find((s) => s.id === gate.id);
  if (!def) {
    console.log(`  FAIL  ${gate.id}: scenario not found`);
    failures++;
    continue;
  }

  const instance = def.build();
  for (let step = 0; step < gate.steps; step++) {
    instance.fluid.collideAndStream();
    instance.postStream();
    instance.onAfterStep(step);
  }

  const rows = instance.diagnostics(gate.steps);
  const metric = read(rows, gate.metric);
  const verdict = read(rows, 'Gate');
  const value = metric ? parseFloat(metric.value) : NaN;
  const ok = Number.isFinite(value) && value >= gate.min && value <= gate.max;

  if (!ok) failures++;
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${def.label}: ${gate.metric} = ${metric?.value ?? 'n/a'} ` +
      `(want ${gate.min}–${gate.max}) · ${verdict?.value ?? ''}`,
  );
}

console.log(failures === 0 ? '\nAll validation gates passed.\n' : `\n${failures} gate(s) FAILED.\n`);
if (failures > 0) process.exit(1);
