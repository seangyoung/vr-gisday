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
  highwayWalkingHeight,
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

test("left-stick walking follows the view, terrain, bounds, and clipboard location", () => {
  const scene = new THREE.Scene();
  const l = new LayerExperience(scene, () => {});
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 0);
  l.place(camera);
  const map = new THREE.Mesh(new THREE.PlaneGeometry(1.17, 1.17));
  l.registerVisitorMarker(map, LANDSCAPE_EXTENT);
  assert.equal(l.visitorMarkers[0].marker.position.x, 0);
  l.walk(0, -1, 0.1, camera);
  assert.ok(Math.abs(l.group.position.z - 0.28) < 1e-9);
  assert.ok(l.visitor.y < 0);
  assert.ok(l.visitorMarkers[0].marker.position.y > 0);
  l.turn(Math.PI / 2, camera);
  const before = l.visitor.clone();
  l.walk(1, 0, 0.1, camera);
  assert.ok(l.visitor.distanceTo(before) > 0.25);
  l.walk(1, 0, 100, camera);
  assert.ok(Math.abs(l.visitor.x) <= LANDSCAPE_EXTENT - 4 + 1e-9);
  assert.ok(Math.abs(l.visitor.y) <= LANDSCAPE_EXTENT - 4 + 1e-9);
  l.place(camera);
  assert.ok(l.visitor.length() < 1e-9);
  assert.ok(l.visitorMarkers[0].marker.position.length() < 0.013);
  l.toggle("topography");
  l.update(0.8);
  const hill = new THREE.Vector3(-60, 0, -35).applyAxisAngle(
    new THREE.Vector3(0, 1, 0), l.group.rotation.y,
  );
  l.group.position.x = -hill.x;
  l.group.position.z = -hill.z;
  l.walk(0, 0, 0.1, camera);
  assert.ok(Math.abs(l.visitor.x + 60) < 1e-9);
  assert.ok(Math.abs(l.visitor.y + 35) < 1e-9);
  assert.ok(Math.abs(l.group.position.y + landscapeHeight(-60, -35)) < 1e-9);
  l.toggle("topography");
  l.walk(0, 0, 0.1, camera);
  assert.equal(l.group.position.y, 0);
  l.dispose();
  map.geometry.dispose();
});

test("highway shoulders meet the ground while the bridge stays open underneath", () => {
  const l = new LayerExperience(new THREE.Scene(), () => {});
  const positions = l.variants.raised.roads.children[0].geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 4) {
    const x = positions.getX(i);
    for (const edge of [i, i + 3]) {
      const z = positions.getZ(edge);
      if (Math.abs(x - riverX(highwayZ(x))) > 17)
        assert.ok(positions.getY(edge) < landscapeHeight(x, z),
          `shoulder should enter the ground at x=${x}`);
    }
  }
  const crossing = riverX(highwayZ(0));
  const z = highwayZ(crossing);
  assert.ok(highwayWalkingHeight(crossing, z) - landscapeHeight(crossing, z) > 1.5);
  assert.equal(highwayWalkingHeight(crossing, z + 10), null);
  l.dispose();
});

test("walking reaches the bridge from the road but stays below it from the river", () => {
  const l = new LayerExperience(new THREE.Scene(), () => {});
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 0);
  l.place(camera);
  l.selected = new Set(["topography", "roads"]);
  l.applyVisibility();
  l.group.rotation.y = 0;
  const shoulderX = -80;
  l.group.position.set(-shoulderX, 0, -(highwayZ(shoulderX) + 10));
  l.walk(0, 0, 0.02, camera);
  assert.equal(l.onRoad, false);
  for (let i = 0; i < 25; i++) l.walk(0, -1, 0.05, camera);
  assert.equal(l.onRoad, true);
  assert.ok(Math.abs(l.group.position.y +
    highwayWalkingHeight(l.visitor.x, l.visitor.y)) < 1e-6);
  l.place(camera);
  l.group.rotation.y = 0;
  const startX = -30, startZ = highwayZ(startX);
  l.group.position.set(-startX, 0, -startZ);
  l.walk(0, 0, 0.02, camera);
  assert.equal(l.onRoad, true);
  const crossing = riverX(highwayZ(0));
  let reachedBridge = false;
  for (let i = 0; i < 400; i++) {
    l.walk(1, 0, 0.05, camera);
    if (!reachedBridge && l.visitor.x >= crossing) {
      reachedBridge = true;
      assert.equal(l.onRoad, true);
      assert.ok(Math.abs(l.group.position.y +
        highwayWalkingHeight(l.visitor.x, l.visitor.y)) < 1e-6);
    }
  }
  assert.equal(reachedBridge, true);
  assert.equal(l.onRoad, true);
  l.place(camera);
  l.group.rotation.y = 0;
  l.group.position.set(-crossing, 0, -(highwayZ(crossing) - 12));
  let passedUnder = false;
  for (let i = 0; i < 175; i++) {
    l.walk(0, 1, 0.05, camera);
    if (!passedUnder && l.visitor.y >= highwayZ(crossing)) {
      passedUnder = true;
      assert.equal(l.onRoad, false);
      assert.ok(Math.abs(l.group.position.y +
        landscapeHeight(l.visitor.x, l.visitor.y)) < 1e-6);
      assert.ok(highwayWalkingHeight(l.visitor.x, l.visitor.y) -
        landscapeHeight(l.visitor.x, l.visitor.y) > 1.5);
    }
  }
  assert.equal(passedUnder, true);
  assert.equal(l.onRoad, false);
  l.dispose();
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
