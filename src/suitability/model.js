// A schematic town, in kilometers from its center. Each home marker represents
// a small group of residents, not an actual address or population estimate.
export const BUFFER_KM = 0.45;

export const SITES = Object.freeze([
  { id: "A", name: "Hill Road", x: -0.55, z: 0.34 },
  { id: "B", name: "Riverside", x: 0.10, z: -0.12 },
  { id: "C", name: "East Meadow", x: 0.52, z: 0.46 },
]);

export const HOMES = Object.freeze([
  [-0.79, 0.67, 34], [-0.62, 0.58, 42], [-0.48, 0.47, 38],
  [-0.82, 0.27, 35], [-0.56, 0.19, 44], [-0.72, -0.03, 37],
  [-0.52, -0.23, 40], [-0.32, 0.27, 49], [-0.25, 0.07, 54],
  [-0.28, -0.16, 48], [-0.12, -0.38, 43], [-0.06, 0.30, 53],
  [0.02, 0.10, 58], [0.03, -0.18, 62], [0.18, 0.20, 55],
  [0.25, -0.30, 52], [0.35, -0.08, 46], [0.37, 0.34, 42],
  [0.52, -0.29, 37], [0.63, 0.20, 38], [0.76, 0.39, 40],
  [0.54, 0.65, 36], [0.82, 0.64, 34], [0.73, -0.14, 33],
]);

export const ROADS = Object.freeze([
  [[-1, -0.38], [1, -0.38]],
  [[-0.9, 0.75], [-0.55, 0.46], [-0.27, 0.20], [0.08, -0.38]],
  [[0.52, -0.38], [0.65, -0.05], [0.70, 0.74]],
]);

export const riverX = (z) => 0.15 + 0.085 * Math.sin(z * 4.2);
export const terrainHeight = (x, z) =>
  0.012 + 0.078 * Math.exp(-((x + 0.76) ** 2 + (z - 0.43) ** 2) / 0.18) +
  0.063 * Math.exp(-((x - 0.66) ** 2 + (z - 0.57) ** 2) / 0.26) -
  0.016 * Math.exp(-((x - riverX(z)) ** 2) / 0.018) +
  0.006 * Math.sin(9 * x + 2 * z) * Math.cos(7 * z);

export const inBuffer = (site, home) =>
  Math.hypot(site.x - home[0], site.z - home[1]) <= BUFFER_KM;

function segmentDistance(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1,
    ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}

export function roadDistance(site) {
  return Math.min(...ROADS.flatMap((road) => road.slice(1).map((end, i) =>
    segmentDistance(site.x, site.z, road[i], end))));
}

export function siteFacts(site) {
  const residents = HOMES.filter((home) => inBuffer(site, home))
    .reduce((sum, home) => sum + home[2], 0);
  return {
    residents,
    roadMeters: Math.round(roadDistance(site) * 1000),
    floodplain: Math.abs(site.x - riverX(site.z)) < 0.26,
  };
}

// The common 0–1 criterion scale and explicit weights are part of the lesson.
// All values here describe this hypothetical town; they are not a siting study.
export const PRIORITIES = Object.freeze({
  reach: { label: "Reach more homes", weights: { reach: 0.72, road: 0.20, safety: 0.08 } },
  safety: { label: "Avoid flood risk", weights: { reach: 0.30, road: 0.10, safety: 0.60 } },
});

export function scoreSites(priority) {
  const weights = PRIORITIES[priority]?.weights;
  if (!weights) throw new RangeError(`Unknown priority: ${priority}`);
  const facts = SITES.map(siteFacts);
  const maxReach = Math.max(...facts.map((fact) => fact.residents));
  const scores = SITES.map((site, i) => {
    const fact = facts[i];
    const criteria = {
      reach: fact.residents / maxReach,
      road: Math.max(0, 1 - fact.roadMeters / 350),
      safety: fact.floodplain ? 0 : 1,
    };
    return { site, ...fact, criteria, score: Math.round(100 * (
      weights.reach * criteria.reach +
      weights.road * criteria.road +
      weights.safety * criteria.safety)) };
  });
  const winner = scores.reduce((best, candidate) =>
    candidate.score > best.score ? candidate : best);
  return { scores, winner };
}
