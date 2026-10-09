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
  assert.equal(scene.children.length, 0);
});
