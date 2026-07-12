/**
 * Dimensionless numbers reported for every run. All inputs are in a single
 * consistent unit system (the scenario passes lattice units, which is fine since
 * these groups are ratios).
 */
export interface Dimensionless {
  Re: number; // Reynolds  = U L / nu
  Gr: number; // Grashof   = g beta dC L^3 / nu^2   (buoyancy vs viscous)
  Ra: number; // Rayleigh  = Gr * Sc                (onset of natural convection)
  Pe: number; // Peclet    = U L / D               (advection vs diffusion)
  Sc: number; // Schmidt   = nu / D
}

export function reynolds(u: number, length: number, nu: number): number {
  return (u * length) / nu;
}

export function grashof(
  g: number,
  beta: number,
  deltaC: number,
  length: number,
  nu: number,
): number {
  return (g * beta * deltaC * length ** 3) / (nu * nu);
}

export function peclet(u: number, length: number, D: number): number {
  return (u * length) / D;
}

export function computeDimensionless(params: {
  u: number;
  length: number;
  nu: number;
  D?: number;
  g?: number;
  beta?: number;
  deltaC?: number;
}): Dimensionless {
  const { u, length, nu } = params;
  const D = params.D ?? nu; // default Sc = 1
  const g = params.g ?? 0;
  const beta = params.beta ?? 0;
  const deltaC = params.deltaC ?? 0;
  const Sc = nu / D;
  const Gr = grashof(g, beta, deltaC, length, nu);
  return {
    Re: reynolds(u, length, nu),
    Gr,
    Ra: Gr * Sc,
    Pe: peclet(u, length, D),
    Sc,
  };
}
