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

// Hypothetical ward centers. Each plan assigns whole historical housing blocks;
// their shared street corridors, not a square grid, form the visible boundaries.
export const CLUSTER_MODES = Object.freeze({
  points: { name: "Mapped buildings" },
  wardA: { name: "Plan A · six wards", seeds: [
    [529240, 181040], [529320, 181220], [529390, 181040],
    [529530, 181195], [529550, 181010], [529420, 180870],
  ] },
  wardB: { name: "Plan B · six wards", seeds: [
    [529230, 180990], [529355, 181190], [529450, 181065],
    [529610, 181140], [529555, 180945], [529345, 180925],
  ] },
  wardC: { name: "Plan C · five wards", seeds: [
    [529220, 181040], [529350, 181210], [529445, 181065],
    [529570, 181165], [529485, 180915],
  ] },
  wardD: { name: "Plan D · seven wards", seeds: [
    [529225, 181050], [529315, 181225], [529410, 181070],
    [529495, 181245], [529610, 181120], [529535, 180950],
    [529325, 180925],
  ] },
});

export function wardFor(block, mode) {
  const seeds = CLUSTER_MODES[mode]?.seeds;
  if (!seeds) return null;
  let best = 0, distance = Infinity;
  seeds.forEach(([x, y], index) => {
    const d = (block.x - x) ** 2 + (block.y - y) ** 2;
    if (d < distance) { best = index; distance = d; }
  });
  return best;
}

export function aggregationFor(mode) {
  const seeds = CLUSTER_MODES[mode]?.seeds;
  if (!seeds) return [];
  const zones = seeds.map((_, id) => ({
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
