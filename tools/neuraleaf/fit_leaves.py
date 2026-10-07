#!/usr/bin/env python3
"""Fit a leaf mask with NeuraLeaf to recover a 3D pose, then upgrade the asset.

Step 3, and the optional one. segment_plate.py + export_assets.py already give you a
real, correctly scaled outline from your own imagery — that alone replaces the ellipse.
What they cannot give you is the blade's out-of-plane shape, because a single top-down
silhouette does not contain it. NeuraLeaf does, via its deformation latent z_d.

    Yang, Mao, Santo, Matsushita & Okura (2025). NeuraLeaf: Neural Parametric Leaf
    Models with Shape and Deformation Disentanglement. ICCV 2025. arXiv:2507.12714
    https://github.com/Yrainy0615/NeuraLeaf

=============================================================================
READ THIS BEFORE TRUSTING THE OUTPUT
=============================================================================
This wrapper has NOT been executed against a real NeuraLeaf checkout. It shells out to
that repository's own `fitting.py` rather than importing its internals, precisely so
the integration point is one documented command you can inspect and correct — but the
flag names below are a starting point, not verified ones. Run with --print-command
first, check the command against `python fitting.py --help` in your checkout, and pass
--fitting-args to override. The post-processing of the resulting .obj into our asset
format IS tested and does not depend on those flags.

LICENSING: the NeuraLeaf repository carries no LICENSE file, so its code and weights
are under default copyright — all rights reserved. Nothing from it is vendored here.
This script only invokes a checkout that YOU obtained, at a path YOU provide. Before
publishing or depositing any geometry derived from it, settle redistribution with the
authors. See src/leaf/assets/PROVENANCE.md.
=============================================================================

Setup:
    git clone https://github.com/Yrainy0615/NeuraLeaf.git ~/src/NeuraLeaf
    # download baseshape_l.pth, deform.pth, encoder.pth into ~/src/NeuraLeaf/checkpoints
    export NEURALEAF_HOME=~/src/NeuraLeaf
    # NeuraLeaf's own stack: Python 3.9, torch 2.0.1+cu118, pytorch3d, CUDA GPU

Usage:
    python3 tools/neuraleaf/fit_leaves.py --mask /tmp/gravi02_f090/component_04.png \\
        --asset src/leaf/assets/gravi02-f090-leaf4.json --print-command
"""

from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
import sys

CHECKPOINTS = ("baseshape_l.pth", "deform.pth", "encoder.pth")


def locate_neuraleaf(explicit: str | None) -> str:
    home = explicit or os.environ.get("NEURALEAF_HOME")
    if not home:
        sys.exit(
            "NEURALEAF_HOME is not set and --neuraleaf-home was not given.\n"
            "Clone https://github.com/Yrainy0615/NeuraLeaf and point at it, or skip this\n"
            "step — export_assets.py already produces usable flat geometry."
        )
    home = os.path.expanduser(home)
    if not os.path.isfile(os.path.join(home, "fitting.py")):
        sys.exit(f"{home} does not look like a NeuraLeaf checkout (no fitting.py)")
    ckpt_dir = os.path.join(home, "checkpoints")
    missing = [c for c in CHECKPOINTS if not os.path.isfile(os.path.join(ckpt_dir, c))]
    if missing:
        sys.exit(
            f"missing checkpoint(s) in {ckpt_dir}: {', '.join(missing)}\n"
            "Download them from the link in the NeuraLeaf README."
        )
    return home


def obj_bounds(path: str) -> tuple[list[float], list[float], int]:
    """Min/max corner of an OBJ's vertices, and the vertex count."""
    lo = [float("inf")] * 3
    hi = [float("-inf")] * 3
    n = 0
    with open(path) as fh:
        for line in fh:
            if not line.startswith("v "):
                continue
            parts = line.split()
            if len(parts) < 4:
                continue
            xyz = [float(v) for v in parts[1:4]]
            for i in range(3):
                lo[i] = min(lo[i], xyz[i])
                hi[i] = max(hi[i], xyz[i])
            n += 1
    return lo, hi, n


def profile_from_obj(path: str, stations: int = 9) -> tuple[list, list, dict]:
    """Reduce a fitted 3D leaf mesh to our profile/camber tables.

    We deliberately do not adopt NeuraLeaf's mesh wholesale. The asset format keeps the
    2D base shape and the deformation apart — the same split the paper makes — so that
    one outline can be re-posed without re-running the network. So we take the fitted
    mesh, put its long axis on +y and its normal on +z, and read off two curves: the
    midrib's height along the blade, and the transverse cupping at the widest chord.
    """
    import numpy as np

    verts = []
    with open(path) as fh:
        for line in fh:
            if line.startswith("v "):
                parts = line.split()
                if len(parts) >= 4:
                    verts.append([float(v) for v in parts[1:4]])
    if len(verts) < 16:
        sys.exit(f"{path}: only {len(verts)} vertices — not a usable fit")
    v = np.asarray(verts)
    v -= v.mean(axis=0)

    # Thinnest direction is the leaf normal; longest in-plane direction is the midrib.
    _, vecs = np.linalg.eigh(np.cov(v.T))
    normal, mid = vecs[:, 0], vecs[:, 2]
    transverse = np.cross(normal, mid)
    # One change of basis rather than three vector products. The per-vector form trips
    # spurious BLAS floating-point flags when an eigenvector holds exact (or negative)
    # zeros, which a leaf's symmetry axis reliably does; the `+ 0.0` normalises -0.0.
    basis = np.ascontiguousarray(np.column_stack([transverse, mid, normal]) + 0.0)
    local = v.dot(basis)  # (x, y, z) in leaf-local coordinates

    y = local[:, 1]
    y_lo, y_hi = y.min(), y.max()
    span = max(y_hi - y_lo, 1e-9)

    profile = []
    for k in range(stations + 1):
        s = k / stations
        lo_e, hi_e = y_lo + span * max(0.0, s - 0.06), y_lo + span * min(1.0, s + 0.06)
        band = local[(y >= lo_e) & (y <= hi_e)]
        if len(band) == 0:
            continue
        # Midrib height: near-axis vertices only.
        near = band[np.abs(band[:, 0]) <= max(1e-6, 0.15 * np.abs(band[:, 0]).max())]
        z = float(np.median((near if len(near) else band)[:, 2]))
        profile.append([round(s, 4), round(z, 4)])

    # Camber at the widest band, expressed against normalised transverse position.
    widths = []
    for k in range(stations + 1):
        lo_e, hi_e = y_lo + span * k / stations, y_lo + span * (k + 1) / stations
        band = local[(y >= lo_e) & (y < hi_e)]
        widths.append((np.ptp(band[:, 0]) if len(band) else 0.0, lo_e, hi_e))
    _, lo_e, hi_e = max(widths, key=lambda w: w[0])
    band = local[(y >= lo_e) & (y < hi_e)]
    half = max(np.abs(band[:, 0]).max(), 1e-9)
    camber = []
    for t in (-1.0, -0.6, -0.25, 0.0, 0.25, 0.6, 1.0):
        sel = band[np.abs(band[:, 0] / half - t) < 0.15]
        z = float(np.median(sel[:, 2])) if len(sel) else 0.0
        camber.append([t, round(z, 4)])
    # Express relative to the midrib.
    z0 = next((c[1] for c in camber if c[0] == 0.0), 0.0)
    camber = [[t, round(z - z0, 4)] for t, z in camber]

    stats = {
        "vertices": len(verts),
        "midribRangeMm": round(float(span), 4),
        "camberSpanMm": round(float(max(c[1] for c in camber) - min(c[1] for c in camber)), 4),
    }
    return profile, camber, stats


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--mask", required=True, help="single-leaf mask to fit")
    ap.add_argument("--asset", required=True, help="asset JSON from export_assets.py, updated in place")
    ap.add_argument("--neuraleaf-home", default=None, help="overrides $NEURALEAF_HOME")
    ap.add_argument("--checkpoint", default="baseshape_l.pth")
    ap.add_argument("--work-dir", default=None, help="where fitting.py writes (default: alongside the mask)")
    ap.add_argument(
        "--fitting-args",
        default="--mask {mask} --checkpoint {checkpoint} --output {out}",
        help="argument template for NeuraLeaf's fitting.py. VERIFY against your checkout's --help.",
    )
    ap.add_argument("--print-command", action="store_true", help="print the command and exit without running it")
    ap.add_argument("--obj", default=None, help="skip fitting and post-process an existing .obj")
    args = ap.parse_args()

    if not os.path.isfile(args.asset):
        sys.exit(f"asset {args.asset} not found — run export_assets.py first")

    obj_path = args.obj
    if obj_path is None:
        home = locate_neuraleaf(args.neuraleaf_home)
        work = args.work_dir or os.path.join(os.path.dirname(os.path.abspath(args.mask)), "neuraleaf_fit")
        os.makedirs(work, exist_ok=True)
        obj_path = os.path.join(work, "fitted.obj")

        cmd = [sys.executable, os.path.join(home, "fitting.py")] + shlex.split(
            args.fitting_args.format(
                mask=os.path.abspath(args.mask),
                checkpoint=os.path.join(home, "checkpoints", args.checkpoint),
                out=work,
            )
        )
        printable = " ".join(shlex.quote(c) for c in cmd)
        if args.print_command:
            print(printable)
            print("\nCheck these flags against `python fitting.py --help` in your checkout,")
            print("then re-run without --print-command (or override with --fitting-args).")
            return 0

        print(f"running: {printable}")
        result = subprocess.run(cmd, cwd=home)
        if result.returncode != 0:
            sys.exit(
                f"fitting.py exited {result.returncode}. The flag template is unverified — "
                "run with --print-command and compare against its --help."
            )
        if not os.path.isfile(obj_path):
            candidates = [f for f in os.listdir(work) if f.endswith(".obj")]
            if not candidates:
                sys.exit(f"fitting.py produced no .obj in {work}")
            obj_path = os.path.join(work, sorted(candidates)[0])
            print(f"using {obj_path}")

    lo, hi, n = obj_bounds(obj_path)
    print(f"fitted mesh: {n} vertices, extent {[round(hi[i] - lo[i], 3) for i in range(3)]}")

    profile, camber, stats = profile_from_obj(obj_path)

    with open(args.asset) as fh:
        asset = json.load(fh)
    asset["profile"] = profile
    asset["camber"] = camber
    asset["neuraleaf"] = {
        "checkpoint": args.checkpoint,
        "objSource": os.path.abspath(obj_path),
        **stats,
        "note": (
            "Pose recovered from a NeuraLeaf fit. Latent codes z_s/z_d are not recorded here — "
            "fitting.py's output layout was not verified by this wrapper; add them by hand if "
            "your checkout writes them."
        ),
    }
    note = asset.setdefault("source", {}).get("note", "")
    asset["source"]["note"] = note.replace(
        "Profile and camber are FLAT: a single top-down silhouette carries no "
        "out-of-plane information. Run fit_leaves.py to recover a real 3D pose.",
        f"Profile and camber recovered from a NeuraLeaf fit ({os.path.basename(obj_path)}).",
    )

    with open(args.asset, "w") as fh:
        json.dump(asset, fh, indent=2)
        fh.write("\n")

    print(f"updated {args.asset}: camber span {stats['camberSpanMm']} mm over the widest chord")
    print("verify it with: node validation/leaf_inspect.mjs " + args.asset)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
