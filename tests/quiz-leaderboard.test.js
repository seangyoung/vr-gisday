import test from "node:test";
import assert from "node:assert/strict";
import { QuizLeaderboard, cleanPlayerName } from "../src/quiz/leaderboard.js";

const fakeStorage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value) };
};

test("names use normal text entry, can be selected again, and are limited to 30 characters", () => {
  const board = new QuizLeaderboard(fakeStorage());
  assert.throws(() => board.selectPlayer("  "), /Enter a player name/);
  assert.equal(board.selectPlayer("  Ada   Lovelace  "), "Ada Lovelace");
  assert.equal(board.selectPlayer("ada lovelace"), "Ada Lovelace");
  assert.deepEqual(board.read().players, ["Ada Lovelace"]);
  assert.equal(cleanPlayerName("x".repeat(40)).length, 30);
});

test("previous GeoSlice initials remain available as player choices without mixing old scores", () => {
  const storage = fakeStorage();
  storage.setItem("vr-gisday-quiz-scores-v1", JSON.stringify({
    day: "2026-11-18", today: [{ initials: "MAP", score: 1700 }],
    gisDay: [{ initials: "GIS", score: 1800 }],
  }));
  const board = new QuizLeaderboard(storage, () => new Date("2026-11-18T18:00:00Z"));
  assert.deepEqual(board.read().players, ["MAP", "GIS"]);
  assert.deepEqual(board.read().today, []);
  assert.equal(board.selectPlayer("gis"), "GIS");
});

test("best score from each demo adds once, then daily scores reset", () => {
  const storage = fakeStorage();
  let date = new Date("2026-11-18T18:00:00Z");
  const board = new QuizLeaderboard(storage, () => date);
  board.selectPlayer("Ada");
  board.submitDemo("gnss", { score: 140 });
  board.submitDemo("gnss", { score: 110 });
  board.submitDemo("rain", { score: 170 });
  assert.deepEqual(board.read().today.map(({ name, score, completed }) =>
    [name, score, completed]), [["Ada", 310, 2]]);
  board.submitDemo("change", { score: 160 });
  board.submitDemo("change", { score: 120 });
  assert.deepEqual(board.read().today.map(({ score, completed }) =>
    [score, completed]), [[470, 3]]);
  board.submitDemo("gnss", { score: 190 });
  assert.equal(board.read().today[0].score, 520);
  date = new Date("2026-11-19T18:00:00Z");
  assert.deepEqual(board.read().today, []);
  assert.equal(board.read().gisDay[0].score, 520);
  assert.deepEqual(board.read().players, ["Ada"]);
  board.selectPlayer("Ada");
  board.submitDemo("scan", { score: 200 });
  assert.equal(board.read().today[0].score, 200);
  assert.equal(board.read().gisDay[0].score, 520);
});

test("scores from different players remain separate and invalid scores are rejected", () => {
  const board = new QuizLeaderboard(fakeStorage());
  board.selectPlayer("Ada");
  board.submitDemo("gnss", { score: 150 });
  board.selectPlayer("Ben");
  board.submitDemo("gnss", { score: 130 });
  assert.deepEqual(board.read().today.map(({ name }) => name), ["Ada", "Ben"]);
  assert.throws(() => board.submitDemo("gnss", null), /finished lesson/);
  assert.throws(() => board.submitDemo("gnss", { score: 201 }), /finished lesson/);
});

test("old timed What Changed question scores do not mix with five-case scores", () => {
  const storage = fakeStorage();
  const now = new Date("2026-11-18T18:00:00Z");
  storage.setItem("vr-gisday-lesson-scores-v2", JSON.stringify({
    day: "2026-11-18", players: ["Ada"], selected: "Ada",
    todayScores: { Ada: [{ demo: "change", score: 200, at: now.getTime() }] },
    gisDayScores: { Ada: [{ demo: "change", score: 200, at: now.getTime() }] },
  }));
  const board = new QuizLeaderboard(storage, () => now);
  assert.deepEqual(board.read().today, []);
  board.submitDemo("change", { score: 160 });
  assert.equal(board.read().today[0].score, 160);
  assert.equal(board.read().gisDay[0].score, 160);
});
