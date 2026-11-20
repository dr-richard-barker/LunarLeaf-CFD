# LunarLeaf-CFD

[![Live demo](https://img.shields.io/badge/demo-live-brightgreen)](https://dr-richard-barker.github.io/LunarLeaf-CFD/)
[![License: MIT](https://img.shields.io/badge/code-MIT-blue.svg)](LICENSE)
[![License: CC BY 4.0](https://img.shields.io/badge/results-CC%20BY%204.0-lightgrey.svg)](results/)

A browser-based CFD workbench for modelling gravity-dependent airflow and
O₂, CO₂, and H₂O transport around *Arabidopsis* at leaf, rosette, and canopy scales.

[**Launch the live demo**](https://dr-richard-barker.github.io/LunarLeaf-CFD/) ·
[Read the manuscript draft](public/paper.html) ·
[Explore the results](results/README.md) ·
[Review the architecture](docs/ARCHITECTURE_AND_PLAN.md)

![Microgravity stagnation around spaceflight plants](Microgravity_Stagnation_in_Spaceflight_Plants.png)

## Why this project

On Earth, natural convection carries humid, CO₂-depleted air away from a leaf
and replaces it with air from the surrounding bulk. In microgravity, buoyancy-
driven convection disappears, leaving molecular diffusion to dominate.

LunarLeaf-CFD evaluates whether this transition:

- Thickens the gas-exchange boundary layer
- Steepens near-leaf O₂, CO₂, and H₂O gradients
- Amplifies from an isolated leaf to a rosette or dense canopy
- Can be mitigated by forced airflow or spaceflight hardware ventilation
- Produces results that can be compared with measured gas-exchange data

The project uses a two-dimensional D2Q9 lattice-Boltzmann solver with Boussinesq
buoyancy and species transport. It is designed for research, education,
hypothesis generation, and reproducible publication work—not clinical or
flight-safety certification.

## Key capabilities

- Interactive browser-based solver
- Gravity presets for microgravity, Moon, Mars, and Earth
- Arbitrary positive gravity magnitude and direction
- CO₂ uptake and O₂/H₂O release at plant surfaces
- Leaf, rosette, and microgreen-canopy geometries
- Forced-airflow and spaceflight-hardware scenarios
- CO₂-limited photosynthesis and humidity-limited transpiration feedback
- Boundary-layer thickness, conductance, and dimensionless-number reporting
- Headless TypeScript validation and sweep exports
- Python analysis and publication-quality figure generation
- CSV, manuscript, LaTeX, DOCX, and figure outputs

## Scientific status

The scientific core has passed four reproducible numerical validation gates:

| Validation gate | Reference | Result | Status |
|---|---:|---:|:---:|
| Lid-driven cavity, Re = 100 | Ghia et al. L2 < 0.05 | 0.0105 | ✅ Pass |
| Flow past cylinder, Re = 100 | Strouhal ≈ 0.164–0.20 | 0.192 | ✅ Pass |
| Natural-convection cavity, Ra = 10⁴ | Nu = 2.238 | 2.242 | ✅ Pass |
| Pure diffusion | Analytic error-function limit | ≈ 0.0000 | ✅ Pass |

An optional multiple-relaxation-time MRT collision scheme also passes the
same validation suite.

The model has also been checked against:

- Diel Vernier gas-exchange measurements
- Measured net assimilation and biomass-derived flux estimates
- Closed-chamber mass conservation
- Steady-state and grid-resolution sensitivity checks
- Leaf, rosette, and canopy gravity sweeps
- BRIC, CARA, and VEGGIE boundary-condition scenarios
- Forced-airflow inlet and outlet variants
- Leaf-shape and surface-distribution sensitivity studies

See [`results/`](results/README.md) for tables, figures, negative results,
caveats, and reproduction instructions.

## Main findings

Across the three plant scales, reducing gravity from Earth to microgravity:

- Reduces peak convection velocity toward zero
- Increases mean CO₂ surface gaps by approximately 2.0–2.3×
- Increases mean H₂O surface gaps by approximately 1.7–2.1×
- Reduces isolated-leaf boundary-layer conductance from approximately
  0.997 to 0.443 mol m⁻² s⁻¹
- Amplifies stagnation as geometry changes from leaf to rosette to canopy
- Is partly mitigated by ventilation, although the required airflow is scale-dependent

A forced airflow of approximately 2.0 cm/s restores Earth-equivalent gradients
for the isolated leaf in the model; approximately 6.1 cm/s is required for the
rosette. The canopy remains outside the validated low-Mach operating range
within the tested fan sweep.

Full results are in [`results/tables/`](results/tables/) and
[`results/figures/`](results/figures/).

## Run the application

### Requirements

- Node.js 18 or newer
- npm
- A modern browser with JavaScript enabled
- A visible browser tab for interactive runs

The browser animation loop is throttled in background tabs.

### Development

```bash
git clone https://github.com/dr-richard-barker/LunarLeaf-CFD.git
cd LunarLeaf-CFD
npm install
npm run dev
```

Open the local address printed by Vite.

### Production build

```bash
npm run build
npm run preview
```

`vite.config.ts` uses a relative base, allowing the build to be served from
GitHub Pages project-subpath deployments.

## Run validation gates

```bash
npx esbuild validation/gates.ts \
  --bundle \
  --format=esm \
  --platform=node \
  --loader:.json=json \
  --outfile=validation/gates.mjs

node validation/gates.mjs
```

With the MRT collision scheme:

```bash
LBM_COLLISION=mrt node validation/gates.mjs
```

Additional reproducible checks are documented in
[`results/README.md`](results/README.md).

## Repository structure

```text
src/
  solver/       D2Q9 LBM, scalar transport, buoyancy, diagnostics
  leaf/         Leaf outlines, sections, deformations, and assets
  scenarios/    Leaf, rosette, canopy, fan, and hardware scenarios
  sim/          Browser simulation and request-animation-frame control
  render/       Rasterisation and concentration/velocity colour maps
  ui/           React application and simulation controls

validation/     Headless solver gates and reproducible sweep jobs
analysis/       Python convergence, stationarity, and plotting tools
results/        Tables, figures, discussion, and manuscript drafts
manuscript/     Journal-style TeX, Markdown, and document outputs
docs/           Prior-attempt analysis and architecture documentation
tools/          Leaf-tracing and leaf-asset generation utilities
public/         Static manuscript and browser assets
```

## Documentation

- [Results package and reproduction guide](results/README.md)
- [Scientific results and limitations](results/DISCUSSION.md)
- [Manuscript draft](results/MANUSCRIPT.md)
- [Architecture and implementation plan](docs/ARCHITECTURE_AND_PLAN.md)
- [Prior prototype analysis](docs/ANALYSIS_OF_PRIOR_ATTEMPTS.md)
- [Leaf asset provenance](src/leaf/assets/PROVENANCE.md)

## Current limitations

- The production solver is currently two-dimensional
- Plant leaves are represented by cross-sections or analytic stand-ins
- Most cases operate in a low-Mach, Boussinesq-valid regime
- Absolute concentration values depend on the chosen lattice-to-physical mapping
- Real dish geometry and finite chamber volumes matter substantially at microgravity
- Microgravity chamber predictions are not independent of chamber size
- Raw third-party measurements are intentionally not redistributed
- The canopy and some high-ventilation cases exceed the current validated operating range
- 3D geometry import, GPU acceleration, and a general project editor remain future work
- Wet-agar and highly buoyant humidity forcing are explicitly flagged as unsafe or unresolved cases

These limitations are an important part of the results, not implementation defects
to hide.

## Roadmap

Near-term work is focused on completing publication readiness:

- [ ] Mint a Zenodo DOI and attach it to the repository metadata
- [ ] Finalise author contributions, affiliations, ORCID records, and funding
- [ ] Complete the spatially resolved CO₂/O₂ comparison
- [ ] Regenerate stale table T12 and remaining unverified predictions
- [ ] Submit the manuscript to *npj Microgravity*
- [ ] Add 3D geometry import and voxelisation if performance permits
- [ ] Add a persistent project/run-manifest format
- [ ] Provide CSV/VTK/figure export in the browser interface
- [ ] Compare against additional independent CFD and experimental data

The active technical plan is in
[`docs/ARCHITECTURE_AND_PLAN.md`](docs/ARCHITECTURE_AND_PLAN.md).

## License

- Source code: [MIT License](LICENSE)
- Manuscript text and original figures under `results/`: CC BY 4.0
- Raw third-party datasets are not redistributed and are documented by
  provenance in [`results/DISCUSSION.md`](results/DISCUSSION.md)

## Citation

Until a release DOI is minted, cite this repository using
[`CITATION.cff`](CITATION.cff).

```bibtex
@software{barker_lunarleaf_cfd,
  author = {Barker, Richard D.},
  title = {LunarLeaf-CFD},
  url = {https://github.com/dr-richard-barker/LunarLeaf-CFD},
  version = {0.1.0}
}
```

## Part of the AstroBotany/AIRI project

LunarLeaf-CFD is part of the AstroBotany / AIRI research family and the
Lunar Leaf line of work, including
[O2_and_CO2_calculations_LUNAR_LEAF](https://github.com/dr-richard-barker/O2_and_CO2_calculations_LUNAR_LEAF-).
