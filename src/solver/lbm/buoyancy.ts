import { LBMFluid } from './LBMFluid';
import { ScalarField } from './ScalarField';

/**
 * Gravity presets (m/s²) — the vector magnitude the user selects. The *direction*
 * is conventionally downward (−y) in these 2D scenes.
 */
export const GRAVITY = {
  microgravity: 0.0,
  moon: 1.62,
  mars: 3.71,
  earth: 9.81,
} as const;

export type GravityBody = keyof typeof GRAVITY;

/**
 * Apply a Boussinesq buoyancy body force to the fluid from one or more scalar
 * fields (temperature and/or species), driven by a gravity vector.
 *
 *   f_b = ρ · g · Σ_k β_k (C_k − C_k,0)
 *
 * With g = 0 (microgravity) the force vanishes and transport reduces to pure
 * diffusion + any forced advection — the collapse of natural convection that is
 * the scientific heart of this project. `gLattice` is gravity already converted
 * to lattice units by the scenario's unit system.
 *
 * `gx, gy` is the (already-scaled) gravity acceleration in lattice units; each
 * contributor supplies its field, its expansion coefficient β, and its reference
 * value C0.
 */
export interface BuoyancyContributor {
  field: ScalarField;
  beta: number;
  ref: number;
}

export function applyBoussinesqForce(
  fluid: LBMFluid,
  gx: number,
  gy: number,
  contributors: BuoyancyContributor[],
): void {
  fluid.enableForcing();
  const fx = fluid.fx!;
  const fy = fluid.fy!;
  const { size, solid, rho } = fluid;

  for (let c = 0; c < size; c++) {
    if (solid[c]) {
      fx[c] = 0;
      fy[c] = 0;
      continue;
    }
    let expansion = 0;
    for (let k = 0; k < contributors.length; k++) {
      const ct = contributors[k];
      expansion += ct.beta * (ct.field.C[c] - ct.ref);
    }
    const factor = rho[c] * expansion;
    fx[c] = gx * factor;
    fy[c] = gy * factor;
  }
}
