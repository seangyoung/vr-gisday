import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  TerrainSampler,
  calculateViewshed,
  lineOfSight,
  traceSightline,
} from "../src/viewshed/analysis.js";
import { ViewshedExperience } from "../src/viewshed/experience.js";
import { LANDSCAPE_EXTENT, landscapeHeight } from "../src/layers/experience.js";
import { VIEWSHED_SCENES } from "../src/viewshed/scenes.js";

test("a ridge blocks a low observer but a tower sees over it", () => {
  const ridge = (x) => (Math.abs(x - 4) < 0.7 ? 5 : 0);
  assert.equal(lineOfSight(ridge, { x: 0, z: 0, height: 2 }, { x: 10, z: 0 }, 0.25), false);
  assert.equal(lineOfSight(ridge, { x: 0, z: 0, height: 12 }, { x: 10, z: 0 }, 0.25), true);
  const blocked = traceSightline(ridge, { x: 0, z: 0, height: 2 }, { x: 10, z: 0 }, 0.25);
  assert.equal(blocked.visible, false);
  assert.ok(blocked.end.x > 3 && blocked.end.x < 5);
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
  assert.equal(demo.started, false);
  assert.equal(demo.marker.visible, false);
  demo.update(240);
  assert.equal(demo.finished, false);
  assert.equal(demo.elapsed, 0);
  demo.setHeight(12);
  assert.equal(demo.observer.height, 2);
  demo.begin();
  assert.equal(demo.started, true);
  assert.equal(demo.marker.visible, true);
  assert.equal(demo.selected.has("topography"), true);
  assert.equal(demo.selected.has("hydrology"), true);
  assert.equal(demo.selected.has("vegetation"), false);
  assert.equal(demo.selected.has("roads"), false);
  assert.equal(demo.variants.raised.vegetation.visible, false);
  assert.equal(demo.variants.raised.roads.visible, false);
  assert.equal(demo.selected.has("boundaries"), false);
  assert.equal(demo.view, "map");
  assert.ok(demo.pickGround.geometry.attributes.position.count < demo.ground.raised.geometry.attributes.position.count / 10);
  assert.equal(demo.ground.raised.geometry.attributes.position.count, 401 ** 2);
  assert.ok(demo.analysis.sampled > 0);
  assert.ok(demo.visiblePercent >= 0 && demo.visiblePercent <= 100);
  const lowVisible = demo.analysis.visible;
  assert.equal(demo.trace.visible, false);
  demo.setHeight(12);
  assert.ok(demo.analysis.visible >= lowVisible);
  assert.equal(demo.trace.visible, true);
  demo.placeFromMap({ uv: new THREE.Vector2(0.6, 0.62) });
  assert.ok(Math.abs(demo.observer.x - LANDSCAPE_EXTENT * 0.2) < 1e-9);
  assert.ok(Math.abs(demo.observer.z + LANDSCAPE_EXTENT * 0.24) < 1e-9);
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
  assert.equal(demo.started, true);
  assert.deepEqual(demo.observer, { x: 0, z: -3.4, height: 2 });
  demo.finish();
  assert.equal(demo.finished, true);
  demo.reset();
  assert.equal(demo.finished, false);
  assert.ok(changes >= 5);
  demo.dispose();
  assert.equal(scene.children.length, 0);
});

test("rung grips pull the visitor upward, pause walking, and release into a return to ground", () => {
  const demo = new ViewshedExperience(new THREE.Scene(), () => {});
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 0);
  demo.place(camera);
  const rung = demo.marker.userData.rungs.find((r) => r.position.y > 1.2);
  const hand = demo.marker.localToWorld(rung.position.clone());
  assert.equal(demo.gripRung(0, hand), false, "the introduction does not accept climbs");
  demo.begin();
  assert.equal(demo.gripRung(0, hand.clone().add(new THREE.Vector3(2, 0, 0))), false);
  assert.equal(demo.gripRung(0, hand), true);
  assert.equal(demo.isClimbing, true);
  demo.updateClipboard(null, camera, true);
  assert.equal(demo.clipboard.visible, false);
  const startPosition = demo.group.position.clone();
  assert.equal(demo.walk(1, 0, 0.5, camera).distance, 0);
  assert.ok(demo.group.position.distanceTo(startPosition) < 1e-9);

  const pulled = hand.clone().add(new THREE.Vector3(0, -0.2, 0));
  demo.updateClimb(new Map([[0, new THREE.Matrix4().setPosition(pulled)]]), 0.016);
  assert.ok(demo.climbHeight > 0.19);
  assert.ok(demo.group.position.y < startPosition.y - 0.19);
  const nextRung = demo.marker.userData.rungs.find((r) => r.position.y > 1.7);
  const otherHand = demo.marker.localToWorld(nextRung.position.clone());
  assert.equal(demo.gripRung(1, otherHand), true);
  demo.releaseRung(0);
  demo.updateClimb(new Map([[1, new THREE.Matrix4().setPosition(
    otherHand.clone().add(new THREE.Vector3(0, -0.1, 0)),
  )]]), 0.016);
  assert.ok(demo.climbHeight > 0.29, "the second hand continues the climb");
  demo.releaseRung(1);
  for (let i = 0; i < 40; i++) demo.updateClimb(new Map(), 0.05);
  assert.equal(demo.climbHeight, 0);
  assert.equal(demo.isClimbing, false);
  assert.ok(Math.abs(demo.group.position.y - startPosition.y) < 1e-9);
  demo.dispose();
});

test("reaching the tower top updates the viewshed and dropping restores eye level", () => {
  const demo = new ViewshedExperience(new THREE.Scene(), () => {});
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 0);
  demo.place(camera);
  demo.begin();
  const rung = demo.marker.userData.rungs.find((r) => r.position.y > 1.2);
  const hand = demo.marker.localToWorld(rung.position.clone());
  assert.equal(demo.gripRung(1, hand), true);
  const lowCoverage = demo.analysis.visible;
  for (let i = 1; i <= 60; i++) {
    const next = hand.clone().add(new THREE.Vector3(0, -0.2 * i, 0));
    demo.updateClimb(new Map([[1, new THREE.Matrix4().setPosition(next)]]), 0.016);
  }
  assert.equal(demo.observer.height, 12);
  assert.ok(demo.analysis.visible >= lowCoverage);
  demo.releaseRung(1);
  for (let i = 0; i < 90 && demo.isClimbing; i++) demo.updateClimb(new Map(), 0.05);
  assert.equal(demo.climbHeight, 0);
  assert.equal(demo.observer.height, 2);
  demo.dispose();
});

test("clipboard scene choices swap terrain, map target, walking height, and visibility analysis", () => {
  const demo = new ViewshedExperience(new THREE.Scene(), () => {});
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 0);
  demo.place(camera);
  demo.begin();
  const valleyPick = demo.pickGround;
  const valleyCoverage = demo.visiblePercent;
  for (const id of ["redrock", "mesa"]) {
    demo.setScene(id, camera);
    const spec = VIEWSHED_SCENES.find((scene) => scene.id === id);
    assert.equal(demo.sceneChoice, spec);
    assert.equal(demo.variants.raised.world.visible, false);
    assert.notEqual(demo.pickGround, valleyPick);
    assert.equal(demo.canyonWorlds.get(id).world.visible, true);
    assert.ok(Math.abs(demo.marker.position.y - spec.heightAt(spec.start.x, spec.start.z)) < 1e-9);
    assert.ok(Math.abs(demo.targetRing.position.y - spec.heightAt(spec.target.x, spec.target.z) - 0.2) < 1e-9);
    assert.equal(demo.targetRing.children[0].material.depthTest, true,
      "the ground ring respects terrain and clipboard depth");
    assert.ok(demo.targetRing.children.some((mesh) => mesh.renderOrder === 5 && !mesh.material.depthTest),
      "an elevated beacon locates the hidden ground target");
    assert.ok(Math.abs(demo.sampler.sample(25, 10) - spec.heightAt(25, 10)) < 0.03);
    assert.ok(spec.water(100) < spec.water(-100), "the river runs downhill");
    assert.ok(demo.visiblePercent < valleyCoverage, "the canyon has more visible occlusion");
    assert.equal(demo.trace.visible, false, "the canyon blocks the blue target at eye level");
    const low = demo.analysis.visible;
    demo.setHeight(12);
    assert.ok(demo.analysis.visible > low, "climbing reveals more terrain");
    assert.equal(demo.trace.visible, true, "the tower clears the canyon obstruction");
    demo.reset();
    assert.equal(demo.sceneChoice, spec, "reset preserves the chosen scene");
    assert.deepEqual(demo.observer, { ...spec.start, height: 2 });
  }
  demo.setScene("valley", camera);
  assert.equal(demo.pickGround, valleyPick);
  assert.equal(demo.variants.raised.world.visible, true);
  assert.ok([...demo.canyonWorlds.values()].every((item) => !item.world.visible));
  assert.ok(Math.abs(demo.sampler.sample(25, 10) - landscapeHeight(25, 10)) < 0.03);
  demo.dispose();
});
