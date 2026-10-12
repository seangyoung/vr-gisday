export const PROJECTIONS = Object.freeze({
  equirectangular: "Plate Carrée",
  mercator: "Mercator",
  equalArea: "Cylindrical equal-area",
});

const deg = Math.PI / 180;
const mercatorY = (latitude) => Math.log(Math.tan(Math.PI / 4 + latitude / 2));
const mercatorLimit = mercatorY(85 * deg);

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
