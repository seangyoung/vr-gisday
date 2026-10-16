import test from "node:test";
import assert from "node:assert/strict";
import {
  BUFFER_KM, HOMES, PRIORITIES, SITES, inBuffer, scoreSites, siteFacts,
} from "../src/suitability/model.js";

test("distance buffers and site facts come from the same schematic town", () => {
  assert.equal(BUFFER_KM, 0.45);
  assert.equal(SITES.length, 3);
  for (const site of SITES) {
    const residents = HOMES.filter((home) => inBuffer(site, home))
      .reduce((sum, home) => sum + home[2], 0);
    assert.equal(siteFacts(site).residents, residents);
    assert.ok(siteFacts(site).roadMeters >= 0);
  }
  assert.equal(siteFacts(SITES[1]).floodplain, true);
  assert.equal(siteFacts(SITES[0]).floodplain, false);
});

test("changing explicit suitability weights changes the leading site", () => {
  for (const priority of Object.values(PRIORITIES))
    assert.ok(Math.abs(Object.values(priority.weights)
      .reduce((sum, weight) => sum + weight, 0) - 1) < 1e-12);
  const reach = scoreSites("reach");
  const safety = scoreSites("safety");
  assert.equal(reach.winner.site.id, "B");
  assert.equal(safety.winner.site.id, "A");
  assert.ok(reach.scores.every((entry) => entry.score >= 0 && entry.score <= 100));
  assert.ok(reach.scores.find((entry) => entry.site.id === "B").residents >
    reach.scores.find((entry) => entry.site.id === "A").residents);
  assert.deepEqual(reach.scores.map((entry) => entry.residents),
    safety.scores.map((entry) => entry.residents));
});
