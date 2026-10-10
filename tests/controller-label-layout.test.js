import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { positionButtonLabel } from "../src/controller-label-layout.js";

test("paired button labels stay outside their own buttons through wrist rotation", () => {
  const eye = new THREE.Vector3(0, 0, 0);
  const camera = new THREE.PerspectiveCamera(65, 1, 0.01, 10);
  const screenDistance = (first, second) => {
    const a = first.clone().project(camera);
    const b = second.clone().project(camera);
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
    const a = new THREE.Vector3(0.008, 0.012, -0.38)
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), angle);
    const b = new THREE.Vector3(-0.008, -0.002, -0.38)
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), angle);
    const aLabel = new THREE.Vector3();
    const bLabel = new THREE.Vector3();
    assert.equal(positionButtonLabel(a, b, eye, 0.025, aLabel), true);
    assert.equal(positionButtonLabel(b, a, eye, 0.025, bLabel), true);
    assert.ok(aLabel.distanceTo(a) < aLabel.distanceTo(b));
    assert.ok(bLabel.distanceTo(b) < bLabel.distanceTo(a));
    assert.ok(screenDistance(aLabel, a) < screenDistance(aLabel, b));
    assert.ok(screenDistance(bLabel, b) < screenDistance(bLabel, a));
    assert.ok(aLabel.distanceTo(bLabel) > 0.057);
  }
});

test("edge-on paired buttons hide ambiguous labels", () => {
  const eye = new THREE.Vector3();
  const a = new THREE.Vector3(0, 0, -0.36);
  const b = new THREE.Vector3(0, 0, -0.39);
  assert.equal(positionButtonLabel(a, b, eye, 0.025, new THREE.Vector3()), false);
});
