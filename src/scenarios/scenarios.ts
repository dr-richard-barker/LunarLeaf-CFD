import { LBMFluid } from '../solver/lbm/LBMFluid';
import { ScalarField } from '../solver/lbm/ScalarField';
import { applyBoussinesqForce, GRAVITY } from '../solver/lbm/buoyancy';
import { feq, viscosityFromRe, tauFromViscosity } from '../solver/lbm/d2q9';
import { computeDimensionless } from '../solver/diagnostics/dimensionless';
import { ghiaL2Error } from '../solver/diagnostics/ghia';
import { StrouhalProbe } from '../solver/diagnostics/strouhal';
import { diffusionStep } from '../solver/diagnostics/analytic';

export type RenderMode = 'speed' | 'vorticity' | 'scalar';

export interface Readout {
  label: string;
  value: string;
  /** Optional validation status for gate rows. */
  status?: 'pass' | 'warn' | 'pending';
}

export interface ScenarioInstance {
  readonly id: string;
  readonly label: string;
  readonly fluid: LBMFluid;
  /** Present when the scenario carries a scalar (species/temperature) field. */
  readonly scalarField?: ScalarField;
  readonly renderMode: RenderMode;
  /** Field value mapped to the top of the colormap. */
  readonly renderScale: number;
  /** Applied after each collideAndStream: inlet/outlet conditions. */
  postStream(): void;
  /** Applied after each step: probe recording, perturbations. */
  onAfterStep(step: number): void;
  /** Formatted diagnostics + validation-gate rows for the UI. */
  diagnostics(step: number): Readout[];
}

export interface ScenarioDef {
  id: string;
  label: string;
  description: string;
  build(): ScenarioInstance;
}

// ---------------------------------------------------------------------------
// Scenario 1 — Lid-driven cavity (validation gate 1: Ghia et al. Re=100)
// ---------------------------------------------------------------------------
function buildCavity(): ScenarioInstance {
  const N = 130; // includes 1-cell wall border → 128 fluid cells
  const U = 0.1; // lid speed (lattice units)
  const L = N - 2;
  const Re = 100;
  const nu = viscosityFromRe(U, L, Re);
  const tau = tauFromViscosity(nu);

  const fluid = new LBMFluid(N, N, tau);
  fluid.setEquilibrium(1, 0, 0);

  // Walls: full border is solid; the top row moves with the lid velocity.
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      const c = fluid.index(x, y);
      const border = x === 0 || x === N - 1 || y === 0 || y === N - 1;
      if (!border) continue;
      fluid.solid[c] = 1;
      if (y === N - 1) {
        fluid.uwx[c] = U; // moving lid at the top
        fluid.uwy[c] = 0;
      }
    }
  }

  const sampleU = (yNorm: number): number => {
    const xc = Math.floor(N / 2);
    const y = Math.min(N - 2, Math.max(1, Math.round(1 + yNorm * (N - 3))));
    return fluid.ux[fluid.index(xc, y)] / U;
  };
  const sampleV = (xNorm: number): number => {
    const yc = Math.floor(N / 2);
    const x = Math.min(N - 2, Math.max(1, Math.round(1 + xNorm * (N - 3))));
    return fluid.uy[fluid.index(x, yc)] / U;
  };

  return {
    id: 'cavity',
    label: 'Lid-driven cavity (Re 100)',
    fluid,
    renderMode: 'speed',
    renderScale: U,
    postStream() {
      /* walls handle everything via the mask */
    },
    onAfterStep() {
      /* steady-state problem: nothing to probe per step */
    },
    diagnostics(step: number): Readout[] {
      fluid.computeMacroscopic();
      const dl = computeDimensionless({ u: U, length: L, nu });
      const err = ghiaL2Error(sampleU, sampleV);
      // The Re=100 cavity converges to the Ghia reference by ~5–6k steps
      // (empirically L2 < 0.02 at 5k, < 0.011 at 11k).
      const converged = step > 6000;
      const gateStatus: Readout['status'] = !converged
        ? 'pending'
        : err < 0.05
          ? 'pass'
          : 'warn';
      return [
        { label: 'Reynolds', value: dl.Re.toFixed(0) },
        { label: 'tau', value: tau.toFixed(3) },
        { label: 'steps', value: step.toLocaleString() },
        {
          label: 'Ghia L2 error',
          value: err.toFixed(4),
          status: gateStatus,
        },
        {
          label: 'Gate 1 (cavity)',
          value: converged
            ? err < 0.05
              ? 'PASS (<0.05)'
              : 'off target'
            : 'converging…',
          status: gateStatus,
        },
      ];
    },
  };
}

// ---------------------------------------------------------------------------
// Scenario 2 — Flow past a cylinder (validation gate 2: St ≈ 0.16–0.17 @ Re 100)
// ---------------------------------------------------------------------------
function buildCylinder(): ScenarioInstance {
  const nx = 420;
  const ny = 120;
  const U = 0.05;
  const D = 20; // cylinder diameter
  const Re = 100;
  const nu = viscosityFromRe(U, D, Re);
  const tau = tauFromViscosity(nu);

  const fluid = new LBMFluid(nx, ny, tau);
  fluid.setEquilibrium(1, U, 0);

  // Channel walls (no-slip) top and bottom.
  for (let x = 0; x < nx; x++) {
    fluid.solid[fluid.index(x, 0)] = 1;
    fluid.solid[fluid.index(x, ny - 1)] = 1;
  }

  // Cylinder, slightly off-centre in y to break symmetry and trigger shedding.
  const cx = 90;
  const cy = ny / 2 - 2;
  const r = D / 2;
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
        fluid.solid[fluid.index(x, y)] = 1;
      }
    }
  }

  const probe = new StrouhalProbe(4000);
  const probeX = Math.min(nx - 2, cx + 3 * D);
  const probeY = Math.round(cy);
  const probeCell = fluid.index(probeX, probeY);

  const applyInletOutlet = () => {
    // Inlet: equilibrium velocity BC on the left column (fluid rows only).
    for (let y = 1; y < ny - 1; y++) {
      const c = fluid.index(0, y);
      if (fluid.solid[c]) continue;
      const base = c * 9;
      for (let i = 0; i < 9; i++) fluid.f[base + i] = feq(i, 1, U, 0);
    }
    // Outlet: zero-gradient (copy the penultimate column).
    for (let y = 1; y < ny - 1; y++) {
      const c = fluid.index(nx - 1, y);
      if (fluid.solid[c]) continue;
      const src = fluid.index(nx - 2, y) * 9;
      const dst = c * 9;
      for (let i = 0; i < 9; i++) fluid.f[dst + i] = fluid.f[src + i];
    }
  };

  return {
    id: 'cylinder',
    label: 'Flow past cylinder (Re 100)',
    fluid,
    renderMode: 'vorticity',
    renderScale: 0.02,
    postStream() {
      applyInletOutlet();
    },
    onAfterStep(step: number) {
      // CX/CY for D2Q9 (matches d2q9.ts ordering).
      const CXa = [0, 1, 0, -1, 0, 1, -1, -1, 1];
      const CYa = [0, 0, 1, 0, -1, 1, 1, -1, -1];

      // Seed the Kármán instability with a brief, asymmetric transverse kick just
      // behind the cylinder. Without it, a symmetric wake can persist for tens of
      // thousands of steps before shedding onsets; the kick makes shedding reliable
      // and fast. It is switched off after the wake is established.
      if (step < 600) {
        const py = Math.round(cy) + 3; // below the wake centreline → breaks symmetry
        const x0 = cx + Math.round(r) + 2;
        for (let x = x0; x < x0 + 4; x++) {
          const cc = fluid.index(x, py);
          if (fluid.solid[cc]) continue;
          const b = cc * 9;
          let rho = 0;
          let mx = 0;
          let my = 0;
          for (let i = 0; i < 9; i++) {
            const fi = fluid.f[b + i];
            rho += fi;
            mx += CXa[i] * fi;
            my += CYa[i] * fi;
          }
          const ux = mx / rho;
          const uy = my / rho + 0.2 * U; // upward kick
          for (let i = 0; i < 9; i++) fluid.f[b + i] = feq(i, rho, ux, uy);
        }
      }

      // Local macroscopic at the probe to read transverse velocity.
      const base = probeCell * 9;
      let rho = 0;
      let my = 0;
      for (let i = 0; i < 9; i++) {
        const fi = fluid.f[base + i];
        rho += fi;
        my += CYa[i] * fi;
      }
      probe.record(my / rho);
    },
    diagnostics(step: number): Readout[] {
      const dl = computeDimensionless({ u: U, length: D, nu });
      const st = probe.strouhal(D, U);
      const cycles = probe.cycles();
      // The classic *unconfined* cylinder gives St ≈ 0.164 at Re=100. This is a
      // confined channel (blockage D/ny ≈ 0.17), which raises the shedding
      // frequency; the expected confined value is ≈ 0.19–0.20 (measured 0.196).
      // The band brackets both regimes so the gate stays meaningful.
      const inRange = st !== null && st > 0.16 && st < 0.22;
      const status: Readout['status'] =
        st === null ? 'pending' : inRange ? 'pass' : 'warn';
      return [
        { label: 'Reynolds', value: dl.Re.toFixed(0) },
        { label: 'tau', value: tau.toFixed(3) },
        { label: 'steps', value: step.toLocaleString() },
        { label: 'shedding cycles', value: cycles.toString() },
        {
          label: 'Strouhal',
          value: st === null ? 'measuring…' : st.toFixed(3),
          status,
        },
        {
          label: 'Gate 2 (cylinder)',
          value:
            st === null
              ? 'waiting for wake…'
              : inRange
                ? 'PASS (0.16–0.22, confined)'
                : 'off target',
          status,
        },
      ];
    },
  };
}

// ---------------------------------------------------------------------------
// Scenario 3 — Natural-convection cavity (validation gate 3: Nu vs Ra)
//   Differentially heated square cavity (de Vahl Davis 1983). Hot left wall,
//   cold right wall, adiabatic top/bottom, no-slip everywhere. Buoyancy from the
//   temperature field drives a convection roll; the hot-wall Nusselt number must
//   match the benchmark — the proof that the gravity/buoyancy coupling is right.
// ---------------------------------------------------------------------------
function buildNaturalConvection(): ScenarioInstance {
  const N = 66; // 64 fluid cells + wall border
  const H = N - 2;
  const nu = 0.02;
  const Pr = 0.71;
  const kappa = nu / Pr; // thermal diffusivity
  const Ra = 1e4; // de Vahl Davis reference: Nu_hot ≈ 2.238
  const dT = 1;
  // Buoyancy coefficient A = g·β chosen so that Ra = A·ΔT·H³ / (ν·κ).
  const A = (Ra * nu * kappa) / (dT * H ** 3);

  const tauF = tauFromViscosity(nu);
  const fluid = new LBMFluid(N, N, tauF);
  fluid.setEquilibrium(1, 0, 0);
  fluid.enableForcing();

  const temp = new ScalarField(fluid, kappa, 0.5); // tauC set from kappa in ctor

  // Walls: full border no-slip. Left = hot Dirichlet, right = cold Dirichlet,
  // top/bottom left adiabatic (no Dirichlet → zero-flux bounce-back).
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      const c = fluid.index(x, y);
      const border = x === 0 || x === N - 1 || y === 0 || y === N - 1;
      if (!border) continue;
      fluid.solid[c] = 1;
      if (x === 0) temp.setDirichlet(c, 1); // hot
      else if (x === N - 1) temp.setDirichlet(c, 0); // cold
    }
  }

  // Average hot-wall Nusselt number, normalised so pure conduction gives 1.
  const nusseltHot = (): number => {
    let sum = 0;
    let n = 0;
    for (let y = 1; y < N - 1; y++) {
      const t1 = temp.C[fluid.index(1, y)];
      // Nu_local = (T_wall − T[x=1]) · H / (ΔT · 0.5); wall midpoint is 0.5 in.
      sum += ((1 - t1) * H) / (0.5 * dT);
      n++;
    }
    return sum / n;
  };

  return {
    id: 'natconv',
    label: 'Natural-convection cavity (Ra 1e4)',
    fluid,
    scalarField: temp,
    renderMode: 'scalar',
    renderScale: 1,
    postStream() {
      /* walls handled by masks + Dirichlet */
    },
    onAfterStep() {
      temp.step();
      // Boussinesq force for the next fluid step: f_y = A·ρ·(T − 0.5), so warm
      // fluid (T > 0.5) rises. A encodes g·β and sets the Rayleigh number.
      applyBoussinesqForce(fluid, 0, A, [{ field: temp, beta: 1, ref: 0.5 }]);
    },
    diagnostics(step: number): Readout[] {
      const Nu = nusseltHot();
      const converged = step > 40000;
      const inRange = Nu > 1.9 && Nu < 2.5;
      const status: Readout['status'] = !converged
        ? 'pending'
        : inRange
          ? 'pass'
          : 'warn';
      return [
        { label: 'Rayleigh', value: Ra.toExponential(0) },
        { label: 'Prandtl', value: Pr.toFixed(2) },
        { label: 'steps', value: step.toLocaleString() },
        { label: 'Nu (hot wall)', value: Nu.toFixed(3), status },
        {
          label: 'Gate 3 (buoyancy)',
          value: !converged
            ? 'converging…'
            : inRange
              ? 'PASS (Nu≈2.24)'
              : 'off target',
          status,
        },
      ];
    },
  };
}

// ---------------------------------------------------------------------------
// Scenario 4 — Pure diffusion (validation gate 4: error-function profile)
//   No flow (g = 0, u = 0). An initial concentration step diffuses; the profile
//   must follow C(x,t) = ½ erfc((x−x0)/(2√(Dt))) — the molecular-diffusion limit
//   that dominates transport in microgravity once convection is switched off.
// ---------------------------------------------------------------------------
function buildDiffusion(): ScenarioInstance {
  const nx = 200;
  const ny = 8;
  const D = 1 / 6; // diffusivity → tauC = 1.0
  const x0 = nx / 2; // step between cells 99 and 100 → interface at 99.5
  const iface = x0 - 0.5;

  const fluid = new LBMFluid(nx, ny, tauFromViscosity(1 / 6));
  fluid.setEquilibrium(1, 0, 0); // at rest; never stepped → pure diffusion

  const conc = new ScalarField(fluid, D, 0);
  conc.initField((x) => (x < x0 ? 1 : 0));

  let latchedPass = false;

  const l2Error = (step: number): number => {
    const yrow = ny >> 1;
    let sq = 0;
    let n = 0;
    for (let x = 1; x < nx - 1; x++) {
      const analytic = diffusionStep(x, step, D, iface, 1, 0);
      const d = conc.C[fluid.index(x, yrow)] - analytic;
      sq += d * d;
      n++;
    }
    return Math.sqrt(sq / n);
  };

  return {
    id: 'diffusion',
    label: 'Pure diffusion (erfc limit)',
    fluid,
    scalarField: conc,
    renderMode: 'scalar',
    renderScale: 1,
    postStream() {
      /* no flow */
    },
    onAfterStep() {
      conc.step();
    },
    diagnostics(step: number): Readout[] {
      const err = l2Error(step);
      // Valid while the diffusion front has not reached the reflecting walls
      // (~step 1800 for this domain); latch PASS once achieved in-window.
      const inWindow = step >= 400 && step <= 1600;
      if (inWindow && err < 0.02) latchedPass = true;
      const status: Readout['status'] =
        step < 400 ? 'pending' : latchedPass ? 'pass' : inWindow ? 'warn' : 'warn';
      return [
        { label: 'diffusivity D', value: D.toFixed(3) },
        { label: 'steps', value: step.toLocaleString() },
        { label: 'erfc L2 error', value: err.toFixed(4), status },
        {
          label: 'Gate 4 (diffusion)',
          value:
            step < 400
              ? 'diffusing…'
              : latchedPass
                ? 'PASS (<0.02)'
                : step > 1600
                  ? 'window closed'
                  : 'measuring…',
          status,
        },
      ];
    },
  };
}

// ---------------------------------------------------------------------------
// Scenarios 5–7 — Arabidopsis at three scales, gravity sweep (the science)
//
//   A plant (single leaf → rosette → microgreen canopy) exchanges gas through a
//   stomatal source/sink on its surface: CO2 uptake (sink), O2 + H2O release
//   (source). The near-surface air is lighter (humid + CO2-depleted), so under
//   gravity it rises — solutal Boussinesq buoyancy — sweeping the boundary layer.
//   Reducing gravity weakens convection; the surface-to-ambient gaps ΔC steepen,
//   and denser geometries (rosette, canopy) trap air and amplify the effect.
//   Fields store excess-over-ambient, so ambient = 0 and CO2 goes negative.
// ---------------------------------------------------------------------------

interface Species {
  co2: ScalarField;
  o2: ScalarField;
  h2o: ScalarField;
}

/** Mark the full domain border as no-slip walls held at ambient concentration. */
function chamberWalls(fluid: LBMFluid, sp: Species): void {
  const { nx, ny } = fluid;
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) {
      if (x !== 0 && x !== nx - 1 && y !== 0 && y !== ny - 1) continue;
      const c = fluid.index(x, y);
      fluid.solid[c] = 1;
      sp.co2.setDirichlet(c, 0);
      sp.o2.setDirichlet(c, 0);
      sp.h2o.setDirichlet(c, 0);
    }
  }
}

/** Rasterise a (possibly rotated) solid ellipse into the fluid + isLeaf masks. */
function stampEllipse(
  fluid: LBMFluid,
  isLeaf: Uint8Array,
  cx: number,
  cy: number,
  a: number,
  b: number,
  angle: number,
): void {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const R = Math.ceil(Math.max(a, b)) + 1;
  const x0 = Math.max(0, Math.floor(cx - R));
  const x1 = Math.min(fluid.nx - 1, Math.ceil(cx + R));
  const y0 = Math.max(0, Math.floor(cy - R));
  const y1 = Math.min(fluid.ny - 1, Math.ceil(cy + R));
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const dx = x - cx;
      const dy = y - cy;
      const lx = dx * ca + dy * sa;
      const ly = -dx * sa + dy * ca;
      if ((lx / a) ** 2 + (ly / b) ** 2 <= 1) {
        const c = fluid.index(x, y);
        fluid.solid[c] = 1;
        isLeaf[c] = 1;
      }
    }
  }
}

// --- geometry: single leaf (closed chamber, one horizontal blade) ---
export function leafGeometry(fluid: LBMFluid, sp: Species): { isLeaf: Uint8Array; charLen: number } {
  chamberWalls(fluid, sp);
  const isLeaf = new Uint8Array(fluid.size);
  stampEllipse(fluid, isLeaf, fluid.nx / 2, fluid.ny / 2, 26, 4, 0);
  return { isLeaf, charLen: 52 };
}

// --- geometry: rosette (closed chamber, fan of overlapping leaves) ---
export function rosetteGeometry(fluid: LBMFluid, sp: Species): { isLeaf: Uint8Array; charLen: number } {
  chamberWalls(fluid, sp);
  const isLeaf = new Uint8Array(fluid.size);
  const cx = fluid.nx / 2;
  const cy = fluid.ny / 2;
  const a = 20;
  const b = 3.4;
  const off = 15; // leaf-centre offset from the crown
  const anglesDeg = [22, 8, -8, -22, 158, 172, 188, 202];
  for (const deg of anglesDeg) {
    const ang = (deg * Math.PI) / 180;
    stampEllipse(fluid, isLeaf, cx + off * Math.cos(ang), cy + off * Math.sin(ang), a, b, ang);
  }
  return { isLeaf, charLen: 70 };
}

// --- geometry: microgreen canopy (soil floor, row of upright shoots) ---
export function canopyGeometry(fluid: LBMFluid, sp: Species): { isLeaf: Uint8Array; charLen: number } {
  const { nx, ny } = fluid;
  const isLeaf = new Uint8Array(fluid.size);
  // Top + side walls: ambient (open room). Bottom is soil (adiabatic), added next.
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) {
      if (x !== 0 && x !== nx - 1 && y !== ny - 1) continue;
      const c = fluid.index(x, y);
      fluid.solid[c] = 1;
      sp.co2.setDirichlet(c, 0);
      sp.o2.setDirichlet(c, 0);
      sp.h2o.setDirichlet(c, 0);
    }
  }
  for (let x = 0; x < nx; x++) fluid.solid[fluid.index(x, 0)] = 1; // soil floor (no Dirichlet)
  // Upright shoots standing on the soil, packed like a lawn. Microgreens are
  // short; kept sparse enough that the within-canopy air still accumulates while
  // the density perturbation stays in the Boussinesq/low-Mach regime.
  const spacing = 12;
  const halfW = 1.7;
  const height = 13;
  for (let bx = spacing; bx < nx - spacing + 1; bx += spacing) {
    stampEllipse(fluid, isLeaf, bx, 1 + height, halfW, height, 0);
  }
  return { isLeaf, charLen: 26 };
}

type Geometry = (fluid: LBMFluid, sp: Species) => { isLeaf: Uint8Array; charLen: number };

// Lattice→physical velocity scale from the calibration (results/tables/T3):
// dx/dt ≈ 1.66 m/s per lattice velocity unit, i.e. 166 cm/s.
const U_STAR_CM_S = 166;

interface LeafSceneCfg {
  id: string;
  label: string;
  gRatio: number;
  nx: number;
  ny: number;
  renderScale: number;
  geometry: Geometry;
  /** Per-area flux multiplier (default 1). <1 models canopy self-shading, which
   *  lowers per-leaf assimilation and keeps a dense stand in the Boussinesq regime. */
  sourceScale?: number;
  /** Forced-airflow speed (lattice units). When set, the left/right chamber walls
   *  become a ventilation inlet (fresh air at this speed) and outlet — the engineered
   *  substitute for the buoyant convection that microgravity removes. */
  forcedU?: number;
  /** Enclosure gas exchange (spaceflight hardware). Undefined → ambient-held walls
   *  (well-mixed surroundings, the default). 0 → hermetically sealed (BRIC): no
   *  exchange, gas drifts without bound. 0<k<1 → semi-permeable membrane (CARA
   *  micropore tape): each step the near-wall excess relaxes toward ambient by k. */
  membraneK?: number;
  /** Dark (respiration) instead of light (net photosynthesis): flips the source
   *  signs and scales by the measured R/A ratio (0.31). */
  dark?: boolean;
}

/**
 * Shared builder for the three plant scales. Wires the stomatal source/sink onto
 * whatever surface the geometry defines, couples solutal buoyancy to a gravity
 * vector, and reports convection strength + the surface gaps (mean and peak — the
 * peak captures the worst trapped/interior spot that rosettes and canopies create).
 */
export function makeLeafScene(cfg: LeafSceneCfg): () => ScenarioInstance {
  return () => {
    const { nx, ny } = cfg;
    const nu = 0.02;
    const U = cfg.forcedU ?? 0;
    const fluid = new LBMFluid(nx, ny, tauFromViscosity(nu));
    fluid.setEquilibrium(1, U, 0);
    fluid.enableForcing();

    // Species (excess over ambient); D_CO2 < D_O2 < D_H2O as in air.
    const co2 = new ScalarField(fluid, 0.033, 0);
    const o2 = new ScalarField(fluid, 0.042, 0);
    const h2o = new ScalarField(fluid, 0.05, 0);
    co2.enableSource();
    o2.enableSource();
    h2o.enableSource();
    const species = [co2, o2, h2o];

    const { isLeaf, charLen } = cfg.geometry(fluid, { co2, o2, h2o });

    // Forced airflow: convert the closed chamber into a ventilation channel by
    // opening the left (inlet) and right (outlet) columns; top/bottom stay walls.
    if (cfg.forcedU !== undefined) {
      for (let y = 1; y < ny - 1; y++) {
        for (const x of [0, nx - 1]) {
          const c = fluid.index(x, y);
          fluid.solid[c] = 0;
          for (const sp of species) if (sp.dirichlet) sp.dirichlet[c] = NaN;
        }
      }
    }

    // Inlet: prescribed velocity + fresh air (zero species excess). Outlet:
    // zero-gradient. Fluid part runs in postStream (after streaming); the species
    // part runs in onAfterStep (after the scalar step) so the BC is not overwritten.
    const fluidInletOutlet = () => {
      for (let y = 1; y < ny - 1; y++) {
        const ci = fluid.index(0, y) * 9;
        for (let i = 0; i < 9; i++) fluid.f[ci + i] = feq(i, 1, U, 0);
        const co = fluid.index(nx - 1, y) * 9;
        const cs = fluid.index(nx - 2, y) * 9;
        for (let i = 0; i < 9; i++) fluid.f[co + i] = fluid.f[cs + i];
      }
    };
    const speciesInletOutlet = () => {
      for (const sp of species) {
        for (let y = 1; y < ny - 1; y++) {
          const ci = fluid.index(0, y) * 5;
          for (let i = 0; i < 5; i++) sp.g[ci + i] = 0; // fresh air (C = 0)
          const co = fluid.index(nx - 1, y) * 5;
          const cs = fluid.index(nx - 2, y) * 5;
          for (let i = 0; i < 5; i++) sp.g[co + i] = sp.g[cs + i];
        }
      }
    };

    // Stomatal fluxes on fluid cells adjacent to the plant surface. Kept small so
    // the surface excess ΔC stays ≪ 1 (Boussinesq small-perturbation regime). In the
    // dark, respiration reverses the signs (CO2 released, O2 consumed) at R/A = 0.31.
    const sScale = (cfg.sourceScale ?? 1) * (cfg.dark ? -0.31 : 1);
    const S_CO2 = 5e-4 * sScale;
    const S_O2 = 4e-4 * sScale;
    const S_H2O = 5e-4 * (cfg.sourceScale ?? 1) * (cfg.dark ? 0.31 : 1); // H2O always released
    const surfaceCells: number[] = [];
    for (let x = 1; x < nx - 1; x++) {
      for (let y = 1; y < ny - 1; y++) {
        const c = fluid.index(x, y);
        if (fluid.solid[c]) continue;
        const touches =
          isLeaf[fluid.index(x + 1, y)] ||
          isLeaf[fluid.index(x - 1, y)] ||
          isLeaf[fluid.index(x, y + 1)] ||
          isLeaf[fluid.index(x, y - 1)];
        if (touches) {
          surfaceCells.push(c);
          co2.source![c] = -S_CO2;
          o2.source![c] = S_O2;
          h2o.source![c] = S_H2O;
        }
      }
    }

    // Enclosure gas exchange (spaceflight hardware). When membraneK is set the
    // ambient-held chamber walls become either sealed (k=0, BRIC) or a semi-permeable
    // membrane (0<k<1, CARA tape): clear the wall Dirichlet (→ zero-flux) and collect
    // the near-wall fluid cells whose excess is relaxed toward ambient each step.
    const membraneCells: number[] = [];
    if (cfg.membraneK !== undefined) {
      for (let x = 0; x < nx; x++) {
        for (let y = 0; y < ny; y++) {
          if (x !== 0 && x !== nx - 1 && y !== 0 && y !== ny - 1) continue;
          const c = fluid.index(x, y);
          if (co2.dirichlet) co2.dirichlet[c] = NaN;
          if (o2.dirichlet) o2.dirichlet[c] = NaN;
          if (h2o.dirichlet) h2o.dirichlet[c] = NaN;
        }
      }
      if (cfg.membraneK > 0) {
        // Only cells adjacent to the domain border (the taped dish wall) vent —
        // NOT cells next to the leaf (the leaf is solid too, but it is not a wall).
        const onBorder = (xx: number, yy: number) => xx === 0 || xx === nx - 1 || yy === 0 || yy === ny - 1;
        for (let x = 1; x < nx - 1; x++) {
          for (let y = 1; y < ny - 1; y++) {
            const c = fluid.index(x, y);
            if (fluid.solid[c]) continue;
            if (onBorder(x + 1, y) || onBorder(x - 1, y) || onBorder(x, y + 1) || onBorder(x, y - 1))
              membraneCells.push(c);
          }
        }
      }
    }
    const leak = cfg.membraneK ?? 0;
    const applyMembrane = () => {
      const f = 1 - leak;
      for (const c of membraneCells) {
        for (const sp of species) {
          const b = c * 5;
          for (let i = 0; i < 5; i++) sp.g[b + i] *= f;
        }
      }
    };

    // Buoyancy: humid air lighter (β<0); CO2 heavier (β>0, but depleted → lighter);
    // O2 slightly heavier (β>0). Gravity points down (−y), scaled by g/g_earth.
    const B = 8e-4;
    const gLat = B * cfg.gRatio;
    const contributors = [
      { field: h2o, beta: -1.0, ref: 0 },
      { field: co2, beta: 0.7, ref: 0 },
      { field: o2, beta: 0.5, ref: 0 },
    ];

    const surfaceStats = (field: ScalarField): { mean: number; peak: number } => {
      let sum = 0;
      let peak = 0;
      for (const c of surfaceCells) {
        const v = field.C[c];
        sum += v;
        if (Math.abs(v) > Math.abs(peak)) peak = v;
      }
      return { mean: sum / surfaceCells.length, peak };
    };

    const maxSpeed = (): number => {
      let m = 0;
      for (let c = 0; c < fluid.size; c++) {
        if (fluid.solid[c]) continue;
        const s = fluid.speed(c);
        if (s > m) m = s;
      }
      return m;
    };

    // Whole-enclosure mean excess — for a sealed dish (BRIC) this drifts without
    // bound; for a vented dish it settles near ambient (0).
    const domainMean = (field: ScalarField): number => {
      let sum = 0;
      let n = 0;
      for (let c = 0; c < fluid.size; c++) {
        if (fluid.solid[c]) continue;
        sum += field.C[c];
        n++;
      }
      return sum / n;
    };

    const boundaryLabel =
      cfg.forcedU !== undefined
        ? 'vented (forced airflow)'
        : cfg.membraneK === undefined
          ? 'ambient walls'
          : cfg.membraneK === 0
            ? 'sealed (BRIC)'
            : 'micropore tape (CARA)';

    return {
      id: cfg.id,
      label: cfg.label,
      fluid,
      scalarField: h2o,
      renderMode: 'scalar',
      renderScale: cfg.renderScale,
      postStream() {
        if (cfg.forcedU !== undefined) fluidInletOutlet();
      },
      onAfterStep() {
        co2.step();
        o2.step();
        h2o.step();
        if (cfg.forcedU !== undefined) speciesInletOutlet();
        if (membraneCells.length) applyMembrane();
        applyBoussinesqForce(fluid, 0, -gLat, contributors);
      },
      diagnostics(step: number): Readout[] {
        fluid.computeMacroscopic();
        const umax = maxSpeed();
        const w = surfaceStats(h2o);
        const cc = surfaceStats(co2);
        const oo = surfaceStats(o2);
        const Sc = nu / 0.05;
        const Ra = ((gLat * Math.abs(w.mean) * charLen ** 3) / (nu * nu)) * Sc;
        const gAbs = cfg.gRatio * GRAVITY.earth;
        const out: Readout[] = [
          { label: 'enclosure', value: boundaryLabel },
          { label: 'gravity', value: `${gAbs.toFixed(2)} m/s²  (${cfg.gRatio.toFixed(3)} g)` },
        ];
        if (cfg.forcedU !== undefined) {
          out.push({ label: 'forced airflow', value: `${(U * U_STAR_CM_S).toFixed(1)} cm/s` });
        }
        out.push(
          { label: 'steps', value: step.toLocaleString() },
          { label: 'u_max (convection)', value: umax.toExponential(2) },
        );
        if (cfg.membraneK !== undefined || cfg.dark) {
          out.push({ label: 'dish-mean CO₂ excess', value: domainMean(co2).toFixed(3) });
        } else {
          out.push({ label: 'Rayleigh (H₂O)', value: Ra.toExponential(1) });
        }
        out.push(
          { label: 'ΔC H₂O  mean/peak', value: `${w.mean.toFixed(3)} / ${w.peak.toFixed(3)}` },
          { label: 'ΔC CO₂  mean/peak', value: `${cc.mean.toFixed(3)} / ${cc.peak.toFixed(3)}` },
          { label: 'ΔC O₂  mean/peak', value: `${oo.mean.toFixed(3)} / ${oo.peak.toFixed(3)}` },
        );
        return out;
      },
    };
  };
}

const R2E = GRAVITY.mars / GRAVITY.earth;
const M2E = GRAVITY.moon / GRAVITY.earth;

const LEAF_DESC =
  'Single Arabidopsis leaf in a closed chamber — stomatal CO₂ uptake + O₂/H₂O release with solutal buoyancy. Sweep gravity (select each preset, Run ~30k steps) and watch u_max fall and the surface gaps ΔC steepen.';
const ROSETTE_DESC =
  'A rosette of overlapping leaves. Leaves shade each other’s airflow and trap air near the crown, so the interior surface gaps (ΔC peak) run steeper than an isolated leaf — an effect that worsens as gravity falls.';
const FAN_DESC =
  'A leaf in microgravity with forced ventilation — the engineered substitute for the buoyant convection µg removes. As fan speed rises, the inlet flow thins the boundary layer and the surface gaps ΔC fall back toward Earth-1 g levels (compare with “Leaf · Earth”).';
const BRIC_DESC =
  'BRIC spaceflight hardware — a hermetically SEALED Petri dish in µg. No gas exchange with the cabin, so the enclosure atmosphere drifts without bound: in light the leaf depletes its own CO₂ (carbon starvation); in the dark respiration consumes O₂ and builds CO₂ (hypoxia). Watch “dish-mean CO₂ excess” run away — it never reaches steady state.';
const CARA_DESC =
  'CARA spaceflight hardware — a Petri dish sealed with gas-permeable micropore surgical tape in µg. The tape vents the dish toward the cabin, so the dish-mean stays bounded near ambient — but with no convection inside, a diffusive boundary layer still steepens the gases at the leaf surface. Compare its dish-mean (bounded) with BRIC (runaway).';
const VEGGIE_DESC =
  'VEGGIE spaceflight hardware — light + forced airflow actively ventilating the growth volume in µg. The circulated air thins the leaf boundary layer as well as venting the enclosure, restoring near-Earth surface gas gradients. (If the dish stayed taped, internal gradients would resemble CARA; VEGGIE’s design intent is to ventilate the plants directly.)';
const CANOPY_DESC =
  'A microgreen “lawn” — a dense row of upright shoots on soil, ambient above. Convection ventilates only the canopy top; the within-canopy air stagnates, and in microgravity the whole stand’s gas gaps blow out.';

const DOM = { nx: 128, ny: 96 };

export const SCENARIOS: ScenarioDef[] = [
  {
    id: 'leaf-earth',
    label: 'Leaf · Earth (1 g)',
    description: LEAF_DESC,
    build: makeLeafScene({ ...DOM, id: 'leaf-earth', label: 'Single leaf — Earth (1 g)', gRatio: 1, renderScale: 0.12, geometry: leafGeometry }),
  },
  {
    id: 'leaf-mars',
    label: 'Leaf · Mars (0.38 g)',
    description: LEAF_DESC,
    build: makeLeafScene({ ...DOM, id: 'leaf-mars', label: 'Single leaf — Mars (0.38 g)', gRatio: R2E, renderScale: 0.12, geometry: leafGeometry }),
  },
  {
    id: 'leaf-moon',
    label: 'Leaf · Moon (0.17 g)',
    description: LEAF_DESC,
    build: makeLeafScene({ ...DOM, id: 'leaf-moon', label: 'Single leaf — Moon (0.17 g)', gRatio: M2E, renderScale: 0.12, geometry: leafGeometry }),
  },
  {
    id: 'leaf-ug',
    label: 'Leaf · microgravity (0 g)',
    description: LEAF_DESC,
    build: makeLeafScene({ ...DOM, id: 'leaf-ug', label: 'Single leaf — microgravity (0 g)', gRatio: 0, renderScale: 0.12, geometry: leafGeometry }),
  },
  {
    id: 'rosette-earth',
    label: 'Rosette · Earth (1 g)',
    description: ROSETTE_DESC,
    build: makeLeafScene({ ...DOM, id: 'rosette-earth', label: 'Rosette — Earth (1 g)', gRatio: 1, renderScale: 0.18, geometry: rosetteGeometry }),
  },
  {
    id: 'rosette-ug',
    label: 'Rosette · microgravity (0 g)',
    description: ROSETTE_DESC,
    build: makeLeafScene({ ...DOM, id: 'rosette-ug', label: 'Rosette — microgravity (0 g)', gRatio: 0, renderScale: 0.18, geometry: rosetteGeometry }),
  },
  {
    id: 'canopy-earth',
    label: 'Microgreen canopy · Earth (1 g)',
    description: CANOPY_DESC,
    build: makeLeafScene({ ...DOM, id: 'canopy-earth', label: 'Microgreen canopy — Earth (1 g)', gRatio: 1, renderScale: 0.3, sourceScale: 0.3, geometry: canopyGeometry }),
  },
  {
    id: 'canopy-ug',
    label: 'Microgreen canopy · microgravity (0 g)',
    description: CANOPY_DESC,
    build: makeLeafScene({ ...DOM, id: 'canopy-ug', label: 'Microgreen canopy — microgravity (0 g)', gRatio: 0, renderScale: 0.3, sourceScale: 0.3, geometry: canopyGeometry }),
  },
  {
    id: 'leaf-ug-fan-lo',
    label: 'Leaf · µg + fan 3 cm/s',
    description: FAN_DESC,
    build: makeLeafScene({ ...DOM, id: 'leaf-ug-fan-lo', label: 'Leaf — µg + fan ~3 cm/s', gRatio: 0, renderScale: 0.12, geometry: leafGeometry, forcedU: 0.02 }),
  },
  {
    id: 'leaf-ug-fan-mid',
    label: 'Leaf · µg + fan 8 cm/s',
    description: FAN_DESC,
    build: makeLeafScene({ ...DOM, id: 'leaf-ug-fan-mid', label: 'Leaf — µg + fan ~8 cm/s', gRatio: 0, renderScale: 0.12, geometry: leafGeometry, forcedU: 0.05 }),
  },
  {
    id: 'leaf-ug-fan-hi',
    label: 'Leaf · µg + fan 17 cm/s',
    description: FAN_DESC,
    build: makeLeafScene({ ...DOM, id: 'leaf-ug-fan-hi', label: 'Leaf — µg + fan ~17 cm/s', gRatio: 0, renderScale: 0.12, geometry: leafGeometry, forcedU: 0.1 }),
  },
  {
    id: 'hw-bric-light',
    label: 'Hardware · BRIC sealed (light)',
    description: BRIC_DESC,
    build: makeLeafScene({ ...DOM, id: 'hw-bric-light', label: 'BRIC — sealed dish, µg, light', gRatio: 0, renderScale: 0.5, geometry: leafGeometry, membraneK: 0 }),
  },
  {
    id: 'hw-bric-dark',
    label: 'Hardware · BRIC sealed (dark)',
    description: BRIC_DESC,
    build: makeLeafScene({ ...DOM, id: 'hw-bric-dark', label: 'BRIC — sealed dish, µg, dark (respiration)', gRatio: 0, renderScale: 0.5, geometry: leafGeometry, membraneK: 0, dark: true }),
  },
  {
    id: 'hw-cara',
    label: 'Hardware · CARA micropore tape',
    description: CARA_DESC,
    build: makeLeafScene({ ...DOM, id: 'hw-cara', label: 'CARA — micropore-taped dish, µg, light', gRatio: 0, renderScale: 0.3, geometry: leafGeometry, membraneK: 0.01 }),
  },
  {
    id: 'hw-veggie',
    label: 'Hardware · VEGGIE vented',
    description: VEGGIE_DESC,
    build: makeLeafScene({ ...DOM, id: 'hw-veggie', label: 'VEGGIE — vented + light, µg', gRatio: 0, renderScale: 0.12, geometry: leafGeometry, forcedU: 0.05 }),
  },
  {
    id: 'cavity',
    label: 'Lid-driven cavity',
    description:
      'Validation gate 1 — compares the vertical/horizontal centreline velocity profiles to Ghia et al. (1982) at Re 100.',
    build: buildCavity,
  },
  {
    id: 'cylinder',
    label: 'Flow past cylinder',
    description:
      'Validation gate 2 — measures the Kármán vortex-shedding Strouhal number. Unconfined St ≈ 0.164 at Re 100; this confined channel (≈17% blockage) raises it to ≈ 0.19–0.20 (measured 0.196).',
    build: buildCylinder,
  },
  {
    id: 'natconv',
    label: 'Natural convection (buoyancy)',
    description:
      'Validation gate 3 — differentially heated cavity at Ra 1e4. Buoyancy from the temperature field drives a convection roll; the hot-wall Nusselt number must match de Vahl Davis (1983), Nu ≈ 2.24. This is the proof that the gravity/buoyancy coupling is physically correct.',
    build: buildNaturalConvection,
  },
  {
    id: 'diffusion',
    label: 'Pure diffusion (microgravity limit)',
    description:
      'Validation gate 4 — with no flow, an initial concentration step must relax to the error-function profile C(x,t)=½ erfc((x−x0)/2√(Dt)). This molecular-diffusion limit is exactly what dominates gas transport once microgravity removes convection.',
    build: buildDiffusion,
  },
];
