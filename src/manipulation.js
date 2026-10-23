import { Matrix4, Vector3, Quaternion, MathUtils } from "three";

const MIN_RELEASE_SPEED = 0.55; // Radians per second: small wrist adjustments settle in place.
const MAX_RELEASE_SPEED = 5.5;
const SPIN_DRAG = 6.5; // Exponential damping, so a faster turn coasts farther.
const STOP_SPEED = 0.05;

// World-space manipulation of a single rigid assembly. No child is transformed alone.
export class ModelGrab {
  constructor(object, minScale = 0.28, maxScale = 0.85) {
    this.object = object;
    this.minScale = minScale;
    this.maxScale = maxScale;
    this.hands = new Map();
    this.stickReady = new Map();
    this.turnPivot = new Vector3(0, 0.5, 0);
    this.angularVelocity = new Vector3();
    this.lastRotation = null;
    this.lastInstantSpeed = 0;
  }
  begin(id, matrix) {
    if (this.hands.has(id) || this.hands.size === 2) return;
    this.hands.set(id, matrix.clone());
    this.rebase();
    this.resetMotion();
  }
  release(id, coast = true) {
    if (!this.hands.delete(id)) return;
    this.stickReady.delete(id);
    this.rebase();
    if (this.hands.size) {
      // Keep the measured spin if both grips are released in the same frame.
      // Rebasing the remaining hand avoids a jump in its next pose update.
      if (coast) this.lastRotation = this.object.quaternion.clone();
      else this.resetMotion();
    }
    else {
      this.lastRotation = null;
      if (!coast || this.lastInstantSpeed < MIN_RELEASE_SPEED ||
          this.angularVelocity.length() < MIN_RELEASE_SPEED)
        this.angularVelocity.set(0, 0, 0);
    }
  }
  cancel() {
    this.hands.clear();
    this.stickReady.clear();
    this.base = null;
    this.angularVelocity.set(0, 0, 0);
    this.lastRotation = null;
    this.lastInstantSpeed = 0;
  }
  resetMotion() {
    this.angularVelocity.set(0, 0, 0);
    this.lastRotation = this.object.quaternion.clone();
    this.lastInstantSpeed = 0;
  }
  rotateAboutPivot(turn) {
    this.object.updateWorldMatrix(true, false);
    const before = this.object.localToWorld(this.turnPivot.clone());
    this.object.quaternion.premultiply(turn);
    this.object.updateWorldMatrix(true, false);
    const after = this.object.localToWorld(this.turnPivot.clone());
    this.object.position.add(before.sub(after));
  }
  sampleRotation(dt) {
    if (!this.lastRotation || !Number.isFinite(dt) || dt <= 0 || dt > 0.1) {
      this.resetMotion();
      return;
    }
    const delta = this.object.quaternion.clone()
      .multiply(this.lastRotation.clone().invert()).normalize();
    this.lastRotation.copy(this.object.quaternion);
    if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
    const sinHalf = Math.hypot(delta.x, delta.y, delta.z);
    const angle = 2 * Math.atan2(sinHalf, delta.w);
    const instant = sinHalf > 1e-7
      ? new Vector3(delta.x, delta.y, delta.z)
        .multiplyScalar(angle / (sinHalf * dt))
        .clampLength(0, MAX_RELEASE_SPEED)
      : new Vector3();
    this.lastInstantSpeed = instant.length();
    const blend = 1 - Math.exp(-dt / 0.035);
    this.angularVelocity.lerp(instant, blend);
  }
  coast(dt) {
    const speed = this.angularVelocity.length();
    if (speed < STOP_SPEED || !Number.isFinite(dt) || dt <= 0) return;
    const damping = Math.exp(-SPIN_DRAG * dt);
    const angle = speed * (1 - damping) / SPIN_DRAG;
    const turn = new Quaternion().setFromAxisAngle(
      this.angularVelocity.clone().divideScalar(speed), angle);
    this.rotateAboutPivot(turn);
    this.angularVelocity.multiplyScalar(damping);
    if (this.angularVelocity.length() < STOP_SPEED)
      this.angularVelocity.set(0, 0, 0);
  }
  turnWithStick(id, horizontal, vertical, camera) {
    if (!this.hands.has(id)) {
      this.stickReady.delete(id);
      return false;
    }
    if (Math.hypot(horizontal, vertical) < 0.3) {
      this.stickReady.set(id, true);
      return false;
    }
    if (this.stickReady.get(id) === false ||
        Math.max(Math.abs(horizontal), Math.abs(vertical)) < 0.75) return false;
    this.stickReady.set(id, false);
    const sideways = Math.abs(horizontal) >= Math.abs(vertical);
    const axis = sideways ? new Vector3(0, 1, 0)
      : new Vector3(1, 0, 0).applyQuaternion(
        camera.getWorldQuaternion(new Quaternion())).setY(0).normalize();
    if (axis.lengthSq() < 0.01) axis.set(1, 0, 0);
    const turn = new Quaternion().setFromAxisAngle(axis,
      Math.sign(sideways ? horizontal : vertical) * Math.PI / 4);
    this.rotateAboutPivot(turn);
    this.rebase();
    this.resetMotion();
    return true;
  }
  rebase() {
    this.object.updateMatrix();
    const hands = [...this.hands.values()];
    if (!hands.length) {
      this.base = null;
      return;
    }
    this.base = {
      matrix: this.object.matrix.clone(),
      position: this.object.position.clone(),
      rotation: this.object.quaternion.clone(),
      scale: this.object.scale.x,
    };
    if (hands.length === 1)
      this.base.offset = hands[0].clone().invert().multiply(this.base.matrix);
    else {
      const a = new Vector3().setFromMatrixPosition(hands[0]);
      const b = new Vector3().setFromMatrixPosition(hands[1]);
      this.base.midpoint = a.clone().add(b).multiplyScalar(0.5);
      this.base.vector = b.sub(a);
      this.base.distance = this.base.vector.length();
    }
  }
  update(poses, dt) {
    if (!this.hands.size) {
      this.coast(dt);
      return;
    }
    for (const id of this.hands.keys()) {
      const pose = poses.get(id);
      if (!pose) {
        this.cancel();
        return;
      } // Tracking loss freezes the model.
      this.hands.set(id, pose.clone());
    }
    if (!this.base) return;
    const hands = [...this.hands.values()];
    if (hands.length === 1) {
      hands[0]
        .clone()
        .multiply(this.base.offset)
        .decompose(
          this.object.position,
          this.object.quaternion,
          this.object.scale,
        );
      this.sampleRotation(dt);
      return;
    }
    const a = new Vector3().setFromMatrixPosition(hands[0]);
    const b = new Vector3().setFromMatrixPosition(hands[1]);
    const midpoint = a.clone().add(b).multiplyScalar(0.5);
    const vector = b.sub(a);
    if (vector.length() < 0.06) {
      this.sampleRotation(dt);
      return;
    }
    if (this.base.distance < 0.06) {
      this.rebase();
      return;
    }
    const scale = MathUtils.clamp(
      (this.base.scale * vector.length()) / this.base.distance,
      this.minScale,
      this.maxScale,
    );
    const turn = new Quaternion().setFromUnitVectors(
      this.base.vector.clone().normalize(),
      vector.normalize(),
    );
    this.object.position
      .copy(this.base.position)
      .sub(this.base.midpoint)
      .multiplyScalar(scale / this.base.scale)
      .applyQuaternion(turn)
      .add(midpoint);
    this.object.quaternion.copy(turn).multiply(this.base.rotation);
    this.object.scale.setScalar(scale);
    this.sampleRotation(dt);
  }
}
