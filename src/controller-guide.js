import * as THREE from "three";

const eye = new THREE.Vector3();
const forward = new THREE.Vector3();
const handPosition = new THREE.Vector3();
const toHand = new THREE.Vector3();
const cameraRight = new THREE.Vector3();
const cameraRotation = new THREE.Quaternion();

export class ControllerGuide {
  constructor(scene, grip) {
    this.grip = grip;
    this.handedness = "none";
    this.copy = "";
    this.body = new THREE.Group();
    grip.add(this.body);
    const shell = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.027, 0.115, 4, 12),
      new THREE.MeshBasicMaterial({ color: 0x56717d }),
    );
    shell.position.set(0, -0.035, 0.015);
    shell.rotation.x = -0.28;
    this.body.add(shell);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 20, 12),
      new THREE.MeshBasicMaterial({ color: 0x879da6 }),
    );
    head.scale.set(1, 0.38, 0.92);
    head.position.set(0, 0.043, -0.018);
    this.body.add(head);
    for (const [x, z] of [[-0.023, -0.025], [0.021, -0.007]]) {
      const face = new THREE.Mesh(
        new THREE.SphereGeometry(0.01, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xb0f6d9 }),
      );
      face.position.set(x, 0.062, z);
      this.body.add(face);
    }
    this.panel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.32),
      new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, side: THREE.DoubleSide }),
    );
    this.panel.renderOrder = 50;
    this.panel.visible = false;
    scene.add(this.panel);
    this.body.visible = false;
  }

  setHandedness(handedness) {
    this.handedness = handedness === "left" || handedness === "right" ? handedness : "none";
    this.body.visible = this.handedness !== "none";
  }

  setCopy(copy) {
    if (copy === this.copy) return;
    this.copy = copy;
    const canvas = document.createElement("canvas");
    canvas.width = 760;
    canvas.height = 650;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(7, 30, 42, 0.94)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#84e8c7";
    ctx.lineWidth = 7;
    ctx.strokeRect(5, 5, 750, 640);
    const lines = copy.split("\n");
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    lines.forEach((line, index) => {
      ctx.fillStyle = index === 0 ? "#a6f5d9" : "#f0f9f8";
      ctx.font = `${index === 0 ? 600 : 500} ${index === 0 ? 48 : 43}px system-ui, sans-serif`;
      ctx.fillText(line, 44, 60 + index * 82, 675);
    });
    this.panel.material.map?.dispose();
    this.panel.material.map = new THREE.CanvasTexture(canvas);
    this.panel.material.map.colorSpace = THREE.SRGBColorSpace;
    this.panel.material.needsUpdate = true;
  }

  update(camera, tracked) {
    this.panel.visible = false;
    if (this.handedness === "none" || !tracked || !this.copy) return -Infinity;
    camera.getWorldPosition(eye);
    camera.getWorldDirection(forward);
    this.grip.getWorldPosition(handPosition);
    toHand.copy(handPosition).sub(eye);
    const distance = toHand.length();
    const gaze = forward.dot(toHand.normalize());
    if (distance < 0.14 || distance > 1.1 || gaze < 0.76) return -Infinity;
    camera.getWorldQuaternion(cameraRotation);
    cameraRight.set(1, 0, 0).applyQuaternion(cameraRotation);
    const hasClipboard = this.handedness === "left" && this.copy.includes("Clipboard");
    const offset = this.handedness === "left" ? 0.17 : -0.17;
    this.panel.position.copy(handPosition)
      .addScaledVector(cameraRight, offset);
    this.panel.position.y += hasClipboard ? 0.3 : 0.13;
    this.panel.quaternion.copy(cameraRotation);
    this.panel.visible = true;
    return gaze - distance * 0.05;
  }
}
