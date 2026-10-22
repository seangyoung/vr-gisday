import * as THREE from "three";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import { arrangeButtonLabels, positionButtonLabel } from "./controller-label-layout.js";
import { updateGuideVisibility } from "./controller-guide-visibility.js";

const modelFactory = new XRControllerModelFactory();
modelFactory.setPath(`${import.meta.env.BASE_URL}controller-profiles`);

const anchorNames = {
  x: "x_button_pressed_value",
  y: "y_button_pressed_value",
  a: "a_button_pressed_value",
  b: "b_button_pressed_value",
  trigger: "xr_standard_trigger_pressed_value",
  grip: "xr_standard_squeeze_pressed_value",
  stick: "xr_standard_thumbstick_pressed_value",
};
const leftButtons = [
  ["x", "X", "Restart", "y", 0.025],
  ["y", "Y", "Reset", "x", 0.025],
];
const rightButtons = [
  ["a", "A", "Sound", "b", 0.025],
  ["b", "B", "Exit", "a", 0.025],
];
const eye = new THREE.Vector3();
const forward = new THREE.Vector3();
const hand = new THREE.Vector3();
const toHand = new THREE.Vector3();

function makeLabel(key, action) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(5, 24, 32, 0.94)";
  ctx.fillRect(2, 2, 508, 124);
  ctx.strokeStyle = "#a6f5d9";
  ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, 506, 122);
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#a6f5d9";
  ctx.font = "700 49px system-ui, sans-serif";
  ctx.fillText(key, 20, 65, 175);
  ctx.fillStyle = "#f4faf8";
  ctx.font = "600 45px system-ui, sans-serif";
  const actionX = key === "STICK" ? 192 : key === "TRIG" ? 165
    : key === "GRIP" ? 155 : 112;
  ctx.fillText(action, actionX, 65, 490 - actionX);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, transparent: true, depthTest: false, depthWrite: false,
  }));
  sprite.scale.set(key === "TRIG" || key === "GRIP" ? 0.068 : 0.057, 0.018, 1);
  sprite.renderOrder = 42;
  sprite.visible = false;
  return sprite;
}

export class ControllerGuide {
  constructor(scene, grip) {
    this.scene = scene;
    this.grip = grip;
    this.model = modelFactory.createControllerModel(grip);
    grip.add(this.model);
    this.handedness = "none";
    this.trigger = null;
    this.gripAction = null;
    this.onMenu = false;
    this.exitLabel = "Exit demo";
    this.stickAction = null;
    this.quizMode = false;
    this.dwell = 0;
    this.hold = 0;
    this.labels = [];
    this.labelKey = "";
    this.materialsPrepared = false;
  }

  setHandedness(value) {
    const handName = value === "left" || value === "right" ? value : "none";
    if (handName === this.handedness) return;
    this.handedness = handName;
    this.dwell = 0;
    this.hold = 0;
    this.materialsPrepared = false;
    this.clearLabels();
  }

  setContext(trigger, gripAction = null, onMenu = false, exitLabel = "Exit demo",
    stickAction = null, quizMode = false) {
    if (trigger === this.trigger && gripAction === this.gripAction &&
        onMenu === this.onMenu && exitLabel === this.exitLabel &&
        stickAction === this.stickAction && quizMode === this.quizMode) return;
    this.trigger = trigger;
    this.gripAction = gripAction;
    this.onMenu = onMenu;
    this.exitLabel = exitLabel;
    this.stickAction = stickAction;
    this.quizMode = quizMode;
    this.clearLabels();
  }

  clearLabels() {
    for (const { sprite } of this.labels) {
      this.scene.remove(sprite);
      sprite.material.map.dispose();
      sprite.material.dispose();
    }
    this.labels = [];
    this.labelKey = "";
  }

  ensureLabels() {
    if (!this.model.children.length || this.handedness === "none") return false;
    if (!this.materialsPrepared) {
      this.model.traverse((child) => {
        if (!child.isMesh || !child.material?.isMeshStandardMaterial) return;
        child.material = child.material.clone();
        child.material.emissive.set(0xffffff);
        child.material.emissiveMap = child.material.map;
        child.material.emissiveIntensity = 0.9;
        child.material.needsUpdate = true;
      });
      this.materialsPrepared = true;
    }
    const key = `${this.handedness}:${this.trigger}:${this.gripAction ?? ""}:${this.onMenu}:${this.exitLabel}:${this.stickAction ?? ""}:${this.quizMode}`;
    if (this.labelKey === key) return this.labels.length > 0;
    this.clearLabels();
    const buttons = this.handedness === "left"
      ? this.quizMode ? [] : leftButtons.filter(([id]) => !this.onMenu || id !== "x")
      : rightButtons.map((spec) => spec[0] === "b"
        ? [spec[0], spec[1], this.exitLabel, spec[3], spec[4]] : spec);
    const specs = [
      ...buttons,
      ...(this.trigger ? [["trigger", "TRIG", this.trigger, "grip", 0.032]] : []),
      ...(this.gripAction ? [["grip", "GRIP", this.gripAction, "trigger", 0.032]] : []),
      ...(this.stickAction && this.handedness === "right"
        ? [["stick", "STICK", this.stickAction, "a", 0.035]] : []),
    ];
    for (const [id, face, action, neighborId, spacing] of specs) {
      const node = this.model.getObjectByName(anchorNames[id]);
      if (!node) continue;
      const sprite = makeLabel(face, action);
      this.scene.add(sprite);
      this.labels.push({ node, neighbor: this.model.getObjectByName(anchorNames[neighborId]),
        anchor: new THREE.Vector3(), neighborPosition: new THREE.Vector3(),
        sprite, spacing, ready: false });
    }
    this.labelKey = key;
    return this.labels.length > 0;
  }

  setVisible(value) {
    for (const label of this.labels)
      label.sprite.visible = value && label.ready;
  }

  update(camera, tracked, dt) {
    this.setVisible(false);
    if (this.handedness === "none" || !tracked || !this.ensureLabels()) {
      this.dwell = 0;
      this.hold = 0;
      return -Infinity;
    }
    camera.getWorldPosition(eye);
    camera.getWorldDirection(forward);
    this.grip.getWorldPosition(hand);
    toHand.copy(hand).sub(eye);
    const distance = toHand.length();
    const gaze = forward.dot(toHand.normalize());
    const visibility = updateGuideVisibility({ dwell: this.dwell, hold: this.hold },
      tracked, distance, gaze, hand.y - eye.y, dt);
    this.dwell = visibility.dwell;
    this.hold = visibility.hold;
    if (this.hold <= 0) return -Infinity;
    for (const label of this.labels) {
      label.node.getWorldPosition(label.anchor);
      const neighbor = label.neighbor?.getWorldPosition(label.neighborPosition);
      label.ready = positionButtonLabel(label.anchor, neighbor, eye,
        label.spacing, label.sprite.position);
    }
    arrangeButtonLabels(this.labels, camera);
    return gaze - distance * 0.05;
  }
}
