# From microgravity boundary-layer biophysics to the spaceflight multi-ome: a coupled lattice-Boltzmann and Farquhar–von Caemmerer–Berry model of *Arabidopsis* gas exchange and enclosure carbon starvation

**Author:** Richard J. Barker$^{1,*}$ (ORCID: [0000-0001-5681-9857](https://orcid.org/0000-0001-5681-9857))  
**Affiliation:** $^1$Department of Agricultural Engineering, Purdue University, West Lafayette, IN, USA  
**Correspondence:** `barkerrj@purdue.edu`  
**Target Special Issue:** *Progress in Biophysics and Molecular Biology* — Special Issue: *Biophysics and Molecular Biology for Space Flight* ([SI 337891](https://www.sciencedirect.com/special-issue/337891/biophysics-and-molecular-biology-for-space-flight))

---

## Abstract

Plants grown in spaceflight display conserved transcriptional and proteomic stress signatures whose physical origin remains debated. Two distinct gas-transport mechanisms have been proposed: the microgravity loss of buoyancy-driven free convection, which thickens the unstirred diffusive boundary layer around leaves, and atmospheric stagnation inside sealed or poorly ventilated spaceflight growth hardware. Because no flight experiment has resolved sub-millimetre leaf boundary layers or logged in-canister $\mathrm{CO_2}$ across hardware classes, we built an end-to-end biophysical and multi-omics framework to test both mechanisms quantitatively.

First, we implemented a two-dimensional D2Q9/D2Q5 lattice-Boltzmann computational fluid dynamics (CFD) solver for incompressible flow, multi-species ($\mathrm{CO_2}$, $\mathrm{O_2}$, $\mathrm{H_2O}$) advection–diffusion, and solutal Boussinesq buoyancy under an adjustable gravity vector ($1\,g \to \text{Mars } 0.38\,g \to \text{Moon } 0.17\,g \to \mu g$), validated against four numerical benchmarks (lid-driven cavity, Kármán cylinder wake, natural-convection cavity to $0.18\%$ on Nusselt number, and analytic $\mathrm{erfc}$ diffusion) and anchored to empirical *Arabidopsis thaliana* whole-chamber gas exchange ($A = 3.85\,\mu\mathrm{mol\,m^{-2}\,s^{-1}}$). Removing gravity eliminates convective plumes ($u_{\max}\propto\sqrt{g}\to 0$), reducing leaf boundary-layer conductance $g_{bl}$ from $0.997$ to $0.443\,\mathrm{mol\,m^{-2}\,s^{-1}}$ for an isolated leaf, $0.540$ to $0.272\,\mathrm{mol\,m^{-2}\,s^{-1}}$ for a rosette, and $0.133$ to $0.058\,\mathrm{mol\,m^{-2}\,s^{-1}}$ for a dense microgreen canopy. Forced ventilation reverses this microgravity penalty, but the Earth-equivalent airflow scales with planting density from $\approx 2.0\,\mathrm{cm\,s^{-1}}$ (leaf) to $\approx 6.1\,\mathrm{cm\,s^{-1}}$ (rosette).

Second, we coupled the CFD-derived $g_{bl}$ values and zero-dimensional (0-D) hardware mass balances for three International Space Station growth systems—sealed Biological Research in Canisters (BRIC), micropore-taped Characterizing Arabidopsis Root Attractions (CARA), and actively ventilated Vegetable Production System (VEGGIE)—to a Farquhar–von Caemmerer–Berry (FvCB) $\mathrm{C_3}$ model with explicit Rubisco oxygenation ($\varphi = V_o/(V_o+V_c)$). An illuminated sealed BRIC canister draws its headspace $\mathrm{CO_2}$ down to the compensation point within $\sim 7\,\mathrm{min}$, collapsing 12 h carbon gain to $\approx 1\%$ of an unenclosed control (versus $\approx 90\%$ for CARA and $\approx 100\%$ for VEGGIE) and raising $\varphi$ from $18.0\%$ to $46.2\%$ at experimental irradiance ($60\,\mu\mathrm{mol\,m^{-2}\,s^{-1}}$). Because canister drawdown is a mass balance, it occurs symmetrically in both flight and ground controls: it cancels out of the published flight-versus-ground contrast while shifting the baseline metabolic state into severe carbon starvation (an enclosure effect $\approx 22\times$ larger than the microgravity boundary-layer effect). Furthermore, contrary to our starting hypothesis, $\mathrm{CO_2}$ exhaustion causes the $1\,g$ and $\mu g$ boundary layers to converge rather than diverge as photosynthetic flux vanishes, leaving a residual microgravity assimilation deficit of $<3\%$ at leaf/rosette scale and up to $11\%$ in a dense canopy at $60\,\mu\mathrm{mol\,m^{-2}\,s^{-1}}$ ($5\text{–}9\%$ and $26\text{–}29\%$ at saturating light).

Third, after an exhaustive census of all 567 studies in the NASA Open Science Data Repository (OSDR) revealed zero plant metabolomics datasets (0 of 12 metabolomics studies), we formulated a falsifiable 21-compound flux-propagated metabolite scaffold and tested the coupled model against OSD-522 (BRIC-LED) shoot transcriptomics and proteomics and across six matched flight-versus-ground contrasts from five OSDR studies. In OSD-522, the model called eight of nine transcriptome gene-set responses and four of seven in the proteome (repression of photosystems, Rubisco, carbon fixation, and starch/sucrose metabolism; induction of *DIN6/ASN1* carbon-starvation markers; maintenance of photorespiratory enzymes above Rubisco). Multi-omics pathway integration in PaintOmics 4 showed that endoplasmic reticulum protein processing (unfolded protein response, $p = 8.6\times 10^{-9}$) dominates the global response while photorespiration ranks in the bottom $8\%$ (214th of 232 pathways). Across the six OSDR contrasts, illumination separated every lit study from every dark study on carbon starvation over photosynthesis ($p = 0.05$), whereas enclosure class alone did not. We conclude that unlogged enclosure atmosphere is a first-order covariate in spaceflight plant biology and outline the in-canister sensor logging, 20-compound targeted metabolomics panel, and three-arm / $2\times 2$ factorial experimental designs required to separate hardware carbon starvation from microgravity.

**Keywords:** microgravity; boundary layer; computational fluid dynamics; lattice-Boltzmann; Farquhar–von Caemmerer–Berry; photorespiration; *Arabidopsis thaliana*; spaceflight growth hardware; multi-omics; NASA OSDR

---

## 1. Introduction

On Earth, a photosynthesising or transpiring leaf warms and humidifies the thin layer of air in contact with its epidermis. Because water vapour ($M = 18\,\mathrm{g\,mol^{-1}}$) is lighter than dry air ($M \approx 29\,\mathrm{g\,mol^{-1}}$), the humidified boundary layer is buoyant and rises in a free-convection plume that continuously sweeps the leaf surface, replenishing $\mathrm{CO_2}$ while removing $\mathrm{O_2}$ and water vapour. This buoyancy-driven ventilation sets the still-air boundary-layer conductance ($g_{bl}$) that acts in series with stomatal ($g_s$) and mesophyll ($g_m$) conductances to govern the chloroplastic $\mathrm{CO_2}$ mole fraction ($C_c$) reaching Rubisco:

$$C_a \xrightarrow{\;g_{bl}\;} C_s \xrightarrow{\;g_s\;} C_i \xrightarrow{\;g_m\;} C_c$$

where $C_a$, $C_s$, and $C_i$ denote the bulk enclosure, leaf-surface, and intercellular $\mathrm{CO_2}$ mole fractions, respectively.

In microgravity ($\mu g$), hydrostatic pressure gradients and buoyancy-driven natural convection vanish. In the absence of forced ventilation, gas transport outside the organ collapses to pure molecular diffusion, thickening the unstirred boundary layer ($\delta$) and steepening the surface-to-bulk concentration gaps ($\Delta C$) of $\mathrm{CO_2}$, $\mathrm{O_2}$, and $\mathrm{H_2O}$ (Porterfield, 2002; Kitaya et al., 2003). At the biochemical level, Rubisco partitions between carboxylation ($V_c$) and oxygenation ($V_o$) in direct proportion to the ratio of $\mathrm{O_2}$ to $\mathrm{CO_2}$ at the catalytic site (Farquhar et al., 1980):

$$\frac{V_o}{V_c} = \frac{2\Gamma^*}{C_c}, \qquad \varphi = \frac{V_o}{V_o + V_c} = \frac{2\Gamma^*}{C_c + 2\Gamma^*}$$

where $\Gamma^*$ is the photorespiratory $\mathrm{CO_2}$ compensation point in the absence of day respiration ($R_d$). Any transport limitation that depresses $C_c$ or elevates local $\mathrm{O_2}$ shifts Rubisco toward oxygenation, accelerating photorespiration ($R_p = 0.5\,V_o$) at the expense of net carbon assimilation ($A = V_c - 0.5\,V_o - R_d$).

Interpreting molecular data from spaceflight experiments, however, requires confronting a second, larger transport barrier: the growth enclosure itself. Plants flown on the International Space Station (ISS) have been cultivated across three distinct hardware classes that differ by orders of magnitude in gas exchange with the spacecraft cabin:

1. **Hermetically sealed canisters**, exemplified by Biological Research in Canisters (BRIC) and BRIC-LED Petri Dish Fixation Units (Correll et al., 2013; OSD-522);
2. **Passively vented Petri dishes**, exemplified by Characterizing Arabidopsis Root Attractions (CARA), where $120\,\mathrm{mm}$ square plates are sealed with gas-permeable 3M Micropore surgical tape and mounted against the cabin wall (Paul et al., 2017; OSD-678); and
3. **Actively ventilated growth chambers**, exemplified by the Vegetable Production System (VEGGIE) and Advanced Plant Habitat (APH), which circulate cabin air across the stand with fans (OSD-427).

Ground studies have demonstrated that sealing Petri dishes with impermeable films (Parafilm or polyethylene wrap) rapidly depletes headspace $\mathrm{CO_2}$ in the light and induces thousands of stress-response genes compared with gas-permeable surgical tape (Xu et al., 2019;ack2021). Similarly, a meta-analysis of 15 *Arabidopsis* spaceflight transcriptomes identified growth hardware and illumination as the largest confounding variables across the archive (Barker et al., 2023). Yet no BRIC-class spaceflight experiment has logged the internal $\mathrm{CO_2}$ and $\mathrm{O_2}$ concentrations experienced by its plants, and no whole-chamber sensor resolves the sub-millimetre leaf boundary layer.

Here we bridge fluid mechanics, photosynthetic biochemistry, and spaceflight multi-omics in a single reproducible framework. We construct and validate an in-browser 2-D lattice-Boltzmann CFD solver (`LunarLeaf-CFD`), pass its steady-state boundary-layer conductances ($g_{bl}$) and 0-D enclosure mass balances into an FvCB $\mathrm{C_3}$ carboxylation/oxygenation model, propagate the resulting metabolic fluxes into a falsifiable 21-compound metabolite scaffold, and test the model's predictions against NASA OSDR transcriptomics and proteomics from OSD-522 (BRIC-LED) and across six matched flight-versus-ground contrasts spanning five spaceflight experiments.

---

## 2. Results

### 2.1. Numerical verification and empirical gas-exchange anchoring of the lattice-Boltzmann solver

Before modelling biological geometries, the two-dimensional incompressible-flow (D2Q9 BGK) and three-species advection–diffusion (D2Q5) lattice-Boltzmann solver (`src/solver/lbm/`) was verified against four numerical benchmarks (`validation/gates.ts`, **Table 1A**):
1. **Gate 1 — Lid-driven square cavity ($\mathrm{Re}=100$)**: steady centreline velocity profiles matched Ghia et al. (1982) to relative $L_2 = 0.0105$ (gate $<0.05$; MRT $L_2 = 0.0115$).
2. **Gate 2 — Cylinder wake ($\mathrm{Re}=100$, blockage $D/H=0.17$)**: Kármán vortex-shedding Strouhal number over 16 cycles was $\mathrm{St} = 0.192$ (MRT $\mathrm{St} = 0.200$), matching the confined-channel reference ($\mathrm{St}\approx 0.19\text{–}0.20$).
3. **Gate 3 — Natural convection in a differentially heated cavity ($\mathrm{Ra}=10^4$, $\mathrm{Pr}=0.71$)**: hot-wall Nusselt number converged to $\mathrm{Nu} = 2.242$ against de Vahl Davis (1983) $\mathrm{Nu} = 2.238$, an error of **$0.18\%$** (MRT $\mathrm{Nu} = 2.248$).
4. **Gate 4 — Pure 1-D scalar diffusion**: step-change diffusion reproduced $\tfrac{1}{2}\mathrm{erfc}(x/\sqrt{4Dt})$ to $L_2 < 10^{-4}$.

**Table 1. Lattice-Boltzmann solver verification gates and empirical *Arabidopsis* gas-exchange calibration.**

| Gate / Parameter | Benchmark / Physical Quantity | Reference / Value | LBM / Units | Status / Source |
| :--- | :--- | :--- | :--- | :--- |
| **Gate 1** | Lid-driven cavity ($\mathrm{Re}=100$) | Ghia et al. (1982) ($L_2 < 0.05$) | $L_2 = 0.0105$ (BGK) / $0.0115$ (MRT) | Pass |
| **Gate 2** | Cylinder wake ($\mathrm{Re}=100$, confined) | $\mathrm{St}\approx 0.19\text{–}0.20$ | $\mathrm{St} = 0.192$ (BGK) / $0.200$ (MRT) | Pass |
| **Gate 3** | Natural convection ($\mathrm{Ra}=10^4, \mathrm{Pr}=0.71$) | de Vahl Davis (1983) $\mathrm{Nu}=2.238$ | $\mathrm{Nu} = 2.242$ ($0.18\%$) / $2.248$ | Pass |
| **Gate 4** | Pure 1-D diffusion | Analytic $\tfrac{1}{2}\mathrm{erfc}(x/\sqrt{4Dt})$ | $L_2 < 10^{-4}$ | Pass |
| $A_{\text{net}}$ | Net $\mathrm{CO_2}$ assimilation (Col-0 WT) | $3.85$ ($1.38$) | $\mu\mathrm{mol\,m^{-2}\,s^{-1}}$ ($\mu\mathrm{mol\,h^{-1}\,cm^{-2}}$) | Chew et al. (2022) (`T1`) |
| $R_d$ | Dark respiration ($R/A = 0.31$) | $1.18$ ($0.43$) | $\mu\mathrm{mol\,m^{-2}\,s^{-1}}$ ($\mu\mathrm{mol\,h^{-1}\,cm^{-2}}$) | Chew et al. (2022) (`T1`) |
| $\Delta\mathrm{O_2}$ | Closed-chamber diel $\mathrm{O_2}$ range | $6.6\text{–}32.8$ | $\%$ over $4.8\,\mathrm{d}$ | Vernier chamber trace (`F1`) |
| $L_{\text{leaf}}, \Delta x, \Delta t$ | Leaf chord ($52$ cells), grid, step | $1.50\,\mathrm{cm}$, $0.288\,\mathrm{mm}$, $0.173\,\mathrm{ms}$ | Matched to $D_{\mathrm{H_2O}} = 2.4\times 10^{-5}\,\mathrm{m^2\,s^{-1}}$ | `T3_calibration.csv` |

Whole-plant chamber measurements from the *Arabidopsis* Framework Model v2 dataset (Chew et al., 2022) establish $A = 3.85\,\mu\mathrm{mol\,m^{-2}\,s^{-1}}$ and $R_d = 1.18\,\mu\mathrm{mol\,m^{-2}\,s^{-1}}$ ($R/A = 0.31$), complemented by a $4.8\,\mathrm{d}$ closed-chamber Vernier sensor trace (**Figure 1**, `F1_vernier_timeseries.png` and `F5_chamber_validation.png`). When operated as a sealed chamber, the solver conserved total species mass to $2\times 10^{-5}$ while reproducing the persistent concentration gap between the leaf surface and far chamber wall.

### 2.2. Gravity and plant architecture control the diffusive boundary layer

Steady-state gas transport (150,000 steps $\approx 26\,\mathrm{s}$, or 900,000 steps $\approx 156\,\mathrm{s}$ for the $\mu g$ canopy; $0.00\%$ drift over the final $5\,\mathrm{s}$ in all scenarios; `T15_stationarity.csv`) was evaluated across four gravity levels ($1\,g$, Mars $0.38\,g$, Moon $0.17\,g$, and $\mu g$) and three plant scales: isolated leaf, overlapping rosette, and dense microgreen canopy (**Figures 2–3**, `F3_plume_maps.png`, `F4_gravity_scale.png`, **Table 2**).

**Table 2. Steady-state lattice-Boltzmann boundary-layer diagnostics, physical surface $\mathrm{CO_2}$/$\mathrm{O_2}$ perturbations, and closed-loop spatial assimilation across gravity and plant scales (`T2`, `T5`, `T12`, `T13`).**

| Scenario | Gravity | $u_{\max}$ (lat.) | $g_{bl}$ ($\mathrm{mol\,m^{-2}\,s^{-1}}$) | $\delta$ ($\mathrm{mm}$) | $\mathrm{Sh}$ | $\Delta\mathrm{CO_2}$ mean / peak ($\mathrm{ppm}$) | $\Delta\mathrm{O_2}$ mean ($\mathrm{ppm}$) | Closed-loop $A$ ($\%$) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Leaf · Earth** | $1.00\,g$ | $4.61\times 10^{-2}$ | $0.997$ | $0.67$ | $22.4$ | $3.8$ / $5.9$ | $2.7$ | $98.9\%$ |
| **Leaf · Mars** | $0.38\,g$ | $2.75\times 10^{-2}$ | $0.841$ | $0.79$ | $18.9$ | $4.6$ / $6.8$ | $3.2$ | — |
| **Leaf · Moon** | $0.17\,g$ | $1.65\times 10^{-2}$ | $0.712$ | $0.93$ | $16.0$ | $5.4$ / $7.8$ | $3.8$ | — |
| **Leaf · $\mu g$** | $0.00\,g$ | $0.00$ | $0.443$ | $1.50$ | $10.0$ | $8.7$ / $9.9$ | $5.5$ | $97.6\%$ |
| **Rosette · Earth** | $1.00\,g$ | $4.60\times 10^{-2}$ | $0.540$ | $1.23$ | $16.4$ | $7.1$ / $17.1$ | $4.8$ | — |
| **Rosette · $\mu g$** | $0.00\,g$ | $0.00$ | $0.272$ | $2.45$ | $8.2$ | $14.2$ / $25.4$ | $8.9$ | $96.1\%$ |
| **Canopy · Earth** | $1.00\,g$ | $7.19\times 10^{-2}$ | $0.133$ | $5.02$ | $1.5$ | $8.7$ / $15.3$ | $5.7$ | — |
| **Canopy · $\mu g$** | $0.00\,g$ | $0.00$ | $0.058$ | $11.42$ | $0.7$ | $19.8$ / $28.4$ | $12.5$ | $94.5\%$ |

Eliminating gravity removes the buoyant plume ($u_{\max}\propto\sqrt{g}\to 0$), thickening the diffusive boundary layer $\delta = D_{\mathrm{CO_2}}/g_{bl}$ from $0.67$ to $1.50\,\mathrm{mm}$ on an isolated leaf ($g_{bl}$ falling $2.25\times$ from $0.997$ to $0.443\,\mathrm{mol\,m^{-2}\,s^{-1}}$), from $1.23$ to $2.45\,\mathrm{mm}$ on a rosette ($g_{bl}: 0.540 \to 0.272\,\mathrm{mol\,m^{-2}\,s^{-1}}$), and from $5.02$ to $11.42\,\mathrm{mm}$ in a microgreen canopy ($g_{bl}: 0.133 \to 0.058\,\mathrm{mol\,m^{-2}\,s^{-1}}$).

### 2.3. Forced ventilation reverses the microgravity penalty in a density-dependent manner

Using a pressure-pinned outlet ($\rho=1$) paired with a density-matched velocity inlet that delivers $99.6\text{–}100.9\%$ of the set flow (`T15b_inlet_flux_matched.csv`), horizontal ventilation in microgravity restores $1\,g$ surface transport at **$\approx 2.0\,\mathrm{cm\,s^{-1}}$** for an isolated leaf (`T6_forced_airflow.csv`), but requires **$\approx 6.1\,\mathrm{cm\,s^{-1}}$** ($3\times$ higher airspeed) for an overlapping rosette (**Figure 4**, `F8_fan_by_scale.png`, `T9_fan_by_scale.csv`), while horizontal skimming flow does not restore the dense microgreen canopy within the solver's low-Mach regime ($\le 3.3\,\mathrm{cm\,s^{-1}}$).

### 2.4. Spaceflight growth hardware as boundary conditions: illuminated sealed canisters are $\mathrm{CO_2}$-starvation chambers

Modelling the three ISS hardware classes across 2-D CFD boundary conditions (`T7`, `T10`) and 0-D dynamic headspace mass balances (`T8`, `T11`, `T15_enclosure_sensitivity.tsv`; **Figure 5**, `fig01_hardware_atmosphere.pdf`) separates the two physical transport scales:
- **Sealed BRIC**: In the light, photosynthetic uptake fixes the $\sim 400\,\mathrm{ppm}$ headspace $\mathrm{CO_2}$ ($30\,\mathrm{mL}$ over $3\,\mathrm{cm^2}$ leaf area) to the compensation point ($\Gamma\approx 50\,\mathrm{ppm}$) within **$\sim 7\,\mathrm{min}$**, reducing $12\,\mathrm{h}$ photoperiod carbon gain to **$1\%$** of an unenclosed Earth control. In the dark, respiratory $\mathrm{CO_2}$ reaches $1\%$ in $\sim 9\,\mathrm{h}$ and $\mathrm{O_2}$ drops to $5\%$ in $\sim 6.5\,\mathrm{d}$.
- **Micropore-taped CARA**: Diffusive venting across the surgical tape ($k_{\text{seal}} = 0.006\,\mathrm{mol\,m^{-2}\,s^{-1}}$) sustains **$\approx 90\%$** of $12\,\mathrm{h}$ Earth carbon gain, but leaves the leaf-surface microgravity boundary layer unventilated and identical to BRIC (`T10_hardware_by_scale.csv`).
- **Ventilated VEGGIE**: Forced airflow pins bulk $\mathrm{CO_2}$ to cabin air and thins the leaf boundary layer $\sim 4\times$, sustaining **$\approx 100\%$** of $12\,\mathrm{h}$ carbon gain.

Because canister $\mathrm{CO_2}$ drawdown is a mass balance, it occurs symmetrically in both flight and $1\,g$ ground canisters: it cancels out of the flight-versus-ground differential contrast while shifting the baseline of both arms into severe carbon starvation.

### 2.5. Coupling CFD transport to Rubisco kinetics: enclosure drawdown dominates and converges the gravity gap

Coupling the steady-state CFD $g_{bl}$ table to the FvCB $\mathrm{C_3}$ model (**Figure 6**, `fig02_fvcb_operating_points.pdf`, **Table 3**) shows that drawing canister $\mathrm{CO_2}$ from $400$ to $100\,\mathrm{ppm}$ raises Rubisco oxygenation $\varphi = V_o/(V_o+V_c)$ from **$18.0\%$ to $46.2\%$** at $Q = 60\,\mu\mathrm{mol\,m^{-2}\,s^{-1}}$ ($27.0\%$ to $53.7\%$ at $Q = 1000\,\mu\mathrm{mol\,m^{-2}\,s^{-1}}$) and cuts net assimilation $A$ from $4.90$ to $0.88\,\mu\mathrm{mol\,m^{-2}\,s^{-1}}$. Contrary to our starting hypothesis, canister $\mathrm{CO_2}$ exhaustion causes the $1\,g$ and $\mu g$ operating points to **converge** rather than diverge as $A\to 0$ ($\Delta C_{bl} = A/g_{bl} \to 0$). Across the 21 modelled metabolite pools, the sealed-versus-ventilated hardware effect is **$22\times$ larger** than the flight-versus-ground microgravity effect.

**Table 3. Modelled CFD–FvCB operating points at experimental ($60\,\mu\mathrm{mol\,m^{-2}\,s^{-1}}$) and saturating ($1000\,\mu\mathrm{mol\,m^{-2}\,s^{-1}}$) irradiance for rosette architecture (`T04`, `T05`, `T13`).**

| Experimental Arm | $Q$ ($\mu\mathrm{mol\,m^{-2}\,s^{-1}}$) | $g_{bl}$ ($\mathrm{mol\,m^{-2}\,s^{-1}}$) | $C_a$ ($\mathrm{ppm}$) | $C_c$ ($\mathrm{ppm}$) | $\varphi$ ($\%$) | $A$ ($\mu\mathrm{mol\,m^{-2}\,s^{-1}}$) | $R_p$ ($\mu\mathrm{mol\,m^{-2}\,s^{-1}}$) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Ventilated control ($\mu g$)** | $60$ | $0.272$ | $400$ | $334.6$ | $18.0\%$ | $4.90$ | $0.68$ |
| **Sealed ground ($1\,g$)** | $60$ | $0.540$ | $100$ | $88.2$ | $45.8\%$ | $0.94$ | $0.97$ |
| **Sealed flight ($\mu g$)** | $60$ | $0.272$ | $100$ | $87.2$ | $46.2\%$ | $0.88$ | $0.94$ |
| **Ventilated Earth ($1\,g$)** | $1000$ | $0.540$ | $400$ | $230.7$ | $27.0\%$ | $16.62$ | $4.09$ |
| **Ventilated flight ($\mu g$)** | $1000$ | $0.272$ | $400$ | $215.0$ | $28.5\%$ | $15.40$ | $4.16$ |
| **Sealed ground ($1\,g$)** | $1000$ | $0.540$ | $100$ | $75.5$ | $53.1\%$ | $2.40$ | $2.12$ |
| **Sealed flight ($\mu g$)** | $1000$ | $0.272$ | $100$ | $73.6$ | $53.7\%$ | $2.20$ | $2.03$ |

### 2.6. The OSDR plant metabolomics gap and a falsifiable 21-compound hypothesis scaffold

Querying all 567 studies in NASA OSDR (`T03_osdr_metabolomics_census.tsv`) revealed 12 metabolomics studies, **0 of 12 in plants**. We therefore formulated a 21-compound flux-propagated metabolite scaffold (`T06_predicted_compounds.tsv`, **Figure 7**, `fig03_predicted_metabolome.pdf`) spanning eight $\mathrm{C_2}$ photorespiratory intermediates (driven by $V_o$), six photosynthetic sugars/3-PGA (driven by $A$), RuBP (driven by $-C_c$), and six amino-acid starvation markers (driven by $-A$). Every value is explicitly labelled as model output, never measured.

### 2.7. Testing against OSD-522 (BRIC-LED): 8 of 9 transcriptome gene-set calls matched while ER UPR dominates globally

Testing against OSD-522 shoot RNA-seq ($1,795$ DEGs at $\mathrm{FDR}<0.05$ out of $19,325$ tested loci; `T01`) and TMT proteomics ($5,160$ proteins; `T02`) confirmed **8 of 9 directional predictions in the transcriptome** and **4 of 7 in the proteome** (**Figure 8**, `fig04_osd522_omics.pdf`, `fig05_blind_test.pdf`, **Table 4**). In set-versus-set contrasts immune to global plastid depression, core photorespiratory enzymes sat significantly above Rubisco in both the transcriptome ($+0.239\,\log_2\mathrm{FC}, p = 6.8\times 10^{-3}$) and proteome ($+0.285\,\log_2\mathrm{FC}, p = 4.9\times 10^{-2}$), and *DIN* starvation markers sat $+0.923\,\log_2\mathrm{FC}$ above the photosynthetic apparatus ($p = 5.3\times 10^{-6}$).

**Table 4. OSD-522 (BRIC-LED) multi-omics falsification scorecard (`T07_falsification_osd522.tsv`).**

| Gene Set / Contrast | Layer | $n$ | Median $\log_2\mathrm{FC}$ | Shift vs. bg | $p$-value | Predicted | Verdict |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Photosynthesis apparatus** | Transcriptome | $31$ | $-0.215$ | $-0.238$ | $3.8\times 10^{-6}$ | Down | Match |
| **Rubisco subunits** | Transcriptome | $5$ | $-0.381$ | $-0.403$ | $4.5\times 10^{-3}$ | Down | Match |
| **Carbon fixation (`ath00710`)** | Transcriptome | $66$ | $-0.082$ | $-0.105$ | $1.3\times 10^{-4}$ | Down | Match |
| **Starch & sucrose (`ath00500`)** | Transcriptome | $142$ | $-0.142$ | $-0.165$ | $3.5\times 10^{-6}$ | Down | Match |
| **Carbon starvation (*DIN*)** | Transcriptome | $5$ | $+0.708$ | $+0.685$ | $2.6\times 10^{-3}$ | Up | Match |
| **Photorespiration core ($\mathrm{C_2}$)** | Transcriptome | $13$ | $-0.142$ | $-0.164$ | $0.092$ | None | Match |
| **Glyoxylate/dicarboxylate (`ath00630`)** | Transcriptome | $76$ | $-0.102$ | $-0.125$ | $3.2\times 10^{-4}$ | None | Mismatch (Down) |
| **Fermentation** | Transcriptome | $6$ | $-0.067$ | $-0.090$ | $0.596$ | None | Match |
| **Hypoxia responsive** | Transcriptome | $3$ | $+0.191$ | $+0.169$ | $0.248$ | None | Match |
| **Photosynthesis apparatus** | Proteome | $19$ | $-0.920$ | $-0.820$ | $5.0\times 10^{-4}$ | Down | Match |
| **Photorespiration core vs. Rubisco** | Transcriptome | $13$ vs. $5$ | $-0.142$ vs. $-0.381$ | $+0.239$ | $6.8\times 10^{-3}$ | A > B | Supports |
| **Photorespiration core vs. Rubisco** | Proteome | $10$ vs. $3$ | $-0.205$ vs. $-0.490$ | $+0.285$ | $4.9\times 10^{-2}$ | A > B | Supports |
| **Starvation (*DIN*) vs. Photosynthesis** | Transcriptome | $5$ vs. $31$ | $+0.708$ vs. $-0.215$ | $+0.923$ | $5.3\times 10^{-6}$ | A > B | Supports |

In PaintOmics 4 across 232 KEGG and MapMan pathways (**Figure 9**, `fig06_paintomics.pdf`, `T08`, `T09`), **protein processing in the endoplasmic reticulum (UPR)** dominated globally ($p = 8.6\times 10^{-9}$, $\mathrm{FDR} = 2.0\times 10^{-6}$), whereas photorespiration (`ath00630`) ranked **214th of 232** ($p = 0.994$, bottom $8\%$).

### 2.8. Cross-study evaluation across five OSDR spaceflight experiments: illumination separates all six flight contrasts

Across all five OSDR studies (six matched flight-versus-ground contrasts) meeting our inclusion criteria (**Table 5**, **Figure 10**, `fig07_hardware_ladder.pdf`, `fig08_implications.pdf`, `T11`, `T12`), illumination separated every lit study ($+0.41$ OSD-427 VEGGIE, $+0.92$ OSD-522 BRIC-LED, $+2.58$ OSD-678 CARA lit) from every dark study ($-0.39$ OSD-38, $-1.95$ OSD-321, $-3.22$ OSD-678 CARA dark; one-sided Mann–Whitney $p = 0.05$) on the starvation-over-photosynthesis axis, whereas enclosure class alone among the three lit studies did not follow a monotonic ranking ($\rho = -0.50, p = 0.67$).

**Table 5. NASA OSDR spaceflight studies evaluated in the cross-study hardware and illumination ladder (`data/study_registry.tsv`).**

| Study | Hardware | Seal Class | Tissue | Genotype | Duration | Light Regime | Status / Reason |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **OSD-522** | BRIC-LED | Sealed | Shoots | Col-0 WT | $11\,\mathrm{d}$ | Lit ($60\,\mu\mathrm{mol\,m^{-2}\,s^{-1}}$) | Included |
| **OSD-38** | BRIC-PDFU | Sealed | Seedlings | Col-0 WT | $8\,\mathrm{d}$ | Dark | Included |
| **OSD-321** | BRIC-PDFU | Sealed | Seedlings | Col-0 WT | $14\,\mathrm{d}$ | Dark | Included |
| **OSD-678 (lit)** | CARA plate | Micropore tape | Leaves | Col-0 WT | $12\,\mathrm{d}$ | Lit ($4\text{–}6\,\mu\mathrm{mol\,m^{-2}\,s^{-1}}$) | Included |
| **OSD-678 (dark)** | CARA plate | Micropore tape | Leaves | Col-0 WT | $12\,\mathrm{d}$ | Dark | Included |
| **OSD-427** | VEGGIE (VPS) | Ventilated | Leaves | Col-0 WT | $21\,\mathrm{d}$ | Lit ($120\,\mu\mathrm{mol\,m^{-2}\,s^{-1}}$) | Included |

---

## 3. Discussion, Limitations, and Future Experimental Roadmap

1. **Two distinct transport scales**: Microgravity boundary-layer thickening ($\sim 0.7\text{–}11\,\mathrm{mm}$, $g_{bl}$ reduced $2.0\text{–}2.3\times$) is a real physical effect that reduces net assimilation by $5\text{–}9\%$ in leaves/rosettes and $26\text{–}29\%$ in dense canopies at saturating light ($<3\%$ and $11\%$ at $60\,\mu\mathrm{mol\,m^{-2}\,s^{-1}}$), and is reversed by $\approx 2.0\,\mathrm{cm\,s^{-1}}$ (leaf) to $\approx 6.1\,\mathrm{cm\,s^{-1}}$ (rosette) forced ventilation. However, sealed canister $\mathrm{CO_2}$ drawdown ($C_{\text{cabin}}\to C_a$) is $\approx 22\times$ larger, exhausts headspace $\mathrm{CO_2}$ in $\sim 7\,\mathrm{min}$ in both flight and ground controls, and causes the $1\,g$ and $\mu g$ boundary layers to converge as $A\to 0$.
2. **What gas transport does not explain**: The dominant global pathway enrichment in OSD-522 is ER unfolded protein response (`ath04141`, $p = 8.6\times 10^{-9}$), and dimly lit CARA (`OSD-678`, $4\text{–}6\,\mu\mathrm{mol\,m^{-2}\,s^{-1}}$) exhibits the strongest starvation-over-photosynthesis shift among lit studies.
3. **Actionable experimental roadmap**:
   - Log in-canister $\mathrm{CO_2}$, $\mathrm{O_2}$, and relative humidity in BRIC/CARA missions;
   - Run the targeted 20-compound LC-MS/GC-MS metabolomics panel (`T06`) on archived flight tissues to close the OSDR plant metabolomics gap (`T03`: 0/12);
   - Add a ventilated ground control (three-arm design) or fly a $2\times 2$ Gravity $\times$ Enclosure factorial experiment to separate hardware carbon starvation from microgravity.
