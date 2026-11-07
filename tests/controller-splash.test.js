import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MotionController } from "three/addons/libs/motion-controllers.module.js";
import { updateIllustrationSources } from "../src/controller-splash.js";

const profile = JSON.parse(readFileSync(new URL(
  "../public/controller-profiles/meta-quest-touch-plus-v2/profile.json", import.meta.url), "utf8"));

function gamepad() {
  return {
    mapping: "xr-standard",
    buttons: Array.from({ length: 8 }, () => ({ pressed: false, touched: false, value: 0 })),
    axes: [0, 0, 0, 0],
  };
}

test("large guide controllers follow the matching live hand's buttons and stick", () => {
  const left = { handedness: "left", gamepad: gamepad() };
  const right = { handedness: "right", gamepad: gamepad() };
  const leftMotion = new MotionController(left, profile, "");
  const rightMotion = new MotionController(right, profile, "");
  const actualLeft = gamepad();
  const actualRight = gamepad();
  actualLeft.buttons[4] = { pressed: true, touched: true, value: 1 };
  actualLeft.axes[2] = -1;
  actualRight.buttons[0] = { pressed: true, touched: true, value: 0.8 };
  actualRight.buttons[5] = { pressed: true, touched: true, value: 1 };
  actualRight.axes[3] = 1;
  updateIllustrationSources([left, right], new Set([
    { handedness: "right", gamepad: actualRight },
    { handedness: "left", gamepad: actualLeft },
  ]));
  assert.equal(left.gamepad, actualLeft);
  assert.equal(right.gamepad, actualRight);
  leftMotion.updateFromGamepad();
  rightMotion.updateFromGamepad();
  assert.equal(leftMotion.components["x-button"].visualResponses.x_button_pressed.value, 1);
  assert.equal(leftMotion.components["xr-standard-thumbstick"]
    .visualResponses.xr_standard_thumbstick_xaxis_pressed.value, 0);
  assert.equal(rightMotion.components["xr-standard-trigger"]
    .visualResponses.xr_standard_trigger_pressed.value, 0.8);
  assert.equal(rightMotion.components["b-button"].visualResponses.b_button_pressed.value, 1);
  assert.equal(rightMotion.components["xr-standard-thumbstick"]
    .visualResponses.xr_standard_thumbstick_yaxis_pressed.value, 1);
  updateIllustrationSources([left, right], []);
  assert.equal(left.gamepad.buttons[4].value, 0);
  assert.equal(right.gamepad.axes[3], 0);
});
