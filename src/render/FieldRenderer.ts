import { ScenarioInstance } from '../scenarios/scenarios';
import { viridis, diverging } from './colormaps';

/**
 * Rasterises a scenario's macroscopic field into an offscreen ImageData at native
 * grid resolution, then blits it (nearest-neighbour) to the display canvas. Solid
 * cells render as dark grey. Assumes `fluid.computeMacroscopic()` has been called.
 */
export class FieldRenderer {
  private offscreen: HTMLCanvasElement;
  private offctx: CanvasRenderingContext2D;
  private image: ImageData;
  private readonly nx: number;
  private readonly ny: number;

  constructor(nx: number, ny: number) {
    this.nx = nx;
    this.ny = ny;
    this.offscreen = document.createElement('canvas');
    this.offscreen.width = nx;
    this.offscreen.height = ny;
    const ctx = this.offscreen.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    this.offctx = ctx;
    this.image = this.offctx.createImageData(nx, ny);
  }

  render(target: CanvasRenderingContext2D, instance: ScenarioInstance): void {
    const { fluid, renderMode, renderScale } = instance;
    const data = this.image.data;
    const nx = this.nx;
    const ny = this.ny;

    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const c = fluid.index(x, y);
        // Flip y so +y points up on screen.
        const px = (x + (ny - 1 - y) * nx) * 4;

        if (fluid.solid[c]) {
          data[px] = 40;
          data[px + 1] = 44;
          data[px + 2] = 52;
          data[px + 3] = 255;
          continue;
        }

        let rgb: [number, number, number];
        if (renderMode === 'vorticity') {
          const w = fluid.vorticity(x, y) / renderScale;
          rgb = diverging(w);
        } else {
          const s = fluid.speed(c) / renderScale;
          rgb = viridis(s);
        }
        data[px] = rgb[0];
        data[px + 1] = rgb[1];
        data[px + 2] = rgb[2];
        data[px + 3] = 255;
      }
    }

    this.offctx.putImageData(this.image, 0, 0);
    target.imageSmoothingEnabled = false;
    target.clearRect(0, 0, target.canvas.width, target.canvas.height);
    target.drawImage(this.offscreen, 0, 0, target.canvas.width, target.canvas.height);
  }
}
