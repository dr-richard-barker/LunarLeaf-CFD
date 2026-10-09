"""F17: sealed BRIC dish with humidity-limited transpiration (T22) vs constant transpiration (T20).

Left: leaf conductance to the dish air at 1 g for three saturation levels, at 0 g, and
the T20 run with constant transpiration (whose late collapse is the flow runaway, T21).
Right: transpiration and assimilation (% of potential) and dish humidity (% of saturation), central saturation level.

    python3 analysis/plot_dish_humidity.py
"""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

INK, MUTED, GRID = "#1F2933", "#52606D", "#E4E7EB"


def main() -> None:
    t22 = pd.read_csv("results/tables/T22_dish_humidity.csv")
    # The first T20 (constant transpiration), kept for comparison; T20 itself is now humidity-limited.
    t20 = pd.read_csv("results/tables/T20_dish_feedback_constant_transpiration.csv")
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(10.4, 3.9), dpi=150, constrained_layout=True)
    ref = t20[(t20.job == "BRIC_sealed_fb_g1") & (t20.t_s <= 250)]
    a1.plot(ref.t_s / 60, ref.g_bl_vs_dish_air, color="#9AA5B1", lw=1.6, ls="--", label="1 g, constant transpiration (first T20)")
    for run, col, lab in [("sat0.65_g1", "#7FA8D8", "1 g, saturation 0.65"), ("sat1.3_g1", "#3B6EA5", "1 g, saturation 1.3"),
                          ("sat2.6_g1", "#1B3557", "1 g, saturation 2.6"), ("sat1.3_g0", "#C46A2B", "0 g, saturation 1.3")]:
        d = t22[(t22.run == run) & (t22.net_assimilation_pct > 2)]
        a1.plot(d.t_s / 60, d.g_bl_vs_dish_air, color=col, lw=1.8, label=lab)
    a1.set_ylim(0, 0.5)
    a1.set_ylabel("g_bl to the dish air (mol m⁻² s⁻¹)", fontsize=8.5, color=MUTED)
    a1.set_title("With saturation, 1 g convection dies away and g_bl\nconverges on the 0 g value; no runaway",
                 fontsize=9, color=INK, loc="left")
    a1.legend(fontsize=7, frameon=False, loc="lower left")
    c = t22[t22.run == "sat1.3_g1"]
    a2.plot(c.t_s / 60, c.transpiration_pct, color="#2A9D8F", lw=1.8, label="transpiration (% potential)")
    a2.plot(c.t_s / 60, c.net_assimilation_pct, color="#3B6EA5", lw=1.8, label="net assimilation (% potential)")
    a2.plot(c.t_s / 60, c.dish_mean_H2O / 1.3 * 100, color="#C46A2B", lw=1.6, ls=":", label="dish humidity (% of saturation)")
    a2.set_ylim(0, 105)
    a2.set_ylabel("%", fontsize=8.5, color=MUTED)
    a2.set_title("The dish saturates in 1–2 min, so transpiration stops long\nbefore CO₂ runs out (saturation 1.3, 1 g)",
                 fontsize=9, color=INK, loc="left")
    a2.legend(fontsize=7, frameon=False, loc="center right")
    for ax in (a1, a2):
        ax.set_xlabel("time in the dish (min)", fontsize=8.5, color=MUTED)
        ax.grid(color=GRID, lw=0.6)
        ax.tick_params(labelsize=8, colors=MUTED)
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
    fig.savefig("results/figures/F17_dish_humidity.png", facecolor="white")
    print("wrote results/figures/F17_dish_humidity.png")


if __name__ == "__main__":
    main()
