import { useEffect, useRef, useState, useCallback } from 'react';
import { SCENARIOS, Readout } from '../scenarios/scenarios';
import { SimulationController } from '../sim/SimulationController';

const CANVAS_W = 720;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<SimulationController | null>(null);
  const rafRef = useRef<number>(0);

  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [running, setRunning] = useState(false);
  const [substeps, setSubsteps] = useState(10);
  const [readouts, setReadouts] = useState<Readout[]>([]);
  const [stepCount, setStepCount] = useState(0);

  // (Re)build the controller when the scenario changes.
  useEffect(() => {
    const def = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
    const controller = new SimulationController(def);
    controllerRef.current = controller;

    const canvas = canvasRef.current!;
    const { nx, ny } = controller.gridSize;
    canvas.width = CANVAS_W;
    canvas.height = Math.round((CANVAS_W * ny) / nx);
    controller.attachCanvas(canvas);
    controller.substepsPerFrame = substeps;
    controller.paint();
    setStepCount(0);
    setReadouts(controller.diagnostics());
    // substeps intentionally excluded: it is synced separately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId]);

  // Keep the running flag and substeps in sync with the controller.
  useEffect(() => {
    if (controllerRef.current) controllerRef.current.running = running;
  }, [running]);
  useEffect(() => {
    if (controllerRef.current) controllerRef.current.substepsPerFrame = substeps;
  }, [substeps]);

  // Animation loop.
  useEffect(() => {
    let lastDiag = 0;
    const tick = (t: number) => {
      const controller = controllerRef.current;
      if (controller) {
        controller.frame();
        if (t - lastDiag > 400) {
          setReadouts(controller.diagnostics());
          setStepCount(controller.step);
          lastDiag = t;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const onReset = useCallback(() => {
    const def = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
    const controller = controllerRef.current;
    if (!controller) return;
    controller.loadScenario(def);
    controller.attachCanvas(canvasRef.current!);
    controller.substepsPerFrame = substeps;
    controller.paint();
    setStepCount(0);
    setReadouts(controller.diagnostics());
  }, [scenarioId, substeps]);

  const onStep = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    controller.singleStep();
    setReadouts(controller.diagnostics());
    setStepCount(controller.step);
  }, []);

  const activeDef = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];

  return (
    <div className="app">
      <header>
        <h1>LunarLeaf-CFD · Milestone 1 solver bench</h1>
        <p className="sub">
          Real 2D D2Q9 Lattice-Boltzmann engine with textbook validation gates. Physics is
          solved, not faked — this is the trustworthy core the leaf/rosette/canopy tools build on.
        </p>
      </header>

      <div className="layout">
        <section className="viewport">
          <canvas ref={canvasRef} />
          <p className="mode">
            {activeDef.label} · {controllerRef.current?.label ?? ''} ·{' '}
            {activeDef.id === 'cylinder' ? 'vorticity field' : 'speed field'} · step{' '}
            {stepCount.toLocaleString()}
          </p>
        </section>

        <aside className="panel">
          <div className="group">
            <label htmlFor="scenario">Scenario</label>
            <select
              id="scenario"
              value={scenarioId}
              onChange={(e) => {
                setRunning(false);
                setScenarioId(e.target.value);
              }}
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="desc">{activeDef.description}</p>
          </div>

          <div className="group controls">
            <button className={running ? 'stop' : 'go'} onClick={() => setRunning((r) => !r)}>
              {running ? 'Pause' : 'Run'}
            </button>
            <button onClick={onStep} disabled={running}>
              Step
            </button>
            <button onClick={onReset}>Reset</button>
          </div>

          <div className="group">
            <label htmlFor="substeps">Substeps / frame: {substeps}</label>
            <input
              id="substeps"
              type="range"
              min={1}
              max={40}
              value={substeps}
              onChange={(e) => setSubsteps(Number(e.target.value))}
            />
          </div>

          <div className="group">
            <h2>Diagnostics & gates</h2>
            <table className="readouts">
              <tbody>
                {readouts.map((r) => (
                  <tr key={r.label} className={r.status ?? ''}>
                    <td>{r.label}</td>
                    <td className="val">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="foot">
            Next: buoyancy (gravity vector) + species advection–diffusion, then the leaf /
            rosette / microgreen presets. See <code>docs/ARCHITECTURE_AND_PLAN.md</code>.
          </p>
        </aside>
      </div>
    </div>
  );
}
