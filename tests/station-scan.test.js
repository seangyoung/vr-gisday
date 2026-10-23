import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { buildScanScene, SCAN_SCENES } from "../src/scan/scenes.js";
import { StationCoverage } from "../src/scan/station-coverage.js";

function survey(id) {
  const group = new THREE.Group();
  const meshes = [];
  buildScanScene(id, (geometry, position, kind) => {
    const object = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    object.position.set(...position).multiplyScalar(8);
    object.scale.setScalar(8);
    object.userData.kind = kind;
    group.add(object);
    meshes.push(object);
    return object;
  });
  const targets = meshes.slice(1).filter((mesh) => mesh.userData.kind === "structure" ||
    id === "canopy" && mesh.userData.kind === "vegetation" ||
    id === "terraces" && mesh.userData.kind === "ground");
  return { group, coverage: new StationCoverage(targets, meshes, 520, group) };
}

test("tripod viewpoints add visible target surfaces across all synthetic scenes", () => {
  for (const { id } of SCAN_SCENES) {
    const { coverage } = survey(id);
    assert.ok(coverage.samples.length > 200, `${id} has a target to survey`);
    coverage.prepare();
    const positions = [[0, 13], [11, 0], [0, -13], [-11, 0]];
    let previous = 0;
    for (const [x, z] of positions) {
      for (let i = 0; i < coverage.samples.length; i++)
        coverage.capture(i, new THREE.Vector3(x, 1.5, z));
      assert.ok(coverage.count >= previous, `${id} coverage stays cumulative`);
      previous = coverage.count;
    }
    assert.ok(coverage.percent >= 55 && coverage.percent <= 100,
      `${id} can be substantially surveyed in four positions`);
  }
});

test("occluded surfaces become visible from the other side after moving the entire scene", () => {
  const { group, coverage } = survey("ruins");
  coverage.prepare();
  for (let i = 0; i < coverage.samples.length; i++)
    coverage.capture(i, new THREE.Vector3(0, 1.5, 13));
  const first = coverage.count;
  assert.ok(first > 0 && first < coverage.samples.length);
  group.position.set(4, 0, -7);
  group.rotation.y = 0.8;
  coverage.prepare();
  for (let i = 0; i < coverage.samples.length; i++)
    coverage.capture(i, new THREE.Vector3(0, 1.5, -13));
  assert.ok(coverage.count > first);
  assert.equal(coverage.percent, Math.round(100 * coverage.count / coverage.samples.length));
});
