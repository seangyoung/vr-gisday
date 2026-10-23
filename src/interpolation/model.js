// Synthetic rainfall stations (millimeters) on a square teaching region.
export const STATIONS = Object.freeze([
  { x: -0.84, z: -0.74, value: 14 },
  { x: -0.38, z: -0.83, value: 18 },
  { x: 0.19, z: -0.78, value: 36 },
  { x: 0.77, z: -0.68, value: 42 },
  { x: -0.71, z: -0.18, value: 11 },
  { x: -0.18, z: -0.22, value: 23 },
  { x: 0.44, z: -0.14, value: 39 },
  { x: 0.83, z: 0.18, value: 47 },
  { x: -0.83, z: 0.48, value: 9 },
  { x: -0.37, z: 0.72, value: 17 },
  { x: 0.22, z: 0.55, value: 31 },
  { x: 0.72, z: 0.76, value: 35 },
]);

const EPSILON = 1e-10;
export const IDW_POWER = 2;
export function nearestStations(x, z, stations = STATIONS, count = 3) {
  return stations.map((station, index) => ({
    station, index, distance: Math.hypot(x - station.x, z - station.z),
  })).sort((a, b) => a.distance - b.distance).slice(0, count);
}

export function idwEstimate(x, z, stations = STATIONS, count = 3, power = IDW_POWER) {
  const neighbors = nearestStations(x, z, stations, count);
  if (!neighbors.length) throw new RangeError("IDW requires stations");
  if (neighbors[0].distance < EPSILON) return {
    value: neighbors[0].station.value,
    neighbors: [{ ...neighbors[0], weight: 1 }],
    power,
  };
  const raw = neighbors.map((n) => n.distance ** -power);
  const total = raw.reduce((sum, weight) => sum + weight, 0);
  return {
    value: neighbors.reduce((sum, n, i) =>
      sum + n.station.value * raw[i] / total, 0),
    neighbors: neighbors.map((n, i) => ({ ...n, weight: raw[i] / total })),
    power,
  };
}

// Text for the worked fraction shown at the probe. Four significant digits
// keep the printed distances close to the unrounded calculation; the result
// uses the full-precision distances in idwEstimate.
export function idwWorkedFraction(estimate) {
  const { neighbors, power, value } = estimate;
  if (neighbors[0].distance < EPSILON) return {
    exact: true, value,
  };
  const distance = (d) => Number(d.toPrecision(4)).toString();
  const exponent = power === 1 ? "" : power === 2 ? "²" : `^${power}`;
  return {
    exact: false,
    count: neighbors.length,
    power,
    numerator: neighbors.map(({ station, distance: d }) =>
      `${station.value}/${distance(d)}${exponent}`).join(" + "),
    denominator: neighbors.map(({ distance: d }) =>
      `1/${distance(d)}${exponent}`).join(" + "),
    value,
  };
}

// A broad Gaussian kernel average demonstrates a surface that need not
// honor every sample exactly. Bandwidth is in the same units as x and z.
export function smoothEstimate(x, z, stations = STATIONS, bandwidth = 0.58) {
  let weighted = 0;
  let total = 0;
  for (const station of stations) {
    const d2 = (x - station.x) ** 2 + (z - station.z) ** 2;
    const weight = Math.exp(-d2 / (2 * bandwidth ** 2));
    weighted += station.value * weight;
    total += weight;
  }
  return weighted / total;
}

export function nearestEstimate(x, z, stations = STATIONS) {
  return nearestStations(x, z, stations, 1)[0].station.value;
}

export const heightForValue = (value) => 0.12 + value / 50 * 0.78;
