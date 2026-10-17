import * as THREE from "three";

export function teleportStickAction(active, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return active ? "cancel" : "idle";
  if (!active) return y < -0.72 && Math.abs(x) < 0.55 ? "begin" : "idle";
  if (y > 0.35 || Math.abs(x) > 0.72) return "cancel";
  return Math.hypot(x, y) < 0.28 ? "commit" : "aim";
}

export class LandscapeTeleport {
  constructor(scene) {
    this.scene = scene;
    this.demo = null;
    this.candidate = null;
    this.marker = new THREE.Group();
    this.marker.visible = false;
    this.material = new THREE.MeshBasicMaterial({ color: 0x68f5cf, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.065, 8, 40), this.material);
    ring.rotation.x = Math.PI / 2;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 8), this.material);
    stem.position.y = 0.6;
    const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.32, 12), this.material);
    pointer.rotation.z = Math.PI;
    pointer.position.y = 1.12;
    this.marker.add(ring, stem, pointer);
    scene.add(this.marker);
  }
  get active() {
    return !!this.demo;
  }
  begin(demo) {
    this.cancel();
    if (!demo?.started || demo.finished) return false;
    this.demo = demo;
    return true;
  }
  aim(raycaster, uiHit = null) {
    if (!this.demo) return null;
    this.candidate = this.demo.teleportCandidate(raycaster, uiHit);
    this.marker.visible = !!this.candidate;
    if (this.candidate) {
      this.marker.position.copy(this.candidate.point);
      this.marker.scale.setScalar(THREE.MathUtils.clamp(this.candidate.distance * 0.045, 1.15, 4));
      this.material.color.set(this.candidate.valid ? 0x68f5cf : 0xff927b);
    }
    return this.candidate;
  }
  release(camera) {
    const moved = this.demo?.teleportTo(this.candidate, camera) ?? false;
    this.cancel();
    return moved;
  }
  cancel() {
    this.demo = null;
    this.candidate = null;
    this.marker.visible = false;
  }
  dispose() {
    this.cancel();
    this.marker.removeFromParent();
    this.marker.traverse((object) => object.geometry?.dispose());
    this.material.dispose();
  }
}
