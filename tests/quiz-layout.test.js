import test from "node:test";
import assert from "node:assert/strict";
import { initialTilePose, answerBlockPose, INITIAL_RING_RADIUS,
  QUIZ_SCREEN_DISTANCE } from "../src/quiz/layout.js";
import { QuizExperience } from "../src/quiz/experience.js";

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
  assert.ok(Math.abs(poses[1].z) < 1e-10 && Math.abs(poses[2].z) < 1e-10,
    "the middle targets stay at their original depth");
  assert.ok(poses[0].z > 0.2 && poses[3].z > 0.2,
    "the outside targets move toward the player");
  const reaches = poses.map(({ x, z }) => Math.hypot(x, QUIZ_SCREEN_DISTANCE - z));
  assert.ok(reaches.every((reach) => Math.abs(reach - reaches[0]) < 1e-10),
    "each answer center is equally far from the player");
  for (const [index, expected] of [-0.84, -0.28, 0.28, 0.84].entries())
    assert.ok(Math.abs(poses[index].x - expected) < 1e-10);
  for (let i = 1; i < poses.length; i++)
    assert.ok(poses[i].x - poses[i - 1].x > 0.49);
  assert.ok(poses[0].yaw > poses[1].yaw && poses[1].yaw > 0,
    "left-side faces turn inward with a shallow arc");
  assert.ok(poses[3].yaw < poses[2].yaw && poses[2].yaw < 0,
    "right-side faces turn inward with a shallow arc");
  assert.ok(Math.abs(poses[0].yaw) <= Math.PI / 9 &&
    Math.abs(poses[3].yaw) <= Math.PI / 9,
  "the outer blocks stay within a comfortable forward view");
});

test("a sliced exit block falls before the quiz returns to the menu", () => {
  const quiz = Object.create(QuizExperience.prototype);
  const target = { group: { visible: true } };
  let exits = 0;
  let slices = 0;
  quiz.age = 3;
  quiz.targets = [target];
  quiz.fragments = [];
  quiz.blades = [];
  quiz.sound = { slice: () => { slices++; } };
  quiz.onExit = () => { exits++; };
  quiz.exitAfterSlice(target);
  assert.equal(target.group.visible, false);
  assert.equal(quiz.targets.length, 0);
  assert.equal(slices, 1);
  quiz.update(1);
  assert.equal(exits, 0);
  quiz.update(0.06);
  assert.equal(exits, 1);
});

test("snap turns bring initials around while leaving the quiz panel in place", () => {
  const quiz = Object.create(QuizExperience.prototype);
  quiz.session = null;
  quiz.letterField = { rotation: { y: 0 } };
  quiz.blades = [{ previous: [1] }];
  assert.equal(quiz.snapTurnInitials(Math.PI / 6), true);
  assert.ok(Math.abs(quiz.letterField.rotation.y - Math.PI / 6) < 1e-10);
  assert.equal(quiz.blades[0].previous, null,
    "the sudden turn cannot register as a blade strike");
  quiz.session = {};
  assert.equal(quiz.snapTurnInitials(Math.PI / 6), false);
  assert.ok(Math.abs(quiz.letterField.rotation.y - Math.PI / 6) < 1e-10,
    "the letter ring stops turning once the quiz begins");
});
