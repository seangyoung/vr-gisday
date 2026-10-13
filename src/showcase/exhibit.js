import * as THREE from "three";

export class TimedExhibit {
  constructor(root, onChange) {
    this.onChange = onChange;
    this.started = false;
    this.finished = false;
    this.elapsed = 0;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.group.position.z = -0.035;
    root.add(this.group);
  }
  begin() {
    if (this.started) return;
    this.started = true;
    this.elapsed = 0;
    this.group.visible = true;
    this.onChange();
  }
  finish() {
    if (!this.started || this.finished) return;
    this.finished = true;
    this.onChange();
  }
  update(dt) {
    if (!this.started || this.finished) return;
    this.elapsed += dt;
    if (this.elapsed >= 240) this.finish();
  }
  dispose() {
    this.group.removeFromParent();
    this.group.traverse((object) => {
      object.geometry?.dispose();
      if (object.material) {
        for (const material of Array.isArray(object.material)
          ? object.material : [object.material]) {
          material.map?.dispose();
          material.dispose();
        }
      }
    });
  }
}

export function canvasPanel(canvas, width, height, x, y) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
  );
  mesh.position.set(x, y, 0);
  return mesh;
}

export function replacePanelTexture(mesh, canvas) {
  mesh.material.map?.dispose();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  mesh.material.map = texture;
  mesh.material.needsUpdate = true;
}
