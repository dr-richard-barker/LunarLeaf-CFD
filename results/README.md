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
| `F6_forced_airflow.png` | Forced ventilation in µg: surface gap ΔC vs fan speed, with Earth-1 g and µg-no-fan reference lines and the ≈ 2.8 cm/s Earth-equivalent point. |
| `F7_hardware_compare.png` | Spaceflight hardware (BRIC/CARA/VEGGIE) as dish boundary conditions: enclosure CO₂ drift vs time (left) and leaf-surface gradient by hardware (right). |
| `F8_fan_by_scale.png` | Earth-equivalent ventilation vs plant scale: fan-sweep curves for leaf/rosette/canopy (left) and required airflow ≈ 3/11/21 cm/s (right). |
| `F9_hardware_by_scale.png` | BRIC/CARA/VEGGIE leaf-surface gradient across leaf/rosette/canopy — the enclosure penalty widens with density. |

## Tables (`tables/`)
| File | Content |
|---|---|
| `T1_measured_gas_exchange.csv` | Measured fluxes from Vernier + biomass data (net assimilation 3.85 µmol CO₂ m⁻² s⁻¹, respiration 1.18, etc.). |
| `T2_model_sweep.csv` | Model output: u_max, Rayleigh, ΔC (mean/peak) per species, for 8 scenarios (3 scales × gravity). |
| `T3_calibration.csv` | Lattice→physical mapping (dx = 0.288 mm, dt = 0.173 ms, velocity scale, measured flux). |
| `T4_chamber_accumulation.csv` | Sealed-chamber time series (total mass, near-leaf & bulk probes) underpinning F5. |
| `T5_physical_prediction.csv` | Surface CO₂ drawdown / O₂ build-up in **ppm**, per scale × gravity, anchored on the measured flux. |
| `T6_forced_airflow.csv` | Forced-ventilation sweep (µg leaf): ΔC vs fan speed, with the Earth-equivalent speed (≈ 2.8 cm/s). |
| `T7_hardware_timeseries.csv` | BRIC/CARA/VEGGIE model time series: dish-mean CO₂ excess + leaf-surface gap vs step. |
| `T8_enclosure_timescales.csv` | Analytic sealed-dish (BRIC) atmosphere timescales: CO₂ depletion (min), CO₂ stress (h), O₂ hypoxia (days). |
| `T9_fan_by_scale.csv` | Forced-airflow sweep for leaf/rosette/canopy + Earth-equivalent speed per scale (≈ 2.6 / 11 / 21 cm/s). |
| `T10_hardware_by_scale.csv` | BRIC/CARA/VEGGIE surface gradient + dish-mean CO₂ across the three scales. |

## Field grids (`fields/`)
`<scenario>_h2o.csv` — H₂O-excess concentration grids (128×96, solid cells = NaN) for `leaf-earth`,
`leaf-ug`, `canopy-ug`; source data for F3.

## Headline numbers
- **Validated:** solver passes 4 numerical gates; reproduces the measured assimilation flux and
  closed-chamber accumulation (mass conserved to 2×10⁻⁵).
- **Predicted:** Earth→µg steepens surface gas gaps 1.5–1.8× at every scale (convection `u_max` ∝ √g → 0);
  boundary-layer CO₂ drawdown rises from ≈ 4 ppm (leaf, Earth) to ≈ 13 ppm (rosette bulk, µg), with
  crown pockets ≈ 25 ppm.
- **Reversible:** a forced airflow of ≈ 2.8 cm/s restores Earth-equivalent surface gradients in µg
  (single leaf) — an order of magnitude below flight-hardware fan speeds (VEGGIE/APH, 0.1–1 m/s).
- **Hardware:** BRIC (sealed) → CO₂ fixed in ~7 min (light) / O₂ hypoxia in ~6.5 days (dark) + steepest
  surface gradient; CARA (tape) vents the enclosure but not the µg surface layer; VEGGIE (airflow) fixes both.
- **Scale-dependent:** the ventilation to null the µg penalty rises **≈ 2.6 → 11 → 21 cm/s** for
  leaf → rosette → canopy; a single fan speed (or a permeable seal) that suffices for a leaf under-serves a canopy.

## Reproduce
```bash
npm install
# 1) CFD sweep table + field grids
npx esbuild validation/export_cfd.ts --bundle --format=esm --platform=node --outfile=validation/export_cfd.mjs
node validation/export_cfd.mjs
# 2) sealed-chamber accumulation
npx esbuild validation/chamber_sim.ts --bundle --format=esm --platform=node --outfile=validation/chamber_sim.mjs
node validation/chamber_sim.mjs
# 2b) forced-airflow sweep (Earth-equivalent fan speed) -> T6
npx esbuild validation/fan_sweep.ts --bundle --format=esm --platform=node --outfile=validation/fan_sweep.mjs
node validation/fan_sweep.mjs
# 2c) spaceflight-hardware comparison (BRIC/CARA/VEGGIE) -> T7
npx esbuild validation/hardware_sim.ts --bundle --format=esm --platform=node --outfile=validation/hardware_sim.mjs
node validation/hardware_sim.mjs
# 2d) fan + hardware across leaf/rosette/canopy -> T9, T10  (~30 min)
npx esbuild validation/scales.ts --bundle --format=esm --platform=node --outfile=validation/scales.mjs
node validation/scales.mjs
# 3) data analysis + figures (needs Python: pandas, numpy, matplotlib, openpyxl)
python validation/analyze_data.py      # Vernier + biomass -> T1, F1, F2
python validation/analyze_model.py     # calibration, F3-F6, T3, T5
python validation/hardware_analysis.py # BRIC/CARA/VEGGIE -> F7, T8
python validation/scales_analysis.py   # fan + hardware by scale -> F8, F9
```
Raw source data (`validation/raw/`, incl. the third-party Chew/Millar workbook) is referenced by
provenance and not committed; place the CSV/xlsx files there to re-run step 3.
