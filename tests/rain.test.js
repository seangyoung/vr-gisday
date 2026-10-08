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

test("sculpt brush has smooth falloff, bounded heights, and an anchored rim", async () => {
  const { createHeights, sculpt } = await import("../src/rain/terrain.js");
  const heights = createHeights(),
    original = createHeights();
  sculpt(heights, 0, 0, 0.1);
  assert.ok(
    heights[cellAt(0, 0)] - original[cellAt(0, 0)] >
      heights[cellAt(0.15, 0)] - original[cellAt(0.15, 0)],
  );
  assert.equal(heights[cellAt(0.4, 0)], original[cellAt(0.4, 0)]);
  for (const amount of [100, -100]) {
    sculpt(heights, 0, 0, amount, 3);
    assert.ok([...heights].every((h) => h >= 0.015 && h <= 1.05));
    for (let i = 0; i < SIZE; i++) {
      for (const id of [
        i,
        (SIZE - 1) * SIZE + i,
        i * SIZE,
        i * SIZE + SIZE - 1,
      ])
        assert.equal(heights[id], original[id]);
    }
  }
  assert.deepEqual(createHeights(), original);
});

test("digging creates a closed sink and revised paths remain strictly downhill and cycle-free", async () => {
  const { createHeights, sculpt } = await import("../src/rain/terrain.js");
  const heights = createHeights(),
    center = cellAt(-0.3, -0.4);
  assert.equal(outletFor(center, heights), "A");
  sculpt(heights, -0.3, -0.4, -0.8);
  assert.equal(outletFor(center, heights), "sink");
  for (let id = 0; id < SIZE * SIZE; id++) {
    const path = routeFrom(id, heights);
    assert.equal(new Set(path).size, path.length);
    for (let i = 1; i < path.length; i++)
      assert.ok(
        cellPoint(path[i], heights).y < cellPoint(path[i - 1], heights).y,
      );
  }
});
