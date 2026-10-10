// Quest Touch exposes X/Y on the left and A/B on the right at indices 4/5.
// The left thumbstick click is index 3. The platform Menu key is not exposed.
export class ControllerShortcuts {
  constructor() {
    this.reset();
  }

  reset() {
    this.previous = { left: null, right: null };
  }

  update(sources) {
    const events = [];
    for (const hand of ["left", "right"]) {
      const source = sources.find((item) => item?.handedness === hand);
      const gamepad = source?.gamepad;
      if (gamepad?.mapping !== "xr-standard") {
        this.previous[hand] = null;
        continue;
      }
      const pressed = [3, 4, 5].map((index) => !!gamepad.buttons[index]?.pressed);
      const before = this.previous[hand];
      if (before) {
        if (hand === "left" && pressed[0] && !before[0]) events.push("menu");
        if (pressed[1] && !before[1]) events.push(hand === "left" ? "restart" : "sound");
        if (pressed[2] && !before[2]) events.push(hand === "left" ? "reset" : "exit");
      }
      this.previous[hand] = pressed;
    }
    return events;
  }
}
