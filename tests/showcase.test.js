import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { TimedExhibit } from "../src/showcase/exhibit.js";
import { SPECTRA, displayColor, surfaceAt } from "../src/showcase/spectral-model.js";
import {
  SNOW_BUILDINGS, SNOW_PUMPS, SNOW_TOTAL,
  aggregationFor,
} from "../src/showcase/cluster-model.js";
import { projectNormalized, relativeAreaScale } from "../src/showcase/projection-model.js";

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

test("Snow building counts are conserved by all arbitrary aggregation schemes", () => {
  assert.equal(SNOW_BUILDINGS.length, 250);
  assert.equal(SNOW_PUMPS.length, 8);
  assert.equal(SNOW_TOTAL, 489);
  for (const mode of ["fine", "shifted", "coarse"])
    assert.equal(aggregationFor(mode).reduce((sum, cell) => sum + cell.deaths, 0),
      SNOW_TOTAL);
  const fine = aggregationFor("fine");
  const shifted = aggregationFor("shifted");
  assert.equal(fine.length, 100);
  assert.equal(shifted.length, 121);
  assert.notDeepEqual(fine.map((cell) => cell.deaths),
    shifted.map((cell) => cell.deaths));
  assert.ok(Math.max(...aggregationFor("coarse").map((cell) => cell.deaths)) >
    Math.max(...fine.map((cell) => cell.deaths)));
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
