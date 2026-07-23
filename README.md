# LunarLeaf‑CFD — Gravity‑Dependent Airflow & Gas Transport Around Arabidopsis

> **A browser‑based, user‑friendly fluid‑dynamics workbench for modelling, visualising and
> measuring the movement of air and the O₂ / CO₂ / H₂O concentration gradients that form around
> plant tissue — and how those change when gravity changes (1 g → Mars 0.38 g → Moon 0.17 g → µg).**

Part of the **AstroBotany / AIRI** family and the **Lunar Leaf** line of work
(see [`O2_and_CO2_calculations_LUNAR_LEAF-`](https://github.com/dr-richard-barker/O2_and_CO2_calculations_LUNAR_LEAF-)).
This repository consolidates and supersedes three earlier Google AI Studio prototypes
(analysed in [`docs/ANALYSIS_OF_PRIOR_ATTEMPTS.md`](docs/ANALYSIS_OF_PRIOR_ATTEMPTS.md)) into a single
scientifically‑grounded tool, packaged from day one for **Zenodo archival** and a
**peer‑reviewed *npj Microgravity*‑style paper**.

---

## 1. The scientific question

On Earth, a photosynthesising leaf warms and humidifies the air touching it. That air becomes
buoyant and rises, continuously sweeping away the **unstirred boundary layer** and refreshing the
leaf surface with CO₂ while carrying away O₂ and water vapour. **In microgravity there is no
buoyancy‑driven convection.** The boundary layer thickens, transport collapses to pure molecular
diffusion, and steep O₂ / CO₂ / H₂O gradients build up at the leaf surface — a leading candidate
mechanism for the hypoxia, altered gas exchange and morphological stress seen in spaceflight plants.

**Core hypothesis this tool exists to test and communicate:**
> As the gravity vector `g` is scaled from 1 g toward 0, natural convection around Arabidopsis tissue
> weakens (falling Grashof/Rayleigh number), the diffusive boundary layer thickens, and the
> surface‑to‑bulk gradients of CO₂, O₂ and H₂O steepen — measurably and predictably — with the
> effect amplifying from a single leaf → a rosette → a dense microgreen canopy.

### Measurable outputs the tool must produce (for the paper)
- Boundary‑layer thickness δ (mm) as a function of `g`, wind speed, and geometry.
- Surface vs. bulk concentration gap ΔC for **CO₂, O₂, H₂O** and the resulting flux.
- Dimensionless numbers: **Grashof (Gr), Rayleigh (Ra), Reynolds (Re), Sherwood (Sh), Nusselt (Nu), Péclet (Pe)**.
- Effective boundary‑layer conductance `g_bl` (mol m⁻² s⁻¹) — directly comparable to gas‑exchange literature.

---

## 2. What we are modelling — three geometric scales

| Scale | Geometry | Question it answers |
|---|---|---|
| **1 — Single leaf** | One Arabidopsis leaf (imported 3D surface or parametric blade) | Boundary‑layer physics on an isolated surface; cleanest validation case. |
| **2 — Rosette** | Full Arabidopsis rosette (overlapping leaves, self‑shading of flow) | How leaf‑to‑leaf interaction traps air and creates a rosette‑scale microclimate. |
| **3 — Microgreen "lawn"** | Dense community canopy grown like microgreens | Emergent canopy boundary layer, within‑canopy stagnation, whole‑stand gas budget. |

Each scale is run across a **gravity sweep** (µg, Moon, Mars, 1 g, and arbitrary user values) and
optional forced airflow (fan/ventilation), because on real spacecraft forced convection is the
engineered substitute for the buoyancy that microgravity removes.

---

## 3. Why the earlier attempts were not enough (short version)

All three prototypes looked plausible but **none solved any physics**:

| Prototype | Strength to keep | Fatal gap |
|---|---|---|
| [Aero‑leaf‑CFD (blender‑ish)](https://github.com/dr-richard-barker/Aero-leaf-CFD-analysis-adapted-from-blender-ish) | Excellent 5‑step setup wizard + real CFD parameter schema | Engine is `Math.random()`; results are noise |
| [AstroBotany LEAF FDM](https://github.com/dr-richard-barker/AstroBotany_LEAF_FDM_model_test) | Beautiful anatomically‑textured, gravity‑morphing leaf shader | Gas fluxes are static sliders; boundary layer is a visual glow, not solved |
| [Nature's aerodynamic analyser](https://github.com/dr-richard-barker/Nature-s-aerodynamic-analyser) | Friendly UI; clear plain‑language explanations | "Analysis" is Gemini text; no field solve; only ½ρv² is real |

**None couples gravity to buoyancy — the one thing the science is actually about.**
Full breakdown: [`docs/ANALYSIS_OF_PRIOR_ATTEMPTS.md`](docs/ANALYSIS_OF_PRIOR_ATTEMPTS.md).

---

## 4. What "doing better" means — the plan in one paragraph

Keep the winning UI (the 5‑step wizard) and the winning visuals (the shader leaf), and **drop a
real solver underneath them**: an incompressible flow + multi‑species advection–diffusion solver
(Lattice‑Boltzmann on WebGPU/WebGL, with a validated CPU/WASM reference), with **Boussinesq
buoyancy driven by a user‑controlled gravity vector**, and **leaf surfaces as biologically‑set
source/sink boundaries** (stomatal CO₂ uptake, O₂ + H₂O release). Add the features a professional
FDM/CFD package is expected to have: import arbitrary 3D leaf models, voxelise, set boundary
conditions, run, probe/measure, visualise fields and streamlines, sweep parameters, and export
publication‑grade data and figures. Full design: [`docs/ARCHITECTURE_AND_PLAN.md`](docs/ARCHITECTURE_AND_PLAN.md).

---

## 5. Project goals & milestone tracker

Status legend: ✅ done · 🟡 in progress · ⬜ not started

### Milestone 0 — Foundations
- 🟡 Repo scaffolding — README, docs, Vite+React+TS app scaffolded; LICENSE, `.zenodo.json`, `CITATION.cff` still to add
- ⬜ Consolidate three prototypes into `/legacy` for reference & credit
- ✅ Decide stack & pin versions — React 18 + TypeScript + Vite; CPU D2Q9 LBM core (WebGPU/WASM twin deferred to later milestones per plan)
- 🟡 Define the canonical parameter schema — solver/scenario types in place; full UI schema (geometry/env/biology) comes with M2

### Milestone 1 — Real 2D solver (the scientific core) — ✅ solver + all four gates validated
- ✅ Incompressible flow solver (D2Q9 LBM, BGK) — validated on cavity + cylinder (gates 1 & 2)
- ✅ Scalar advection–diffusion for CO₂/O₂/H₂O — D2Q5 `ScalarField`, correct diffusivities, Dirichlet + zero-flux walls; **gate 4 (erfc limit) passes**
- ✅ Boussinesq buoyancy coupled to a gravity vector (µg → 1 g) — `applyBoussinesqForce` + presets; **gate 3 (natural convection, Nu vs Ra) passes at 0.18% error** — the buoyancy coupling is proven
- ⬜ Leaf boundary as source/sink (stomatal flux BCs) — `ScalarField.source` hook ready; wire with the leaf geometry in M2/M3
- 🟡 Report Gr, Ra, Re, Sh, Nu, δ, g_bl each run — Re/Gr/Ra/Pe/Sc + Nu (natconv) + St (cylinder) reported; δ, Sh, g_bl come with the leaf scenario

#### Milestone 1 validation results (headless, reproducible)
| Gate | Benchmark | Reference | Measured | Status |
|---|---|---|---|---|
| **1** | Lid-driven cavity, Re 100 — centreline vs. Ghia et al. (1982) | L2 < 0.05 | **L2 = 0.0105** | ✅ PASS |
| **2** | Flow past cylinder, Re 100 — Kármán shedding Strouhal | 0.164 unconfined; ≈0.19–0.20 confined | **St = 0.192** (16 cycles) | ✅ PASS |
| **3** | Natural-convection cavity, Ra 1e4 — hot-wall Nusselt vs. de Vahl Davis (1983) | Nu = 2.238 | **Nu = 2.242** (0.18% err) | ✅ PASS |
| **4** | Pure diffusion — profile vs. ½·erfc analytic | L2 → 0 | **L2 ≈ 0.0000** | ✅ PASS |

Gate 3 is the decisive one: it proves gravity correctly drives buoyant convection, so scaling **g → 0** genuinely collapses it (gate 4's diffusion-only limit). That is the exact microgravity mechanism this project exists to model.

Run the interactive bench with `npm install && npm run dev` → pick a scenario, press **Run**, watch the diagnostics/gate panel. (Use a visible browser tab — background tabs throttle `requestAnimationFrame` to zero; long runs are best driven headlessly.)

### Milestone 2 — User‑friendly GUI (professional‑package features)
- ⬜ Import 3D models (STL / OBJ / GLB / PLY) + parametric leaf‑shape generator
- ⬜ Auto‑voxelise geometry to solver grid; domain & mesh controls
- ⬜ Boundary‑condition editor (inlet/outlet/walls, forced airflow, gravity direction & magnitude)
- ⬜ Live field visualisation (velocity, pressure, species concentration, streamlines, iso‑lines)
- ⬜ Probe/measure tool, plots, and CSV / VTK / PNG / MP4 export
- ⬜ Save / load project files; reproducible run manifests

### Milestone 3 — Three scales + gravity sweep — ✅ all three scales built
- ✅ Single‑leaf preset & gravity sweep (Earth/Mars/Moon/µg)
- ✅ Rosette preset (fan of overlapping leaves — interior air‑trapping)
- ✅ Microgreen‑canopy preset (row of upright shoots on soil — within‑canopy stagnation)
- 🟡 Gravity sweep — 8 selectable presets + reproducible headless sweep done; automated in‑app comparative dashboard still to build
- ✅ **Forced‑airflow (fan) scenarios** — µg leaf + ventilation; **≈2.8 cm/s nulls the microgravity penalty** (`results/T6`, `F6`). Three in‑app fan presets (3/8/17 cm/s).
- ✅ **Spaceflight‑hardware scenarios** — BRIC (sealed) / CARA (micropore tape) / VEGGIE (vented) as dish boundary conditions, ±light (`results/F7`, `T7`, `T8`, `DISCUSSION.md §3.7`). Added a semi‑permeable membrane BC. BRIC: CO₂ fixed in ~7 min / O₂ hypoxia ~6.5 days.
- ✅ **Membrane + fan across all three scales** — Earth‑equivalent ventilation **≈2.6 / 11 / 21 cm/s** (leaf/rosette/canopy); BRIC≈CARA at the surface, one VEGGIE speed under‑serves denser stands (`results/F8`, `F9`, `T9`, `T10`, `§3.8`). 4 new in‑app presets → 23 scenarios.
- ✅ **Closed‑loop CO₂‑limited photosynthesis** — surface flux now feeds back on assimilation (`§3.9`, `F10`, `T11`, `T12`). Spatial self‑suppression 1–4% (most in rosette crown); over a photoperiod a **sealed BRIC dish fixes ~1%** of Earth carbon vs ~90% (CARA) / ~100% (VEGGIE). 3 feedback presets → 26 scenarios.
- ✅ **Draft manuscript assembled** — [`results/MANUSCRIPT.md`](results/MANUSCRIPT.md) (full paper) + [`results/manuscript/manuscript.tex`](results/manuscript/manuscript.tex) (self‑contained npj‑Microgravity‑style LaTeX, 9 figures + 5 tables, structure‑validated).

#### 5a. First science result — three scales × gravity
All three plant scales share one physics: the surface is a stomatal source/sink (CO₂ uptake, O₂ + H₂O
release), the near‑surface air is lighter (humid, CO₂‑depleted), and solutal Boussinesq buoyancy drives
the convection that sweeps the boundary layer — until gravity is reduced. Fields are excess‑over‑ambient
(so ambient = 0 and CO₂ goes negative). Headless sweep, 30 000 steps each, reproducible (select any preset
in the app and press Run). ΔC is the surface‑to‑ambient gap, reported as **mean / peak** over the surface:

| Scale · gravity | u_max (convection) | ΔC H₂O (mean/peak) | ΔC CO₂ (mean/peak) |
|---|---|---|---|
| Single leaf · 1 g | 4.6e‑2 | 0.128 / 0.188 | −0.161 / −0.246 |
| Single leaf · **µg** | **0.0** | **0.231** / 0.263 | **−0.326** / −0.373 |
| Rosette · 1 g | 4.6e‑2 | 0.225 / 0.509 | −0.298 / −0.715 |
| Rosette · **µg** | **0.0** | **0.384** / 0.698 | **−0.554** / −1.033 |
| Microgreen canopy · 1 g | 7.0e‑2 | 0.252 / 0.425 | −0.327 / −0.539 |
| Microgreen canopy · **µg** | **0.0** | **0.367** / 0.505 | **−0.445** / −0.602 |

**Two effects, both reproduced from first principles:**
1. **Gravity.** Within every scale, dropping to microgravity kills convection (u_max → 0) and steepens the
   surface gaps ≈1.5–1.8× — the leaf/stand sits in stale, CO₂‑starved, humid air. (The full single‑leaf
   Mars/Moon points scale ≈√g: u_max 4.6e‑2 → 2.8e‑2 → 1.6e‑2 → 0.)
2. **Scale.** Denser geometry traps air, so the gaps grow leaf → rosette → canopy. The rosette crown shows
   the steepest *peak* (0.51 vs the leaf’s 0.19 — tightly enclosed pockets); the canopy shows the highest
   *mean* (the whole stand stagnates). The two compound: a microgravity canopy is the worst case.

This is the candidate spaceflight plant‑stress mechanism, now reproduced across the three scales the project
set out to model. *(Modelling notes: kept in the low‑Mach/Boussinesq‑valid regime, u_max < 0.1 and β·ΔC ≲ 0.5;
the canopy uses a reduced per‑leaf flux representing self‑shading. Absolute ΔC magnitudes are in lattice
excess units — the trends and ratios are the result. Larger domains, forced‑airflow ventilation, and
calibration to the measured Vernier gas‑exchange data (Milestone 4) are the next refinements.)*

### Milestone 4 — Validation against real data — 🟡 gas-exchange validation done (see `results/`)
- ✅ Ingest Vernier O₂/RH/temperature `ExportedData` time series (diel gas cycling; `results/figures/F1,F2`)
- ✅ Anchor the model to measured flux — net assimilation **3.85 µmol CO₂ m⁻² s⁻¹** (biomass workbook) + Vernier cross-check; closed-chamber transport reproduced (mass conserved 2×10⁻⁵)
- ✅ Physical prediction — surface CO₂ drawdown **≈4 ppm (leaf, Earth) → ≈13 ppm (rosette bulk, µg)**, anchored on the measured flux (`results/tables/T5`, `DISCUSSION.md`)
- ⬜ Cross‑check against the "Imaging of pH, CO₂ and O₂ around Arabidopsis" reference (spatially-resolved test — next)

**→ Results package: [`results/`](results/README.md)** — tables T1–T5, figures F1–F5, and an
academic results + discussion write-up ([`results/DISCUSSION.md`](results/DISCUSSION.md)).

### Milestone 5 — Publish
- ⬜ 3D solver benchmark (optional, if WebGPU perf allows)
- 🟡 Zenodo release — repo packaged & Zenodo-ready (`LICENSE`, `.zenodo.json`, `CITATION.cff` added); tag a release + link the GitHub↔Zenodo webhook to mint the DOI
- 🟡 *npj Microgravity* manuscript — draft assembled ([`results/MANUSCRIPT.md`](results/MANUSCRIPT.md), [`.docx`](results/MANUSCRIPT.docx), [LaTeX](results/manuscript/manuscript.tex)); finalise authors/refs

## License & citation
Source code: **MIT** (`LICENSE`). Manuscript text and figures under `results/` (`MANUSCRIPT.md`,
`DISCUSSION.md`, `manuscript/`, `figures/`): **CC-BY-4.0**. Raw third-party measurement data are not
redistributed — referenced by provenance. To cite, see [`CITATION.cff`](CITATION.cff).

---

## 6. Success criteria (definition of "great", so we don't repeat the prototypes)
1. **It solves physics, not cosmetics.** Every visualised field comes from a numerical solve, and the
   flow solver passes at least one textbook benchmark (flow past a cylinder: Strouhal ≈ 0.2 at Re≈100).
2. **Gravity changes the answer.** Reducing `g` demonstrably thickens δ and steepens ΔC, with
   Gr/Ra scaling as theory predicts — reproducible on demand.
3. **A non‑CFD scientist can use it.** Upload a leaf, pick a gravity, press run, read the numbers.
4. **Every result is reproducible & exportable.** Run manifest in, CSV/VTK/figures out.
5. **At least one quantitative comparison to real measured data** exists for the paper.

---

## 7. Zenodo readiness checklist
- ⬜ `LICENSE` (code) + `LICENSE-data` if bundling data
- ⬜ `.zenodo.json` (authors, ORCIDs, keywords, funding, related identifiers linking the 3 legacy repos)
- ⬜ `CITATION.cff`
- ⬜ Versioned release tag (`v0.1.0` …) and GitHub↔Zenodo webhook
- ⬜ Archived reference datasets or clear links to their sources
- ⬜ Screenshots / demo GIF / short methods note in the deposit
- ⬜ ORCID for all contributors; funding/grant acknowledgements

## 8. *npj Microgravity* paper readiness checklist
Target: methods/tool paper with a validation case study.
- ⬜ **Abstract** — tool + the gravity→boundary‑layer→gradient finding
- ⬜ **Introduction** — spaceflight gas‑exchange problem; boundary‑layer/convection background
- ⬜ **Methods** — governing equations, solver, buoyancy model, BCs, geometries, validation protocol
- ⬜ **Results** — benchmark validation; single‑leaf/rosette/canopy gravity sweeps; comparison to measured data
- ⬜ **Discussion** — implications for spaceflight growth hardware & forced‑ventilation design
- ⬜ **Data/Code availability** — Zenodo DOI + GitHub
- ⬜ **Figures** — solver schematic, gradient maps vs. g, δ(g) and Gr/Ra curves, validation overlay
- ⬜ Author list, affiliations, ORCIDs, CRediT roles, funding

---

## 9. Data & validation assets (already in hand)
Kept out of git until curated; sources noted for the deposit.
- **Vernier gas‑exchange time series** — `Arabidopsis_v2_ExportedData.csv`, `Arabidopsis_right_v3_ExportedData.csv`
  (O₂ %, temperature, relative & absolute humidity vs. time) → Milestone 4 validation.
- **`Biomass_FW_DW_gas_exchange_data.xlsx`** — fresh/dry weight + gas exchange.
- **"Imaging of pH, CO₂ and O₂ levels around Arabidopsis" (PDF)** — spatial gradient reference.
- **Real leaf 3D model** — `single-leaf` (`leaf.glb` + UV texture) → geometry import test case.
- **Reference software to learn from** — VirtualLeaf (cell‑based tissue), Vernier GasLab.

---

## 10. Repository structure
```
LunarLeaf_CFD/
├── README.md                     ← this file (the living goal tracker)
├── docs/
│   ├── ANALYSIS_OF_PRIOR_ATTEMPTS.md
│   ├── ARCHITECTURE_AND_PLAN.md
│   └── PHYSICS_NOTES.md          ← governing equations & dimensionless numbers (to add)
├── src/                          ← the consolidated app (Milestone 1 scaffolded)
│   ├── solver/lbm/               ← d2q9, LBMFluid, ScalarField, buoyancy
│   ├── solver/diagnostics/       ← dimensionless numbers, Ghia reference, Strouhal probe
│   ├── scenarios/                ← cavity + cylinder validation cases
│   ├── render/                   ← colormaps + field rasteriser
│   ├── sim/                      ← SimulationController (RAF loop)
│   └── ui/                       ← App.tsx debug bench
├── index.html · package.json · vite.config.ts · tsconfig.json
├── legacy/                       ← the three AI‑Studio prototypes (to import for credit/reference)
├── validation/                   ← measured datasets + comparison notebooks (to add)
├── .zenodo.json                  ← (to add)
└── CITATION.cff                  ← (to add)
```

---

## 11. How to contribute / next action
The immediate next step is **Milestone 1**: stand up the real 2D flow + advection–diffusion solver
with a user‑controlled gravity vector, validated on a textbook benchmark. Everything else (UI polish,
3D import, canopy scale) layers on top of a solver we can trust. See
[`docs/ARCHITECTURE_AND_PLAN.md`](docs/ARCHITECTURE_AND_PLAN.md) for the build order.

*This README is the single source of truth for project goals and progress — update the checkboxes as
milestones land so the path to Zenodo and the npj Microgravity paper stays visible at a glance.*
