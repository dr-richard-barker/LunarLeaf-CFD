"""F14: leaf boundary-layer conductance inside the real BRIC and CARA dishes (T19) vs the
generic open box (T13), at 1 g and 0 g.

Sealed BRIC is shown against its own bulk air (its whole atmosphere drifts); the
others against cabin ambient. Hollow 1 g sealed marker: not steady, and its depleted
dish air exceeds the Boussinesq limit.

    python3 analysis/plot_dish_hardware.py
"""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

INK, MUTED, GRID = "#1F2933", "#52606D", "#E4E7EB"
C1, C0 = "#3B6EA5", "#C46A2B"  # 1 g, 0 g


def main() -> None:
    t13 = pd.read_csv("results/tables/T13_boundary_layer.csv").set_index("scenario")
    t19 = pd.read_csv("results/tables/T19_dish_hardware.csv").set_index("job")
    rows = [
        ("Open box\n37 × 28 mm (T13)", t13.loc["leaf-earth", "g_bl_mol_m2_s"], t13.loc["leaf-ug", "g_bl_mol_m2_s"], False),
        ("BRIC dish\nopen to cabin", t19.loc["BRIC-mid_ambient_g1", "g_bl_vs_ambient"], t19.loc["BRIC-mid_ambient_g0", "g_bl_vs_ambient"], False),
        ("CARA dish\nopen to cabin", t19.loc["CARA-mid_ambient_g1", "g_bl_vs_ambient"], t19.loc["CARA-mid_ambient_g0", "g_bl_vs_ambient"], False),
        ("CARA dish\ntaped", t19.loc["CARA-mid_taped_g1", "g_bl_vs_ambient"], t19.loc["CARA-mid_taped_g0", "g_bl_vs_ambient"], False),
        ("BRIC dish\nsealed (vs dish air)", t19.loc["BRIC-mid_sealed_g1", "g_bl_vs_enclosure_bulk"], t19.loc["BRIC-mid_sealed_g0", "g_bl_vs_enclosure_bulk"], True),
    ]
    fig, ax = plt.subplots(figsize=(8.4, 4.2), dpi=150, constrained_layout=True)
    for i, (lab, g1, g0, caveat) in enumerate(rows):
        ax.plot([i, i], [g0, g1], color=GRID, lw=3, zorder=1)
        ax.scatter([i], [g1], s=70, color="white" if caveat else C1, edgecolor=C1, linewidth=2, zorder=3)
        ax.scatter([i], [g0], s=70, color=C0, zorder=3)
        ax.annotate(f"{g1 / g0:.2f}×", (i, (g1 + g0) / 2), xytext=(8, 0), textcoords="offset points",
                    va="center", fontsize=8, color=INK)
    ax.scatter([], [], s=50, color=C1, label="1 g")
    ax.scatter([], [], s=50, color=C0, label="0 g")
    ax.scatter([], [], s=50, color="white", edgecolor=C1, linewidth=2, label="1 g, indicative only")
    ax.set_xticks(range(len(rows)))
    ax.set_xticklabels([r[0] for r in rows], fontsize=8, color=INK)
    ax.set_ylabel("g_bl (mol m⁻² s⁻¹)", fontsize=8.5, color=MUTED)
    ax.set_ylim(0, 1.1)
    ax.set_title("In a real dish the leaf is boundary-layer-limited at 1 g too, so the 0 g penalty is smaller\n"
                 "(mid-range dish dimensions; label = Earth/0 g ratio)", fontsize=9.5, color=INK, loc="left")
    ax.legend(fontsize=8, frameon=False, loc="upper right")
    ax.grid(axis="y", color=GRID, lw=0.6)
    ax.tick_params(labelsize=8, colors=MUTED)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    fig.savefig("results/figures/F14_dish_hardware.png", facecolor="white")
    print("wrote results/figures/F14_dish_hardware.png")


if __name__ == "__main__":
    main()
