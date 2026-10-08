import { SurfaceWater } from "./water.js";
import { SIZE, SPACING, cellPoint } from "./terrain.js";

export function createTray() {
  return Float64Array.from({ length: SIZE * SIZE }, (_, id) => {
    const { x, z } = cellPoint(id);
    // Tilt plus a broad cross-slope and deterministic roughness; no carved channels.
    return (
      0.24 +
      0.28 * (1 - z) +
      0.16 * x * x +
      0.006 * ((Math.sin(id * 12.9898) * 43758.5453) % 1)
    );
  });
}

// Educational erosion: carrying capacity grows with local flow and slope.
// Suspended sediment follows the same conservative transfers as water.
export class ErosionWater extends SurfaceWater {
  constructor(heights) {
    super(heights);
    this.preferSteep = true;
    this.initial = heights.slice();
    this.sediment = new Float64Array(heights.length);
    this.sedimentChange = new Float64Array(heights.length);
    this.before = new Float64Array(heights.length);
    this.flow = new Float64Array(heights.length);
    this.slope = new Float64Array(heights.length);
    this.exported = 0;
    this.eroded = 0;
    this.deposited = 0;
  }
  add(id, volume) {
    if (!Number.isInteger(id) || id < 0 || id >= this.depth.length) return;
    const row = Math.floor(id / SIZE),
      col = id % SIZE;
    const cells = [id];
    if (row > 0) cells.push(id - SIZE);
    if (row < SIZE - 1) cells.push(id + SIZE);
    if (col > 0) cells.push(id - 1);
    if (col < SIZE - 1) cells.push(id + 1);
    for (const cell of cells) super.add(cell, volume / cells.length);
  }
  step() {
    this.before.set(this.depth);
    super.step();
    this.sedimentChange.fill(0);
    this.flow.fill(0);
    this.slope.fill(0);
    this.edges.forEach(([a, b, distance], i) => {
      const amount = Math.abs(this.flux[i]);
      const from = this.flux[i] > 0 ? a : b,
        to = from === a ? b : a;
      const carried =
        this.before[from] > 0
          ? (this.sediment[from] * amount) / this.before[from]
          : 0;
      this.sedimentChange[from] -= carried;
      this.sedimentChange[to] += carried;
      this.flow[from] += amount;
      this.slope[from] = Math.max(
        this.slope[from],
        (this.heights[from] - this.heights[to]) / (SPACING * distance),
      );
    });
    for (let id = 0; id < this.heights.length; id++) {
      this.sediment[id] = Math.max(
        0,
        this.sediment[id] + this.sedimentChange[id],
      );
      const row = Math.floor(id / SIZE),
        col = id % SIZE;
      if (row === 0 || col === 0 || row === SIZE - 1 || col === SIZE - 1) {
        this.exported += this.sediment[id] * this.area;
        this.sediment[id] = 0;
        continue;
      }
      // Accelerated loose-sand response for a short exhibit. Use flow during
      // this step: fast runoff may already have emptied the cell.
      const capacity = this.flow[id] * Math.min(2, this.slope[id]) * 10;
      const difference = capacity - this.sediment[id];
      if (difference > 0 && this.flow[id] > 0.00001) {
        const removed = Math.min(
          difference * 0.18,
          0.0015,
          Math.max(0, this.heights[id] - (this.initial[id] - 0.24)),
        );
        this.heights[id] -= removed;
        this.sediment[id] += removed;
        this.eroded += removed * this.area;
      } else {
        const settled =
          this.depth[id] < 0.00001
            ? this.sediment[id]
            : Math.min(this.sediment[id], Math.max(0, -difference * 0.1));
        this.heights[id] += settled;
        this.sediment[id] -= settled;
        this.deposited += settled * this.area;
      }
    }
  }
  get suspended() {
    return this.sediment.reduce((a, b) => a + b, 0) * this.area;
  }
}
