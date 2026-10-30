import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);

export function climbHand(position) {
  return { position: position.clone(), velocity: new THREE.Vector3(), lastDt: 1 / 60 };
}

export function sampleClimbHand(hand, position, dt) {
  const movement = position.clone().sub(hand.position);
  if (dt > 0 && dt <= 0.08 && movement.length() < 0.35) {
    hand.velocity.lerp(movement.clone().divideScalar(dt).clampLength(0, 8), 0.7);
    hand.lastDt = dt;
  } else hand.velocity.multiplyScalar(0.35);
  hand.position.copy(position);
  return THREE.MathUtils.clamp(-movement.y, -0.22, 0.22);
}

export function climbPushOff(hand, releasePosition, group, anchor, visitor) {
  if (!hand) return null;
  if (releasePosition?.isVector3 && releasePosition.distanceTo(hand.position) > 0.012)
    sampleClimbHand(hand, releasePosition, hand.lastDt);
  const away = hand.velocity.clone().applyAxisAngle(UP, -group.rotation.y).negate();
  const handLocal = group.worldToLocal(hand.position.clone());
  const outward = new THREE.Vector2(visitor.x - anchor.x, visitor.y - anchor.y);
  if (outward.length() < 0.15)
    outward.set(handLocal.x - anchor.x, handLocal.z - anchor.y);
  if (outward.length() < 0.05) return null;
  outward.normalize();
  // The support stays fixed: a hand push toward it sends the visitor outward.
  const horizontal = new THREE.Vector2(away.x, away.z);
  if (horizontal.length() < 1.5 || horizontal.dot(outward) < 1.25) return null;
  horizontal.clampLength(0, 5);
  return {
    horizontal,
    up: THREE.MathUtils.clamp(0.55 + Math.max(0, away.y) * 0.5, 0.55, 2.5),
    strength: horizontal.length(),
  };
}
