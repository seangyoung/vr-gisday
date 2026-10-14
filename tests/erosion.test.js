import test from "node:test";
import assert from "node:assert/strict";
import { createTray, ErosionWater, EROSION_MAX_CUT, paintVegetation } from "../src/rain/erosion.js";
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
test("painting protects a local patch while runoff still crosses planted ground", () => {
  const size = 65;
  const cover = new Float32Array(size * size);
  assert.equal(paintVegetation(cover, 0, 0), true);
  assert.ok(cover[cellAt(0, 0)] > 0);
  assert.equal(cover[cellAt(0.5, 0.5)], 0);
  for (let i = 0; i < size; i++)
    for (const rim of [i, (size - 1) * size + i, i * size, i * size + size - 1])
      assert.equal(cover[rim], 0);

  const bareBed = createTray(), plantedBed = createTray();
  cover.fill(1);
  const bare = new ErosionWater(bareBed);
  const planted = new ErosionWater(plantedBed, cover);
  const source = cellAt(0, -0.8);
  for (let i = 0; i < 500; i++) {
    if (i % 5 === 0) {
      bare.add(source, 0.00035);
      planted.add(source, 0.00035);
    }
    bare.update(0.02);
    planted.update(0.02);
  }
  assert.ok(bare.eroded > 0.05);
  assert.ok(planted.eroded < bare.eroded * 0.25);
  assert.ok(planted.drained > 0);
  assert.ok(Math.abs(planted.stored + planted.drained - planted.added) < 1e-8);
  assert.ok(Math.abs(planted.eroded - planted.deposited - planted.exported - planted.suspended) < 1e-8);
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
      (v, i) => Number.isFinite(v) && v >= water.initial[i] - EROSION_MAX_CUT - 1e-9,
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

test("a sustained pour can cut deeper than the former shallow bed", () => {
  const h = createTray(),
    water = new ErosionWater(h),
    source = cellAt(0, -0.8);
  for (let i = 0; i < 2000; i++) {
    if (i % 5 === 0) water.add(source, 0.00035);
    water.update(0.02);
  }
  assert.ok(Math.max(...h.map((v, i) => water.initial[i] - v)) > 0.26);
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

test("65-grid bed conserves water and earth during channel and bank changes", () => {
  const size = 65,
    h = createTray(size),
    water = new ErosionWater(h);
  for (let i = 0; i < 1500; i++) {
    if (i % 5 === 0)
      water.add(
        cellAt([-0.65, -0.32, 0, 0.32, 0.65][(i / 5) % 5], -0.8, size),
        0.00035,
      );
    water.update(0.02);
  }
  assert.ok(Math.abs(water.stored + water.drained - water.added) < 1e-8);
  const removed =
    h.reduce((sum, v, i) => sum + water.initial[i] - v, 0) * water.area;
  assert.ok(Math.abs(removed - water.exported - water.suspended) < 1e-8);
  assert.ok(
    Math.abs(
      water.eroded - water.deposited - water.exported - water.suspended,
    ) < 1e-8,
  );
  assert.ok(
    [...h].every(
      (v, i) =>
        Number.isFinite(v) &&
        v >= Math.max(0.015, water.initial[i] - EROSION_MAX_CUT) - 1e-9,
    ),
  );
});
