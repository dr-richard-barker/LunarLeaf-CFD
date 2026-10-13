/**
 * Identity check for the MRT collision: with every relaxation rate set to the BGK
 * rate (and the conserved moments' rates irrelevant), MRT must reproduce BGK to
 * round-off, with and without a body force. This tests the moment matrix, its
 * inverse and the moment-space Guo forcing in one go.
 *
 *   npx esbuild validation/mrt_check.ts --bundle --format=esm --platform=node \
 *     --outfile=validation/mrt_check.mjs && node validation/mrt_check.mjs
 */
import { LBMFluid } from '../src/solver/lbm/LBMFluid';

function makeFluid(collision: 'bgk' | 'mrt', forced: boolean, tau: number): LBMFluid {
  const nx = 24, ny = 18;
  const f = new LBMFluid(nx, ny, tau);
  f.collision = collision;
  const omega = 1 / tau;
  f.mrtRates = { se: omega, seps: omega, sq: omega };
  // deterministic pseudo-random, smooth initial state
  f.setEquilibrium(1, 0, 0);
  for (let c = 0; c < f.size; c++) {
    for (let i = 0; i < 9; i++) f.f[c * 9 + i] *= 1 + 0.02 * Math.sin(0.7 * c + 1.3 * i);
  }
  for (let x = 0; x < nx; x++) { f.solid[f.index(x, 0)] = 1; f.solid[f.index(x, ny - 1)] = 1; }
  if (forced) {
    f.enableForcing();
    for (let c = 0; c < f.size; c++) { f.fx![c] = 1e-5 * Math.cos(0.3 * c); f.fy![c] = -2e-5 * Math.sin(0.2 * c); }
  }
  return f;
}

let failures = 0;
for (const forced of [false, true]) {
  for (const tau of [0.55, 0.8, 1.2]) {
    const a = makeFluid('bgk', forced, tau);
    const b = makeFluid('mrt', forced, tau);
    for (let s = 0; s < 200; s++) { a.collideAndStream(); b.collideAndStream(); }
    let maxd = 0;
    for (let k = 0; k < a.f.length; k++) maxd = Math.max(maxd, Math.abs(a.f[k] - b.f[k]));
    const ok = maxd < 1e-5;   // Float32 populations; 200 steps of round-off
    if (!ok) failures++;
    console.log(`${forced ? 'forced  ' : 'unforced'} tau=${tau}: max |f_BGK - f_MRT| = ${maxd.toExponential(2)} ${ok ? 'PASS' : 'FAIL'}`);
  }
}
// Negative control: with the default MRT rates the result must differ from BGK,
// otherwise the MRT branch is not running.
{
  const a = makeFluid('bgk', true, 0.8);
  const b = makeFluid('mrt', true, 0.8);
  b.mrtRates = { se: 1.64, seps: 1.54, sq: null };
  for (let s = 0; s < 200; s++) { a.collideAndStream(); b.collideAndStream(); }
  let maxd = 0;
  for (let k = 0; k < a.f.length; k++) maxd = Math.max(maxd, Math.abs(a.f[k] - b.f[k]));
  const ok = maxd > 1e-6;
  if (!ok) failures++;
  console.log(`control (default MRT rates differ from BGK): max diff ${maxd.toExponential(2)} ${ok ? 'PASS' : 'FAIL'}`);
}
process.exit(failures ? 1 : 0);
