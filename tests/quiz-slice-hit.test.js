import test from "node:test";
import assert from "node:assert/strict";
import { segmentHitsBox, sweptBladeHits, sweptBladeHitFraction,
  sweptBladeContact, bladeCutAtContact } from "../src/quiz/slice-hit.js";

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

test("contact reports which blade sample entered the block", () => {
  const previous = [{ x: -0.4, y: 0.3, z: 0 },
    { x: -0.4, y: 0, z: 0 }];
  const current = [{ x: 0.4, y: 0.3, z: 0 },
    { x: 0.4, y: 0, z: 0 }];
  assert.deepEqual(sweptBladeContact(previous, current, box, 0.1),
    { fraction: 0.25, sampleIndex: 1 });
});

test("cut starts at contact and follows the horizontal swing, not the blade's angle", () => {
  const previous = [{ x: -0.4, y: 0.05, z: 0 },
    { x: -0.4, y: -0.05, z: 0 }];
  const current = [{ x: 0.4, y: 0.05, z: 0 },
    { x: 0.4, y: -0.05, z: 0 }];
  const contact = sweptBladeContact(previous, current, box, 0.1);
  const cut = bladeCutAtContact(previous, current, contact);
  assert.deepEqual(cut.point, { x: -0.2, y: 0.05 });
  assert.ok(cut.direction.x > 0.79);
  assert.ok(Math.abs(cut.direction.y) < 1e-10);
});

test("vertical and diagonal swings produce distinct seam directions", () => {
  const sample = (from, to) => bladeCutAtContact([from], [to],
    sweptBladeContact([from], [to], box, 0.1));
  const vertical = sample({ x: 0, y: -0.3, z: 0 },
    { x: 0, y: 0.3, z: 0 });
  assert.ok(Math.abs(vertical.direction.x) < 1e-10);
  assert.ok(vertical.direction.y > 0.59);
  const diagonal = sample({ x: -0.35, y: -0.25, z: 0 },
    { x: 0.35, y: 0.25, z: 0 });
  assert.ok(diagonal.direction.x > 0.69);
  assert.ok(diagonal.direction.y > 0.49);
});

test("a mostly straight-in thrust uses the blade angle rather than depth jitter", () => {
  const previous = [{ x: -0.05, y: 0.04, z: 0.28 },
    { x: 0.05, y: -0.04, z: 0.28 }];
  const current = [{ x: -0.048, y: 0.041, z: -0.28 },
    { x: 0.052, y: -0.039, z: -0.28 }];
  const contact = sweptBladeContact(previous, current, box, 0.1);
  const cut = bladeCutAtContact(previous, current, contact);
  assert.ok(cut.direction.x > 0.09);
  assert.ok(cut.direction.y < -0.07);
});
