import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  LayerExperience,
  LAYER_KEYS,
  landscapeHeight,
  riverX,
  densityAt,
} from "../src/layers/experience.js";

test("a visitor starts in an empty flat landscape and can compose any layer order", () => {
  const scene = new THREE.Scene();
  let changes = 0;
  const l = new LayerExperience(scene, () => changes++);
  assert.equal(l.selected.size, 0);
  assert.equal(l.variants.flat.world.visible, true);
  assert.equal(l.variants.raised.world.visible, false);
  for (const key of LAYER_KEYS.slice(1))
    assert.equal(l.variants.flat[key].visible, false);
  for (const key of ["hydrology", "roads", "vegetation", "population"])
    l.toggle(key);
  assert.equal(l.selected.size, 4);
  assert.equal(l.variants.flat.hydrology.visible, true);
  l.toggle("topography");
  assert.equal(l.variants.raised.world.visible, true);
  for (const key of LAYER_KEYS.slice(1))
    assert.equal(l.variants.raised[key].visible, true);
  assert.equal(l.variants.flat.world.visible, false);
  l.toggle("hydrology");
  assert.equal(l.variants.raised.hydrology.visible, false);
  assert.equal(l.selected.size, 4);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(2, 1.7, -3);
  l.place(camera);
  assert.ok(l.group.position.distanceTo(new THREE.Vector3(2, 0.1, -3)) < 1e-9);
  assert.equal(l.clipboard.visible, false);
  const leftGrip = new THREE.Group();
  leftGrip.position.set(1.4, 1.1, -3.5);
  scene.add(leftGrip);
  l.updateClipboard(leftGrip, camera);
  assert.equal(l.clipboard.visible, true);
  const firstPosition = l.clipboard.position.clone();
  leftGrip.position.x += 0.3;
  l.updateClipboard(leftGrip, camera);
  assert.ok(Math.abs(l.clipboard.position.x - firstPosition.x - 0.3) < 1e-9);
  const front = new THREE.Vector3(0, 0, 1).applyQuaternion(l.clipboard.quaternion);
  const towardViewer = camera.position.clone().sub(l.clipboard.position).normalize();
  assert.ok(front.dot(towardViewer) > 0.99);
  l.updateClipboard(null, camera);
  assert.equal(l.clipboard.visible, false);
  l.updateClipboard(null, camera, true);
  assert.equal(l.clipboard.visible, true);
  assert.equal(landscapeHeight(0, 0), 0);
  assert.equal(landscapeHeight(8, 6) > 0, true);
  assert.equal(riverX(0), 4);
  assert.deepEqual(
    new Set([densityAt(0, 0), densityAt(-8, 0), densityAt(13, 13)]),
    new Set(["high", "medium", "low"]),
  );
  l.update(240);
  assert.equal(l.finished, true);
  l.toggle("roads");
  assert.equal(l.selected.has("roads"), true);
  l.reset();
  assert.equal(l.finished, false);
  assert.equal(l.selected.size, 0);
  assert.equal(l.variants.flat.world.visible, true);
  assert.ok(changes >= 7);
  l.dispose();
  scene.remove(leftGrip);
  assert.equal(scene.children.length, 0);
});
