/**
 * Validate a leaf asset JSON file before registering it.
 *
 * export_assets.py writes assets from real imagery; this is the gate they pass through
 * before anyone adds them to src/leaf/registry.ts. It loads the file from disk (rather
 * than as a bundled import), runs the same normalisation the registry does, lofts it,
 * cuts both sections, and reports the traits — so a mis-scaled, mis-oriented or
 * inside-out outline is caught here rather than three steps later in a scenario.
 *
 *   npx esbuild validation/leaf_inspect.ts --bundle --format=esm --platform=node \
 *     --loader:.json=json --outfile=validation/leaf_inspect.mjs \
 *     && node validation/leaf_inspect.mjs path/to/asset.json
 */

import { readFileSync } from 'node:fs';
import { loft } from '../src/leaf/loft';
import { longitudinalSection, transverseSection } from '../src/leaf/section';
import { computeTraits } from '../src/leaf/registry';
import { polygonSDF, signedArea } from '../src/leaf/sdf';
import { LeafAsset } from '../src/leaf/types';

const path = process.argv[2];
if (!path) {
  console.error('usage: node validation/leaf_inspect.mjs <asset.json>');
  process.exit(2);
}

const asset = JSON.parse(readFileSync(path, 'utf8')) as LeafAsset;
const problems: string[] = [];

if (!asset.id) problems.push('missing id');
if (!Array.isArray(asset.outline) || asset.outline.length < 3) problems.push('outline too short');
if (!Array.isArray(asset.midrib) || asset.midrib.length < 2) problems.push('midrib too short');
if (!(asset.thicknessMm > 0)) problems.push('thicknessMm must be positive');
if (problems.length) {
  console.error(`${path}:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

const traits = computeTraits(asset);
const posed = loft(asset);
const tra = transverseSection(posed);
const lon = longitudinalSection(posed);

console.log(`\n${asset.id}  —  ${asset.label}`);
console.log(`  provenance      ${asset.source.series}${asset.source.frame !== undefined ? ` frame ${asset.source.frame}` : ''}` +
  `${asset.source.ageHours !== undefined ? `, ${asset.source.ageHours} h` : ''}`);
console.log(`  provisional     ${asset.provisional ? 'YES — not a fit to imagery' : 'no'}`);
console.log(`  outline         ${asset.outline.length} points, winding ${signedArea(asset.outline) > 0 ? 'CCW' : 'CW (will be flipped on load)'}`);
console.log(`  blade           ${traits.lengthMm.toFixed(2)} x ${traits.widthMm.toFixed(2)} mm, aspect ${traits.aspectRatio.toFixed(2)}`);
console.log(`  area/perimeter  ${traits.areaMm2.toFixed(2)} mm² / ${traits.perimeterMm.toFixed(2)} mm`);
console.log(`  thickness       ${asset.thicknessMm} mm`);
console.log(`  transverse cut  ${tra.chordMm.toFixed(2)} x ${tra.heightMm.toFixed(3)} mm`);
console.log(`  longitudinal    ${lon.chordMm.toFixed(2)} x ${lon.heightMm.toFixed(3)} mm`);

// Sanity checks that catch the failure modes worth catching.
const warn: string[] = [];
const centroidX =
  asset.outline.reduce((s, p) => s + p[0], 0) / asset.outline.length;
if (Math.abs(centroidX) > traits.widthMm * 0.25) {
  warn.push(`outline is off-centre in x (centroid ${centroidX.toFixed(2)} mm) — is the midrib on x=0?`);
}
const baseY = Math.min(...asset.outline.map((p) => p[1]));
if (Math.abs(baseY) > 0.05 * traits.lengthMm) {
  warn.push(`base is not at y=0 (min y ${baseY.toFixed(2)} mm)`);
}
if (traits.aspectRatio < 0.5 || traits.aspectRatio > 8) {
  warn.push(`aspect ratio ${traits.aspectRatio.toFixed(2)} is unusual for a leaf — check the scale and orientation`);
}
// Size is checked against the lattice this asset will actually be simulated on rather
// than against a guess at what species it is. A botched px-per-mm calibration — the most
// likely error in the pipeline, since the scale is set by hand — shows up here as a leaf
// that cannot be resolved or cannot fit, which is the consequence that matters anyway.
const DX_MM = 0.288; // T3 calibration: 1.5 cm leaf spans 52 cells
const DOMAIN_CELLS = 128;
const cells = traits.lengthMm / DX_MM;
console.log(
  `  on the lattice   ${cells.toFixed(0)} cells long at dx = ${DX_MM} mm ` +
    `(domain is ${DOMAIN_CELLS} × 96)`,
);
if (cells < 12) {
  warn.push(
    `only ${cells.toFixed(0)} lattice cells long — too small to resolve in the standard ` +
      'domain. Either the scale is wrong, or this needs a finer lattice than the leaf/rosette scenarios use.',
  );
} else if (cells > DOMAIN_CELLS * 0.8) {
  warn.push(
    `${cells.toFixed(0)} lattice cells long — will not fit the ${DOMAIN_CELLS}-cell domain ` +
      'with room for a boundary layer. Check the scale, or use a larger domain.',
  );
}
if (asset.thicknessMm > traits.lengthMm * 0.2) {
  warn.push(
    `thickness ${asset.thicknessMm} mm is more than a fifth of the blade length — check the units`,
  );
}
if (polygonSDF(asset.outline, 0, traits.lengthMm * 0.6) >= 0) {
  warn.push('the point 60% along the midrib is OUTSIDE the outline — orientation is probably wrong');
}
const flat = tra.heightMm <= asset.thicknessMm * 1.01;
console.log(`  deformation     ${flat ? 'flat (no out-of-plane pose — expected straight from export_assets.py)' : 'posed'}`);

if (warn.length) {
  console.log('\n  WARNINGS');
  for (const w of warn) console.log(`    - ${w}`);
} else {
  console.log('\n  no warnings');
}
console.log('');
