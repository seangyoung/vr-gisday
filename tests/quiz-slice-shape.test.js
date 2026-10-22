import test from "node:test";
import assert from "node:assert/strict";
import { polygonArea, splitRectangle } from "../src/quiz/slice-shape.js";

test("an angled blade produces matching diagonal pieces", () => {
  const width = 0.49;
  const height = 0.43;
  const { polygons, normal } = splitRectangle(width, height,
    { x: 0, y: 0 }, { x: 1, y: 1 });
  assert.ok(Math.abs(normal.x + Math.SQRT1_2) < 1e-10);
  assert.ok(Math.abs(normal.y - Math.SQRT1_2) < 1e-10);
  assert.equal(polygons.length, 2);
  assert.ok(polygons.every((polygon) => polygon.length > 3));
  assert.ok(Math.abs(polygons.reduce((sum, polygon) =>
    sum + polygonArea(polygon), 0) - width * height) < 1e-10);
});

test("changing blade orientation changes the visible seam", () => {
  const vertical = splitRectangle(0.5, 0.4, { x: 0, y: 0 },
    { x: 0, y: 1 });
  const horizontal = splitRectangle(0.5, 0.4, { x: 0, y: 0 },
    { x: 1, y: 0 });
  assert.ok(vertical.polygons[0].every((vertex) => vertex.x >= -1e-8));
  assert.ok(vertical.polygons[1].every((vertex) => vertex.x <= 1e-8));
  assert.ok(Math.abs(vertical.normal.x) > 0.99);
  assert.ok(Math.abs(horizontal.normal.y) > 0.99);
  assert.ok(horizontal.polygons[0].every((vertex) => vertex.y <= 1e-8));
  assert.ok(horizontal.polygons[1].every((vertex) => vertex.y >= -1e-8));
});
