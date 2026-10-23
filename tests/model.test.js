import test from "node:test";
import assert from "node:assert/strict";
import { target, alternative, residual, candidates, stages,
  GNSS_SATELLITE, GNSS_SIGNAL, GNSS_CLOCK, GNSS_MULTIPATH,
  travelTimeMs, clockBiasMeters, pathLength } from "../src/model.js";
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

test("GNSS signal timing and receiver clock bias use light speed", () => {
  assert.ok(Math.abs(travelTimeMs(20200) - 67.38) < 0.1);
  assert.ok(Math.abs(clockBiasMeters(1) - 299.792458) < 1e-6);
  assert.ok(Math.abs(pathLength([[0, 0, 0], [3, 4, 0]]) - 5) < 1e-12);
  assert.ok(pathLength([[0, 0], [2, 2], [4, 0]]) >
    pathLength([[0, 0], [4, 0]]));
});

test("new GNSS interactions follow the exact-range shell lesson", () => {
  assert.equal(stages[GNSS_SATELLITE].action, "Follow a signal");
  assert.match(stages[GNSS_SIGNAL].body, /light speed/i);
  assert.match(stages[GNSS_CLOCK].body, /fourth satellite/i);
  assert.match(stages[GNSS_MULTIPATH].body, /multipath/i);
});

test("GNSS pointer reaches spacecraft through the decorative radio halo", async () => {
  const { Raycaster, Vector3 } = await import("three");
  const { GnssScene } = await import("../src/gnss/scene.js");
  const display = new GnssScene(GNSS_SATELLITE);
  const ray = new Raycaster(new Vector3(-0.13, 0.3, 3),
    new Vector3(0, 0, -1));
  const picked = display.pickPart(ray);
  assert.match(picked.text, /Clock & radio/);
  assert.ok(picked.point.distanceTo(ray.ray.origin) > 2.5,
    "inspection callout anchors to the spacecraft surface");
  const hit = display.hitSurface(ray);
  assert.ok(hit && hit.distance > 2.5, "ray reaches the spacecraft behind halo");
  assert.ok(hit.object.userData.gnssPart);
});

test("clock correction introduces a fourth spacecraft and reflected route takes longer", async () => {
  const { GnssScene } = await import("../src/gnss/scene.js");
  const before = new GnssScene(GNSS_CLOCK);
  const after = new GnssScene(GNSS_CLOCK, { clockCorrected: true });
  assert.equal(before.satelliteCount, 3);
  assert.equal(after.satelliteCount, 4);
  after.revealFourth();
  assert.ok(after.fourth.scale.x < 0.01);
  after.update(1);
  assert.ok(Math.abs(after.fourth.scale.x - 0.32) < 1e-12);
  const open = new GnssScene(GNSS_MULTIPATH, { environment: "open" });
  const canyon = new GnssScene(GNSS_MULTIPATH, { environment: "canyon" });
  assert.ok(canyon.pathRatio > 1.2);
  assert.ok(canyon.signalDuration > open.signalDuration);
});
