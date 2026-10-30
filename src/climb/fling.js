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

export function climbPushOff(hand, releasePosition, group, anchor, visitor,
  eyeWorld = null) {
  if (!hand) return null;
  if (releasePosition?.isVector3 && releasePosition.distanceTo(hand.position) > 0.012)
    sampleClimbHand(hand, releasePosition, hand.lastDt);
  const motion = hand.velocity.clone().applyAxisAngle(UP, -group.rotation.y);
  const handLocal = group.worldToLocal(hand.position.clone());
  const eyeLocal = eyeWorld?.isVector3 ? group.worldToLocal(eyeWorld.clone()) : null;
  const outward = eyeLocal
    ? new THREE.Vector2(eyeLocal.x - anchor.x, eyeLocal.z - anchor.y)
    : new THREE.Vector2();
  if (outward.length() < 0.15)
    outward.set(handLocal.x - anchor.x, handLocal.z - anchor.y);
  if (outward.length() < 0.05)
    outward.set(visitor.x - anchor.x, visitor.y - anchor.y);
  if (outward.length() < 0.05) return null;
  outward.normalize();
  // Follow the hand's horizontal direction. A stroke into the fixed support
  // reverses the impulse; a sideways stroke keeps most of its tangential motion.
  const handSweep = new THREE.Vector2(motion.x, motion.z);
  const speed = handSweep.length();
  if (speed < 1.1 || hand.horizontalTravel < 0.045) return null;
  const direction = handSweep.normalize();
  if (direction.dot(outward) < -0.12) direction.negate();
  const radial = direction.dot(outward);
  if (radial < 0.2) direction.addScaledVector(outward, 0.2 - radial).normalize();
  const horizontal = direction.multiplyScalar(
    THREE.MathUtils.clamp(1.3 + 0.75 * speed, 2.4, 5.5));
  return {
    horizontal,
    up: THREE.MathUtils.clamp(1.6 + Math.max(0, -motion.y) * 0.25, 1.6, 3.2),
    strength: horizontal.length(),
  };
}

export function combineClimbPushOff(first, second) {
  if (!first) return second;
  if (!second) return first;
  const horizontal = first.horizontal.clone().add(second.horizontal).multiplyScalar(0.5);
  if (horizontal.length() < 0.8)
    return first.strength >= second.strength ? first : second;
  return { horizontal, up: Math.max(first.up, second.up),
    strength: horizontal.length() };
}
