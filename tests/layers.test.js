import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  LayerExperience,
  LAYER_KEYS,
  LANDSCAPE_EXTENT,
  TREE_POSITIONS,
  landscapeHeight,
  riverX,
  riverWaterHeight,
  highwayZ,
  highwayDeckHeight,
  floodplainAt,
  boundaryX,
  boundaryZ,
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
  for (const key of ["hydrology", "roads", "vegetation", "floodplain", "boundaries"])
    l.toggle(key);
  assert.equal(l.selected.size, 5);
  assert.equal(l.variants.flat.hydrology.visible, true);
  l.toggle("topography");
  assert.equal(l.variants.raised.world.visible, true);
  l.update(0.8);
  assert.equal(l.variants.raised.world.scale.y, 1);
  for (const key of LAYER_KEYS.slice(1))
    assert.equal(l.variants.raised[key].visible, true);
  assert.equal(l.variants.flat.world.visible, false);
  l.toggle("hydrology");
  assert.equal(l.variants.raised.hydrology.visible, false);
  assert.equal(l.selected.size, 5);
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
  leftGrip.position.copy(camera.position);
  l.updateClipboard(leftGrip, camera);
  assert.ok(l.clipboard.position.distanceTo(camera.position) >= 0.85 - 1e-9);
  camera.position.x += 3;
  const beforeTurn = l.group.position.clone();
  const beforeAngle = l.group.rotation.y;
  l.turn(Math.PI / 6, camera);
  assert.ok(Math.abs(l.group.rotation.y - beforeAngle - Math.PI / 6) < 1e-9);
  assert.ok(Math.abs(l.group.position.distanceTo(camera.position) - beforeTurn.distanceTo(camera.position)) < 1e-9);
  l.updateClipboard(null, camera);
  assert.equal(l.clipboard.visible, false);
  l.updateClipboard(null, camera, true);
  assert.equal(l.clipboard.visible, true);
  assert.equal(landscapeHeight(0, 0), 0);
  assert.equal(LANDSCAPE_EXTENT, 160);
  assert.ok(landscapeHeight(-60, -35) > landscapeHeight(riverX(-35), -35));
  assert.ok(TREE_POSITIONS.length > 1000);
  assert.equal(l.view, "map");
  assert.equal(floodplainAt(riverX(50) + 6, 50), true);
  assert.equal(floodplainAt(-80, 50), false);
  assert.ok(boundaryX(0) < 0);
  assert.ok(boundaryZ(0) < 0);
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

test("the river runs downhill inside a carved channel and the highway bridges it", () => {
  const scene = new THREE.Scene();
  const oldSky = new THREE.Color(0x071820);
  scene.background = oldSky;
  const l = new LayerExperience(scene, () => {});
  assert.notEqual(scene.background, oldSky);
  assert.ok(scene.fog);
  const water = l.variants.raised.hydrology.children[1];
  const shoreline = l.variants.raised.hydrology.children[0];
  for (let z = -LANDSCAPE_EXTENT + 2; z < LANDSCAPE_EXTENT - 2; z += 2) {
    const center = riverX(z);
    const level = riverWaterHeight(z);
    assert.ok(riverWaterHeight(z + 1) < level);
    for (const offset of [-1.8, 0, 1.8])
      assert.ok(
        landscapeHeight(center + offset, z) < level + 0.02,
        `river is buried at z=${z}, offset=${offset}`,
      );
    if ((z + LANDSCAPE_EXTENT - 2) % 20 === 0) {
      const ray = new THREE.Raycaster(
        new THREE.Vector3(center, 10, z),
        new THREE.Vector3(0, -1, 0),
      );
      assert.equal(ray.intersectObjects([shoreline, water])[0]?.object, water);
    }
  }
  const crossingX = riverX(highwayZ(0));
  assert.ok(
    highwayDeckHeight(crossingX) > riverWaterHeight(highwayZ(crossingX)) + 1.5,
  );
  l.dispose();
  assert.equal(scene.background, oldSky);
  assert.equal(scene.fog, null);
});
