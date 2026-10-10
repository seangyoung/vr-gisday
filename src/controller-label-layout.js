import * as THREE from "three";

const towardEye = new THREE.Vector3();
const awayFromNeighbor = new THREE.Vector3();

// Keep a badge on the outside of its own button, regardless of wrist rotation.
// Hide paired badges when the buttons are edge-on and cannot be distinguished.
export function positionButtonLabel(anchor, neighbor, eye, spacing, target) {
  towardEye.copy(eye).sub(anchor).normalize();
  target.copy(anchor).addScaledVector(towardEye, 0.024);
  if (!neighbor) return true;
  awayFromNeighbor.copy(anchor).sub(neighbor);
  awayFromNeighbor.addScaledVector(towardEye,
    -awayFromNeighbor.dot(towardEye));
  if (awayFromNeighbor.lengthSq() < 0.008 ** 2) return false;
  target.addScaledVector(awayFromNeighbor.normalize(), spacing);
  return true;
}
