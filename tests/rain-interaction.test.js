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
  for (let i = 0; i < 100; i++) r.update(0.05);
  assert.ok(r.water.added > 0);
  assert.ok(r.ponds.count > 0);
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
