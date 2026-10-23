import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { blockAt, SNOW_BLOCKS } from "../src/showcase/cluster-model.js";

const insideRing = (x, y, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[j];
    if ((ay > y) !== (by > y) &&
        x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside;
};

function nearestOnRing(x, y, ring) {
  let closest = null, distance = Infinity;
  for (let i = 1; i < ring.length; i++) {
    const [ax, ay] = ring[i - 1], [bx, by] = ring[i];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1,
      ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const point = [ax + t * dx, ay + t * dy];
    const d = Math.hypot(x - point[0], y - point[1]);
    if (d < distance) { closest = point; distance = d; }
  }
  return { point: closest, distance };
}

const rounded = (value) => Math.round(value * 10) / 10;
const boundaries = [];
for (const block of SNOW_BLOCKS) {
  const ring = block.rings[0];
  for (let i = 0; i < ring.length - 1; i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[i + 1];
    const dx = bx - ax, dy = by - ay;
    const length = Math.hypot(dx, dy);
    if (length < 2) continue;
    let nx = -dy / length, ny = dx / length;
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    if (insideRing(mx + nx, my + ny, ring)) { nx = -nx; ny = -ny; }
    const pieces = Math.ceil(length / 12);
    for (let part = 0; part < pieces; part++) {
      const t0 = part / pieces, t1 = (part + 1) / pieces;
      const x = ax + dx * (t0 + t1) / 2, y = ay + dy * (t0 + t1) / 2;
      let neighbor = null;
      for (const distance of [6, 10, 14, 20, 26]) {
        const candidate = blockAt(x + nx * distance, y + ny * distance, 0);
        if (candidate && candidate.id !== block.id) {
          neighbor = candidate;
          break;
        }
      }
      if (!neighbor || block.id > neighbor.id) continue;
      const x0 = ax + dx * t0, y0 = ay + dy * t0;
      const x1 = ax + dx * t1, y1 = ay + dy * t1;
      const near0 = nearestOnRing(x0, y0, neighbor.rings[0]);
      const near1 = nearestOnRing(x1, y1, neighbor.rings[0]);
      if (near0.distance > 30 || near1.distance > 30) continue;
      boundaries.push([
        block.id, neighbor.id,
        rounded((x0 + near0.point[0]) / 2),
        rounded((y0 + near0.point[1]) / 2),
        rounded((x1 + near1.point[0]) / 2),
        rounded((y1 + near1.point[1]) / 2),
      ]);
    }
  }
}

const output = fileURLToPath(new URL("../src/showcase/data/snow-zone-boundaries.json", import.meta.url));
writeFileSync(output, `${JSON.stringify({ segments: boundaries })}\n`);
console.log(`Wrote ${boundaries.length} road-center boundary segments to ${output}`);
