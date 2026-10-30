import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { ChangeExperience, headTiltBlendFromRoll } from "../src/change/experience.js";
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
    assert.ok(["eros.usgs.gov", "science.nasa.gov"]
      .includes(new URL(scene.source).hostname));
    if (["flood", "fire"].includes(scene.id)) assert.equal(scene.focus, undefined);
    else for (const value of Object.values(scene.focus))
      assert.ok(value > 0 && value < 1, `${scene.id}: highlight must be on frame`);
  }
});

test("Dallas case uses the aligned, same-sensor 1984–2009 pair", () => {
  const scene = CHANGE_SCENES.find(({ id }) => id === "dallas");
  assert.equal(scene.beforeDate, "Aug. 31, 1984");
  assert.equal(scene.afterDate, "Aug. 4, 2009");
  assert.equal(scene.sensor, "Landsat 5 · natural color");
  assert.equal(scene.height, 667);
  assert.equal(scene.source, "https://science.nasa.gov/earth/earth-observatory/dallas-42551/");
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

test("date labels follow the active comparison mode", () => {
  const exhibit = Object.create(ChangeExperience.prototype);
  exhibit.sceneIndex = CHANGE_SCENES.findIndex((scene) => scene.id === "dallas");
  const labels = [];
  const alphaStack = [];
  const ctx = new Proxy({
    globalAlpha: 1,
    measureText(text) { return { width: text.length * Number(this.font.match(/\d+/)[0]) * 0.55 }; },
    fillText(text, x, y) {
      labels.push({ text, x, y, alpha: this.globalAlpha, font: this.font });
    },
    save() { alphaStack.push(this.globalAlpha); },
    restore() { this.globalAlpha = alphaStack.pop(); },
  }, { get: (target, key) => target[key] ?? (() => {}) });
  exhibit.canvas = { width: 1000, height: 667, getContext: () => ctx };
  exhibit.image = { material: { map: { needsUpdate: false } } };
  exhibit.pair = [{}, {}];
  exhibit.ready = true;
  exhibit.revealed = false;
  exhibit.split = 0.5;
  exhibit.lens = { u: 0.3, v: 0.4 };

  exhibit.comparisonMode = "slider";
  exhibit.refresh();
  assert.deepEqual(labels.map(({ text, alpha, font }) => [text, alpha, font]), [
    ["Aug. 31, 1984", 1, "bold 27px system-ui"],
    ["Aug. 4, 2009", 1, "bold 27px system-ui"],
  ]);
  assert.ok(labels[1].x > 900);

  labels.length = 0;
  exhibit.comparisonMode = "spotlight";
  exhibit.refresh();
  assert.equal(labels[1].text, "Aug. 4, 2009");
  assert.equal(labels[1].font, "bold 19px system-ui");
  assert.ok(Math.abs(labels[1].x - 300) < 1, JSON.stringify(labels));
  assert.ok(labels[1].y > 100 && labels[1].y < 267);

  labels.length = 0;
  exhibit.comparisonMode = "head-tilt";
  exhibit.tiltBlend = 0.25;
  exhibit.refresh();
  assert.deepEqual(labels.map(({ alpha }) => alpha), [0.75, 0.25]);
  labels.length = 0;
  exhibit.tiltBlend = 0;
  exhibit.refresh();
  assert.deepEqual(labels.map(({ text }) => text), ["Aug. 31, 1984"]);
  labels.length = 0;
  exhibit.tiltBlend = 1;
  exhibit.refresh();
  assert.deepEqual(labels.map(({ text }) => text), ["Aug. 4, 2009"]);
});

test("head tilt crossfades the whole image in the expected direction", () => {
  const degrees = (value) => value * Math.PI / 180;
  assert.equal(headTiltBlendFromRoll(degrees(12)), 0);
  assert.equal(headTiltBlendFromRoll(0), 0.5);
  assert.equal(headTiltBlendFromRoll(degrees(-12)), 1);

  const exhibit = Object.create(ChangeExperience.prototype);
  const draws = [];
  let clips = 0;
  const ctx = new Proxy({
    globalAlpha: 1,
    drawImage(image) { draws.push([image, this.globalAlpha]); },
    clip() { clips++; },
    save() { this.savedAlpha = this.globalAlpha; },
    restore() { this.globalAlpha = this.savedAlpha; },
    measureText: () => ({ width: 100 }),
  }, { get: (target, key) => target[key] ?? (() => {}) });
  exhibit.sceneIndex = CHANGE_SCENES.findIndex((scene) => scene.id === "dallas");
  exhibit.canvas = { width: 1000, height: 667, getContext: () => ctx };
  exhibit.image = { material: { map: { needsUpdate: false } } };
  exhibit.pair = [{ id: "before" }, { id: "after" }];
  exhibit.ready = true;
  exhibit.revealed = false;
  exhibit.comparisonMode = "head-tilt";
  exhibit.tiltBlend = 0.25;
  assert.equal(exhibit.beginInteraction(null, "right"), false);
  exhibit.refresh();
  assert.deepEqual(draws.map(([image, alpha]) => [image.id, alpha]),
    [["before", 1], ["after", 0.25]]);
  assert.equal(clips, 0);
  assert.equal(exhibit.lastTiltDrawn, 0.25);
});

test("headset roll drives the dissolve without changing when the head is still", () => {
  const exhibit = Object.create(ChangeExperience.prototype);
  exhibit.started = true;
  exhibit.finished = false;
  exhibit.elapsed = 0;
  exhibit.ready = true;
  exhibit.comparisonMode = "head-tilt";
  exhibit.tiltBlend = 0.5;
  exhibit.lastTiltDrawn = 0.5;
  exhibit.tiltRefreshTime = 0;
  exhibit.headQuaternion = new THREE.Quaternion();
  exhibit.headEuler = new THREE.Euler();
  let redraws = 0;
  exhibit.refresh = () => {
    redraws++;
    exhibit.lastTiltDrawn = exhibit.tiltBlend;
  };
  let orientation = new THREE.Quaternion()
    .setFromEuler(new THREE.Euler(0.2, 1.1, 0.2, "YXZ"));
  const camera = { getWorldQuaternion: (target) => target.copy(orientation) };
  for (let i = 0; i < 5; i++) exhibit.update(0.05, camera);
  assert.ok(exhibit.tiltBlend < 0.1);
  assert.ok(redraws > 0);
  orientation = new THREE.Quaternion()
    .setFromEuler(new THREE.Euler(0.2, 1.1, -0.2, "YXZ"));
  for (let i = 0; i < 8; i++) exhibit.update(0.05, camera);
  assert.ok(exhibit.tiltBlend > 0.9);
  const redrawsAtRest = redraws;
  for (let i = 0; i < 5; i++) exhibit.update(0.05, camera);
  assert.equal(redraws, redrawsAtRest);
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
