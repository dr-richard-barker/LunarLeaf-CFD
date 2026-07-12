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

### Milestone 1 — Real 2D solver (the scientific core)
- 🟡 Incompressible flow solver (D2Q9 LBM, BGK) — **built and validated on both benchmarks** (see below); scalar/buoyancy modules written, not yet wired to a scenario
- 🟡 Scalar advection–diffusion for CO₂, O₂, H₂O — D2Q5 `ScalarField` implemented with correct diffusivities; validation gate 4 (pure-diffusion erf limit) still to wire
- 🟡 Boussinesq buoyancy coupled to a **user‑set gravity vector** (µg → 1 g) — `applyBoussinesqForce` + gravity presets implemented; gate 3 (natural-convection Nu–Ra) still to wire
- ⬜ Leaf boundary as source/sink (stomatal flux BCs)
- 🟡 Report Gr, Ra, Re, Sh, Nu, δ, g_bl each run — Re/Gr/Ra/Pe/Sc reporter implemented; δ, Sh, g_bl come with the leaf scenario

#### Milestone 1 validation results (headless, reproducible)
| Gate | Benchmark | Expected | Measured | Status |
|---|---|---|---|---|
| **1** | Lid-driven cavity, Re 100 — centreline vs. Ghia et al. (1982) | L2 < 0.05 | **L2 = 0.0105** (11k steps) | ✅ PASS |
| **2** | Flow past cylinder, Re 100 — Kármán shedding Strouhal | 0.164 unconfined; ≈0.19–0.20 at ~17% blockage | **St = 0.192** (16 cycles, 40k steps) | ✅ PASS |

Run the interactive bench with `npm install && npm run dev` → open the Scenario selector, press **Run**, watch the diagnostics/gate panel. (A visible browser tab is needed — background tabs throttle `requestAnimationFrame` to zero.)

### Milestone 2 — User‑friendly GUI (professional‑package features)
- ⬜ Import 3D models (STL / OBJ / GLB / PLY) + parametric leaf‑shape generator
- ⬜ Auto‑voxelise geometry to solver grid; domain & mesh controls
- ⬜ Boundary‑condition editor (inlet/outlet/walls, forced airflow, gravity direction & magnitude)
- ⬜ Live field visualisation (velocity, pressure, species concentration, streamlines, iso‑lines)
- ⬜ Probe/measure tool, plots, and CSV / VTK / PNG / MP4 export
- ⬜ Save / load project files; reproducible run manifests

### Milestone 3 — Three scales + gravity sweep
- ⬜ Single‑leaf preset & validation
- ⬜ Rosette preset (multi‑leaf)
- ⬜ Microgreen‑canopy preset (community/porous‑canopy)
- ⬜ Automated gravity sweep with comparative dashboard

### Milestone 4 — Validation against real data
- ⬜ Ingest Vernier O₂/RH/temperature `ExportedData` time series
- ⬜ Compare modelled vs. measured surface gas dynamics; report error
- ⬜ Cross‑check against the "Imaging of pH, CO₂ and O₂ around Arabidopsis" reference

### Milestone 5 — Publish
- ⬜ 3D solver benchmark (optional, if WebGPU perf allows)
- ⬜ Zenodo release (see checklist §7)
- ⬜ *npj Microgravity* manuscript (see checklist §8)

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
