import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ChangeExperience } from "../src/change/experience.js";
import { CHANGE_SCENES } from "../src/change/scenes.js";

test("every change case has two bundled Landsat frames and a complete interpretation", () => {
  assert.equal(CHANGE_SCENES.length, 5);
  for (const scene of CHANGE_SCENES) {
    assert.notEqual(scene.before, scene.after);
    for (const url of [scene.before, scene.after]) {
      const bytes = readFileSync(fileURLToPath(url));
      assert.ok(bytes.length > 100_000, `${scene.id}: image is unexpectedly small`);
      assert.equal(bytes.readUInt16BE(0), 0xffd8, `${scene.id}: expected JPEG`);
      assert.equal(bytes.readUInt16BE(bytes.length - 2), 0xffd9,
        `${scene.id}: JPEG is truncated`);
    }
    assert.ok(scene.answer >= 0 && scene.answer < scene.options.length);
    assert.ok(scene.explanation.length > 30);
    assert.ok(scene.source.startsWith("https://eros.usgs.gov/"));
    if (["flood", "fire"].includes(scene.id)) assert.equal(scene.focus, undefined);
    else for (const value of Object.values(scene.focus))
      assert.ok(value > 0 && value < 1, `${scene.id}: highlight must be on frame`);
  }
});

test("a selected answer leaves the before-after slider draggable", () => {
  const exhibit = Object.create(ChangeExperience.prototype);
  exhibit.sceneIndex = 0;
  exhibit.started = true;
  exhibit.finished = false;
  exhibit.ready = true;
  exhibit.revealed = false;
  exhibit.split = 0.5;
  exhibit.image = { updateWorldMatrix() {} };
  exhibit.refresh = () => {};
  exhibit.onChange = () => {};
  let u = 0.5;
  const raycaster = { intersectObject: () => [{ uv: { x: u } }] };
  exhibit.chooseAnswer(CHANGE_SCENES[0].answer);
  assert.equal(exhibit.revealed, true);
  assert.equal(exhibit.beginInteraction(raycaster, "right"), true);
  u = 0.75;
  assert.equal(exhibit.dragInteraction(raycaster, "right"), true);
  assert.equal(exhibit.split, 0.75);
  assert.equal(exhibit.endInteraction("right"), true);
});

test("answer highlight is drawn for local changes but not flood or fire", () => {
  const exhibit = Object.create(ChangeExperience.prototype);
  let outlines = 0;
  const ctx = new Proxy({ measureText: () => ({ width: 100 }),
    ellipse: () => { outlines++; } }, { get: (target, key) => target[key] ?? (() => {}) });
  exhibit.canvas = { width: 1000, height: 873, getContext: () => ctx };
  exhibit.image = { material: { map: { needsUpdate: false } } };
  exhibit.pair = [{}, {}];
  exhibit.ready = true;
  exhibit.revealed = true;
  exhibit.split = 0.5;
  for (const id of ["flood", "fire", "dallas"]) {
    exhibit.sceneIndex = CHANGE_SCENES.findIndex((scene) => scene.id === id);
    exhibit.refresh();
  }
  assert.equal(outlines, 1);
});
