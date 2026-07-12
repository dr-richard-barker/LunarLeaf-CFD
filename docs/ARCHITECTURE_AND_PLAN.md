# Architecture & Build Plan — LunarLeaf‑CFD

How to build a browser tool that **actually solves** gravity‑dependent airflow and O₂/CO₂/H₂O
transport around Arabidopsis, wrapped in the friendly GUI the prototypes already proved works.

Guiding principle: **engine first.** A beautiful UI over a fake solver is exactly what the three
prototypes were. We build a trustworthy solver, validate it on textbook benchmarks, and only then
layer on the wizard, 3D import, and canopy scales.

---

## 1. The physics we must solve

### 1.1 Governing equations
Incompressible flow with buoyancy (Boussinesq) + one advection–diffusion equation per gas species.

- **Continuity:** ∇·**u** = 0
- **Momentum (Navier–Stokes + buoyancy):**
  ∂**u**/∂t + (**u**·∇)**u** = −(1/ρ)∇p + ν∇²**u** + **f_b**
- **Buoyancy body force (the gravity coupling — the crux):**
  **f_b** = **g** · [ β_T (T − T₀) + Σ_i β_{c,i}(c_i − c_{i,0}) ]
  where **g** is the **user‑set gravity vector** (magnitude 0 → 9.81 m s⁻²; direction editable),
  β_T is thermal expansion, and β_{c,i} are solutal expansion coefficients (CO₂ is denser than air,
  H₂O vapour and warm air are lighter — this is what drives/kills natural convection).
- **Species transport (i = CO₂, O₂, H₂O):**
  ∂c_i/∂t + (**u**·∇)c_i = D_i ∇²c_i + S_i
  with molecular diffusivities D_CO₂ ≈ 1.6×10⁻⁵, D_O₂ ≈ 2.0×10⁻⁵, D_H₂O ≈ 2.4×10⁻⁵ m² s⁻¹ (air, ~25 °C).

**Set g = 0 and the buoyancy term vanishes → no natural convection → transport falls back to pure
diffusion → boundary layer thickens and gradients steepen.** That single switch is the paper.

### 1.2 Boundary conditions
- **Leaf surface (biological BC):** CO₂ **sink** (assimilation A), O₂ **source**, H₂O **source**
  (transpiration E). Fluxes settable from photosynthesis/transpiration parameters, or held at fixed
  surface concentration for the simplest validation case.
- **Domain:** inlet (forced airflow, optional), outlet, and walls/symmetry — inherited from Attempt 1's schema.
- **Forced convection option:** a fan/ventilation inlet, because spacecraft growth hardware uses
  forced airflow to replace the buoyancy µg removes — a key design question for the Discussion.

### 1.3 Dimensionless numbers to compute & report every run
Grashof `Gr = gβΔT L³/ν²`, Rayleigh `Ra = Gr·Pr`, Reynolds `Re = UL/ν`, Péclet `Pe = UL/D`,
Sherwood `Sh` (mass‑transfer analogue of Nusselt `Nu`), and the boundary‑layer conductance
`g_bl` — the quantity gas‑exchange physiologists actually use, so results plug straight into the literature.

---

## 2. The solver — recommendation

**Primary: Lattice‑Boltzmann Method (LBM), D2Q9, on the GPU (WebGPU compute, WebGL2 fallback).**

Why LBM for this project:
- **Complex, imported leaf geometry is trivial** — solid cells use bounce‑back; voxelising an STL is
  exactly the input LBM wants.
- **Massively parallel & local** → maps perfectly to GPU compute shaders → real‑time in a browser.
- **Buoyancy and scalar transport add cleanly** via a body‑force term and extra distribution
  functions per species (thermal/species LBM is standard).
- Naturally handles the porous, multi‑obstacle **microgreen canopy** case.

**Reference/validation twin: a CPU finite‑volume projection solver in a Web Worker (WASM via
Rust/C++ or plain TS).** Slower, but unambiguous and easy to check against textbook results — used to
certify the LBM engine and to run headless for the paper's figures.

> Decision to confirm at Milestone 1: start in **2D** (a leaf cross‑section / vertical slice through
> the canopy). 2D captures the whole gravity→boundary‑layer→gradient story at a tiny fraction of the
> cost and is enough for the first paper. 3D is a Milestone‑5 stretch goal gated on WebGPU performance.

### Validation gates (must pass before any biology result is trusted)
1. **Lid‑driven cavity** at Re 100/400/1000 → match Ghia et al. centreline velocities.
2. **Flow past a cylinder** at Re ≈ 100 → vortex shedding at Strouhal ≈ 0.2.
3. **Natural‑convection cavity** (hot/cold walls) → match Nu vs. Ra benchmark → *proves buoyancy is right.*
4. **Pure‑diffusion limit** (g = 0, U = 0) → recover the analytic error‑function concentration profile.

---

## 3. Application architecture

```
┌──────────────────────────── UI (React + TypeScript) ────────────────────────────┐
│  Setup Wizard  │  3D/2D Viewport (R3F)  │  Results Dashboard  │  Explain (LLM)   │
│  [from Att.1]  │  [leaf shader Att.2]   │  [plots + probes]   │  [from Att.3]    │
└───────┬────────────────┬───────────────────────┬──────────────────────┬─────────┘
        │ params          │ geometry              │ fields                │ summary
┌───────▼─────────────────▼───────────────────────▼──────────────────────▼─────────┐
│                         Simulation Orchestrator (TS)                              │
│   run manifest ⇄ scheduler ⇄ gravity sweeps ⇄ export (CSV/VTK/PNG/MP4)            │
└───────┬───────────────────────────────────────────────────────────────┬──────────┘
        │                                                                 │
┌───────▼──────────────── Solver Core ───────────────┐        ┌──────────▼─────────┐
│ WebGPU/WebGL LBM: flow + buoyancy + species AD      │  ⇄     │ WASM/CPU FV twin   │
│ voxelised geometry · dimensionless‑number reporter  │        │ (validation/CI)    │
└──────────────────────────────────────────────────────┘        └────────────────────┘
        │
┌───────▼──────────── Geometry pipeline ──────────────┐
│ import STL/OBJ/GLB/PLY · parametric leaf generator  │
│ voxelise → solid mask · signed‑distance for BCs     │
└──────────────────────────────────────────────────────┘
```

### Recommended stack
- **UI:** React + TypeScript + Tailwind (all three prototypes already use this) + Zustand for state.
- **3D:** three.js / react‑three‑fiber + drei (reuse Attempt 2's viewport & leaf shader).
- **Geometry:** `three` STL/OBJ/GLB/PLY loaders → custom voxeliser (SDF‑based) → solid mask + surface‑flux BCs.
- **Solver:** WebGPU compute shaders (WGSL) with a WebGL2 transform‑feedback fallback; WASM CPU twin
  for validation/CI.
- **Viz:** GPU field textures → colormaps, iso‑lines, GPU streamline/LIC, probe readouts.
- **Export:** CSV (time series & probes), VTK (fields, for ParaView), PNG (figures), WebM/MP4 (animations),
  `.llcfd.json` project files (full reproducible manifest).
- **Optional:** small Python `validation/` package (NumPy) for the benchmark reference solutions and
  paper figures — keeps the science reproducible outside the browser too.

---

## 4. "Professional FDM/CFD package" feature checklist
The GUI features a serious package is expected to have, mapped to milestones (M).

**Geometry & meshing (M2)**
- Import STL / OBJ / GLB / PLY; drag‑and‑drop.
- Parametric leaf‑shape generator (obovate ↔ lanceolate, serration, curl) for quick studies.
- Auto‑voxelise to grid; adjustable resolution; solid/fluid preview; scale & orient; multi‑object placement.

**Domain & boundary conditions (M2)**
- Domain box sizing & object positioning (from Attempt 1).
- Inlet (forced airflow) / outlet / wall / symmetry faces.
- **Gravity control: magnitude slider (0 → 1 g) + direction gizmo + presets (µg, Moon 0.17 g, Mars 0.38 g, Earth 1 g).**
- Biological surface fluxes (CO₂ uptake, O₂/H₂O release) with sensible defaults & literature ranges.

**Solver control (M1–M2)**
- Choose engine (LBM GPU / FV CPU), resolution, time step, steady vs. transient, convergence tolerance.
- Live residual/convergence monitor; pause/resume/step.

**Visualisation (M2)**
- Fields: velocity magnitude & vectors, pressure, **CO₂ / O₂ / H₂O concentration**, temperature.
- Streamlines / LIC, iso‑lines, boundary‑layer overlay (now data‑driven, not a shader glow).
- Time animation; synchronized 2‑up compare (e.g. 1 g vs µg side by side).

**Measurement & analysis (M1–M3)**
- Point/line probes; extract δ, ΔC, surface flux, conductance.
- Auto‑computed Gr/Ra/Re/Sh/Nu/Pe panel.
- **Parameter sweeps** (esp. gravity sweep) → comparative dashboard & summary table.

**Data management (M0–M2)**
- Save/load project (`.llcfd.json`); reproducible run manifest (params + solver version + seed).
- Export CSV / VTK / PNG / MP4; batch/headless run for the paper.

**Accessibility & outreach (M2, from Attempt 3)**
- Plain‑language auto‑summary of *real* results (LLM narrates computed numbers, never invents them).
- Guided "story mode" for students; tooltips linking each control to the science.

---

## 5. Build order (dependencies first)

1. **M1 · Engine (2D):** LBM flow solver + validation gates 1–2 → add buoyancy + gate 3 → add species
   AD + gate 4 → dimensionless‑number reporter. *No fancy UI yet — a debug canvas is fine.*
2. **M2 · GUI:** port Attempt 1's wizard onto the real solver; add geometry import + voxeliser; wire
   Attempt 2's viewport to render solved fields; add probes, export, save/load.
3. **M3 · Scales & sweeps:** single‑leaf preset → rosette → microgreen canopy; automated gravity sweep.
4. **M4 · Validation:** ingest Vernier `ExportedData` CSVs; quantitative model‑vs‑measured comparison.
5. **M5 · Publish:** (optional 3D), Zenodo release, npj Microgravity manuscript.

Each milestone is demoable on its own, and **nothing biological is claimed until the validation gates
in step 1 pass** — the discipline the prototypes lacked.

---

## 6. Key risks & mitigations
- **WebGPU availability** → ship WebGL2 fallback; CPU WASM twin guarantees a correct answer even if slow.
- **3D cost in a browser** → commit to 2D for the first paper; 3D is explicitly a stretch goal.
- **"Looks right" ≠ "is right"** (the prototype trap) → hard validation gates + a CPU reference twin in CI.
- **Biological BC uncertainty** → expose flux parameters with literature ranges; validate against the
  measured gas‑exchange datasets rather than asserting values.
- **Scope creep** → the milestone tracker in the README is the contract; engine before ornament.
