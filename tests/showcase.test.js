import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { TimedExhibit } from "../src/showcase/exhibit.js";
import { displayedBandBrightness, nirGrayPixel } from "../src/showcase/spectral-model.js";
import { SPECTRAL_SCENES, createSpectralSceneRotation } from "../src/showcase/spectral-scenes.js";
import {
  SNOW_BLOCKS, SNOW_BUILDINGS, SNOW_PUMPS, SNOW_TOTAL,
  aggregationFor, blockAt, wardFor,
} from "../src/showcase/cluster-model.js";
import {
  GlobeSpin, TISSOT_LONGITUDES, continentDistortionSummary,
  nearestTissotCircle,
  indicatrixAxes, projectMetric, projectNormalized,
  projectionFitScale, relativeAreaScale, tissotDistortion,
} from "../src/showcase/projection-model.js";
import {
  clampContinentLatitude, projectedContinentRings,
  projectedFootprintArea, shiftContinentPoint,
} from "../src/showcase/continent-shift.js";
import { orientGlobe, ProjectionExperience } from "../src/showcase/projection-experience.js";
import { CONTINENTS, continentAt } from "../src/showcase/continent-model.js";
import { exhibitPanelHit } from "../src/showcase/pointer-targets.js";

test("XR hover safely handles free-floating exhibits without flat panels", () => {
  const raycaster = new THREE.Raycaster(
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1));
  assert.equal(exhibitPanelHit(raycaster, { kind: "suitability", started: true }), null);
  assert.equal(exhibitPanelHit(raycaster, { kind: "interpolation", started: true }), null);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial());
  assert.ok(exhibitPanelHit(raycaster, { kind: "cluster", started: true, map: panel }));
  panel.geometry.dispose();
  panel.material.dispose();
});

test("rendered Landsat composites map display colors to sampled band brightness", () => {
  assert.deepEqual(displayedBandBrightness([38, 72, 96, 255], [184, 53, 72, 255]),
    [96, 72, 38, 184]);
  assert.deepEqual(nirGrayPixel([184, 53, 72, 255]), [184, 184, 184, 255]);
});

test("real spectral scenes rotate without an immediate repeat", () => {
  const next = createSpectralSceneRotation(() => 0.4);
  const firstCycle = [next(), next(), next()];
  assert.equal(firstCycle[0].id, "bay");
  assert.deepEqual(new Set(firstCycle.map((scene) => scene.id)),
    new Set(SPECTRAL_SCENES.map((scene) => scene.id)));
  const secondCycle = [next(), next(), next()];
  assert.notEqual(secondCycle[0].id, firstCycle.at(-1).id);
  assert.deepEqual(new Set(secondCycle.map((scene) => scene.id)),
    new Set(SPECTRAL_SCENES.map((scene) => scene.id)));
});

test("Snow blocks are conserved by each hypothetical ward plan", () => {
  assert.equal(SNOW_BUILDINGS.length, 250);
  assert.equal(SNOW_PUMPS.length, 8);
  assert.equal(SNOW_BLOCKS.length, 40);
  assert.equal(SNOW_TOTAL, 489);
  assert.equal(SNOW_BLOCKS.reduce((sum, block) => sum + block.deaths, 0),
    SNOW_TOTAL);
  for (const [mode, count] of [["wardA", 6], ["wardB", 6],
    ["wardC", 6], ["wardD", 4]]) {
    const zones = aggregationFor(mode);
    assert.equal(zones.length, count);
    assert.ok(zones.every((zone) => zone.blocks.length > 0));
    assert.equal(zones.reduce((sum, zone) => sum + zone.deaths, 0), SNOW_TOTAL);
    assert.deepEqual(zones.flatMap((zone) => zone.blocks.map((block) => block.id))
      .sort((a, b) => a - b), SNOW_BLOCKS.map((block) => block.id));
    assert.ok(zones.every((zone) => {
      const underLabel = blockAt(zone.labelX, zone.labelY, 0);
      return underLabel && wardFor(underLabel, mode) === zone.id;
    }));
  }
  assert.notDeepEqual(aggregationFor("wardA").map((zone) => zone.deaths),
    aggregationFor("wardB").map((zone) => zone.deaths));
  const partitions = ["wardA", "wardB", "wardC", "wardD"].map((mode) => {
    const zones = aggregationFor(mode);
    return SNOW_BLOCKS.map((block) => zones.findIndex(
      (zone) => zone.blocks.includes(block))).join(",");
  });
  assert.equal(new Set(partitions).size, 4);
  assert.equal(blockAt(SNOW_BLOCKS[0].x, SNOW_BLOCKS[0].y, 0)?.id,
    SNOW_BLOCKS[0].id);
  assert.equal(blockAt(0, 0), null);
});

test("ward plans visibly change the mapped concentration while keeping deaths fixed", () => {
  const compact = aggregationFor("wardA");
  const diagonal = aggregationFor("wardB");
  const eastWest = aggregationFor("wardC");
  const broad = aggregationFor("wardD");
  const pump = SNOW_PUMPS.find((point) => point.name.includes("Broad"));
  const darkestCompact = compact.reduce((best, zone) =>
    zone.deaths > best.deaths ? zone : best);
  assert.equal(darkestCompact.deaths, 176);
  assert.ok(Math.hypot(darkestCompact.x - pump.x, darkestCompact.y - pump.y) < 80);
  assert.ok(Math.max(...diagonal.map((zone) => zone.deaths)) < 100);
  assert.ok(new Set([1, 12, 30, 39].map((id) =>
    wardFor(SNOW_BLOCKS[id], "wardB"))).size >= 3);
  const darkestEastWest = eastWest.reduce((best, zone) =>
    zone.deaths > best.deaths ? zone : best);
  assert.ok(darkestEastWest.y > pump.y + 50);
  assert.ok(broad.every((zone) => zone.deaths >= 100 && zone.deaths < 150));
});

test("projection examples preserve distinct distortion tradeoffs", () => {
  for (const name of ["equirectangular", "mercator", "equalArea"]) {
    const origin = projectNormalized(0, 0, name);
    assert.ok(Math.abs(origin.x) < 1e-12 && Math.abs(origin.y) < 1e-12);
  }
  assert.ok(relativeAreaScale("mercator", 60) >
    relativeAreaScale("equirectangular", 60));
  assert.equal(relativeAreaScale("equalArea", 60), 1);
  const equator = projectNormalized(0, 0, "mercator");
  const high = projectNormalized(0, 80, "mercator");
  assert.ok(high.y > equator.y);
  const equal0 = projectNormalized(90, 60, "equalArea", 0);
  const equal30 = projectNormalized(90, 60, "equalArea", 30);
  assert.ok(equal30.x < equal0.x && equal30.y > equal0.y);
});

test("Tissot axes reflect shape and area without display stretching", () => {
  assert.deepEqual(TISSOT_LONGITUDES.slice(1).map((lon, i) => lon - TISSOT_LONGITUDES[i]),
    [60, 60, 60, 60, 60, 60]);
  const plate = indicatrixAxes("equirectangular", 60);
  const mercator = indicatrixAxes("mercator", 60);
  const equalArea = indicatrixAxes("equalArea", 60);
  assert.ok(Math.abs(plate.horizontal - 2) < 1e-12);
  assert.equal(plate.vertical, 1);
  assert.ok(Math.abs(mercator.horizontal - mercator.vertical) < 1e-12);
  assert.ok(Math.abs(mercator.horizontal * mercator.vertical - 4) < 1e-12);
  assert.ok(Math.abs(equalArea.horizontal * equalArea.vertical - 1) < 1e-12);
  assert.ok(equalArea.horizontal > equalArea.vertical);
  for (const projection of ["equirectangular", "mercator", "equalArea"]) {
    const scale = projectionFitScale(projection);
    assert.ok(Math.abs(projectMetric(180, 0, projection).x * scale) <= 0.860001);
    const edge = projection === "mercator" ? 85 : 90;
    assert.ok(Math.abs(projectMetric(0, edge, projection).y * scale) <= 0.530001);
  }
});

test("selected Tissot readouts distinguish shape from relative area", () => {
  const plate = tissotDistortion("equirectangular", 60);
  assert.ok(Math.abs(plate.shapeRatio - 2) < 1e-12);
  assert.equal(plate.longerAxis, "east-west");
  assert.ok(Math.abs(plate.relativeArea - 2) < 1e-12);
  const mercator = tissotDistortion("mercator", 60);
  assert.equal(mercator.shapeRatio, 1);
  assert.ok(Math.abs(mercator.relativeArea - 4) < 1e-12);
  const equalArea = tissotDistortion("equalArea", 60);
  assert.ok(Math.abs(equalArea.shapeRatio - 4) < 1e-12);
  assert.equal(equalArea.relativeArea, 1);
  const shifted = tissotDistortion("equalArea", 0, 30);
  assert.equal(shifted.longerAxis, "north-south");
  assert.ok(Math.abs(shifted.shapeRatio - 4 / 3) < 1e-12);
});

test("Tissot circle selection follows geographic locations across the map seam", () => {
  assert.deepEqual(nearestTissotCircle(1, 29),
    { longitude: 0, latitude: 30 });
  assert.deepEqual(nearestTissotCircle(179, -31),
    { longitude: -180, latitude: -30 });
  assert.deepEqual(nearestTissotCircle(-179, -31),
    { longitude: -180, latitude: -30 });
  assert.equal(nearestTissotCircle(34, 15), null);
});

test("land picks identify generalized continents and leave open ocean unselected", () => {
  for (const [lon, lat, name] of [
    [20, 0, "Africa"], [-100, 40, "North America"],
    [-65, -15, "South America"], [10, 50, "Eurasia"],
    [80, 50, "Eurasia"], [135, -25, "Australia"],
    [0, -85, "Antarctica"],
  ]) assert.equal(continentAt(lon, lat)?.name, name);
  assert.equal(continentAt(-140, 0), null);
  assert.equal(CONTINENTS.length, 6);
});

test("globe grip can select polar landmasses", () => {
  const experience = {
    started: true, finished: false, continentGripBy: null,
    group: { updateWorldMatrix() {} },
    continentOverlay: { visible: false }, globe: {},
  };
  const hitAt = (longitude, latitude) =>
    ProjectionExperience.prototype.continentGripHit.call(experience, {
      intersectObject: () => [{ uv: {
        x: (longitude + 180) / 360, y: (latitude + 90) / 180,
      } }],
    });
  assert.equal(hitAt(-100, 40)?.continent.name, "North America");
  assert.equal(hitAt(0, -85)?.continent.name, "Antarctica");
});

test("shifting a continent rotates it on the sphere without changing ground distances", () => {
  const australia = CONTINENTS.find((c) => c.name === "Australia");
  const target = [15, 60];
  const source = australia.rings[0].slice(0, 12);
  const shifted = source.map(([lon, lat]) =>
    shiftContinentPoint(lon, lat, australia.center, target));
  const central = shiftContinentPoint(...australia.center,
    australia.center, target);
  assert.ok(Math.abs(central[0] - target[0]) < 1e-8);
  assert.ok(Math.abs(central[1] - target[1]) < 1e-8);
  const chord = ([lon1, lat1], [lon2, lat2]) => {
    const radians = Math.PI / 180;
    return Math.sin(lat1 * radians) * Math.sin(lat2 * radians) +
      Math.cos(lat1 * radians) * Math.cos(lat2 * radians) *
      Math.cos((lon1 - lon2) * radians);
  };
  for (let i = 1; i < source.length; i++)
    assert.ok(Math.abs(chord(source[0], source[i]) -
      chord(shifted[0], shifted[i])) < 1e-10);
});

test("one landmass visibly expands in Mercator and keeps area in equal-area", () => {
  const australia = CONTINENTS.find((c) => c.name === "Australia");
  const ratio = (projection) => {
    const home = projectedFootprintArea(projectedContinentRings(
      australia, australia.center, projection));
    const moved = projectedFootprintArea(projectedContinentRings(
      australia, [15, 60], projection));
    return moved / home;
  };
  assert.ok(ratio("mercator") > 3);
  assert.ok(Math.abs(ratio("equalArea") - 1) < 0.01);
  assert.ok(ratio("equirectangular") > 1.5);
  assert.equal(clampContinentLatitude(australia, 60, "mercator"), 60);
  const africa = CONTINENTS.find((c) => c.name === "Africa");
  assert.ok(clampContinentLatitude(africa, 72, "mercator") < 60);
  const northAmerica = CONTINENTS.find((c) => c.name === "North America");
  assert.equal(clampContinentLatitude(northAmerica, 30, "mercator"), 30);
  assert.ok(clampContinentLatitude(northAmerica, 70, "mercator") < 52);
  const antarctica = CONTINENTS.find((c) => c.name === "Antarctica");
  assert.equal(clampContinentLatitude(antarctica, -40, "mercator"), -40);
  assert.ok(clampContinentLatitude(antarctica, -80, "mercator") > -80);
  assert.equal(clampContinentLatitude(antarctica, 0, "equalArea"), 0);
});

test("continent tooltip reports moved map footprint and polar limits", () => {
  const australia = CONTINENTS.find((c) => c.name === "Australia");
  assert.match(continentDistortionSummary(australia, "mercator", 60, 3.4).detail,
    /3.4×/);
  assert.match(continentDistortionSummary(australia, "equalArea", 60, 1).detail,
    /area stays equal/i);
  assert.match(continentDistortionSummary(australia, "mercator", 65, 4, true).detail,
    /polar limit/i);
});

test("globe swipe coasts, settles, and resumes its default spin", () => {
  const spin = new GlobeSpin();
  spin.begin(0, 0);
  spin.drag(0.3, 0.1, 0.05);
  assert.ok(spin.yaw > 0 && spin.pitch < 0);
  const initialYaw = spin.yaw;
  spin.end();
  spin.step(0.1);
  assert.ok(spin.yaw > initialYaw + 0.016);
  for (let i = 0; i < 400; i++) spin.step(0.02);
  assert.ok(Math.abs(spin.yawVelocity) < 1e-6);
  assert.ok(Math.abs(spin.pitch) < 0.02);
  const settledYaw = spin.yaw;
  spin.step(1);
  assert.ok(Math.abs(spin.yaw - settledYaw - 0.16) < 1e-5);
});

test("upward globe drag lifts the visible surface on both sides of the globe", () => {
  const globe = new THREE.Object3D();
  for (const [yaw, front] of [
    [0, new THREE.Vector3(0, 0, 1)],
    [Math.PI, new THREE.Vector3(0, 0, -1)],
  ]) {
    orientGlobe(globe, { yaw, pitch: 0 });
    const before = front.clone().applyEuler(globe.rotation).y;
    orientGlobe(globe, { yaw, pitch: -0.2 });
    const after = front.clone().applyEuler(globe.rotation).y;
    assert.ok(after > before);
  }
});

test("new exhibits wait at their introduction and wrap up after four minutes", () => {
  const root = new THREE.Group();
  let changes = 0;
  const exhibit = new TimedExhibit(root, () => changes++);
  exhibit.update(240);
  assert.equal(exhibit.elapsed, 0);
  assert.equal(exhibit.group.visible, false);
  exhibit.begin();
  assert.equal(exhibit.group.visible, true);
  exhibit.update(240);
  assert.equal(exhibit.finished, true);
  assert.equal(changes, 2);
  exhibit.dispose();
  assert.equal(root.children.length, 0);
  const manual = new TimedExhibit(root, () => changes++);
  manual.finish();
  assert.equal(manual.finished, false);
  manual.begin();
  manual.update(10);
  manual.finish();
  assert.equal(manual.finished, true);
  manual.update(240);
  assert.equal(manual.elapsed, 10);
  assert.equal(changes, 4);
  manual.dispose();
  assert.equal(root.children.length, 0);
});
