import test from "node:test";
import assert from "node:assert/strict";
import {
  SIZE,
  cellAt,
  cellPoint,
  routeFrom,
  outletFor,
  OUTLET_A,
  OUTLET_B,
  CHALLENGE,
} from "../src/rain/terrain.js";
test("every terrain cell drains downhill without cycles to one of the two designated outlets", () => {
  for (let id = 0; id < SIZE * SIZE; id++) {
    const path = routeFrom(id);
    assert.equal(new Set(path).size, path.length);
    assert.ok([OUTLET_A, OUTLET_B].includes(path.at(-1)));
    for (let i = 1; i < path.length; i++)
      assert.ok(cellPoint(path[i]).y < cellPoint(path[i - 1]).y);
  }
});
test("nearby rain on opposite sides of the divide reaches different outlets", () => {
  assert.equal(outletFor(cellAt(-0.1, -0.25)), "A");
  assert.equal(outletFor(cellAt(0.1, -0.25)), "B");
  assert.equal(outletFor(CHALLENGE), "B");
});
test("rainfall selection clamps to the terrain and routing is deterministic", () => {
  assert.equal(cellAt(-100, 100), (SIZE - 1) * SIZE);
  assert.deepEqual(routeFrom(CHALLENGE), routeFrom(CHALLENGE));
  assert.equal(routeFrom(OUTLET_A).length, 1);
});
