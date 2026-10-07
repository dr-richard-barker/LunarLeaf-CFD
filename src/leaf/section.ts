/**
 * Cross-sections through a lofted leaf.
 *
 * The 2D solver in this repo runs a *vertical slice*: lattice x is horizontal, lattice
 * y is vertical, and gravity points along -y. So what it needs from a leaf is not the
 * top-down silhouette — that is the wrong plane entirely — but a cut through the blade
 * showing its curvature and thickness edge-on. The flat ellipse it used before
 * (a = 26, b = 4 cells) is exactly such a cut, just of a perfectly flat leaf.
 *
 * Two cuts are useful and they answer different questions:
 *
 *   transverse  — across the blade at one station along the midrib. A cupped or
 *                 curling leaf shows up here as a U, which is the geometry that traps
 *                 air under the blade and thickens the boundary layer. This is the
 *                 interesting one for the curl sweep.
 *   longitudinal — along the midrib. Shows arch and droop, and reduces to the old
 *                 ellipse for a flat leaf, which makes it the like-for-like
 *                 replacement when comparing against the published calibration.
 *
 * Both are computed from the structured loft grid rather than by slicing triangles,
 * so there is no segment-chaining step to get wrong on degenerate rows.
 */

import { LoftResult } from './loft';
import { Vec2 } from './types';

export interface Section {
  /** Closed polygon in the cut plane, millimetres, counter-clockwise. */
  polygon: Vec2[];
  /** Extent along the in-plane horizontal axis (y for transverse is x; see each fn). */
  chordMm: number;
  /** Greatest vertical extent of the section. */
  heightMm: number;
}

function measure(polygon: Vec2[]): Section {
  let minA = Infinity;
  let maxA = -Infinity;
  let minB = Infinity;
  let maxB = -Infinity;
  for (const [a, b] of polygon) {
    if (a < minA) minA = a;
    if (a > maxA) maxA = a;
    if (b < minB) minB = b;
    if (b > maxB) maxB = b;
  }
  return {
    polygon,
    chordMm: polygon.length ? maxA - minA : 0,
    heightMm: polygon.length ? maxB - minB : 0,
  };
}

/**
 * Cut across the blade at midrib station `y0`, returning (x, z) in millimetres.
 * Defaults to the widest chord, which is where cupping and curl are most developed.
 */
export function transverseSection(result: LoftResult, y0?: number): Section {
  const { grid } = result;
  const { nu, nv, y, top, bottom, halfWidth } = grid;

  let station = y0;
  if (station === undefined) {
    let jWidest = 0;
    for (let j = 1; j < nv; j++) if (halfWidth[j] > halfWidth[jWidest]) jWidest = j;
    station = y[jWidest];
  }

  // Bracket the requested station between two grid rows and blend them.
  let j0 = 0;
  while (j0 < nv - 2 && y[j0 + 1] < station) j0++;
  const j1 = Math.min(nv - 1, j0 + 1);
  const span = y[j1] - y[j0];
  const w = span > 0 ? Math.min(1, Math.max(0, (station - y[j0]) / span)) : 0;

  const blend = (sheet: Float64Array, i: number, k: number) => {
    const a = sheet[(j0 * nu + i) * 3 + k];
    const b = sheet[(j1 * nu + i) * 3 + k];
    return a + (b - a) * w;
  };

  const upper: Vec2[] = [];
  const lower: Vec2[] = [];
  for (let i = 0; i < nu; i++) {
    upper.push([blend(top, i, 0), blend(top, i, 2)]);
    lower.push([blend(bottom, i, 0), blend(bottom, i, 2)]);
  }
  // Left margin → right along the top, back along the bottom: a closed loop.
  return measure([...upper, ...lower.reverse()]);
}

/**
 * Cut along the midrib at transverse offset `x0` (default 0, through the midrib),
 * returning (y, z) in millimetres.
 *
 * Each row of the loft grid runs from the left margin to the right margin, so the
 * cut is found by scanning that row for the pair of samples straddling x0 and
 * interpolating. Rows the plane misses — beyond the blade near the tip and base —
 * are dropped, and only rows where both sheets cross are kept so the loop closes.
 */
export function longitudinalSection(result: LoftResult, x0 = 0): Section {
  const { grid } = result;
  const { nu, nv, top, bottom } = grid;

  const crossRow = (sheet: Float64Array, j: number): Vec2 | null => {
    for (let i = 0; i < nu - 1; i++) {
      const xa = sheet[(j * nu + i) * 3];
      const xb = sheet[(j * nu + i + 1) * 3];
      if (xa === xb) continue;
      if (xa > x0 !== xb > x0) {
        const t = (x0 - xa) / (xb - xa);
        const ya = sheet[(j * nu + i) * 3 + 1];
        const yb = sheet[(j * nu + i + 1) * 3 + 1];
        const za = sheet[(j * nu + i) * 3 + 2];
        const zb = sheet[(j * nu + i + 1) * 3 + 2];
        return [ya + (yb - ya) * t, za + (zb - za) * t];
      }
    }
    return null;
  };

  const upper: Vec2[] = [];
  const lower: Vec2[] = [];
  for (let j = 0; j < nv; j++) {
    const t = crossRow(top, j);
    const b = crossRow(bottom, j);
    if (t && b) {
      upper.push(t);
      lower.push(b);
    }
  }
  if (upper.length < 2) return { polygon: [], chordMm: 0, heightMm: 0 };

  return measure([...upper, ...lower.reverse()]);
}
