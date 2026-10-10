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

test("Quest stick and face shortcuts fire once per press on the correct hand", () => {
  const shortcuts = new ControllerShortcuts();
  const idle = [source("left"), source("right")];
  assert.deepEqual(shortcuts.update(idle), []);
  assert.deepEqual(shortcuts.update([source("left", [3, 4]), source("right", [4])]),
    ["menu", "restart", "sound"]);
  assert.deepEqual(shortcuts.update([source("left", [3, 4]), source("right", [4])]), []);
  assert.deepEqual(shortcuts.update(idle), []);
  assert.deepEqual(shortcuts.update([source("left", [5]), source("right", [5])]),
    ["reset", "exit"]);
});

test("a left stick click opens Menu immediately and re-arms after release", () => {
  const shortcuts = new ControllerShortcuts();
  shortcuts.update([source("left")]);
  assert.deepEqual(shortcuts.update([source("left", [3])]), ["menu"]);
  assert.deepEqual(shortcuts.update([source("left", [3])]), []);
  shortcuts.update([source("left")]);
  assert.deepEqual(shortcuts.update([source("left", [3])]), ["menu"]);
  shortcuts.reset();
  assert.deepEqual(shortcuts.update([source("left", [3])]), []);
});

test("tracking loss and non-XR gamepads cannot leave shortcuts latched", () => {
  const shortcuts = new ControllerShortcuts();
  shortcuts.update([source("left")]);
  assert.deepEqual(shortcuts.update([source("left", [4])]), ["restart"]);
  assert.deepEqual(shortcuts.update([]), []);
  assert.deepEqual(shortcuts.update([source("left", [4])]), []);
  shortcuts.update([source("left")]);
  assert.deepEqual(shortcuts.update([source("left", [4])]), ["restart"]);
  const ordinary = source("left", [4]);
  ordinary.gamepad.mapping = "standard";
  assert.deepEqual(shortcuts.update([ordinary]), []);
});
