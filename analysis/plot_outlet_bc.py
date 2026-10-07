"""F12: forced-airflow outlet boundary condition, original copy outlet vs pressure outlet.

Left: through-flow as a fraction of the set fan speed (τ at t≈0 / τ(t)).
Right: g_bl(t). Reads results/age/age_fan_U<U>_<copy|pressure>.csv (validation/age_check.ts).

    python3 analysis/plot_outlet_bc.py
"""
from __future__ import annotations

import glob
import os
import re
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

sys.path.insert(0, os.path.dirname(__file__))
from transient_stats import load  # noqa: E402

INK, MUTED, GRID = "#1F2933", "#52606D", "#E4E7EB"
COLOR = {"copy": "#C46A2B", "pressure": "#3B6EA5"}
DASH = {"0.02": "-", "0.1": "--"}
LABEL = {"copy": "copy outlet (original)", "pressure": "pressure outlet"}


def main() -> None:
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(9.2, 3.4), dpi=150, constrained_layout=True)
    for p in sorted(glob.glob("results/age/age_fan_U*_*.csv")):
        m = re.search(r"U([\d.]+)_(copy|pressure)", p)
        u, bc = m.group(1), m.group(2)
        d = load(p)
        t = d["t_s"]
        tau0 = d["tau_steps"][0]
        kw = dict(color=COLOR[bc], ls=DASH.get(u, ":"), lw=1.8)
        a1.plot(t, tau0 / d["tau_steps"], **kw)
        a2.plot(t, d["g_bl"], **kw)
        a2.annotate(f"{LABEL[bc]}, U={u}", (t[-1], d["g_bl"][-1]), xytext=(4, 0), textcoords="offset points",
                    fontsize=7, color=INK, va="center")
    a1.set_ylabel("through-flow / set fan flow", fontsize=8, color=MUTED)
    a1.set_ylim(0, 1.1)
    a2.set_ylabel("g_bl (mol m⁻² s⁻¹)", fontsize=8, color=MUTED)
    a2.set_xlim(right=a2.get_xlim()[1] * 1.55)
    for ax in (a1, a2):
        ax.set_xlabel("t (s)", fontsize=8, color=MUTED)
        ax.grid(color=GRID, lw=0.6)
        ax.tick_params(labelsize=7, colors=MUTED)
        for s in ("top", "right"):
            ax.spines[s].set_visible(False)
    a1.set_title("Copy outlet lets the through-flow decay", fontsize=9, color=INK, loc="left")
    a2.set_title("so g_bl never settles (solid U=0.02, dashed U=0.1)", fontsize=9, color=INK, loc="left")
    fig.savefig("results/figures/F12_outlet_bc.png", facecolor="white")
    print("wrote results/figures/F12_outlet_bc.png")


if __name__ == "__main__":
    main()
