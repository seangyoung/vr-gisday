export const PROJECTIONS = Object.freeze({
  equirectangular: "Plate Carrée",
  mercator: "Mercator",
  equalArea: "Cylindrical equal-area",
});

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
