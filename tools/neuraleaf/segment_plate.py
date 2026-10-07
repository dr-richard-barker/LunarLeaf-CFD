#!/usr/bin/env python3
"""Segment green plant tissue out of a Petri-dish plate photo.

Step 1 of turning real imagery into leaf geometry. Takes a plate frame, finds the
green tissue, splits it into connected components, and writes a binary mask per
component plus a QC overlay so you can see what it decided.

What this does NOT do, and why it matters: connected components are *plants or
overlapping clusters*, not individual leaves. Two cotyledons that touch come out as
one blob. Separating them reliably needs either manual annotation or a learned shape
prior — which is precisely what NeuraLeaf's base-shape model provides, and why
fit_leaves.py is the next step rather than something clever here. Components flagged
`single_leaf_candidate` (roughly convex, sane aspect ratio) are the ones worth
carrying forward unassisted.

Scale is not inferred from the image. Measure it once against the ruler or QR card in
frame and pass --px-per-mm; a wrong scale silently produces a wrong leaf.

    python3 tools/neuraleaf/segment_plate.py \
        --image ~/Documents/Gravitropism_flashlapse_/Gravi_02_0090.jpg \
        --out /tmp/gravi02_f090 --px-per-mm 24.6

Dependencies: numpy, scipy, pillow (matplotlib only for the QC overlay).
"""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import asdict, dataclass

import numpy as np
from PIL import Image
from scipy import ndimage


@dataclass
class Component:
    index: int
    label: int  # connected-component label in the segmentation, for exact re-selection
    area_px: int
    area_mm2: float
    bbox: tuple  # (row0, col0, row1, col1)
    centroid: tuple
    solidity: float
    aspect_ratio: float
    single_leaf_candidate: bool
    mask_file: str


def otsu(values: np.ndarray) -> float:
    """Otsu's threshold. Implemented here to keep the dependency list to numpy/scipy."""
    hist, edges = np.histogram(values, bins=256)
    centers = (edges[:-1] + edges[1:]) / 2
    w = np.cumsum(hist).astype(float)
    total = w[-1]
    if total == 0:
        return float(values.mean())
    m = np.cumsum(hist * centers)
    w0 = w
    w1 = total - w0
    with np.errstate(invalid="ignore", divide="ignore"):
        mu0 = m / w0
        mu1 = (m[-1] - m) / w1
        between = w0 * w1 * (mu0 - mu1) ** 2
    between[~np.isfinite(between)] = -1
    return float(centers[int(np.argmax(between))])


def excess_green(rgb: np.ndarray) -> np.ndarray:
    """ExG = 2G - R - B, the standard vegetation index for RGB plant photography.

    Normalising each channel by the pixel total first makes it robust to the strong
    illumination gradient a backlit plate has across its width.
    """
    f = rgb.astype(np.float32)
    total = f.sum(axis=2, keepdims=True)
    total[total == 0] = 1.0
    r, g, b = (f / total).transpose(2, 0, 1)
    return 2.0 * g - r - b


def convex_area(mask: np.ndarray) -> float:
    """Area of the convex hull, via scipy's Delaunay triangulation of the boundary."""
    from scipy.spatial import ConvexHull, QhullError

    ys, xs = np.nonzero(mask)
    if len(xs) < 4:
        return float(mask.sum())
    try:
        return float(ConvexHull(np.column_stack([xs, ys])).volume)  # 2D: volume == area
    except (QhullError, ValueError):
        return float(mask.sum())


def segment_image(
    image_path: str,
    px_per_mm_source: float,
    max_side: int = 1600,
    exg_threshold: float | None = None,
    min_area_mm2: float = 0.5,
) -> tuple[np.ndarray, np.ndarray, list[Component], dict]:
    """Segment one plate frame.

    Returns (rgb at the working scale, boolean mask, components, meta). Split out from
    main() so build_series.py can run the identical segmentation across a timelapse
    without shelling out per frame — the component masks it writes must come from the
    same code path the single-frame tool uses, or the series would not be comparable.
    Component masks are NOT written here; the caller decides what to keep.
    """
    img = Image.open(image_path).convert("RGB")
    full_w, full_h = img.size
    scale = min(1.0, max_side / max(full_w, full_h))
    if scale < 1.0:
        img = img.resize((round(full_w * scale), round(full_h * scale)), Image.LANCZOS)
    px_per_mm = px_per_mm_source * scale

    rgb = np.asarray(img)
    exg = excess_green(rgb)

    # Because the channels are normalised per pixel, a colour-neutral pixel scores
    # exactly 0 and anything genuinely greener than grey scores above it. That fixed
    # zero point matters: on a plate photo the seedlings are well under 1% of the
    # pixels, so a plain Otsu split lands between the two *background* modes (dish
    # interior vs. bright rim) and selects the whole frame. Otsu is therefore run only
    # within the vegetation-candidate set, and the result is floored at a small
    # positive value.
    if exg_threshold is not None:
        thr = exg_threshold
    else:
        candidate = exg[exg > 0]
        thr = max(0.01, otsu(candidate)) if candidate.size > 500 else 0.02
    mask = exg > thr

    # Clean up: close single-pixel gaps, then fill interior holes (specular highlights
    # on a wet leaf read as non-green and would otherwise punch holes in the blade).
    mask = ndimage.binary_closing(mask, structure=np.ones((3, 3)), iterations=2)
    mask = ndimage.binary_fill_holes(mask)

    labels, n = ndimage.label(mask)
    min_area_px = min_area_mm2 * px_per_mm**2

    components: list[Component] = []
    kept = 0
    for i in range(1, n + 1):
        comp = labels == i
        area = int(comp.sum())
        if area < min_area_px:
            continue
        ys, xs = np.nonzero(comp)
        r0, r1, c0, c1 = ys.min(), ys.max(), xs.min(), xs.max()
        h, w = r1 - r0 + 1, c1 - c0 + 1
        solidity = area / max(1.0, convex_area(comp))
        aspect = max(h, w) / max(1.0, min(h, w))

        # A single leaf is a smooth, roughly convex blade. A cluster of overlapping
        # leaves has concavities between them, which shows up as low solidity.
        candidate_flag = bool(solidity > 0.80 and aspect < 5.0)

        kept += 1
        components.append(
            Component(
                index=kept,
                label=i,
                area_px=area,
                area_mm2=round(area / px_per_mm**2, 4),
                bbox=(int(r0), int(c0), int(r1), int(c1)),
                centroid=(round(float(ys.mean()), 2), round(float(xs.mean()), 2)),
                solidity=round(solidity, 3),
                aspect_ratio=round(aspect, 3),
                single_leaf_candidate=candidate_flag,
                mask_file=f"component_{kept:02d}.png",
            )
        )

    meta = {
        "source_image": os.path.abspath(image_path),
        "source_size_px": [full_w, full_h],
        "working_scale": round(scale, 4),
        "px_per_mm_working": round(px_per_mm, 4),
        "px_per_mm_source": px_per_mm_source,
        "exg_threshold": round(thr, 5),
    }
    return rgb, mask, components, meta


def crop_component(mask: np.ndarray, comp: Component) -> np.ndarray:
    """The component's own pixels, cropped to its bounding box.

    Selects by the stored label rather than by sampling the centroid: a cluster of
    overlapping leaves is often crescent-shaped, and its centroid then falls on
    background, which would silently crop an empty mask.
    """
    r0, c0, r1, c1 = comp.bbox
    labels, _ = ndimage.label(mask)
    return (labels == comp.label)[r0 : r1 + 1, c0 : c1 + 1]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--image", required=True, help="plate photograph (JPEG/PNG)")
    ap.add_argument("--out", required=True, help="output directory")
    ap.add_argument("--px-per-mm", type=float, required=True, help="image scale, measured from the ruler in frame")
    ap.add_argument("--min-area-mm2", type=float, default=0.5, help="drop components smaller than this")
    ap.add_argument("--exg-threshold", type=float, default=None, help="override the excess-green threshold (default: Otsu within ExG>0, floored at 0.01)")
    ap.add_argument("--max-side", type=int, default=1600, help="downscale the long edge to this before segmenting")
    ap.add_argument("--no-overlay", action="store_true", help="skip the QC overlay PNG")
    args = ap.parse_args()

    rgb, mask, components, meta = segment_image(
        args.image,
        args.px_per_mm,
        max_side=args.max_side,
        exg_threshold=args.exg_threshold,
        min_area_mm2=args.min_area_mm2,
    )

    os.makedirs(args.out, exist_ok=True)
    for comp in components:
        Image.fromarray((crop_component(mask, comp) * 255).astype(np.uint8)).save(
            os.path.join(args.out, comp.mask_file)
        )

    manifest = {
        **meta,
        "components": [asdict(c) for c in components],
        "note": (
            "Components are connected green regions — plants or overlapping clusters, "
            "not necessarily individual leaves. Check single_leaf_candidate and the "
            "overlay before exporting any of these as a leaf asset."
        ),
    }
    with open(os.path.join(args.out, "manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=2)

    if not args.no_overlay:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(10, 10))
        ax.imshow(rgb)
        tinted = np.zeros((*mask.shape, 4), dtype=np.uint8)
        tinted[mask] = (255, 64, 64, 90)
        ax.imshow(tinted)
        for c in components:
            r0, c0, r1, c1 = c.bbox
            ax.add_patch(
                plt.Rectangle(
                    (c0, r0), c1 - c0, r1 - r0,
                    fill=False,
                    edgecolor="lime" if c.single_leaf_candidate else "orange",
                    linewidth=1.4,
                )
            )
            ax.text(c0, r0 - 6, f"{c.index} ({c.area_mm2:.1f} mm²)", color="white", fontsize=8)
        ax.set_axis_off()
        fig.tight_layout()
        fig.savefig(os.path.join(args.out, "overlay.png"), dpi=130)
        plt.close(fig)

    singles = sum(1 for c in components if c.single_leaf_candidate)
    print(f"{len(components)} component(s) kept, {singles} flagged as single-leaf candidates")
    print(f"wrote {args.out}/manifest.json" + ("" if args.no_overlay else " and overlay.png"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
