import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { PIXEL_EXTENT, PIXEL_SIZES, PixelModel, pixelSizeLabel } from "../src/pixels/model.js";
import { PixelExperience } from "../src/pixels/experience.js";
import { PixelFlyover, flyoverForSize } from "../src/pixels/flyover.js";
import { landscapeHeight } from "../src/layers/experience.js";

test("pixel size changes ground area while retaining the same source landscape", () => {
  const model = new PixelModel();
  assert.deepEqual(PIXEL_SIZES, [0.5, 1, 10, 30]);
  assert.equal(pixelSizeLabel(0.5), "50 cm");
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
  const fine = model.cellAt(0, -3, 0.5);
  const coarse = model.cellAt(0, -3, 30);
  assert.equal(fine.x0, 0);
  assert.equal(fine.z0, -3);
  assert.equal(coarse.x0, -12);
  assert.equal(coarse.z0, -12);
  assert.ok(coarse.counts.filter(Boolean).length >= 3);
  assert.ok(model.raster(30) === model.raster(30));
  assert.equal(model.raster(10).pixels.at(-1).sampledArea, 4 ** 2);
  assert.equal(model.raster(30).pixels.at(-1).sampledArea, 24 ** 2);
  assert.equal(fine.sampledArea, 0.25);
  assert.equal(model.sampleWidth, 288);
  assert.throws(() => model.raster(7), RangeError);
});

test("a coarse pixel color is the area-weighted mean of its fine pixels", () => {
  const model = new PixelModel();
  const coarse = model.cellAt(0, -3, 30);
  const fine = model.raster(0.5);
  const sums = [0, 0, 0, 0];
  for (let row = 0; row < 60; row++)
    for (let col = 0; col < 60; col++) {
      const cell = fine.pixels[(coarse.row * 60 + row) * fine.cells + coarse.col * 60 + col];
      for (let cover = 0; cover < 4; cover++) sums[cover] += cell.counts[cover];
    }
  assert.deepEqual(sums, coarse.counts);
  const rgb = [0, 0, 0];
  for (let dz = 0; dz < 60; dz++)
    for (let dx = 0; dx < 60; dx++) {
      const source = (coarse.row * 60 + dz) * model.sampleWidth + coarse.col * 60 + dx;
      for (let band = 0; band < 3; band++) rgb[band] += model.rgb[source * 3 + band];
    }
  assert.deepEqual(coarse.rgb, rgb.map((sum) => Math.round(sum / 60 ** 2)));
});

test("each ground sample distance starts the requested overhead sensor", () => {
  assert.deepEqual(PIXEL_SIZES.map(flyoverForSize), [
    { kind: "drone", feet: 100 },
    { kind: "aircraft", feet: 200 },
    { kind: "satellite", feet: 200 },
    { kind: "satellite", feet: 200 },
  ]);
  const parent = new THREE.Group();
  const flyover = new PixelFlyover(parent);
  for (const size of PIXEL_SIZES) {
    flyover.begin(size);
    const { kind, feet } = flyover.config;
    assert.equal(parent.children.length, 1);
    assert.ok(Math.abs(flyover.group.position.y -
      landscapeHeight(-68, -60) - feet * 0.3048) < 1e-9);
    flyover.update(2);
    assert.ok(flyover.group.position.x > -68);
    assert.ok(flyover.progress > 0 && flyover.progress < 1);
    assert.equal(flyover.config.kind, kind);
  }
  flyover.update(10);
  assert.equal(parent.children.length, 0);
  assert.equal(flyover.progress, 1);
  flyover.dispose();
});

test("pixel footprint, map and terrain targeting, reset, and wrap-up", () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071820);
  let changes = 0;
  const demo = new PixelExperience(scene, () => changes++);
  assert.equal(demo.started, false);
  assert.equal(demo.hidesWorldUI, false);
  demo.update(240);
  assert.equal(demo.finished, false);
  assert.equal(demo.elapsed, 0);
  demo.setSize(0.5);
  assert.equal(demo.size, 30);
  demo.begin();
  assert.equal(demo.started, true);
  assert.equal(demo.phase, "platforms");
  assert.equal(demo.hidesWorldUI, false);
  assert.equal(demo.group.visible, false);
  assert.equal(demo.platformScene.group.visible, true);
  assert.equal(demo.platformScene.select("drone"), true);
  assert.equal(demo.platformScene.selection.id, "drone");
  demo.showPixels();
  assert.equal(demo.phase, "pixels");
  assert.equal(demo.hidesWorldUI, true);
  demo.clipboard.visible = true;
  assert.equal(demo.hidesWorldUI, false);
  demo.clipboard.visible = false;
  assert.equal(demo.group.visible, true);
  assert.equal(demo.flyover.config.kind, "satellite");
  assert.equal(demo.platformScene.group.visible, false);
  assert.equal(demo.size, 30);
  assert.equal(demo.selected.has("topography"), true);
  assert.equal(demo.selected.has("floodplain"), false);
  assert.ok(demo.pickGround.geometry.attributes.position.count < demo.ground.raised.geometry.attributes.position.count / 10);
  assert.equal(demo.ground.raised.geometry.attributes.position.count, 401 ** 2);
  assert.ok(demo.footprint.parent === demo.variants.raised.world);
  demo.setSize(0.5);
  assert.equal(demo.cell.size, 0.5);
  assert.equal(demo.cell.sampledArea, 0.25);
  assert.equal(demo.flyover.config.kind, "drone");
  assert.ok(Math.abs(demo.flyover.group.position.y -
    (landscapeHeight(-68, -60) + 100 * 0.3048)) < 1e-9);
  assert.notEqual(demo.footprint.scale.x, 1);
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
