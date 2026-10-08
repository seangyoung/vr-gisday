import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { SCAN_SCENES, createSceneRotation } from "../src/scan/scenes.js";
import { ScanExperience } from "../src/scan/experience.js";

test("shuffled cycles visit every scene without adjacent repeats", () => {
  for (const random of [() => 0, () => 0.999, Math.random]) {
    const next = createSceneRotation(random);
    let last;
    for (let cycle = 0; cycle < 30; cycle++) {
      const ids = [];
      for (let i = 0; i < SCAN_SCENES.length; i++) {
        const scene = next();
        assert.notEqual(scene.id, last);
        ids.push(scene.id);
        last = scene.id;
      }
      assert.equal(new Set(ids).size, SCAN_SCENES.length);
    }
  }
});

for (const info of SCAN_SCENES)
  test(`${info.name}: scan all classes, preserve geometry when clearing`, () => {
    const s = new ScanExperience(new THREE.Scene(), () => {}, info);
    s.explore();
    for (const z of [-3, 3]) {
      const origin = new THREE.Vector3(0, 1.6, z);
      for (let x = -0.95; x <= 0.95; x += 0.05)
        for (let y = 0; y <= 1; y += 0.04)
          s.record(origin, new THREE.Vector3(x, y, 0).sub(origin).normalize());
    }
    assert.deepEqual([...new Set(s.records.map((r) => r.kind))].sort(), [
      "ground",
      "structure",
      "vegetation",
    ]);
    assert.ok(s.records.length > 100);
    assert.ok(s.records.length <= s.capacity);
    const bounds = new THREE.Box3();
    for (const m of s.targets) bounds.union(new THREE.Box3().setFromObject(m));
    assert.ok(bounds.min.x >= -1.001 && bounds.max.x <= 1.001);
    assert.ok(bounds.min.z >= -0.801 && bounds.max.z <= 0.801);
    assert.ok(bounds.max.y <= 1.051);
    const targets = [...s.targets];
    s.clearScan();
    assert.equal(s.sceneInfo, info);
    assert.deepEqual(s.targets, targets);
    assert.equal(s.records.length, 0);
    s.dispose();
  });
