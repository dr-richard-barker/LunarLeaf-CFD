/**
 * Reference solution for the lid-driven cavity, Re = 100, from:
 *   U. Ghia, K.N. Ghia, C.T. Shin (1982), "High-Re solutions for incompressible
 *   flow using the Navier–Stokes equations and a multigrid method",
 *   J. Comput. Phys. 48, 387–411.
 *
 * u is the horizontal velocity along the vertical centreline (x = 0.5),
 * normalised by the lid speed. v is the vertical velocity along the horizontal
 * centreline (y = 0.5). Used as validation gate 1: the solver must reproduce
 * these within a small L2 error.
 */
export const GHIA_RE100 = {
  Re: 100,
  // vertical centreline: y (0..1) and u/U_lid
  yU: [
    0.0, 0.0547, 0.0625, 0.0703, 0.1016, 0.1719, 0.2813, 0.4531, 0.5, 0.6172,
    0.7344, 0.8516, 0.9531, 0.9609, 0.9688, 0.9766, 1.0,
  ],
  u: [
    0.0, -0.03717, -0.04192, -0.04775, -0.06434, -0.1015, -0.15662, -0.2109,
    -0.20581, -0.13641, 0.00332, 0.23151, 0.68717, 0.73722, 0.78871, 0.84123,
    1.0,
  ],
  // horizontal centreline: x (0..1) and v/U_lid
  xV: [
    0.0, 0.0625, 0.0703, 0.0781, 0.0938, 0.1563, 0.2266, 0.2344, 0.5, 0.8047,
    0.8594, 0.9063, 0.9453, 0.9531, 0.9609, 0.9688, 1.0,
  ],
  v: [
    0.0, 0.09233, 0.10091, 0.1089, 0.12317, 0.16077, 0.17507, 0.17527, 0.05454,
    -0.24533, -0.22445, -0.16914, -0.10313, -0.08864, -0.07391, -0.05906, 0.0,
  ],
} as const;

/** Linear interpolation of a sampled series at a query point. */
export function lerpSample(xs: readonly number[], ys: readonly number[], x: number): number {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
      return ys[i - 1] + t * (ys[i] - ys[i - 1]);
    }
  }
  return ys[ys.length - 1];
}

/**
 * L2 error between a modelled centreline profile and the Ghia reference,
 * evaluated at the reference sample points. `sampleU(y)` and `sampleV(x)` return
 * the model's normalised velocities.
 */
export function ghiaL2Error(
  sampleU: (y: number) => number,
  sampleV: (x: number) => number,
): number {
  let sq = 0;
  let n = 0;
  for (let i = 0; i < GHIA_RE100.yU.length; i++) {
    const d = sampleU(GHIA_RE100.yU[i]) - GHIA_RE100.u[i];
    sq += d * d;
    n++;
  }
  for (let i = 0; i < GHIA_RE100.xV.length; i++) {
    const d = sampleV(GHIA_RE100.xV[i]) - GHIA_RE100.v[i];
    sq += d * d;
    n++;
  }
  return Math.sqrt(sq / n);
}
