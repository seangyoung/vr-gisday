import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  LayerExperience,
  highwayDeckHeight,
  highwayWalkingHeight,
  highwayZ,
  riverX,
} from "../src/layers/experience.js";
import { LandscapeTeleport, teleportStickAction } from "../src/layers/teleport.js";
import { PixelExperience } from "../src/pixels/experience.js";
import { ViewshedExperience } from "../src/viewshed/experience.js";

const cameraAtOrigin = () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 0);
  return camera;
};

test("right-stick forward aims and neutral release commits without stealing sideways turns", () => {
  assert.equal(teleportStickAction(false, 0, -0.9), "begin");
  assert.equal(teleportStickAction(false, 0.9, 0), "idle");
  assert.equal(teleportStickAction(false, 0.7, -0.9), "idle");
  assert.equal(teleportStickAction(true, 0.15, -0.5), "aim");
  assert.equal(teleportStickAction(true, 0, 0), "commit");
  assert.equal(teleportStickAction(true, 0.9, -0.4), "cancel");
  assert.equal(teleportStickAction(true, 0, 0.8), "cancel");
  assert.equal(teleportStickAction(true, NaN, 0), "cancel");
});

test("teleport ray chooses flat terrain, respects UI, and moves the world under the visitor", () => {
  const scene = new THREE.Scene();
  const demo = new LayerExperience(scene, () => {});
  const camera = cameraAtOrigin();
  demo.place(camera);
  demo.begin();
  const local = new THREE.Vector3(20, 10, -20);
  const ray = new THREE.Raycaster(
    demo.group.localToWorld(local), new THREE.Vector3(0, -1, 0),
  );
  const candidate = demo.teleportCandidate(ray);
  assert.equal(candidate.valid, true);
  assert.ok(Math.abs(candidate.x - 20) < 1e-9);
  assert.ok(Math.abs(candidate.z + 20) < 1e-9);
  assert.equal(demo.teleportCandidate(ray, { distance: 1 }), null);
  const heading = demo.group.rotation.y;
  const teleport = new LandscapeTeleport(scene);
  assert.equal(teleport.begin(demo), true);
  assert.equal(teleport.aim(ray).valid, true);
  assert.equal(teleport.marker.visible, true);
  assert.equal(teleport.release(camera), true);
  assert.equal(teleport.marker.visible, false);
  assert.ok(Math.abs(demo.visitor.x - 20) < 1e-9);
  assert.ok(Math.abs(demo.visitor.y + 20) < 1e-9);
  assert.equal(demo.group.rotation.y, heading);
  assert.equal(teleport.begin(demo), true);
  assert.equal(teleport.aim(new THREE.Raycaster(new THREE.Vector3(0, 2, 0),
    new THREE.Vector3(0, 1, 0))), null);
  assert.equal(teleport.release(camera), false);
  assert.ok(Math.abs(demo.visitor.x - 20) < 1e-9);
  teleport.dispose();
  demo.dispose();
  assert.equal(scene.children.length, 0);
});

test("teleport lands on an exposed bridge deck and retains its walking height", () => {
  const demo = new LayerExperience(new THREE.Scene(), () => {});
  const camera = cameraAtOrigin();
  demo.place(camera);
  demo.begin();
  demo.selected = new Set(["topography", "roads"]);
  demo.applyVisibility();
  const x = riverX(highwayZ(0));
  const z = highwayZ(x);
  const deck = highwayDeckHeight(x);
  const world = demo.group.localToWorld(new THREE.Vector3(x, deck + 12, z));
  const candidate = demo.teleportCandidate(new THREE.Raycaster(world, new THREE.Vector3(0, -1, 0)));
  assert.equal(candidate.valid, true);
  assert.equal(candidate.onRoad, true);
  assert.equal(demo.teleportTo(candidate, camera), true);
  assert.equal(demo.onRoad, true);
  assert.ok(Math.abs(demo.group.position.y + highwayWalkingHeight(candidate.x, candidate.z)) < 1e-6);
  demo.dispose();
});

test("the pixel and viewshed demos inherit teleport, with canyon walls rejected", () => {
  const camera = cameraAtOrigin();
  const pixels = new PixelExperience(new THREE.Scene(), () => {});
  pixels.place(camera);
  pixels.begin();
  const pixelRay = new THREE.Raycaster(
    pixels.group.localToWorld(new THREE.Vector3(25, 30, 25)),
    new THREE.Vector3(0, -1, 0),
  );
  assert.equal(pixels.teleportCandidate(pixelRay).valid, true);
  pixels.dispose();

  const viewshed = new ViewshedExperience(new THREE.Scene(), () => {});
  viewshed.place(camera);
  viewshed.begin();
  viewshed.setScene("redrock", camera);
  const river = viewshed.sceneChoice.river(0);
  const cliffX = river - 20;
  const cliffY = viewshed.sceneChoice.heightAt(cliffX, 0);
  const cliffRay = new THREE.Raycaster(
    viewshed.group.localToWorld(new THREE.Vector3(cliffX, cliffY + 40, 0)),
    new THREE.Vector3(0, -1, 0),
  );
  const cliff = viewshed.teleportCandidate(cliffRay);
  assert.equal(cliff.valid, false);
  assert.equal(viewshed.teleportTo(cliff, camera), false);
  viewshed.dispose();
});
