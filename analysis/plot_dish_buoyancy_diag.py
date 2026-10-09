"""F16: what drives the 1 g conductance in the sealed BRIC dish (T21, with T20 as reference).

Left: g_bl to the dish air over time for four sealed-BRIC 1 g runs. Right: peak flow
speed (lattice units, log scale) for the T21 runs, showing the late runaway in the
H₂O-only run when transpiration keeps adding humidity to the sealed dish.

    python3 analysis/plot_dish_buoyancy_diag.py
"""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

INK, MUTED, GRID = "#1F2933", "#52606D", "#E4E7EB"
STYLE = {
    "reference": ("all species + feedback (T20, constant transpiration)", "#1F2933", "-"),
    "constflux": ("all species, fixed uptake", "#3B6EA5", "--"),
    "H2Oonly": ("H₂O buoyancy only", "#2A9D8F", "-"),
    "noH2O": ("CO₂ + O₂ buoyancy only", "#C46A2B", "-"),
}


def main() -> None:
    t21 = pd.read_csv("results/tables/T21_dish_buoyancy_diag.csv")
    # The first T20 (constant transpiration), kept for comparison; T20 itself is now humidity-limited.
    t20 = pd.read_csv("results/tables/T20_dish_feedback_constant_transpiration.csv")
    ref = t20[t20.job == "BRIC_sealed_fb_g1"].rename(columns={"g_bl_vs_dish_air": "g"})
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(10.4, 3.9), dpi=150, constrained_layout=True)
    series = {"reference": ref.assign(u=float("nan"))}
    for run in ["constflux", "H2Oonly", "noH2O"]:
        series[run] = t21[t21.run == run].rename(columns={"g_bl_vs_dish_air": "g", "u_max_lattice": "u"})
    for key, d in series.items():
        lab, col, ls = STYLE[key]
        d = d[d.t_s <= 250]
        a1.plot(d.t_s / 60, d.g, color=col, ls=ls, lw=1.6, label=lab)
        if key != "reference":
            a2.plot(d.t_s / 60, d.u, color=col, ls=ls, lw=1.6, label=lab)
    a1.axvspan(3.6, 250 / 60, color=GRID, alpha=0.6, lw=0)
    a1.text(3.65, 0.47, "runaway\n(see right)", fontsize=7, color=MUTED, va="top")
    a1.set_ylim(0, 0.5)
    a1.set_ylabel("g_bl to the dish air (mol m⁻² s⁻¹)", fontsize=8.5, color=MUTED)
    a1.set_title("Rise at 0.5–1 min is convection onset (also without feedback);\n"
                 "transpiration keeps it up as photosynthesis fades", fontsize=9, color=INK, loc="left")
    a2.set_yscale("log")
    a2.axhline(0.17, color=MUTED, lw=0.8, ls=":")
    a2.text(0.1, 0.18, "Ma ≈ 0.3", fontsize=7, color=MUTED)
    a2.set_ylabel("peak flow speed (lattice units)", fontsize=8.5, color=MUTED)
    a2.set_title("With H₂O-only buoyancy the flow runs away after ~3.7 min", fontsize=9, color=INK, loc="left")
    for ax in (a1, a2):
        ax.set_xlabel("time in the dish (min)", fontsize=8.5, color=MUTED)
        ax.grid(color=GRID, lw=0.6)
        ax.tick_params(labelsize=8, colors=MUTED)
        for s in ("top", "right"):
            ax.spines[s].set_visible(False)
    a1.legend(fontsize=7, frameon=False, loc="lower left")
    fig.savefig("results/figures/F16_dish_buoyancy_diag.png", facecolor="white")
    print("wrote results/figures/F16_dish_buoyancy_diag.png")


if __name__ == "__main__":
    main()
