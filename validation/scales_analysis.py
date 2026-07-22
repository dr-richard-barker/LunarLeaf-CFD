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

def fan_pts(scale):
    g = fan[fan.scale == scale]
    ff = g[g.case == "ug_fan"].astype({"fan_cm_s": float, "dC_H2O": float}).sort_values("fan_cm_s")
    ff = ff.dropna(subset=["dC_H2O"])  # high fan speeds through the canopy can go NaN (low-Mach limit)
    return ff.fan_cm_s.values, ff.dC_H2O.values

def cross(scale):
    g = fan[fan.scale == scale]
    earth = float(g[g.case == "earth"].dC_H2O.iloc[0])
    xs, ys = fan_pts(scale)
    for i in range(1, len(xs)):
        if (ys[i-1]-earth)*(ys[i]-earth) <= 0:
            return earth, xs[i-1] + (earth-ys[i-1])/(ys[i]-ys[i-1])*(xs[i]-xs[i-1]), False
    # No clean bracket: extrapolate from the last two valid points if still descending.
    if len(xs) >= 2 and ys[-1] > earth and ys[-1] < ys[-2]:
        slope = (ys[-1]-ys[-2])/(xs[-1]-xs[-2])
        return earth, xs[-1] + (earth-ys[-1])/slope, True
    return earth, np.nan, True

# ---- F8: fan sweep by scale ----
fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 4.6), gridspec_kw={"width_ratios": [2, 1]})
speeds, approx = {}, {}
for s in SCALES:
    xs, ys = fan_pts(s)
    earth, xc, ex = cross(s)
    speeds[s], approx[s] = xc, ex
    a1.plot(xs, ys, "o-", color=SCOL[s], label=f"{s}")
    a1.axhline(earth, color=SCOL[s], ls="--", lw=1, alpha=0.7)
    if not np.isnan(xc) and xc <= xs.max() + 1:
        a1.plot([xc], [earth], "*", color=SCOL[s], ms=15, mec="k", mew=0.5)
a1.set_xlabel("forced airflow (cm/s)"); a1.set_ylabel("leaf-surface ΔC H$_2$O (mean, model units)")
a1.set_title("Ventilation nulls the µg penalty at every scale\n(dashed = each scale's Earth-1 g level; ★ = Earth-equivalent speed)")
a1.grid(alpha=0.25); a1.legend(title="scale")

sv = [speeds[s] for s in SCALES]
a2.bar(range(3), sv, color=[SCOL[s] for s in SCALES])
for i, (s, v) in enumerate(zip(SCALES, sv)):
    a2.text(i, v + 0.3, f"{v:.0f}{'*' if approx[s] else ''}", ha="center", fontsize=10, fontweight="bold")
a2.set_xticks(range(3)); a2.set_xticklabels(SCALES)
a2.set_ylabel("Earth-equivalent airflow (cm/s)")
a2.set_title("Denser canopy needs\nmore ventilation")
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
    ax.bar(np.arange(3) + (j - 1) * w, vals, w, label=h, color=HCOL[h])
ax.set_xticks(range(3)); ax.set_xticklabels(SCALES)
ax.set_ylabel("leaf-surface |ΔC CO$_2$| (model units)")
ax.set_title("Enclosure hardware × plant scale (microgravity)")
ax.grid(alpha=0.25, axis="y"); ax.legend(title="hardware")
fig.tight_layout(); fig.savefig(f"{FIG}/F9_hardware_by_scale.png", dpi=130)
plt.close(fig)

print("Earth-equivalent ventilation (cm/s):", {s: round(speeds[s], 1) for s in SCALES})
print("\nHardware surface |ΔC CO2| by scale:")
print(hw.to_string(index=False))
print("F8_fan_by_scale.png, F9_hardware_by_scale.png")
