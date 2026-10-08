import test from "node:test";
import assert from "node:assert/strict";
import { createTray, ErosionWater } from "../src/rain/erosion.js";
import { SIZE, cellAt, cellPoint } from "../src/rain/terrain.js";

test("dry tray is stable and initial roughness is reproducible", () => {
  const h = createTray(),
    original = h.slice(),
    water = new ErosionWater(h);
  for (let i = 0; i < 100; i++) water.update(0.02);
  assert.deepEqual(h, original);
  assert.deepEqual(h, createTray());
  assert.equal(water.eroded, 0);
  assert.equal(water.suspended, 0);
});
test("pouring cuts the bed, deposits sediment, and conserves water and sediment", () => {
  const h = createTray(),
    water = new ErosionWater(h);
  for (let i = 0; i < 1500; i++) {
    if (i % 5 === 0)
      water.add(
        cellAt([-0.65, -0.32, 0, 0.32, 0.65][(i / 5) % 5], -0.8),
        0.00035,
      );
    water.update(0.02);
  }
  const cut = h.map((v, i) => water.initial[i] - v);
  assert.ok(Math.max(...cut) > 0.03);
  assert.ok(water.deposited > 0);
  assert.ok(water.exported > 0);
  assert.ok(
    [...h].every(
      (v, i) => Number.isFinite(v) && v >= water.initial[i] - 0.240000001,
    ),
  );
  assert.ok([...water.sediment].every((v) => v >= 0 && Number.isFinite(v)));
  assert.ok(Math.abs(water.stored + water.drained - water.added) < 1e-8);
  assert.ok(
    Math.abs(
      water.eroded - water.deposited - water.exported - water.suspended,
    ) < 1e-8,
  );
  const removed = cut.reduce((a, b) => a + b, 0) * water.area;
  assert.ok(Math.abs(removed - water.exported - water.suspended) < 1e-8);
  for (let i = 0; i < SIZE; i++)
    for (const id of [i, (SIZE - 1) * SIZE + i, i * SIZE, i * SIZE + SIZE - 1])
      assert.equal(h[id], water.initial[id]);
});

// Exhibit acceptance: more than a tiny pit at the faucet must change within 10 s.
test("a ten-second pour produces visible channels extending down the tray", () => {
  const h = createTray(),
    water = new ErosionWater(h);
  for (let i = 0; i < 500; i++) {
    if (i % 5 === 0)
      water.add(
        cellAt([-0.65, -0.32, 0, 0.32, 0.65][(i / 5) % 5], -0.8),
        0.00035,
      );
    water.update(0.02);
  }
  const cuts = [...h].map((v, i) => water.initial[i] - v);
  assert.ok(Math.max(...cuts) > 0.1);
  assert.ok(
    cuts.filter((v, i) => v > 0.02 && cellPoint(i).z > -0.4).length > 100,
  );
});

test("fast runoff erodes a cell even when it empties during the step", () => {
  const h = createTray(),
    water = new ErosionWater(h),
    id = cellAt(0, -0.4);
  // Add a thin film directly to one cell to isolate the emptying case.
  water.depth[id] = 0.0001;
  water.step();
  assert.equal(water.depth[id], 0);
  assert.ok(h[id] < water.initial[id]);
});
