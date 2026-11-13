import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { QuizExperience } from "../src/quiz/experience.js";

function fixture() {
  const quiz = Object.create(QuizExperience.prototype);
  const grip = new THREE.Group();
  const group = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.43, 0.12),
    new THREE.MeshBasicMaterial());
  group.position.z = -1.5;
  const hits = [];
  const sounds = [];
  const target = { group, body: group, action: (method) => {
    hits.push(method);
    quiz.targets = [];
  } };
  quiz.targets = [target];
  quiz.effects = new THREE.Group();
  quiz.session = { phase: "question" };
  quiz.sound = { laserFire: () => sounds.push("fire") };
  quiz.pendingBlast = null;
  quiz.disposed = false;
  quiz.age = 0;
  quiz.shatter = (item) => assert.equal(item, target);
  return { quiz, grip, hits, sounds };
}

test("trigger launches from the blade tip and selects only after the bolt reaches a block", () => {
  const { quiz, grip, hits, sounds } = fixture();
  assert.equal(quiz.fireFromGrip(grip), true);
  assert.equal(quiz.pendingBlast.target, quiz.targets[0]);
  assert.ok(Math.abs(quiz.pendingBlast.from.z + 0.84) < 1e-8);
  assert.equal(quiz.fireFromGrip(grip), false);
  assert.deepEqual(hits, []);
  quiz.updateBlast(0.2);
  assert.deepEqual(hits, ["blast"]);
  assert.deepEqual(sounds, ["fire"]);
  assert.equal(quiz.pendingBlast, null);
});

test("aiming away fires visibly but does not answer", () => {
  const { quiz, grip, hits } = fixture();
  grip.rotation.y = Math.PI / 2;
  assert.equal(quiz.fireFromGrip(grip), true);
  assert.equal(quiz.pendingBlast.target, null);
  quiz.updateBlast(0.2);
  assert.deepEqual(hits, []);
});

test("a nearby decorative outline cannot pull the bolt off the saber's axis", () => {
  const { quiz, grip, hits } = fixture();
  const target = quiz.targets[0];
  target.body.position.x = 0.6;
  const outline = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -0.2, -1.5),
      new THREE.Vector3(0, 0.2, -1.5),
    ]), new THREE.LineBasicMaterial());
  target.body.add(outline);
  assert.equal(quiz.fireFromGrip(grip), true);
  assert.equal(quiz.pendingBlast.target, null);
  assert.ok(Math.abs(quiz.pendingBlast.to.x - quiz.pendingBlast.from.x) < 1e-8);
  assert.ok(Math.abs(quiz.pendingBlast.to.y - quiz.pendingBlast.from.y) < 1e-8);
  quiz.updateBlast(0.2);
  assert.deepEqual(hits, []);
});

test("a rotated saber sends the bolt straight along its visible blade", () => {
  const { quiz, grip } = fixture();
  grip.rotation.y = -0.35;
  grip.updateWorldMatrix(true, false);
  const from = grip.localToWorld(new THREE.Vector3(0, 0, -0.84));
  const forward = new THREE.Vector3(0, 0, -1)
    .transformDirection(grip.matrixWorld);
  quiz.targets[0].body.position.copy(from).addScaledVector(forward, 0.9);
  assert.equal(quiz.fireFromGrip(grip), true);
  assert.equal(quiz.pendingBlast.target, quiz.targets[0]);
  const flight = quiz.pendingBlast.to.clone().sub(quiz.pendingBlast.from).normalize();
  assert.ok(flight.angleTo(forward) < 1e-8);
});

test("trigger cannot answer while the quiz is prompting or paused", () => {
  const { quiz, grip } = fixture();
  for (const phase of ["prompt", "audio-paused", "quit-paused"]) {
    quiz.session.phase = phase;
    assert.equal(quiz.fireFromGrip(grip), false);
  }
});
