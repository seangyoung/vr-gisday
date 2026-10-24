import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { PIXEL_EXTENT, PIXEL_SIZES, PixelModel } from "../src/pixels/model.js";
import { PixelExperience } from "../src/pixels/experience.js";

test("pixel size changes ground area while retaining the same source landscape", () => {
  const model = new PixelModel();
  assert.deepEqual(PIXEL_SIZES, [1, 10, 30, 1000]);
  for (const size of PIXEL_SIZES) {
    const raster = model.raster(size);
    assert.equal(raster.cells, Math.ceil((PIXEL_EXTENT * 2) / size));
    assert.equal(raster.pixels.length, raster.cells ** 2);
    let totalArea = 0;
    for (const { counts, rgb, sampledArea } of raster.pixels) {
      assert.equal(counts.reduce((sum, n) => sum + n, 0), sampledArea);
      assert.ok(rgb.every((band) => band >= 0 && band <= 255));
      totalArea += sampledArea;
    }
    assert.equal(totalArea, (PIXEL_EXTENT * 2) ** 2);
  }
  const fine = model.cellAt(0, -3, 1);
  const coarse = model.cellAt(0, -3, 30);
  assert.equal(fine.x0, 0);
  assert.equal(fine.z0, -3);
  assert.equal(coarse.x0, -12);
  assert.equal(coarse.z0, -12);
  assert.ok(coarse.counts.filter(Boolean).length >= 3);
  assert.ok(model.raster(30) === model.raster(30));
  assert.equal(model.raster(10).pixels.at(-1).sampledArea, 4 ** 2);
  assert.equal(model.raster(30).pixels.at(-1).sampledArea, 24 ** 2);
  assert.deepEqual(model.cellAt(0, -3, 1000).counts, model.raster(1000).pixels[0].counts);
  assert.equal(model.cellAt(0, -3, 1000).x0, -500);
  assert.throws(() => model.raster(7), RangeError);
});

test("a coarse pixel color is the area-weighted mean of its fine pixels", () => {
  const model = new PixelModel();
  const coarse = model.cellAt(0, -3, 30);
  const fine = model.raster(1);
  const sums = [0, 0, 0, 0];
  for (let row = 0; row < 30; row++)
    for (let col = 0; col < 30; col++) {
      const cell = fine.pixels[(coarse.row * 30 + row) * fine.cells + coarse.col * 30 + col];
      for (let cover = 0; cover < 4; cover++) sums[cover] += cell.counts[cover];
    }
  assert.deepEqual(sums, coarse.counts);
  const rgb = [0, 0, 0];
  for (let dz = 0; dz < 30; dz++)
    for (let dx = 0; dx < 30; dx++) {
      const source = (coarse.row * 30 + dz) * model.width + coarse.col * 30 + dx;
      for (let band = 0; band < 3; band++) rgb[band] += model.rgb[source * 3 + band];
    }
  assert.deepEqual(coarse.rgb, rgb.map((sum) => Math.round(sum / 30 ** 2)));
});

test("pixel footprint, map and terrain targeting, reset, and wrap-up", () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071820);
  let changes = 0;
  const demo = new PixelExperience(scene, () => changes++);
  assert.equal(demo.started, false);
  demo.update(240);
  assert.equal(demo.finished, false);
  assert.equal(demo.elapsed, 0);
  demo.setSize(1000);
  assert.equal(demo.size, 30);
  demo.begin();
  assert.equal(demo.started, true);
  assert.equal(demo.size, 30);
  assert.equal(demo.selected.has("topography"), true);
  assert.equal(demo.selected.has("floodplain"), false);
  assert.ok(demo.pickGround.geometry.attributes.position.count < demo.ground.raised.geometry.attributes.position.count / 10);
  assert.equal(demo.ground.raised.geometry.attributes.position.count, 401 ** 2);
  assert.ok(demo.footprint.parent === demo.variants.raised.world);
  demo.setSize(1000);
  assert.equal(demo.cell.size, 1000);
  assert.equal(demo.cell.sampledArea, 144 ** 2);
  assert.ok(demo.footprint.scale.x < 1);
  demo.update(0.7);
  assert.equal(demo.footprint.scale.x, 1);
  assert.equal(demo.pureWaterAt30, false);
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
  assert.equal(demo.started, true);
  assert.equal(demo.size, 30);
  assert.deepEqual(demo.probe, { x: 0, z: -3 });
  assert.equal(demo.answer, null);
  demo.finish();
  assert.equal(demo.finished, true);
  demo.reset();
  assert.equal(demo.finished, false);
  assert.ok(changes >= 4);
  demo.dispose();
  assert.equal(scene.children.length, 0);
});
