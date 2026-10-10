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
    body: "A second known beacon gives us another distance.\nOnly the two white points fit BOTH measurements.\nChoose one: which will match a third beacon?",
    action: null,
  },
  {
    title: "A third beacon resolves the choice.",
    body: "The third circle passes through only one candidate.\nThat point fits all three measured distances.\nFinding position from distances is trilateration.",
    action: "Make measurements uncertain",
  },
  {
    title: "Real measurements are imperfect.",
    body: "Bands show distance ± a tolerance. White dots satisfy\nall three bands; they are possibilities, not probabilities.",
    action: "Take it into 3D",
  },
  {
    title: "In 3D, circles become shells.",
    body: "In space, every point on a shell is equally far from its beacon.\nThe two white points fit all three distances.\nGrab and turn the model to see both possibilities.",
    action: "Add the fourth beacon",
  },
  {
    title: "Four ranges. One common position.",
    body: "The fourth beacon rules out the other white point.\nOne position fits all four exact ranges. Real GNSS uses\nsignal travel time (pseudorange) and solves clock bias.",
    action: "Finish",
  },
];
export const beacons3D = [
  { x: -0.45, y: -0.15, z: 0 },
  { x: 0.45, y: -0.15, z: 0 },
  { x: 0, y: 0.5, z: 0 },
  { x: 0.15, y: 0, z: 0.65 },
];
export const target3D = { x: 0.06, y: 0.07, z: 0.26 };
export const alternative3D = { ...target3D, z: -target3D.z };
export const distance3D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
