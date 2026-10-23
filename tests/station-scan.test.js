import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { buildScanScene, SCAN_SCENES } from "../src/scan/scenes.js";
import { StationCoverage } from "../src/scan/station-coverage.js";
import { StationScanExperience } from "../src/scan/station.js";

function survey(id, budget = 520) {
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
  return { group, coverage: new StationCoverage(targets, meshes, budget, group) };
}

test("one dense station scan fills visible faces; a new angle reveals hidden faces", () => {
  const { coverage } = survey("ruins", 5200);
  coverage.prepare();
  const front = new THREE.Vector3(0, 1.5, 13);
  const back = new THREE.Vector3(0, 1.5, -13);
  for (let i = 0; i < coverage.samples.length; i++) coverage.capture(i, front);
  const first = coverage.count;
  assert.ok(first > 1400, "one station should produce a substantial point cloud");
  for (let i = 0; i < coverage.samples.length; i++) coverage.capture(i, front);
  assert.equal(coverage.count, first, "repeating a station cannot fill hidden faces");
  for (let i = 0; i < coverage.samples.length; i++) coverage.capture(i, back);
  assert.ok(coverage.count > first + 500, "a new angle reveals many hidden faces");
});

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

test("tripod survey starts at standing height and allows walking and teleporting while carrying", () => {
  const station = Object.create(StationScanExperience.prototype);
  station.started = true;
  station.finished = false;
  station.scanQueue = null;
  station.group = new THREE.Group();
  station.visitor = new THREE.Vector2();
  station.walkForward = new THREE.Vector3();
  station.grab = { hands: new Map([[1, true]]) };
  station.tripod = new THREE.Group();
  station.group.add(station.tripod);
  station.canPlace = () => true;
  station.targets = [];
  station.ground = new THREE.Mesh(new THREE.PlaneGeometry(44, 44),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  station.ground.rotation.x = -Math.PI / 2;
  station.group.add(station.ground);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0.2, 0);
  camera.updateMatrixWorld(true);
  station.place(camera);
  assert.ok(Math.abs(station.group.worldToLocal(camera.position.clone()).y - 1.6) < 1e-6);
  const beforeWalk = station.group.position.clone();
  station.walk(0, -1, 1, camera);
  assert.ok(station.group.position.distanceTo(beforeWalk) > 1);
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 4, 0),
    new THREE.Vector3(0, -1, 0));
  const destination = station.teleportCandidate(ray);
  assert.ok(destination?.valid);
  const beforeTeleport = station.group.position.clone();
  assert.equal(station.teleportTo({ x: 4, z: 2, valid: true }, camera), true);
  assert.ok(station.group.position.distanceTo(beforeTeleport) > 1);
  station.updateTripod(new Map([[1, new THREE.Matrix4().makeTranslation(1, 0.3, -1)]]));
  const carried = station.tripod.getWorldPosition(new THREE.Vector3());
  assert.ok(Math.abs(carried.x - 1) < 1e-6);
  assert.ok(Math.abs(carried.z + 1) < 1e-6);
});

test("clipboard preview turns without changing captured survey coverage", () => {
  const station = Object.create(StationScanExperience.prototype);
  station.started = true;
  station.finished = false;
  station.previewAngle = 0;
  station.coverage = { count: 138 };
  let redraws = 0;
  station.refreshClipboard = () => { redraws++; };
  station.turnPreview(1);
  assert.ok(Math.abs(station.previewAngle - Math.PI / 4) < 1e-6);
  station.turnPreview(-1);
  assert.ok(Math.abs(station.previewAngle) < 1e-6);
  assert.equal(station.coverage.count, 138);
  assert.equal(redraws, 2);
});
