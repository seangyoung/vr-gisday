import test from "node:test";
import assert from "node:assert/strict";
import {
  STATIONS, idwEstimate, nearestEstimate, smoothEstimate,
} from "../src/interpolation/model.js";

test("IDW honors measured readings and normalized neighbor weights", () => {
  for (const station of STATIONS)
    assert.equal(idwEstimate(station.x, station.z).value, station.value);
  const estimate = idwEstimate(0.04, 0.08);
  assert.equal(estimate.neighbors.length, 3);
  assert.ok(Math.abs(estimate.neighbors.reduce((sum, n) => sum + n.weight, 0) - 1) < 1e-12);
  assert.ok(Math.abs(estimate.value - estimate.neighbors.reduce((sum, n) =>
    sum + n.station.value * n.weight, 0)) < 1e-12);
});

test("smoothing can miss a measured reading; nearest zones preserve one reading", () => {
  const station = STATIONS[0];
  assert.ok(Math.abs(smoothEstimate(station.x, station.z) - station.value) > 1);
  assert.equal(nearestEstimate(station.x, station.z), station.value);
  for (const point of [[0, 0], [-0.5, 0.1], [0.75, 0.7]])
    assert.ok(STATIONS.some((s) => s.value === nearestEstimate(...point)));
});
