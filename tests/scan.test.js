import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ScanExperience } from "../src/scan/experience.js";

test("scanner records only nearest surfaces; filtering never invents hidden returns", () => {
  const s = new ScanExperience(new THREE.Scene(), () => {});
  s.explore();
  const o = new THREE.Vector3(-0.65, 0.69, 3),
    d = new THREE.Vector3(0, 0, -1);
  assert.equal(s.record(o, d), true);
  assert.equal(s.records[0].kind, "vegetation");
  assert.equal(s.record(o, d), false);
  assert.equal(s.records.length, 1);
  s.refreshPoints();
  assert.equal(s.points.geometry.drawRange.count, 1);
  s.toggleVegetation();
  assert.equal(s.points.geometry.drawRange.count, 0);
  // The scanner still intersects the real canopy even when it is filtered out visually.
  const ray = new THREE.Raycaster(o, d);
  assert.equal(s.hit(ray).object.userData.kind, "vegetation");
  s.toggleVegetation();
  assert.equal(s.points.geometry.drawRange.count, 1);
  s.dispose();
});
test("new viewpoints add surfaces and point coordinates remain model-relative after moving", () => {
  const s = new ScanExperience(new THREE.Scene(), () => {});
  s.explore();
  const a = new THREE.Vector3(0.48, 0.3, 3),
    d = new THREE.Vector3(0, 0, -1);
  s.record(a, d);
  const first = s.records[0].p.clone();
  s.record(new THREE.Vector3(0.48, 0.3, -3), new THREE.Vector3(0, 0, 1));
  assert.equal(s.records.length, 2);
  assert.notEqual(s.records[1].p.z, first.z);
  s.group.position.set(0.4, 0.2, -2);
  s.group.rotation.y = 0.5;
  s.group.scale.setScalar(0.4);
  s.group.updateWorldMatrix(true, true);
  const worldOrigin = s.group.localToWorld(a.clone());
  const worldTarget = s.group.localToWorld(first.clone());
  s.record(worldOrigin, worldTarget.sub(worldOrigin).normalize());
  assert.equal(s.records.length, 2);
  const cam = new THREE.PerspectiveCamera();
  s.place(cam);
  assert.equal(s.records.length, 2);
  s.clearScan();
  assert.equal(s.records.length, 0);
  assert.equal(s.points.geometry.drawRange.count, 0);
  s.dispose();
});
test("scan limit, miss handling, intro gate and four-minute wrap-up", () => {
  const s = new ScanExperience(new THREE.Scene(), () => {});
  assert.equal(
    s.record(new THREE.Vector3(0, 1, 3), new THREE.Vector3(0, 0, -1)),
    false,
  );
  s.explore();
  s.capacity = 1;
  assert.equal(
    s.record(new THREE.Vector3(0, 0.1, 3), new THREE.Vector3(0, 0, -1)),
    true,
  );
  assert.equal(
    s.record(new THREE.Vector3(0.48, 0.3, 3), new THREE.Vector3(0, 0, -1)),
    false,
  );
  s.grab.begin(0, new THREE.Matrix4());
  s.update(240);
  assert.equal(s.stage, 2);
  assert.equal(s.grab.hands.size, 0);
  s.dispose();
});
