import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { climbHand, climbPushOff, combineClimbPushOff,
  sampleClimbHand } from "../src/climb/fling.js";

test("climb fling follows the release stroke and current headset side", () => {
  const group = new THREE.Group();
  const anchor = new THREE.Vector2(0, 0);
  const staleVisitor = new THREE.Vector2(1, 0);
  const currentEye = new THREE.Vector3(0, 1.6, 1);
  const handStart = new THREE.Vector3(0.02, 1.2, 0.02);

  const toward = climbHand(handStart);
  sampleClimbHand(toward, handStart.clone().add(
    new THREE.Vector3(0, -0.08, -0.13)), 0.016);
  const outward = climbPushOff(toward, null, group, anchor, staleVisitor, currentEye);
  assert.ok(outward.horizontal.y > 2,
    "a stroke toward the pole launches away from the current headset side");
  assert.ok(Math.abs(outward.horizontal.x) < 0.2);

  const sideways = climbHand(handStart);
  sampleClimbHand(sideways, handStart.clone().add(
    new THREE.Vector3(0.13, -0.08, 0)), 0.016);
  const lateral = climbPushOff(sideways, null, group, anchor, staleVisitor, currentEye);
  assert.ok(lateral.horizontal.x > 3 * lateral.horizontal.y,
    "a sideways stroke remains predominantly sideways");
  assert.ok(lateral.horizontal.y > 0,
    "a small outward component clears the pole");
});

test("near-simultaneous hand releases blend their launch directions", () => {
  const a = { horizontal: new THREE.Vector2(4, 0), up: 1.6, strength: 4 };
  const b = { horizontal: new THREE.Vector2(0, 4), up: 2, strength: 4 };
  const combined = combineClimbPushOff(a, b);
  assert.ok(Math.abs(combined.horizontal.x - combined.horizontal.y) < 1e-9);
  assert.equal(combined.up, 2);
  assert.equal(combineClimbPushOff(null, a), a);
});
