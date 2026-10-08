import * as THREE from "three";
import { ModelGrab } from "../manipulation.js";
const COLORS = { ground: 0x65cfd1, structure: 0xffd39b, vegetation: 0x99eb91 };
export class ScanExperience {
  constructor(scene, onChange) {
    this.onChange = onChange;
    this.stage = 0;
    this.elapsed = 0;
    this.reveal = false;
    this.hideVegetation = false;
    this.capacity = 18000;
    this.records = [];
    this.keys = new Set();
    this.sampleTime = 0;
    this.milestone = 0;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.grab = new ModelGrab(this.group, 0.22, 0.75);
    this.targets = [];
    const mesh = (geometry, position, kind) => {
      const m = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: COLORS[kind],
          side: THREE.DoubleSide,
        }),
      );
      m.position.set(...position);
      m.userData.kind = kind;
      m.visible = false;
      this.targets.push(m);
      this.group.add(m);
      return m;
    };
    mesh(new THREE.BoxGeometry(2, 0.04, 1.6), [0, -0.02, 0], "ground");
    for (const x of [-0.48, 0.48])
      mesh(new THREE.BoxGeometry(0.14, 0.55, 0.7), [x, 0.275, 0], "structure");
    mesh(new THREE.BoxGeometry(1.1, 0.15, 0.18), [0, 0.61, 0.3], "structure");
    mesh(new THREE.BoxGeometry(1.1, 0.32, 0.12), [0, 0.16, -0.34], "structure");
    for (const [x, z] of [
      [-0.65, 0.45],
      [0.65, -0.4],
    ]) {
      mesh(
        new THREE.CylinderGeometry(0.035, 0.05, 0.65, 8),
        [x, 0.325, z],
        "vegetation",
      );
      mesh(new THREE.SphereGeometry(0.31, 16, 10), [x, 0.69, z], "vegetation");
    }
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2.05, 1.05, 1.65)),
      new THREE.LineBasicMaterial({
        color: 0x38596b,
        transparent: true,
        opacity: 0.55,
      }),
    );
    frame.position.y = 0.5;
    this.group.add(frame);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(this.capacity * 3), 3),
    );
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(this.capacity * 3), 3),
    );
    geometry.setDrawRange(0, 0);
    this.points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 0.012,
        vertexColors: true,
        sizeAttenuation: true,
      }),
    );
    this.points.frustumCulled = false;
    this.group.add(this.points);
    this.ray = new THREE.Raycaster();
  }
  place(camera) {
    this.grab.cancel();
    const pos = new THREE.Vector3(),
      dir = new THREE.Vector3();
    camera.getWorldPosition(pos);
    camera.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() < 0.01) dir.set(0, 0, -1);
    dir.normalize();
    this.group.position.copy(pos).addScaledVector(dir, 1.4);
    this.group.position.y -= 0.24;
    this.group.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0);
    this.group.scale.setScalar(0.43);
  }
  explore() {
    this.stage = 1;
    this.onChange();
  }
  finish() {
    this.stage = 2;
    this.grab.cancel();
    this.onChange();
  }
  update(dt) {
    if (this.stage < 2) {
      this.elapsed += dt;
      if (this.elapsed >= 240) this.finish();
    }
  }
  hit(ray) {
    this.group.updateWorldMatrix(true, true);
    return ray.intersectObjects(this.targets, false)[0];
  }
  record(origin, direction) {
    if (this.stage !== 1 || this.records.length >= this.capacity) return false;
    this.ray.set(origin, direction);
    const hit = this.hit(this.ray);
    if (!hit) return false;
    const p = this.group.worldToLocal(hit.point.clone()),
      kind = hit.object.userData.kind;
    const key = [
      kind,
      Math.round(p.x / 0.013),
      Math.round(p.y / 0.013),
      Math.round(p.z / 0.013),
    ].join(":");
    if (this.keys.has(key)) return false;
    this.keys.add(key);
    this.records.push({ p, kind });
    return true;
  }
  sweep(origin, direction, dt) {
    if (this.stage !== 1 || this.grab.hands.size) return;
    this.sampleTime += dt;
    if (this.sampleTime < 0.04) return;
    this.sampleTime = 0;
    const side = new THREE.Vector3().crossVectors(
      direction,
      new THREE.Vector3(0, 1, 0),
    );
    if (side.lengthSq() < 0.01) side.set(1, 0, 0);
    side.normalize();
    const up = new THREE.Vector3().crossVectors(side, direction).normalize();
    for (let x = -2; x <= 2; x++)
      for (let y = -2; y <= 2; y++) {
        const d = direction
          .clone()
          .addScaledVector(side, x * 0.018)
          .addScaledVector(up, y * 0.018)
          .normalize();
        this.record(origin, d);
      }
    this.refreshPoints();
    const milestone = Math.floor(this.records.length / 500);
    if (milestone !== this.milestone) {
      this.milestone = milestone;
      this.onChange();
    }
  }
  refreshPoints() {
    const geo = this.points.geometry;
    let count = 0;
    for (const { p, kind } of this.records) {
      if (this.hideVegetation && kind === "vegetation") continue;
      const c = new THREE.Color(COLORS[kind]);
      geo.attributes.position.setXYZ(count, p.x, p.y, p.z);
      geo.attributes.color.setXYZ(count, c.r, c.g, c.b);
      count++;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.setDrawRange(0, count);
  }
  toggleReveal() {
    this.reveal = !this.reveal;
    this.applyVisibility();
    this.onChange();
  }
  toggleVegetation() {
    this.hideVegetation = !this.hideVegetation;
    this.applyVisibility();
    this.refreshPoints();
    this.onChange();
  }
  applyVisibility() {
    for (const m of this.targets)
      m.visible =
        this.reveal &&
        (!this.hideVegetation || m.userData.kind !== "vegetation");
  }
  clearScan() {
    this.records = [];
    this.keys.clear();
    this.milestone = 0;
    this.sampleTime = 0;
    this.refreshPoints();
    this.onChange();
  }
  dispose() {
    this.grab.cancel();
    this.group.removeFromParent();
    this.group.traverse((n) => {
      n.geometry?.dispose();
      n.material?.dispose();
    });
  }
}
