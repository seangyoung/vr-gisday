// Original synthesized effects: no audio downloads or third-party recordings.
function menuLoop(ctx) {
  const seconds = 12;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  const note = (frequency, start, length, volume) => {
    const first = Math.floor(start * ctx.sampleRate);
    const last = Math.min(samples.length, Math.ceil((start + length) * ctx.sampleRate));
    for (let i = first; i < last; i++) {
      const t = (i - first) / ctx.sampleRate;
      const envelope = Math.min(1, t / 0.035) *
        Math.min(1, (length - t) / 0.18) * Math.exp(-1.8 * t / length);
      const phase = 2 * Math.PI * frequency * t;
      samples[i] += volume * envelope *
        (Math.sin(phase) + 0.19 * Math.sin(2 * phase) + 0.05 * Math.sin(3 * phase));
    }
  };
  // A light, original four-bar lounge loop: soft chords, bass and a short melody.
  const chords = [
    [130.81, 164.81, 196, 246.94], // Cmaj7
    [110, 130.81, 164.81, 196],    // Am7
    [146.83, 174.61, 220, 261.63], // Dm7
    [98, 123.47, 146.83, 174.61],  // G7
  ];
  const melody = [
    [392, 440, 392], [329.63, 392, 329.63],
    [349.23, 440, 349.23], [392, 369.99, 392],
  ];
  chords.forEach((chord, bar) => {
    const at = bar * 3;
    note(chord[0] / 2, at, 1.4, 0.12);
    note(chord[0] / 2, at + 1.5, 1.3, 0.09);
    for (const frequency of chord.slice(1)) {
      note(frequency, at, 1.65, 0.08);
      note(frequency, at + 1.5, 1.35, 0.06);
    }
    melody[bar].forEach((frequency, beat) =>
      note(frequency, at + 0.45 + beat * 0.82, 0.62, 0.09));
  });
  return buffer;
}

export class LabSound {
  constructor() {
    this.muted = false;
    try {
      this.muted = localStorage.getItem("spatial-lab-muted") === "true";
    } catch {}
    this.active = true;
    this.lastScan = -Infinity;
    this.lastCue = -Infinity;
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
        this.menu = ctx.createGain();
        this.menu.gain.value = this.menuMusicOn ? 0.1 : 0;
        this.menu.connect(this.master);
        this.menuSource = ctx.createBufferSource();
        this.menuSource.buffer = menuLoop(ctx);
        this.menuSource.loop = true;
        this.menuSource.connect(this.menu);
        this.menuSource.start();
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
  setMenuMusic(on) {
    if (this.menuMusicOn === on) return;
    this.menuMusicOn = on;
    if (this.menu)
      this.menu.gain.setTargetAtTime(on ? 0.1 : 0, this.context.currentTime, 0.18);
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
  scan(distance = 1) {
    if (!this.context) return;
    const now = this.context.currentTime;
    if (now - this.lastScan < 0.14) return;
    this.lastScan = now;
    // Shorter returns sound slightly brighter, without claiming material sensing.
    this.tone(880 + 340 / (1 + Math.max(0, distance)), 0.04, 0.075);
  }
  cue(kind) {
    this.unlock();
    if (!this.context) return;
    const now = this.context.currentTime;
    if (now - this.lastCue < 0.12) return;
    this.lastCue = now;
    const notes = {
      measure: [440, 660],
      reveal: [520, 780],
      correct: [620, 930],
      blocked: [330, 260],
      layer: [480, 720],
      merge: [650, 430],
      spill: [390, 540],
    }[kind];
    if (!notes) return;
    this.tone(notes[0], 0.11, 0.085);
    // Schedule the second note through the audio graph, not a wall-clock timer.
    if (this.muted || !this.active || this.context.state !== "running") return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    const start = now + 0.09;
    oscillator.type = "sine";
    oscillator.frequency.value = notes[1];
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(0.075, start + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(start);
    oscillator.stop(start + 0.13);
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
