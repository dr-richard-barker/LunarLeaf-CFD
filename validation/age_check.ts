/**
 * Age-of-air check on the forced-airflow (VEGGIE-like) leaf scene.
 *
 * Sandberg's identity: in any statistically steady through-flow the flux-weighted
 * outlet age equals the nominal residence time τ = V / Q. A run that fails it is either
 * not converged or not conserving mass. Same check as the microgreen-chamber-cfd project
 * (templates/system/functions/age, validation/age_of_air.md).
 *
 *   npx esbuild validation/age_check.ts --bundle --format=esm --platform=node \
 *     --loader:.json=json --outfile=validation/age_check.mjs && node validation/age_check.mjs [forcedU] [t_end_s] [copy|pressure]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { makeLeafScene, leafGeometry, Readout } from '../src/scenarios/scenarios';

const DT_S = 0.173e-3;
const U = Number(process.argv[2] ?? 0.02);
const T_END = Number(process.argv[3] ?? 26);
const OUTLET = (process.argv[4] ?? 'copy') as 'copy' | 'pressure';
const steps = Math.round(T_END / DT_S);
const sample = Math.round(0.25 / DT_S);

const inst = makeLeafScene({
  id: 'age', label: 'age', gRatio: 0, nx: 128, ny: 96, renderScale: 0.12,
  geometry: leafGeometry, forcedU: U, ageOfAir: true, outletBC: OUTLET,
})();
const v = (d: Readout[], k: string) => parseFloat(d.find((r) => r.label.startsWith(k))?.value ?? 'NaN');

const rows = ['step,t_s,tau_steps,outlet_age_over_tau,mean_age_over_tau,eps_a,outlet_over_inlet_flux,dC_CO2_mean,g_bl'];
for (let s = 1; s <= steps; s++) {
  inst.fluid.collideAndStream();
  inst.postStream();
  inst.onAfterStep(s);
  if (s % sample === 0) {
    const d = inst.diagnostics(s);
    rows.push([s, (s * DT_S).toFixed(2), v(d, 'age τ'), v(d, 'age outlet'), v(d, 'age mean'), v(d, 'ε_a'), v(d, 'outlet / inlet'),
      parseFloat(d.find((r) => r.label.startsWith('ΔC CO₂'))!.value), v(d, 'g_bl')].join(','));
  }
}
mkdirSync('results/age', { recursive: true });
writeFileSync(`results/age/age_fan_U${U}_${OUTLET}.csv`, rows.join('\n') + '\n');
console.log(rows[0]);
for (const i of [1, 4, 20, 40, 60, rows.length - 1]) if (rows[i]) console.log(rows[i]);
