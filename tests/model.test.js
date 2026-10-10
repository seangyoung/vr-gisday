import test from "node:test";
import assert from "node:assert/strict";
import { target, alternative, residual, candidates } from "../src/model.js";
test("two ranges permit reflected candidates, third disambiguates", () => {
  assert.ok(residual(target, 2) < 1e-12);
  assert.ok(residual(alternative, 2) < 1e-12);
  assert.ok(residual(target, 3) < 1e-12);
  assert.ok(residual(alternative, 3) > 0.1);
});
test("larger tolerance includes all smaller-tolerance candidates", () => {
  const tight = candidates(3, 0.025);
  const wide = candidates(3, 0.1);
  assert.ok(tight.length > 0);
  assert.ok(wide.length > tight.length);
  for (const p of tight)
    assert.ok(wide.some((q) => q.x === p.x && q.y === p.y));
});
import {
  beacons3D,
  target3D,
  alternative3D,
  distance3D,
  shellIntersection,
} from "../src/model.js";
test("three coplanar beacons admit two 3D locations; fourth distinguishes them", () => {
  for (const a of beacons3D.slice(0, 3))
    assert.ok(
      Math.abs(distance3D(a, target3D) - distance3D(a, alternative3D)) < 1e-12,
    );
  assert.ok(
    Math.abs(
      distance3D(beacons3D[3], target3D) -
        distance3D(beacons3D[3], alternative3D),
    ) > 0.1,
  );
});

test("the first two 3D ranges intersect in a circle through both candidates", () => {
  const [a, b] = beacons3D;
  const first = distance3D(a, target3D);
  const second = distance3D(b, target3D);
  const ring = shellIntersection(a, b, first, second);
  assert.ok(ring && ring.radius > 0);
  for (const point of [target3D, alternative3D]) {
    const fromCenter = {
      x: point.x - ring.center.x,
      y: point.y - ring.center.y,
      z: point.z - ring.center.z,
    };
    const planeDistance = fromCenter.x * ring.normal.x +
      fromCenter.y * ring.normal.y + fromCenter.z * ring.normal.z;
    assert.ok(Math.abs(planeDistance) < 1e-12);
    assert.ok(Math.abs(Math.hypot(fromCenter.x, fromCenter.y, fromCenter.z) - ring.radius) < 1e-12);
  }
  assert.equal(shellIntersection(a, b, 0.1, 0.1), null);
});
