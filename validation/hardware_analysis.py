"""
Spaceflight-hardware comparison figure + analytic enclosure-atmosphere timescales.
Reads results/tables/T7_hardware_timeseries.csv (model) and writes F7 + T8.
"""
import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

FIG, TAB = "results/figures", "results/tables"
df = pd.read_csv(f"{TAB}/T7_hardware_timeseries.csv")

colors = {"BRIC light": "#e0654e", "BRIC dark": "#b5462f", "CARA tape": "#2a7de1",
          "VEGGIE vented": "#2fbf71", "open (ref)": "#9aa3bd"}

fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 4.6))
# Panel A — enclosure (dish-mean) CO2 excess vs time: does it drift or settle?
# Only the enclosed dishes have a dish-mean; vented cases sit at ambient (0).
for name in ["BRIC light", "BRIC dark", "CARA tape"]:
    g = df[df.case == name]
    a1.plot(g.step / 1e3, g.dishmean_co2, lw=2.2, color=colors.get(name, "0.5"), label=name)
a1.axhline(0, color="0.5", lw=1.2, ls="--", label="ambient (VEGGIE / vented)")
a1.set_xlabel("step (×10³, model ≈ 0.17 ms/step)"); a1.set_ylabel("dish-mean CO$_2$ excess (model units)")
a1.set_title("Enclosure atmosphere: BRIC drifts, tape holds ~ambient")
a1.grid(alpha=0.25); a1.legend(fontsize=8.5)

# Panel B — steady leaf-surface CO2 gap by hardware (last step)
last = df.sort_values("step").groupby("case").tail(1).set_index("case")
order = ["BRIC light", "CARA tape", "VEGGIE vented", "open (ref)"]
vals = [abs(last.loc[n, "surf_co2_mean"]) for n in order]
a2.bar(range(len(order)), vals, color=[colors[n] for n in order])
a2.set_xticks(range(len(order))); a2.set_xticklabels(["BRIC\n(sealed)", "CARA\n(tape)", "VEGGIE\n(vented)", "open\n(ref)"])
a2.set_ylabel("leaf-surface |ΔC CO$_2$| (model units)")
a2.set_title("Leaf-surface gas gradient by hardware")
a2.grid(alpha=0.25, axis="y")
fig.tight_layout(); fig.savefig(f"{FIG}/F7_hardware_compare.png", dpi=130)
plt.close(fig)

# ---- Analytic enclosure-atmosphere timescales (sealed BRIC) ----
V = 30e-6        # m^3, ~60 mm dish headspace (~1 cm)
A_LEAF = 3e-4    # m^2, young seedling rosette
RHO = 41.6       # mol m^-3
A = 3.85e-6      # mol CO2 m^-2 s^-1 (assimilation, measured)
R = 1.18e-6      # mol m^-2 s^-1 (respiration, measured)
rate_fix = A * A_LEAF      # mol/s CO2 consumed (light)
rate_resp = R * A_LEAF     # mol/s CO2 released / O2 consumed (dark)

def hrs(mol, rate):
    return mol / rate / 3600.0

co2_avail = 400e-6 * V * RHO                 # mol CO2 at 400 ppm
o2_to_hypoxia = (0.21 - 0.05) * V * RHO      # mol O2 from 21% to 5%
co2_to_1pct = (0.01 - 400e-6) * V * RHO      # mol CO2 to reach 1%

rows = [
    ("BRIC light: CO2 400->~0 ppm (photosynthesis self-limits)", f"{hrs(co2_avail, rate_fix)*60:.0f}", "minutes"),
    ("BRIC dark: CO2 400 ppm -> 1% (stress)", f"{hrs(co2_to_1pct, rate_resp):.1f}", "hours"),
    ("BRIC dark: O2 21% -> 5% (hypoxia)", f"{hrs(o2_to_hypoxia, rate_resp)/24:.1f}", "days"),
    ("CARA / VEGGIE: enclosure vents to cabin", "bounded", "steady near ambient"),
]
t8 = pd.DataFrame(rows, columns=["enclosure atmosphere event", "time", "unit"])
t8.to_csv(f"{TAB}/T8_enclosure_timescales.csv", index=False)

print("=== Sealed-dish (BRIC) atmosphere timescales ===")
print(f"assumptions: dish air {V*1e6:.0f} cm3, leaf area {A_LEAF*1e4:.0f} cm2, "
      f"A={A*1e6:.2f}/R={R*1e6:.2f} umol/m2/s")
print(t8.to_string(index=False))
print("\nSteady leaf-surface |ΔC CO2| (model units):")
for n in order:
    print(f"  {n:14s} {abs(last.loc[n,'surf_co2_mean']):.3f}   dish-mean {last.loc[n,'dishmean_co2']:+.3f}")
print("F7_hardware_compare.png, T8_enclosure_timescales.csv")
