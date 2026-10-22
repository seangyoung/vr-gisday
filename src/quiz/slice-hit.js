// Segment/box intersection in the quiz board's local coordinates. Sampling
// multiple places along a moving blade makes a broad sweep count without
// accepting a blade that merely rests inside a target.
export function segmentBoxEntry(start, end, box) {
  let near = 0;
  let far = 1;
  for (const axis of ["x", "y", "z"]) {
    const delta = end[axis] - start[axis];
    const min = box.min[axis];
    const max = box.max[axis];
    if (Math.abs(delta) < 1e-7) {
      if (start[axis] < min || start[axis] > max) return null;
      continue;
    }
    const a = (min - start[axis]) / delta;
    const b = (max - start[axis]) / delta;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (near > far) return null;
  }
  return near;
}

export function segmentHitsBox(start, end, box) {
  return segmentBoxEntry(start, end, box) !== null;
}

export function sweptBladeHitFraction(previous, current, box, dt,
  minimumSpeed = 0.48) {
  if (!(dt > 0) || !previous || !current || previous.length !== current.length)
    return null;
  let earliest = null;
  for (let i = 0; i < current.length; i++) {
    const from = previous[i];
    const to = current[i];
    const travel = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    // Large one-frame pose jumps usually mean tracking was regained.
    if (travel / dt < minimumSpeed || travel > 1.2) continue;
    const startedInside = ["x", "y", "z"].every((axis) =>
      from[axis] >= box.min[axis] && from[axis] <= box.max[axis]);
    const fraction = startedInside ? null : segmentBoxEntry(from, to, box);
    if (fraction !== null && (earliest === null || fraction < earliest))
      earliest = fraction;
  }
  return earliest;
}

export function sweptBladeHits(previous, current, box, dt,
  minimumSpeed = 0.48) {
  return sweptBladeHitFraction(previous, current, box, dt,
    minimumSpeed) !== null;
}
