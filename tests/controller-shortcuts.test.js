import test from "node:test";
import assert from "node:assert/strict";
import { ControllerShortcuts } from "../src/controller-shortcuts.js";

const source = (handedness, down = []) => ({
  handedness,
  gamepad: {
    mapping: "xr-standard",
    buttons: Array.from({ length: 6 }, (_, index) => ({ pressed: down.includes(index) })),
  },
});

test("Quest face shortcuts fire once per press on the correct hand", () => {
  const shortcuts = new ControllerShortcuts();
  const idle = [source("left"), source("right")];
  assert.deepEqual(shortcuts.update(idle, 0.02), []);
  assert.deepEqual(shortcuts.update([source("left", [4]), source("right", [4])], 0.02), ["menu", "reset"]);
  assert.deepEqual(shortcuts.update([source("left", [4]), source("right", [4])], 0.02), []);
  assert.deepEqual(shortcuts.update(idle, 0.02), []);
  assert.deepEqual(shortcuts.update([source("left", [5]), source("right", [5])], 0.02), ["restart", "sound"]);
});

test("exit needs a sustained left stick press and re-arms after release", () => {
  const shortcuts = new ControllerShortcuts();
  shortcuts.update([source("left")], 0);
  for (let i = 0; i < 11; i++)
    assert.deepEqual(shortcuts.update([source("left", [3])], 0.1), []);
  assert.deepEqual(shortcuts.update([source("left", [3])], 0.1), ["exit"]);
  assert.deepEqual(shortcuts.update([source("left", [3])], 0.1), []);
  shortcuts.update([source("left")], 0.1);
  for (let i = 0; i < 11; i++) shortcuts.update([source("left", [3])], 0.1);
  assert.deepEqual(shortcuts.update([source("left", [3])], 0.1), ["exit"]);
  shortcuts.reset();
  assert.deepEqual(shortcuts.update([source("left", [4])], 0.1), []);
});

test("tracking loss and non-XR gamepads cannot leave shortcuts latched", () => {
  const shortcuts = new ControllerShortcuts();
  shortcuts.update([source("left")], 0);
  assert.deepEqual(shortcuts.update([source("left", [4])], 0.02), ["menu"]);
  assert.deepEqual(shortcuts.update([], 0.02), []);
  assert.deepEqual(shortcuts.update([source("left", [4])], 0.02), []);
  shortcuts.update([source("left")], 0.02);
  assert.deepEqual(shortcuts.update([source("left", [4])], 0.02), ["menu"]);
  const ordinary = source("left", [4]);
  ordinary.gamepad.mapping = "standard";
  assert.deepEqual(shortcuts.update([ordinary], 0.02), []);
});
