import { projectMetric } from "./projection-model.js";

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function wrapLongitude(longitude) {
  return ((longitude + 180) % 360 + 360) % 360 - 180;
}

// Rotate the actual spherical landmass. Adding a latitude to each vertex
// would change its ground area before the map projection even begins.
export function shiftContinentPoint(longitude, latitude, sourceCenter,
  targetCenter) {
  const relativeLongitude = (longitude - sourceCenter[0]) * DEG;
  const phi = latitude * DEG;
  const x = Math.cos(phi) * Math.sin(relativeLongitude);
  const y = Math.sin(phi);
  const z = Math.cos(phi) * Math.cos(relativeLongitude);
  const rotation = (sourceCenter[1] - targetCenter[1]) * DEG;
  const movedY = y * Math.cos(rotation) - z * Math.sin(rotation);
  const movedZ = y * Math.sin(rotation) + z * Math.cos(rotation);
  return [wrapLongitude(targetCenter[0] + Math.atan2(x, movedZ) * RAD),
    Math.asin(Math.max(-1, Math.min(1, movedY))) * RAD];
}

export function shiftedContinentRings(continent, targetCenter) {
  return continent.rings.map((ring) => ring.map(([lon, lat]) =>
    shiftContinentPoint(lon, lat, continent.center, targetCenter)));
}

const latitudeBoundsCache = new WeakMap();

function latitudeBounds(continent, projection) {
  let byProjection = latitudeBoundsCache.get(continent);
  if (!byProjection) {
    byProjection = new Map();
    latitudeBoundsCache.set(continent, byProjection);
  }
  if (byProjection.has(projection)) return byProjection.get(projection);
  const sourceLatitude = continent.center[1];
  const cap = projection === "mercator" ? 83 : 88;
  const valid = (latitude) => shiftedContinentRings(continent,
    [continent.center[0], latitude]).every((ring) =>
    ring.every((point) => Math.abs(point[1]) <= cap));
  if (!valid(sourceLatitude)) {
    const bounds = [sourceLatitude, sourceLatitude];
    byProjection.set(projection, bounds);
    return bounds;
  }
  const boundary = (end) => {
    const step = Math.sign(end - sourceLatitude) * 2;
    let allowed = sourceLatitude;
    while (Math.abs(end - allowed) > 0.001) {
      const next = Math.abs(end - allowed) < Math.abs(step)
        ? end : allowed + step;
      if (!valid(next)) {
        let blocked = next;
        for (let i = 0; i < 14; i++) {
          const middle = (allowed + blocked) / 2;
          if (valid(middle)) allowed = middle;
          else blocked = middle;
        }
        return allowed;
      }
      allowed = next;
    }
    return end;
  };
  const bounds = [boundary(-cap), boundary(cap)];
  byProjection.set(projection, bounds);
  return bounds;
}

export function clampContinentLatitude(continent, requestedLatitude,
  projection) {
  const [minimum, maximum] = latitudeBounds(continent, projection);
  return Math.max(minimum, Math.min(maximum, requestedLatitude));
}

export function projectedContinentRings(continent, targetCenter, projection,
  standardParallel = 0) {
  const [targetLongitude, targetLatitude] = targetCenter;
  const referenceY = projectMetric(0, targetLatitude,
    projection, standardParallel).y;
  const xFactor = projection === "equalArea"
    ? Math.cos(standardParallel * DEG) : 1;
  return shiftedContinentRings(continent, targetCenter).map((ring) => {
    let previous = null;
    return ring.map(([lon, lat]) => {
      let relative = wrapLongitude(lon - targetLongitude);
      if (previous !== null) {
        while (relative - previous > 180) relative -= 360;
        while (relative - previous < -180) relative += 360;
      }
      previous = relative;
      return [relative * DEG * xFactor,
        projectMetric(0, lat, projection, standardParallel).y - referenceY];
    });
  });
}

export function projectedFootprintArea(rings) {
  return rings.reduce((total, ring) => {
    if (ring.length < 3) return total;
    let twiceArea = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      twiceArea += a[0] * b[1] - b[0] * a[1];
    }
    return total + Math.abs(twiceArea) / 2;
  }, 0);
}
