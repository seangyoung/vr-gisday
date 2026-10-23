import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { InterpolationExperience } from "../src/interpolation/experience.js";
import {
  STATIONS, idwEstimate, idwWorkedFraction, nearestEstimate, smoothEstimate,
} from "../src/interpolation/model.js";

globalThis.document = {
  createElement: () => ({
    width: 256, height: 80,
    getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
      beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
      measureText: (text) => ({ width: text.length * 24 }) }),
  }),
};

test("IDW honors measured readings and normalized neighbor weights", () => {
  for (const station of STATIONS)
    assert.equal(idwEstimate(station.x, station.z).value, station.value);
  const estimate = idwEstimate(0.04, 0.08);
  assert.equal(estimate.neighbors.length, 3);
  assert.ok(Math.abs(estimate.neighbors.reduce((sum, n) => sum + n.weight, 0) - 1) < 1e-12);
  assert.ok(Math.abs(estimate.value - estimate.neighbors.reduce((sum, n) =>
    sum + n.station.value * n.weight, 0)) < 1e-12);
});

test("the displayed IDW fraction matches a worked three-neighbor example", () => {
  const stations = [
    { x: 350, z: 0, value: 12 },
    { x: 750, z: 0, value: 10 },
    { x: 850, z: 0, value: 10 },
  ];
  const p1 = idwEstimate(0, 0, stations, 3, 1);
  const p2 = idwEstimate(0, 0, stations, 3, 2);
  assert.equal(p1.value.toFixed(1), "11.1");
  assert.equal(p2.value.toFixed(1), "11.4");
  assert.deepEqual(idwWorkedFraction(p2), {
    exact: false, count: 3, power: 2,
    numerator: "12/350² + 10/750² + 10/850²",
    denominator: "1/350² + 1/750² + 1/850²",
    value: p2.value,
  });
  const atGauge = idwWorkedFraction(idwEstimate(STATIONS[0].x,
    STATIONS[0].z));
  assert.deepEqual(atGauge, { exact: true, value: STATIONS[0].value });
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

test("pointing at a gauge head reveals its reading until the ray moves away", () => {
  const demo = new InterpolationExperience(new THREE.Group(), () => {}, new THREE.Scene());
  const camera = new THREE.PerspectiveCamera();
  camera.position.y = 1.6;
  demo.place(camera);
  demo.begin();
  demo.model.updateWorldMatrix(true, true);
  const head = demo.stationHeads[0].getWorldPosition(new THREE.Vector3());
  const ray = new THREE.Raycaster(
    head.clone().add(new THREE.Vector3(0, 0, 0.5)),
    new THREE.Vector3(0, 0, -1),
  );
  const hit = demo.gaugeHit(ray);
  assert.equal(hit?.object.userData.gaugeIndex, 0);
  demo.showGaugeHover(0, hit);
  assert.equal(demo.stationValueTags[0].visible, true);
  assert.equal(demo.stationValueTags[1].visible, false);
  demo.showGaugeHover(0, null);
  assert.equal(demo.stationValueTags[0].visible, false);
  demo.dispose();
});

test("the rainfall model turns with a held grip without moving its estimate", () => {
  const demo = new InterpolationExperience(new THREE.Group(), () => {}, new THREE.Scene());
  const camera = new THREE.PerspectiveCamera();
  camera.position.y = 1.6;
  demo.place(camera);
  demo.begin();
  const estimate = demo.displayValue;
  const center = demo.model.localToWorld(demo.grab.turnPivot.clone());
  const hand = new THREE.Matrix4().makeTranslation(0, 1.3, -1);
  demo.grab.begin(0, hand);
  assert.equal(demo.grab.turnWithStick(0, 1, 0, camera), true);
  assert.ok(demo.model.localToWorld(demo.grab.turnPivot.clone())
    .distanceTo(center) < 1e-8);
  assert.equal(demo.displayValue, estimate);
  demo.dispose();
});
