import test from "node:test";
import assert from "node:assert/strict";
import { QuizSession, validateQuestion } from "../src/quiz/session.js";

const approved = (id = "q1") => ({
  id,
  prompt: "What does a DEM represent?",
  choices: ["Elevation", "Street names", "Population"],
  correct: 0,
  explanation: "A digital elevation model represents terrain height.",
  approved: true,
});

test("only an individually approved, unambiguous question can enter a round", () => {
  assert.throws(() => validateQuestion({ ...approved(), approved: false }), /not been approved/);
  assert.throws(() => validateQuestion({ ...approved(), choices: ["A", "a", "C"] }),
    /distinct choices/);
  assert.throws(() => new QuizSession([approved(), approved()], "GIS"), /unique/);
});

test("quick correct answers score more and each question resolves only once", () => {
  const quiz = new QuizSession([approved()], "GIS");
  quiz.start();
  assert.equal(quiz.phase, "prompt");
  quiz.update(2.6);
  assert.equal(quiz.phase, "question");
  assert.equal(quiz.remaining, 18);
  quiz.update(3);
  assert.equal(quiz.answer(0).gained, 183);
  assert.equal(quiz.answer(0), null);
  quiz.update(3);
  assert.deepEqual(quiz.finalScore(), { initials: "GIS", score: 183, correct: 1, total: 1 });
});

test("audio and quit pauses freeze time; quitting discards progress", () => {
  const quiz = new QuizSession([approved(), approved("q2")], "MAP");
  quiz.start();
  quiz.pause("audio");
  quiz.update(30);
  assert.equal(quiz.promptRemaining, 2.6);
  assert.equal(quiz.remaining, 18);
  assert.equal(quiz.answer(0), null);
  quiz.resume();
  quiz.update(2.6);
  quiz.answer(0);
  quiz.update(3);
  assert.equal(quiz.phase, "prompt");
  quiz.pause("quit");
  quiz.update(30);
  assert.equal(quiz.remaining, 18);
  quiz.quit();
  assert.equal(quiz.score, 0);
  assert.equal(quiz.finalScore(), null);
});

test("timeout earns no points and advances after feedback", () => {
  const quiz = new QuizSession([approved()], "GEO");
  quiz.start();
  quiz.update(2.6);
  quiz.update(18);
  assert.equal(quiz.results[0].choice, null);
  assert.equal(quiz.results[0].gained, 0);
  quiz.update(3);
  assert.equal(quiz.complete, true);
});
