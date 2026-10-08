// Real flight-dish cross-sections for the 2-D slice, shared by dish_hardware.ts (T19)
// and dish_feedback.ts (T20).
//
// Dimensions supplied by R. Barker (2026-10-08):
//   BRIC  60 mm round dish (packed without lid): base O.D. 54.8–55.6 mm, height 13–15 mm,
//         agar 10–15 mL.
//   CARA  120 × 120 mm square dish: inner edge 120 mm, height 15–17 mm, agar 70–80 mL.
// Assumptions added here (TODO: confirm): 1.0 mm wall and base thickness; agar depth =
// volume / interior floor area; headspace = (height − base) − agar depth.

export const DX = 0.288; // mm per cell (T3)
export const WALL = 1.0; // mm, assumed wall and base thickness (TODO: confirm)
export const GAP_MM = 1.0; // leaf blade 1 mm above the agar surface

export interface Dish { name: string; widthMm: number; floorCm2: number; heightMm: number; agarMl: number }
export const cells = (mm: number) => Math.round(mm / DX);

export function dishGeom(d: Dish) {
  const agarMm = (d.agarMl / d.floorCm2) * 10; // mL / cm² -> cm -> mm
  const headMm = d.heightMm - WALL - agarMm;
  const agarCells = cells(agarMm);
  const headCells = cells(headMm);
  return { agarMm, headMm, nx: cells(d.widthMm) + 2, ny: agarCells + headCells + 2, agarCells, headCells };
}

const bricW = (54.8 + 55.6) / 2 - 2 * WALL;
const bricFloor = Math.PI * (bricW / 20) ** 2;
export const DISHES: Record<string, Dish> = {
  'BRIC-mid': { name: 'BRIC 60 mm', widthMm: bricW, floorCm2: bricFloor, heightMm: 14, agarMl: 12.5 },
  'BRIC-min': { name: 'BRIC 60 mm', widthMm: bricW, floorCm2: bricFloor, heightMm: 13, agarMl: 15 },
  'BRIC-max': { name: 'BRIC 60 mm', widthMm: bricW, floorCm2: bricFloor, heightMm: 15, agarMl: 10 },
  'CARA-mid': { name: 'CARA 120 mm sq', widthMm: 120, floorCm2: 144, heightMm: 16, agarMl: 75 },
  'CARA-min': { name: 'CARA 120 mm sq', widthMm: 120, floorCm2: 144, heightMm: 15, agarMl: 80 },
  'CARA-max': { name: 'CARA 120 mm sq', widthMm: 120, floorCm2: 144, heightMm: 17, agarMl: 70 },
};
