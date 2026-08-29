#!/usr/bin/env python3
"""Turn a segmented leaf mask into a leaf asset for src/leaf/assets/.

Step 2. Traces the mask boundary, orients the blade into the module's convention
(midrib along +y, base at the origin, transverse across x), resamples the outline,
derives the midrib from the chord midpoints, and writes the JSON the browser tools
and the LBM rasteriser both read.

On deformation: a single top-down photograph carries NO out-of-plane information.
This script therefore writes a FLAT profile and camber and says so in the asset's
note. Getting real 3D pose out of a 2D view is exactly the problem NeuraLeaf solves
with its deformation latent — run fit_leaves.py afterwards to fill those in. The
--curl / --cup flags impose a pose by hand for exploration; anything they touch is
marked as imposed, not measured.

    python3 tools/neuraleaf/export_assets.py \\
        --mask /tmp/gravi02_f090/component_04.png \\
        --px-per-mm 15.97 --series Gravi_02 --frame 90 \\
        --source-image ~/Documents/Gravitropism_flashlapse_/Gravi_02_0090.jpg \\
        --t0 "2017-06-12T17:44:26" \\
        --id gravi02-f090-leaf4 --label "Arabidopsis seedling, frame 90" \\
        --out src/leaf/assets

Dependencies: numpy, pillow, matplotlib (for its marching-squares contour tracer).
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime

import numpy as np
from PIL import Image

# Arabidopsis leaf thickness, used because a silhouette cannot supply it. Ordinary
# Col-0 rosette-leaf values sit around 0.2 mm; override with --thickness-mm when you
# have a measurement.
DEFAULT_THICKNESS_MM = 0.21


def trace_outline(mask: np.ndarray) -> np.ndarray:
    """Longest closed contour of the mask at the half level, as (N, 2) in (col, row) px."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    # Pad so a blade touching the mask edge still yields a closed loop.
    padded = np.pad(mask.astype(float), 1)
    fig = plt.figure()
    try:
        cs = plt.contour(padded, levels=[0.5])
        segments = [s for s in cs.allsegs[0] if len(s) >= 8]
    finally:
        plt.close(fig)
    if not segments:
        raise SystemExit("no contour found in mask")
    longest = max(segments, key=len)
    return longest - 1.0  # undo the pad


def polygon_area(poly: np.ndarray) -> float:
    x, y = poly[:, 0], poly[:, 1]
    return float(abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1))) / 2)


def resample_closed(poly: np.ndarray, n: int) -> np.ndarray:
    """Even arclength resampling of a closed polygon to exactly n points."""
    closed = np.vstack([poly, poly[:1]])
    seg = np.hypot(*np.diff(closed, axis=0).T)
    acc = np.concatenate([[0.0], np.cumsum(seg)])
    targets = np.linspace(0, acc[-1], n, endpoint=False)
    return np.column_stack([np.interp(targets, acc, closed[:, 0]), np.interp(targets, acc, closed[:, 1])])


def orient(poly: np.ndarray) -> np.ndarray:
    """Rotate the outline so its long axis runs along +y with the narrow (base) end at y=0.

    The long axis comes from the covariance eigenvector, which is stable for a blade.
    Which end is the base is decided by width: a leaf tapers to its petiole, so the
    end with the smaller mean half-width is the base. Getting this backwards would put
    the tip at the origin and silently mirror every profile that is later attached.
    """
    centred = poly - poly.mean(axis=0)
    _, vecs = np.linalg.eigh(np.cov(centred.T))
    axis = vecs[:, -1]  # largest eigenvalue → long axis
    angle = np.arctan2(axis[0], axis[1])  # rotate the long axis onto +y
    c, s = np.cos(-angle), np.sin(-angle)
    rot = centred @ np.array([[c, -s], [s, c]]).T

    lo, hi = rot[:, 1].min(), rot[:, 1].max()
    span = hi - lo
    near_lo = rot[rot[:, 1] < lo + 0.25 * span]
    near_hi = rot[rot[:, 1] > hi - 0.25 * span]
    if np.ptp(near_lo[:, 0]) > np.ptp(near_hi[:, 0]):
        rot = rot * np.array([1.0, -1.0])  # flip so the narrow end is at low y
        lo = rot[:, 1].min()

    rot[:, 1] -= rot[:, 1].min()
    return rot


def chord_midpoints(poly: np.ndarray, stations: int = 12) -> list[list[float]]:
    """Midrib as the midpoint of the blade's chord at evenly spaced y stations."""
    y_lo, y_hi = poly[:, 1].min(), poly[:, 1].max()
    pts: list[list[float]] = []
    for k in range(stations + 1):
        y = y_lo + (y_hi - y_lo) * k / stations
        xs = []
        for i in range(len(poly)):
            (ax, ay), (bx, by) = poly[i - 1], poly[i]
            if (ay > y) != (by > y):
                xs.append(ax + (y - ay) / (by - ay) * (bx - ax))
        pts.append([round(float(np.mean([min(xs), max(xs)])) if xs else 0.0, 4), round(float(y), 4)])
    return pts


def exif_timestamp(path: str) -> str | None:
    try:
        exif = Image.open(path).getexif()
    except Exception:
        return None
    for tag in (36867, 36868, 306):  # DateTimeOriginal, DateTimeDigitized, DateTime
        raw = exif.get(tag)
        if raw:
            try:
                return datetime.strptime(str(raw), "%Y:%m:%d %H:%M:%S").isoformat()
            except ValueError:
                continue
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--mask", required=True, help="binary mask PNG of ONE leaf")
    ap.add_argument("--px-per-mm", type=float, required=True, help="scale of the mask (working scale from segment_plate)")
    ap.add_argument("--id", required=True)
    ap.add_argument("--label", required=True)
    ap.add_argument("--out", required=True, help="output directory, normally src/leaf/assets")
    ap.add_argument("--series", default="unknown")
    ap.add_argument("--frame", type=int, default=None)
    ap.add_argument("--source-image", default=None, help="original frame, read for its EXIF timestamp")
    ap.add_argument("--t0", default=None, help="ISO timestamp of the first frame, for the age axis")
    ap.add_argument("--points", type=int, default=160, help="outline points to keep")
    ap.add_argument("--thickness-mm", type=float, default=DEFAULT_THICKNESS_MM)
    ap.add_argument("--curl", type=float, default=0.0, help="impose margin roll (mm at the margins); NOT measured")
    ap.add_argument("--cup", type=float, default=0.0, help="impose cupping (mm at the margins); NOT measured")
    args = ap.parse_args()

    mask = np.asarray(Image.open(args.mask).convert("L")) > 127
    if mask.sum() < 32:
        raise SystemExit(f"mask {args.mask} has only {mask.sum()} pixels")

    outline_px = trace_outline(mask)
    outline_px = resample_closed(outline_px, args.points)
    outline_mm = orient(outline_px / args.px_per_mm)

    # Counter-clockwise, matching the module's convention.
    x, y = outline_mm[:, 0], outline_mm[:, 1]
    if np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)) < 0:
        outline_mm = outline_mm[::-1]

    length = float(outline_mm[:, 1].max())
    width = float(np.ptp(outline_mm[:, 0]))
    area = polygon_area(outline_mm)

    imposed = args.curl != 0.0 or args.cup != 0.0
    note_parts = [
        f"Outline traced from {os.path.basename(args.mask)} at {args.px_per_mm:.3f} px/mm.",
        "Profile and camber are FLAT: a single top-down silhouette carries no "
        "out-of-plane information. Run fit_leaves.py to recover a real 3D pose.",
    ]
    if imposed:
        note_parts.append(
            f"Camber IMPOSED by hand (curl={args.curl}, cup={args.cup}) for exploration — not measured."
        )

    timestamp = exif_timestamp(args.source_image) if args.source_image else None
    age_hours = None
    if timestamp and args.t0:
        try:
            age_hours = round(
                (datetime.fromisoformat(timestamp) - datetime.fromisoformat(args.t0)).total_seconds() / 3600, 3
            )
        except ValueError:
            pass

    margin = args.cup + args.curl
    asset = {
        "id": args.id,
        "label": args.label,
        "provisional": False,
        "source": {
            "series": args.series,
            **({"frame": args.frame} if args.frame is not None else {}),
            **({"timestamp": timestamp} if timestamp else {}),
            **({"ageHours": age_hours} if age_hours is not None else {}),
            "note": " ".join(note_parts),
        },
        "outline": [[round(float(a), 4), round(float(b), 4)] for a, b in outline_mm],
        "midrib": chord_midpoints(outline_mm),
        "profile": [[0, 0], [1, 0]],
        "camber": [[-1, round(margin, 4)], [0, 0], [1, round(margin, 4)]],
        "thicknessMm": args.thickness_mm,
    }

    os.makedirs(args.out, exist_ok=True)
    path = os.path.join(args.out, f"{args.id}.json")
    with open(path, "w") as fh:
        json.dump(asset, fh, indent=2)
        fh.write("\n")

    print(f"{args.id}: {length:.2f} x {width:.2f} mm, area {area:.2f} mm^2, {len(asset['outline'])} points")
    if age_hours is not None:
        print(f"  age {age_hours:.2f} h since {args.t0}")
    elif args.t0:
        print("  no EXIF timestamp found — age axis not populated")
    print(f"  wrote {path}")
    print("  remember to register it in src/leaf/registry.ts and re-run tools/sync-leaf-module.sh")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
