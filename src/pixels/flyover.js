import * as THREE from "three";
import { landscapeHeight } from "../layers/experience.js";
import { makePlatformModel } from "../showcase/remote-platforms.js";

const FEET_TO_METERS = 0.3048;
export const flyoverForSize = (size) => size === 0.5
  ? { kind: "drone", feet: 100 }
  : size === 1
  ? { kind: "aircraft", feet: 200 }
  : { kind: "satellite", feet: 200 };

function modelFor(kind) {
  if (kind !== "satellite") {
    const model = makePlatformModel(kind);
    model.scale.setScalar(kind === "drone" ? 2.8 : 13);
    model.rotation.y = -Math.PI / 2;
    return model;
  }
  // This is a visibility marker, not a satellite at a plausible orbital height.
  const marker = new THREE.Group();
  marker.add(new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff })));
  marker.add(new THREE.Mesh(new THREE.SphereGeometry(2.1, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xc6edff, transparent: true,
      opacity: 0.18, depthWrite: false })));
  return marker;
}

export class PixelFlyover {
  constructor(parent) {
    this.parent = parent;
    this.group = null;
    this.age = 0;
    this.config = null;
  }
  clear() {
    if (!this.group) return;
    this.group.removeFromParent();
    this.group.traverse((object) => {
      object.geometry?.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose();
      }
    });
    this.group = null;
    this.config = null;
  }
  begin(size) {
    this.clear();
    this.config = flyoverForSize(size);
    this.group = modelFor(this.config.kind);
    this.parent.add(this.group);
    this.age = 0;
    this.update(0);
  }
  update(dt) {
    if (!this.group) return;
    this.age += dt;
    const duration = this.config.kind === "drone" ? 7 : 5.5;
    const t = Math.min(1, this.age / duration);
    const x = THREE.MathUtils.lerp(-68, 68, t);
    const z = -60;
    this.group.position.set(x,
      landscapeHeight(x, z) + this.config.feet * FEET_TO_METERS, z);
    if (this.config.kind === "drone")
      for (const rotor of this.group.userData.rotors ?? []) rotor.rotation.y += dt * 34;
    if (t === 1) this.clear();
  }
  dispose() { this.clear(); }
}
