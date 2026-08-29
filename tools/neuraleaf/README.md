# Real leaf geometry from your own plate images

Four scripts that turn Petri-dish photographs into leaf assets for `src/leaf/assets/`,
replacing the ellipse the solver has used as a stand-in for a blade.

Steps 1, 2 and 4 need only numpy, scipy, pillow and matplotlib, use no machine learning,
and are verified end-to-end against `Gravitropism_flashlapse_/`. Step 3 is optional and is
the only one that involves NeuraLeaf.

```
segment_plate.py    plate photo   →  per-component masks + QC overlay
export_assets.py    one mask      →  asset JSON (outline, midrib, traits, timestamp)
fit_leaves.py       mask + asset  →  adds the 3D pose the silhouette cannot contain  [optional]
build_series.py     a timelapse   →  one asset per frame + age_series.csv
```

**Before anything else, read "What the local imagery can and cannot support" at the bottom.**
Two of the three limits there were found by running these tools on the real footage.

## 1. Segment

```bash
python3 tools/neuraleaf/segment_plate.py \
  --image ~/Documents/Gravitropism_flashlapse_/Gravi_02_0090.jpg \
  --out /tmp/gravi02_f090 \
  --px-per-mm 24.4
```

Thresholds a per-pixel-normalised excess-green index, `ExG = 2G − R − B`. Normalising
each channel by the pixel total first gives a **fixed zero point** — a colour-neutral
pixel scores exactly 0 — which matters here because the seedlings are well under 1% of
the frame, and a plain Otsu split lands between the two *background* modes (dish interior
vs. bright rim) and selects the whole image. Otsu is therefore run only inside `ExG > 0`.

Scale is **not** inferred. Measure it once against the ruler or QR card in frame and pass
`--px-per-mm`; a wrong scale silently produces a wrong leaf.

Check `overlay.png` before going further. Connected components are *plants or overlapping
clusters*, not individual leaves — two touching cotyledons come out as one blob.
Components flagged `single_leaf_candidate` (solidity > 0.80, aspect < 5) are the ones
usable without further work.

## 2. Export an asset

```bash
python3 tools/neuraleaf/export_assets.py \
  --mask /tmp/gravi02_f090/component_04.png \
  --px-per-mm 15.974 \
  --id gravi02-f090-leaf4 --label "Arabidopsis seedling, frame 90" \
  --series Gravi_02 --frame 90 \
  --source-image ~/Documents/Gravitropism_flashlapse_/Gravi_02_0090.jpg \
  --t0 "2017-06-12T17:44:26" \
  --out src/leaf/assets
```

Note the `--px-per-mm`: use the **working** scale from the manifest
(`px_per_mm_working`), not the source scale, since `segment_plate.py` downscales before
segmenting and the masks are at that scale.

Traces the boundary, puts the long axis on +y, decides which end is the base by which one
tapers, derives the midrib from chord midpoints, and reads the timestamp from EXIF.
`--t0` turns that into an age in hours.

It writes a **flat** `profile` and `camber`, because a single top-down silhouette carries
no out-of-plane information, and says so in the asset's note. `--curl` / `--cup` impose a
pose by hand for exploration; anything they touch is recorded as imposed, not measured.

Then validate and register:

```bash
npx esbuild validation/leaf_inspect.ts --bundle --format=esm --platform=node \
  --loader:.json=json --outfile=validation/leaf_inspect.mjs \
  && node validation/leaf_inspect.mjs src/leaf/assets/gravi02-f090-leaf4.json
```

Add it to `src/leaf/registry.ts`, then `tools/sync-leaf-module.sh ../../aeroleaf-cfd`.

## 3. Recover the 3D pose with NeuraLeaf — optional

> Yang, Mao, Santo, Matsushita & Okura (2025). *NeuraLeaf: Neural Parametric Leaf Models
> with Shape and Deformation Disentanglement.* ICCV 2025. arXiv:2507.12714

Only this step needs NeuraLeaf, and only for the deformation — the outline from step 2 is
already real. Its value is the deformation latent `z_d`, which recovers how the blade
actually curled from a view that cannot show it.

```bash
git clone https://github.com/Yrainy0615/NeuraLeaf.git ~/src/NeuraLeaf
# download baseshape_l.pth, deform.pth, encoder.pth into ~/src/NeuraLeaf/checkpoints
export NEURALEAF_HOME=~/src/NeuraLeaf

python3 tools/neuraleaf/fit_leaves.py \
  --mask /tmp/gravi02_f090/component_04.png \
  --asset src/leaf/assets/gravi02-f090-leaf4.json \
  --print-command
```

**The wrapper has not been run against a real NeuraLeaf checkout.** It shells out to that
repo's own `fitting.py` rather than importing its internals, so the integration point is
one command you can read and correct — but the flag template is a starting point, not a
verified one. Run `--print-command` first, compare against `python fitting.py --help` in
your checkout, and override with `--fitting-args`. The post-processing of the resulting
`.obj` into `profile` / `camber` **is** tested (via `--obj`, which skips fitting) and does
not depend on those flags.

Requirements are NeuraLeaf's own: Python 3.9, torch 2.0.1+cu118, pytorch3d, a CUDA GPU.
Deliberately not a dependency of either browser tool.

### Licence

The NeuraLeaf repository has **no LICENSE file** — default copyright, all rights reserved.
Nothing from it is vendored here. Settle redistribution with the authors before publishing
or depositing geometry derived from it. See `src/leaf/assets/PROVENANCE.md`.

## 4. A whole series — `build_series.py`

```bash
python3 tools/neuraleaf/build_series.py \
  --glob '~/Documents/Gravitropism_flashlapse_/Gravi_02_*.jpg' \
  --every 8 --px-per-mm 24.4 --seed-xy 676,305 --max-drift 80 \
  --allow-clusters --id-prefix gravi02plant --series Gravi_02 \
  --work /tmp/gravi_series --out-assets src/leaf/assets
```

Follows one component across the timelapse by nearest centroid and writes an asset per
frame plus `age_series.csv`. Tracking is deliberately simple and **reports when it loses
the leaf** rather than silently swapping to the neighbouring plant; every row carries the
drift and the area jump.

**Tested result on Gravi_02:** 12/12 frames tracked, 0 lost — but every tracked component
was a whole-plant cluster (solidity 0.34–0.48), never a single leaf. Thresholding separates
plants from background, not leaves from each other. The tool therefore writes **no leaf
asset** for a cluster; `--force-cluster-asset` overrides that and marks the result
provisional and labelled a plant silhouette. The morphometrics still go to the CSV, and
those are real plant-level data.

## What the local imagery can and cannot support

`Gravitropism_flashlapse_/` is 96 frames at 15 min cadence spanning **23.79 h** — a
one-day gravitropism series of seedlings, not a development series. It supports an axis
labelled *"hours since imaging start"*, not leaf ageing or senescence. For a real age
axis see the CyVerse candidates listed in `TIMELAPSE_PIPELINE_STATUS.md`.

It also cannot yield **per-leaf** outlines by thresholding alone (see above) — that needs
manual annotation or the NeuraLeaf shape prior.

And the scale is **assumed, not measured**: 24.4 px/mm from the dish spanning ~2440 px on
the assumption of a 100 mm dish. Confirm the dish diameter; every area scales as its square.
