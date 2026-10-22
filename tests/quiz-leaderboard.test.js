import test from "node:test";
import assert from "node:assert/strict";
import { QuizLeaderboard } from "../src/quiz/leaderboard.js";

const fakeStorage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value) };
};
const finished = (initials, score) => ({
  finalScore: () => ({ initials, score, correct: 7, total: 10 }),
});

test("local leaderboard resets each Chicago day and retains GIS Day best", () => {
  const storage = fakeStorage();
  let date = new Date("2026-11-18T18:00:00Z");
  const board = new QuizLeaderboard(storage, () => date);
  board.submit(finished("GIS", 1400));
  board.submit(finished("MAP", 1600));
  assert.deepEqual(board.read().today.map((row) => row.initials), ["MAP", "GIS"]);
  date = new Date("2026-11-19T18:00:00Z");
  assert.equal(board.read().today.length, 0);
  assert.deepEqual(board.read().gisDay.map((row) => row.initials), ["MAP", "GIS"]);
  board.submit(finished("NEW", 1500));
  assert.deepEqual(board.read().today.map((row) => row.initials), ["NEW"]);
  assert.deepEqual(board.read().gisDay.map((row) => row.initials), ["MAP", "GIS"]);
});

test("unfinished rounds cannot be saved", () => {
  const board = new QuizLeaderboard(fakeStorage(), () => new Date("2026-10-22T12:00:00Z"));
  assert.throws(() => board.submit({ finalScore: () => null }));
});

test("only the ten highest scores survive on the same headset", () => {
  const board = new QuizLeaderboard(fakeStorage(), () => new Date("2026-11-18T18:00:00Z"));
  for (let i = 0; i < 12; i++)
    board.submit(finished(`G${String.fromCharCode(65 + i)}S`, i * 100));
  assert.equal(board.read().today.length, 10);
  assert.equal(board.read().gisDay.length, 10);
  assert.equal(board.read().today[0].score, 1100);
  assert.equal(board.read().today.at(-1).score, 200);
});
