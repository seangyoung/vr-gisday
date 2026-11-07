import test from "node:test";
import assert from "node:assert/strict";
import { answerBlockPose, QUIZ_SCREEN_DISTANCE } from "../src/quiz/layout.js";

test("four answer blocks share one row with space between them", () => {
  const poses = Array.from({ length: 4 }, (_, index) => answerBlockPose(index));
  assert.deepEqual(poses.map((pose) => pose.y), [-0.42, -0.42, -0.42, -0.42]);
  assert.ok(Math.abs(poses[1].z) < 1e-10 && Math.abs(poses[2].z) < 1e-10,
    "the middle targets stay at their original depth");
  assert.ok(poses[0].z > 0.15 && poses[3].z > 0.15,
    "the outside targets move toward the player");
  const reaches = poses.map(({ x, z }) => Math.hypot(x, QUIZ_SCREEN_DISTANCE - z));
  assert.ok(reaches.every((reach) => Math.abs(reach - reaches[0]) < 1e-10),
    "each answer center is equally far from the player");
  for (const [index, expected] of [-0.72, -0.24, 0.24, 0.72].entries())
    assert.ok(Math.abs(poses[index].x - expected) < 1e-10);
  for (let i = 1; i < poses.length; i++)
    assert.ok(poses[i].x - poses[i - 1].x > 0.44);
  assert.ok(poses[0].yaw > poses[1].yaw && poses[1].yaw > 0,
    "left-side faces turn inward with a shallow arc");
  assert.ok(poses[3].yaw < poses[2].yaw && poses[2].yaw < 0,
    "right-side faces turn inward with a shallow arc");
  assert.ok(Math.abs(poses[0].yaw) <= Math.PI / 9 &&
    Math.abs(poses[3].yaw) <= Math.PI / 9,
  "the outer blocks stay within a comfortable forward view");
});
