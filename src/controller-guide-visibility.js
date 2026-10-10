// A brief look reveals controls; a wider viewing cone and grace period keep
// them from blinking out as the user turns a wrist or glances between buttons.
export function updateGuideVisibility(state, tracked, distance, gaze, height, dt) {
  if (!tracked || distance < 0.12 || distance > 1.05 ||
      height < -0.58 || gaze < 0.45) return { dwell: 0, hold: 0 };
  const dwell = gaze >= 0.78 ? Math.min(0.12, state.dwell + dt) : 0;
  const hold = dwell >= 0.12 || (state.hold > 0 && gaze >= 0.60)
    ? 1.1 : Math.max(0, state.hold - dt);
  return { dwell, hold };
}
