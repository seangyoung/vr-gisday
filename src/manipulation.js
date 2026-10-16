import { Matrix4, Vector3, Quaternion, MathUtils } from "three";

// World-space manipulation of a single rigid assembly. No child is transformed alone.
export class ModelGrab {
  constructor(object, minScale = 0.28, maxScale = 0.85) {
    this.object = object;
    this.minScale = minScale;
    this.maxScale = maxScale;
    this.hands = new Map();
    this.stickReady = new Map();
    this.turnPivot = new Vector3(0, 0.5, 0);
  }
  begin(id, matrix) {
    if (this.hands.has(id) || this.hands.size === 2) return;
    this.hands.set(id, matrix.clone());
    this.rebase();
  }
  release(id) {
    this.hands.delete(id);
    this.stickReady.delete(id);
    this.rebase();
  }
  cancel() {
    this.hands.clear();
    this.stickReady.clear();
    this.base = null;
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
    this.object.updateWorldMatrix(true, false);
    const before = this.object.localToWorld(this.turnPivot.clone());
    this.object.quaternion.premultiply(turn);
    this.object.updateWorldMatrix(true, false);
    const after = this.object.localToWorld(this.turnPivot.clone());
    this.object.position.add(before.sub(after));
    this.rebase();
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
  update(poses) {
    for (const id of this.hands.keys()) {
      const pose = poses.get(id);
      if (!pose) {
        this.cancel();
        return;
      } // Tracking loss freezes the model.
      this.hands.set(id, pose.clone());
    }
    if (!this.base || !this.hands.size) return;
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
      return;
    }
    const a = new Vector3().setFromMatrixPosition(hands[0]);
    const b = new Vector3().setFromMatrixPosition(hands[1]);
    const midpoint = a.clone().add(b).multiplyScalar(0.5);
    const vector = b.sub(a);
    if (vector.length() < 0.06) return;
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
  }
}
