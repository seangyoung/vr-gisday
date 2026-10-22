import test from "node:test";
import assert from "node:assert/strict";
import { QUIZ_QUESTIONS, makeQuizRound } from "../src/quiz/questions.js";

test("the first round contains exactly the ten user-selected questions", () => {
  assert.deepEqual(QUIZ_QUESTIONS.map(({ id }) => id),
    ["q02", "q04", "q05", "q06", "q07", "q09", "q10", "q12", "q15", "q16"]);
  assert.ok(QUIZ_QUESTIONS.every(({ approved, source }) => approved && source));
});

test("question and answer shuffles preserve each correct answer", () => {
  for (const random of [() => 0, () => 0.5, () => 0.999]) {
    const round = makeQuizRound(random);
    assert.equal(round.length, 10);
    assert.deepEqual(new Set(round.map(({ id }) => id)),
      new Set(QUIZ_QUESTIONS.map(({ id }) => id)));
    for (const item of round) {
      const original = QUIZ_QUESTIONS.find(({ id }) => id === item.id);
      assert.equal(item.choices[item.correct], original.choices[original.correct]);
      assert.deepEqual(new Set(item.choices), new Set(original.choices));
    }
  }
});
