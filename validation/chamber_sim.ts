// Closed-chamber accumulation check: a central source in a sealed (zero-flux)
// box. Demonstrates that the solver reproduces monotonic closed-chamber gas
// build-up (as in the Vernier trace) and conserves mass exactly. Pure diffusion
// (fluid at rest) — the unambiguous transport/conservation case; buoyancy would
// only speed the mixing.
import { writeFileSync } from 'node:fs';
import { LBMFluid } from '../src/solver/lbm/LBMFluid';
import { ScalarField } from '../src/solver/lbm/ScalarField';
import { tauFromViscosity } from '../src/solver/lbm/d2q9';

const nx = 100;
const ny = 100;
const S = 5e-4;
const fluid = new LBMFluid(nx, ny, tauFromViscosity(1 / 6));
fluid.setEquilibrium(1, 0, 0); // at rest → pure diffusion

// Sealed walls: solid border, NO Dirichlet → zero-flux (nothing escapes).
for (let x = 0; x < nx; x++)
  for (let y = 0; y < ny; y++)
    if (x === 0 || x === nx - 1 || y === 0 || y === ny - 1) fluid.solid[fluid.index(x, y)] = 1;

const gas = new ScalarField(fluid, 0.05, 0);
gas.enableSource();

// Central "leaf" patch as the source.
let nSrc = 0;
const cx = nx / 2;
const cy = ny / 2;
for (let x = 1; x < nx - 1; x++)
  for (let y = 1; y < ny - 1; y++)
    if (((x - cx) / 12) ** 2 + ((y - cy) / 4) ** 2 <= 1) {
      gas.source![fluid.index(x, y)] = S;
      nSrc++;
    }

const cornerCell = fluid.index(2, 2);
const centreCell = fluid.index(Math.round(cx), Math.round(cy) + 6);
const rows = ['step,total_mass,centre_conc,corner_conc,expected_total'];
const STEPS = 40000;
for (let s = 0; s <= STEPS; s++) {
  if (s % 500 === 0) {
    let total = 0;
    for (let c = 0; c < fluid.size; c++) if (!fluid.solid[c]) total += gas.C[c];
    rows.push(
      [s, total.toFixed(4), gas.C[centreCell].toFixed(5), gas.C[cornerCell].toFixed(5), (nSrc * S * s).toFixed(4)].join(','),
    );
  }
  gas.step();
}
writeFileSync('results/tables/T4_chamber_accumulation.csv', rows.join('\n') + '\n');
// Conservation check: total mass vs analytic (nSrc*S*step).
let total = 0;
for (let c = 0; c < fluid.size; c++) if (!fluid.solid[c]) total += gas.C[c];
const expected = nSrc * S * STEPS;
console.log(`nSrc=${nSrc}  total=${total.toFixed(3)}  expected=${expected.toFixed(3)}  ` +
  `rel.err=${(Math.abs(total - expected) / expected).toExponential(2)}`);
console.log('wrote T4_chamber_accumulation.csv');
