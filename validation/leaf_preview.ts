/**
 * Render every leaf asset to an SVG contact sheet, for eyeballing geometry.
 *
 * Numbers in leaf_checks.ts tell you the shell is closed and the sections have the
 * right extents; they cannot tell you the outline looks like a leaf, or that a curl
 * setting curls the way you meant. This draws the three views that matter — planform
 * outline, transverse cut (cupping and curl), longitudinal cut (arch and droop) —
 * side by side, so a bad fit is obvious at a glance. It will matter more once the
 * provisional assets are replaced by real NeuraLeaf fits and each one needs checking.
 *
 *   npx esbuild validation/leaf_preview.ts --bundle --format=esm --platform=node \
 *     --loader:.json=json --outfile=validation/leaf_preview.mjs \
 *     && node validation/leaf_preview.mjs [outfile.svg]
 */

import { writeFileSync } from 'node:fs';
import { loft } from '../src/leaf/loft';
import { longitudinalSection, transverseSection } from '../src/leaf/section';
import { computeTraits, LEAF_ASSETS } from '../src/leaf/registry';
import { NEUTRAL_DEFORM, Vec2 } from '../src/leaf/types';

const CELL = 190; // px per panel
const PAD = 14;
const LABEL_H = 34;

/** Fit a polygon into a CELL-sized box and emit its SVG path, y flipped for screen. */
function pathFor(poly: readonly Vec2[], ox: number, oy: number): { d: string; scale: number } {
  if (poly.length < 3) return { d: '', scale: 1 };
  let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
  for (const [a, b] of poly) {
    if (a < minA) minA = a;
    if (a > maxA) maxA = a;
    if (b < minB) minB = b;
    if (b > maxB) maxB = b;
  }
  const span = Math.max(maxA - minA, maxB - minB, 1e-9);
  const scale = (CELL - 2 * PAD) / span;
  const cxSrc = (minA + maxA) / 2;
  const cySrc = (minB + maxB) / 2;

  const pts = poly.map(([a, b]) => {
    const x = ox + CELL / 2 + (a - cxSrc) * scale;
    const y = oy + CELL / 2 - (b - cySrc) * scale;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return { d: `M ${pts.join(' L ')} Z`, scale };
}

const VIEWS = ['planform outline', 'transverse cut', 'longitudinal cut'] as const;

const rows = LEAF_ASSETS.length;
const width = 3 * CELL + 200;
const height = (rows + 1) * (CELL + LABEL_H) + 40;

const out: string[] = [];
out.push(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  `<rect width="${width}" height="${height}" fill="#0f1622"/>`,
  `<style>text{font:11px system-ui,sans-serif;fill:#9fb0c8}
   .h{font-weight:600;fill:#e6edf6}.s{fill:#5d7a58;stroke:#8fd07f;stroke-width:1.1}</style>`,
);

for (let i = 0; i < 3; i++) {
  out.push(`<text class="h" x="${200 + i * CELL + PAD}" y="22">${VIEWS[i]}</text>`);
}

LEAF_ASSETS.forEach((asset, r) => {
  const oy = 34 + r * (CELL + LABEL_H);
  const t = computeTraits(asset);
  const posed = loft(asset, NEUTRAL_DEFORM);

  out.push(
    `<text class="h" x="12" y="${oy + CELL / 2 - 6}">${asset.id}</text>`,
    `<text x="12" y="${oy + CELL / 2 + 12}">${t.lengthMm.toFixed(1)} × ${t.widthMm.toFixed(1)} mm · ${t.areaMm2.toFixed(1)} mm²</text>`,
    `<text x="12" y="${oy + CELL / 2 + 28}">${asset.provisional ? 'PROVISIONAL' : asset.source.series}</text>`,
  );

  const panels: Array<readonly Vec2[]> = [
    asset.outline,
    transverseSection(posed).polygon,
    longitudinalSection(posed).polygon,
  ];

  panels.forEach((poly, c) => {
    const ox = 200 + c * CELL;
    out.push(`<rect x="${ox}" y="${oy}" width="${CELL}" height="${CELL}" fill="#161f2e" stroke="#2a3648"/>`);
    const { d } = pathFor(poly, ox, oy);
    if (d) out.push(`<path class="s" d="${d}"/>`);
  });
});

// Bottom row: the curl sweep on one blade, so the deformation knob is legible.
const flat = LEAF_ASSETS.find((a) => a.id === 'provisional-mature-flat');
if (flat) {
  const oy = 34 + rows * (CELL + LABEL_H);
  out.push(
    `<text class="h" x="12" y="${oy + CELL / 2}">curl sweep</text>`,
    `<text x="12" y="${oy + CELL / 2 + 16}">transverse cut</text>`,
  );
  [0, 0.4, 0.8].forEach((curl, c) => {
    const ox = 200 + c * CELL;
    const section = transverseSection(loft(flat, { ...NEUTRAL_DEFORM, curl }));
    out.push(
      `<rect x="${ox}" y="${oy}" width="${CELL}" height="${CELL}" fill="#161f2e" stroke="#2a3648"/>`,
      `<text x="${ox + PAD}" y="${oy + 18}">curl = ${curl} · height ${section.heightMm.toFixed(2)} mm</text>`,
    );
    const { d } = pathFor(section.polygon, ox, oy);
    if (d) out.push(`<path class="s" d="${d}"/>`);
  });
}

out.push('</svg>');

const target = process.argv[2] ?? 'validation/leaf_preview.svg';
writeFileSync(target, out.join('\n') + '\n');
console.log(`wrote ${target} — ${LEAF_ASSETS.length} assets, 3 views each, plus a curl sweep`);
