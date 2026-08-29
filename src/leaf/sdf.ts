/**
 * Signed distance to a closed polygon, plus the polygon morphometrics both tools
 * need from a leaf outline.
 *
 * NeuraLeaf represents its base shape as the zero level set of a learned 2D signed
 * distance function, f_θs(x, z_s) = 0. Once fitted, that level set is exported as a
 * polygon — but everything downstream still wants the *field*, not just the curve:
 * rasterising a leaf onto the LBM lattice is a sign test, and the mock scalar fields
 * in the AeroLeaf viewer want a smooth distance to fall off with. So we keep the SDF
 * form and evaluate it exactly from the polygon rather than approximately from pixels.
 *
 * Convention: negative inside, positive outside, zero on the boundary — matching the
 * paper and the usual SDF convention.
 */

import { Vec2 } from './types';

/**
 * Signed distance from (px, py) to the polygon, in the polygon's own units.
 * Negative inside. O(n) per query; the polygons here are a few hundred points.
 */
export function polygonSDF(poly: readonly Vec2[], px: number, py: number): number {
  const n = poly.length;
  if (n < 3) return Infinity;

  let minSq = Infinity;
  let inside = false;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [ax, ay] = poly[j];
    const [bx, by] = poly[i];

    // Distance to segment a→b.
    const ex = bx - ax;
    const ey = by - ay;
    const wx = px - ax;
    const wy = py - ay;
    const len2 = ex * ex + ey * ey;
    const t = len2 > 0 ? Math.max(0, Math.min(1, (wx * ex + wy * ey) / len2)) : 0;
    const dx = wx - t * ex;
    const dy = wy - t * ey;
    const sq = dx * dx + dy * dy;
    if (sq < minSq) minSq = sq;

    // Crossing-number parity: does a ray in +x cross this edge?
    if (ay > py !== by > py) {
      const xCross = ax + ((py - ay) / (by - ay)) * ex;
      if (px < xCross) inside = !inside;
    }
  }

  const d = Math.sqrt(minSq);
  return inside ? -d : d;
}

/** True when the point lies inside the polygon (boundary counts as outside). */
export function pointInPolygon(poly: readonly Vec2[], px: number, py: number): boolean {
  return polygonSDF(poly, px, py) < 0;
}

/** Signed area via the shoelace formula. Positive for a counter-clockwise winding. */
export function signedArea(poly: readonly Vec2[]): number {
  const n = poly.length;
  let a = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  }
  return a / 2;
}

export function polygonArea(poly: readonly Vec2[]): number {
  return Math.abs(signedArea(poly));
}

/** Closed perimeter, including the wrap-around edge from the last point to the first. */
export function polygonPerimeter(poly: readonly Vec2[]): number {
  const n = poly.length;
  let p = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    p += Math.hypot(poly[i][0] - poly[j][0], poly[i][1] - poly[j][1]);
  }
  return p;
}

/** Returns the polygon wound counter-clockwise, reversing a copy only if needed. */
export function ensureCCW(poly: readonly Vec2[]): Vec2[] {
  return signedArea(poly) < 0 ? [...poly].reverse() : [...poly];
}

/** Axis-aligned bounds as [minX, minY, maxX, maxY]. */
export function bounds(poly: readonly Vec2[]): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/**
 * Where the horizontal line y = yq cuts the polygon, as sorted x values.
 *
 * This is the chord query the loft needs: at each station along the midrib it asks
 * how wide the blade is there and where its two margins sit. Vertices lying exactly
 * on the line are handled by the half-open rule (ay > yq) !== (by > yq), which counts
 * each crossing once and so keeps the returned list even-length for a simple polygon.
 */
export function crossingsAtY(poly: readonly Vec2[], yq: number): number[] {
  const n = poly.length;
  const xs: number[] = [];
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [ax, ay] = poly[j];
    const [bx, by] = poly[i];
    if (ay > yq !== by > yq) {
      xs.push(ax + ((yq - ay) / (by - ay)) * (bx - ax));
    }
  }
  xs.sort((a, b) => a - b);
  return xs;
}
