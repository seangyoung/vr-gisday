export const QUIZ_SCREEN_DISTANCE = 1.32;

export function answerBlockPose(index, count = 4) {
  const x = (index - (count - 1) / 2) * 0.48;
  const innerX = count % 2 ? 0 : 0.24;
  const reach = Math.hypot(QUIZ_SCREEN_DISTANCE, innerX);
  const z = QUIZ_SCREEN_DISTANCE - Math.sqrt(reach * reach - x * x);
  const outerX = (count - 1) * 0.24;
  const yaw = outerX ? -(x / outerX) * Math.PI / 9 : 0;
  return { x, y: -0.42, z, yaw };
}
