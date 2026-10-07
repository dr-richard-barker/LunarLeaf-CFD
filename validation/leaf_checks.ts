/**
 * Self-checks for the leaf geometry module.
 *
 * Run headless, the same way the other validation scripts in this repo do:
 *
 *   npx esbuild validation/leaf_checks.ts --bundle --format=esm --platform=node \
 *     --loader:.json=json --outfile=validation/leaf_checks.mjs && node validation/leaf_checks.mjs
 *
 * These are cheap invariants, not a physics gate: the SDF must get its signs right,
 * the loft must close into a manifold shell (the LBM rasteriser fills by sign test,
 * so a leaky shell would leak fluid), and the two cross-sections must reduce to the
 * shapes we expect for a flat blade and a cupped one.
 */

import { loft, toObj } from '../src/leaf/loft';
import { longitudinalSection, transverseSection } from '../src/leaf/section';
import { computeTraits, getLeafAsset, LEAF_ASSETS } from '../src/leaf/registry';
import { polygonSDF } from '../src/leaf/sdf';
import { NEUTRAL_DEFORM, Vec2 } from '../src/leaf/types';

let failures = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`  PASS  ${name}${detail ? `  (${detail})` : ''}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? `  (${detail})` : ''}`);
  }
}

const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// --- 1. SDF signs and distances on a unit square -----------------------------
console.log('\nSDF');
{
  const square: Vec2[] = [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
  ];
  check('inside is negative', polygonSDF(square, 1, 1) < 0, `d=${polygonSDF(square, 1, 1).toFixed(3)}`);
  check('outside is positive', polygonSDF(square, 3, 1) > 0, `d=${polygonSDF(square, 3, 1).toFixed(3)}`);
  check('centre distance is 1', close(polygonSDF(square, 1, 1), -1, 1e-9));
  check('offset distance is 1', close(polygonSDF(square, 3, 1), 1, 1e-9));
  check('corner distance is √2', close(polygonSDF(square, 3, 3), Math.SQRT2, 1e-9));
}

// --- 2. Every asset lofts into a closed, orientable manifold ------------------
console.log('\nLoft shell topology');
for (const asset of LEAF_ASSETS) {
  const { mesh } = loft(asset);
  const directed = new Map<string, number>();
  const undirected = new Map<string, number>();
  let outOfRange = 0;
  const nv = mesh.vertices.length / 3;

  for (let f = 0; f < mesh.faces.length; f += 3) {
    const tri = [mesh.faces[f], mesh.faces[f + 1], mesh.faces[f + 2]];
    for (const v of tri) if (v >= nv) outOfRange++;
    for (let k = 0; k < 3; k++) {
      const a = tri[k];
      const b = tri[(k + 1) % 3];
      directed.set(`${a}>${b}`, (directed.get(`${a}>${b}`) ?? 0) + 1);
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      undirected.set(key, (undirected.get(key) ?? 0) + 1);
    }
  }

  const notTwice = [...undirected.values()].filter((c) => c !== 2).length;
  const notOnce = [...directed.values()].filter((c) => c !== 1).length;
  check(`${asset.id}: indices in range`, outOfRange === 0, `${outOfRange} bad`);
  check(`${asset.id}: every edge shared by 2 faces`, notTwice === 0, `${notTwice} of ${undirected.size}`);
  check(`${asset.id}: orientation consistent`, notOnce === 0, `${notOnce} of ${directed.size}`);
}

// --- 3. A flat blade's longitudinal cut is the old ellipse's footprint --------
console.log('\nSections');
{
  const flat = getLeafAsset('provisional-mature-flat');
  const result = loft(flat);
  const lon = longitudinalSection(result);
  const traits = computeTraits(flat);
  check(
    'flat leaf: longitudinal chord = blade length',
    close(lon.chordMm, traits.lengthMm, 0.05),
    `${lon.chordMm.toFixed(3)} vs ${traits.lengthMm.toFixed(3)} mm`,
  );
  check(
    'flat leaf: longitudinal height = thickness',
    close(lon.heightMm, flat.thicknessMm, 1e-6),
    `${lon.heightMm.toFixed(4)} vs ${flat.thicknessMm} mm`,
  );

  const tra = transverseSection(result);
  check(
    'flat leaf: transverse chord = widest chord',
    close(tra.chordMm, traits.widthMm, 0.05),
    `${tra.chordMm.toFixed(3)} vs ${traits.widthMm.toFixed(3)} mm`,
  );
  check(
    'flat leaf: transverse height = thickness',
    close(tra.heightMm, flat.thicknessMm, 1e-6),
    `${tra.heightMm.toFixed(4)} mm`,
  );
}

// --- 4. Cupping and curl actually leave the plane ----------------------------
{
  const cupped = getLeafAsset('provisional-mature-cupped');
  const tra = transverseSection(loft(cupped));
  check(
    'cupped leaf: transverse section is a U, not a slab',
    tra.heightMm > 5 * cupped.thicknessMm,
    `height ${tra.heightMm.toFixed(3)} mm vs thickness ${cupped.thicknessMm} mm`,
  );

  const flat = getLeafAsset('provisional-mature-flat');
  const base = transverseSection(loft(flat)).heightMm;
  const curled = transverseSection(
    loft(flat, { ...NEUTRAL_DEFORM, curl: 0.8 }),
  ).heightMm;
  check(
    'curl knob raises the margins',
    curled > base + 1,
    `${base.toFixed(3)} → ${curled.toFixed(3)} mm`,
  );

  const drooped = loft(flat, { ...NEUTRAL_DEFORM, droop: -0.2 });
  const lon = longitudinalSection(drooped);
  check(
    'droop knob bends the midrib down',
    lon.heightMm > flat.thicknessMm * 5,
    `height ${lon.heightMm.toFixed(3)} mm`,
  );
}

// --- 5. Traits and OBJ export ------------------------------------------------
console.log('\nTraits and export');
{
  const flat = getLeafAsset('provisional-mature-flat');
  const t = computeTraits(flat);
  check('mature blade is 15 mm long', close(t.lengthMm, 15, 0.01), `${t.lengthMm.toFixed(3)} mm`);
  check('mature blade is ~8 mm wide', close(t.widthMm, 8, 0.4), `${t.widthMm.toFixed(3)} mm`);
  check('aspect ratio is plausible', t.aspectRatio > 1.5 && t.aspectRatio < 2.5, t.aspectRatio.toFixed(2));
  check('area is positive and under the bounding box', t.areaMm2 > 0 && t.areaMm2 < 15 * 8, `${t.areaMm2.toFixed(2)} mm²`);

  const obj = toObj(loft(flat).mesh, 'check');
  const vCount = (obj.match(/^v /gm) ?? []).length;
  const vnCount = (obj.match(/^vn /gm) ?? []).length;
  const fCount = (obj.match(/^f /gm) ?? []).length;
  const { mesh } = loft(flat);
  check('OBJ vertex count matches mesh', vCount === mesh.vertices.length / 3, `${vCount}`);
  check('OBJ has one normal per vertex', vnCount === vCount);
  check('OBJ face count matches mesh', fCount === mesh.faces.length / 3, `${fCount}`);
  check('OBJ has no NaN', !/NaN/.test(obj));
}

console.log(failures === 0 ? '\nAll leaf checks passed.\n' : `\n${failures} leaf check(s) FAILED.\n`);
if (failures > 0) process.exit(1);
