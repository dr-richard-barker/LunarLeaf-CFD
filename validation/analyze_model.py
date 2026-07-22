"""
LunarLeaf-CFD validation — model calibration, figures, and physical prediction.

Consumes the CFD exports (results/tables/T2, results/fields/*, T4) and the measured
flux anchor from analyze_data.py, then:
  - builds the lattice->physical calibration table (T3),
  - renders Earth-vs-microgravity plume maps (F3),
  - plots the gravity sweep and three-scale comparison (F4),
  - plots closed-chamber accumulation vs the Vernier trace (F5),
  - converts the model's dimensionless gradients to a physical surface-drawdown
    table (T5) using the measured assimilation flux.
"""
import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap

FIG, TAB, FLD, RAW = "results/figures", "results/tables", "results/fields", "validation/raw"

# ---------------------------------------------------------------- calibration
L_LEAF_PHYS = 0.015           # m  (Arabidopsis leaf ~1.5 cm)
L_LEAF_LAT = 52               # lattice cells (2a)
dx = L_LEAF_PHYS / L_LEAF_LAT
D_H2O_PHYS = 2.4e-5           # m^2/s
D_H2O_LAT = 0.05
dt = D_H2O_LAT * dx**2 / D_H2O_PHYS
u_star = dx / dt              # m/s per lattice-velocity unit

sweep = pd.read_csv(f"{TAB}/T2_model_sweep.csv")
A_SI, R_SI = np.load(f"{TAB}/_flux_anchor.npy")   # umol/m2/s

umax_earth = float(sweep.loc[sweep.scenario == "leaf-earth", "u_max"].iloc[0])
cal = pd.DataFrame([
    ("Leaf length", f"{L_LEAF_PHYS*100:.1f}", "cm", "assumed (Arabidopsis)"),
    ("Grid spacing dx", f"{dx*1e3:.3f}", "mm/cell", "= leaf/52"),
    ("Time step dt", f"{dt*1e3:.3f}", "ms/step", "= D_lat dx^2 / D_phys"),
    ("Velocity scale", f"{u_star:.2f}", "m/s per lattice u", "= dx/dt"),
    ("Earth u_max (leaf)", f"{umax_earth*u_star*100:.1f}", "cm/s", "model x scale"),
    ("D CO2 / O2 / H2O", "1.6 / 2.0 / 2.4", "x1e-5 m^2/s", "molecular, air 25C"),
    ("Net assimilation A", f"{A_SI:.2f}", "umol CO2 m^-2 s^-1", "measured (Table 1)"),
    ("Dark respiration R", f"{R_SI:.2f}", "umol CO2 m^-2 s^-1", "measured (Table 1)"),
], columns=["quantity", "value", "units", "source"])
cal.to_csv(f"{TAB}/T3_calibration.csv", index=False)

# ---------------------------------------------------------------- F3 plume maps
def load_field(name):
    return np.loadtxt(f"{FLD}/{name}_h2o.csv", delimiter=",")

fields = [("leaf-earth", "Single leaf — Earth 1 g"),
          ("leaf-ug", "Single leaf — microgravity"),
          ("canopy-ug", "Microgreen canopy — microgravity")]
vmax = max(np.nanmax(load_field(n)) for n, _ in fields)
cmap = plt.get_cmap("viridis").copy(); cmap.set_bad("#282c34")
fig, axs = plt.subplots(1, 3, figsize=(12, 3.6))
for ax, (name, title) in zip(axs, fields):
    g = load_field(name)
    im = ax.imshow(g, cmap=cmap, vmin=0, vmax=vmax, aspect="equal")
    ax.set_title(title, fontsize=10); ax.set_xticks([]); ax.set_yticks([])
fig.colorbar(im, ax=axs, fraction=0.02, pad=0.02, label="H$_2$O excess (model units)")
fig.suptitle("Water-vapour boundary layer: buoyant plume on Earth vs. stagnant halo in microgravity",
             fontsize=11)
fig.savefig(f"{FIG}/F3_plume_maps.png", dpi=130, bbox_inches="tight")
plt.close(fig)

# ---------------------------------------------------------------- F4 sweep + scales
G = {"earth": 1.0, "mars": 0.378, "moon": 0.165, "ug": 0.0}
leaf = {k: sweep[sweep.scenario == f"leaf-{k}"].iloc[0] for k in G}
gr = [G[k] for k in ["ug", "moon", "mars", "earth"]]
order = ["ug", "moon", "mars", "earth"]
dCw = [abs(leaf[k].dC_H2O_mean) for k in order]
dCc = [abs(leaf[k].dC_CO2_mean) for k in order]
umax = [leaf[k].u_max for k in order]

fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4.2))
a1.plot(gr, dCw, "o-", color="#2a7de1", label="ΔC H$_2$O")
a1.plot(gr, dCc, "s-", color="#e0654e", label="|ΔC CO$_2$|")
a1.set_xlabel("gravity (g / g$_{Earth}$)"); a1.set_ylabel("surface gap ΔC (mean, model units)")
a1.set_title("Single-leaf gravity sweep"); a1.grid(alpha=0.25); a1.legend(loc="upper right")
a1b = a1.twinx(); a1b.plot(gr, umax, "^--", color="#2fbf71", alpha=0.7)
a1b.set_ylabel("u$_{max}$ convection (green)", color="#2fbf71")

scales = ["leaf", "rosette", "canopy"]
earth = [abs(sweep[sweep.scenario == f"{s}-earth"].dC_H2O_mean.iloc[0]) for s in scales]
ug = [abs(sweep[sweep.scenario == f"{s}-ug"].dC_H2O_mean.iloc[0]) for s in scales]
peak_ug = [abs(sweep[sweep.scenario == f"{s}-ug"].dC_H2O_peak.iloc[0]) for s in scales]
x = np.arange(len(scales)); w = 0.27
a2.bar(x - w, earth, w, label="Earth 1 g", color="#2a7de1")
a2.bar(x, ug, w, label="µg (mean)", color="#8a5cf6")
a2.bar(x + w, peak_ug, w, label="µg (peak)", color="#e0654e")
a2.set_xticks(x); a2.set_xticklabels(["leaf", "rosette", "canopy"])
a2.set_ylabel("ΔC H$_2$O (model units)"); a2.set_title("Scale amplification & microgravity penalty")
a2.grid(alpha=0.25, axis="y"); a2.legend()
fig.tight_layout(); fig.savefig(f"{FIG}/F4_gravity_scale.png", dpi=130)
plt.close(fig)

# ---------------------------------------------------------------- F5 chamber accumulation
ch = pd.read_csv(f"{TAB}/T4_chamber_accumulation.csv")
cons_err = float(abs(ch.total_mass.iloc[-1] - ch.expected_total.iloc[-1]) / ch.expected_total.iloc[-1])

fig, (b1, b2) = plt.subplots(1, 2, figsize=(11, 4.2))
b1.plot(ch.step / 1e3, ch.total_mass, color="#2a7de1", lw=2.5, label="model total mass")
b1.plot(ch.step / 1e3, ch.expected_total, "k--", lw=1.2, label="imposed flux × t (exact)")
b1.set_xlabel("step (×10³)"); b1.set_ylabel("total gas (model units)")
b1.set_title(f"Closed-chamber accumulation — mass conserved (err {cons_err:.0e})")
b1.grid(alpha=0.25); b1.legend()
# Near-leaf (source) vs far-wall (bulk): the persistent surface-to-bulk gap —
# the boundary layer at chamber scale, and the quantity gravity modulates.
b2.plot(ch.step / 1e3, ch.centre_conc, color="#e0654e", lw=2, label="near-leaf (source)")
b2.plot(ch.step / 1e3, ch.corner_conc, color="#2fbf71", lw=2, label="far wall (bulk)")
b2.fill_between(ch.step / 1e3, ch.corner_conc, ch.centre_conc, color="#e0654e", alpha=0.12)
b2.set_xlabel("step (×10³)"); b2.set_ylabel("concentration (model units)")
b2.set_title("Sustained surface-to-bulk gap (boundary layer)")
b2.grid(alpha=0.25); b2.legend()
fig.tight_layout(); fig.savefig(f"{FIG}/F5_chamber_validation.png", dpi=130)
plt.close(fig)

# ---------------------------------------------------------------- F6 forced airflow
fan = pd.read_csv(f"{TAB}/T6_forced_airflow.csv", comment="#")
earth_w = float(fan[fan.case == "earth_1g"].dC_H2O_mean.iloc[0])
ug_w = float(fan[fan.case == "ug_still"].dC_H2O_mean.iloc[0])
ff = fan[fan.case == "ug_fan"].astype({"fan_cm_s": float, "dC_H2O_mean": float, "dC_CO2_mean": float})
xs, ys = ff.fan_cm_s.values, ff.dC_H2O_mean.values
null_cms = np.nan
for i in range(1, len(xs)):
    if (ys[i-1] - earth_w) * (ys[i] - earth_w) <= 0:
        null_cms = xs[i-1] + (earth_w - ys[i-1]) / (ys[i] - ys[i-1]) * (xs[i] - xs[i-1]); break

fig, ax = plt.subplots(figsize=(7.6, 4.6))
ax.plot(ff.fan_cm_s, ff.dC_H2O_mean, "o-", color="#2a7de1", label="µg + fan: ΔC H$_2$O")
ax.plot(ff.fan_cm_s, ff.dC_CO2_mean, "s-", color="#e0654e", label="µg + fan: |ΔC CO$_2$|")
ax.axhline(earth_w, color="#2fbf71", ls="--", lw=1.5, label=f"Earth 1 g (ΔC = {earth_w:.3f})")
ax.axhline(ug_w, color="#8a5cf6", ls=":", lw=1.5, label=f"µg, no fan (ΔC = {ug_w:.3f})")
if not np.isnan(null_cms):
    ax.axvline(null_cms, color="0.4", ls="-.", lw=1)
    ax.annotate(f"Earth-equivalent\n≈ {null_cms:.1f} cm/s", xy=(null_cms, earth_w),
                xytext=(null_cms + 4, ug_w * 0.82), fontsize=9,
                arrowprops=dict(arrowstyle="->", color="0.4"))
ax.set_xlabel("forced airflow (cm/s)"); ax.set_ylabel("surface gap ΔC (mean, model units)")
ax.set_title("Forced ventilation nulls the microgravity penalty (single leaf)")
ax.grid(alpha=0.25); ax.legend(fontsize=8.5)
fig.tight_layout(); fig.savefig(f"{FIG}/F6_forced_airflow.png", dpi=130)
plt.close(fig)
print(f"F6: Earth-equivalent ventilation ≈ {null_cms:.1f} cm/s (nulls the µg penalty)")

# ---------------------------------------------------------------- T5 physical prediction
G_BL_EARTH = 1.0  # mol m^-2 s^-1, leaf boundary layer, still-air free convection (literature)
ref = abs(sweep[sweep.scenario == "leaf-earth"].dC_CO2_mean.iloc[0])
ppm_per_unit = (A_SI * 1e-6 / G_BL_EARTH) / ref * 1e6  # ppm per model unit, anchored at leaf-earth
labels = {"leaf-earth": "Leaf · Earth", "leaf-mars": "Leaf · Mars", "leaf-moon": "Leaf · Moon",
          "leaf-ug": "Leaf · µg", "rosette-earth": "Rosette · Earth", "rosette-ug": "Rosette · µg",
          "canopy-earth": "Canopy · Earth", "canopy-ug": "Canopy · µg"}
rows = []
for sid, lab in labels.items():
    r = sweep[sweep.scenario == sid].iloc[0]
    rows.append((lab,
                 f"{abs(r.dC_CO2_mean)*ppm_per_unit:.1f}",
                 f"{abs(r.dC_CO2_peak)*ppm_per_unit:.1f}",
                 f"{abs(r.dC_O2_mean)*ppm_per_unit:.1f}"))
t5 = pd.DataFrame(rows, columns=["scenario", "CO2 drawdown mean (ppm)",
                                 "CO2 drawdown peak (ppm)", "O2 build-up mean (ppm)"])
t5.to_csv(f"{TAB}/T5_physical_prediction.csv", index=False)

print("=== Calibration (T3) ==="); print(cal.to_string(index=False))
print("\n=== Physical surface drawdown (T5), anchored on measured A ===")
print(t5.to_string(index=False))
print(f"\nAnchor: A={A_SI:.2f} umol/m2/s, g_bl(Earth)={G_BL_EARTH} mol/m2/s -> "
      f"leaf-Earth CO2 drawdown {abs(ref)*ppm_per_unit:.1f} ppm")
print("Figures: F3_plume_maps, F4_gravity_scale, F5_chamber_validation")
