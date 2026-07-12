/**
 * Strouhal-number estimator for the flow-past-cylinder benchmark (validation
 * gate 2). It records the transverse velocity uy at a probe point in the wake
 * and estimates the vortex-shedding frequency from the mean interval between
 * upward zero-crossings, after a transient window is discarded.
 *
 *   St = f · D / U
 *
 * For a circular cylinder at Re ≈ 100 the accepted value is St ≈ 0.164–0.17.
 */
export class StrouhalProbe {
  private readonly samples: number[] = [];
  private readonly crossings: number[] = [];
  private prev = 0;
  private step = 0;
  private readonly warmup: number;

  constructor(warmupSteps = 2000) {
    this.warmup = warmupSteps;
  }

  /** Feed the current transverse velocity at the probe each timestep. */
  record(uy: number): void {
    this.step++;
    if (this.step < this.warmup) {
      this.prev = uy;
      return;
    }
    this.samples.push(uy);
    // upward zero-crossing
    if (this.prev < 0 && uy >= 0) this.crossings.push(this.step);
    this.prev = uy;
  }

  /** Estimated shedding period (steps), or null if not enough cycles yet. */
  period(): number | null {
    if (this.crossings.length < 3) return null;
    let sum = 0;
    for (let i = 1; i < this.crossings.length; i++) {
      sum += this.crossings[i] - this.crossings[i - 1];
    }
    return sum / (this.crossings.length - 1);
  }

  /** Strouhal number St = f D / U = D / (period · U), or null if not ready. */
  strouhal(diameter: number, u: number): number | null {
    const T = this.period();
    if (!T) return null;
    return diameter / (T * u);
  }

  cycles(): number {
    return Math.max(0, this.crossings.length - 1);
  }

  reset(): void {
    this.samples.length = 0;
    this.crossings.length = 0;
    this.prev = 0;
    this.step = 0;
  }
}
