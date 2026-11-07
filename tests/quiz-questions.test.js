import test from "node:test";
import assert from "node:assert/strict";
import { QUIZ_QUESTIONS, LESSON_QUESTION_IDS, lessonQuestion } from "../src/quiz/questions.js";

test("each lesson except What Changed has an approved question pool", () => {
  assert.deepEqual(Object.keys(LESSON_QUESTION_IDS), [
    "layers", "gnss", "projection", "viewshed", "interpolation", "rain",
    "cluster", "scan", "spectral", "pixels",
  ]);
  const allIds = Object.values(LESSON_QUESTION_IDS).flat();
  assert.equal(allIds.length, new Set(allIds).size);
  for (const [demo, ids] of Object.entries(LESSON_QUESTION_IDS)) {
    assert.ok(ids.length >= 1);
    for (const [index, id] of ids.entries()) {
      const question = lessonQuestion(demo, () => (index + 0.5) / ids.length);
      assert.equal(question.id, id);
      assert.ok(question.approved && question.source);
    }
  }
  assert.equal(lessonQuestion("hidden-prototype"), null);
  assert.equal(lessonQuestion("change"), null);
  assert.equal(QUIZ_QUESTIONS.length, 19);
});

test("question and answer order vary while preserving the correct answer", () => {
  for (const [demo, ids] of Object.entries(LESSON_QUESTION_IDS)) {
    for (const [index, id] of ids.entries()) {
      const random = () => (index + 0.5) / ids.length;
      const original = QUIZ_QUESTIONS.find((item) => item.id === id);
      const question = lessonQuestion(demo, random);
      assert.equal(question.choices[question.correct], original.choices[original.correct]);
      assert.deepEqual(new Set(question.choices), new Set(original.choices));
    }
  }
});
