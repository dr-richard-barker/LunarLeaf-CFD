"""
0-D coupled enclosure–photosynthesis model: the growth consequence of the
transport differences. Photosynthesis is CO2-limited (compensation point Γ +
saturation K); the leaf surface CO2 is drawn below the dish-bulk CO2 by the
boundary-layer conductance g_bl (thick in µg, thin under forced airflow); and the
dish-bulk CO2 evolves by the enclosure exchange (BRIC sealed / CARA tape / VEGGIE
vented). Integrates net assimilation over a 12 h photoperiod and the carbon fixed.

Parameters are physically anchored where measured (A from Table 1) and stated
where assumed (dish geometry, tape permeance — no clean published value).
"""
import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

FIG, TAB = "results/figures", "results/tables"

# CO2 response (ppm): A(Cs) = Amax (Cs-Γ)/(Cs-Γ+K); Amax set so A(400)=3.85 (measured)
G, K = 50.0, 300.0
A_MEAS = 3.85                       # µmol CO2 m^-2 s^-1 at ambient (Table 1)
AMAX = A_MEAS * (400 - G + K) / (400 - G)
CA = 400.0                          # cabin/ambient CO2 (ppm)

# Boundary-layer conductance (mol m^-2 s^-1): Earth free convection vs µg diffusion
# (ratio from the CFD: µg surface gap ≈1.7× Earth ⇒ g_bl,µg ≈ g_bl,Earth/1.7)
GBL_EARTH, GBL_UG = 1.0, 0.59

# Dish (assumed): 60 mm plate, ~1 cm headspace; young rosette
V, RHO, ALEAF, ADISH = 30e-6, 41.6, 3e-4, 2.8e-3    # m^3, mol/m^3, m^2, m^2
G_TAPE = 0.006                      # micropore-tape permeance (mol m^-2 s^-1, assumed)

def assimilation(Cbulk, gbl):
    """Solve A with surface drawdown Cs = Cbulk - A/gbl (fixed-point)."""
    A = 2.0
    for _ in range(60):
        Cs = max(Cbulk - A / gbl, 0.0)
        A = AMAX * (Cs - G) / (Cs - G + K) if Cs > G else 0.0
    return A, Cs

def integrate(mode):
    dt, T = 2.0, 12 * 3600
    n = int(T / dt)
    C = CA
    gbl = GBL_EARTH if mode in ("VEGGIE", "Earth") else GBL_UG
    ts, As, Cs_hist, carbon = [], [], [], 0.0
    for i in range(n):
        if mode == "VEGGIE" or mode == "Earth":
            C = CA  # vented / open: bulk pinned at ambient
        A, Cs = assimilation(C, gbl)
        if mode == "BRIC":
            dC = -A * ALEAF / (V * RHO)                                  # sealed
        elif mode == "CARA":
            # ppm/s; the µmol↔mol (1e-6) and molefraction↔ppm (1e6) factors cancel.
            dC = (-A * ALEAF + G_TAPE * ADISH * (CA - C)) / (V * RHO)
        else:
            dC = 0.0
        C = max(C + dC * dt, G)
        carbon += A * ALEAF * dt                                         # µmol CO2 fixed
        if i % 30 == 0:
            ts.append(i * dt / 3600); As.append(A); Cs_hist.append(Cs)
    return np.array(ts), np.array(As), np.array(Cs_hist), carbon

modes = ["Earth", "VEGGIE", "CARA", "BRIC"]
col = {"Earth": "#9aa3bd", "VEGGIE": "#2fbf71", "CARA": "#2a7de1", "BRIC": "#e0654e"}
res = {m: integrate(m) for m in modes}

fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 4.6))
for m in modes:
    ts, As, _, _ = res[m]
    a1.plot(ts, As, color=col[m], lw=2, label=m)
a1.set_xlabel("time in light (h)"); a1.set_ylabel("net assimilation A (µmol CO$_2$ m$^{-2}$ s$^{-1}$)")
a1.set_title("Photosynthesis feedback: sealed dish (BRIC) collapses in minutes")
a1.grid(alpha=0.25); a1.legend()
a1.set_ylim(0, A_MEAS * 1.1)

carb = {m: res[m][3] * 1e-6 for m in modes}   # µmol -> mol... keep µmol; show relative
rel = {m: 100 * res[m][3] / res["Earth"][3] for m in modes}
a2.bar(range(len(modes)), [rel[m] for m in modes], color=[col[m] for m in modes])
for i, m in enumerate(modes):
    a2.text(i, rel[m] + 1.5, f"{rel[m]:.0f}%", ha="center", fontweight="bold")
a2.set_xticks(range(len(modes))); a2.set_xticklabels(modes)
a2.set_ylabel("12 h carbon fixed (% of Earth)")
a2.set_title("Integrated carbon gain over a photoperiod")
a2.grid(alpha=0.25, axis="y")
fig.tight_layout(); fig.savefig(f"{FIG}/F10_photosynthesis_feedback.png", dpi=130)
plt.close(fig)

rows = []
for m in modes:
    ts, As, _, _ = res[m]
    rows.append((m, f"{As[0]:.2f}", f"{As[-1]:.2f}", f"{rel[m]:.0f}"))
t11 = pd.DataFrame(rows, columns=["enclosure", "A start (µmol/m2/s)", "A end (µmol/m2/s)", "12h carbon (% Earth)"])
t11.to_csv(f"{TAB}/T11_photosynthesis_feedback.csv", index=False)
print(f"Amax={AMAX:.2f}, g_bl Earth/µg={GBL_EARTH}/{GBL_UG}, g_tape={G_TAPE}")
print(t11.to_string(index=False))
print("F10_photosynthesis_feedback.png, T11_photosynthesis_feedback.csv")
