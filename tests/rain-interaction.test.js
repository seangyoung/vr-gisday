import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { RainExperience } from "../src/rain/experience.js";
import { createHeights, cellAt } from "../src/rain/terrain.js";
// Only text sprites need a canvas; geometry and controller motion use real Three.js.
globalThis.document = {
  createElement: () => ({
    getContext: () => ({ fillRect() {}, fillText() {} }),
  }),
};

test("controller stroke edits mesh, survives mode switch, cancels safely, and restores exactly", () => {
  const r = new RainExperience(new THREE.Scene(), () => {});
  r.explore();
  r.setMode("sculpt");
  const hand = new THREE.Vector3(-0.3, 0.8, -0.4);
  r.beginStroke(0, new THREE.Vector3(-0.3, 0.4, -0.4), hand);
  r.beginStroke(1, new THREE.Vector3(), hand);
  assert.equal(r.stroke.id, 0);
  r.moveStroke(1, hand.clone().addScalar(0.2));
  assert.deepEqual(r.heights, createHeights());
  for (let i = 1; i <= 10; i++)
    r.moveStroke(0, hand.clone().add(new THREE.Vector3(0, -i * 0.06, 0)));
  const id = cellAt(-0.3, -0.4);
  assert.ok(r.heights[id] < createHeights()[id]);
  assert.ok(
    Math.abs(r.terrain.geometry.attributes.position.getY(id) - r.heights[id]) <
      1e-6,
  );
  r.setMode("rain");
  assert.equal(r.stroke, null);
  assert.equal(r.basins[id], "sink");
  const edited = r.heights.slice();
  r.moveStroke(0, new THREE.Vector3());
  assert.deepEqual(r.heights, edited);
  r.burst(id);
  assert.equal(r.drops[0].outlet, "sink");
  for (let i = 0; i < 240; i++) r.update(0.05);
  assert.ok(r.water.added > 0);
  assert.ok(r.ponds.count > 0);
  assert.ok(r.shoreline.geometry.drawRange.count > 0);
  r.setMode("sculpt");
  assert.equal(r.water.stored, 0);
  assert.equal(r.ponds.count, 0);
  r.restore();
  assert.deepEqual(r.heights, createHeights());
  assert.equal(r.basins[id], "A");
  assert.equal(r.drops.length, 0);
  assert.equal(r.edited, false);
  r.setMode("sculpt");
  r.beginStroke(0, hand, hand);
  r.elapsed = 239.99;
  r.update(0.02, true);
  assert.equal(r.stage, 4);
  assert.equal(r.stroke, null);
  r.dispose();
});

test("terrain transforms preserve water and geometry; reset restores full pose and mode changes release grips", () => {
  const r = new RainExperience(new THREE.Scene(), () => {});
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 0);
  r.place(camera);
  const original = r.group.position.clone();
  r.water.add(cellAt(-0.3, -0.4), 0.001);
  const heights = r.heights.slice();
  const volume = r.water.stored;
  const hand = new THREE.Matrix4().makeTranslation(0, 1, -1);
  r.grab.begin(0, hand);
  const moved = new THREE.Matrix4()
    .makeRotationX(0.6)
    .setPosition(0.5, 1.2, -1.3);
  r.grab.update(new Map([[0, moved]]));
  assert.ok(r.group.position.distanceTo(original) > 0.1);
  assert.ok(Math.abs(r.group.rotation.x) > 0.1);
  assert.deepEqual(r.heights, heights);
  assert.equal(r.water.stored, volume);
  r.place(camera);
  assert.equal(r.grab.hands.size, 0);
  assert.ok(r.group.position.distanceTo(original) < 1e-9);
  assert.ok(Math.abs(r.group.rotation.x) < 1e-9);
  assert.equal(r.group.scale.x, 0.43);
  assert.equal(r.water.stored, volume);
  r.grab.begin(0, hand);
  r.setMode("sculpt");
  assert.equal(r.grab.hands.size, 0);
  r.dispose();
});

test("a sculpted pond announces real overflow only after water crosses its divide", () => {
  const events = [];
  const r = new RainExperience(new THREE.Scene(), () => {}, "drainage", (event) => events.push(event));
  r.explore();
  r.applyBrush(-0.3, -0.4, -0.5);
  r.endStroke();
  const sink = r.cellAt(-0.3, -0.4);
  assert.equal(r.basins[sink], "sink");
  for (let i = 0; i < 200 && !r.overflowAnnounced; i++) {
    r.water.add(sink, 0.001);
    r.update(0.02);
  }
  assert.equal(r.overflowAnnounced, true);
  assert.equal(events.filter((event) => event === "spill").length, 1);
  r.dispose();
});

test("erosion tray updates rendered heights and reset restores the experiment without moving the model", () => {
  const r = new RainExperience(new THREE.Scene(), () => {}, "erosion");
  r.explore();
  r.pouring = true;
  const original = r.heights.slice();
  r.group.position.set(0.3, 1, -1.5);
  for (let i = 0; i < 240; i++) r.update(0.05);
  assert.ok(Math.max(...r.heights.map((v, i) => original[i] - v)) > 0.1);
  const reference = r.originalBed.geometry.attributes.position.array.slice();
  r.originalBed.visible = true;
  r.update(0.1);
  assert.deepEqual(r.originalBed.geometry.attributes.position.array, reference);
  assert.ok(r.water.eroded > 0);
  assert.notDeepEqual(r.heights, original);
  const geometry = r.terrain.geometry.attributes.position;
  for (let i = 0; i < original.length; i++)
    assert.ok(Math.abs(geometry.getY(i) - r.heights[i]) < 0.005);
  r.pouring = false;
  assert.ok(r.replayFrames.length > 2);
  const changed = [...original].findIndex((v, i) => Math.abs(v - r.heights[i]) > 0.05);
  assert.ok(changed >= 0);
  const finalBed = r.heights.slice(), stored = r.water.stored;
  assert.equal(r.startReplay(), true);
  r.update(0.01);
  assert.ok(Math.abs(geometry.getY(changed) - original[changed]) < 1e-6);
  assert.deepEqual(r.heights, finalBed);
  assert.equal(r.water.stored, stored);
  r.endReplay();
  assert.ok(Math.abs(geometry.getY(changed) - finalBed[changed]) < 1e-6);
  r.restore();
  assert.deepEqual(r.heights, original);
  assert.equal(r.water.eroded, 0);
  assert.equal(r.originalBed.visible, false);
  assert.equal(r.water.stored, 0);
  assert.equal(r.group.position.x, 0.3);
  r.elapsed = 239.99;
  r.pouring = true;
  r.update(0.02);
  assert.equal(r.stage, 4);
  assert.equal(r.pouring, false);
  r.dispose();
});

test("high-resolution erosion sculpting rebases the experiment and preserves the edited bed", () => {
  const r = new RainExperience(new THREE.Scene(), () => {}, "erosion");
  r.explore();
  assert.equal(r.size, 65);
  assert.equal(r.heights.length, 65 * 65);
  assert.equal(r.water.size, r.size);
  assert.equal(
    r.waterSurface.mesh.geometry.attributes.position.count,
    r.heights.length,
  );
  r.pouring = true;
  for (let i = 0; i < 100; i++) r.update(0.05);
  r.setMode("sculpt");
  assert.equal(r.pouring, false);
  assert.equal(r.water.stored, 0);
  assert.equal(r.water.suspended, 0);
  const center = r.cellAt(0, -0.4),
    before = r.heights[center];
  r.beginStroke(
    0,
    new THREE.Vector3(0, before, -0.4),
    new THREE.Vector3(0, 1, -0.4),
  );
  r.moveStroke(0, new THREE.Vector3(0, 1.08, -0.4));
  r.endStroke();
  assert.ok(r.heights[center] > before);
  const edited = r.heights.slice();
  r.setMode("rain");
  assert.deepEqual(r.heights, edited);
  assert.deepEqual(r.water.initial, edited);
  const reference = r.originalBed.geometry.attributes.position;
  for (let i = 0; i < reference.count; i++)
    assert.ok(
      Math.abs(
        reference.getY(i) -
          edited[r.cellAt(reference.getX(i), reference.getZ(i))] -
          0.003,
      ) < 1e-6,
    );
  assert.equal(r.water.eroded, 0);
  r.pouring = true;
  for (let i = 0; i < 240; i++) r.update(0.05);
  assert.ok(r.water.eroded > 0);
  assert.notDeepEqual(r.heights, edited);
  assert.ok(r.waterSurface.mesh.geometry.drawRange.count > 0);
  r.clearWater();
  r.waterSurface.update(r.heights, r.water);
  assert.equal(r.waterSurface.mesh.geometry.drawRange.count, 0);
  r.restore();
  assert.equal(r.waterSurface.mesh.visible, false);
  assert.equal(r.originalBed.visible, false);
  r.dispose();
});

for (const kind of ["drainage", "erosion"])
  test(`${kind}: sculpt and rain together without clearing water`, () => {
    const r = new RainExperience(new THREE.Scene(), () => {}, kind);
    r.explore();
    const id = r.cellAt(-0.3, -0.4);
    r.water.add(id, 0.002);
    const water = r.water,
      volume = water.stored;
    const before = r.heights.slice();
    r.beginStroke(
      0,
      new THREE.Vector3(-0.3, before[id], -0.4),
      new THREE.Vector3(-0.3, 1, -0.4),
    );
    r.moveStroke(0, new THREE.Vector3(-0.3, 1.07, -0.4));
    assert.ok(r.heights[id] > before[id]);
    assert.equal(r.brush.visible, true);
    const pausedHeight = r.heights[id];
    r.moveStroke(0, new THREE.Vector3(-0.3, 1.1, -0.4), false);
    assert.equal(r.brush.visible, false);
    assert.equal(r.heights[id], pausedHeight);
    assert.equal(r.water, water);
    assert.equal(r.water.stored, volume);
    r.setSource(id);
    // Drainage particles must finish their downhill path before delivering water.
    for (let i = 0; i < 300; i++) r.update(0.02, true);
    assert.ok(r.water.added > 0.002);
    assert.equal(r.stroke.id, 0);
    r.endStroke(0);
    assert.equal(r.stroke, null);
    assert.equal(r.brush.visible, false);
    r.grab.begin(1, new THREE.Matrix4());
    r.beginStroke(0, new THREE.Vector3(), new THREE.Vector3());
    assert.equal(r.stroke, null);
    r.dispose();
  });

for (const kind of ["drainage", "erosion"])
  test(`${kind}: trigger roles follow handedness rather than controller index`, () => {
    const r = new RainExperience(new THREE.Scene(), () => {}, kind);
    r.explore();
    const hit = new THREE.Vector3(0, 0.4, -0.4),
      hand = new THREE.Vector3(0, 1, -0.4);
    for (const [left, right] of [
      [0, 1],
      [1, 0],
    ]) {
      assert.equal(r.beginTrigger("left", left, hit, hand), "rain");
      assert.equal(r.stroke, null);
      assert.equal(r.beginTrigger("right", right, hit, hand), "sculpt");
      assert.equal(r.stroke.id, right);
      r.endStroke(left);
      assert.equal(r.stroke.id, right);
      r.endStroke(right);
      assert.equal(r.stroke, null);
    }
    assert.equal(r.beginTrigger("none", 0, hit, hand), null);
    assert.equal(r.beginTrigger("right", 0, hit, null), null);
    r.grab.begin(0, new THREE.Matrix4());
    assert.equal(r.beginTrigger("left", 1, hit, hand), null);
    assert.equal(r.beginTrigger("right", 1, hit, hand), null);
    r.dispose();
  });
