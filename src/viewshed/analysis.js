import { LANDSCAPE_EXTENT, landscapeHeight } from "../layers/experience.js";

export class TerrainSampler {
  constructor(extent = LANDSCAPE_EXTENT, segments = 256, heightAt = landscapeHeight) {
    this.extent = extent;
    this.segments = segments;
    this.spacing = (2 * extent) / segments;
    this.heights = new Float32Array((segments + 1) ** 2);
    for (let row = 0; row <= segments; row++)
      for (let col = 0; col <= segments; col++) {
        const x = -extent + col * this.spacing;
        const z = -extent + row * this.spacing;
        this.heights[row * (segments + 1) + col] = heightAt(x, z);
      }
  }
  sample(x, z) {
    const col = Math.max(0, Math.min(this.segments - 0.000001, (x + this.extent) / this.spacing));
    const row = Math.max(0, Math.min(this.segments - 0.000001, (z + this.extent) / this.spacing));
    const c = Math.floor(col), r = Math.floor(row);
    const u = col - c, v = row - r, width = this.segments + 1;
    const a = this.heights[r * width + c];
    const b = this.heights[r * width + c + 1];
    const d = this.heights[(r + 1) * width + c];
    const e = this.heights[(r + 1) * width + c + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (d * (1 - u) + e * u) * v;
  }
}

export function lineOfSight(heightAt, observer, target, sampleStep = 2.2) {
  const dx = target.x - observer.x, dz = target.z - observer.z;
  const distance = Math.hypot(dx, dz);
  if (distance < sampleStep) return true;
  const eye = heightAt(observer.x, observer.z) + observer.height;
  const targetY = heightAt(target.x, target.z) + 0.12;
  const count = Math.ceil(distance / sampleStep);
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const ground = heightAt(observer.x + dx * t, observer.z + dz * t);
    if (ground > eye + (targetY - eye) * t + 0.025) return false;
  }
  return true;
}

export function calculateViewshed(
  heightAt,
  observer,
  { extent = LANDSCAPE_EXTENT, cells = 129, radius = 115, sampleStep = 2.2 } = {},
) {
  const values = new Uint8Array(cells * cells);
  const cellSize = (2 * extent) / cells;
  let visible = 0, sampled = 0;
  for (let row = 0; row < cells; row++)
    for (let col = 0; col < cells; col++) {
      const x = -extent + (col + 0.5) * cellSize;
      const z = -extent + (row + 0.5) * cellSize;
      if (Math.hypot(x - observer.x, z - observer.z) > radius) continue;
      sampled++;
      if (lineOfSight(heightAt, observer, { x, z }, sampleStep)) {
        values[row * cells + col] = 1;
        visible++;
      } else values[row * cells + col] = 2;
    }
  return { values, cells, extent, cellSize, radius, visible, sampled };
}
