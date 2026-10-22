export const INITIAL_RING_RADIUS = 1.1;

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
  return { x: (index - (count - 1) / 2) * 0.56, y: -0.42, z: 0 };
}
