import { geoProject } from "d3-geo-projection";
import { createD3Projection, projectMetric } from "./projection-model.js";

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
  // A continent may already cross the display's polar limit at home
  // (Greenland in Mercator, or Antarctica at the pole). Search the entire
  // movable range instead of assuming its home latitude is valid.
  const samples = [];
  for (let latitude = -cap; latitude <= cap; latitude += 2)
    samples.push(latitude);
  if (samples.at(-1) !== cap) samples.push(cap);
  if (valid(sourceLatitude) && !samples.includes(sourceLatitude))
    samples.push(sourceLatitude);
  samples.sort((a, b) => a - b);
  const allowed = samples.map(valid);
  // A very large landmass can have more than one valid interval after it
  // crosses a pole. Keep the interval nearest its original position.
  let anchor = -1;
  for (let i = 0; i < samples.length; i++)
    if (allowed[i] && (anchor < 0 || Math.abs(samples[i] - sourceLatitude) <
        Math.abs(samples[anchor] - sourceLatitude))) anchor = i;
  if (anchor < 0) {
    const bounds = [sourceLatitude, sourceLatitude];
    byProjection.set(projection, bounds);
    return bounds;
  }
  let first = anchor, last = anchor;
  while (first > 0 && allowed[first - 1]) first--;
  while (last < samples.length - 1 && allowed[last + 1]) last++;
  const refine = (allowed, blocked) => {
    for (let i = 0; i < 14; i++) {
      const middle = (allowed + blocked) / 2;
      if (valid(middle)) allowed = middle;
      else blocked = middle;
    }
    return allowed;
  };
  const bounds = [first === 0 ? -cap : refine(samples[first], samples[first - 1]),
    last === samples.length - 1 ? cap : refine(samples[last], samples[last + 1])];
  byProjection.set(projection, bounds);
  return bounds;
}

export function clampContinentLatitude(continent, requestedLatitude,
  projection) {
  const [minimum, maximum] = latitudeBounds(continent, projection);
  return Math.max(minimum, Math.min(maximum, requestedLatitude));
}

export function projectedContinentRings(continent, targetCenter, projection,
  standardParallel = 0, centralMeridian = 0) {
  const [targetLongitude, targetLatitude] = targetCenter;
  const cylindrical = ["equirectangular", "mercator", "equalArea"]
    .includes(projection);
  const relativeCenter = wrapLongitude(targetLongitude - centralMeridian);
  const reference = projectMetric(cylindrical ? 0 : relativeCenter, targetLatitude,
    projection, standardParallel);
  if (!cylindrical) {
    // D3 streams polygon edges through antimeridian and interrupted-lobe
    // clipping. Projecting each vertex alone would join across those cuts.
    const geometry = { type: "MultiPolygon",
      coordinates: shiftedContinentRings(continent, targetCenter)
        .map((ring) => [[...ring, ring[0]]]) };
    const projected = geoProject(geometry,
      createD3Projection(projection, centralMeridian));
    return projected.coordinates.flatMap((polygon) => polygon.map((ring) =>
      ring.map(([x, y]) => [x - reference.x, -y - reference.y])));
  }
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
        projectMetric(0, lat, projection, standardParallel).y - reference.y];
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
