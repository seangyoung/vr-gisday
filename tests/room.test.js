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
test("height and capture range use distinct color ramps without moving points", () => {
  const r = make();
  assert.equal(r.record({ x: 0, y: -1, z: 0 }, new THREE.Vector3(0, -1, 0.25)), true);
  assert.equal(r.record({ x: 0, y: 2, z: 0 }, new THREE.Vector3(0, 2, 7.9)), true);
  const colors = r.points.geometry.attributes.color;
  const positions = r.points.geometry.attributes.position;
  const rgb = (i) => [colors.getX(i), colors.getY(i), colors.getZ(i)];
  r.refreshPoints();
  const lowHeight = rgb(0), highHeight = rgb(1);
  assert.ok(lowHeight[1] > lowHeight[0] && lowHeight[1] > lowHeight[2]);
  assert.ok(highHeight[0] > highHeight[2] && highHeight[1] > highHeight[2]);
  r.toggleColor();
  const nearRange = rgb(0), farRange = rgb(1);
  assert.equal(r.colorMode, "range");
  assert.ok(nearRange[2] > nearRange[0] && nearRange[2] > nearRange[1]);
  assert.ok(farRange[0] > farRange[1] && farRange[0] > farRange[2]);
  assert.notDeepEqual(nearRange, lowHeight);
  assert.equal(positions.getY(0), -1);
  assert.equal(positions.getY(1), 2);
  r.toggleColor();
  assert.deepEqual(rgb(0), lowHeight);
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
  assert.equal(r.reticles[0][0].visible, true);
  c.userData.scanning = true;
  r.updateFrame(frame, {}, controllers, 0.05, camera, () => false);
  assert.equal(r.records.length, 1);
  r.update(240);
  assert.equal(r.stage, 2);
  assert.equal(r.frozen, true);
  assert.equal(cancelled, 1);
  r.dispose();
});
test("visitor can finish room scanning early and keep the collected cloud", async () => {
  let cancelled = 0;
  const input = { targetRaySpace: {} };
  const r = make({
    requestHitTestSource: async () => ({ cancel() { cancelled++; } }),
  });
  await r.ensureSource(input);
  r.record({ x: 0, y: 0.5, z: -2 }, origin);
  assert.equal(r.stage, 1);
  r.finish();
  assert.equal(r.stage, 2);
  assert.equal(r.frozen, true);
  assert.equal(r.records.length, 1);
  assert.equal(cancelled, 1);
  assert.equal(r.record({ x: 0.5, y: 0.5, z: -2 }, origin), false);
  r.dispose();
});
test("a controller sweep records three independent surface hits when offset rays work", async () => {
  const originalRay = globalThis.XRRay;
  globalThis.XRRay = class {
    constructor(origin, direction) {
      this.origin = origin;
      this.direction = direction;
    }
  };
  let cancelled = 0;
  const input = { targetRaySpace: {} };
  const r = make({
    requestHitTestSource: async ({ offsetRay }) => ({
      offset: offsetRay?.direction.x ?? 0,
      cancel() { cancelled++; },
    }),
  });
  try {
    await r.ensureSource(input);
    const c = new THREE.Group();
    c.userData.xrInput = input;
    c.userData.scanning = true;
    const frame = {
      getHitTestResults: (source) => [
        { getPose: () => ({ transform: { position: {
          x: source.offset * 2, y: 0.5, z: -2,
        } } }) },
      ],
    };
    const controllers = [{ c, id: 0 }];
    r.updateFrame(frame, {}, controllers, 0.05, new THREE.PerspectiveCamera(), () => false);
    assert.equal(r.records.length, 3);
    assert.deepEqual(r.records.map(({ p }) => p.x).sort((a, b) => a - b), [-0.15, 0, 0.15]);
    assert.ok(r.reticles[0].every((reticle) => reticle.visible));
    r.updateFrame(frame, {}, controllers, 0.05, new THREE.PerspectiveCamera(), () => false);
    assert.equal(r.records.length, 3, "repeated poses stay deduplicated");
    r.freeze();
    assert.equal(cancelled, 3);
  } finally {
    r.dispose();
    globalThis.XRRay = originalRay;
  }
});
test("rejected side rays leave the center scan usable", async () => {
  const originalRay = globalThis.XRRay;
  globalThis.XRRay = class {
    constructor(origin, direction) { this.direction = direction; }
  };
  const input = { targetRaySpace: {} };
  const r = make({
    requestHitTestSource: async ({ offsetRay }) => {
      if (offsetRay) throw new Error("source limit");
      return { cancel() {} };
    },
  });
  try {
    await r.ensureSource(input);
    const c = new THREE.Group();
    c.userData.xrInput = input;
    c.userData.scanning = true;
    r.updateFrame({
      getHitTestResults: () => [
        { getPose: () => ({ transform: { position: { x: 0, y: 0.5, z: -2 } } }) },
      ],
    }, {}, [{ c, id: 0 }], 0.05, new THREE.PerspectiveCamera(), () => false);
    assert.equal(r.records.length, 1);
    assert.notEqual(r.status, "error");
  } finally {
    r.dispose();
    globalThis.XRRay = originalRay;
  }
});
test("VR or missing API reports unavailable and cannot start recording", () => {
  const r = new RoomScan(new THREE.Scene(), () => {}, null, "immersive-vr");
  r.explore();
  assert.equal(r.stage, 0);
  assert.equal(r.status, "unavailable");
  r.dispose();
});
