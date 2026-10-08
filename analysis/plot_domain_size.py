"""F13: boundary-layer conductance vs chamber size (T17).

At 1 g the conductance is set locally by buoyant convection and barely moves with
chamber size; at 0 g it is set by diffusion to the ambient-held walls and keeps falling
as the chamber grows (in 2-D, as ~1/ln R, with no size-independent limit).

    python3 analysis/plot_domain_size.py
"""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

INK, MUTED, GRID = "#1F2933", "#52606D", "#E4E7EB"
COLOR = {"leaf": "#3B6EA5", "rosette": "#C46A2B"}


def main() -> None:
    t = pd.read_csv("results/tables/T17_domain_size.csv")
    fig, ax = plt.subplots(figsize=(7.2, 4.0), dpi=150, constrained_layout=True)
    for scale in ["leaf", "rosette"]:
        for g, ls, mk in [(1, "--", "s"), (0, "-", "o")]:
            d = t[(t.scale == scale) & (t.gravity_g == g)].sort_values("width_mm")
            ax.plot(d.width_mm, d.g_bl_mol_m2_s, ls=ls, marker=mk, color=COLOR[scale], lw=1.8, ms=6)
            last = d.iloc[-1]
            change = 100 * (last.g_bl_ratio_to_1x - 1)
            ax.annotate(f"{scale} · {'1 g' if g else '0 g'}  ({change:+.0f} %)", (last.width_mm, last.g_bl_mol_m2_s),
                        xytext=(6, 0), textcoords="offset points", va="center", fontsize=8, color=INK)
    ax.set_xlim(t.width_mm.min() - 3, t.width_mm.max() + 30)
    ax.set_ylim(0, 1.15)
    ax.set_xlabel("modelled chamber width (mm; height scales with it)", fontsize=8.5, color=MUTED)
    ax.set_ylabel("g_bl (mol m⁻² s⁻¹)", fontsize=8.5, color=MUTED)
    ax.set_title("1 g is a property of the plant; 0 g depends on the chamber\n"
                 "(same leaf and lattice spacing; change shown is at 2× the production chamber)",
                 fontsize=9.5, color=INK, loc="left")
    ax.grid(color=GRID, lw=0.6)
    ax.tick_params(labelsize=8, colors=MUTED)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    fig.savefig("results/figures/F13_domain_size.png", facecolor="white")
    print("wrote results/figures/F13_domain_size.png")


if __name__ == "__main__":
    main()
