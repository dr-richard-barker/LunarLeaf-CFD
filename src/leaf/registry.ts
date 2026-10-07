/**
 * The leaf asset library.
 *
 * Assets are bundled as JSON imports rather than fetched at runtime. Both tools ship
 * as static sites under a project sub-path on GitHub Pages, where a runtime fetch of
 * `/leaf-assets/...` is a base-path bug waiting to happen; bundling also means the
 * headless validation scripts (which run under esbuild + node, not a browser) get the
 * same library the UI does, with no fetch shim.
 *
 * Traits are recomputed from the outline on load rather than read from the file, so a
 * hand-edited or partially written asset cannot quietly report the wrong leaf area.
 */

import cotyledon from './assets/provisional-cotyledon.json';
import juvenile from './assets/provisional-juvenile.json';
import matureCupped from './assets/provisional-mature-cupped.json';
import matureFlat from './assets/provisional-mature-flat.json';
import { LeafAsset, LeafTraits, Vec2 } from './types';
import { bounds, crossingsAtY, ensureCCW, polygonArea, polygonPerimeter } from './sdf';
import { polylineLength } from './resample';

const RAW = [matureFlat, matureCupped, juvenile, cotyledon] as unknown as LeafAsset[];

/** Widest chord across the blade, found by scanning stations along the midrib. */
function widestChord(outline: readonly Vec2[], samples = 200): number {
  const [, minY, , maxY] = bounds(outline);
  const span = maxY - minY;
  if (!(span > 0)) return 0;
  let widest = 0;
  for (let k = 1; k < samples; k++) {
    const xs = crossingsAtY(outline, minY + (span * k) / samples);
    if (xs.length >= 2) {
      const w = xs[xs.length - 1] - xs[0];
      if (w > widest) widest = w;
    }
  }
  return widest;
}

export function computeTraits(asset: LeafAsset): LeafTraits {
  const outline = ensureCCW(asset.outline);
  const [, minY, , maxY] = bounds(outline);
  const lengthMm = polylineLength(asset.midrib) || maxY - minY;
  const widthMm = widestChord(outline);
  return {
    areaMm2: polygonArea(outline),
    lengthMm,
    widthMm,
    aspectRatio: widthMm > 0 ? lengthMm / widthMm : 0,
    perimeterMm: polygonPerimeter(outline),
  };
}

/** Throws with a specific message rather than letting a bad asset fail deep in the loft. */
function validate(asset: LeafAsset): LeafAsset {
  const where = `leaf asset '${asset.id ?? '(no id)'}'`;
  if (!asset.id) throw new Error(`${where}: missing id`);
  if (!Array.isArray(asset.outline) || asset.outline.length < 3) {
    throw new Error(`${where}: outline needs at least 3 points`);
  }
  if (!Array.isArray(asset.midrib) || asset.midrib.length < 2) {
    throw new Error(`${where}: midrib needs at least 2 points`);
  }
  if (!(asset.thicknessMm > 0)) throw new Error(`${where}: thicknessMm must be positive`);
  const normalised: LeafAsset = { ...asset, outline: ensureCCW(asset.outline) };
  return { ...normalised, traits: computeTraits(normalised) };
}

export const LEAF_ASSETS: LeafAsset[] = RAW.map(validate);

export function getLeafAsset(id: string): LeafAsset {
  const found = LEAF_ASSETS.find((a) => a.id === id);
  if (!found) {
    throw new Error(`unknown leaf asset '${id}'; have: ${LEAF_ASSETS.map((a) => a.id).join(', ')}`);
  }
  return found;
}

/** True while every asset in the library is a hand-authored stand-in. */
export const ALL_PROVISIONAL = LEAF_ASSETS.every((a) => a.provisional);

/**
 * Assets grouped by imaging series and ordered by elapsed imaging time, which is what
 * an age scrubber in the UI walks along. Provisional assets have no series and are
 * excluded — there is no honest time axis to put them on.
 */
export function leafSeries(): Map<string, LeafAsset[]> {
  const byS = new Map<string, LeafAsset[]>();
  for (const a of LEAF_ASSETS) {
    if (a.provisional || a.source.ageHours === undefined) continue;
    const list = byS.get(a.source.series) ?? [];
    list.push(a);
    byS.set(a.source.series, list);
  }
  for (const list of byS.values()) {
    list.sort((p, q) => (p.source.ageHours ?? 0) - (q.source.ageHours ?? 0));
  }
  return byS;
}
