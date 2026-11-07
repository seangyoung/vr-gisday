import test from "node:test";
import assert from "node:assert/strict";
import { QUIZ_QUESTIONS, LESSON_QUESTION_IDS, lessonQuestion } from "../src/quiz/questions.js";

test("every visible lesson has one approved, topic-matched question", () => {
  assert.deepEqual(Object.keys(LESSON_QUESTION_IDS), [
    "layers", "gnss", "projection", "viewshed", "interpolation", "rain",
    "cluster", "scan", "spectral", "pixels", "change",
  ]);
  assert.equal(new Set(Object.values(LESSON_QUESTION_IDS)).size, 11);
  for (const demo of Object.keys(LESSON_QUESTION_IDS)) {
    const question = lessonQuestion(demo);
    assert.equal(question.id, LESSON_QUESTION_IDS[demo]);
    assert.ok(question.approved && question.source);
  }
  assert.equal(lessonQuestion("hidden-prototype"), null);
  assert.equal(QUIZ_QUESTIONS.length, 13);
});

test("answer order varies while preserving the correct answer", () => {
  for (const demo of Object.keys(LESSON_QUESTION_IDS)) {
    const original = QUIZ_QUESTIONS.find(({ id }) => id === LESSON_QUESTION_IDS[demo]);
    for (const random of [() => 0, () => 0.5, () => 0.999]) {
      const question = lessonQuestion(demo, random);
      assert.equal(question.choices[question.correct], original.choices[original.correct]);
      assert.deepEqual(new Set(question.choices), new Set(original.choices));
    }
  }
});
