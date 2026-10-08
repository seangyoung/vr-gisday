// Original synthesized effects: no audio downloads or third-party recordings.
export class LabSound {
  constructor() {
    this.muted = false;
    try {
      this.muted = localStorage.getItem("spatial-lab-muted") === "true";
    } catch {}
    this.active = true;
    this.lastScan = -Infinity;
  }
  unlock() {
    try {
      if (!this.context) {
        const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Audio) return;
        const ctx = (this.context = new Audio());
        this.master = ctx.createGain();
        this.master.gain.value = this.muted || !this.active ? 0 : 0.22;
        this.master.connect(ctx.destination);
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 1300;
        this.water = ctx.createGain();
        this.water.gain.value = 0;
        noise.connect(filter);
        filter.connect(this.water);
        this.water.connect(this.master);
        noise.start();
      }
      if (this.context.state === "suspended")
        this.context.resume().catch(() => {});
    } catch {
      /* Audio is optional; XR must remain usable if initialization fails. */
    }
  }
  setActive(active) {
    this.active = active;
    if (!this.master) return;
    if (this.appliedActive === active && this.appliedMuted === this.muted)
      return;
    this.appliedActive = active;
    this.appliedMuted = this.muted;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(
      active && !this.muted ? 0.22 : 0,
      now,
      0.025,
    );
    if (!active) this.setWater(false);
  }
  toggle() {
    this.muted = !this.muted;
    try {
      localStorage.setItem("spatial-lab-muted", String(this.muted));
    } catch {}
    this.unlock();
    this.setActive(this.active);
    if (!this.muted) this.click();
  }
  tone(frequency, duration = 0.065, gain = 0.13) {
    if (
      !this.context ||
      this.context.state !== "running" ||
      this.muted ||
      !this.active
    )
      return;
    const ctx = this.context,
      now = ctx.currentTime;
    const oscillator = ctx.createOscillator(),
      envelope = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(gain, now + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
  }
  click() {
    this.unlock();
    this.tone(620);
  }
  scan() {
    if (!this.context) return;
    const now = this.context.currentTime;
    if (now - this.lastScan < 0.14) return;
    this.lastScan = now;
    this.tone(1050, 0.04, 0.075);
  }
  setWater(on) {
    if (!this.water || this.waterOn === on) return;
    this.waterOn = on;
    this.water.gain.setTargetAtTime(
      on ? 0.3 : 0,
      this.context.currentTime,
      0.1,
    );
  }
}
