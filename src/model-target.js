import * as THREE from "three";

// Pick the whole movable exhibit, including empty space inside a scan outline.
// Test in local coordinates so rotating or resizing the model keeps grip targets aligned.
export function modelBoundsHit(group, bounds, raycaster) {
  group.updateWorldMatrix(true, false);
  const inverse = group.matrixWorld.clone().invert();
  const localRay = raycaster.ray.clone().applyMatrix4(inverse);
  const point = localRay.intersectBox(bounds, new THREE.Vector3());
  if (!point) return null;
  const world = group.localToWorld(point);
  return { point: world, distance: world.distanceTo(raycaster.ray.origin) };
}

export function handInsideModel(group, bounds, worldHand) {
  group.updateWorldMatrix(true, false);
  return bounds.containsPoint(group.worldToLocal(worldHand.clone()));
}

export function modelBeforeUi(modelHit, uiHit) {
  return !!modelHit && (!uiHit || modelHit.distance < uiHit.distance);
}
