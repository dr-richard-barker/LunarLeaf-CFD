"""Grid Convergence Index for the leaf resolution ladder (Celik et al. 2008, J. Fluids Eng. 130:078001).

Reads results/resolution/leaf_g<g>_r<r>.csv (validation/resolution_ladder.ts), takes
the N_eff-corrected window mean of each quantity over the last half of the record,
and applies the three-grid procedure with non-uniform refinement ratios.

    python3 analysis/gci.py
"""
from __future__ import annotations

import argparse
import csv
import glob
import os
import re
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from transient_stats import load, window_stats  # noqa: E402

QUANTITIES = ("g_bl_mol_m2_s", "delta_mm", "dC_CO2_mean")


def observed_order(phi: tuple[float, float, float], r21: float, r32: float) -> tuple[float, float]:
    """phi = (fine, medium, coarse). Returns (p, s); p is NaN when the ladder is not converging."""
    e21, e32 = phi[1] - phi[0], phi[2] - phi[1]
    if e21 == 0 or e32 == 0:
        return np.nan, 0.0
    s = float(np.sign(e32 / e21))
    p = 2.0
    for _ in range(200):
        q = np.log((r21**p - s) / (r32**p - s))
        p_new = abs(np.log(abs(e32 / e21)) + q) / np.log(r21)
        if abs(p_new - p) < 1e-10:
            break
        p = p_new
    return float(p), s


def gci(phi: tuple[float, float, float], r21: float, r32: float, fs: float = 1.25) -> dict:
    p, s = observed_order(phi, r21, r32)
    out = dict(phi_fine=phi[0], phi_med=phi[1], phi_coarse=phi[2], p=p, monotone=s > 0)
    if not np.isfinite(p) or s < 0:
        out.update(phi_ext=np.nan, gci_fine_pct=np.nan, gci_coarse_pct=np.nan)
        return out
    rp = r21**p
    phi_ext = (rp * phi[0] - phi[1]) / (rp - 1)
    ea21 = abs((phi[0] - phi[1]) / phi[0])
    out.update(
        phi_ext=phi_ext,
        gci_fine_pct=100 * fs * ea21 / (rp - 1),
        # Error of the production (coarsest, r = 1) grid against the extrapolated value.
        gci_coarse_pct=100 * fs * abs((phi[2] - phi_ext) / phi_ext),
    )
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="results/resolution")
    ap.add_argument("--keep", type=float, default=0.5)
    ap.add_argument("--out", default="results/tables/T16_resolution_gci.csv")
    a = ap.parse_args()

    runs: dict[float, dict[float, dict]] = {}
    for p in glob.glob(os.path.join(a.dir, "leaf_g*_r*.csv")):
        m = re.search(r"leaf_g([\d.]+)_r([\d.]+)\.csv", p)
        g, r = float(m.group(1)), float(m.group(2))
        runs.setdefault(g, {})[r] = load(p)

    rows = []
    for g, byr in sorted(runs.items(), reverse=True):
        rs = sorted(byr, reverse=True)  # fine → coarse
        if len(rs) < 3:
            print(f"g={g}: only {len(rs)} resolutions, skipping")
            continue
        rs = rs[:3]
        r21, r32 = rs[0] / rs[1], rs[1] / rs[2]
        for q in QUANTITIES:
            phis, stat = [], []
            for r in rs:
                d = byr[r]
                y = d[q][~np.isnan(d[q])]
                ws = window_stats(y[int(len(y) * (1 - a.keep)) :], 0.1)
                phis.append(ws.mean)
                stat.append(ws.stationary)
            res = gci(tuple(phis), r21, r32)
            rows.append(dict(gravity_g=g, quantity=q, dx_mm=" / ".join(f"{0.288 / r:.3f}" for r in rs), **res, all_stationary=all(stat)))

    with open(a.out, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        for r in rows:
            w.writerow({k: (f"{v:.4g}" if isinstance(v, float) else v) for k, v in r.items()})
    for r in rows:
        print(
            f"g={r['gravity_g']:g} {r['quantity']:14s} fine/med/coarse {r['phi_fine']:.4g}/{r['phi_med']:.4g}/{r['phi_coarse']:.4g}"
            f"  p={r['p']:.2f}  {'monotone' if r['monotone'] else 'OSCILLATORY'}  ext={r['phi_ext']:.4g}"
            f"  GCI_fine={r['gci_fine_pct']:.2f}%  err(r=1)={r['gci_coarse_pct']:.2f}%"
        )
    print("wrote", a.out)


if __name__ == "__main__":
    main()
