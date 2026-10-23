import * as THREE from "three";
import { buildScanScene } from "./scenes.js";
import { scanMaterials } from "./appearance.js";
import { StationCoverage } from "./station-coverage.js";

const LIMIT = 20;
const TOTAL_SCANS = 4;
const V = () => new THREE.Vector3();

function makeTripod() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x53666b, metalness: 0.75, roughness: 0.32 });
  const housing = new THREE.MeshStandardMaterial({ color: 0x1d343e, metalness: 0.45, roughness: 0.35 });
  const lens = new THREE.MeshStandardMaterial({ color: 0x8af0d3, emissive: 0x1c6350 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.95, 12), metal);
  pole.position.y = 0.84;
  group.add(pole);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.25), housing);
  head.position.y = 1.48;
  group.add(head);
  const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 20), lens);
  eye.rotation.x = Math.PI / 2;
  eye.position.set(0, 1.48, -0.14);
  group.add(eye);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    const foot = new THREE.Vector3(Math.cos(a) * 0.55, 0.03, Math.sin(a) * 0.55);
    const top = new THREE.Vector3(0, 1.1, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 1.18, 9), metal);
    leg.position.copy(foot).add(top).multiplyScalar(0.5);
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.sub(foot).normalize());
    group.add(leg);
  }
  group.userData.head = head;
  return group;
}

export class StationScanExperience {
  constructor(scene, onChange, sceneInfo, onEvent = () => {}) {
    this.scene = scene;
    this.station = true;
    this.room = false;
    this.stage = 0;
    this.started = false;
    this.finished = false;
    this.sceneInfo = sceneInfo;
    this.onChange = onChange;
    this.onEvent = onEvent;
    this.selected = new Set(["vegetation"]);
    this.records = [];
    this.previewAngle = 0;
    this.lastRange = 8;
    this.scansLeft = TOTAL_SCANS;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.group.visible = false;
    this.previousBackground = scene.background;
    this.previousFog = scene.fog;
    if (scene.background !== null) {
      scene.background = new THREE.Color(0x95bac4);
      scene.fog = new THREE.Fog(0x95bac4, 45, 95);
    }
    this.group.add(new THREE.HemisphereLight(0xe9f8ff, 0x536247, 2.0));
    const sun = new THREE.DirectionalLight(0xffe7c3, 2.0);
    sun.position.set(-9, 18, 11);
    this.group.add(sun);
    this.materials = scanMaterials();
    this.targets = [];
    const mesh = (geometry, position, kind, finish) => {
      const object = new THREE.Mesh(geometry, this.materials[finish ?? (kind === "ground" ? "earth" : "stone")]);
      object.position.set(...position).multiplyScalar(8);
      object.scale.setScalar(8);
      object.userData.kind = kind;
      this.targets.push(object);
      this.group.add(object);
      return object;
    };
    buildScanScene(sceneInfo.id, mesh);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(44, 44),
      new THREE.MeshStandardMaterial({ color: 0x61725e, roughness: 1, side: THREE.DoubleSide }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.05;
    this.group.add(this.ground);
    this.tripod = makeTripod();
    this.tripod.position.set(0, 0, 11);
    this.group.add(this.tripod);
    const survey = this.targets.slice(1).filter((m) => m.userData.kind === "structure" ||
      sceneInfo.id === "canopy" && m.userData.kind === "vegetation" ||
      sceneInfo.id === "terraces" && m.userData.kind === "ground");
    this.coverage = new StationCoverage(survey, this.targets, 900, this.group);
    const bounds = new THREE.Box3().setFromPoints(this.coverage.samples.map((sample) => sample.point));
    const span = bounds.getSize(V());
    const horizontal = Math.max(1, span.x, span.z);
    this.previewFrame = {
      center: bounds.getCenter(V()),
      scale: Math.min(90, 490 / (horizontal * 1.55),
        290 / Math.max(1, span.y * 0.9 + horizontal * 0.36)),
    };
    this.cloud = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({
      size: 0.075, vertexColors: true, depthWrite: false,
    }));
    this.cloud.renderOrder = 2;
    this.group.add(this.cloud);
    this.grab = {
      hands: new Map(),
      cancel: () => {
        this.grab.hands.clear();
        this.holdingHand = null;
        this.tripod.position.y = 0;
      },
      release: (id) => this.releaseTripod(id),
      update: (poses) => this.updateTripod(poses),
    };
    this.clipboard = new THREE.Group();
    this.clipboard.visible = false;
    this.clipboard.scale.setScalar(0.27);
    scene.add(this.clipboard);
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.86, 0.07),
      new THREE.MeshBasicMaterial({ color: 0x143441 }));
    board.position.set(0, -0.14, -0.05);
    this.clipboard.add(board);
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xb5c7c8 }));
    clip.position.y = 1.29;
    this.clipboard.add(clip);
    this.ui = new THREE.Group();
    this.clipboard.add(this.ui);
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvas.height = 640;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    const display = new THREE.Mesh(new THREE.PlaneGeometry(2.26, 2.26),
      new THREE.MeshBasicMaterial({ map: this.texture, side: THREE.DoubleSide }));
    display.position.set(0, 0.07, 0.04);
    this.clipboard.add(display);
    this.scanQueue = null;
    this.scanCursor = 0;
    this.visitor = new THREE.Vector2();
    this.walkForward = V();
    this.eye = V();
    this.refreshCloud();
  }
  get score() { return this.coverage.percent; }
  get targetName() {
    return ({ ruins: "ruin walls", bridge: "bridge and supports", village: "buildings",
      terraces: "terrace faces", canopy: "trees and canopy", courtyard: "courtyard", tower: "tower" })[this.sceneInfo.id];
  }
  place(camera) {
    const eye = camera.getWorldPosition(V());
    const forward = camera.getWorldDirection(V());
    forward.y = 0;
    forward.normalize();
    this.group.position.set(eye.x + forward.x * 14, eye.y - 1.6,
      eye.z + forward.z * 14);
    this.group.rotation.y = Math.atan2(-forward.x, -forward.z);
    this.visitor.set(0, 16);
  }
  begin() { this.stage = 1; this.started = true; this.group.visible = true; this.onChange(); }
  finish() {
    if (this.scanQueue) return;
    this.stage = 2;
    this.finished = true;
    this.grab.cancel();
    this.clipboard.visible = false;
    this.group.visible = false;
    this.onChange();
  }
  canPlace(x, z) {
    if (Math.abs(x) > LIMIT || Math.abs(z) > LIMIT) return false;
    const point = new THREE.Vector3(x, 0.72, z);
    return !this.targets.slice(1).some((mesh) => new THREE.Box3().setFromObject(mesh)
      .containsPoint(this.group.localToWorld(point.clone())));
  }
  gripTripod(id, grip, raycaster, handedness) {
    if (!this.started || this.finished || this.scanQueue || this.grab.hands.size) return false;
    const hand = grip.getWorldPosition(V());
    const near = hand.distanceTo(this.tripod.localToWorld(new THREE.Vector3(0, 1.35, 0))) < 0.85;
    const hit = raycaster.intersectObject(this.tripod, true)[0];
    if (!near && (!hit || hit.distance > 3.5)) return false;
    this.grab.hands.set(id, true);
    this.holdingHand = handedness;
    this.onEvent("select");
    return true;
  }
  releaseTripod(id) {
    if (this.grab.hands.delete(id)) {
      this.tripod.position.y = 0;
      this.holdingHand = null;
      this.refreshClipboard();
    }
  }
  updateTripod(poses) {
    if (!this.grab.hands.size || this.scanQueue) return;
    const id = this.grab.hands.keys().next().value;
    const pose = poses.get(id);
    if (!pose) { this.releaseTripod(id); return; }
    const local = this.group.worldToLocal(new THREE.Vector3().setFromMatrixPosition(pose));
    if (this.canPlace(local.x, local.z))
      this.tripod.position.set(local.x, THREE.MathUtils.clamp(local.y - 1.1, 0, 0.65), local.z);
  }
  startSweep() {
    if (!this.started || this.finished || this.scansLeft <= 0 || this.scanQueue || this.grab.hands.size) return false;
    this.coverage.prepare();
    this.scansLeft--;
    this.scanQueue = this.tripod.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    this.scanCursor = 0;
    this.onEvent("reveal");
    this.refreshClipboard();
    return true;
  }
  update(dt) {
    if (!this.started || this.finished) return;
    this.tripod.userData.head.rotation.y += dt * (this.scanQueue ? 9 : 0.6);
    if (!this.scanQueue) return;
    this.coverage.prepare();
    const end = Math.min(this.coverage.samples.length, this.scanCursor + 60);
    for (let i = this.scanCursor; i < end; i++) this.coverage.capture(i, this.scanQueue);
    this.scanCursor = end;
    this.refreshCloud();
    if (end === this.coverage.samples.length) {
      this.scanQueue = null;
      this.records.push({ count: this.coverage.count });
      this.refreshClipboard();
      this.onChange();
    }
  }
  refreshCloud() {
    const positions = [], colors = [];
    const color = new THREE.Color();
    for (let i = 0; i < this.coverage.samples.length; i++) {
      if (!this.coverage.captured[i]) continue;
      const sample = this.coverage.samples[i];
      positions.push(sample.point.x, sample.point.y, sample.point.z);
      color.setHex(sample.mesh.userData.kind === "vegetation" ? 0x9be5ac : 0xffd39b);
      colors.push(color.r, color.g, color.b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    this.cloud.geometry.dispose();
    this.cloud.geometry = geometry;
    this.refreshClipboard();
  }
  refreshClipboard() {
    const ctx = this.canvas.getContext("2d");
    ctx.fillStyle = "#102d38";
    ctx.fillRect(0, 0, 640, 640);
    ctx.textAlign = "center";
    ctx.fillStyle = "#e8f7f1";
    ctx.font = "bold 37px sans-serif";
    ctx.fillText("LIDAR FIELD LOG", 320, 54);
    ctx.font = "25px sans-serif";
    ctx.fillText(`${this.sceneInfo.name} · ${this.targetName}`, 320, 96);
    ctx.fillStyle = "#1b4653";
    ctx.fillRect(35, 122, 570, 330);
    const c = Math.cos(this.previewAngle), s = Math.sin(this.previewAngle);
    const { center, scale } = this.previewFrame;
    for (let i = 0; i < this.coverage.samples.length; i++) {
      if (!this.coverage.captured[i]) continue;
      const { point, mesh } = this.coverage.samples[i];
      const localX = point.x - center.x, localZ = point.z - center.z;
      const turnedX = localX * c - localZ * s;
      const turnedZ = localX * s + localZ * c;
      const x = 320 + (turnedX - turnedZ * 0.55) * scale;
      const y = 285 - (point.y - center.y) * scale * 0.9 +
        (turnedX + turnedZ) * scale * 0.18;
      ctx.fillStyle = mesh.userData.kind === "vegetation" ? "#a2df9e" : "#ffd39b";
      ctx.fillRect(x, y, 3.5, 3.5);
    }
    ctx.fillStyle = "#a6f5d9";
    ctx.font = "bold 38px sans-serif";
    ctx.fillText(`${this.score}% target captured`, 320, 507);
    ctx.fillStyle = "#d5e9e8";
    ctx.font = "27px sans-serif";
    ctx.fillText(`${this.scansLeft} of ${TOTAL_SCANS} scans left`, 320, 550);
    ctx.font = "22px sans-serif";
    ctx.fillText(this.scanQueue ? "Scanning…" : this.scansLeft
      ? "Grip tripod · trigger to scan" : "All scans used · select Takeaway", 320, 588);
    this.texture.needsUpdate = true;
  }
  turnPreview(direction) {
    if (!this.started || this.finished || !direction) return;
    this.previewAngle = (this.previewAngle + Math.sign(direction) * Math.PI / 4 +
      Math.PI * 2) % (Math.PI * 2);
    this.refreshClipboard();
  }
  updateClipboard(leftGrip, camera, preview = false, fallback = false) {
    if (!this.started || this.finished || this.holdingHand === "left" ||
        !leftGrip && !preview && !fallback) { this.clipboard.visible = false; return; }
    this.clipboard.scale.setScalar(0.27 * (fallback ? 1.15 : 1));
    camera.updateWorldMatrix(true, false);
    if (preview || !leftGrip)
      this.clipboard.position.copy(camera.localToWorld(new THREE.Vector3(-0.48, -0.23, -1.15)));
    else this.clipboard.position.copy(leftGrip.localToWorld(new THREE.Vector3(-0.09, 0.03, -0.18)));
    camera.getWorldPosition(this.eye);
    const away = this.clipboard.position.clone().sub(this.eye);
    if (away.lengthSq() < 0.85 ** 2) this.clipboard.position.copy(this.eye).addScaledVector(away.normalize(), 0.85);
    this.clipboard.lookAt(this.eye);
    this.clipboard.visible = true;
    this.clipboard.updateWorldMatrix(true, true);
  }
  walk(x, y, dt, camera) {
    if (!this.started || this.finished || this.scanQueue) return;
    const magnitude = Math.hypot(x, y);
    if (magnitude < 0.18 || dt <= 0) return;
    camera.getWorldDirection(this.walkForward);
    this.walkForward.y = 0;
    this.walkForward.normalize();
    const distance = 2.8 * Math.min(1, (magnitude - 0.18) / 0.82) * dt / magnitude;
    const dx = (-this.walkForward.z * x - this.walkForward.x * y) * distance;
    const dz = (this.walkForward.x * x - this.walkForward.z * y) * distance;
    const local = this.group.worldToLocal(camera.getWorldPosition(V()));
    const c = Math.cos(this.group.rotation.y), s = Math.sin(this.group.rotation.y);
    const nx = local.x + c * dx - s * dz, nz = local.z + s * dx + c * dz;
    if (!this.canPlace(nx, nz)) return;
    this.group.position.x -= dx;
    this.group.position.z -= dz;
    this.visitor.set(nx, nz);
  }
  turn(angle, camera) {
    if (!this.started || this.finished || !angle) return;
    const pivot = camera.getWorldPosition(V());
    const offset = this.group.position.clone().sub(pivot).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    this.group.position.x = pivot.x + offset.x;
    this.group.position.z = pivot.z + offset.z;
    this.group.rotation.y += angle;
  }
  teleportCandidate(raycaster, uiHit = null) {
    if (!this.started || this.finished || this.scanQueue) return null;
    this.ground.updateWorldMatrix(true, false);
    const hit = raycaster.intersectObject(this.ground, false)[0];
    if (!hit || hit.distance < 1 || hit.distance > 25 || uiHit && uiHit.distance < hit.distance) return null;
    const obstruction = raycaster.intersectObjects(this.targets.slice(1), false)[0];
    if (obstruction && obstruction.distance < hit.distance - 0.1) return null;
    const local = this.group.worldToLocal(hit.point.clone());
    return { x: local.x, z: local.z, point: hit.point.clone().add(new THREE.Vector3(0, 0.05, 0)),
      distance: hit.distance, valid: this.canPlace(local.x, local.z) };
  }
  teleportTo(candidate, camera) {
    if (!candidate?.valid) return false;
    const eye = camera.getWorldPosition(V());
    const landing = this.group.localToWorld(new THREE.Vector3(candidate.x, 0, candidate.z));
    this.group.position.x += eye.x - landing.x;
    this.group.position.z += eye.z - landing.z;
    this.visitor.set(candidate.x, candidate.z);
    return true;
  }
  dispose() {
    this.grab.cancel();
    this.scene.background = this.previousBackground;
    this.scene.fog = this.previousFog;
    this.group.removeFromParent();
    this.clipboard.removeFromParent();
    const shared = new Set(Object.values(this.materials));
    this.group.traverse((item) => { item.geometry?.dispose(); if (item.material && !shared.has(item.material)) item.material.dispose(); });
    this.clipboard.traverse((item) => { item.geometry?.dispose(); item.material?.dispose(); });
    for (const material of shared) { material.map?.dispose(); material.dispose(); }
    this.texture.dispose();
  }
}
