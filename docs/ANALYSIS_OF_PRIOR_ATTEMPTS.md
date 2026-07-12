# Analysis of the Three Prior Google AI Studio Prototypes

Each was a genuine step forward on *one* axis, and each hit the same wall: **no physics is actually
solved.** The consolidation strategy is to harvest the best axis from each and put a real solver
underneath. Grades below are relative to the goal of a *scientifically defensible, publishable* tool.

---

## Attempt 1 — `Aero-leaf-CFD-analysis-adapted-from-blender-ish`
**"AeroLeaf CFD" · React + Vite + TypeScript · client‑side**

### What it is
A polished, guided **5‑step CFD setup wizard**:
1. Model upload → 2. Domain setup (size, inlet/outlet face, object position) →
3. Environment (wind speed/direction, temperature, pressure, air density, viscosity) →
4. Solver settings (turbulence model RANS/LES/DES, mesh coarse/medium/fine, run time, time step) →
5. Summary → run → results dashboard (drag/lift plots, velocity/pressure/TKE contours, mesh, streamlines).

### Strengths — **keep these**
- **The best information architecture of the three.** The 5‑step flow maps exactly onto how a real
  CFD case is set up. `types.ts` already defines a clean, near‑professional parameter schema.
- Config **save/load** to local JSON — the seed of reproducible run manifests.
- Clean component split (`steps/`, `ui/`, `services/`) that a real solver can slot into.

### Fatal weakness
- The "solver" is `services/simulationService.ts` → **`Math.random()` with a sine wave.** Drag/lift
  are noise; contour images and streamlines are procedurally drawn, not computed. The README admits it:
  *"a mock simulation engine … does not perform real‑world CFD calculations."*
- No species transport at all (no CO₂/O₂/H₂O). No gravity. "Blender/CFD backend" is aspirational text.

### Verdict
**Grade: A‑ for UX, F for physics.** Adopt its wizard, schema, and save/load wholesale. Replace the
service layer with the real solver.

---

## Attempt 2 — `AstroBotany_LEAF_FDM_model_test`
**"AstroBotany FDM Simulator" · React + react‑three‑fiber + GLSL · client‑side**

### What it is
A real‑time **3D shader rendering** of an Arabidopsis leaf in a starfield. A vertex shader morphs the
leaf between flat (1 g) and curled/lanceolate (µg hyponasty) via `uGravityFactor`; a fragment shader
procedurally paints anatomically‑plausible **veins, trichomes, stomata**, dynamic grow‑light colour,
and a translucent cyan "boundary‑layer gas" whose thickness/turbulence responds to sliders. State
includes `co2Flux`, `o2Flux`, `boundaryLayerThickness`, `photosyntheticEfficiency`, gravity mode.

### Strengths — **keep these**
- **The best visual fidelity and the best biology framing.** It already *shows* the right story:
  gravity changing leaf morphology and a boundary layer around the tissue.
- The right **state variables are already named** (CO₂/O₂ flux, boundary‑layer thickness, gravity
  factor, ambient CO₂/O₂, temperature) — a good scaffold for the real model's inputs/outputs.
- react‑three‑fiber viewport, orbit controls, space aesthetic — reuse for the 3D result viewer.

### Fatal weakness
- **Nothing is solved.** `co2Flux`/`o2Flux` are slider values that drive shader brightness, not a
  transport equation. The "boundary layer" is a Fresnel‑based glow (`uBoundaryLayerThickness` →
  opacity), not a diffusion profile. Gravity morphs *appearance*, not the *flow field*.
- 2D texture space only; no domain, no grid, no conservation, no measurable output.

### Verdict
**Grade: A for visualisation & narrative, F for physics.** Reuse the leaf shader and R3F viewport as
the *rendering* layer that displays real solved fields — but the fields must come from the solver.

---

## Attempt 3 — `Nature-s-aerodynamic-analyser`
**"Nature's Aerodynamics CFD GUI" · React + Vite + Gemini API**

### What it is
Upload a model, set wind speed/direction, toggle a visualisation (pressure/velocity/streamlines/
forces), and **Gemini (`gemini-2.5-flash`) writes a plain‑language aerodynamics analysis.** Overlays
are animated hand‑drawn SVG streamlines; the one real calculation is dynamic pressure `q = ½ρv²`.

### Strengths — **keep these**
- **The friendliest, most accessible framing** and good plain‑language explanation aimed at biologists
  and students — valuable for the *education/outreach* layer and for auto‑generating a results
  narrative *from real numbers*.
- Clean visualisation‑toggle UX and compass/wind‑direction control.

### Fatal weakness
- **The "analysis" is language, not computation.** Gemini guesses plausible Cd/Cl and pressure zones
  from the object's *name*; it never sees a solved field. Streamlines are decorative SVG unrelated to
  geometry. Scientifically unusable as‑is, and unpublishable as a method.

### Verdict
**Grade: A for approachability, F for physics.** Repurpose the LLM strictly as a *post‑hoc narrator of
real solver output* ("explain these computed gradients") and keep the accessible UX language.

---

## Cross‑cutting findings

### The common failure
All three are **presentation without simulation.** They independently discovered the three things a
good tool needs — a rigorous setup wizard (1), compelling gravity‑aware biological visualisation (2),
and accessible explanation (3) — but **all three faked the middle**, the numerical solve. And, most
importantly for the science: **not one couples gravity to buoyancy‑driven convection**, which is the
entire mechanism the project is meant to investigate.

### What none of them has (and the new tool must)
1. A conservation‑law solver (flow + multi‑species advection–diffusion).
2. A **gravity vector that enters the physics** via a Boussinesq buoyancy body force — so µg actually
   removes convection and thickens the boundary layer.
3. **Biological boundary conditions** — stomatal CO₂ sink / O₂ + H₂O source on the leaf surface.
4. **Quantitative, exportable outputs** (δ, ΔC, fluxes, Gr/Ra/Re/Sh/Nu, conductance).
5. **The three geometric scales** (leaf → rosette → microgreen canopy).
6. **Validation** against the measured Vernier gas‑exchange data already in hand.

### Reuse map (what carries into `LunarLeaf-CFD`)
| From | Reuse as |
|---|---|
| Attempt 1 wizard + `types.ts` schema + save/load | The **setup & project layer** |
| Attempt 2 leaf shader + R3F viewport + state names | The **rendering / result‑viewer layer** |
| Attempt 3 accessible copy + LLM | The **explain‑my‑results & outreach layer** (narrating real output) |
| *(new)* LBM/FD solver + buoyancy + species BCs | The **missing engine** — the actual contribution |

The build order therefore inverts the prototypes' priorities: **engine first, then dress it in the UI
the prototypes already proved works.**
