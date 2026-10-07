/**
 * Arclength resampling and piecewise-linear table lookup.
 *
 * Fitted outlines arrive with whatever point density the marching-squares contour of
 * the SDF happened to produce — dense on curvature, sparse on straights. Both the
 * loft grid and the "simplified" geometry option want a predictable point count, so
 * everything is re-parameterised by arclength before use.
 */

import { Vec2 } from './types';

/** Cumulative arclength along a polyline, length n; [0] is always 0. */
function cumulative(points: readonly Vec2[], closed: boolean): number[] {
  const n = points.length;
  const acc = new Array<number>(closed ? n + 1 : n);
  acc[0] = 0;
  for (let i = 1; i < n; i++) {
    acc[i] = acc[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  if (closed) {
    acc[n] = acc[n - 1] + Math.hypot(points[0][0] - points[n - 1][0], points[0][1] - points[n - 1][1]);
  }
  return acc;
}

function lerp2(a: Vec2, b: Vec2, t: number): Vec2 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Resample a closed polygon to exactly `n` points, evenly spaced by arclength.
 * The first point stays put so the result keeps the original's starting corner.
 */
export function resampleClosed(poly: readonly Vec2[], n: number): Vec2[] {
  if (poly.length < 3 || n < 3) return [...poly];
  const acc = cumulative(poly, true);
  const total = acc[poly.length];
  if (!(total > 0)) return [...poly];

  const out: Vec2[] = [];
  let seg = 0;
  for (let k = 0; k < n; k++) {
    const target = (total * k) / n;
    while (seg < poly.length - 1 && acc[seg + 1] < target) seg++;
    const a = poly[seg];
    const b = poly[(seg + 1) % poly.length];
    const span = acc[seg + 1] - acc[seg];
    out.push(span > 0 ? lerp2(a, b, (target - acc[seg]) / span) : a);
  }
  return out;
}

/** Resample an open polyline to exactly `n` points, endpoints preserved. */
export function resampleOpen(line: readonly Vec2[], n: number): Vec2[] {
  if (line.length < 2 || n < 2) return [...line];
  const acc = cumulative(line, false);
  const total = acc[line.length - 1];
  if (!(total > 0)) return [...line];

  const out: Vec2[] = [];
  let seg = 0;
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    while (seg < line.length - 2 && acc[seg + 1] < target) seg++;
    const span = acc[seg + 1] - acc[seg];
    out.push(span > 0 ? lerp2(line[seg], line[seg + 1], (target - acc[seg]) / span) : line[seg]);
  }
  return out;
}

/** Total arclength of an open polyline. */
export function polylineLength(line: readonly Vec2[]): number {
  const acc = cumulative(line, false);
  return acc[line.length - 1] ?? 0;
}

/**
 * Piecewise-linear lookup into a [key, value] table, clamped at both ends.
 * Used for the `profile` (s → midrib height) and `camber` (t → cupping) tables,
 * which are stored as short control-point lists rather than dense curves.
 */
export function sampleTable(table: readonly Vec2[], key: number): number {
  const n = table.length;
  if (n === 0) return 0;
  if (key <= table[0][0]) return table[0][1];
  if (key >= table[n - 1][0]) return table[n - 1][1];
  for (let i = 1; i < n; i++) {
    const [k1, v1] = table[i];
    if (key <= k1) {
      const [k0, v0] = table[i - 1];
      const span = k1 - k0;
      return span > 0 ? v0 + ((key - k0) / span) * (v1 - v0) : v1;
    }
  }
  return table[n - 1][1];
}
