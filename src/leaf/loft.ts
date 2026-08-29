/**
 * Loft a flattened leaf outline into a posed, solid 3D blade.
 *
 * This is our own implementation of the reconstruction half of NeuraLeaf's
 * shape/deformation split: the asset carries a 2D base shape (outline + midrib) and
 * a deformation (midrib profile + transverse camber), and the loft puts them back
 * together into the surface the fitted leaf actually had. NeuraLeaf does this with
 * skeleton-free blend skinning over ~1000 UV control points; we do it with an
 * explicit structured sweep, which is enough because the fit has already been done
 * offline and we only need to *evaluate* the pose, not learn it — and because a
 * structured grid gives us exact, robust cross-sections (see section.ts) that a
 * triangle-soup slicer would have to work for.
 *
 * The result is a closed shell: a top sheet, a bottom sheet offset along the surface
 * normal by the blade thickness, and a rim stitching their boundaries. Closed matters
 * because the LBM rasteriser fills the interior by a sign test.
 */

import { DeformParams, LeafAsset, NEUTRAL_DEFORM, Vec2 } from './types';
import { bounds, crossingsAtY, ensureCCW } from './sdf';
import { polylineLength, sampleTable } from './resample';

export interface LoftOptions {
  /** Points across the blade, margin to margin. Odd values put a row on the midrib. */
  nu: number;
  /** Stations along the midrib, base to tip. */
  nv: number;
}

export const DEFAULT_LOFT: LoftOptions = { nu: 25, nv: 61 };

export interface Mesh {
  /** Packed xyz, millimetres. */
  vertices: Float64Array;
  /** Packed per-vertex normals, unit length. */
  normals: Float64Array;
  /** Packed triangle vertex indices. */
  faces: Uint32Array;
}

/**
 * The structured sweep behind the mesh. Kept alongside it because the 2D solver
 * slices this rather than the triangles.
 */
export interface LoftGrid {
  nu: number;
  nv: number;
  /** Midrib y station of each row, millimetres. Length nv. */
  y: Float64Array;
  /** Midrib x of each row (leaves are rarely perfectly straight). Length nv. */
  xMid: Float64Array;
  /** Half-width of the blade at each row. Length nv. */
  halfWidth: Float64Array;
  /** Top sheet, packed xyz row-major as [(j * nu + i) * 3]. */
  top: Float64Array;
  /** Bottom sheet, same layout. */
  bottom: Float64Array;
}

export interface LoftResult {
  grid: LoftGrid;
  mesh: Mesh;
  /** Midrib arclength used to scale the length-relative deform knobs. */
  lengthMm: number;
  /** Widest half-chord, the reference the camber table is expressed at. */
  halfWidthMaxMm: number;
}

/** Midrib x at a given y, by linear interpolation along the midrib polyline. */
function midribXAt(midrib: readonly Vec2[], y: number): number {
  const n = midrib.length;
  if (n === 0) return 0;
  if (n === 1) return midrib[0][0];
  if (y <= midrib[0][1]) return midrib[0][0];
  if (y >= midrib[n - 1][1]) return midrib[n - 1][0];
  for (let i = 1; i < n; i++) {
    if (y <= midrib[i][1]) {
      const span = midrib[i][1] - midrib[i - 1][1];
      const t = span > 0 ? (y - midrib[i - 1][1]) / span : 0;
      return midrib[i - 1][0] + t * (midrib[i][0] - midrib[i - 1][0]);
    }
  }
  return midrib[n - 1][0];
}

export function loft(
  asset: LeafAsset,
  deform: DeformParams = NEUTRAL_DEFORM,
  options: LoftOptions = DEFAULT_LOFT,
): LoftResult {
  const { nu, nv } = options;
  const outline = ensureCCW(asset.outline);
  const [, minY, , maxY] = bounds(outline);
  const lengthMm = polylineLength(asset.midrib) || maxY - minY;

  // Inset the end stations so the chord query never lands exactly on the outline's
  // extreme vertex, where it would find zero crossings instead of a zero-width chord.
  const span = maxY - minY;
  const eps = span * 1e-4;
  const y = new Float64Array(nv);
  const xMid = new Float64Array(nv);
  const halfWidth = new Float64Array(nv);
  const xL = new Float64Array(nv);
  const xR = new Float64Array(nv);

  let halfWidthMax = 0;
  for (let j = 0; j < nv; j++) {
    const yj = minY + eps + ((span - 2 * eps) * j) / (nv - 1);
    y[j] = yj;
    const xs = crossingsAtY(outline, yj);
    let left: number;
    let right: number;
    if (xs.length >= 2) {
      // Outermost pair: for a lobed or serrated margin this takes the envelope,
      // which is the surface the airflow sees.
      left = xs[0];
      right = xs[xs.length - 1];
    } else {
      left = right = midribXAt(asset.midrib, yj);
    }
    xL[j] = left;
    xR[j] = right;
    xMid[j] = Math.min(right, Math.max(left, midribXAt(asset.midrib, yj)));
    halfWidth[j] = (right - left) / 2;
    if (halfWidth[j] > halfWidthMax) halfWidthMax = halfWidth[j];
  }

  const thickness = asset.thicknessMm * deform.thicknessScale;
  const half = thickness / 2;

  // --- surface pass: the mid-surface of the blade, before thickness is added ---
  const surf = new Float64Array(nu * nv * 3);
  for (let j = 0; j < nv; j++) {
    const s = j / (nv - 1);
    const widthScale = halfWidthMax > 0 ? halfWidth[j] / halfWidthMax : 0;
    const zMid = sampleTable(asset.profile, s) + deform.droop * s * s * lengthMm;
    const theta = deform.twist * s;
    const ct = Math.cos(theta);
    const st = Math.sin(theta);

    for (let i = 0; i < nu; i++) {
      const t = nu > 1 ? -1 + (2 * i) / (nu - 1) : 0;
      const x =
        t < 0 ? xMid[j] + t * (xMid[j] - xL[j]) : xMid[j] + t * (xR[j] - xMid[j]);

      // Cupping is stored at the widest chord, so it narrows with the blade; the
      // curl knob is already in units of local half-width and needs no rescale.
      // t^4 concentrates the roll at the margins, which is how a curling leaf goes.
      const z =
        zMid +
        deform.cup * sampleTable(asset.camber, t) * widthScale +
        deform.curl * t * t * t * t * halfWidth[j];

      // Twist rotates each transverse section about the midrib.
      const dx = x - xMid[j];
      const dz = z - zMid;
      const o = (j * nu + i) * 3;
      surf[o] = xMid[j] + dx * ct - dz * st;
      surf[o + 1] = y[j];
      surf[o + 2] = zMid + dx * st + dz * ct;
    }
  }

  // --- normals from the structured grid, then offset to the two sheets ---
  const count = nu * nv;
  const normals = new Float64Array(count * 3);
  const top = new Float64Array(count * 3);
  const bottom = new Float64Array(count * 3);

  const at = (j: number, i: number, k: number) => surf[(j * nu + i) * 3 + k];

  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const i0 = Math.max(0, i - 1);
      const i1 = Math.min(nu - 1, i + 1);
      const j0 = Math.max(0, j - 1);
      const j1 = Math.min(nv - 1, j + 1);

      const ux = at(j, i1, 0) - at(j, i0, 0);
      const uy = at(j, i1, 1) - at(j, i0, 1);
      const uz = at(j, i1, 2) - at(j, i0, 2);
      const vx = at(j1, i, 0) - at(j0, i, 0);
      const vy = at(j1, i, 1) - at(j0, i, 1);
      const vz = at(j1, i, 2) - at(j0, i, 2);

      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz);
      if (len > 1e-12) {
        nx /= len;
        ny /= len;
        nz /= len;
      } else {
        // Collapsed row (tip or base): no surface to take a normal from.
        nx = 0;
        ny = 0;
        nz = 1;
      }

      const o = (j * nu + i) * 3;
      normals[o] = nx;
      normals[o + 1] = ny;
      normals[o + 2] = nz;
      top[o] = surf[o] + nx * half;
      top[o + 1] = surf[o + 1] + ny * half;
      top[o + 2] = surf[o + 2] + nz * half;
      bottom[o] = surf[o] - nx * half;
      bottom[o + 1] = surf[o + 1] - ny * half;
      bottom[o + 2] = surf[o + 2] - nz * half;
    }
  }

  // --- assemble the closed shell ---
  const vertices = new Float64Array(count * 6);
  const vNormals = new Float64Array(count * 6);
  vertices.set(top, 0);
  vertices.set(bottom, count * 3);
  vNormals.set(normals, 0);
  for (let k = 0; k < count * 3; k++) vNormals[count * 3 + k] = -normals[k];

  const T = (j: number, i: number) => j * nu + i;
  const B = (j: number, i: number) => count + j * nu + i;

  const faces: number[] = [];
  for (let j = 0; j < nv - 1; j++) {
    for (let i = 0; i < nu - 1; i++) {
      // Top sheet, wound counter-clockwise seen from the leaf's upper side.
      faces.push(T(j, i), T(j, i + 1), T(j + 1, i + 1));
      faces.push(T(j, i), T(j + 1, i + 1), T(j + 1, i));
      // Bottom sheet, reversed so its normal points down.
      faces.push(B(j, i), B(j + 1, i + 1), B(j, i + 1));
      faces.push(B(j, i), B(j + 1, i), B(j + 1, i + 1));
    }
  }

  // Rim: walk the grid boundary counter-clockwise in (x, y) and stitch top to bottom.
  const loop: Array<[number, number]> = [];
  for (let i = 0; i < nu; i++) loop.push([0, i]);
  for (let j = 1; j < nv; j++) loop.push([j, nu - 1]);
  for (let i = nu - 2; i >= 0; i--) loop.push([nv - 1, i]);
  for (let j = nv - 2; j >= 1; j--) loop.push([j, 0]);

  for (let k = 0; k < loop.length; k++) {
    const [jp, ip] = loop[k];
    const [jq, iq] = loop[(k + 1) % loop.length];
    faces.push(T(jp, ip), B(jp, ip), B(jq, iq));
    faces.push(T(jp, ip), B(jq, iq), T(jq, iq));
  }

  return {
    grid: { nu, nv, y, xMid, halfWidth, top, bottom },
    mesh: { vertices, normals: vNormals, faces: Uint32Array.from(faces) },
    lengthMm,
    halfWidthMaxMm: halfWidthMax,
  };
}

/**
 * Serialise a mesh to Wavefront OBJ with vertex normals.
 *
 * The AeroLeaf wizard hands models around as File objects parsed from OBJ text, so
 * a generated leaf has to arrive the same way an uploaded one would — with real
 * faces, which the previous hardcoded demo leaf had but nothing downstream read.
 */
export function toObj(mesh: Mesh, header = ''): string {
  const lines: string[] = [];
  if (header) for (const line of header.split('\n')) lines.push(`# ${line}`);

  const n = mesh.vertices.length / 3;
  for (let i = 0; i < n; i++) {
    lines.push(
      `v ${mesh.vertices[i * 3].toFixed(5)} ${mesh.vertices[i * 3 + 1].toFixed(5)} ${mesh.vertices[i * 3 + 2].toFixed(5)}`,
    );
  }
  for (let i = 0; i < n; i++) {
    lines.push(
      `vn ${mesh.normals[i * 3].toFixed(5)} ${mesh.normals[i * 3 + 1].toFixed(5)} ${mesh.normals[i * 3 + 2].toFixed(5)}`,
    );
  }
  for (let f = 0; f < mesh.faces.length; f += 3) {
    const a = mesh.faces[f] + 1;
    const b = mesh.faces[f + 1] + 1;
    const c = mesh.faces[f + 2] + 1;
    lines.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`);
  }
  return lines.join('\n') + '\n';
}
