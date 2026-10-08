# LunarLeaf-CFD — Results package

Validation of the solver against measured *Arabidopsis* gas-exchange data, and the first
gravity × canopy-scale predictions of surface O₂/CO₂/H₂O gradients.

> **Revision 2026-10-07.** T2, T6, T7, T9, T10, T13 and T14 (and F3, F4, F6–F9) were regenerated after two
> defects were found while comparing against an independent OpenFOAM microgreen-chamber model
> (`microgreen-chamber-cfd` @ `6ac89c1`;
> the full write-up lives with the OSDR meta-analysis package, not in this repo):
> 1. **Snapshots before steady state.** Scenarios were reported at 22–30 k steps (3.8–5.2 s); the 0 g
>    scenes relax by diffusion and take ~12–15 s (leaf/rosette) and > 26 s (canopy). All steady-state
>    cases now run 150 k steps (canopy 0 g: 900 k ≈ 156 s) and every table records the drift over the last 5 s.
> 2. **Fan outlet boundary condition.** The forced-airflow outlet copied populations with no pressure
>    reference, so mass accumulated and the through-flow decayed (71 % of the set fan speed at 5.2 s,
>    18 % at 26 s). The outlet now pins ρ = 1 (`outletBC: 'pressure'`, the new default).
>
> With the fan carrying its full flow, the faster rosette/canopy runs exceed the lattice-Boltzmann
> low-Mach limit (Ma > 0.3) or blow up; those runs are flagged (`ma_max`) and excluded from crossings.
> BRIC/CARA rows keep their original run length (BRIC never reaches steady state) and are unchanged.
> **Not regenerated:** T3/T5 (need `validation/raw/` for the flux anchor), T12 (hand-transcribed
> from `feedback_test.ts` console output; its µg and VEGGIE rows predate both fixes), and the hand-made slide deck `CFD_Spaceflight_Botany.pptx`/`.pdf`
> (no generator; still shows the old figures and numbers). `MANUSCRIPT.md`, `manuscript.tex`, `DISCUSSION.md`
> and `MANUSCRIPT.docx` were updated to the new values, with TODOs where T5 and reference 5 are unverified.

**Assembled manuscript:** [`MANUSCRIPT.md`](MANUSCRIPT.md) (full paper, figures embedded) ·
[`manuscript/manuscript.tex`](manuscript/manuscript.tex) (npj-style LaTeX draft, compile instructions in
[`manuscript/README.md`](manuscript/README.md)). Working results + discussion narrative: [`DISCUSSION.md`](DISCUSSION.md).

## Figures (`figures/`)
| File | Content |
|---|---|
| `F1_vernier_timeseries.png` | Vernier whole-chamber trace — O₂, temperature, RH, absolute humidity over 4.8 days (real diel gas cycling). |
| `F2_diel_flux.png` | One diel O₂ cycle with peak photosynthesis/respiration slopes. |
| `F3_plume_maps.png` | Model H₂O boundary layer at steady state: buoyant plume (leaf, Earth) vs stagnant halo (leaf, µg) vs trapped canopy air (canopy, µg). |
| `F4_gravity_scale.png` | Left: single-leaf gravity sweep (ΔC ↑, convection ↓ as g ↓). Right: three-scale amplification and the µg penalty. |
| `F5_chamber_validation.png` | Left: sealed-chamber mass conservation (err 2×10⁻⁵). Right: sustained near-leaf vs bulk gap (boundary layer at chamber scale). |
| `F6_forced_airflow.png` | Forced ventilation in µg: surface gap ΔC vs fan speed, with Earth-1 g and µg-no-fan reference lines and the ≈ 2.0 cm/s Earth-equivalent point. |
| `F7_hardware_compare.png` | Spaceflight hardware (BRIC/CARA/VEGGIE) as dish boundary conditions: enclosure CO₂ drift vs time for BRIC/CARA light and dark (left) and leaf-surface gradient by hardware (right). |
| `F11_stationarity.png` | g_bl(t) over 26 s for six scenarios, with the old 30 k-step snapshot marked (from `results/timeseries/`). |
| `F12_outlet_bc.png` | Forced-airflow through-flow and g_bl vs time: original copy outlet vs pressure outlet. |
| `F13_domain_size.png` | g_bl vs modelled chamber size (1×, 1.5×, 2×) for leaf and rosette at 1 g and 0 g: the 1 g values move ≤ 7 %, the 0 g values keep falling (−33 % leaf, −41 % rosette at 2×). From T17. |
| `F14_dish_hardware.png` | Leaf g_bl at 1 g and 0 g inside the real BRIC (60 mm round) and CARA (120 mm square) dishes vs the generic open box. In a dish the Earth/0 g ratio is 1.25–1.8×, not 2.25×. From T19 and T13. |
| `F15_dish_feedback.png` | Sealed BRIC dish with CO₂-limited photosynthesis: assimilation over ~7 min at 1 g and 0 g, and the leaf's conductance to the dish air while assimilation > 10 %. From T20. |
| `F16_dish_buoyancy_diag.png` | What drives the 1 g conductance in the sealed BRIC dish: four buoyancy variants (all species with feedback; fixed uptake; H₂O only; CO₂ + O₂ only) and their peak flow speed, showing the flow runaway after ~3.7 min when transpiration is unbounded. From T21 and T20. |
| `F17_dish_humidity.png` | Sealed BRIC dish with humidity-limited transpiration: g_bl to the dish air at 1 g for three saturation levels and at 0 g, against T20's constant-transpiration run; and transpiration, assimilation and dish humidity over time. From T22. |
| `F8_fan_by_scale.png` | Earth-equivalent ventilation vs plant scale: fan-sweep curves for leaf/rosette/canopy (left; hollow = Ma > 0.3, not used) and required airflow ≈ 2.0 / 6.5 cm/s for leaf / rosette; the canopy does not reach Earth level within the solver's valid range (≤ 6.6 cm/s) (right). |
| `F9_hardware_by_scale.png` | BRIC/CARA/VEGGIE leaf-surface gradient across leaf/rosette/canopy. BRIC/CARA at the original 3.8 s; VEGGIE at steady state; canopy VEGGIE hatched (Ma 0.32). |
| `F10_photosynthesis_feedback.png` | Closed-loop CO₂-limited photosynthesis: net assimilation vs time (BRIC collapses in minutes) and 12 h carbon fixed (BRIC 1% / CARA 90% / VEGGIE 100% of Earth). |

## Tables (`tables/`)
| File | Content |
|---|---|
| `T1_measured_gas_exchange.csv` | Measured fluxes from Vernier + biomass data (net assimilation 3.85 µmol CO₂ m⁻² s⁻¹, respiration 1.18, etc.). |
| `T2_model_sweep.csv` | Model output at steady state: u_max, Rayleigh, ΔC (mean/peak) per species, for 8 scenarios (3 scales × gravity). |
| `T3_calibration.csv` | Lattice→physical mapping (dx = 0.288 mm, dt = 0.173 ms, velocity scale, measured flux). |
| `T4_chamber_accumulation.csv` | Sealed-chamber time series (total mass, near-leaf & bulk probes) underpinning F5. |
| `T5_physical_prediction.csv` | Surface CO₂ drawdown / O₂ build-up in **ppm**, per scale × gravity, anchored on the measured flux. |
| `T6_forced_airflow.csv` | Forced-ventilation sweep (µg leaf, pressure outlet, steady state): ΔC vs fan speed, with the Earth-equivalent speed (≈ 2.0 cm/s). `LUNARLEAF_LEGACY=1` reproduces the original table as `T6_forced_airflow_legacy.csv`. |
| `T7_hardware_timeseries.csv` | BRIC/CARA/VEGGIE model time series: dish-mean CO₂ excess + leaf-surface gap vs step. |
| `T8_enclosure_timescales.csv` | Analytic sealed-dish (BRIC) atmosphere timescales: CO₂ depletion (min), CO₂ stress (h), O₂ hypoxia (days). |
| `T9_fan_by_scale.csv` | Forced-airflow sweep for leaf/rosette/canopy with per-run `ma_max`; Earth-equivalent speed per scale from Ma ≤ 0.3 runs only (leaf ≈ 2.0, rosette ≈ 6.5 cm/s, canopy not reached ≤ 6.6 cm/s). |
| `T10_hardware_by_scale.csv` | BRIC/CARA/VEGGIE surface gradient + dish-mean CO₂ across the three scales, with `ma_max` (BRIC/CARA at the original 22 k steps; VEGGIE at steady state). |
| `T11_photosynthesis_feedback.csv` | 0-D closed-loop model: start/end net assimilation + 12 h carbon (% of Earth) per enclosure. |
| `T12_feedback_spatial.csv` | Solver closed-loop net assimilation (% of potential) by gravity / scale / hardware. **Stale:** hand-transcribed from `feedback_test.ts` (22 k steps, copy outlet); not regenerated. |
| `T13_boundary_layer.csv` | Boundary-layer conductance g_bl, film thickness δ, Sherwood number per scale × gravity at steady state, with `gbl_drift_pct_last_5s`. Consumed by the OSDR omics package (`extract_cfd.py`) and `fvcb.py`. |
| `T14_shape_sweep.csv` | Leaf-shape sweep at steady state: ellipse vs real outline (longitudinal cut) and flat vs curled blade (transverse cut), 1 g and µg; g_bl, δ, Sh, mean/peak ΔC CO₂, ratio to group reference, drift column. Groups are not comparable with each other. |
| `T17_domain_size.csv` | Domain-size sensitivity: leaf and rosette at 1 g / 0 g in chambers 1×, 1.5× and 2× the production 36.9 × 27.6 mm, same leaf and dx, each to steady state. 0 g g_bl is chamber-dependent (2-D diffusion to the walls has no size-independent limit); 1 g is not. |
| `T18_surface_distribution.csv` | Distribution of the leaf-surface CO₂ gap, not just its mean: CoV, 10th/50th/90th percentiles, and fraction of surface worse than an isolated Earth leaf's mean, for the steady scenes (open dish at 1 g / 0 g, and VEGGIE leaf/rosette). |
| `T19_dish_hardware.csv` | A leaf 1 mm above the agar inside each real dish cross-section (BRIC 60 mm round, CARA 120 × 120 mm square; dimensions supplied by R. Barker, 2026-10-08), open to the cabin or with its flight boundary (BRIC sealed, CARA taped), at 1 g and 0 g, plus min/max headspace. g_bl is given against cabin ambient and against the enclosure's own air. Assumes a 1 mm wall and base thickness. |
| `T20_dish_feedback.csv`, `T20_dish_feedback_summary.csv` | Time series (every ~0.5 s) for the sealed BRIC dish with CO₂-limited photosynthesis (co2Ambient = 8) and buoyancy referenced to the dish mean, at 1 g and 0 g over 415 s, plus CARA taped with feedback and BRIC with the buoyancy fix only. Dish-mean CO₂, net assimilation, g_bl to the dish air and to cabin ambient. |
| `T21_dish_buoyancy_diag.csv` | Sealed BRIC (1 g) time series with buoyancy from CO₂ + O₂ only, H₂O only (both with feedback), and all species with fixed uptake; dish CO₂, assimilation, g_bl to the dish air and peak flow speed. |
| `T22_dish_humidity.csv` | Sealed BRIC dish with photosynthesis feedback and humidity-limited transpiration (`h2oSatExcess` 0.65 / 1.3 / 2.6 model units at 1 g, 1.3 at 0 g), 415 s: dish CO₂ and H₂O, assimilation, transpiration, g_bl to the dish air, peak flow speed. The saturation level is an estimate, not a calibration. |
| `T15_stationarity.csv` | Snapshot-vs-steady comparison (N_eff-corrected window means, drift test) from `results/timeseries/`. |
| `T16_resolution_gci.csv` | Three-grid convergence (dx 0.288 / 0.192 / 0.144 mm) for g_bl and ΔC_CO₂, Celik et al. (2008) GCI. |

## Field grids (`fields/`)
`<scenario>_h2o.csv` — H₂O-excess concentration grids (128×96, solid cells = NaN) for `leaf-earth`,
`leaf-ug`, `canopy-ug`; source data for F3.

## Headline numbers
- **Validated:** solver passes 4 numerical gates; reproduces the measured assimilation flux and
  closed-chamber accumulation (mass conserved to 2×10⁻⁵).
- **Predicted:** Earth→µg steepens surface gas gaps 1.7–2.3× at every scale (H₂O 1.7–2.1×, CO₂ 2.0–2.3×;
  convection `u_max` ∝ √g → 0). Leaf g_bl falls 0.997 → 0.443 mol m⁻² s⁻¹ (2.25×).
  The ppm drawdowns in T5 (≈ 4 ppm leaf Earth → ≈ 13 ppm rosette µg, crown ≈ 25 ppm) predate the
  steady-state rerun and will rise for the µg cases once T5 is regenerated.
- **Chamber size (T17):** the 1 g conductance is a property of the plant (≤ 7 % change when the modelled
  chamber is doubled), but the 0 g conductance is not: it falls 33 % (leaf) and 41 % (rosette) at 2× and has
  not levelled off. The absolute 0 g values, and so the size of the Earth/µg ratio (2.25× → 3.5× for the leaf),
  depend on the chamber modelled; hardware scenes should use each system's real dish dimensions.
- **Real dishes (T19):** with only 7–10 mm of air above the agar, convection barely develops even at 1 g, so
  conductance in the dish is about 0.25 at 1 g (vs 0.997 in the open box) and the Earth/0 g ratio is 1.25–1.8×
  rather than 2.25×. At 0 g, BRIC (sealed, against its own air) and CARA (taped) give nearly the same leaf
  conductance (0.185 vs 0.186); the hardware difference is in the dish atmosphere, not the boundary layer.
  Caveats: the sealed 1 g case is not steady and exceeds the Boussinesq limit; the inflated 2.3 mm blade fills
  ~30 % of the BRIC headspace; rosettes do not fit under the lid yet.
- **Sealed BRIC with photosynthesis feedback (T20):** the dish runs out of CO₂ in about 3.5 min (assimilation
  < 10 % at ≈ 200 s) at both 1 g and 0 g, since the dish-level mass balance does not depend on gravity (T8's
  analytic estimate: ≈ 7 min; the model time depends on the co2Ambient calibration). The leaf's conductance to the
  dish air is constant at 0.187 at 0 g; at 1 g it rose from 0.33 to ≈ 0.40 in T20, but **that plateau is an artefact
  of constant transpiration** (T21, T22: see the next bullet). If BRIC
  ground controls fly in the same sealed hardware, they starve as fast as the flight samples, so BRIC's carbon
  deficit is a hardware effect shared by flight and ground, not a flight effect. CARA (taped) keeps assimilation at
  94–96 %.
- **What drives the 1 g conductance in a sealed dish (T21, T22):** the rise in T20 at 0.5–1 min is convection onset
  (it appears without feedback too), sustained by transpiration that the model held constant, so the sealed dish
  accumulated humidity without bound; after ~3.7 min that flow ran away toward the Mach limit (the late collapse
  in T20 is this runaway, not an ill-conditioned ratio). With transpiration limited by the humidity gap (T22), the
  dish saturates in 1–2 min, transpiration stops, convection dies away and the 1 g conductance decays toward the
  0 g value (0.26 at 60 s, 0.21 at 200 s, 0.19 by 5 min; 0 g stays 0.187). No runaway; the result holds across a
  4× range of the (uncalibrated) saturation level. So in a sealed BRIC dish the 1 g and 0 g boundary layers converge
  within minutes.
- **Surface distribution (T18):** at 0 g the whole surface degrades (100 % of a leaf or rosette is worse than
  an Earth leaf's mean, and the CoV roughly halves); VEGGIE restores the rosette's *mean* gap (0.294 vs 0.298)
  but leaves the most uneven surface of any case (CoV 0.65, p90 0.61 vs 0.52 on Earth).
- **Grid:** three-level resolution ladder converges monotonically; production grid within 2.0 % (0 g) and
  5.5 % (1 g) of the extrapolated g_bl (T16).
- **Reversible:** a forced airflow of ≈ 2.0 cm/s restores Earth-equivalent surface gradients in µg
  (single leaf) — an order of magnitude below flight-hardware fan speeds (VEGGIE/APH, 0.1–1 m/s).
- **Hardware:** BRIC (sealed) → CO₂ fixed in ~7 min (light) / O₂ hypoxia in ~6.5 days (dark) + steepest
  surface gradient; CARA (tape) vents the enclosure but not the µg surface layer; VEGGIE (airflow) fixes both.
- **Scale-dependent:** the ventilation to null the µg penalty rises **≈ 2.0 → 6.5 cm/s** for leaf → rosette;
  the canopy does not reach its Earth level within the solver's valid range (≤ 6.6 cm/s), and its
  surface gap plateaus above Earth even in the faster (Ma > 0.3, unreliable) runs. A single fan speed that
  suffices for a leaf under-serves a canopy; resolving the canopy at higher speeds needs a finer lattice.
- **Closed loop:** with CO₂-limited photosynthesis, boundary-layer depletion self-suppresses assimilation
  1–4% (most in the trapped rosette crown); over a 12 h photoperiod a **sealed BRIC dish fixes ~1%** of the
  Earth carbon (photosynthesis collapses in minutes) vs **~90% (CARA)** and **~100% (VEGGIE)**.

## Reproduce
The steady-state exports are split into independent jobs (`validation/jobs.ts`); run them in parallel
with `list | xargs`, then `merge`. Run serially, step 1 + 2b + 2d take several hours.
```bash
npm install
# 1) CFD sweep table + field grids -> T2, T13
npx esbuild validation/export_cfd.ts --bundle --format=esm --platform=node --outfile=validation/export_cfd.mjs
node validation/export_cfd.mjs list | xargs -P 8 -I{} node validation/export_cfd.mjs job {}
node validation/export_cfd.mjs merge
# 2) sealed-chamber accumulation
npx esbuild validation/chamber_sim.ts --bundle --format=esm --platform=node --outfile=validation/chamber_sim.mjs
node validation/chamber_sim.mjs
# 2b) forced-airflow sweep (Earth-equivalent fan speed) -> T6
npx esbuild validation/fan_sweep.ts --bundle --format=esm --platform=node --outfile=validation/fan_sweep.mjs
node validation/fan_sweep.mjs list | xargs -P 11 -I{} node validation/fan_sweep.mjs job {}
node validation/fan_sweep.mjs merge
# 2c) spaceflight-hardware comparison (BRIC/CARA/VEGGIE) -> T7
npx esbuild validation/hardware_sim.ts --bundle --format=esm --platform=node --outfile=validation/hardware_sim.mjs
node validation/hardware_sim.mjs
# 2d) fan + hardware across leaf/rosette/canopy -> T9, T10
npx esbuild validation/scales.ts --bundle --format=esm --platform=node --outfile=validation/scales.mjs
node validation/scales.mjs list | xargs -P 16 -I{} node validation/scales.mjs job {}
node validation/scales.mjs merge
# 3) data analysis + figures (needs Python: pandas, numpy, matplotlib, openpyxl)
python validation/analyze_data.py      # Vernier + biomass -> T1, F1, F2
python validation/analyze_model.py     # calibration, F3-F6, T3, T5 (T3/T5 skipped without validation/raw/)
python validation/hardware_analysis.py # BRIC/CARA/VEGGIE -> F7, T8
python validation/scales_analysis.py   # fan + hardware by scale -> F8, F9
python validation/feedback_0d.py       # 0-D closed-loop photosynthesis -> F10, T11
# 4) verification added 2026-10-07 (timeseries -> T15/F11, outlet check -> F12, resolution ladder -> T16)
#    see validation/timeseries.ts, age_check.ts, resolution_ladder.ts and analysis/*.py
python3 -m pytest analysis/ -q
# CFD closed-loop check (net assimilation by gravity/scale/hardware) -> T12:
# npx esbuild validation/feedback_test.ts --bundle --format=esm --platform=node --outfile=validation/feedback_test.mjs && node validation/feedback_test.mjs 8
```
Raw source data (`validation/raw/`, incl. the third-party Chew/Millar workbook) is referenced by
provenance and not committed; place the CSV/xlsx files there to re-run step 3.
