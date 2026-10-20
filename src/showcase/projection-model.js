export const PROJECTIONS = Object.freeze({
  equirectangular: "Plate Carrée",
  mercator: "Mercator",
  equalArea: "Cylindrical equal-area",
});

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

// The display mesh must use one scale on both axes. Stretching every
// projection into the same rectangle would add false shape distortion.
export function projectMetric(longitudeDegrees, latitudeDegrees,
  projection = "equirectangular", standardParallel = 0) {
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
  const cosine = Math.cos(standardParallel * deg);
  const maxX = Math.PI * (projection === "equalArea" ? cosine : 1);
  const maxY = projection === "mercator" ? mercatorLimit :
    projection === "equalArea" ? 1 / cosine : Math.PI / 2;
  return Math.min(0.86 / maxX, 0.53 / maxY);
}

// Local horizontal and vertical scale factors relative to the source globe.
export function indicatrixAxes(projection, latitudeDegrees,
  standardParallel = 0) {
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
  standardParallel = 0) {
  const { horizontal, vertical } = indicatrixAxes(projection,
    latitudeDegrees, standardParallel);
  return {
    shapeRatio: Math.max(horizontal, vertical) / Math.min(horizontal, vertical),
    longerAxis: horizontal > vertical ? "east-west" : vertical > horizontal
      ? "north-south" : null,
    relativeArea: relativeAreaScale(projection, latitudeDegrees),
  };
}

// Coordinates are normalized for display; all three are cylindrical projections.
export function projectNormalized(longitudeDegrees, latitudeDegrees,
  projection = "equirectangular", standardParallel = 0) {
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
export function relativeAreaScale(projection, latitudeDegrees) {
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
  if (projection === "equalArea")
    return { title, detail: atLimit
      ? "Map area equal · polar limit reached"
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
