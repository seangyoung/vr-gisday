import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { InterpolationExperience } from "../src/interpolation/experience.js";
import {
  STATIONS, idwEstimate, nearestEstimate, smoothEstimate,
} from "../src/interpolation/model.js";

test("IDW honors measured readings and normalized neighbor weights", () => {
  for (const station of STATIONS)
    assert.equal(idwEstimate(station.x, station.z).value, station.value);
  const estimate = idwEstimate(0.04, 0.08);
  assert.equal(estimate.neighbors.length, 3);
  assert.ok(Math.abs(estimate.neighbors.reduce((sum, n) => sum + n.weight, 0) - 1) < 1e-12);
  assert.ok(Math.abs(estimate.value - estimate.neighbors.reduce((sum, n) =>
    sum + n.station.value * n.weight, 0)) < 1e-12);
});

test("smoothing can miss a measured reading; nearest zones preserve one reading", () => {
  const station = STATIONS[0];
  assert.ok(Math.abs(smoothEstimate(station.x, station.z) - station.value) > 1);
  assert.equal(nearestEstimate(station.x, station.z), station.value);
  for (const point of [[0, 0], [-0.5, 0.1], [0.75, 0.7]])
    assert.ok(STATIONS.some((s) => s.value === nearestEstimate(...point)));
});

test("probe targeting reaches the base beneath a raised surface", () => {
  const demo = Object.create(InterpolationExperience.prototype);
  demo.started = true;
  demo.finished = false;
  demo.model = new THREE.Group();
  demo.model.position.set(0, 1, -1.5);
  demo.model.rotation.x = 0.34;
  demo.model.scale.setScalar(0.53);
  const plane = () => new THREE.Mesh(new THREE.PlaneGeometry(2.08, 2.08),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  demo.pickSurface = plane();
  demo.pickSurface.rotation.x = -Math.PI / 2;
  demo.pickSurface.position.y = 0.005;
  const raised = plane();
  raised.rotation.x = -Math.PI / 2;
  raised.position.y = 0.55;
  demo.model.add(demo.pickSurface, raised);
  demo.model.updateWorldMatrix(true, true);
  const worldPoint = demo.model.localToWorld(new THREE.Vector3(0.3, 0.005, -0.2));
  const normal = new THREE.Vector3(0, 1, 0).transformDirection(demo.model.matrixWorld);
  const ray = new THREE.Raycaster(worldPoint.clone().addScaledVector(normal, 2),
    normal.clone().negate());
  assert.equal(ray.intersectObjects([raised, demo.pickSurface])[0].object, raised);
  const hit = demo.targetHit(ray);
  assert.equal(hit?.object, demo.pickSurface);
  assert.ok(hit.point.distanceTo(worldPoint) < 1e-6);
  demo.targets = [new THREE.Object3D()];
  demo.showTarget(0, hit);
  assert.equal(demo.targets[0].visible, true);
  assert.ok(Math.abs(demo.targets[0].position.x - 0.3) < 1e-6);
  demo.grab = { hands: new Map() };
  demo.placeProbe = (x, z) => { demo.probe = { x, z }; };
  assert.equal(demo.selectFromRay(ray), true);
  assert.ok(Math.abs(demo.probe.x - 0.3) < 1e-6);
  assert.ok(Math.abs(demo.probe.z + 0.2) < 1e-6);
  demo.showTarget(0, null);
  assert.equal(demo.targets[0].visible, false);
});
