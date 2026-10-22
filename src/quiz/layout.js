export const INITIAL_RING_RADIUS = 1.1;
export const QUIZ_SCREEN_DISTANCE = 1.32;

export function initialTilePose(index, count = 26) {
  const angle = index * Math.PI * 2 / count;
  return {
    x: Math.sin(angle) * INITIAL_RING_RADIUS,
    y: -0.13,
    z: -Math.cos(angle) * INITIAL_RING_RADIUS,
    yaw: -angle,
  };
}

export function answerBlockPose(index, count = 4) {
  const x = (index - (count - 1) / 2) * 0.56;
  const innerX = count % 2 ? 0 : 0.28;
  const reach = Math.hypot(QUIZ_SCREEN_DISTANCE, innerX);
  const z = QUIZ_SCREEN_DISTANCE - Math.sqrt(reach * reach - x * x);
  const outer = index === 0 || index === count - 1;
  return { x, y: -0.42, z, yaw: outer ? -Math.sign(x) * Math.PI / 15 : 0 };
}
