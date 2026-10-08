import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { RoomScan } from "../src/scan/room.js";
const origin = new THREE.Vector3();
function make(
  session = { requestHitTestSource: async () => ({ cancel() {} }) },
) {
  const r = new RoomScan(new THREE.Scene(), () => {}, session, "immersive-ar");
  r.explore();
  return r;
}
test("live real coordinates survive miniature manipulation and resume exactly", () => {
  const r = make(),
    camera = new THREE.PerspectiveCamera();
  r.record({ x: 1, y: 1, z: -2 }, origin);
  r.record({ x: -1, y: 0, z: -3 }, origin);
  const original = r.records.map(({ p }) => p.clone());
  r.refreshPoints();
  r.place(camera);
  assert.equal(r.group.scale.x, 1);
  assert.equal(r.group.position.length(), 0);
  r.freeze(camera);
  assert.equal(r.frozen, true);
  assert.ok(r.group.scale.x < 1);
  r.group.position.set(3, 2, 1);
  r.group.rotation.y = 1;
  assert.equal(r.record({ x: 2, y: 1, z: -2 }, origin), false);
  r.resume();
  assert.equal(r.group.position.length(), 0);
  assert.equal(r.group.scale.x, 1);
  original.forEach((p, i) => {
    assert.ok(r.records[i].p.equals(p));
    assert.equal(r.points.geometry.attributes.position.getX(i), p.x);
  });
  r.clearScan();
  assert.equal(r.records.length, 0);
  assert.equal(r.points.geometry.drawRange.count, 0);
  r.dispose();
});
test("bad, duplicate, out-of-range points and cap are rejected without fabricated data", () => {
  const r = make();
  for (const p of [
    { x: NaN, y: 0, z: 1 },
    { x: 0, y: 0, z: 0.1 },
    { x: 0, y: 0, z: 9 },
  ])
    assert.equal(r.record(p, origin), false);
  assert.equal(r.record({ x: 1, y: 0, z: -1 }, origin), true);
  assert.equal(r.record({ x: 1, y: 0, z: -1 }, origin), false);
  r.capacity = 1;
  assert.equal(r.record({ x: 2, y: 0, z: -1 }, origin), false);
  r.dispose();
});
test("source rejection is bounded until retry; pending sources cancel after disposal", async () => {
  let requests = 0;
  const input = { targetRaySpace: {} };
  const r = make({
    requestHitTestSource: async () => {
      requests++;
      throw Object.assign(new Error(), { name: "NotAllowedError" });
    },
  });
  await r.ensureSource(input);
  await r.ensureSource(input);
  assert.equal(requests, 1);
  assert.equal(r.status, "error");
  assert.equal(r.records.length, 0);
  r.retry();
  await r.ensureSource(input);
  assert.equal(requests, 2);
  r.dispose();
  let resolve,
    cancelled = 0;
  const late = make({
    requestHitTestSource: () => new Promise((r) => (resolve = r)),
  });
  const pending = late.ensureSource(input);
  late.dispose();
  resolve({
    cancel() {
      cancelled++;
    },
  });
  await pending;
  assert.equal(cancelled, 1);
});
test("only hit-test poses with held trigger are recorded and sources cancel at wrap-up", async () => {
  let cancelled = 0;
  const input = { targetRaySpace: {} };
  const r = make({
    requestHitTestSource: async () => ({
      cancel() {
        cancelled++;
      },
    }),
  });
  await r.ensureSource(input);
  const c = new THREE.Group();
  c.userData.xrInput = input;
  c.userData.scanning = false;
  const frame = {
    getHitTestResults: () => [
      { getPose: () => ({ transform: { position: { x: 0, y: 0.5, z: -2 } } }) },
    ],
  };
  const camera = new THREE.PerspectiveCamera();
  const controllers = [{ c, id: 0 }];
  r.updateFrame(frame, {}, controllers, 0.05, camera, () => false);
  assert.equal(r.records.length, 0);
  assert.equal(r.reticles[0].visible, true);
  c.userData.scanning = true;
  r.updateFrame(frame, {}, controllers, 0.05, camera, () => false);
  assert.equal(r.records.length, 1);
  r.update(240);
  assert.equal(r.stage, 2);
  assert.equal(r.frozen, true);
  assert.equal(cancelled, 1);
  r.dispose();
});
test("VR or missing API reports unavailable and cannot start recording", () => {
  const r = new RoomScan(new THREE.Scene(), () => {}, null, "immersive-vr");
  r.explore();
  assert.equal(r.stage, 0);
  assert.equal(r.status, "unavailable");
  r.dispose();
});
