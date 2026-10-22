import test from "node:test";
import assert from "node:assert/strict";
import { segmentHitsBox, sweptBladeHits, sweptBladeHitFraction } from "../src/quiz/slice-hit.js";

const box = { min: { x: -0.2, y: -0.1, z: -0.1 },
  max: { x: 0.2, y: 0.1, z: 0.1 } };

test("a fast swing crosses a target even when both sampled endpoints miss it", () => {
  assert.equal(segmentHitsBox({ x: -0.4, y: 0, z: 0 },
    { x: 0.4, y: 0, z: 0 }, box), true);
  assert.equal(sweptBladeHits([{ x: -0.4, y: 0, z: 0 }],
    [{ x: 0.4, y: 0, z: 0 }], box, 0.1), true);
});

test("resting contact, near misses, and tracking jumps do not slice", () => {
  assert.equal(sweptBladeHits([{ x: 0, y: 0, z: 0 }],
    [{ x: 0.01, y: 0, z: 0 }], box, 0.05), false);
  assert.equal(sweptBladeHits([{ x: -0.4, y: 0.2, z: 0 }],
    [{ x: 0.4, y: 0.2, z: 0 }], box, 0.1), false);
  assert.equal(sweptBladeHits([{ x: -2, y: 0, z: 0 }],
    [{ x: 2, y: 0, z: 0 }], box, 0.1), false);
});

test("a swing that crosses two boxes reports the nearer hit first", () => {
  const first = { min: { x: -0.4, y: -0.1, z: -0.1 },
    max: { x: -0.2, y: 0.1, z: 0.1 } };
  const second = { min: { x: 0.2, y: -0.1, z: -0.1 },
    max: { x: 0.4, y: 0.1, z: 0.1 } };
  const from = [{ x: -0.6, y: 0, z: 0 }];
  const to = [{ x: 0.6, y: 0, z: 0 }];
  assert.ok(sweptBladeHitFraction(from, to, first, 0.1) <
    sweptBladeHitFraction(from, to, second, 0.1));
});
