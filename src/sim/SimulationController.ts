import { ScenarioDef, ScenarioInstance, Readout } from '../scenarios/scenarios';
import { FieldRenderer } from '../render/FieldRenderer';

/**
 * Owns the active scenario, advances the solver a configurable number of
 * substeps per animation frame, renders the field, and surfaces diagnostics.
 * Framework-agnostic: a React component drives it via requestAnimationFrame.
 */
export class SimulationController {
  private instance: ScenarioInstance;
  private renderer: FieldRenderer;
  private ctx: CanvasRenderingContext2D | null = null;
  step = 0;
  running = false;
  substepsPerFrame = 10;

  constructor(def: ScenarioDef) {
    this.instance = def.build();
    this.renderer = new FieldRenderer(this.instance.fluid.nx, this.instance.fluid.ny);
  }

  attachCanvas(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
  }

  loadScenario(def: ScenarioDef): void {
    this.instance = def.build();
    this.renderer = new FieldRenderer(this.instance.fluid.nx, this.instance.fluid.ny);
    this.step = 0;
  }

  get gridSize(): { nx: number; ny: number } {
    return { nx: this.instance.fluid.nx, ny: this.instance.fluid.ny };
  }

  get label(): string {
    return this.instance.label;
  }

  /** Advance one solver timestep (collide+stream, BCs, probes). */
  private advance(): void {
    this.instance.fluid.collideAndStream();
    this.instance.postStream();
    this.instance.onAfterStep(this.step);
    this.step++;
  }

  /** Advance `substepsPerFrame` steps and repaint. Called once per RAF tick. */
  frame(): void {
    if (this.running) {
      for (let s = 0; s < this.substepsPerFrame; s++) this.advance();
    }
    this.paint();
  }

  /** Single manual step (when paused). */
  singleStep(): void {
    this.advance();
    this.paint();
  }

  paint(): void {
    if (!this.ctx) return;
    this.instance.fluid.computeMacroscopic();
    this.renderer.render(this.ctx, this.instance);
  }

  diagnostics(): Readout[] {
    return this.instance.diagnostics(this.step);
  }
}
