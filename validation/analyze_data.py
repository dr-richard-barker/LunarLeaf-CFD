"""
LunarLeaf-CFD validation — measured gas-exchange analysis.

Reads the Vernier whole-chamber time series and the Millar-group whole-plant
chamber biomass/gas-exchange workbook, derives the physical stomatal flux used
to calibrate the CFD model, and writes tables + figures to results/.

Data provenance:
  Arabidopsis_v{2,3}_ExportedData.csv  — Vernier O2/RH/temperature chamber logs.
  Biomass_FW_DW_gas_exchange_data.xlsx — Chew/Millar (Univ. Edinburgh), whole-
      plant chamber net assimilation + respiration per rosette area.
"""
import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

RAW = "validation/raw"
FIG = "results/figures"
TAB = "results/tables"
os.makedirs(FIG, exist_ok=True)
os.makedirs(TAB, exist_ok=True)

# ---------------------------------------------------------------- Vernier trace
df = pd.read_csv(f"{RAW}/Arabidopsis_v2_ExportedData.csv")
t = pd.to_numeric(df.iloc[:, 1], errors="coerce").values
o2 = pd.to_numeric(df.iloc[:, 2], errors="coerce").values
temp = pd.to_numeric(df.iloc[:, 3], errors="coerce").values
rh = pd.to_numeric(df.iloc[:, 4], errors="coerce").values
ah = pd.to_numeric(df.iloc[:, 5], errors="coerce").values
days = t / 86400.0
dt = np.median(np.diff(t))

# Fig 1 — the raw multi-day chamber trace
fig, ax = plt.subplots(4, 1, figsize=(8, 8.5), sharex=True)
ax[0].plot(days, o2, color="#2a7de1", lw=0.8); ax[0].set_ylabel("O$_2$ (%)")
ax[0].set_title("Vernier whole-chamber trace — Arabidopsis, 4.8 days")
ax[1].plot(days, temp, color="#e0654e", lw=0.8); ax[1].set_ylabel("Temp (°C)")
ax[2].plot(days, rh, color="#2fbf71", lw=0.8); ax[2].set_ylabel("RH (%)")
ax[3].plot(days, ah, color="#8a5cf6", lw=0.8); ax[3].set_ylabel("Abs. hum.\n(g m$^{-3}$)")
ax[3].set_xlabel("time (days)")
for a in ax: a.grid(alpha=0.25)
fig.tight_layout(); fig.savefig(f"{FIG}/F1_vernier_timeseries.png", dpi=130)
plt.close(fig)

# Diel O2 slopes over 1-hour windows → whole-chamber gas-exchange signal
win = int(round(3600 / dt))
slope = (o2[win:] - o2[:-win]) / 3600.0          # % s^-1
o2_up = np.nanmax(slope) * 3600.0                # % h^-1 (peak photosynthesis)
o2_dn = np.nanmin(slope) * 3600.0                # % h^-1 (peak respiration)
ah_win = (ah[win:] - ah[:-win]) / 3600.0
ah_up = np.nanmax(ah_win) * 3600.0               # g m^-3 h^-1

# Chamber constants (from the workbook, L&H1)
V = 339.29e-6      # m^3
RHO = 41.57        # mol m^-3
AREA = 26.0e-4     # m^2 (representative rosette area)
def flux_o2(pc_per_h):  # % h^-1 -> umol m^-2 s^-1
    return (pc_per_h / 100.0) * V * RHO / AREA / 3600.0 * 1e6
o2_flux_gross = flux_o2(o2_up)
transp = ah_up / 3600.0 * V / AREA / 18.015 * 1e3   # mmol H2O m^-2 s^-1

# Fig 2 — one representative diel cycle with slope fits
day_lo, day_hi = 2.0, 3.2
m = (days >= day_lo) & (days <= day_hi)
fig2, a2 = plt.subplots(figsize=(7.2, 4.2))
a2.plot(days[m], o2[m], color="#2a7de1", lw=1.4, label="O$_2$ (%)")
a2.set_xlabel("time (days)"); a2.set_ylabel("O$_2$ (%)")
a2.set_title("Diel O$_2$ cycling → photosynthesis / respiration flux")
# annotate peak rise/fall
a2.grid(alpha=0.25)
a2.text(0.02, 0.95,
        f"peak O$_2$ rise {o2_up:.1f} %/h\npeak O$_2$ fall {o2_dn:.1f} %/h",
        transform=a2.transAxes, va="top", fontsize=9,
        bbox=dict(fc="white", ec="0.7"))
fig2.tight_layout(); fig2.savefig(f"{FIG}/F2_diel_flux.png", dpi=130)
plt.close(fig2)

# ---------------------------------------------------------------- Biomass sheet
xl = pd.ExcelFile(f"{RAW}/Biomass_FW_DW_gas_exchange_data.xlsx")
lh1 = xl.parse("L&H 1", header=None)
# Col wild-type average row (r13): per-cm2 A rate col 20, R rate col 21.
A_area = float(lh1.iloc[13, 20])   # umol CO2 / h / cm2
R_area = float(lh1.iloc[13, 21])   # umol CO2 / h / cm2 (negative)
A_persec_plant = float(pd.to_numeric(lh1.iloc[8:13, 5], errors="coerce").mean())  # umol/s per plant
A_SI = A_area / 3600.0 * 1e4       # umol m^-2 s^-1
R_SI = abs(R_area) / 3600.0 * 1e4

# ---------------------------------------------------------------- Table 1
rows = [
    ("Net CO2 assimilation A", f"{A_area:.2f}", "umol CO2 h^-1 cm^-2", "Biomass L&H1 (Col mean)"),
    ("Net CO2 assimilation A", f"{A_SI:.2f}", "umol m^-2 s^-1", "= converted"),
    ("Dark respiration R", f"{abs(R_area):.2f}", "umol CO2 h^-1 cm^-2", "Biomass L&H1 (Col mean)"),
    ("Dark respiration R", f"{R_SI:.2f}", "umol m^-2 s^-1", "= converted"),
    ("A per plant", f"{A_persec_plant:.4f}", "umol s^-1", "Biomass L&H1"),
    ("Chamber volume", "339", "cm^3", "Biomass L&H1 (12x3 cm)"),
    ("Rosette area (representative)", "26", "cm^2", "Biomass L&H1"),
    ("Chamber air density", "41.6", "mol m^-3", "Biomass L&H1"),
    ("Vernier O2 diel range", f"{np.nanmin(o2):.1f}-{np.nanmax(o2):.1f}", "%", "Vernier v2"),
    ("Vernier peak O2 evolution", f"{o2_up:.1f}", "% h^-1", "Vernier v2"),
    ("Vernier peak O2 uptake", f"{o2_dn:.1f}", "% h^-1", "Vernier v2"),
    ("Vernier gross O2 flux (area-dep.)", f"{o2_flux_gross:.0f}", "umol m^-2 s^-1", "Vernier v2 + chamber"),
    ("Transpiration (closed, near-sat.)", f"{transp:.3f}", "mmol H2O m^-2 s^-1", "Vernier v2 abs. hum."),
]
t1 = pd.DataFrame(rows, columns=["quantity", "value", "units", "source"])
t1.to_csv(f"{TAB}/T1_measured_gas_exchange.csv", index=False)

print("=== Measured gas exchange (Table 1) ===")
print(t1.to_string(index=False))
print(f"\nDerived: A_SI={A_SI:.2f} umol/m2/s, R_SI={R_SI:.2f}, R/A={R_SI/A_SI:.2f}")
print("Figures: F1_vernier_timeseries.png, F2_diel_flux.png")
# stash key numbers for the model/calibration script
np.save(f"{TAB}/_flux_anchor.npy", np.array([A_SI, R_SI]))
