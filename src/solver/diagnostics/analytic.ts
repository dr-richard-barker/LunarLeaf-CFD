/**
 * Analytic reference solutions used by the validation gates.
 */

/** Error function (Abramowitz & Stegun 7.1.26; |error| < 1.5e-7). */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

export function erfc(x: number): number {
  return 1 - erf(x);
}

/**
 * 1-D diffusion of an initial step (C = Cleft for x < x0, Cright for x > x0) in
 * an unbounded medium — used for validation gate 4:
 *
 *   C(x, t) = Cright + (Cleft − Cright) · ½ erfc( (x − x0) / (2√(D t)) )
 *
 * Valid while the diffusion front has not reached the reflecting domain walls.
 */
export function diffusionStep(
  x: number,
  t: number,
  D: number,
  x0: number,
  cLeft: number,
  cRight: number,
): number {
  if (t <= 0) return x < x0 ? cLeft : cRight;
  const arg = (x - x0) / (2 * Math.sqrt(D * t));
  return cRight + (cLeft - cRight) * 0.5 * erfc(arg);
}
