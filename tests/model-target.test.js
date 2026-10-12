import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { handInsideModel, modelBeforeUi, modelBoundsHit } from "../src/model-target.js";

test("an exhibit remains grabbable inside its outline after moving and resizing", () => {
  const group = new THREE.Group();
  group.position.set(0.4, 1.2, -1.6);
  group.rotation.set(0.45, 0.3, 0, "YXZ");
  group.scale.setScalar(0.4);
  const bounds = new THREE.Box3(
    new THREE.Vector3(-1, -0.1, -1),
    new THREE.Vector3(1, 1.1, 1),
  );
  const inside = group.localToWorld(new THREE.Vector3(0, 0.5, 0));
  const eye = new THREE.Vector3(0, 1.6, 0);
  const raycaster = new THREE.Raycaster(eye,
    inside.clone().sub(eye).normalize());
  const hit = modelBoundsHit(group, bounds, raycaster);
  assert.ok(hit && hit.distance > 0);
  assert.equal(handInsideModel(group, bounds, inside), true);
  assert.equal(handInsideModel(group, bounds,
    group.localToWorld(new THREE.Vector3(2, 0.5, 0))), false);
  assert.equal(modelBoundsHit(group, bounds,
    new THREE.Raycaster(eye, new THREE.Vector3(0, 1, 0))), null);
});

test("a button behind the terrain cannot steal a rain or scan trigger", () => {
  const model = { distance: 1.2 }, button = { distance: 2.3 };
  assert.equal(modelBeforeUi(model, button), true);
  assert.equal(modelBeforeUi(model, { distance: 0.8 }), false);
  assert.equal(modelBeforeUi(null, button), false);
});
