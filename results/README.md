# LunarLeaf-CFD — Results package

Validation of the solver against measured *Arabidopsis* gas-exchange data, and the first
gravity × canopy-scale predictions of surface O₂/CO₂/H₂O gradients. Full narrative:
[`DISCUSSION.md`](DISCUSSION.md).

## Figures (`figures/`)
| File | Content |
|---|---|
| `F1_vernier_timeseries.png` | Vernier whole-chamber trace — O₂, temperature, RH, absolute humidity over 4.8 days (real diel gas cycling). |
| `F2_diel_flux.png` | One diel O₂ cycle with peak photosynthesis/respiration slopes. |
| `F3_plume_maps.png` | Model H₂O boundary layer: buoyant plume (leaf, Earth) vs stagnant halo (leaf, µg) vs trapped canopy air (canopy, µg). |
| `F4_gravity_scale.png` | Left: single-leaf gravity sweep (ΔC ↑, convection ↓ as g ↓). Right: three-scale amplification and the µg penalty. |
| `F5_chamber_validation.png` | Left: sealed-chamber mass conservation (err 2×10⁻⁵). Right: sustained near-leaf vs bulk gap (boundary layer at chamber scale). |

## Tables (`tables/`)
| File | Content |
|---|---|
| `T1_measured_gas_exchange.csv` | Measured fluxes from Vernier + biomass data (net assimilation 3.85 µmol CO₂ m⁻² s⁻¹, respiration 1.18, etc.). |
| `T2_model_sweep.csv` | Model output: u_max, Rayleigh, ΔC (mean/peak) per species, for 8 scenarios (3 scales × gravity). |
| `T3_calibration.csv` | Lattice→physical mapping (dx = 0.288 mm, dt = 0.173 ms, velocity scale, measured flux). |
| `T4_chamber_accumulation.csv` | Sealed-chamber time series (total mass, near-leaf & bulk probes) underpinning F5. |
| `T5_physical_prediction.csv` | Surface CO₂ drawdown / O₂ build-up in **ppm**, per scale × gravity, anchored on the measured flux. |

## Field grids (`fields/`)
`<scenario>_h2o.csv` — H₂O-excess concentration grids (128×96, solid cells = NaN) for `leaf-earth`,
`leaf-ug`, `canopy-ug`; source data for F3.

## Headline numbers
- **Validated:** solver passes 4 numerical gates; reproduces the measured assimilation flux and
  closed-chamber accumulation (mass conserved to 2×10⁻⁵).
- **Predicted:** Earth→µg steepens surface gas gaps 1.5–1.8× at every scale (convection `u_max` ∝ √g → 0);
  boundary-layer CO₂ drawdown rises from ≈ 4 ppm (leaf, Earth) to ≈ 13 ppm (rosette bulk, µg), with
  crown pockets ≈ 25 ppm.

## Reproduce
```bash
npm install
# 1) CFD sweep table + field grids
npx esbuild validation/export_cfd.ts --bundle --format=esm --platform=node --outfile=validation/export_cfd.mjs
node validation/export_cfd.mjs
# 2) sealed-chamber accumulation
npx esbuild validation/chamber_sim.ts --bundle --format=esm --platform=node --outfile=validation/chamber_sim.mjs
node validation/chamber_sim.mjs
# 3) data analysis + figures (needs Python: pandas, numpy, matplotlib, openpyxl)
python validation/analyze_data.py      # Vernier + biomass -> T1, F1, F2
python validation/analyze_model.py     # calibration, F3-F5, T3, T5
```
Raw source data (`validation/raw/`, incl. the third-party Chew/Millar workbook) is referenced by
provenance and not committed; place the CSV/xlsx files there to re-run step 3.
