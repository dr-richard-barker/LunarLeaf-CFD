#!/usr/bin/env python3
"""Track one leaf across a timelapse and export an asset per frame.

Runs the same segmentation as segment_plate.py over a list of frames, follows a single
leaf from frame to frame by nearest centroid, and writes one asset per frame plus an
`age_series.csv` with the morphometrics against elapsed imaging time.

Tracking is deliberately simple — nearest centroid within a drift limit, preferring a
similar area — because the alternative on this kind of footage is a real tracker, and a
simple one that *reports when it loses the leaf* is more useful than a clever one that
silently swaps to the neighbouring plant. Every row carries the drift and the area jump
so you can see where it wandered.

    python3 tools/neuraleaf/build_series.py \\
        --glob '~/Documents/Gravitropism_flashlapse_/Gravi_02_*.jpg' \\
        --every 24 --px-per-mm 24.4 \\
        --seed-index 4 --id-prefix gravi02 --series Gravi_02 \\
        --work /tmp/gravi_series --out-assets src/leaf/assets

READ THE SCALE CAVEAT. --px-per-mm is not inferred from the image. Every millimetre in
the output is only as good as that number.
"""

from __future__ import annotations

import argparse
import csv
import glob as globmod
import json
import os
from datetime import datetime

import numpy as np
from PIL import Image

from export_assets import (
    DEFAULT_THICKNESS_MM,
    chord_midpoints,
    exif_timestamp,
    orient,
    polygon_area,
    resample_closed,
    trace_outline,
)
from segment_plate import Component, crop_component, segment_image


def pick(components: list[Component], target, prev_area: float | None, max_drift: float, allow_clusters: bool):
    """Nearest candidate to `target`, tie-broken by area similarity."""
    best = None
    best_score = None
    for c in components:
        if not allow_clusters and not c.single_leaf_candidate:
            continue
        d = float(np.hypot(c.centroid[0] - target[0], c.centroid[1] - target[1]))
        if d > max_drift:
            continue
        # Distance dominates; area similarity only separates near-ties.
        score = d
        if prev_area:
            score += 40.0 * abs(c.area_px - prev_area) / max(prev_area, 1.0)
        if best_score is None or score < best_score:
            best, best_score = c, score
    return best


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--glob", required=True, help="frame glob, e.g. '~/dir/Gravi_02_*.jpg'")
    ap.add_argument("--every", type=int, default=24, help="process every Nth frame")
    ap.add_argument("--frames", default=None, help="explicit comma-separated frame indices; overrides --every")
    ap.add_argument("--px-per-mm", type=float, required=True)
    ap.add_argument("--seed-index", type=int, default=None, help="component index to follow, in the FIRST processed frame")
    ap.add_argument("--seed-xy", default=None, help="'row,col' in working pixels to seed the track from instead")
    ap.add_argument("--max-drift", type=float, default=60.0, help="max centroid movement between processed frames, working px")
    ap.add_argument(
        "--allow-clusters",
        action="store_true",
        help="follow components that are NOT single-leaf candidates (i.e. whole plants). "
        "Morphometrics still go to age_series.csv; leaf assets do not, unless --force-cluster-asset.",
    )
    ap.add_argument(
        "--force-cluster-asset",
        action="store_true",
        help="also write an asset for a cluster. It is marked provisional and labelled a whole-plant "
        "silhouette, because that is what it is — do not pass this and then call the result a leaf.",
    )
    ap.add_argument("--id-prefix", required=True)
    ap.add_argument("--series", required=True)
    ap.add_argument("--work", required=True, help="scratch dir for masks")
    ap.add_argument("--out-assets", required=True)
    ap.add_argument("--points", type=int, default=160)
    ap.add_argument("--thickness-mm", type=float, default=DEFAULT_THICKNESS_MM)
    ap.add_argument("--max-side", type=int, default=1600)
    args = ap.parse_args()

    files = sorted(globmod.glob(os.path.expanduser(args.glob)))
    if not files:
        raise SystemExit(f"no frames matched {args.glob}")
    if args.frames:
        idxs = [int(x) for x in args.frames.split(",")]
    else:
        idxs = list(range(0, len(files), args.every))
    print(f"{len(files)} frames found; processing {len(idxs)}: {idxs}")

    t0 = exif_timestamp(files[0])
    os.makedirs(args.work, exist_ok=True)
    os.makedirs(args.out_assets, exist_ok=True)

    target = None
    prev_area = None
    if args.seed_xy:
        r, c = args.seed_xy.split(",")
        target = (float(r), float(c))

    rows = []
    lost = 0

    for k in idxs:
        path = files[k]
        rgb, mask, comps, meta = segment_image(
            path, args.px_per_mm, max_side=args.max_side
        )
        px_per_mm = meta["px_per_mm_working"]

        if target is None:
            seed = args.seed_index or 1
            chosen = next((c for c in comps if c.index == seed), None)
            if chosen is None:
                raise SystemExit(f"seed component {seed} not present in frame {k}")
        else:
            chosen = pick(comps, target, prev_area, args.max_drift, args.allow_clusters)
            if chosen is None:
                print(f"  frame {k:>4}: LOST — no candidate within {args.max_drift} px of {target}")
                lost += 1
                continue

        target = chosen.centroid
        drift = 0.0 if prev_area is None else float(np.hypot(*(np.array(chosen.centroid) - np.array(target))))
        area_jump = 0.0 if not prev_area else (chosen.area_px - prev_area) / prev_area
        prev_area = chosen.area_px

        crop = crop_component(mask, chosen)
        mask_path = os.path.join(args.work, f"frame{k:04d}.png")
        Image.fromarray((crop * 255).astype(np.uint8)).save(mask_path)

        outline_px = resample_closed(trace_outline(crop), args.points)
        outline_mm = orient(outline_px / px_per_mm)
        x, y = outline_mm[:, 0], outline_mm[:, 1]
        if np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)) < 0:
            outline_mm = outline_mm[::-1]

        length = float(outline_mm[:, 1].max())
        width = float(np.ptp(outline_mm[:, 0]))
        area = polygon_area(outline_mm)

        ts = exif_timestamp(path)
        age = None
        if ts and t0:
            age = round((datetime.fromisoformat(ts) - datetime.fromisoformat(t0)).total_seconds() / 3600, 3)

        is_leaf = chosen.single_leaf_candidate
        asset_id = f"{args.id_prefix}-f{k:04d}"
        cluster_note = (
            ""
            if is_leaf
            else " WHOLE-PLANT SILHOUETTE, not a single leaf: thresholding could not separate this "
            "plant's leaves (solidity %.2f). Treat as a plant outline only." % chosen.solidity
        )
        asset = {
            "id": asset_id,
            "label": f"{args.series} frame {k}" + (f", {age:.1f} h" if age is not None else ""),
            "provisional": not is_leaf,
            "source": {
                "series": args.series,
                "frame": k,
                **({"timestamp": ts} if ts else {}),
                **({"ageHours": age} if age is not None else {}),
                "note": (
                    f"Outline traced from {os.path.basename(path)} at {px_per_mm:.3f} px/mm "
                    f"(assumes --px-per-mm {args.px_per_mm} at source scale — NOT inferred from the image). "
                    "Profile and camber are FLAT: a single top-down silhouette carries no out-of-plane "
                    "information. Age is elapsed imaging time, NOT a developmental stage." + cluster_note
                ),
            },
            "outline": [[round(float(a), 4), round(float(b), 4)] for a, b in outline_mm],
            "midrib": chord_midpoints(outline_mm),
            "profile": [[0, 0], [1, 0]],
            "camber": [[-1, 0], [0, 0], [1, 0]],
            "thicknessMm": args.thickness_mm,
        }
        wrote_asset = is_leaf or args.force_cluster_asset
        if wrote_asset:
            with open(os.path.join(args.out_assets, f"{asset_id}.json"), "w") as fh:
                json.dump(asset, fh, indent=2)
                fh.write("\n")

        rows.append(
            {
                "frame": k,
                "age_h": age,
                "asset_id": asset_id if wrote_asset else "",
                "kind": "leaf" if is_leaf else "plant cluster",
                "area_mm2": round(area, 4),
                "length_mm": round(length, 4),
                "width_mm": round(width, 4),
                "aspect_ratio": round(length / width, 4) if width else "",
                "solidity": chosen.solidity,
                "centroid_row": chosen.centroid[0],
                "centroid_col": chosen.centroid[1],
                "drift_px": round(drift, 2),
                "area_jump_frac": round(area_jump, 4),
            }
        )
        print(
            f"  frame {k:>4}  age {age if age is None else f'{age:6.2f}'} h  "
            f"{length:5.2f} x {width:5.2f} mm  area {area:6.2f} mm²  "
            f"[{'leaf' if is_leaf else 'CLUSTER'}]  "
            f"{'-> ' + asset_id if wrote_asset else '(no asset written)'}"
        )

    if not rows:
        raise SystemExit("nothing tracked")

    csv_path = os.path.join(args.work, "age_series.csv")
    with open(csv_path, "w", newline="") as fh:
        wtr = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        wtr.writeheader()
        wtr.writerows(rows)

    n_assets = sum(1 for r in rows if r["asset_id"])
    n_clusters = sum(1 for r in rows if r["kind"] == "plant cluster")
    print(f"\n{len(rows)} frame(s) tracked, {n_assets} asset(s) written to {args.out_assets}; {lost} lost")
    if n_clusters:
        print(
            f"  {n_clusters} tracked frame(s) were plant CLUSTERS, not single leaves — thresholding\n"
            "  cannot separate overlapping leaves. Their morphometrics are in the CSV, which is real\n"
            "  plant-level data; per-leaf geometry needs manual annotation or NeuraLeaf's shape prior."
        )
    print(f"series table: {csv_path}")
    print("register the assets in src/leaf/registry.ts, then run tools/sync-leaf-module.sh")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
