import source from "./data/snow.json" with { type: "json" };
import blockSource from "./data/snow-blocks.json" with { type: "json" };

export const SNOW_BUILDINGS = source.buildings.map(([x, y, deaths]) => ({ x, y, deaths }));
export const SNOW_PUMPS = source.pumps.map(([x, y, name]) => ({ x, y, name }));
export const SNOW_BLOCKS = blockSource.blocks.map(([deaths, x, y, rings], id) =>
  ({ id, deaths, x, y, rings }));
export const SNOW_TOTAL = SNOW_BUILDINGS.reduce((sum, point) => sum + point.deaths, 0);
// One fixed British National Grid window keeps buildings, blocks, and pumps aligned.
export const SNOW_WINDOW = Object.freeze({
  minX: 529115, maxX: 529700, minY: 180770, maxY: 181350,
});

// Each entry assigns one source block (by id) to a hypothetical ward. These
// plans keep adjacent blocks together across the street corridors; they are
// teaching examples, not historical administrative boundaries. A keeps a
// compact concentration, B and C redraw six connected wards, and D uses four
// broader connected wards. Keeping the assignments fixed avoids runtime
// zoning calculations on the headset.
export const CLUSTER_MODES = Object.freeze({
  points: { name: "Mapped buildings", note: [
    "Each circle records deaths at a building.",
    "Compare these same deaths in Plans A–D.",
  ] },
  wardA: { name: "Plan A · six compact wards", count: 6, note: [
    "A compact ward gathers many deaths",
    "beside the Broad Street pump.",
  ], wards: [
    5, 5, 4, 4, 4, 4, 4, 4, 4, 4,
    4, 3, 3, 1, 3, 3, 2, 1, 2, 1,
    1, 1, 0, 4, 5, 5, 2, 5, 2, 2,
    3, 2, 5, 0, 5, 0, 0, 0, 0, 3,
  ] },
  wardB: { name: "Plan B · six diagonal wards", count: 6, note: [
      "Diagonal wards split high-count blocks",
      "among several zones.",
    ], wards: [
      4, 4, 0, 0, 0, 0, 0, 0, 0, 1,
      0, 1, 1, 1, 1, 1, 3, 3, 3, 1,
      1, 3, 2, 2, 5, 5, 3, 5, 3, 4,
      3, 3, 5, 4, 5, 5, 4, 2, 2, 2,
    ] },
  wardC: { name: "Plan C · six east–west wards", count: 6, note: [
      "The darkest ward appears north",
      "of the Broad Street pump.",
    ], wards: [
      4, 4, 1, 1, 1, 2, 1, 1, 2, 2,
      1, 2, 2, 5, 2, 2, 4, 5, 4, 5,
      5, 5, 0, 0, 3, 3, 5, 3, 5, 4,
      4, 5, 3, 0, 3, 3, 3, 0, 0, 0,
    ] },
  wardD: { name: "Plan D · four broad wards", count: 4, note: [
      "Four broad wards have similar totals",
      "across the same 489 recorded deaths.",
    ], wards: [
      3, 3, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 1, 2, 1, 1, 2, 2, 2, 2,
      2, 2, 1, 0, 3, 3, 2, 3, 2, 3,
      2, 2, 3, 1, 3, 3, 1, 1, 1, 1,
    ] },
});
const INTERIOR_BLOCK_IDS = new Set(SNOW_BLOCKS
  .filter((block) => blockAt(block.x, block.y, 0)?.id === block.id)
  .map((block) => block.id));

export function wardFor(block, mode) {
  return CLUSTER_MODES[mode]?.wards?.[block.id] ?? null;
}

export function aggregationFor(mode) {
  const count = CLUSTER_MODES[mode]?.count;
  if (!count) return [];
  const zones = Array.from({ length: count }, (_, id) => ({
    id, name: String.fromCharCode(65 + id), blocks: [], deaths: 0, x: 0, y: 0,
  }));
  for (const block of SNOW_BLOCKS) {
    const zone = zones[wardFor(block, mode)];
    zone.blocks.push(block);
    zone.deaths += block.deaths;
    zone.x += block.x;
    zone.y += block.y;
  }
  for (const zone of zones) {
    zone.x /= zone.blocks.length;
    zone.y /= zone.blocks.length;
    // The mean of a long or concave ward can land in another ward. Put its
    // letter over an actual block belonging to this ward instead.
    const candidates = zone.blocks.filter((block) =>
      INTERIOR_BLOCK_IDS.has(block.id));
    const labelBlock = (candidates.length ? candidates : zone.blocks)
      .reduce((best, block) => (block.x - zone.x) ** 2 +
        (block.y - zone.y) ** 2 < (best.x - zone.x) ** 2 +
        (best.y - zone.y) ** 2 ? block : best);
    zone.labelX = labelBlock.x;
    zone.labelY = labelBlock.y;
  }
  return zones;
}

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[j];
    if ((ay > y) !== (by > y) &&
        x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

function distanceToRing(x, y, ring) {
  let nearest = Infinity;
  for (let i = 1; i < ring.length; i++) {
    const [ax, ay] = ring[i - 1], [bx, by] = ring[i];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1,
      ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    nearest = Math.min(nearest, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return nearest;
}

export function blockAt(x, y, roadTolerance = 10) {
  let closest = null, distance = Infinity;
  for (const block of SNOW_BLOCKS) {
    const inside = block.rings.reduce((value, ring) => value !== inRing(x, y, ring), false);
    if (inside) return block;
    for (const ring of block.rings) {
      const d = distanceToRing(x, y, ring);
      if (d < distance) { distance = d; closest = block; }
    }
  }
  return distance <= roadTolerance ? closest : null;
}
