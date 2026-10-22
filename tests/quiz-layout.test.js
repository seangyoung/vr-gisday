import test from "node:test";
import assert from "node:assert/strict";
import { initialTilePose, answerBlockPose, INITIAL_RING_RADIUS } from "../src/quiz/layout.js";

test("the 26 initials encircle the player at one reachable height", () => {
  const poses = Array.from({ length: 26 }, (_, index) => initialTilePose(index));
  assert.ok(poses[0].z < -1);
  assert.ok(poses[13].z > 1);
  for (const pose of poses) {
    assert.ok(Math.abs(Math.hypot(pose.x, pose.z) - INITIAL_RING_RADIUS) < 1e-10);
    assert.equal(pose.y, poses[0].y);
    const towardCenter = -pose.x * Math.sin(pose.yaw) -
      pose.z * Math.cos(pose.yaw);
    assert.ok(towardCenter > 1);
  }
});

test("four answer blocks share one row with space between them", () => {
  const poses = Array.from({ length: 4 }, (_, index) => answerBlockPose(index));
  assert.deepEqual(poses.map((pose) => pose.y), [-0.42, -0.42, -0.42, -0.42]);
  for (const [index, expected] of [-0.84, -0.28, 0.28, 0.84].entries())
    assert.ok(Math.abs(poses[index].x - expected) < 1e-10);
  for (let i = 1; i < poses.length; i++)
    assert.ok(poses[i].x - poses[i - 1].x > 0.49);
});
