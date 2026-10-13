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

function forestLoop(ctx) {
  const seconds = 18;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  let seed = 82451;
  let wind = 0;
  let leaves = 0;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return (seed / 0x100000000) * 2 - 1;
  };
  for (let i = 0; i < samples.length; i++) {
    const t = i / ctx.sampleRate;
    const noise = random();
    wind += (noise - wind) * 0.003;
    leaves += (noise - leaves) * 0.12;
    const breeze = 0.62 + 0.17 * Math.sin(t * 0.72) + 0.12 * Math.sin(t * 1.43);
    const seam = Math.min(1, t / 0.35, (seconds - t) / 0.35);
    samples[i] = (0.52 * wind + 0.13 * leaves) * breeze * seam;
  }
  // Several short, pitched bird calls sit well inside the loop seam.
  for (const [start, base] of [[2.1, 1650], [5.4, 2050], [9.2, 1780], [13.0, 2250], [16.1, 1880]])
    for (let call = 0; call < 2; call++) {
      const first = Math.floor((start + call * 0.31) * ctx.sampleRate);
      const length = Math.floor(0.23 * ctx.sampleRate);
      let phase = 0;
      for (let j = 0; j < length && first + j < samples.length; j++) {
        const t = j / length;
        const frequency = base + 520 * Math.sin(Math.PI * t) +
          85 * Math.sin(2 * Math.PI * 15 * j / ctx.sampleRate);
        phase += 2 * Math.PI * frequency / ctx.sampleRate;
        samples[first + j] += 0.19 * Math.sin(Math.PI * t) ** 2 * Math.sin(phase);
      }
    }
  return buffer;
}

export class LabSound {
  constructor() {
    this.muted = false;
    this.volume = 1;
    this.musicEnabled = true;
    this.ambienceEnabled = true;
    this.effectsEnabled = true;
    try {
      this.muted = localStorage.getItem("spatial-lab-muted") === "true";
      const settings = JSON.parse(localStorage.getItem("spatial-lab-sound-settings") ?? "null");
      if (settings) {
        if (Number.isFinite(settings.volume))
          this.volume = Math.max(0, Math.min(1, settings.volume));
        for (const key of ["musicEnabled", "ambienceEnabled", "effectsEnabled"])
          if (typeof settings[key] === "boolean") this[key] = settings[key];
      }
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
        this.master.gain.value = this.muted || !this.active ? 0 : 0.22 * this.volume;
        this.master.connect(ctx.destination);
        this.effectsBus = ctx.createGain();
        this.effectsBus.gain.value = this.effectsEnabled ? 1 : 0;
        this.effectsBus.connect(this.master);
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
        this.water.connect(this.effectsBus);
        const windFilter = ctx.createBiquadFilter();
        windFilter.type = "lowpass";
        windFilter.frequency.value = 320;
        this.wind = ctx.createGain();
        this.wind.gain.value = this.landscapeOn && this.ambienceEnabled ? 0.22 : 0;
        noise.connect(windFilter);
        windFilter.connect(this.wind);
        this.wind.connect(this.master);
        const riverFilter = ctx.createBiquadFilter();
        riverFilter.type = "lowpass";
        riverFilter.frequency.value = 650;
        this.river = ctx.createGain();
        this.river.gain.value = this.landscapeOn && this.ambienceEnabled
          ? 0.22 * (this.riverLevel ?? 0) : 0;
        noise.connect(riverFilter);
        riverFilter.connect(this.river);
        this.river.connect(this.master);
        noise.start();
        this.menu = ctx.createGain();
        this.menu.gain.value = this.menuMusicOn && this.musicEnabled ? 0.1 : 0;
        this.menu.connect(this.master);
        this.menuSource = ctx.createBufferSource();
        this.menuSource.buffer = menuLoop(ctx);
        this.menuSource.loop = true;
        this.menuSource.connect(this.menu);
        this.menuSource.start();
        this.forest = ctx.createGain();
        this.forest.gain.value = this.landscapeOn && this.ambienceEnabled
          ? 0.26 * (this.forestLevel ?? 0) : 0;
        this.forest.connect(this.master);
        this.forestSource = ctx.createBufferSource();
        this.forestSource.buffer = forestLoop(ctx);
        this.forestSource.loop = true;
        this.forestSource.connect(this.forest);
        this.forestSource.start();
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
    if (this.appliedActive === active && this.appliedMuted === this.muted &&
        this.appliedVolume === this.volume)
      return;
    this.appliedActive = active;
    this.appliedMuted = this.muted;
    this.appliedVolume = this.volume;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(
      active && !this.muted ? 0.22 * this.volume : 0,
      now,
      0.025,
    );
    if (!active) this.setWater(false);
  }
  toggle() {
    this.muted = !this.muted;
    this.saveSettings();
    this.unlock();
    this.setActive(this.active);
    if (!this.muted) this.click();
  }
  saveSettings() {
    try {
      localStorage.setItem("spatial-lab-muted", String(this.muted));
      localStorage.setItem("spatial-lab-sound-settings", JSON.stringify({
        volume: this.volume,
        musicEnabled: this.musicEnabled,
        ambienceEnabled: this.ambienceEnabled,
        effectsEnabled: this.effectsEnabled,
      }));
    } catch {}
  }
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
    this.setActive(this.active);
  }
  setCategory(category, enabled) {
    const key = { music: "musicEnabled", ambience: "ambienceEnabled",
      effects: "effectsEnabled" }[category];
    if (!key) return;
    this[key] = !!enabled;
    this.saveSettings();
    if (!this.context) return;
    const now = this.context.currentTime;
    if (category === "music")
      this.menu.gain.setTargetAtTime(this.menuMusicOn && enabled ? 0.1 : 0, now, 0.12);
    else if (category === "ambience") this.updateLandscapeMix();
    else this.effectsBus.gain.setTargetAtTime(enabled ? 1 : 0, now, 0.025);
  }
  setMenuMusic(on) {
    if (this.menuMusicOn === on) return;
    this.menuMusicOn = on;
    if (this.menu)
      this.menu.gain.setTargetAtTime(on && this.musicEnabled ? 0.1 : 0,
        this.context.currentTime, 0.18);
  }
  setLandscape(on, riverLevel = 0, forestLevel = 0) {
    const river = Math.max(0, Math.min(1, riverLevel));
    const forest = Math.max(0, Math.min(1, forestLevel));
    if (this.landscapeOn === on &&
        Math.abs((this.riverLevel ?? 0) - river) < 0.04 &&
        this.forestLevel === forest)
      return;
    this.landscapeOn = on;
    this.riverLevel = river;
    this.forestLevel = forest;
    this.updateLandscapeMix();
  }
  updateLandscapeMix() {
    if (!this.context || !this.forest) return;
    const now = this.context.currentTime;
    const enabled = this.landscapeOn && this.ambienceEnabled;
    this.wind.gain.setTargetAtTime(enabled ? 0.22 : 0, now, 0.3);
    this.forest.gain.setTargetAtTime(enabled ? 0.26 * this.forestLevel : 0, now, 0.3);
    this.river.gain.setTargetAtTime(enabled ? 0.22 * this.riverLevel : 0, now, 0.3);
  }
  tone(frequency, duration = 0.065, gain = 0.13) {
    if (
      !this.context ||
      this.context.state !== "running" ||
      this.muted ||
      !this.active || !this.effectsEnabled || this.volume === 0
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
    envelope.connect(this.effectsBus);
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
    if (this.muted || !this.active || !this.effectsEnabled || this.volume === 0 ||
        this.context.state !== "running") return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    const start = now + 0.09;
    oscillator.type = "sine";
    oscillator.frequency.value = notes[1];
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(0.075, start + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
    oscillator.connect(envelope);
    envelope.connect(this.effectsBus);
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
      on ? 0.025 : 0.1,
    );
  }
}
