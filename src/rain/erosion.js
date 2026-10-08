import { SurfaceWater } from "./water.js";
import { SIZE, cellPoint } from "./terrain.js";

export const EROSION_SIZE = 65;
export function createTray(size = SIZE) {
  return Float64Array.from({ length: size * size }, (_, id) => {
    const { x, z } = cellPoint(id, undefined, size);
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
    super(
      heights,
      Math.sqrt(heights.length),
      2 / (Math.sqrt(heights.length) - 1),
    );
    this.spacing = 2 / (this.size - 1);
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
    this.bankChange = new Float64Array(heights.length);
  }
  add(id, volume) {
    if (!Number.isInteger(id) || id < 0 || id >= this.depth.length) return;
    const row = Math.floor(id / this.size),
      col = id % this.size;
    const cells = [id];
    if (row > 0) cells.push(id - this.size);
    if (row < this.size - 1) cells.push(id + this.size);
    if (col > 0) cells.push(id - 1);
    if (col < this.size - 1) cells.push(id + 1);
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
        (this.heights[from] - this.heights[to]) / (this.spacing * distance),
      );
    });
    for (let id = 0; id < this.heights.length; id++) {
      this.sediment[id] = Math.max(
        0,
        this.sediment[id] + this.sedimentChange[id],
      );
      const row = Math.floor(id / this.size),
        col = id % this.size;
      if (
        row === 0 ||
        col === 0 ||
        row === this.size - 1 ||
        col === this.size - 1
      ) {
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
          Math.max(
            0,
            this.heights[id] - Math.max(0.015, this.initial[id] - 0.24),
          ),
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
    this.relaxBanks();
  }
  relaxBanks() {
    // Wet, over-steep banks slump into channels. Paired transfers preserve earth
    // volume and leave dry terrain and the anchored rim untouched.
    this.bankChange.fill(0);
    for (let r = 1; r < this.size - 2; r++)
      for (let c = 1; c < this.size - 2; c++) {
        const a = r * this.size + c;
        for (const b of [a + 1, a + this.size]) {
          if (
            this.depth[a] + this.depth[b] + this.flow[a] + this.flow[b] <
            0.0001
          )
            continue;
          const from = this.heights[a] > this.heights[b] ? a : b,
            to = from === a ? b : a;
          const excess =
            this.heights[from] - this.heights[to] - this.spacing * 1.2;
          if (excess <= 0) continue;
          const amount = Math.min(
            excess * 0.035,
            Math.max(
              0,
              this.heights[from] +
                this.bankChange[from] -
                Math.max(0.015, this.initial[from] - 0.24),
            ),
          );
          this.bankChange[from] -= amount;
          this.bankChange[to] += amount;
          this.eroded += amount * this.area;
          this.deposited += amount * this.area;
        }
      }
    for (let i = 0; i < this.heights.length; i++)
      this.heights[i] += this.bankChange[i];
  }
  get suspended() {
    return this.sediment.reduce((a, b) => a + b, 0) * this.area;
  }
}
