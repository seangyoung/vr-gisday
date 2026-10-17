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
  assert.equal(r.group.visible, false, "the drainage takeaway hides its landscape");
  assert.equal(r.stroke, null);
  r.dispose();
});

test("terrain transforms preserve water and geometry; reset restores full pose and mode changes release grips", () => {
  const r = new RainExperience(new THREE.Scene(), () => {});
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 0);
  r.place(camera);
  const original = r.group.position.clone();
  assert.ok(original.y < camera.position.y - 0.15);
  assert.ok(r.group.rotation.x > 0.4);
  const surface = r.group.localToWorld(new THREE.Vector3(0, r.heights[cellAt(0, 0)], 0));
  const ray = new THREE.Raycaster(camera.position,
    surface.clone().sub(camera.position).normalize());
  assert.ok(r.grabHit(ray));
  assert.ok(r.handNear(surface));
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
  assert.ok(Math.abs(r.group.rotation.x - 0.42) < 1e-9);
  assert.equal(r.group.scale.x, 0.43);
  assert.equal(r.water.stored, volume);
  r.grab.begin(0, hand);
  r.setMode("sculpt");
  assert.equal(r.grab.hands.size, 0);
  r.dispose();
});

test("erosion tray has a visible base and corners with translucent soil sides", () => {
  const r = new RainExperience(new THREE.Scene(), () => {}, "erosion");
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 0);
  r.place(camera);
  assert.ok(r.group.rotation.x > 0.45);
  assert.ok(r.group.position.y < camera.position.y - 0.14);
  assert.ok(r.soilBase);
  assert.ok(r.soilBase.position.y < r.soilFloorY);
  assert.equal(r.soilCorners.length, 4);
  assert.equal(r.soilWalls.material.transparent, true);
  assert.ok(r.soilWalls.material.opacity < 0.8);
  r.group.rotation.x = 0;
  r.place(camera);
  assert.ok(r.group.rotation.x > 0.45);
  r.dispose();
});

test("both soil profiles follow the terrain edge during display changes and reset", () => {
  for (const kind of ["erosion", "drainage"]) {
    const r = new RainExperience(new THREE.Scene(), () => {}, kind);
    const rim = r.soilRim[Math.floor(r.soilRim.length / 2)];
    const changed = r.heights.slice();
    changed[rim] += 0.15;
    r.showReplayFrame(changed);
    const walls = r.soilWalls.geometry.attributes.position;
    const index = r.soilRim.indexOf(rim) * 6;
    assert.ok(Math.abs(walls.getY(index) - changed[rim]) < 1e-6);
    assert.ok(Math.abs(walls.getY(index + 2) - r.soilFloorY) < 1e-6);
    r.restore();
    assert.ok(Math.abs(walls.getY(index) - r.heights[rim]) < 1e-6);
    r.dispose();
  }
});

test("both tabletop rain models can be snap-turned without changing the terrain", () => {
  for (const kind of ["drainage", "erosion"]) {
    const rain = new RainExperience(new THREE.Scene(), () => {}, kind);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 0);
    rain.place(camera);
    rain.explore();
    const terrain = rain.heights.slice();
    const center = rain.group.localToWorld(rain.grab.turnPivot.clone());
    const hand = new THREE.Matrix4().makeTranslation(0, 1.4, -1);
    rain.grab.begin(0, hand);
    assert.equal(rain.grab.turnWithStick(0, 1, 0, camera), true);
    assert.ok(rain.group.localToWorld(rain.grab.turnPivot.clone())
      .distanceTo(center) < 1e-8);
    assert.deepEqual(rain.heights, terrain);
    rain.dispose();
  }
});

test("erosion tray paints vegetation with the right trigger while rain stays available", () => {
  const r = new RainExperience(new THREE.Scene(), () => {}, "erosion");
  r.explore();
  const originalBed = r.heights.slice();
  const water = r.water;
  r.setBrushTool("vegetation");
  const start = new THREE.Vector3(-0.3, r.heights[r.cellAt(-0.3, -0.4)], -0.4);
  const hand = new THREE.Vector3(-0.3, 1, -0.4);
  assert.equal(r.beginTrigger("right", 0, start, hand), "plant");
  assert.equal(r.beginTrigger("left", 1, start, hand), "rain");
  const end = new THREE.Vector3(0.3, r.heights[r.cellAt(0.3, -0.4)], -0.4);
  r.moveStroke(0, hand, end);
  assert.ok(r.vegetation[r.cellAt(-0.3, -0.4)] > 0);
  assert.ok(r.vegetation[r.cellAt(0, -0.4)] > 0, "a sweep covers the cells between ray samples");
  assert.ok(r.vegetation[r.cellAt(0.3, -0.4)] > 0);
  assert.equal(r.vegetation[r.cellAt(0.7, 0.4)], 0);
  assert.deepEqual(r.heights, originalBed);
  assert.equal(r.water, water);
  r.moveStroke(0, hand, null);
  assert.equal(r.brush.visible, false);
  r.endStroke(0);
  r.setBrushTool("earth");
  assert.ok(r.vegetation[r.cellAt(0, -0.4)] > 0);
  assert.equal(r.water, water);
  r.restore();
  assert.equal(r.brushTool, "earth");
  assert.ok(r.vegetation.every((value) => value === 0));
  assert.equal(r.water.vegetation, r.vegetation);
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

test("takeaway replay holds its final frame until the visitor returns", () => {
  const r = new RainExperience(new THREE.Scene(), () => {}, "erosion");
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 0);
  r.place(camera);
  r.explore();
  const id = r.cellAt(0, 0);
  const original = r.heights[id];
  r.heights[id] -= 0.08;
  r.showReplayFrame(r.heights);
  r.finish();
  assert.equal(r.stage, 4);
  assert.equal(r.group.visible, false, "the erosion takeaway hides its tray");
  assert.equal(r.replayFrames.length, 2);
  assert.equal(r.startReplay(), true);
  assert.equal(r.group.visible, true, "Replay restores the saved tray view");
  r.update(0.01);
  assert.ok(Math.abs(r.terrain.geometry.attributes.position.getY(id) - original) < 1e-6);
  r.update(4);
  assert.equal(r.stage, 4);
  assert.equal(r.replayTime, 4);
  assert.equal(r.group.visible, true, "the tray stays visible on the last replay frame");
  assert.ok(Math.abs(r.terrain.geometry.attributes.position.getY(id) - (original - 0.08)) < 1e-6);
  r.update(10);
  assert.equal(r.replayTime, 4, "the replay remains paused on its final frame");
  assert.equal(r.group.visible, true);
  const left = new THREE.Matrix4().makeTranslation(-0.2, 1.4, -1);
  const right = new THREE.Matrix4().makeTranslation(0.2, 1.4, -1);
  r.grab.begin(0, left);
  r.grab.begin(1, right);
  const originalScale = r.group.scale.x;
  r.grab.update(new Map([
    [0, new THREE.Matrix4().makeTranslation(-0.35, 1.4, -1)],
    [1, new THREE.Matrix4().makeTranslation(0.35, 1.4, -1)],
  ]));
  assert.ok(r.group.scale.x > originalScale, "the held model can still be resized");
  r.grab.release(1);
  assert.equal(r.grab.turnWithStick(0, 1, 0, camera), true);
  r.endReplay();
  assert.equal(r.replayTime, -1);
  assert.equal(r.group.visible, false, "Return to Takeaway hides the tray");
  assert.equal(r.grab.hands.size, 0, "returning also releases any active grip");
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
  test(`${kind}: a tilted model sculpts only at the locked spot from vertical hand travel`, () => {
    const r = new RainExperience(new THREE.Scene(), () => {}, kind);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 0);
    r.place(camera);
    r.explore();
    const id = r.cellAt(-0.3, -0.4);
    const localHit = new THREE.Vector3(-0.3, r.heights[id], -0.4);
    const hit = r.group.localToWorld(localHit);
    const hand = hit.clone().add(new THREE.Vector3(0, 0.35, 0));
    const original = r.heights.slice();
    r.beginStroke(0, hit, hand);
    r.moveStroke(0, hand.clone().add(new THREE.Vector3(0.4, 0, 0.4)));
    assert.deepEqual(r.heights, original,
      "sideways hand motion must not sculpt a pitched surface");
    r.moveStroke(0, hand.clone().add(new THREE.Vector3(0.4, 0.06, 0.4)));
    assert.ok(r.heights[id] > original[id]);
    assert.ok(Math.abs(r.stroke.center.x + 0.3) < 1e-9);
    assert.ok(Math.abs(r.stroke.center.z + 0.4) < 1e-9);
    r.endStroke(0);
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
    const heldHeight = r.heights[id];
    r.moveStroke(0, new THREE.Vector3(-0.3, 1.1, -0.4));
    assert.equal(r.brush.visible, true);
    assert.ok(r.heights[id] > heldHeight);
    assert.equal(r.stroke.center.x, -0.3);
    assert.equal(r.stroke.center.z, -0.4);
    const other = r.cellAt(0.4, 0.3),
      otherBefore = r.heights[other];
    r.moveStroke(0, new THREE.Vector3(-0.3, 1.12, -0.4));
    r.moveStroke(0, new THREE.Vector3(1, 1.16, 1));
    assert.equal(r.stroke.center.x, -0.3);
    assert.equal(r.stroke.center.z, -0.4);
    assert.equal(r.heights[other], otherBefore,
      "moving the ray or hand sideways cannot move the active brush");
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
    r.beginStroke(0, new THREE.Vector3(0.4, otherBefore, 0.3),
      new THREE.Vector3(0.4, 1, 0.3));
    r.moveStroke(0, new THREE.Vector3(0.4, 1.08, 0.3));
    assert.ok(r.heights[other] > otherBefore,
      "a fresh trigger can select a different terrain spot");
    r.endStroke(0);
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
