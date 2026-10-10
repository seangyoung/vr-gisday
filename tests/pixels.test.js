import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { PIXEL_EXTENT, PIXEL_SIZES, PixelModel } from "../src/pixels/model.js";
import { PixelExperience } from "../src/pixels/experience.js";

test("pixel size changes ground area while retaining the same source landscape", () => {
  const model = new PixelModel();
  assert.deepEqual(PIXEL_SIZES, [2, 8, 24, 48]);
  for (const size of PIXEL_SIZES) {
    const raster = model.raster(size);
    assert.equal(raster.cells, (PIXEL_EXTENT * 2) / size);
    assert.equal(raster.pixels.length, raster.cells ** 2);
    for (const { counts, rgb } of raster.pixels) {
      assert.equal(counts.reduce((sum, n) => sum + n, 0), size ** 2);
      assert.ok(rgb.every((band) => band >= 0 && band <= 255));
    }
  }
  const fine = model.cellAt(0, -3, 2);
  const coarse = model.cellAt(0, -3, 24);
  assert.equal(fine.x0, 0);
  assert.equal(fine.z0, -4);
  assert.equal(coarse.x0, 0);
  assert.equal(coarse.z0, -24);
  assert.ok(coarse.counts.filter(Boolean).length >= 3);
  assert.ok(model.raster(24) === model.raster(24));
  assert.throws(() => model.raster(7), RangeError);
});

test("a coarse pixel color is the area-weighted mean of its fine pixels", () => {
  const model = new PixelModel();
  const coarse = model.cellAt(0, -3, 24);
  const fine = model.raster(2);
  const sums = [0, 0, 0, 0];
  for (let row = 0; row < 12; row++)
    for (let col = 0; col < 12; col++) {
      const cell = fine.pixels[(coarse.row * 12 + row) * fine.cells + coarse.col * 12 + col];
      for (let cover = 0; cover < 4; cover++) sums[cover] += cell.counts[cover];
    }
  assert.deepEqual(sums, coarse.counts);
  const rgb = [0, 0, 0];
  for (let dz = 0; dz < 24; dz++)
    for (let dx = 0; dx < 24; dx++) {
      const source = (coarse.row * 24 + dz) * model.width + coarse.col * 24 + dx;
      for (let band = 0; band < 3; band++) rgb[band] += model.rgb[source * 3 + band];
    }
  assert.deepEqual(coarse.rgb, rgb.map((sum) => Math.round(sum / 24 ** 2)));
});

test("pixel footprint, map and terrain targeting, reset, and wrap-up", () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071820);
  let changes = 0;
  const demo = new PixelExperience(scene, () => changes++);
  assert.equal(demo.size, 24);
  assert.equal(demo.selected.has("topography"), true);
  assert.equal(demo.selected.has("floodplain"), false);
  assert.ok(demo.pickGround.geometry.attributes.position.count < demo.ground.raised.geometry.attributes.position.count / 10);
  assert.equal(demo.ground.raised.geometry.attributes.position.count, 401 ** 2);
  assert.ok(demo.footprint.parent === demo.variants.raised.world);
  demo.setSize(48);
  assert.equal(demo.cell.size, 48);
  assert.ok(demo.footprint.scale.x < 1);
  demo.update(0.7);
  assert.equal(demo.footprint.scale.x, 1);
  assert.equal(demo.pureWaterAt48, false);
  demo.predictPureWater(false);
  assert.equal(demo.answer, false);
  demo.placeFromMap({ uv: new THREE.Vector2(0.25, 0.75) });
  assert.deepEqual(demo.probe, { x: -36, z: -36 });
  const ray = new THREE.Raycaster(
    new THREE.Vector3(9, 60, -18),
    new THREE.Vector3(0, -1, 0),
  );
  assert.equal(demo.placeFromRay(ray), true);
  assert.ok(Math.abs(demo.probe.x - 9) < 1);
  assert.ok(Math.abs(demo.probe.z + 18) < 1);
  demo.update(240);
  assert.equal(demo.finished, true);
  demo.reset();
  assert.equal(demo.finished, false);
  assert.equal(demo.size, 24);
  assert.deepEqual(demo.probe, { x: 0, z: -3 });
  assert.equal(demo.answer, null);
  assert.ok(changes >= 4);
  demo.dispose();
  assert.equal(scene.children.length, 0);
});
