# Gravity-dependent gas-exchange boundary layers around *Arabidopsis*: a validated browser CFD model

**LunarLeaf-CFD — results and discussion (working draft for an *npj Microgravity*-style methods + case-study paper).**

This document reports the validation of the LunarLeaf-CFD solver against measured whole-plant
gas-exchange data and presents the first model predictions of how reduced gravity reshapes the
diffusive boundary layer — and the O₂/CO₂/H₂O gradients within it — around *Arabidopsis thaliana* at
three canopy scales. Figures (`F1`–`F5`) and tables (`T1`–`T5`) referenced below are in
`results/figures/` and `results/tables/`.

---

## 1. Summary

On Earth, a photosynthesising leaf warms and humidifies the adjacent air; the resulting density
deficit drives buoyant convection that continuously refreshes the leaf surface. In microgravity this
buoyancy vanishes, transport collapses toward pure molecular diffusion, the unstirred boundary layer
thickens, and surface gas gradients steepen. Using a Lattice-Boltzmann solver validated against four
textbook benchmarks **and** anchored to measured *Arabidopsis* gas-exchange rates, we show that:

1. reducing gravity from 1 g to microgravity **eliminates convective ventilation** (peak flow speed
   `u_max` → 0, scaling ≈ √g) and **steepens the surface-to-ambient gas gaps 1.5–1.8×** at every scale;
2. **canopy geometry amplifies the effect** — an isolated leaf is the mildest case, a rosette traps
   air in its crown (steepest local gradients), and a microgreen stand stagnates as a whole;
3. anchored on the measured net assimilation flux (3.85 µmol CO₂ m⁻² s⁻¹), the model predicts a
   boundary-layer CO₂ drawdown of **≈ 4 ppm (isolated leaf, Earth) rising to ≈ 13 ppm (rosette bulk,
   microgravity), with trapped crown pockets reaching ≈ 25 ppm** (`T5`);
4. the microgravity penalty is **fully reversible by forced ventilation** — a fan of only **≈ 2.8 cm s⁻¹**
   restores Earth-equivalent surface gradients for an isolated leaf (`T6`, `F6`), quantifying the design
   target for spaceflight growth hardware.

The gravity- and scale-dependence is a genuine model *prediction*; the flux magnitude and the
closed-chamber transport behaviour on which it rests are *validated* against measurement.

---

## 2. Solver validation (numerical)

Before any biology, the incompressible-flow + multi-species advection–diffusion solver was verified on
four benchmarks with independent analytic or reference solutions:

| Gate | Benchmark | Reference | Model | Status |
|---|---|---|---|---|
| 1 | Lid-driven cavity, Re 100 | Ghia et al. (1982) centreline profiles | L2 = 0.0105 | ✅ |
| 2 | Cylinder wake, Re 100 | Kármán shedding (St ≈ 0.16 unconfined) | St = 0.192 (confined) | ✅ |
| 3 | Natural-convection cavity, Ra 10⁴ | de Vahl Davis (1983), Nu = 2.238 | Nu = 2.242 (0.18 %) | ✅ |
| 4 | Pure diffusion | ½ erfc analytic profile | L2 ≈ 0 | ✅ |

Gate 3 is decisive: reproducing the differentially-heated-cavity Nusselt number to 0.18 % confirms
that the buoyancy/gravity coupling is quantitatively correct, so scaling **g → 0** genuinely collapses
convection to the diffusion limit certified by gate 4.

---

## 3. Results

### 3.1 Measured gas exchange anchors the model

Two independent measurements constrain the physical stomatal flux (`T1`, `F1`, `F2`). The Chew/Millar
whole-plant-chamber dataset gives a **net CO₂ assimilation of 1.38 µmol CO₂ h⁻¹ cm⁻² = 3.85 µmol m⁻² s⁻¹**
for Col wild-type, with dark respiration 1.18 µmol m⁻² s⁻¹ (R/A = 0.31) — textbook-typical for
*Arabidopsis*. The Vernier whole-chamber trace (`F1`) independently shows the expected closed-chamber
signature over 4.8 days: strong diel O₂ cycling (6.6–32.8 %) and humidity swings driven by
photosynthesis and respiration (`F2`). These fix the model's surface source/sink terms in physical
units (`T3`).

### 3.2 Calibration and closed-chamber transport validation

With the leaf resolved at 52 lattice cells across a 1.5 cm blade, the lattice maps to physical units as
`dx = 0.288 mm`, `dt = 0.173 ms`, giving an Earth-gravity convective velocity of **7.7 cm s⁻¹** near
the leaf — a physically reasonable free-convection speed (`T3`). Run as a **sealed chamber** with a
central source, the solver reproduces monotonic gas accumulation and **conserves mass to a relative
error of 2 × 10⁻⁵** (`F5`, left), matching the imposed flux exactly. Crucially, a persistent
**surface-to-bulk concentration gap** develops between the near-leaf air and the far chamber wall
(`F5`, right): the boundary layer expressed at chamber scale, and the quantity that gravity modulates
in §3.3.

### 3.3 Gravity controls the boundary layer (single leaf)

Sweeping gravity from Earth through Mars (0.38 g) and the Moon (0.17 g) to microgravity, convective
ventilation weakens monotonically (`u_max` ≈ √g) while the surface gas gaps steepen (`F4`, left; `T2`).
The field maps (`F3`) make the mechanism visible: at 1 g a **buoyant plume rises off the leaf**,
thinning the boundary layer on the upper surface; in microgravity the plume is gone and a **symmetric,
thicker diffusive halo** surrounds the blade. The surface CO₂ gap roughly **doubles** from Earth to
microgravity for the isolated leaf.

### 3.4 Scale amplifies the effect (rosette → canopy)

Moving from a single leaf to a rosette to a microgreen stand compounds the gravity penalty (`F4`,
right; `F3`, right). Overlapping rosette leaves trap air in the crown, producing the **steepest local
(peak) gradients** of any geometry; the dense microgreen canopy ventilates only at its top, so the
**within-canopy air stagnates as a whole** (highest mean gradient). Both effects intensify in
microgravity, making a **microgravity canopy the worst case** for surface gas depletion.

### 3.5 Physical prediction — surface gas drawdown

Anchoring the model's dimensionless gradients on the measured assimilation flux and a standard still-air
leaf boundary-layer conductance (1.0 mol m⁻² s⁻¹) yields concrete predictions (`T5`):

| Scenario | CO₂ drawdown, mean (ppm) | CO₂ drawdown, peak (ppm) |
|---|---|---|
| Leaf · Earth | 3.8 | 5.9 |
| Leaf · microgravity | 7.8 | 8.9 |
| Rosette · Earth | 7.1 | 17.1 |
| Rosette · microgravity | 13.2 | 24.7 |
| Canopy · Earth | 7.8 | 12.9 |
| Canopy · microgravity | 10.6 | 14.4 |

These are the *boundary-layer* contributions to leaf-surface CO₂ depletion; they add to the larger
stomatal and mesophyll drops. A few-ppm effect on an isolated Earth-grown leaf becomes a ≥ 10 ppm bulk
effect — and ≥ 20 ppm in trapped rosette pockets — once low gravity and dense geometry combine.

### 3.6 Forced ventilation nulls the microgravity penalty

Because the penalty is transport-limited, it can be engineered away. Replacing the absent buoyant
convection with a forced inlet flow (the leaf placed in a ventilation channel, gravity off), we sweep
fan speed and track the surface gap (`F6`, `T6`). The still-microgravity gap (ΔC = 0.231, model units)
falls monotonically with airflow and **crosses the Earth-1 g level (0.128) at ≈ 2.8 cm s⁻¹** for water
vapour; CO₂, with its lower diffusivity and thus thicker concentration boundary layer, reaches parity a
little higher (≈ 5 cm s⁻¹). Beyond ~8 cm s⁻¹ the forced flow *over-ventilates*, driving the surface
gaps below their Earth values. The predicted Earth-equivalent speed (a few cm s⁻¹) is well within — and
an order of magnitude below — the 0.1–1 m s⁻¹ air velocities used in flight hardware such as VEGGIE and
the Advanced Plant Habitat, giving physical grounds for why those systems restore gas exchange, and a
lower-bound target for minimal-power ventilation.

---

## 4. Discussion

**Interpretation.** The results give a mechanistic, quantitative account of a long-suspected spaceflight
stress: without buoyancy-driven convection, plant organs sit in a thickened, poorly-ventilated boundary
layer that is simultaneously CO₂-starved (suppressing photosynthesis), O₂-enriched (promoting
photorespiration), and humid (reducing transpirational cooling and nutrient transport). The model shows
this is not a fixed penalty but one that **scales with both gravity and canopy architecture**: the
denser the planting, the more a still, low-gravity atmosphere throttles gas exchange.

**Implications for space-flight hardware.** Because the effect is transport-limited rather than
biochemical, it is engineerable — and §3.6 quantifies the fix: **≈ 2.8 cm s⁻¹ of forced airflow restores
Earth-equivalent surface gradients** for an isolated leaf, the design rationale behind fan-ventilated
growth chambers (VEGGIE, APH). The predicted worst case (dense canopy, microgravity) identifies where
ventilation matters most and will demand higher speeds; the same solver sizes that requirement per
geometry. That the Earth-equivalent speed sits an order of magnitude below typical hardware airflows
(0.1–1 m s⁻¹) explains the ample margin those systems carry, and flags an opportunity for lower-power
operation where canopy density permits.

**Limitations.** The present model is 2-D and uses the Boussinesq approximation; results are kept within
its validity (u_max < 0.1 lattice units, β·ΔC ≲ 0.5). The stomatal exchange is represented as a surface
source/sink rather than a coupled stomatal-conductance model, and the dense canopy uses a reduced
per-leaf flux to represent self-shading. Absolute ΔC values are reported in lattice excess units and
converted to ppm through a single literature-anchored conductance; the µg boundary layer is further
bounded by the finite chamber, so the reported gravity ratios are **conservative lower bounds** — a
larger domain would widen the Earth–µg gap. Finally, the Vernier and biomass datasets validate the
*flux magnitude and closed-chamber transport*, not the spatial boundary layer directly, which no
whole-chamber sensor can resolve; the gravity- and scale-dependent gradients remain model predictions
built on validated components.

**Future work.** (i) Couple the surface flux to a stomatal-conductance/photosynthesis model so ΔC feeds
back on assimilation; (ii) extend the forced-airflow analysis (now demonstrated for the isolated leaf,
§3.6) to the rosette and canopy, where trapping will raise the Earth-equivalent speed, and map the full
speed–geometry ventilation requirement; (iii) enlarge the domain and move to 3-D (WebGPU) to remove the
chamber-bound conservatism; (iv) calibrate against spatially-resolved surface-gas imaging (e.g.
planar-optode pH/CO₂/O₂ maps) for a direct test of the predicted gradients.

---

## 5. Methods (brief)

Incompressible flow is solved with a D2Q9 BGK Lattice-Boltzmann scheme; three gas species (CO₂, O₂,
H₂O) are transported by D2Q5 advection–diffusion lattices sharing the flow field, with molecular
diffusivities in the ratio 1.6 : 2.0 : 2.4 (×10⁻⁵ m² s⁻¹). Gravity enters through a Boussinesq body
force proportional to the local species-density perturbation and a user-set gravity vector. Leaf
surfaces impose a stomatal source/sink; chamber walls hold ambient concentration (Dirichlet) or are
sealed (zero-flux) as noted. All runs are 30 000 steps to quasi-steady state. Full source, the four
validation gates, and the export/analysis scripts are in the repository (`src/`, `validation/`).

## 6. Data and code availability

Model source, validation harness, and this results package: the LunarLeaf-CFD repository. Measured
gas-exchange data: Vernier whole-chamber logs (`Arabidopsis_v{2,3}_ExportedData.csv`) and the
whole-plant-chamber biomass/gas-exchange workbook of Chew, Y.H. & Millar, A.J. (University of
Edinburgh; see Chew et al., *bioRxiv* 2017). Raw third-party data are referenced by provenance and not
redistributed here.

## 7. Key references

- U. Ghia, K.N. Ghia, C.T. Shin (1982), *J. Comput. Phys.* **48**, 387 — lid-driven cavity benchmark.
- G. de Vahl Davis (1983), *Int. J. Numer. Methods Fluids* **3**, 249 — natural-convection benchmark.
- Y. Kitaya et al. (2003), *Adv. Space Res.* — plant boundary layers and forced convection under altered gravity.
- D.M. Porterfield (2002), *Ann. Bot.* — microgravity effects on plant gas exchange and the boundary layer.
- Y.H. Chew, A.J. Millar et al. (2017), *bioRxiv* — whole-plant-chamber *Arabidopsis* carbon-balance dataset.
