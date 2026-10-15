import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CHANGE_SCENES } from "../src/change/scenes.js";

test("every change case has two bundled Landsat frames and a complete interpretation", () => {
  assert.equal(CHANGE_SCENES.length, 5);
  for (const scene of CHANGE_SCENES) {
    assert.notEqual(scene.before, scene.after);
    for (const url of [scene.before, scene.after]) {
      const bytes = readFileSync(fileURLToPath(url));
      assert.ok(bytes.length > 100_000, `${scene.id}: image is unexpectedly small`);
      assert.equal(bytes.readUInt16BE(0), 0xffd8, `${scene.id}: expected JPEG`);
      assert.equal(bytes.readUInt16BE(bytes.length - 2), 0xffd9,
        `${scene.id}: JPEG is truncated`);
    }
    assert.ok(scene.answer >= 0 && scene.answer < scene.options.length);
    assert.ok(scene.explanation.length > 30);
    assert.ok(scene.source.startsWith("https://eros.usgs.gov/"));
    for (const value of Object.values(scene.focus))
      assert.ok(value > 0 && value < 1, `${scene.id}: highlight must be on frame`);
  }
});
