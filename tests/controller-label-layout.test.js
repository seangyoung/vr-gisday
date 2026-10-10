import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { arrangeButtonLabels, positionButtonLabel } from "../src/controller-label-layout.js";

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

test("slightly tilted paired buttons retain separate labels", () => {
  const eye = new THREE.Vector3();
  const a = new THREE.Vector3(0.002, 0, -0.36);
  const b = new THREE.Vector3(-0.002, 0, -0.39);
  const first = new THREE.Vector3();
  const second = new THREE.Vector3();
  assert.equal(positionButtonLabel(a, b, eye, 0.025, first), true);
  assert.equal(positionButtonLabel(b, a, eye, 0.025, second), true);
  assert.ok(first.x > second.x);
});

test("nearby controller badges do not obscure one another", () => {
  const camera = new THREE.PerspectiveCamera(65, 1, 0.01, 10);
  camera.updateMatrixWorld();
  const labels = Array.from({ length: 4 }, () => ({
    ready: true,
    sprite: {
      position: new THREE.Vector3(0, 0, -0.36),
      scale: new THREE.Vector3(0.057, 0.018, 1),
    },
  }));
  arrangeButtonLabels(labels, camera);
  assert.ok(labels.every((label) => label.ready));
  for (let i = 0; i < labels.length; i++)
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i].sprite.position;
      const b = labels[j].sprite.position;
      assert.ok(Math.abs(a.x - b.x) >= 0.057 + 0.009 * 0.36 ||
        Math.abs(a.y - b.y) >= 0.018 + 0.009 * 0.36);
    }
});

test("collision nudges do not put a badge closer to the other button", () => {
  const camera = new THREE.PerspectiveCamera(65, 1, 0.01, 10);
  camera.updateMatrixWorld();
  const a = new THREE.Vector3(0.012, 0, -0.36);
  const b = new THREE.Vector3(-0.012, 0, -0.36);
  const labels = [[a, b], [b, a]].map(([anchor, neighborPosition]) => ({
    ready: true,
    anchor,
    neighbor: true,
    neighborPosition,
    sprite: {
      position: new THREE.Vector3(0, 0, -0.36),
      scale: new THREE.Vector3(0.057, 0.018, 1),
    },
  }));
  arrangeButtonLabels(labels, camera);
  assert.ok(labels.every((label) => label.ready));
  assert.ok(labels[0].sprite.position.x > 0);
  assert.ok(labels[1].sprite.position.x < 0);
});
