import * as THREE from "three";

const towardEye = new THREE.Vector3();
const awayFromNeighbor = new THREE.Vector3();
const viewPosition = new THREE.Vector3();
const viewRotation = new THREE.Quaternion();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const candidate = new THREE.Vector3();
const basePosition = new THREE.Vector3();
const pointScale = new THREE.Vector3();
const offsets = [
  [0, 0], [0, 0.022], [0, -0.022], [0, 0.044], [0, -0.044],
  [0.024, 0.022], [-0.024, 0.022], [0.024, -0.022], [-0.024, -0.022],
  [0.048, 0], [-0.048, 0],
];

// Keep a badge on the outside of its own button, regardless of wrist rotation.
// Hide paired badges when the buttons are edge-on and cannot be distinguished.
export function positionButtonLabel(anchor, neighbor, eye, spacing, target) {
  towardEye.copy(eye).sub(anchor).normalize();
  target.copy(anchor).addScaledVector(towardEye, 0.024);
  if (!neighbor) return true;
  awayFromNeighbor.copy(anchor).sub(neighbor);
  awayFromNeighbor.addScaledVector(towardEye,
    -awayFromNeighbor.dot(towardEye));
  if (awayFromNeighbor.lengthSq() < 0.003 ** 2) return false;
  target.addScaledVector(awayFromNeighbor.normalize(), spacing);
  return true;
}

function viewRect(position, scale, eye, inverseRotation) {
  viewPosition.copy(position).sub(eye).applyQuaternion(inverseRotation);
  const depth = Math.max(0.05, -viewPosition.z);
  return {
    x: viewPosition.x / depth,
    y: viewPosition.y / depth,
    halfWidth: scale.x / (2 * depth),
    halfHeight: scale.y / (2 * depth),
  };
}

function overlaps(a, b) {
  const padding = 0.009;
  return Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth + padding &&
    Math.abs(a.y - b.y) < a.halfHeight + b.halfHeight + padding;
}

// Reposition short badges in the viewer's plane, never more than a few cm
// from their button. If there is no clear spot, hide that badge for this frame.
export function arrangeButtonLabels(labels, camera) {
  camera.getWorldPosition(towardEye);
  camera.getWorldQuaternion(viewRotation);
  right.set(1, 0, 0).applyQuaternion(viewRotation);
  up.set(0, 1, 0).applyQuaternion(viewRotation);
  viewRotation.invert();
  const placed = [];
  for (const label of labels) {
    if (!label.ready) continue;
    basePosition.copy(label.sprite.position);
    const own = label.anchor && viewRect(label.anchor, pointScale,
      towardEye, viewRotation);
    const neighbor = label.neighbor && viewRect(label.neighborPosition,
      pointScale, towardEye, viewRotation);
    label.ready = false;
    for (const [dx, dy] of offsets) {
      candidate.copy(basePosition).addScaledVector(right, dx).addScaledVector(up, dy);
      const rect = viewRect(candidate, label.sprite.scale, towardEye, viewRotation);
      if (own && neighbor &&
          Math.hypot(rect.x - own.x, rect.y - own.y) >=
          Math.hypot(rect.x - neighbor.x, rect.y - neighbor.y)) continue;
      if (placed.some((other) => overlaps(rect, other))) continue;
      label.sprite.position.copy(candidate);
      placed.push(rect);
      label.ready = true;
      break;
    }
  }
}
