"""
Scale-extension figures: forced-airflow and hardware across leaf/rosette/canopy.
Reads T9_fan_by_scale.csv and T10_hardware_by_scale.csv -> F8, F9.
"""
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

FIG, TAB = "results/figures", "results/tables"
SCOL = {"leaf": "#2a7de1", "rosette": "#e0654e", "canopy": "#2fbf71"}
SCALES = ["leaf", "rosette", "canopy"]

fan = pd.read_csv(f"{TAB}/T9_fan_by_scale.csv", comment="#")
# Earth-equivalent speeds as computed by scales.ts at full precision (T9 summary line),
# so the figure and the table always agree; cross() below only locates the marker.
with open(f"{TAB}/T9_fan_by_scale.csv") as fh:
    T9_CROSS = next({k: float(v) for k, v in (p.split("=") for p in l.split(":", 1)[1].split())}
                    for l in fh if l.startswith("# Earth-equivalent fan speed"))

MA_VALID = 0.3  # lattice Boltzmann low-Mach limit; see validation/scales.ts

def fan_rows(scale):
    g = fan[fan.scale == scale]
    ff = g[g.case == "ug_fan"].astype({"fan_cm_s": float, "dC_H2O": float, "ma_max": float}).sort_values("fan_cm_s")
    return ff.dropna(subset=["dC_H2O"])  # runs that blew up are NaN

def cross(scale):
    """Earth-equivalent speed from Mach-valid runs only. No extrapolation: if the valid
    range never reaches the Earth level, the answer is NaN ("not reached")."""
    g = fan[fan.scale == scale]
    earth = float(g[g.case == "earth"].dC_H2O.iloc[0])
    ok = fan_rows(scale)
    ok = ok[ok.ma_max <= MA_VALID]
    xs, ys = ok.fan_cm_s.values, ok.dC_H2O.values
    for i in range(1, len(xs)):
        if (ys[i-1]-earth)*(ys[i]-earth) <= 0:
            return earth, xs[i-1] + (earth-ys[i-1])/(ys[i]-ys[i-1])*(xs[i]-xs[i-1]), xs.max()
    return earth, np.nan, (xs.max() if len(xs) else np.nan)

# ---- F8: fan sweep by scale ----
fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 4.6), gridspec_kw={"width_ratios": [2, 1]})
speeds, valid_to = {}, {}
for s in SCALES:
    ff = fan_rows(s)
    good = ff.ma_max <= MA_VALID
    earth, _, vmax = cross(s)
    xc = T9_CROSS[s]
    speeds[s], valid_to[s] = xc, vmax
    a1.plot(ff.fan_cm_s[good], ff.dC_H2O[good], "o-", color=SCOL[s], label=f"{s}")
    if (~good).any():  # beyond the low-Mach limit: shown hollow, not used
        a1.plot(ff.fan_cm_s[~good], ff.dC_H2O[~good], "o", mfc="none", color=SCOL[s], alpha=0.6)
    a1.axhline(earth, color=SCOL[s], ls="--", lw=1, alpha=0.7)
    if not np.isnan(xc):
        a1.plot([xc], [earth], "*", color=SCOL[s], ms=15, mec="k", mew=0.5)
a1.set_xlabel("forced airflow (cm/s)"); a1.set_ylabel("leaf-surface ΔC H$_2$O (mean, model units)")
a1.set_title("Forced ventilation in µg by plant scale\n(dashed = Earth-1 g level; ★ = Earth-equivalent; hollow = Ma > 0.3, not used)")
a1.grid(alpha=0.25); a1.legend(title="scale")

sv = [speeds[s] for s in SCALES]
a2.bar(range(3), [0 if np.isnan(v) else v for v in sv], color=[SCOL[s] for s in SCALES])
for i, (s, v) in enumerate(zip(SCALES, sv)):
    lab = f"{v:.1f}" if not np.isnan(v) else f"not reached\n≤ {valid_to[s]:.1f} cm/s"
    a2.text(i, (0 if np.isnan(v) else v) + 0.3, lab, ha="center", va="bottom", fontsize=9, fontweight="bold")
a2.set_xticks(range(3)); a2.set_xticklabels(SCALES)
a2.set_ylabel("Earth-equivalent airflow (cm/s)")
a2.set_title("Earth-equivalent airflow\n(within the solver's valid range)")
a2.set_ylim(0, max([v for v in sv if not np.isnan(v)] + [1]) * 1.6)
a2.grid(alpha=0.25, axis="y")
fig.tight_layout(); fig.savefig(f"{FIG}/F8_fan_by_scale.png", dpi=130)
plt.close(fig)

# ---- F9: hardware by scale ----
hw = pd.read_csv(f"{TAB}/T10_hardware_by_scale.csv")
HCOL = {"BRIC": "#e0654e", "CARA": "#2a7de1", "VEGGIE": "#2fbf71"}
fig, ax = plt.subplots(figsize=(8, 4.6))
w = 0.26
for j, h in enumerate(["BRIC", "CARA", "VEGGIE"]):
    vals = [abs(float(hw[(hw.scale == s) & (hw.hardware == h)].surf_dC_CO2.iloc[0])) for s in SCALES]
    mas = [float(hw[(hw.scale == s) & (hw.hardware == h)].ma_max.iloc[0]) for s in SCALES]
    bars = ax.bar(np.arange(3) + (j - 1) * w, vals, w, label=h, color=HCOL[h])
    for b, ma in zip(bars, mas):
        if ma > MA_VALID:  # beyond the low-Mach limit: hatched, read with caution
            b.set_hatch("///"); b.set_edgecolor("white")
            ax.text(b.get_x() + b.get_width() / 2, b.get_height() + 0.01, f"Ma {ma:.2f}", ha="center", fontsize=7.5)
ax.set_xticks(range(3)); ax.set_xticklabels(SCALES)
ax.set_ylabel("leaf-surface |ΔC CO$_2$| (model units)")
ax.set_title("Enclosure hardware × plant scale (microgravity)\n"
             "BRIC/CARA: original 3.8 s run (no steady state); VEGGIE: steady state; hatched = Ma > 0.3", fontsize=9.5)
ax.grid(alpha=0.25, axis="y"); ax.legend(title="hardware")
fig.tight_layout(); fig.savefig(f"{FIG}/F9_hardware_by_scale.png", dpi=130)
plt.close(fig)

print("Earth-equivalent ventilation (cm/s, Ma <= 0.3 runs only):", {s: (round(speeds[s], 1) if not np.isnan(speeds[s]) else f"not reached up to {valid_to[s]:.1f}") for s in SCALES})
print("\nHardware surface |ΔC CO2| by scale:")
print(hw.to_string(index=False))
print("F8_fan_by_scale.png, F9_hardware_by_scale.png")
