import { Q, CX, CY, W, OPP, CS2, feq } from './d2q9';

/**
 * 2D incompressible-ish fluid solver, D2Q9 Lattice-Boltzmann with single-relaxation
 * (BGK) collision and halfway bounce-back walls.
 *
 * Boundary model
 * --------------
 * Solid cells (mask = 1) act as no-slip walls via halfway bounce-back. Each solid
 * cell carries a wall velocity (uwx, uwy); a static wall is simply uw = 0, while a
 * moving wall (e.g. the lid of a driven cavity) uses the standard momentum-corrected
 * bounce-back rule. Off-domain neighbours are treated as static walls. Inlet/outlet
 * conditions are applied by the scenario through the `postStream` hook.
 *
 * Forcing
 * -------
 * An optional per-cell body force (fx, fy) is integrated with the Guo (2002) scheme
 * and a half-force correction to the velocity. Milestone 1 flow benchmarks run with
 * no force; buoyancy (Boussinesq) will populate these arrays in Milestone 1's later
 * step and in the species coupling.
 *
 * All quantities are in lattice units (dx = dt = 1).
 */
export class LBMFluid {
  readonly nx: number;
  readonly ny: number;
  readonly size: number;
  tau: number;
  omega: number;

  f: Float32Array;
  ftmp: Float32Array;
  rho: Float32Array;
  ux: Float32Array;
  uy: Float32Array;

  /** 1 = solid (bounce-back wall), 0 = fluid. */
  solid: Uint8Array;
  /** Wall velocity for solid cells (used by moving walls; 0 for static). */
  uwx: Float32Array;
  uwy: Float32Array;

  /** Optional body force per cell; null disables the forcing branch entirely. */
  fx: Float32Array | null = null;
  fy: Float32Array | null = null;

  constructor(nx: number, ny: number, tau: number) {
    this.nx = nx;
    this.ny = ny;
    this.size = nx * ny;
    this.tau = tau;
    this.omega = 1 / tau;

    this.f = new Float32Array(Q * this.size);
    this.ftmp = new Float32Array(Q * this.size);
    this.rho = new Float32Array(this.size);
    this.ux = new Float32Array(this.size);
    this.uy = new Float32Array(this.size);
    this.solid = new Uint8Array(this.size);
    this.uwx = new Float32Array(this.size);
    this.uwy = new Float32Array(this.size);
  }

  setTau(tau: number): void {
    this.tau = tau;
    this.omega = 1 / tau;
  }

  index(x: number, y: number): number {
    return x + y * this.nx;
  }

  /** Enable the body-force arrays (allocates fx/fy). Idempotent. */
  enableForcing(): void {
    if (!this.fx) this.fx = new Float32Array(this.size);
    if (!this.fy) this.fy = new Float32Array(this.size);
  }

  /** Initialise every fluid cell to equilibrium at a uniform density and velocity. */
  setEquilibrium(rho0: number, ux0: number, uy0: number): void {
    for (let c = 0; c < this.size; c++) {
      this.rho[c] = rho0;
      this.ux[c] = ux0;
      this.uy[c] = uy0;
      const base = c * Q;
      for (let i = 0; i < Q; i++) this.f[base + i] = feq(i, rho0, ux0, uy0);
    }
  }

  /**
   * One timestep: fused macroscopic + BGK collision (with optional Guo forcing),
   * then push-streaming with bounce-back, then buffer swap.
   */
  collideAndStream(): void {
    const { nx, ny, f, omega, solid, fx, fy } = this;

    // --- collision (in place, f becomes post-collision) ---
    for (let c = 0; c < this.size; c++) {
      if (solid[c]) continue;
      const base = c * Q;

      let rho = 0;
      let mx = 0;
      let my = 0;
      for (let i = 0; i < Q; i++) {
        const fi = f[base + i];
        rho += fi;
        mx += CX[i] * fi;
        my += CY[i] * fi;
      }

      const Fx = fx ? fx[c] : 0;
      const Fy = fy ? fy[c] : 0;
      // Velocity includes the half-force correction (Guo scheme).
      const ux = (mx + 0.5 * Fx) / rho;
      const uy = (my + 0.5 * Fy) / rho;

      this.rho[c] = rho;
      this.ux[c] = ux;
      this.uy[c] = uy;

      const forceCoeff = 1 - 0.5 * omega;
      for (let i = 0; i < Q; i++) {
        const cix = CX[i];
        const ciy = CY[i];
        const eu = cix * ux + ciy * uy;
        const usq = ux * ux + uy * uy;
        const eqi = W[i] * rho * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * usq);

        let fi = f[base + i] - omega * (f[base + i] - eqi);

        if (fx || fy) {
          const gi =
            forceCoeff *
            W[i] *
            ((3 * (cix - ux) + 9 * eu * cix) * Fx +
              (3 * (ciy - uy) + 9 * eu * ciy) * Fy);
          fi += gi;
        }
        f[base + i] = fi;
      }
    }

    // --- streaming (push) with halfway bounce-back ---
    const ftmp = this.ftmp;
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const c = x + y * nx;
        if (solid[c]) continue;
        const base = c * Q;
        const rhoC = this.rho[c];

        for (let i = 0; i < Q; i++) {
          const xn = x + CX[i];
          const yn = y + CY[i];
          const fi = f[base + i];

          if (xn < 0 || xn >= nx || yn < 0 || yn >= ny) {
            // Off-domain: static wall bounce-back into the opposite slot of this cell.
            ftmp[base + OPP[i]] = fi;
            continue;
          }
          const n = xn + yn * nx;
          if (solid[n]) {
            // Moving/static wall bounce-back with momentum correction.
            const uwEu = CX[i] * this.uwx[n] + CY[i] * this.uwy[n];
            ftmp[base + OPP[i]] = fi - (2 * W[i] * rhoC * uwEu) / CS2;
          } else {
            ftmp[n * Q + i] = fi;
          }
        }
      }
    }

    // swap
    const tmp = this.f;
    this.f = this.ftmp;
    this.ftmp = tmp;
  }

  /** Recompute macroscopic fields from the current populations (for diagnostics/render). */
  computeMacroscopic(): void {
    const { f, solid, fx, fy } = this;
    for (let c = 0; c < this.size; c++) {
      if (solid[c]) {
        this.rho[c] = 1;
        this.ux[c] = 0;
        this.uy[c] = 0;
        continue;
      }
      const base = c * Q;
      let rho = 0;
      let mx = 0;
      let my = 0;
      for (let i = 0; i < Q; i++) {
        const fi = f[base + i];
        rho += fi;
        mx += CX[i] * fi;
        my += CY[i] * fi;
      }
      const Fx = fx ? fx[c] : 0;
      const Fy = fy ? fy[c] : 0;
      this.rho[c] = rho;
      this.ux[c] = (mx + 0.5 * Fx) / rho;
      this.uy[c] = (my + 0.5 * Fy) / rho;
    }
  }

  /** Speed |u| at a cell (call computeMacroscopic first for solid-safe values). */
  speed(c: number): number {
    return Math.hypot(this.ux[c], this.uy[c]);
  }

  /** Vorticity (∂uy/∂x − ∂ux/∂y) via central differences; 0 on the domain border. */
  vorticity(x: number, y: number): number {
    if (x <= 0 || x >= this.nx - 1 || y <= 0 || y >= this.ny - 1) return 0;
    const duy_dx = this.uy[this.index(x + 1, y)] - this.uy[this.index(x - 1, y)];
    const dux_dy = this.ux[this.index(x, y + 1)] - this.ux[this.index(x, y - 1)];
    return 0.5 * (duy_dx - dux_dy);
  }
}
