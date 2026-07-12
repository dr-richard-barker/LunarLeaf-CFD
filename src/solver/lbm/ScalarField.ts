import { LBMFluid } from './LBMFluid';

/**
 * Advection–diffusion of a passive scalar (a gas species concentration such as
 * CO2, O2 or H2O vapour) on a D2Q5 lattice, advected by the fluid velocity.
 *
 *   ∂C/∂t + u·∇C = D ∇²C + S
 *
 * The diffusivity D is set through the relaxation time: D = cs² (tauC − 1/2)
 * with cs² = 1/3 for this D2Q5 set (weights 1/3, 1/6×4). Solid cells default to
 * a zero-flux (Neumann) wall via bounce-back; a leaf surface source/sink is
 * applied as a per-cell source term S (Milestone 1 biology coupling).
 *
 * This module is wired but not yet attached to a validation scenario — the
 * pure-diffusion (u = 0) error-function check (validation gate 4) is the next
 * step on top of it.
 */

// D2Q5 velocities: rest, +x, +y, -x, -y
const CX5 = new Int8Array([0, 1, 0, -1, 0]);
const CY5 = new Int8Array([0, 0, 1, 0, -1]);
const W5 = new Float64Array([1 / 3, 1 / 6, 1 / 6, 1 / 6, 1 / 6]);
const OPP5 = new Uint8Array([0, 3, 4, 1, 2]);
const CS2_5 = 1 / 3;
const Q5 = 5;

export function tauFromDiffusivity(D: number): number {
  return D / CS2_5 + 0.5;
}

export class ScalarField {
  readonly fluid: LBMFluid;
  readonly size: number;
  tauC: number;
  omegaC: number;

  g: Float32Array;
  gtmp: Float32Array;
  /** Concentration field (macroscopic). */
  C: Float32Array;
  /** Optional per-cell source/sink (e.g. stomatal flux). null disables the branch. */
  source: Float32Array | null = null;

  constructor(fluid: LBMFluid, diffusivity: number, initialC = 0) {
    this.fluid = fluid;
    this.size = fluid.size;
    this.tauC = tauFromDiffusivity(diffusivity);
    this.omegaC = 1 / this.tauC;
    this.g = new Float32Array(Q5 * this.size);
    this.gtmp = new Float32Array(Q5 * this.size);
    this.C = new Float32Array(this.size).fill(initialC);
    this.setEquilibrium(initialC);
  }

  setDiffusivity(D: number): void {
    this.tauC = tauFromDiffusivity(D);
    this.omegaC = 1 / this.tauC;
  }

  enableSource(): void {
    if (!this.source) this.source = new Float32Array(this.size);
  }

  /**
   * Per-solid-cell Dirichlet value. NaN → the wall stays zero-flux (Neumann /
   * adiabatic). A finite value pins the concentration at the wall midpoint via
   * anti-bounce-back (e.g. hot/cold walls, or a fixed ambient boundary).
   */
  dirichlet: Float32Array | null = null;

  setDirichlet(cell: number, value: number): void {
    if (!this.dirichlet) this.dirichlet = new Float32Array(this.size).fill(NaN);
    this.dirichlet[cell] = value;
  }

  private feq5(i: number, C: number, ux: number, uy: number): number {
    const eu = CX5[i] * ux + CY5[i] * uy;
    return W5[i] * C * (1 + eu / CS2_5);
  }

  setEquilibrium(C0: number): void {
    for (let c = 0; c < this.size; c++) {
      this.C[c] = C0;
      const base = c * Q5;
      for (let i = 0; i < Q5; i++) this.g[base + i] = this.feq5(i, C0, 0, 0);
    }
  }

  /** Initialise the concentration from a spatial function C0(x, y) (u = 0). */
  initField(fn: (x: number, y: number) => number): void {
    const nx = this.fluid.nx;
    for (let c = 0; c < this.size; c++) {
      const x = c % nx;
      const y = (c / nx) | 0;
      const C0 = fn(x, y);
      this.C[c] = C0;
      const base = c * Q5;
      for (let i = 0; i < Q5; i++) this.g[base + i] = this.feq5(i, C0, 0, 0);
    }
  }

  /** One advection–diffusion step using the fluid's current velocity field. */
  step(): void {
    const { fluid, size, omegaC, source } = this;
    const { nx, ny, solid, ux, uy } = fluid;
    const g = this.g;

    // collision
    for (let c = 0; c < size; c++) {
      if (solid[c]) continue;
      const base = c * Q5;
      let C = 0;
      for (let i = 0; i < Q5; i++) C += g[base + i];
      const S = source ? source[c] : 0;
      C += 0.5 * S; // half-source correction
      this.C[c] = C;

      const vx = ux[c];
      const vy = uy[c];
      for (let i = 0; i < Q5; i++) {
        const eqi = this.feq5(i, C, vx, vy);
        let gi = g[base + i] - omegaC * (g[base + i] - eqi);
        if (source) gi += (1 - 0.5 * omegaC) * W5[i] * S;
        g[base + i] = gi;
      }
    }

    // streaming: bounce-back (zero-flux) or anti-bounce-back (Dirichlet) at walls
    const gtmp = this.gtmp;
    const dir = this.dirichlet;
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const c = x + y * nx;
        if (solid[c]) continue;
        const base = c * Q5;
        for (let i = 0; i < Q5; i++) {
          const xn = x + CX5[i];
          const yn = y + CY5[i];
          const gi = g[base + i];
          if (xn < 0 || xn >= nx || yn < 0 || yn >= ny) {
            gtmp[base + OPP5[i]] = gi; // domain border: zero-flux
            continue;
          }
          const n = xn + yn * nx;
          if (solid[n]) {
            const cw = dir ? dir[n] : NaN;
            if (!Number.isNaN(cw)) {
              // Dirichlet wall (u_wall = 0): impose C = cw at the wall midpoint.
              gtmp[base + OPP5[i]] = -gi + 2 * W5[i] * cw;
            } else {
              gtmp[base + OPP5[i]] = gi; // adiabatic / zero-flux
            }
          } else {
            gtmp[n * Q5 + i] = gi;
          }
        }
      }
    }

    const tmp = this.g;
    this.g = this.gtmp;
    this.gtmp = tmp;
  }
}
