import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { TimedExhibit } from "../src/showcase/exhibit.js";
import { SPECTRA, displayColor, surfaceAt } from "../src/showcase/spectral-model.js";
import {
  SNOW_BLOCKS, SNOW_BUILDINGS, SNOW_PUMPS, SNOW_TOTAL,
  aggregationFor, blockAt,
} from "../src/showcase/cluster-model.js";
import {
  GlobeSpin, indicatrixAxes, projectMetric, projectNormalized,
  projectionFitScale, relativeAreaScale,
} from "../src/showcase/projection-model.js";

test("synthetic spectral signatures make the invisible band reveal healthy leaves", () => {
  assert.equal(surfaceAt(0.12, 0.2), "forest");
  assert.equal(surfaceAt(0.31, 0.31), "stressed");
  assert.equal(surfaceAt(0.59 + 0.075 * Math.sin(0.5 * 6.3 + 0.4), 0.5), "water");
  assert.ok(SPECTRA.forest.bands[3] > SPECTRA.forest.bands[2] * 8);
  assert.ok(SPECTRA.stressed.bands[3] < SPECTRA.forest.bands[3]);
  const natural = displayColor("forest", "natural");
  const falseColor = displayColor("forest", "false");
  assert.ok(falseColor[0] > natural[0]);
  assert.ok(falseColor[0] > falseColor[1]);
});

test("Snow blocks are conserved by each hypothetical ward plan", () => {
  assert.equal(SNOW_BUILDINGS.length, 250);
  assert.equal(SNOW_PUMPS.length, 8);
  assert.equal(SNOW_BLOCKS.length, 40);
  assert.equal(SNOW_TOTAL, 489);
  assert.equal(SNOW_BLOCKS.reduce((sum, block) => sum + block.deaths, 0),
    SNOW_TOTAL);
  for (const [mode, count] of [["wardA", 6], ["wardB", 6], ["wardC", 5]]) {
    const zones = aggregationFor(mode);
    assert.equal(zones.length, count);
    assert.ok(zones.every((zone) => zone.blocks.length > 0));
    assert.equal(zones.reduce((sum, zone) => sum + zone.deaths, 0), SNOW_TOTAL);
    assert.deepEqual(zones.flatMap((zone) => zone.blocks.map((block) => block.id))
      .sort((a, b) => a - b), SNOW_BLOCKS.map((block) => block.id));
  }
  assert.notDeepEqual(aggregationFor("wardA").map((zone) => zone.deaths),
    aggregationFor("wardB").map((zone) => zone.deaths));
  assert.equal(blockAt(SNOW_BLOCKS[0].x, SNOW_BLOCKS[0].y, 0)?.id,
    SNOW_BLOCKS[0].id);
  assert.equal(blockAt(0, 0), null);
});

test("projection examples preserve distinct distortion tradeoffs", () => {
  for (const name of ["equirectangular", "mercator", "equalArea"]) {
    const origin = projectNormalized(0, 0, name);
    assert.ok(Math.abs(origin.x) < 1e-12 && Math.abs(origin.y) < 1e-12);
  }
  assert.ok(relativeAreaScale("mercator", 60) >
    relativeAreaScale("equirectangular", 60));
  assert.equal(relativeAreaScale("equalArea", 60), 1);
  const equator = projectNormalized(0, 0, "mercator");
  const high = projectNormalized(0, 80, "mercator");
  assert.ok(high.y > equator.y);
  const equal0 = projectNormalized(90, 60, "equalArea", 0);
  const equal30 = projectNormalized(90, 60, "equalArea", 30);
  assert.ok(equal30.x < equal0.x && equal30.y > equal0.y);
});

test("Tissot axes reflect shape and area without display stretching", () => {
  const plate = indicatrixAxes("equirectangular", 60);
  const mercator = indicatrixAxes("mercator", 60);
  const equalArea = indicatrixAxes("equalArea", 60);
  assert.ok(Math.abs(plate.horizontal - 2) < 1e-12);
  assert.equal(plate.vertical, 1);
  assert.ok(Math.abs(mercator.horizontal - mercator.vertical) < 1e-12);
  assert.ok(Math.abs(mercator.horizontal * mercator.vertical - 4) < 1e-12);
  assert.ok(Math.abs(equalArea.horizontal * equalArea.vertical - 1) < 1e-12);
  assert.ok(equalArea.horizontal > equalArea.vertical);
  for (const projection of ["equirectangular", "mercator", "equalArea"]) {
    const scale = projectionFitScale(projection);
    assert.ok(Math.abs(projectMetric(180, 0, projection).x * scale) <= 0.860001);
    const edge = projection === "mercator" ? 85 : 90;
    assert.ok(Math.abs(projectMetric(0, edge, projection).y * scale) <= 0.530001);
  }
});

test("globe swipe coasts, settles, and resumes its default spin", () => {
  const spin = new GlobeSpin();
  spin.begin(0, 0);
  spin.drag(0.3, 0.1, 0.05);
  assert.ok(spin.yaw > 0 && spin.pitch < 0);
  const initialYaw = spin.yaw;
  spin.end();
  spin.step(0.1);
  assert.ok(spin.yaw > initialYaw + 0.016);
  for (let i = 0; i < 400; i++) spin.step(0.02);
  assert.ok(Math.abs(spin.yawVelocity) < 1e-6);
  assert.ok(Math.abs(spin.pitch) < 0.02);
  const settledYaw = spin.yaw;
  spin.step(1);
  assert.ok(Math.abs(spin.yaw - settledYaw - 0.16) < 1e-5);
});

test("new exhibits wait at their introduction and wrap up after four minutes", () => {
  const root = new THREE.Group();
  let changes = 0;
  const exhibit = new TimedExhibit(root, () => changes++);
  exhibit.update(240);
  assert.equal(exhibit.elapsed, 0);
  assert.equal(exhibit.group.visible, false);
  exhibit.begin();
  assert.equal(exhibit.group.visible, true);
  exhibit.update(240);
  assert.equal(exhibit.finished, true);
  assert.equal(changes, 2);
  exhibit.dispose();
  assert.equal(root.children.length, 0);
});
