// Quest Touch exposes X/Y on the left and A/B on the right at indices 4/5.
// The xr-standard indices 0-3 remain reserved for trigger, grip, pad, and stick.
export class ControllerShortcuts {
  constructor() {
    this.reset();
  }

  reset() {
    this.previous = { left: null, right: null };
    this.exitHold = 0;
    this.exitFired = false;
  }

  update(sources, dt) {
    const events = [];
    for (const hand of ["left", "right"]) {
      const source = sources.find((item) => item?.handedness === hand);
      const gamepad = source?.gamepad;
      if (gamepad?.mapping !== "xr-standard") {
        this.previous[hand] = null;
        if (hand === "left") {
          this.exitHold = 0;
          this.exitFired = false;
        }
        continue;
      }
      const pressed = [3, 4, 5].map((index) => !!gamepad.buttons[index]?.pressed);
      const before = this.previous[hand];
      if (before) {
        if (pressed[1] && !before[1]) events.push(hand === "left" ? "menu" : "reset");
        if (pressed[2] && !before[2]) events.push(hand === "left" ? "restart" : "sound");
      }
      this.previous[hand] = pressed;
      if (hand === "left") {
        if (pressed[0]) {
          this.exitHold += Math.max(0, dt);
          if (this.exitHold >= 1.2 && !this.exitFired) {
            events.unshift("exit");
            this.exitFired = true;
          }
        } else {
          this.exitHold = 0;
          this.exitFired = false;
        }
      }
    }
    return events;
  }
}
