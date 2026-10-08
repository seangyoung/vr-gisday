import test from "node:test";
import assert from "node:assert/strict";
import { SurfaceWater } from "../src/rain/water.js";

function bowl() {
  const h = new Float64Array(49).fill(2);
  for (let r = 2; r <= 4; r++) for (let c = 2; c <= 4; c++) h[r * 7 + c] = 0;
  h[3 * 7 + 5] = 1; // unique lowest spill edge
  h[3 * 7 + 6] = 0; // open outlet
  return new SurfaceWater(h, 7, 1);
}
function settle(w, seconds = 20) {
  for (let i = 0; i < seconds * 50; i++) w.update(0.02);
}
test("pond retains water below the spill edge, rises, then overflows with conserved volume", () => {
  const w = bowl();
  w.add(24, 2);
  settle(w);
  assert.ok(w.drained < 1e-8);
  assert.ok(Math.abs(w.depth[24] - 2 / 9) < 0.001);
  w.add(24, 12);
  settle(w, 40);
  assert.ok(w.drained > 4.9 && w.drained < 5.1);
  assert.ok(Math.abs(w.depth[24] - 1) < 0.001);
  assert.ok(Math.abs(w.stored + w.drained - w.added) < 1e-8);
  assert.ok([...w.depth].every((d) => Number.isFinite(d) && d >= 0));
});
test("fixed step matches frame partitions and reset removes all stored water", () => {
  const a = bowl(),
    b = bowl();
  a.add(24, 14);
  b.add(24, 14);
  for (let i = 0; i < 100; i++) a.update(0.1);
  for (let i = 0; i < 500; i++) b.update(0.02);
  assert.deepEqual(a.depth, b.depth);
  a.clear();
  assert.equal(a.stored, 0);
  assert.equal(a.drained, 0);
  assert.equal(a.added, 0);
});

test("overflow feeds a downstream hollow before leaving the model", () => {
  const h = new Float64Array(81).fill(3);
  // Narrow two-bowl channel; no diagonal shortcut across its walls.
  for (let c = 1; c < 9; c++) h[4 * 9 + c] = [0, 0, 0, 1, 0, 0, 0, 0.5, 0][c];
  const w = new SurfaceWater(h, 9, 1);
  w.add(4 * 9 + 1, 4);
  settle(w, 40);
  assert.ok(w.depth[4 * 9 + 4] > 0.4);
  assert.ok(w.drained > 0);
  assert.ok(Math.abs(w.stored + w.drained - 4) < 1e-8);
});
