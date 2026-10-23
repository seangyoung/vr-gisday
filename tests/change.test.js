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

test("spotlight follows the image ray and remains usable after an answer", () => {
  const exhibit = Object.create(ChangeExperience.prototype);
  exhibit.sceneIndex = 0;
  exhibit.started = true;
  exhibit.finished = false;
  exhibit.ready = true;
  exhibit.revealed = false;
  exhibit.comparisonMode = "slider";
  exhibit.lens = { u: 0.5, v: 0.5 };
  exhibit.image = { updateWorldMatrix() {} };
  exhibit.refresh = () => {};
  exhibit.onChange = () => {};
  exhibit.setComparisonMode("spotlight");
  const raycaster = { intersectObject: () => [{ uv: { x: 0.28, y: 0.72 } }] };
  assert.equal(exhibit.aimSpotlight(raycaster), true);
  assert.ok(Math.abs(exhibit.lens.u - 0.28) < 0.001);
  assert.ok(Math.abs(exhibit.lens.v - 0.28) < 0.001);
  exhibit.chooseAnswer(CHANGE_SCENES[0].answer);
  assert.equal(exhibit.aimSpotlight(raycaster), true);
  assert.equal(exhibit.beginInteraction(raycaster, "right"), true);
  raycaster.intersectObject = () => [{ uv: { x: 0.73, y: 0.16 } }];
  assert.equal(exhibit.dragInteraction(raycaster, "right"), true);
  assert.ok(Math.abs(exhibit.lens.v - 0.84) < 0.001);
  assert.equal(exhibit.endInteraction("right"), true);
});

test("spotlight clips the later image to a circular window using aligned crops", () => {
  const exhibit = Object.create(ChangeExperience.prototype);
  const draws = [];
  const arcs = [];
  const ctx = new Proxy({
    drawImage: (...args) => draws.push(args),
    arc: (...args) => arcs.push(args),
    measureText: () => ({ width: 100 }),
  }, { get: (target, key) => target[key] ?? (() => {}) });
  exhibit.sceneIndex = CHANGE_SCENES.findIndex((scene) => scene.id === "helens");
  exhibit.canvas = { width: 580, height: 500, getContext: () => ctx };
  exhibit.image = { material: { map: { needsUpdate: false } } };
  exhibit.pair = [{}, {}];
  exhibit.ready = true;
  exhibit.revealed = false;
  exhibit.comparisonMode = "spotlight";
  exhibit.lens = { u: 0.3, v: 0.4 };
  exhibit.refresh();
  assert.deepEqual(draws[0].slice(1), [20, 0, 580, 500, 0, 0, 580, 500]);
  assert.deepEqual(draws[1].slice(1), [0, 0, 580, 500, 0, 0, 580, 500]);
  assert.deepEqual(arcs[0].slice(0, 3), [174, 200, 120]);
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

test("Mount St. Helens slider draws the same source footprint in both frames", () => {
  const exhibit = Object.create(ChangeExperience.prototype);
  const draws = [];
  const ctx = new Proxy({
    drawImage: (...args) => draws.push(args),
    measureText: () => ({ width: 100 }),
  }, { get: (target, key) => target[key] ?? (() => {}) });
  exhibit.sceneIndex = CHANGE_SCENES.findIndex((scene) => scene.id === "helens");
  exhibit.canvas = { width: 580, height: 500, getContext: () => ctx };
  exhibit.image = { material: { map: { needsUpdate: false } } };
  exhibit.pair = [{}, {}];
  exhibit.ready = true;
  exhibit.revealed = false;
  exhibit.split = 0.5;
  exhibit.refresh();
  assert.deepEqual(draws[0].slice(1), [20, 0, 580, 500, 0, 0, 580, 500]);
  assert.deepEqual(draws[1].slice(1), [0, 0, 580, 500, 0, 0, 580, 500]);
});
