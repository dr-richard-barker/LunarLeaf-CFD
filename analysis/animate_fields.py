"""Side-by-side field animations with one pinned colour scale.

Reads the <id>_h2o_frames.f32/.json dumps written by validation/timeseries.ts and
renders scenarios next to each other (e.g. 1 g vs 0 g) as a GIF. Two rules borrowed
from the microgreen-chamber-cfd project (scripts/render_animation.py, make_gif.py,
microgreen-chamber-cfd @ 6ac89c1):

  * one colour range for every frame and every panel, computed once over the whole
    record, so a colour means the same concentration everywhere (no per-frame
    auto-rescale);
  * a linear and a log version, because a strong near-leaf gradient and a weak
    far-field plume cannot both be read on one linear scale.

GIF frames are quantised without dithering so smooth colour ramps don't speckle.

    python3 analysis/animate_fields.py leaf-earth leaf-ug --out results/animations/leaf_1g_vs_0g
"""
from __future__ import annotations

import argparse
import json
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib.colors import LinearSegmentedColormap, LogNorm, Normalize  # noqa: E402
from PIL import Image  # noqa: E402

# Single-hue sequential ramp, light → CoSE navy (#2F5985 deepened for range).
SEQ = LinearSegmentedColormap.from_list("cose_seq", ["#F4F8FB", "#9CC3E0", "#3B6EA5", "#1B3557"])
SEQ.set_bad("#7A7A7A")  # solids (leaf, walls) in neutral gray

DX_MM = 0.288


def load(ts_dir: str, sid: str) -> tuple[np.ndarray, dict]:
    meta = json.load(open(os.path.join(ts_dir, f"{sid}_h2o_frames.json")))
    raw = np.fromfile(os.path.join(ts_dir, f"{sid}_h2o_frames.f32"), dtype="<f4")
    return raw.reshape(len(meta["steps"]), meta["ny"], meta["nx"]), meta


def render(ids: list[str], ts_dir: str, out: str, log: bool, fps: int, labels: list[str] | None) -> str:
    data = [load(ts_dir, s) for s in ids]
    n = min(len(m["steps"]) for _, m in data)
    stack = np.concatenate([f[:n].ravel() for f, _ in data])
    hi = float(np.nanmax(stack))
    lo = hi * 1e-3 if log else 0.0
    norm = LogNorm(vmin=lo, vmax=hi, clip=True) if log else Normalize(vmin=lo, vmax=hi)

    ny, nx = data[0][0].shape[1:]
    ext = [0, nx * DX_MM, 0, ny * DX_MM]
    frames_png = []
    os.makedirs(out, exist_ok=True)
    for k in range(n):
        fig, axes = plt.subplots(1, len(ids), figsize=(3.6 * len(ids) + 0.9, 3.2), dpi=110, constrained_layout=True)
        axes = np.atleast_1d(axes)
        for ax, (fr, meta), lab in zip(axes, data, labels or ids):
            im = ax.imshow(np.ma.masked_invalid(fr[k]), cmap=SEQ, norm=norm, extent=ext, interpolation="nearest")
            ax.set_title(lab, fontsize=10, color="#1F2933")
            ax.set_xlabel("x (mm)", fontsize=8, color="#52606D")
            ax.tick_params(labelsize=7, colors="#52606D")
            for s in ax.spines.values():
                s.set_visible(False)
        axes[0].set_ylabel("y (mm)", fontsize=8, color="#52606D")
        cb = fig.colorbar(im, ax=list(axes), shrink=0.85, pad=0.02)
        cb.set_label(f"H₂O excess (model units, {'log' if log else 'linear'})", fontsize=8, color="#52606D")
        cb.ax.tick_params(labelsize=7)
        t = data[0][1]["steps"][k] * data[0][1]["dt_s"]
        fig.suptitle(f"t = {t:5.1f} s   (same colour scale in every panel and frame)", fontsize=9, color="#52606D")
        p = os.path.join(out, f"frame_{k:04d}.png")
        fig.savefig(p, facecolor="white")
        plt.close(fig)
        frames_png.append(p)

    imgs = [Image.open(p).convert("RGB").convert("P", palette=Image.ADAPTIVE, colors=256, dither=Image.NONE) for p in frames_png]
    gif = out.rstrip("/") + ".gif"
    imgs[0].save(gif, save_all=True, append_images=imgs[1:], duration=int(1000 / fps), loop=0, optimize=True)
    with open(out.rstrip("/") + "_range.json", "w") as fh:
        json.dump({"ids": ids, "log": log, "vmin": lo, "vmax": hi, "frames": n}, fh)
    return gif


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("ids", nargs="+")
    ap.add_argument("--dir", default="results/timeseries")
    ap.add_argument("--out", required=True, help="output stem; writes <stem>/ frames and <stem>.gif (+ _log)")
    ap.add_argument("--labels", nargs="*")
    ap.add_argument("--fps", type=int, default=8)
    a = ap.parse_args()
    for log in (False, True):
        stem = a.out + ("_log" if log else "")
        print("wrote", render(a.ids, a.dir, stem, log, a.fps, a.labels))


if __name__ == "__main__":
    main()
