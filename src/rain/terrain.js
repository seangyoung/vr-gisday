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
export function cellAt(x, z) {
  const col = Math.max(0, Math.min(SIZE - 1, Math.round((x + 1) / SPACING)));
  const row = Math.max(0, Math.min(SIZE - 1, Math.round((z + 1) / SPACING)));
  return row * SIZE + col;
}
export function cellPoint(id) {
  const x = (id % SIZE) * SPACING - 1,
    z = Math.floor(id / SIZE) * SPACING - 1;
  return { x, y: elevation(x, z), z };
}
export function downstream(id) {
  const p = cellPoint(id),
    row = Math.floor(id / SIZE),
    col = id % SIZE;
  let best = id,
    bestSlope = 1e-9;
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (
        (!dr && !dc) ||
        row + dr < 0 ||
        row + dr >= SIZE ||
        col + dc < 0 ||
        col + dc >= SIZE
      )
        continue;
      const n = (row + dr) * SIZE + col + dc;
      const slope = (p.y - cellPoint(n).y) / (SPACING * Math.hypot(dr, dc));
      if (slope > bestSlope) {
        best = n;
        bestSlope = slope;
      }
    }
  return best;
}
export const OUTLET_A = cellAt(-0.65, 1),
  OUTLET_B = cellAt(0.65, 1);
export function routeFrom(id) {
  const ids = [id];
  for (let i = 0; i < SIZE * SIZE; i++) {
    const next = downstream(ids.at(-1));
    if (next === ids.at(-1)) return ids;
    ids.push(next);
  }
  throw new Error("Terrain drainage cycle");
}
export function outletFor(id) {
  const last = routeFrom(id).at(-1);
  if (last === OUTLET_A) return "A";
  if (last === OUTLET_B) return "B";
  throw new Error(`Unexpected terrain sink: ${last}`);
}
export const CHALLENGE = cellAt(0.15, -0.25);
