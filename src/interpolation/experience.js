import * as THREE from "three";
import { TimedExhibit } from "../showcase/exhibit.js";
import { ModelGrab } from "../manipulation.js";
import { handInsideModel, modelBoundsHit } from "../model-target.js";
import {
  STATIONS, heightForValue, idwEstimate, nearestEstimate, smoothEstimate,
} from "./model.js";

const GRID = 65;
const LIMIT = 1.02;
const MODEL_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-1.12, -0.12, -1.12),
  new THREE.Vector3(1.12, 1.07, 1.12),
);

function valueColor(value) {
  const t = THREE.MathUtils.clamp((value - 8) / 40, 0, 1);
  return new THREE.Color(0x53b8cf).lerp(new THREE.Color(0xf4ce7b), t);
}

function makeText(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 80;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0b2430";
  ctx.fillRect(0, 0, 256, 80);
  ctx.strokeStyle = "#a7cfd4";
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 252, 76);
  ctx.font = "bold 45px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f4f8ef";
  ctx.fillText(text, 128, 40);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture,
    depthTest: false, transparent: true }));
  sprite.scale.set(0.26, 0.081, 1);
  return sprite;
}

function gridLine(points, color, opacity = 1) {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }),
  );
  line.raycast = () => {};
  return line;
}

function buildSmoothSurface(estimate) {
  const positions = new Float32Array((GRID + 1) ** 2 * 3);
  const colors = new Float32Array(positions.length);
  const indices = [];
  for (let z = 0; z <= GRID; z++) for (let x = 0; x <= GRID; x++) {
    const px = -LIMIT + 2 * LIMIT * x / GRID;
    const pz = -LIMIT + 2 * LIMIT * z / GRID;
    const value = estimate(px, pz);
    const i = (z * (GRID + 1) + x) * 3;
    positions[i] = px;
    positions[i + 1] = heightForValue(value);
    positions[i + 2] = pz;
    valueColor(value).toArray(colors, i);
  }
  for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) {
    const a = z * (GRID + 1) + x;
    const b = a + 1;
    const c = a + GRID + 1;
    const d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
    vertexColors: true, side: THREE.DoubleSide, transparent: true,
    opacity: 0.75, depthWrite: false, shininess: 45,
  }));
}

function buildZones() {
  const N = 34;
  const vertices = [];
  const colors = [];
  const addQuad = (a, b, c, d, value, darker = false) => {
    const color = valueColor(value).multiplyScalar(darker ? 0.56 : 1);
    for (const point of [a, b, c, a, c, d]) {
      vertices.push(...point);
      colors.push(color.r, color.g, color.b);
    }
  };
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const x0 = -LIMIT + 2 * LIMIT * x / N;
    const x1 = -LIMIT + 2 * LIMIT * (x + 1) / N;
    const z0 = -LIMIT + 2 * LIMIT * z / N;
    const z1 = -LIMIT + 2 * LIMIT * (z + 1) / N;
    const value = nearestEstimate((x0 + x1) / 2, (z0 + z1) / 2);
    const h = heightForValue(value);
    addQuad([x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0], value);
    if (x < N - 1) {
      const next = nearestEstimate((x1 + x1 + 2 * LIMIT / N) / 2,
        (z0 + z1) / 2);
      if (next !== value) addQuad([x1, Math.min(h, heightForValue(next)), z0],
        [x1, Math.max(h, heightForValue(next)), z0],
        [x1, Math.max(h, heightForValue(next)), z1],
        [x1, Math.min(h, heightForValue(next)), z1], value, true);
    }
    if (z < N - 1) {
      const next = nearestEstimate((x0 + x1) / 2,
        (z1 + z1 + 2 * LIMIT / N) / 2);
      if (next !== value) addQuad([x0, Math.min(h, heightForValue(next)), z1],
        [x0, Math.max(h, heightForValue(next)), z1],
        [x1, Math.max(h, heightForValue(next)), z1],
        [x1, Math.min(h, heightForValue(next)), z1], value, true);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
    vertexColors: true, side: THREE.DoubleSide, transparent: true,
    opacity: 0.84, depthWrite: false, flatShading: true,
  }));
}

export class InterpolationExperience extends TimedExhibit {
  constructor(root, onChange, scene) {
    super(root, onChange);
    this.kind = "interpolation";
    this.mode = "samples";
    this.probe = null;
    this.model = new THREE.Group();
    this.model.visible = false;
    scene.add(this.model);
    this.grab = new ModelGrab(this.model, 0.32, 0.95);
    this.model.add(new THREE.AmbientLight(0xffffff, 1.25));
    const sunlight = new THREE.DirectionalLight(0xffffff, 2.3);
    sunlight.position.set(-0.7, 1.8, 1.5);
    this.model.add(sunlight);
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(2.12, 0.055, 2.12),
      new THREE.MeshPhongMaterial({ color: 0x183744, shininess: 35 }),
    );
    base.position.y = -0.05;
    this.model.add(base);
    this.pickSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(2.08, 2.08),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0,
        depthWrite: false, side: THREE.DoubleSide }),
    );
    this.pickSurface.rotation.x = -Math.PI / 2;
    this.pickSurface.position.y = 0.005;
    this.model.add(this.pickSurface);
    for (let i = -4; i <= 4; i++) {
      const v = i / 4;
      this.model.add(gridLine([
        new THREE.Vector3(v, 0.005, -1.04), new THREE.Vector3(v, 0.005, 1.04),
      ], 0x386274, 0.7));
      this.model.add(gridLine([
        new THREE.Vector3(-1.04, 0.005, v), new THREE.Vector3(1.04, 0.005, v),
      ], 0x386274, 0.7));
    }
    this.model.add(gridLine([
      new THREE.Vector3(-1.06, 0, 1.06), new THREE.Vector3(-1.06, 0.93, 1.06),
    ], 0xffffff));
    const axis = makeText("mm ↑");
    axis.scale.set(0.26, 0.09, 1);
    axis.position.set(-1.02, 1.01, 1.02);
    this.model.add(axis);
    for (const value of [0, 25, 50]) {
      const tick = makeText(String(value));
      tick.scale.set(0.12, 0.055, 1);
      tick.position.set(-1.0, heightForValue(value), 1.08);
      this.model.add(tick);
    }
    this.stationGroup = new THREE.Group();
    this.model.add(this.stationGroup);
    this.stationHeads = [];
    for (const station of STATIONS) {
      const h = heightForValue(station.value);
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, h, 7),
        new THREE.MeshBasicMaterial({ color: 0xe7f7f8 }),
      );
      stem.position.set(station.x, h / 2, station.z);
      this.stationGroup.add(stem);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.043, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      head.position.set(station.x, h, station.z);
      this.stationGroup.add(head);
      this.stationHeads.push(head);
    }
    this.surfaces = {
      idw: buildSmoothSurface((x, z) => idwEstimate(x, z).value),
      smooth: buildSmoothSurface((x, z) => smoothEstimate(x, z)),
      zones: buildZones(),
    };
    for (const surface of Object.values(this.surfaces)) {
      surface.visible = false;
      surface.material.opacity = 0;
      this.model.add(surface);
    }
    this.probeGroup = new THREE.Group();
    this.model.add(this.probeGroup);
    this.placeProbe(0.05, 0.16, false);
  }

  begin() {
    super.begin();
    this.model.visible = true;
  }

  finish() {
    this.model.visible = false;
    this.grab.cancel();
    super.finish();
  }

  setMode(mode) {
    if (!this.started || this.finished || !["samples", "idw", "smooth", "zones"].includes(mode)) return;
    this.mode = mode;
    this.showWeights = false;
    for (const [name, surface] of Object.entries(this.surfaces))
      if (name === mode) surface.visible = true;
    this.placeProbe(this.probe.x, this.probe.z, false);
    this.onChange("reveal");
  }

  placeProbe(x, z, notify = true) {
    this.probe = { x: THREE.MathUtils.clamp(x, -1, 1),
      z: THREE.MathUtils.clamp(z, -1, 1) };
    const result = idwEstimate(this.probe.x, this.probe.z);
    this.estimate = result;
    this.displayValue = this.mode === "smooth"
      ? smoothEstimate(this.probe.x, this.probe.z)
      : this.mode === "zones"
      ? nearestEstimate(this.probe.x, this.probe.z)
      : result.value;
    const showNeighbors = this.mode === "samples" || this.mode === "idw";
    const selected = new Set(showNeighbors ? result.neighbors.map(({ index }) => index) : []);
    this.stationHeads.forEach((head, index) => head.material.color.set(
      selected.has(index) ? 0xffd070 : 0xffffff));
    for (const child of [...this.probeGroup.children]) {
      child.traverse((node) => {
        node.geometry?.dispose();
        node.material?.map?.dispose();
        node.material?.dispose();
      });
      child.removeFromParent();
    }
    const y = heightForValue(this.displayValue);
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.053, 14, 9),
      new THREE.MeshBasicMaterial({ color: 0xffd070 }));
    marker.position.set(this.probe.x, y, this.probe.z);
    this.probeGroup.add(marker);
    this.probeGroup.add(gridLine([
      new THREE.Vector3(this.probe.x, 0, this.probe.z),
      new THREE.Vector3(this.probe.x, y, this.probe.z),
    ], 0xffd070));
    const tag = makeText(`? ${this.displayValue.toFixed(1)} mm`);
    tag.scale.set(0.36, 0.09, 1);
    tag.position.set(this.probe.x, y + 0.13, this.probe.z);
    this.probeGroup.add(tag);
    if (showNeighbors) result.neighbors.forEach(({ station }) => {
      const h = heightForValue(station.value);
      this.probeGroup.add(gridLine([
        new THREE.Vector3(this.probe.x, y + 0.005, this.probe.z),
        new THREE.Vector3(station.x, h + 0.005, station.z),
      ], 0xffd070, 0.75));
    });
    if (notify) this.onChange("selection");
  }

  selectFromRay(raycaster) {
    if (!this.started || this.finished || this.grab.hands.size) return false;
    const surfaces = Object.entries(this.surfaces)
      .filter(([name]) => name === this.mode).map(([, mesh]) => mesh);
    const hit = raycaster.intersectObjects([...surfaces, this.pickSurface], false)[0];
    if (!hit) return false;
    const point = this.model.worldToLocal(hit.point.clone());
    this.placeProbe(point.x, point.z);
    return true;
  }

  grabHit(raycaster) {
    return this.started && !this.finished && this.model.visible
      ? modelBoundsHit(this.model, MODEL_BOUNDS, raycaster) : null;
  }

  handNear(position) {
    return this.started && !this.finished && this.model.visible &&
      handInsideModel(this.model, MODEL_BOUNDS, position);
  }

  place(camera) {
    this.grab.cancel();
    const position = new THREE.Vector3();
    const forward = new THREE.Vector3();
    camera.getWorldPosition(position);
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.01) forward.set(0, 0, -1);
    forward.normalize();
    this.model.position.copy(position).addScaledVector(forward, 1.5);
    this.model.position.y = position.y + 0.02;
    this.model.rotation.set(0.34, Math.atan2(-forward.x, -forward.z), 0);
    this.model.scale.setScalar(0.53);
  }

  update(dt) {
    super.update(dt);
    for (const [name, surface] of Object.entries(this.surfaces)) {
      const target = this.started && !this.finished && this.mode === name ?
        name === "zones" ? 0.84 : 0.75 : 0;
      surface.material.opacity = THREE.MathUtils.damp(surface.material.opacity, target, 8, dt);
      surface.visible = surface.material.opacity > 0.01 || target > 0;
    }
  }

  dispose() {
    this.grab.cancel();
    this.model.traverse((node) => {
      node.geometry?.dispose();
      const materials = node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : [];
      for (const material of materials) {
        material.map?.dispose();
        material.dispose();
      }
    });
    this.model.removeFromParent();
    super.dispose();
  }
}
