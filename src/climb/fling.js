import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);

export function climbHand(position) {
  return { position: position.clone(), velocity: new THREE.Vector3(),
    horizontalTravel: 0, lastDt: 1 / 60 };
}

export function sampleClimbHand(hand, position, dt) {
  const movement = position.clone().sub(hand.position);
  if (dt > 0 && dt <= 0.08 && movement.length() < 0.35) {
    hand.velocity.lerp(movement.clone().divideScalar(dt).clampLength(0, 8), 0.7);
    hand.horizontalTravel = hand.horizontalTravel * Math.exp(-dt / 0.12) +
      Math.hypot(movement.x, movement.z);
    hand.lastDt = dt;
  } else {
    hand.velocity.multiplyScalar(0.35);
    hand.horizontalTravel *= 0.35;
  }
  hand.position.copy(position);
  return THREE.MathUtils.clamp(-movement.y, -0.22, 0.22);
}

export function climbPushOff(hand, releasePosition, group, anchor, visitor) {
  if (!hand) return null;
  if (releasePosition?.isVector3 && releasePosition.distanceTo(hand.position) > 0.012)
    sampleClimbHand(hand, releasePosition, hand.lastDt);
  const motion = hand.velocity.clone().applyAxisAngle(UP, -group.rotation.y);
  const handLocal = group.worldToLocal(hand.position.clone());
  const outward = new THREE.Vector2(visitor.x - anchor.x, visitor.y - anchor.y);
  if (outward.length() < 0.15)
    outward.set(handLocal.x - anchor.x, handLocal.z - anchor.y);
  if (outward.length() < 0.05) return null;
  outward.normalize();
  // Either a push against the support or an outward flick launches away from it.
  const handSweep = new THREE.Vector2(motion.x, motion.z);
  const speed = handSweep.length();
  if (speed < 1.1 || hand.horizontalTravel < 0.045) return null;
  const tangent = handSweep.clone().addScaledVector(
    outward, -handSweep.dot(outward));
  const direction = outward.clone().addScaledVector(tangent, 0.25 / speed).normalize();
  const horizontal = direction.multiplyScalar(
    THREE.MathUtils.clamp(1.3 + 0.75 * speed, 2.4, 5.5));
  return {
    horizontal,
    up: THREE.MathUtils.clamp(1.6 + Math.max(0, -motion.y) * 0.25, 1.6, 3.2),
    strength: horizontal.length(),
  };
}
