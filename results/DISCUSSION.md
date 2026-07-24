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
4. the microgravity penalty is **fully reversible by forced ventilation**, but the required airflow **scales
   steeply with planting density** — **≈ 2.6 / 11 / 21 cm s⁻¹** to restore Earth-equivalent surface gradients
   for a **leaf / rosette / canopy** (`T6`, `F6`, `F8`) — so a single fan speed cannot serve all densities;
5. the three ISS plant-growth systems map onto three dish boundary conditions (`§3.7`, `F7`, `T8`):
   **BRIC** (sealed) suffers both runaway enclosure drift — CO₂ fixed in **~7 min** in light, O₂ hypoxia
   in **~6.5 days** in the dark — and the steepest surface gradient; **CARA** (micropore tape) vents the
   enclosure to near-ambient but leaves the microgravity surface boundary layer intact; **VEGGIE** (forced
   airflow) fixes both;
6. with photosynthesis **CO₂-limited (closed loop)** (`§3.9`, `F10`), the boundary-layer depletion
   self-suppresses assimilation by 1–4 % spatially (most in the trapped rosette crown), and over a 12 h
   photoperiod a **sealed BRIC dish fixes only ≈ 1 % of the Earth carbon** (photosynthesis collapses in
   minutes) versus **≈ 90 % taped (CARA)** and **≈ 100 % ventilated (VEGGIE)** — the bridge from transport
   physics to carbon gain.

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

### 3.7 Spaceflight hardware as boundary conditions: BRIC vs CARA vs VEGGIE

The three plant-growth systems most used on the ISS differ, in gas-transport terms, only in the
**boundary condition they impose on the Petri dish** — which the solver represents directly (`F7`, `T7`,
`T8`). We model each as an *Arabidopsis* leaf in a 60 mm dish in microgravity.

**BRIC — hermetically sealed** (zero-flux walls). With no exchange, the enclosure atmosphere drifts
without bound (`F7`, left): in the light the leaf consumes CO₂, in the dark it releases CO₂ and consumes
O₂. A simple mass balance on the small dish reservoir (`T8`) shows how fast this bites: the ~400 ppm of
CO₂ in a 30 cm³ headspace is fixed by photosynthesis in **≈ 7 minutes**, so a lit sealed dish is
CO₂-starved almost immediately; in the dark, CO₂ climbs to a stressful 1 % in **≈ 9 hours** and O₂ falls
to a hypoxic 5 % in **≈ 6.5 days**. On top of this runaway bulk drift, the sealed dish also gives the
**steepest leaf-surface gradient** of any hardware (`F7`, right) — the boundary layer and the enclosure
both work against the plant. This reproduces the well-documented BRIC hypoxia/CO₂-accumulation problem
from first principles.

**CARA — micropore surgical tape** (semi-permeable membrane walls). The gas-permeable tape vents the dish
to the effectively-infinite cabin reservoir, so the **dish-mean stays bounded a few ppm from ambient**
(`F7`, left, the levelling blue curve) — consistent with ground measurements showing surgical tape keeps
plated seedlings at near-ambient CO₂/O₂ while parafilm and plastic wrap deplete CO₂ and trigger thousands
of stress genes. Critically, though, **the tape does not fix the microgravity boundary layer**: with no
convection inside the dish, the leaf-surface gradient is essentially that of an open dish (`F7`, right,
CARA ≈ open). CARA therefore solves the *enclosure-atmosphere* problem but leaves the *surface-diffusion*
problem intact.

**VEGGIE — light + forced airflow** (active ventilation). Circulating air both vents the enclosure and
thins the leaf boundary layer, cutting the surface gas gradient **≈ 3×** relative to BRIC/CARA and
restoring near-Earth values (`F7`, right; the §3.6 mechanism). This is precisely why active air
circulation, not just a permeable seal, is the design choice for a plant-*growth* (rather than
short-duration fixation) system.

The progression BRIC → CARA → VEGGIE is thus a ladder of increasing gas-exchange control: sealed (both
problems) → vented seal (enclosure fixed, surface not) → actively ventilated (both fixed). The model
makes each rung quantitative.

### 3.8 Ventilation and enclosure requirements scale with planting density

Extending the fan sweep (§3.6) and the hardware comparison (§3.7) to all three plant scales exposes a
result with direct hardware consequences (`F8`, `F9`, `T9`, `T10`): **the ventilation needed to null the
microgravity penalty rises steeply with planting density.** The Earth-equivalent airflow is
**≈ 2.6 cm s⁻¹ for an isolated leaf, ≈ 11 cm s⁻¹ for a rosette, and ≈ 21 cm s⁻¹ for a microgreen canopy**
(`F8`) — an ~8× increase. The canopy is the hardest to ventilate: side airflow skims the top of the stand
while the within-canopy air stays comparatively stagnant, so its ΔC-vs-speed curve flattens and only
approaches the Earth level near the solver's low-Mach limit (higher speeds went numerically unstable — a
hint that a real dense canopy needs vigorous, likely turbulent, through-canopy flow, not laminar over-flow).

The hardware comparison inherits this scale dependence (`F9`, `T10`). Across all three scales, **BRIC and
CARA give nearly the same steep leaf-surface gradient** — the tape vents the *enclosure* but not the *µg
surface layer* — while **a single VEGGIE fan speed (~8 cm s⁻¹) that restores a leaf (ΔC 0.10) barely helps
a rosette (0.32) or canopy (0.31)**, because 8 cm s⁻¹ is well below their 11 and 21 cm s⁻¹ requirements.
The enclosure-drift side worsens too: the sealed (BRIC) rosette depletes its dish CO₂ ~2.5× faster than a
single leaf, and even the taped (CARA) rosette carries a larger residual dish offset (`T10`,
`dishmean_CO2`). **Denser plantings therefore demand disproportionately more gas-exchange engineering** —
a fixed ventilation setting tuned on sparse plants will under-serve a canopy, and a permeable seal that
keeps a single plate near-ambient will not, on its own, relieve the surface boundary layer of a dense
stand in microgravity.

### 3.9 Closing the loop: CO₂-limited photosynthesis

The results above impose a fixed assimilation flux. But photosynthesis is CO₂-limited, so the very
depletion the boundary layer creates should feed back and suppress the flux. We close this loop two ways.

**Spatially (in the solver).** Making the leaf's CO₂ uptake follow a compensation-point + saturation
response of the *local* surface CO₂ (`T12`), the boundary-layer depletion self-limits assimilation by
**≈ 1–4 %** at steady state — and, tellingly, the suppression tracks the transport story: it is smallest
under ventilation (VEGGIE, net A = 99.3 % of potential), larger for a bare µg leaf (98.0 %), and largest
in the **trapped rosette crown (96.5 %)**, where the air is most stagnant. The model now *computes* net
assimilation rather than assuming it, and the gravity/scale ordering carries through to a growth-relevant
quantity.

**Over a photoperiod (0-D enclosure model).** Coupling the same CO₂ response to the enclosure mass balance
and the µg boundary-layer conductance (`F10`, `T11`) exposes the consequence that matters for a mission.
In a **sealed BRIC dish the feedback is catastrophic**: as the small CO₂ reservoir is fixed, the leaf-
surface concentration falls to the compensation point within minutes, photosynthesis **collapses to
essentially zero, and only ≈ 1 % of the Earth carbon is fixed over a 12 h photoperiod.** The **micropore-
taped CARA dish sustains ≈ 90 %** — the tape resupplies CO₂, though the µg boundary layer still shaves a
few percent — and the **ventilated VEGGIE system ≈ 100 %.** The transport limitations quantified in §3.3–
§3.8 are therefore not merely gradients: they throttle carbon gain, mildly where air moves and almost
completely where it is sealed and still.

This is the mechanistic bridge from the physics to the phenotype: a plant in a sealed, microgravity
enclosure is not only stressed at its surface — it is starved of the carbon substrate it needs to grow.

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
its validity (u_max < 0.1 lattice units, β·ΔC ≲ 0.5). Photosynthesis is now CO₂-limited (§3.9) through a
rectangular-hyperbola response, but stomatal *conductance* is not yet dynamic (transpiration is held
CO₂-independent) and the CO₂-response and tape-permeance parameters are reasonable assumptions rather than
fits; the dense canopy uses a reduced per-leaf flux to represent self-shading. Absolute ΔC values are reported in lattice excess units and
converted to ppm through a single literature-anchored conductance; the µg boundary layer is further
bounded by the finite chamber, so the reported gravity ratios are **conservative lower bounds** — a
larger domain would widen the Earth–µg gap. Finally, the Vernier and biomass datasets validate the
*flux magnitude and closed-chamber transport*, not the spatial boundary layer directly, which no
whole-chamber sensor can resolve; the gravity- and scale-dependent gradients remain model predictions
built on validated components.

**Future work.** (i) Make stomatal conductance dynamic (CO₂- and humidity-responsive) so transpiration and
assimilation co-vary, building on the CO₂-limited photosynthesis now in place (§3.9); (ii) enlarge the
domain and move to 3-D (WebGPU) to remove the chamber-bound conservatism and let a dense canopy develop the
turbulent through-flow its ventilation really needs; (iii) calibrate against spatially-resolved surface-gas
imaging (e.g. planar-optode pH/CO₂/O₂ maps) for a direct test of the predicted gradients; (iv) couple to a
whole-plant carbon-balance model to translate the per-photoperiod carbon deficits (§3.9) into growth-rate
predictions across mission durations.

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

1. Kitaya, Y. *et al.* Effects of air current speed on gas exchange in plant leaves and plant canopies. *Adv. Space Res.* **31**, 177–182 (2003). doi:10.1016/S0273-1177(02)00747-0. — air movement, boundary-layer resistance and its loss under microgravity.
2. Porterfield, D. M. The biophysical limitations in physiological transport and exchange in plants grown in microgravity. *J. Plant Growth Regul.* **21**, 177–190 (2002). doi:10.1007/s003440010054.
3. Ghia, U., Ghia, K. N. & Shin, C. T. High-Re solutions for incompressible flow using the Navier–Stokes equations and a multigrid method. *J. Comput. Phys.* **48**, 387–411 (1982). doi:10.1016/0021-9991(82)90058-4. — lid-driven cavity benchmark.
4. de Vahl Davis, G. Natural convection of air in a square cavity: a bench mark numerical solution. *Int. J. Numer. Methods Fluids* **3**, 249–264 (1983). doi:10.1002/fld.1650030305. — natural-convection benchmark.
5. Chew, Y. H. *et al.* (incl. Millar, A. J.). Linking circadian time to growth rate quantitatively via carbon metabolism. *bioRxiv* 105437 (2017). doi:10.1101/105437. — the whole-plant-chamber gas-exchange dataset used here.
6. Correll, M. J. *et al.* Transcriptome analyses of *Arabidopsis thaliana* seedlings grown in space: implications for gravity-responsive genes (BRIC hardware). *Planta* **238**, 519–533 (2013). doi:10.1007/s00425-013-1909-x.
7. Zhou, M., Ferl, R. J. & Paul, A.-L. Light has a principal role in the *Arabidopsis* transcriptomic response to the spaceflight environment (CARA). *npj Microgravity* **10**, 82 (2024). doi:10.1038/s41526-024-00417-0.
8. Ma, Y. *et al.* Beware of sealing film of Petri dishes!—alters the expression of a large number of genes. *Int. J. Mol. Sci.* **26**, 5484 (2025). doi:10.3390/ijms26125484. — surgical tape holds near-ambient CO₂/O₂; parafilm/PE deplete CO₂.
9. Xu, L. *et al.* Plants grown in parafilm-wrapped Petri dishes are stressed and possess altered gene-expression profiles. *Front. Plant Sci.* **10**, 637 (2019). doi:10.3389/fpls.2019.00637.
10. Monje, O., Stutte, G. W. & Chapman, D. K. Microgravity does not alter plant stand gas exchange of wheat at moderate light levels and saturating CO₂ concentration. *Planta* **222**, 336–345 (2005). doi:10.1007/s00425-005-1529-1.
