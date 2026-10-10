import test from "node:test";
import assert from "node:assert/strict";
import { updateGuideVisibility } from "../src/controller-guide-visibility.js";

test("a natural glance reveals labels and small gaze changes keep them visible", () => {
  let state = { dwell: 0, hold: 0 };
  state = updateGuideVisibility(state, true, 0.46, 0.83, -0.25, 0.06);
  assert.equal(state.hold, 0);
  state = updateGuideVisibility(state, true, 0.46, 0.83, -0.25, 0.06);
  assert.ok(state.hold > 0);
  state = updateGuideVisibility(state, true, 0.48, 0.66, -0.32, 0.5);
  assert.ok(state.hold > 0);
  state = updateGuideVisibility(state, true, 0.48, 0.50, -0.32, 0.5);
  assert.ok(state.hold > 0);
  state = updateGuideVisibility(state, true, 0.48, 0.50, -0.32, 0.7);
  assert.equal(state.hold, 0);
});

test("tracking loss and lowered controllers hide labels immediately", () => {
  const active = { dwell: 0.12, hold: 1.1 };
  assert.equal(updateGuideVisibility(active, false, 0.4, 0.9, -0.2, 0.01).hold, 0);
  assert.equal(updateGuideVisibility(active, true, 0.4, 0.9, -0.65, 0.01).hold, 0);
});
