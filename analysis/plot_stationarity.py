"""F11: is the 30 k-step snapshot representative? g_bl(t) per scenario.

One small panel per scenario (independent y so each drift is visible), the
30 000-step snapshot that export_cfd.ts reports marked as a vertical rule, and the
averaging window's mean ± 2 SE (N_eff-corrected, see transient_stats.py) as a band.

    python3 analysis/plot_stationarity.py
"""
from __future__ import annotations

import argparse
import glob
import os
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

sys.path.insert(0, os.path.dirname(__file__))
from transient_stats import SNAPSHOT_STEP, load, window_stats  # noqa: E402

INK, MUTED, GRID = "#1F2933", "#52606D", "#E4E7EB"
SERIES = "#3B6EA5"  # CoSE accent blue
BAND = "#2A9D8F"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="results/timeseries")
    ap.add_argument("--q", default="g_bl_mol_m2_s")
    ap.add_argument("--keep", type=float, default=0.5)
    ap.add_argument("--out", default="results/figures/F11_stationarity.png")
    a = ap.parse_args()

    paths = sorted(glob.glob(os.path.join(a.dir, "*.csv")))
    cols = 3
    rows = int(np.ceil(len(paths) / cols))
    fig, axes = plt.subplots(rows, cols, figsize=(3.4 * cols, 2.5 * rows), dpi=150, constrained_layout=True, squeeze=False)
    for ax in axes.ravel()[len(paths):]:
        ax.set_visible(False)
    for ax, p in zip(axes.ravel(), paths):
        d = load(p)
        t, y = d["t_s"], d[a.q]
        ok = ~np.isnan(y)
        t, y, step = t[ok], y[ok], d["step"][ok]
        start = int(len(y) * (1 - a.keep))
        ws = window_stats(y[start:], float(np.median(np.diff(t))))
        ax.plot(t, y, color=SERIES, lw=1.5)
        late = y[t > 2.0]  # skip the start-up spike so the drift is visible
        pad = 0.08 * (late.max() - late.min() + 1e-3 * abs(late.mean()))
        ax.set_ylim(late.min() - pad, late.max() + pad)
        ax.axhspan(ws.mean - 2 * ws.se, ws.mean + 2 * ws.se, xmin=start / len(y), color=BAND, alpha=0.25, lw=0)
        ts = t[np.argmin(np.abs(step - SNAPSHOT_STEP))]
        ax.axvline(ts, color=MUTED, lw=1, ls="--")
        ax.text(ts, ax.get_ylim()[1], " 30k snapshot", fontsize=7, color=MUTED, va="top")
        verdict = "stationary" if ws.stationary else f"drifting ({ws.trend_frac * 100:+.1f}% over window)"
        ax.set_title(f"{os.path.basename(p)[:-4]} — {verdict}", fontsize=8.5, color=INK, loc="left")
        ax.grid(color=GRID, lw=0.6)
        ax.tick_params(labelsize=7, colors=MUTED)
        for s in ("top", "right"):
            ax.spines[s].set_visible(False)
        ax.set_xlabel("t (s)", fontsize=7.5, color=MUTED)
        ax.set_ylabel(a.q.replace("_mol_m2_s", " (mol m⁻² s⁻¹)"), fontsize=7.5, color=MUTED)
    fig.suptitle("Boundary-layer conductance over a 26 s record; band = window mean ± 2 SE (N_eff-corrected)", fontsize=9, color=INK)
    fig.savefig(a.out, facecolor="white")
    print("wrote", a.out)


if __name__ == "__main__":
    main()
