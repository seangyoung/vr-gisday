import {
  geoBonne, geoInterruptedHomolosine, geoMollweide, geoSinusoidal,
  geoWinkel3,
} from "d3-geo-projection";

export const PROJECTIONS = Object.freeze({
  equirectangular: "Plate Carrée",
  mercator: "Mercator",
  equalArea: "Cylindrical equal-area",
  sinusoidal: "Sinusoidal",
  bonne: "Bonne",
  mollweide: "Mollweide",
  goode: "Interrupted Goode Homolosine",
  winkel: "Winkel Tripel",
});

export const PROJECTION_GROUPS = Object.freeze({
  equirectangular: "equidistant grid",
  mercator: "conformal",
  equalArea: "equal-area",
  sinusoidal: "equal-area",
  bonne: "equal-area",
  mollweide: "equal-area",
  goode: "interrupted · equal-area",
  winkel: "compromise",
});

export const PROJECTION_NOTES = Object.freeze({
  equirectangular: "Straight grid; high latitudes widen",
  mercator: "Local angles stay true; polar areas grow",
  equalArea: "Relative land area stays true; shapes flatten",
  sinusoidal: "Area stays true; meridians curve toward the poles",
  bonne: "Area stays true; parallels bend around 45° N",
  mollweide: "An equal-area ellipse for the full world",
  goode: "Ocean cuts separate lobes while land area stays true",
  winkel: "A compromise that balances several distortions",
});

export const isEqualAreaProjection = (projection) =>
  ["equalArea", "sinusoidal", "bonne", "mollweide", "goode"]
    .includes(projection);

// The two edge entries are one meridian shown on both sides of the texture;
// together they complete the sixth circle column across the Pacific seam.
export const TISSOT_LONGITUDES = Object.freeze([-180, -120, -60, 0, 60, 120, 180]);
export const TISSOT_LATITUDES = Object.freeze([-60, -30, 0, 30, 60]);

export function nearestTissotCircle(longitude, latitude) {
  let nearest = null;
  let best = Infinity;
  for (const lat of TISSOT_LATITUDES)
    for (const lon of TISSOT_LONGITUDES.slice(0, -1)) {
      const delta = Math.atan2(Math.sin((longitude - lon) * Math.PI / 180),
        Math.cos((longitude - lon) * Math.PI / 180));
      const phi = latitude * Math.PI / 180;
      const phi0 = lat * Math.PI / 180;
      const haversine = Math.sin((phi - phi0) / 2) ** 2 +
        Math.cos(phi) * Math.cos(phi0) * Math.sin(delta / 2) ** 2;
      const distance = 2 * Math.asin(Math.min(1, Math.sqrt(haversine)));
      if (distance < best) {
        best = distance;
        nearest = { longitude: lon, latitude: lat };
      }
    }
  return best <= 9 * Math.PI / 180 ? nearest : null;
}

const deg = Math.PI / 180;
const mercatorY = (latitude) => Math.log(Math.tan(Math.PI / 4 + latitude / 2));
const mercatorLimit = mercatorY(85 * deg);
const d3Projections = {
  sinusoidal: geoSinusoidal,
  bonne: geoBonne,
  mollweide: geoMollweide,
  goode: geoInterruptedHomolosine,
  winkel: geoWinkel3,
};
const d3Cache = new Map();
const extentCache = new Map();

function d3Projection(name) {
  if (!d3Cache.has(name)) d3Cache.set(name, createD3Projection(name));
  return d3Cache.get(name);
}

export function createD3Projection(name, centralMeridian = 0) {
  if (!d3Projections[name]) throw new RangeError(`Unknown D3 projection: ${name}`);
  return d3Projections[name]().scale(1).translate([0, 0]).center([0, 0])
    .rotate([-centralMeridian, 0]);
}

export function projectionExtent(projection, standardParallel = 0) {
  const key = `${projection}:${standardParallel}`;
  if (extentCache.has(key)) return extentCache.get(key);
  let maxX = 0, maxY = 0;
  if (d3Projections[projection]) {
    for (let latitude = -90; latitude <= 90; latitude += 2)
      for (let longitude = -180; longitude <= 180; longitude += 2) {
        const point = projectMetric(longitude, latitude, projection, standardParallel);
        if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
          maxX = Math.max(maxX, Math.abs(point.x));
          maxY = Math.max(maxY, Math.abs(point.y));
        }
      }
  } else {
    const cosine = Math.cos(standardParallel * deg);
    maxX = Math.PI * (projection === "equalArea" ? cosine : 1);
    maxY = projection === "mercator" ? mercatorLimit :
      projection === "equalArea" ? 1 / cosine : Math.PI / 2;
  }
  const extent = { maxX, maxY };
  extentCache.set(key, extent);
  return extent;
}

// The display mesh must use one scale on both axes. Stretching every
// projection into the same rectangle would add false shape distortion.
export function projectMetric(longitudeDegrees, latitudeDegrees,
  projection = "equirectangular", standardParallel = 0) {
  if (d3Projections[projection]) {
    const [x, y] = d3Projection(projection)([
      Math.max(-180, Math.min(180, longitudeDegrees)),
      Math.max(-90, Math.min(90, latitudeDegrees)),
    ]);
    return { x, y: -y };
  }
  const point = projectNormalized(longitudeDegrees, latitudeDegrees,
    projection, standardParallel);
  return {
    x: point.x * Math.PI,
    y: point.y * (projection === "mercator" ? mercatorLimit :
      projection === "equalArea" ? 1 : Math.PI / 2),
  };
}

export function projectionFitScale(projection = "equirectangular",
  standardParallel = 0) {
  const { maxX, maxY } = projectionExtent(projection, standardParallel);
  return Math.min(0.86 / maxX, 0.53 / maxY);
}

function localJacobian(projection, latitudeDegrees, standardParallel = 0,
  longitudeDegrees = 0) {
  const step = 0.001;
  const east = projectMetric(longitudeDegrees + step, latitudeDegrees,
    projection, standardParallel);
  const west = projectMetric(longitudeDegrees - step, latitudeDegrees,
    projection, standardParallel);
  const north = projectMetric(longitudeDegrees, latitudeDegrees + step,
    projection, standardParallel);
  const south = projectMetric(longitudeDegrees, latitudeDegrees - step,
    projection, standardParallel);
  const factor = 2 * step * deg;
  const cosine = Math.max(0.01, Math.cos(latitudeDegrees * deg));
  return {
    east: [(east.x - west.x) / factor / cosine,
      (east.y - west.y) / factor / cosine],
    north: [(north.x - south.x) / factor,
      (north.y - south.y) / factor],
  };
}

function localAreaScale(projection, latitudeDegrees, standardParallel = 0,
  longitudeDegrees = 0) {
  const { east, north } = localJacobian(projection, latitudeDegrees,
    standardParallel, longitudeDegrees);
  return Math.abs(east[0] * north[1] - east[1] * north[0]);
}

// Local horizontal and vertical scale factors relative to the source globe.
export function indicatrixAxes(projection, latitudeDegrees,
  standardParallel = 0) {
  if (d3Projections[projection]) {
    const { east, north } = localJacobian(projection, latitudeDegrees,
      standardParallel);
    return { horizontal: Math.hypot(...east), vertical: Math.hypot(...north) };
  }
  const cosine = Math.cos(latitudeDegrees * deg);
  const standardCosine = Math.cos(standardParallel * deg);
  if (projection === "mercator")
    return { horizontal: 1 / cosine, vertical: 1 / cosine };
  if (projection === "equalArea")
    return { horizontal: standardCosine / cosine,
      vertical: cosine / standardCosine };
  return { horizontal: 1 / cosine, vertical: 1 };
}

// A Tissot circle starts as a small circle of fixed ground size. Its axis
// ratio describes local shape change; area is compared with the same circle
// at the equator, so the readout does not depend on display zoom.
export function tissotDistortion(projection, latitudeDegrees,
  standardParallel = 0, longitudeDegrees = 0) {
  if (d3Projections[projection]) {
    const { east, north } = localJacobian(projection, latitudeDegrees,
      standardParallel, longitudeDegrees);
    const a = east[0] ** 2 + east[1] ** 2;
    const b = north[0] ** 2 + north[1] ** 2;
    const cross = east[0] * north[0] + east[1] * north[1];
    const delta = Math.sqrt((a - b) ** 2 + 4 * cross ** 2);
    const major = Math.sqrt(Math.max(0, (a + b + delta) / 2));
    const minor = Math.sqrt(Math.max(1e-12, (a + b - delta) / 2));
    return { shapeRatio: major / minor,
      longerAxis: Math.abs(cross) > 0.1 ? "oblique" :
        a > b ? "east-west" : b > a ? "north-south" : null,
      relativeArea: relativeAreaScale(projection, latitudeDegrees,
        longitudeDegrees) };
  }
  const { horizontal, vertical } = indicatrixAxes(projection,
    latitudeDegrees, standardParallel);
  return {
    shapeRatio: Math.max(horizontal, vertical) / Math.min(horizontal, vertical),
    longerAxis: horizontal > vertical ? "east-west" : vertical > horizontal
      ? "north-south" : null,
    relativeArea: relativeAreaScale(projection, latitudeDegrees),
  };
}

// Coordinates are normalized for display; metric coordinates drive the mesh.
export function projectNormalized(longitudeDegrees, latitudeDegrees,
  projection = "equirectangular", standardParallel = 0) {
  if (d3Projections[projection]) {
    const { maxX, maxY } = projectionExtent(projection, standardParallel);
    const point = projectMetric(longitudeDegrees, latitudeDegrees,
      projection, standardParallel);
    return { x: point.x / maxX, y: point.y / maxY };
  }
  const lon = Math.max(-180, Math.min(180, longitudeDegrees)) * deg;
  const lat = Math.max(-90, Math.min(90, latitudeDegrees)) * deg;
  if (projection === "mercator") return {
    x: lon / Math.PI,
    y: mercatorY(Math.max(-85 * deg, Math.min(85 * deg, lat))) / mercatorLimit,
  };
  if (projection === "equalArea") {
    const cosine = Math.cos(standardParallel * deg);
    return { x: (lon / Math.PI) * cosine, y: Math.sin(lat) / cosine };
  }
  return { x: lon / Math.PI, y: lat / (Math.PI / 2) };
}

// Ratio of an infinitesimal mapped area's scale at this latitude to the equator.
export function relativeAreaScale(projection, latitudeDegrees,
  longitudeDegrees = 0) {
  if (d3Projections[projection]) {
    if (isEqualAreaProjection(projection))
      return 1;
    return localAreaScale(projection, latitudeDegrees, 0,
      longitudeDegrees) / localAreaScale(projection, 0, 0, longitudeDegrees);
  }
  const cosine = Math.cos(latitudeDegrees * deg);
  if (projection === "mercator") return 1 / (cosine * cosine);
  if (projection === "equalArea") return 1;
  return 1 / cosine;
}

export function continentDistortionSummary(continent, projection,
  latitude = continent.center[1], footprintRatio = 1, atLimit = false) {
  const place = `${Math.round(Math.abs(latitude))}°${latitude < 0 ? "S" : "N"}`;
  const title = `${continent.name.toUpperCase()} · ${place}`;
  if (Math.abs(latitude - continent.center[1]) < 2)
    return { title, detail: "Grip and move north or south" };
  if (isEqualAreaProjection(projection))
    return { title, detail: atLimit
      ? "Map area equal · polar limit reached"
      : projection === "goode"
        ? "Area stays equal · ocean cuts divide the map"
        : "Map area stays equal · shape shifts" };
  return { title,
    detail: atLimit
      ? `Footprint ~${footprintRatio.toFixed(1)}× · polar limit reached`
      : `Map footprint ~${footprintRatio.toFixed(1)}× its home view` };
}

export class GlobeSpin {
  constructor() {
    this.yaw = 0;
    this.pitch = 0;
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
    this.dragging = false;
  }
  begin(azimuth, elevation) {
    this.dragging = true;
    this.lastAzimuth = azimuth;
    this.lastElevation = elevation;
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
  }
  drag(azimuth, elevation, dt) {
    if (!this.dragging) return;
    const yawDelta = Math.atan2(Math.sin(azimuth - this.lastAzimuth),
      Math.cos(azimuth - this.lastAzimuth)) * 1.5;
    const pitchDelta = -(elevation - this.lastElevation) * 1.5;
    this.yaw += yawDelta;
    const nextPitch = Math.max(-1.15, Math.min(1.15, this.pitch + pitchDelta));
    const actualPitchDelta = nextPitch - this.pitch;
    this.pitch = nextPitch;
    const seconds = Math.max(0.012, dt);
    this.yawVelocity = 0.35 * this.yawVelocity +
      0.65 * Math.max(-4, Math.min(4, yawDelta / seconds));
    this.pitchVelocity = 0.35 * this.pitchVelocity +
      0.65 * Math.max(-3, Math.min(3, actualPitchDelta / seconds));
    this.lastAzimuth = azimuth;
    this.lastElevation = elevation;
  }
  end() {
    this.dragging = false;
  }
  step(dt) {
    if (this.dragging) return;
    this.yaw += (0.16 + this.yawVelocity) * dt;
    this.pitch = Math.max(-1.15, Math.min(1.15,
      this.pitch + this.pitchVelocity * dt));
    const coast = Math.exp(-3.2 * dt);
    this.yawVelocity *= coast;
    this.pitchVelocity *= coast;
    // Once the swipe settles, return to an upright, gently spinning globe.
    if (Math.abs(this.pitchVelocity) < 0.06)
      this.pitch *= Math.exp(-0.8 * dt);
  }
}
