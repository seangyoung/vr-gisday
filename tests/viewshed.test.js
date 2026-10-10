import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  TerrainSampler,
  calculateViewshed,
  lineOfSight,
} from "../src/viewshed/analysis.js";
import { ViewshedExperience } from "../src/viewshed/experience.js";
import { LANDSCAPE_EXTENT, landscapeHeight } from "../src/layers/experience.js";

test("a ridge blocks a low observer but a tower sees over it", () => {
  const ridge = (x) => (Math.abs(x - 4) < 0.7 ? 5 : 0);
  assert.equal(lineOfSight(ridge, { x: 0, z: 0, height: 2 }, { x: 10, z: 0 }, 0.25), false);
  assert.equal(lineOfSight(ridge, { x: 0, z: 0, height: 12 }, { x: 10, z: 0 }, 0.25), true);
  const low = calculateViewshed(ridge, { x: 0, z: 0, height: 2 }, { extent: 12, cells: 25, radius: 11, sampleStep: 0.25 });
  const high = calculateViewshed(ridge, { x: 0, z: 0, height: 12 }, { extent: 12, cells: 25, radius: 11, sampleStep: 0.25 });
  assert.ok(high.visible > low.visible);
  assert.equal(low.sampled, high.sampled);
});

test("the sampled DEM interpolates terrain and clamps to its domain", () => {
  const sampler = new TerrainSampler(10, 20, (x, z) => x * 0.5 + z * 0.25);
  assert.ok(Math.abs(sampler.sample(3.4, -2.7) - 1.025) < 1e-5);
  assert.ok(Number.isFinite(sampler.sample(100, 100)));
});

test("viewshed reuses the layered landscape and moves the observation point", () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071820);
  let changes = 0;
  const demo = new ViewshedExperience(scene, () => changes++);
  assert.equal(demo.selected.has("topography"), true);
  assert.equal(demo.selected.has("population"), false);
  assert.equal(demo.ground.raised.geometry.attributes.position.count, 401 ** 2);
  assert.ok(demo.analysis.sampled > 0);
  assert.ok(demo.visiblePercent >= 0 && demo.visiblePercent <= 100);
  const lowVisible = demo.analysis.visible;
  demo.setHeight(12);
  assert.ok(demo.analysis.visible >= lowVisible);
  demo.placeFromMap({ uv: new THREE.Vector2(0.6, 0.62) });
  assert.ok(Math.abs(demo.observer.x - LANDSCAPE_EXTENT * 0.2) < 1e-9);
  assert.ok(Math.abs(demo.observer.z + LANDSCAPE_EXTENT * 0.24) < 1e-9);
  demo.setView("map");
  assert.equal(demo.view, "map");
  const ray = new THREE.Raycaster(
    new THREE.Vector3(-32, 50, -30),
    new THREE.Vector3(0, -1, 0),
  );
  assert.equal(demo.placeFromRay(ray), true);
  assert.ok(Math.abs(demo.observer.x + 32) < 1);
  assert.ok(Math.abs(demo.observer.z + 30) < 1);
  assert.ok(Math.abs(demo.marker.position.y - landscapeHeight(demo.observer.x, demo.observer.z)) < 1e-9);
  demo.update(240);
  assert.equal(demo.finished, true);
  demo.reset();
  assert.equal(demo.finished, false);
  assert.deepEqual(demo.observer, { x: 0, z: 0, height: 2 });
  assert.ok(changes >= 5);
  demo.dispose();
  assert.equal(scene.children.length, 0);
});
