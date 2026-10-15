import test from "node:test";
import assert from "node:assert/strict";
import { hasQuestShortcuts } from "../src/input-layout.js";

const source = (handedness, profile = "meta-quest-touch-plus-v2", buttons = 6) => ({
  handedness,
  profiles: [profile, "generic-trigger"],
  gamepad: { mapping: "xr-standard", buttons: Array.from({ length: buttons }, () => ({})) },
});

test("Quest Browser with two recognized controllers keeps face shortcuts", () => {
  assert.equal(hasQuestShortcuts("Mozilla/5.0 OculusBrowser/39.2", [
    source("left"), source("right"),
  ]), true);
  assert.equal(hasQuestShortcuts("OculusBrowser/39", [
    source("left", "oculus-touch-v3"), source("right", "oculus-touch-v3"),
  ]), true);
});

test("other browsers and unknown or incomplete controllers get visible actions", () => {
  const pair = [source("left"), source("right")];
  assert.equal(hasQuestShortcuts("Chrome/130", pair), false);
  assert.equal(hasQuestShortcuts("OculusBrowser/39", [source("left")]), false);
  assert.equal(hasQuestShortcuts("OculusBrowser/39", [
    source("left", "generic-trigger"), source("right"),
  ]), false);
  assert.equal(hasQuestShortcuts("OculusBrowser/39", [
    source("left"), source("right", "meta-quest-touch-plus-v2", 5),
  ]), false);
  assert.equal(hasQuestShortcuts("OculusBrowser/39", []), false);
});
