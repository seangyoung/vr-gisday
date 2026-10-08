// Synthetic elevation surface, in arbitrary model units. D8 steepest descent:
// diagonal neighbors use their longer horizontal distance when comparing slopes.
export const SIZE = 41;
export const SPACING = 2 / (SIZE - 1);
export function elevation(x, z) {
  return (
    0.1 +
    0.2 * (1 - z) +
    0.28 * Math.exp(-((x / 0.22) ** 2)) +
    0.2 * (Math.abs(x) - 0.65) ** 2
  );
}
export function cellAt(x, z, size = SIZE) {
  const spacing = 2 / (size - 1);
  const col = Math.max(0, Math.min(size - 1, Math.round((x + 1) / spacing)));
  const row = Math.max(0, Math.min(size - 1, Math.round((z + 1) / spacing)));
  return row * size + col;
}
export function cellPoint(
  id,
  heights,
  size = heights ? Math.sqrt(heights.length) : SIZE,
) {
  const spacing = 2 / (size - 1);
  const x = (id % size) * spacing - 1,
    z = Math.floor(id / size) * spacing - 1;
  return { x, y: heights ? heights[id] : elevation(x, z), z };
}
export function downstream(id, heights) {
  const size = heights ? Math.sqrt(heights.length) : SIZE,
    spacing = 2 / (size - 1);
  const p = cellPoint(id, heights),
    row = Math.floor(id / size),
    col = id % size;
  let best = id,
    bestSlope = 1e-9;
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (
        (!dr && !dc) ||
        row + dr < 0 ||
        row + dr >= size ||
        col + dc < 0 ||
        col + dc >= size
      )
        continue;
      const n = (row + dr) * size + col + dc;
      const slope =
        (p.y - cellPoint(n, heights).y) / (spacing * Math.hypot(dr, dc));
      if (slope > bestSlope) {
        best = n;
        bestSlope = slope;
      }
    }
  return best;
}
export const OUTLET_A = cellAt(-0.65, 1),
  OUTLET_B = cellAt(0.65, 1);
export function routeFrom(id, heights) {
  const ids = [id];
  for (let i = 0; i < (heights?.length ?? SIZE * SIZE); i++) {
    const next = downstream(ids.at(-1), heights);
    if (next === ids.at(-1)) return ids;
    ids.push(next);
  }
  throw new Error("Terrain drainage cycle");
}
export function outletFor(id, heights) {
  const last = routeFrom(id, heights).at(-1);
  if (last === OUTLET_A) return "A";
  if (last === OUTLET_B) return "B";
  return "sink";
}
export const CHALLENGE = cellAt(0.15, -0.25);

// Outer rim stays anchored so the slab walls and outlet mouths remain joined.
export function createHeights() {
  return Float64Array.from({ length: SIZE * SIZE }, (_, id) => cellPoint(id).y);
}
export function sculpt(heights, x, z, delta, radius = 0.24) {
  const size = Math.sqrt(heights.length);
  if (![x, z, delta, radius].every(Number.isFinite) || radius <= 0) return;
  for (let row = 1; row < size - 1; row++) {
    for (let col = 1; col < size - 1; col++) {
      const id = row * size + col;
      const p = cellPoint(id, heights);
      const distance = Math.hypot(p.x - x, p.z - z) / radius;
      if (distance >= 1) continue;
      const weight = (1 - distance * distance) ** 2;
      heights[id] = Math.max(
        0.015,
        Math.min(1.05, heights[id] + delta * weight),
      );
    }
  }
}
