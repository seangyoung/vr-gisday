import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { SCAN_SCENES } from "../src/scan/scenes.js";
import { buildStationBackdrop } from "../src/scan/station-backdrop.js";

test("every tripod scene has a distinct setting beyond a continuous survey cordon", () => {
  const details = new Set();
  for (const { id } of SCAN_SCENES) {
    const { group, groundColor } = buildStationBackdrop(id);
    assert.ok(Number.isInteger(groundColor), `${id} has matching ground color`);
    assert.equal(group.userData.sceneId, id);
    details.add(group.userData.detail);
    const pieces = [];
    group.traverse((object) => { if (object.userData.backdropKind) pieces.push(object); });
    assert.ok(pieces.some((object) => object.userData.backdropKind === "terrain"),
      `${id} has a distant landscape`);
    assert.ok(pieces.some((object) => object.userData.backdropKind.startsWith("distant-")),
      `${id} has scene-specific surroundings`);
    assert.equal(pieces.filter((object) => object.userData.backdropKind === "barrier-rail").length,
      8, `${id} has upper and lower rails on all four sides`);
    const posts = pieces.find((object) => object.userData.backdropKind === "barrier-posts");
    assert.equal(posts.count, 40, `${id} has supported perimeter rails`);
    assert.ok(pieces.every((object) => object.userData.kind === undefined),
      `${id} backdrop never becomes a scored scan target`);
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group);
    assert.ok(bounds.min.x <= -60 && bounds.max.x >= 60 &&
      bounds.min.z <= -60 && bounds.max.z >= 60,
    `${id} has a horizon in every direction`);
  }
  assert.ok(details.size >= 6, "backdrops vary by scan setting");
});
