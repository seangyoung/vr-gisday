export const anchors = [
  { x: -0.48, y: -0.1 },
  { x: 0.48, y: -0.1 },
  { x: -0.4, y: 0.52 },
];
export const target = { x: 0.1, y: 0.24 };
export const alternative = { x: 0.1, y: -0.44 };
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const ranges = anchors.map((a) => distance(a, target));
export function residual(point, count = 3) {
  return Math.max(
    ...anchors
      .slice(0, count)
      .map((a, i) => Math.abs(distance(point, a) - ranges[i])),
  );
}
export function candidates(count, tolerance = 0.025, step = 0.025) {
  const out = [];
  for (let x = -0.9; x <= 0.9; x += step)
    for (let y = -0.75; y <= 0.75; y += step)
      if (residual({ x, y }, count) <= tolerance) out.push({ x, y });
  return out;
}
export const stages = [
  {
    title: "One distance. Many possibilities.",
    body: "We know where A is and how far away we are.\nEvery point on the circle is that same distance from A.\nWithout direction, any of these points could be us.",
    action: "Add a second beacon",
  },
  {
    title: "Two distances. Two possibilities.",
    body: "A second known beacon gives us another distance.\nThe circles cross at two white points; both fit.\nChoose one: which will match a third beacon?",
    action: null,
  },
  {
    title: "A third beacon resolves the choice.",
    body: "The third circle passes through only one candidate.\nThat point fits all three measured distances.\nFinding position from distances is trilateration.",
    action: "Make measurements uncertain",
  },
  {
    title: "Real measurements are imperfect.",
    body: "Soft bands allow a small error in each distance.\nWhite dots fit all three bands: possible positions.\nA probability model would rank these possibilities.",
    action: "Take it into 3D",
  },
  {
    title: "One distance makes a shell.",
    body: "In 3D, points at the same distance from one known beacon\nform a spherical shell. Direction is still unknown.\nGrab and turn the model to look all around it.",
    action: "Add a second beacon",
  },
  {
    title: "Two shells meet in a circle.",
    body: "Both distances must agree. The bright circle is where\nthe shells intersect; every point on it fits both ranges.\nTurn the model to see the circle in space.",
    action: "Add a third beacon",
  },
  {
    title: "Three shells leave two points.",
    body: "The third shell crosses that circle at two white points.\nBoth positions fit all three exact distances.\nOne more well-placed beacon can resolve the ambiguity.",
    action: "Add a fourth beacon",
  },
  {
    title: "Four ranges. One common position.",
    body: "Here an extra off-plane beacon selects one exact point.\nThis model assumes exact distances. Real GNSS receivers\nalso solve for their own clock error with a fourth signal.",
    action: "Meet a GPS satellite",
  },
  {
    title: "Meet a GPS satellite.",
    body: "Point and trigger to identify parts; grip to turn.\nSolar panels supply power; an atomic clock keeps time.\nIts Earth-facing antenna broadcasts a timed radio signal.",
    action: "Follow a signal",
  },
  {
    title: "A signal carries a time stamp.",
    body: "Send a pulse and watch the radio wavefront spread.\nThe message gives the satellite's position and send time.\nTravel time × light speed gives an estimated range.",
    action: null,
  },
  {
    title: "Clock bias leaves several possible locations.",
    body: "Just 1 microsecond of receiver clock error adds about 300 meters to every measured range.\nThe ghost receivers show different positions and clock offsets that fit three signals.\nA fourth satellite signal resolves both position and clock bias.",
    action: null,
  },
  {
    title: "What if the sky is blocked?",
    body: "Multipath: a signal bounces along a longer route.\nThe extra travel time makes distance seem too large.\nThat error can shift the calculated location.",
    action: null,
  },
];
export const GNSS_SPATIAL_END = 8;
export const GNSS_SATELLITE = 8;
export const GNSS_SIGNAL = 9;
export const GNSS_CLOCK = 10;
export const GNSS_MULTIPATH = 11;
export const LIGHT_SPEED_M_PER_S = 299792458;
export function travelTimeMs(distanceKm) {
  return distanceKm * 1000 / LIGHT_SPEED_M_PER_S * 1000;
}
export function clockBiasMeters(microseconds) {
  return microseconds * 1e-6 * LIGHT_SPEED_M_PER_S;
}
export function pathLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i++)
    length += Math.hypot(...points[i].map((v, axis) => v - points[i - 1][axis]));
  return length;
}
export const beacons3D = [
  { x: -0.45, y: -0.15, z: 0 },
  { x: 0.45, y: -0.15, z: 0 },
  { x: 0, y: 0.5, z: 0 },
  { x: 0.15, y: 0, z: 0.65 },
];
export const target3D = { x: 0.06, y: 0.07, z: 0.26 };
export const alternative3D = { ...target3D, z: -target3D.z };
export const distance3D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function shellIntersection(a, b, radiusA, radiusB) {
  const separation = distance3D(a, b);
  if (
    separation <= 0 ||
    separation > radiusA + radiusB ||
    separation < Math.abs(radiusA - radiusB)
  ) return null;
  const normal = {
    x: (b.x - a.x) / separation,
    y: (b.y - a.y) / separation,
    z: (b.z - a.z) / separation,
  };
  const along = (radiusA ** 2 - radiusB ** 2 + separation ** 2) / (2 * separation);
  return {
    center: {
      x: a.x + normal.x * along,
      y: a.y + normal.y * along,
      z: a.z + normal.z * along,
    },
    normal,
    radius: Math.sqrt(Math.max(0, radiusA ** 2 - along ** 2)),
  };
}
