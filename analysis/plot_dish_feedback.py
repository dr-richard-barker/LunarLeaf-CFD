"""F15: sealed BRIC dish with CO₂-limited photosynthesis (T20).

Left: net assimilation (% of potential) over time at 1 g and 0 g. The dish runs out of
CO₂ at almost the same rate under either gravity.
Right: leaf conductance to the dish's own air, shown only while assimilation is > 10 %
(below that the surface gap vanishes and the ratio is ill-conditioned).

    python3 analysis/plot_dish_feedback.py
"""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

INK, MUTED, GRID = "#1F2933", "#52606D", "#E4E7EB"
COL = {1: "#3B6EA5", 0: "#C46A2B"}


def main() -> None:
    t = pd.read_csv("results/tables/T20_dish_feedback.csv")
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(10, 3.8), dpi=150, constrained_layout=True)
    for g in (1, 0):
        d = t[t.job == f"BRIC_sealed_fb_g{g}"]
        lab = "1 g" if g else "0 g"
        a1.plot(d.t_s / 60, d.net_assimilation_pct, color=COL[g], lw=1.8)
        a1.annotate(lab, (d.t_s.iloc[len(d) // 3] / 60, d.net_assimilation_pct.iloc[len(d) // 3]),
                    xytext=(6, 4 if g else -12), textcoords="offset points", fontsize=8, color=INK)
        v = d[d.net_assimilation_pct > 10]
        a2.plot(v.t_s / 60, v.g_bl_vs_dish_air, color=COL[g], lw=1.8)
        a2.annotate(lab, (v.t_s.iloc[-1] / 60, v.g_bl_vs_dish_air.iloc[-1]), xytext=(4, 0),
                    textcoords="offset points", va="center", fontsize=8, color=INK)
    a1.axhline(10, color=MUTED, lw=0.8, ls=":")
    a1.set_ylabel("net assimilation (% of potential)", fontsize=8.5, color=MUTED)
    a1.set_title("The sealed dish runs out of CO₂ in ~3.5 min at either gravity", fontsize=9.5, color=INK, loc="left")
    a2.set_ylabel("g_bl to the dish air (mol m⁻² s⁻¹)", fontsize=8.5, color=MUTED)
    a2.set_ylim(0, 0.5)
    a2.set_title("Conductance while assimilation > 10 %:\n0 g constant at 0.19; 1 g rises from 0.33 to ≈ 0.40",
                 fontsize=9.5, color=INK, loc="left")
    for ax in (a1, a2):
        ax.set_xlabel("time in the dish (min)", fontsize=8.5, color=MUTED)
        ax.grid(color=GRID, lw=0.6)
        ax.tick_params(labelsize=8, colors=MUTED)
        for s in ("top", "right"):
            ax.spines[s].set_visible(False)
    fig.savefig("results/figures/F15_dish_feedback.png", facecolor="white")
    print("wrote results/figures/F15_dish_feedback.png")


if __name__ == "__main__":
    main()
