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
  const hand = rung.getWorldPosition(new THREE.Vector3());
  assert.equal(demo.gripRung(0, hand), false, "the introduction does not accept climbs");
  demo.begin();
  assert.equal(demo.marker.userData.steps.visible, false, "eye level keeps a short pole without steps");
  assert.equal(demo.marker.userData.lookout.visible, false, "eye level has no lookout deck");
  assert.equal(demo.gripRung(0, hand), false, "steps require selecting tower height");
  demo.setHeight(12);
  demo.update(1);
  assert.equal(demo.marker.userData.steps.visible, true);
  assert.equal(demo.marker.userData.lookout.visible, true, "tower mode shows where the climb ends");
  assert.ok(demo.marker.userData.mast.scale.y > 11.9);
  demo.visitor.set(demo.observer.x, demo.observer.z);
  demo.setVisualHeight(12);
  assert.equal(demo.marker.userData.eye.visible, false, "the nearby gold marker leaves the climb view clear");
  assert.ok(rung.position.x !== 0 &&
    Math.sign(rung.position.x) !== Math.sign(demo.marker.userData.rungs[1].position.x),
  "side-mounted steps alternate around the pole");
  for (const step of demo.marker.userData.rungs) {
    assert.equal(step.position.z, 0, "pegs emerge in the mast's own plane");
    assert.ok(Math.abs(Math.abs(step.position.x) - 0.21) < 0.09,
      "each peg's inner end penetrates the mast rather than floating beside it");
  }
  const topRungHeight = demo.marker.userData.rungs.at(-1).position.y;
  assert.ok(topRungHeight < 10.5 && topRungHeight > 10,
    "the rungs end at the deck opening");
  rung.getWorldPosition(hand);
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
  const otherHand = nextRung.getWorldPosition(new THREE.Vector3());
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

test("the tower top locks, restores the clipboard, and allows regripping to descend or drop", () => {
  const demo = new ViewshedExperience(new THREE.Scene(), () => {});
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 0);
  demo.place(camera);
  demo.begin();
  demo.setHeight(12);
  demo.update(1);
  demo.visitor.set(demo.observer.x, demo.observer.z - 0.25);
  const rung = demo.marker.userData.rungs.find((r) => r.position.y > 1.2);
  const hand = rung.getWorldPosition(new THREE.Vector3());
  assert.equal(demo.gripRung(1, hand), true);
  const lowCoverage = demo.analysis.visible;
  for (let i = 1; i <= 60; i++) {
    const next = hand.clone().add(new THREE.Vector3(0, -0.2 * i, 0));
    demo.updateClimb(new Map([[1, new THREE.Matrix4().setPosition(next)]]), 0.016);
  }
  assert.equal(demo.observer.height, 12);
  assert.equal(demo.isAtTop, true);
  assert.equal(demo.isClimbing, false);
  for (let i = 0; i < 30; i++) demo.updateClimb(new Map(), 0.016);
  assert.ok(Math.abs(demo.visitor.x - demo.observer.x) < 0.02);
  assert.ok(demo.visitor.y < demo.observer.z - 0.5,
    "the lookout places the visitor in front of the mast");
  demo.update(0.016);
  assert.equal(demo.marker.userData.eye.visible, false, "the gold marker clears the lookout view");
  assert.equal(demo.walk(0, -1, 0.5, camera).distance, 0, "the top perch prevents walking off");
  assert.ok(demo.analysis.visible >= lowCoverage);
  demo.releaseRung(1);
  for (let i = 0; i < 90; i++) demo.updateClimb(new Map(), 0.05);
  assert.equal(demo.climbHeight, 10.4, "letting go at the top keeps the visitor perched");
  demo.updateClipboard(null, camera, true);
  assert.equal(demo.clipboard.visible, true, "the clipboard returns at the top");
  const topRung = demo.marker.userData.rungs.at(-1);
  const topHand = topRung.getWorldPosition(new THREE.Vector3());
  const perchedY = demo.group.position.y;
  assert.equal(demo.gripRung(0, topHand), true, "gripping the pole resumes climbing");
  assert.equal(demo.isAtTop, false);
  demo.updateClimb(new Map([[0, new THREE.Matrix4().setPosition(topHand)]]), 0.016);
  assert.ok(demo.group.position.y > perchedY &&
    demo.group.position.y < demo.climbGroundY - 9.8,
  "the view begins descending smoothly toward the rungs");
  assert.equal(demo.isClimbing, true);
  assert.equal(demo.clipboard.visible, false);
  for (let i = 0; i < 45; i++)
    demo.updateClimb(new Map([[0, new THREE.Matrix4().setPosition(topHand)]]), 0.016);
  assert.ok(Math.abs(demo.climbHeight - 9.85) < 0.01);
  assert.ok(demo.lookoutSlide.length() < 0.01,
    "the view has returned from the platform to the rung side");
  demo.updateClimb(new Map([[0, new THREE.Matrix4().setPosition(
    topHand.clone().add(new THREE.Vector3(0, 0.02, 0)),
  )]]), 0.016);
  assert.equal(demo.isAtTop, false, "small hand jitter does not re-lock the platform");
  demo.updateClimb(new Map([[0, new THREE.Matrix4().setPosition(
    topHand.clone().add(new THREE.Vector3(0, 0.2, 0)),
  )]]), 0.016);
  assert.ok(demo.climbHeight < 9.8, "lifting the hand lowers the visitor");
  for (let i = 1; i <= 5; i++)
    demo.updateClimb(new Map([[0, new THREE.Matrix4().setPosition(
      topHand.clone().add(new THREE.Vector3(0, 0.2 - 0.2 * i, 0)),
    )]]), 0.016);
  assert.equal(demo.isAtTop, true, "climbing upward again can restore the top perch");
  topRung.getWorldPosition(topHand);
  assert.equal(demo.gripRung(0, topHand), true);
  assert.equal(demo.isAtTop, false);
  demo.releaseRung(0);
  for (let i = 0; i < 90 && demo.isClimbing; i++) demo.updateClimb(new Map(), 0.05);
  assert.equal(demo.climbHeight, 0);
  assert.equal(demo.observer.height, 12, "the chosen tower remains tall after a drop");
  assert.ok(demo.lookoutSlide.length() < 0.01, "descending returns from the lookout offset");
  demo.update(0.016);
  assert.equal(demo.marker.userData.eye.visible, false, "the marker stays clear while near the pole");
  demo.visitor.set(demo.observer.x + 2, demo.observer.z);
  demo.update(0.016);
  assert.equal(demo.marker.userData.eye.visible, true);
  demo.setHeight(2);
  demo.update(1);
  assert.equal(demo.marker.userData.steps.visible, false);
  assert.equal(demo.marker.userData.lookout.visible, false);
  assert.ok(demo.marker.userData.mast.scale.y < 2.1);
  demo.dispose();
});

test("gripping the platform rim pulls the view onto it, and pole grip eases back to the rungs", () => {
  const demo = new ViewshedExperience(new THREE.Scene(), () => {});
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 0);
  demo.place(camera);
  demo.begin();
  demo.setHeight(12);
  demo.update(1);
  demo.visitor.set(demo.observer.x, demo.observer.z - 0.25);
  demo.climbHeight = 9.3;
  demo.group.position.y = demo.climbGroundY - demo.climbHeight;
  demo.marker.updateWorldMatrix(true, true);
  const rim = demo.marker.userData.lookoutRims[1];
  const hand = rim.getWorldPosition(new THREE.Vector3());
  assert.equal(demo.gripRung(0, hand.clone().add(new THREE.Vector3(2, 0, 0))), false);
  assert.equal(demo.gripRung(0, hand), true);
  assert.equal(demo.lookoutTransition?.kind, "pull");
  const startingY = demo.group.position.y;
  demo.updateClimb(new Map(), 0.2);
  assert.ok(demo.group.position.y < startingY &&
    demo.group.position.y > demo.climbGroundY - 10.4,
  "the player rises through intermediate viewpoints");
  assert.equal(demo.isAtTop, false);
  demo.updateClimb(new Map(), 0.7);
  assert.equal(demo.isAtTop, true);
  assert.equal(demo.climbHeight, 10.4);
  assert.ok(demo.lookoutSlide.length() > 0.2);
  demo.updateClipboard(null, camera, true);
  assert.equal(demo.clipboard.visible, true);

  demo.marker.updateWorldMatrix(true, false);
  const pole = demo.marker.localToWorld(new THREE.Vector3(0, 10.7, 0));
  const topY = demo.group.position.y;
  assert.equal(demo.gripRung(1, pole), true);
  assert.equal(demo.lookoutTransition?.kind, "return");
  assert.equal(demo.group.position.y, topY, "gripping the pole starts without a jump");
  demo.updateClimb(new Map([[1, new THREE.Matrix4().setPosition(pole)]]), 0.2);
  assert.ok(demo.group.position.y > topY &&
    demo.group.position.y < demo.climbGroundY - 9.85,
  "the player descends through intermediate viewpoints");
  demo.updateClimb(new Map([[1, new THREE.Matrix4().setPosition(pole)]]), 0.5);
  assert.equal(demo.lookoutTransition, null);
  assert.equal(demo.isClimbing, true);
  assert.ok(demo.lookoutSlide.length() < 0.01);
  assert.ok(Math.abs(demo.climbHeight - 9.85) < 0.01);
  demo.releaseRung(1);
  demo.dispose();
});

test("clipboard scene choices swap terrain, map target, walking height, and visibility analysis", () => {
  assert.deepEqual(VIEWSHED_SCENES.map((scene) => scene.id), ["valley", "redrock"]);
  const demo = new ViewshedExperience(new THREE.Scene(), () => {});
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 0);
  demo.place(camera);
  demo.begin();
  const valleyPick = demo.pickGround;
  const valleyCoverage = demo.visiblePercent;
  for (const id of ["redrock"]) {
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
