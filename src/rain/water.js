import { SIZE, SPACING } from "./terrain.js";

// Conservative, fixed-step surface-head relaxation, not shallow-water dynamics.
// Each cell stores depth; paired transfers conserve volume. Open rim drains away.
export class SurfaceWater {
  constructor(heights, size = SIZE, spacing = SPACING) {
    this.heights = heights;
    this.size = size;
    this.area = spacing * spacing;
    this.depth = new Float64Array(heights.length);
    this.outgoing = new Float64Array(heights.length);
    this.change = new Float64Array(heights.length);
    this.edges = [];
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) {
        const a = r * size + c;
        for (const [dr, dc] of [
          [0, 1],
          [1, -1],
          [1, 0],
          [1, 1],
        ]) {
          if (r + dr >= size || c + dc < 0 || c + dc >= size) continue;
          this.edges.push([a, (r + dr) * size + c + dc, Math.hypot(dr, dc)]);
        }
      }
    this.flux = new Float64Array(this.edges.length);
    this.bestSlope = new Float64Array(heights.length);
    this.bestEdge = new Int32Array(heights.length);
    this.clear();
  }
  clear() {
    this.depth.fill(0);
    this.drained = 0;
    this.added = 0;
    this.clock = 0;
  }
  add(id, volume) {
    if (
      !Number.isInteger(id) ||
      id < 0 ||
      id >= this.depth.length ||
      !Number.isFinite(volume) ||
      volume <= 0
    )
      return;
    this.depth[id] += volume / this.area;
    this.added += volume;
  }
  get stored() {
    return this.depth.reduce((a, b) => a + b, 0) * this.area;
  }
  update(dt) {
    this.clock += Math.max(0, Math.min(dt, 0.1));
    while (this.clock + 1e-10 >= 0.02) {
      this.step();
      this.clock -= 0.02;
    }
  }
  step() {
    const d = this.depth,
      h = this.heights;
    this.bestSlope.fill(0);
    this.bestEdge.fill(-1);
    this.outgoing.fill(0);
    this.change.fill(0);
    this.edges.forEach(([a, b, distance], i) => {
      const difference = h[a] + d[a] - h[b] - d[b];
      const from = difference > 0 ? a : b;
      if (
        this.preferSteep &&
        Math.abs(difference) / distance > this.bestSlope[from]
      ) {
        this.bestSlope[from] = Math.abs(difference) / distance;
        this.bestEdge[from] = i;
      }
      // Never move dry ground, or extract more water than a source contains.
      const amount = Math.min(
        d[from],
        this.preferSteep
          ? 0.45 * Math.abs(difference)
          : (Math.abs(difference) * 0.18) / distance,
      );
      this.flux[i] = difference > 0 ? amount : -amount;
      this.outgoing[from] += amount;
    });
    if (this.preferSteep) {
      this.outgoing.fill(0);
      this.edges.forEach(([a, b], i) => {
        const from = this.flux[i] > 0 ? a : b;
        if (this.bestEdge[from] !== i) this.flux[i] = 0;
        this.outgoing[from] += Math.abs(this.flux[i]);
      });
    }
    this.edges.forEach(([a, b], i) => {
      const from = this.flux[i] > 0 ? a : b;
      const scale =
        this.outgoing[from] > d[from] ? d[from] / this.outgoing[from] : 1;
      const transfer = this.flux[i] * scale;
      this.flux[i] = transfer; // Retain actual limited flux for sediment transport.
      this.change[a] -= transfer;
      this.change[b] += transfer;
    });
    for (let i = 0; i < d.length; i++) {
      d[i] = Math.max(0, d[i] + this.change[i]);
      const r = Math.floor(i / this.size),
        c = i % this.size;
      if (r === 0 || c === 0 || r === this.size - 1 || c === this.size - 1) {
        this.drained += d[i] * this.area;
        d[i] = 0;
      }
    }
  }
}
