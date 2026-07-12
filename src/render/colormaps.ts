/** Colormaps returning [r,g,b] in 0..255. Inputs are clamped internally. */

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Compact viridis-like sequential map for magnitude fields (t in 0..1). */
export function viridis(t: number): [number, number, number] {
  t = clamp01(t);
  // Piecewise fit through viridis anchor colours.
  const stops: [number, number, number, number][] = [
    [0.0, 68, 1, 84],
    [0.25, 59, 82, 139],
    [0.5, 33, 145, 140],
    [0.75, 94, 201, 98],
    [1.0, 253, 231, 37],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, r0, g0, b0] = stops[i - 1];
      const [t1, r1, g1, b1] = stops[i];
      const f = (t - t0) / (t1 - t0);
      return [r0 + f * (r1 - r0), g0 + f * (g1 - g0), b0 + f * (b1 - b0)];
    }
  }
  return [253, 231, 37];
}

/** Diverging blue–white–red map for signed fields (t in −1..1). */
export function diverging(t: number): [number, number, number] {
  t = t < -1 ? -1 : t > 1 ? 1 : t;
  if (t < 0) {
    const f = t + 1; // 0..1 from blue→white
    return [30 + f * 225, 60 + f * 195, 160 + f * 95];
  }
  const f = t; // 0..1 white→red
  return [255 - f * 30, 255 - f * 210, 255 - f * 205];
}
