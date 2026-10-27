import test from "node:test";
import assert from "node:assert/strict";
import { LabSound } from "../src/sound.js";

class Param {
  value = 0;
  calls = [];
  setTargetAtTime(v, when, constant) {
    this.value = v;
    this.calls.push({ v, when, constant });
  }
  setValueAtTime(v) {
    this.value = v;
  }
  linearRampToValueAtTime(v) {
    this.value = v;
  }
  exponentialRampToValueAtTime(v) {
    this.value = v;
  }
}
class Node {
  gain = new Param();
  frequency = new Param();
  Q = new Param();
  positionX = new Param();
  positionY = new Param();
  positionZ = new Param();
  connect() {}
  disconnect() {}
  start() { this.started = true; }
  stop() {
    this.onended?.();
  }
}
class Context {
  currentTime = 0;
  sampleRate = 100;
  state = "running";
  destination = {};
  tones = 0;
  sources = [];
  listener = {
    positionX: new Param(), positionY: new Param(), positionZ: new Param(),
    forwardX: new Param(), forwardY: new Param(), forwardZ: new Param(),
    upX: new Param(), upY: new Param(), upZ: new Param(),
  };
  createGain() {
    return new Node();
  }
  createBuffer(_channels, length) {
    const samples = new Float32Array(length);
    return { getChannelData: () => samples };
  }
  createBufferSource() {
    const source = new Node();
    this.sources.push(source);
    return source;
  }
  createBiquadFilter() {
    return new Node();
  }
  createPanner() {
    return new Node();
  }
  createOscillator() {
    this.tones++;
    return new Node();
  }
}
test("rain sound begins at input time and fades when pouring stops", () => {
  const old = globalThis.AudioContext;
  globalThis.AudioContext = Context;
  try {
    const sound = new LabSound();
    sound.unlock();
    sound.context.currentTime = 12;
    sound.setWater(true);
    assert.deepEqual(sound.water.gain.calls.at(-1),
      { v: 0.3, when: 12, constant: 0.025 });
    sound.context.currentTime = 13;
    sound.setWater(false);
    assert.deepEqual(sound.water.gain.calls.at(-1),
      { v: 0, when: 13, constant: 0.1 });
  } finally {
    globalThis.AudioContext = old;
  }
});
test("audio starts lazily, scan cues are bounded, and mute/visibility silence all effects", () => {
  const old = globalThis.AudioContext;
  globalThis.AudioContext = Context;
  try {
    const sound = new LabSound();
    sound.setWater(true);
    sound.scan();
    assert.equal(sound.context, undefined);
    sound.unlock();
    sound.scan();
    sound.scan();
    assert.equal(sound.context.tones, 1);
    sound.context.currentTime = 0.2;
    sound.scan();
    assert.equal(sound.context.tones, 2);
    sound.setWater(true);
    assert.ok(sound.water.gain.value > 0);
    sound.toggle();
    sound.click();
    assert.equal(sound.master.gain.value, 0);
    assert.equal(sound.context.tones, 2);
    sound.toggle();
    sound.setActive(false);
    assert.equal(sound.master.gain.value, 0);
    assert.equal(sound.water.gain.value, 0);
    sound.setActive(true);
    assert.ok(sound.master.gain.value > 0);
    assert.equal(sound.water.gain.value, 0);
  } finally {
    globalThis.AudioContext = old;
  }
});

test("event cues are bounded and remain silent while muted", () => {
  const old = globalThis.AudioContext;
  globalThis.AudioContext = Context;
  try {
    const sound = new LabSound();
    sound.unlock();
    sound.cue("layer");
    assert.equal(sound.context.tones, 2);
    sound.cue("reveal");
    assert.equal(sound.context.tones, 2);
    sound.context.currentTime = 0.2;
    sound.muted = true;
    sound.cue("reveal");
    assert.equal(sound.context.tones, 2);
  } finally {
    globalThis.AudioContext = old;
  }
});

test("menu music follows menu state and the same mute control as effects", () => {
  const old = globalThis.AudioContext;
  globalThis.AudioContext = Context;
  try {
    const sound = new LabSound();
    sound.setMenuMusic(true);
    sound.unlock();
    assert.equal(sound.menu.gain.value, 0.1);
    assert.equal(sound.menuSource.loop, true);
    assert.ok(sound.menuSource.buffer.getChannelData(0).some((sample) => sample !== 0));
    sound.toggle();
    assert.equal(sound.master.gain.value, 0);
    sound.toggle();
    assert.ok(sound.master.gain.value > 0);
    sound.setMenuMusic(false);
    assert.equal(sound.menu.gain.value, 0);
    sound.setMenuMusic(true);
    sound.setActive(false);
    assert.equal(sound.master.gain.value, 0);
  } finally {
    globalThis.AudioContext = old;
  }
});

test("landscape ambience follows visible layers and sound-menu category controls", () => {
  const old = globalThis.AudioContext;
  globalThis.AudioContext = Context;
  try {
    const sound = new LabSound();
    sound.setLandscape(true, 0.8, 1);
    sound.unlock();
    assert.equal(sound.forestSource.loop, true);
    assert.ok(sound.forestSource.buffer.getChannelData(0).some((sample) => sample !== 0));
    assert.ok(sound.wind.gain.value > 0);
    assert.ok(sound.forest.gain.value > 0);
    assert.ok(sound.river.gain.value > 0);
    sound.setLandscape(true, 0, 0);
    assert.equal(sound.forest.gain.value, 0);
    assert.equal(sound.river.gain.value, 0);
    assert.ok(sound.wind.gain.value > 0);
    sound.setCategory("ambience", false);
    assert.equal(sound.wind.gain.value, 0);
    sound.setCategory("effects", false);
    sound.click();
    assert.equal(sound.context.tones, 0);
    sound.setVolume(0.5);
    assert.equal(sound.master.gain.value, 0.11);
    sound.setCategory("music", false);
    sound.setMenuMusic(true);
    assert.equal(sound.menu.gain.value, 0);
    sound.setLandscape(false);
    assert.equal(sound.wind.gain.value, 0);
  } finally {
    globalThis.AudioContext = old;
  }
});

test("drone and plane flyovers follow the pass and stop with effects or visibility", () => {
  const old = globalThis.AudioContext;
  globalThis.AudioContext = Context;
  try {
    const sound = new LabSound();
    sound.unlock();
    sound.setFlyover("satellite", 0.5);
    assert.equal(sound.flyoverSound, undefined);
    sound.setFlyover("drone", 0.25);
    assert.equal(sound.flyoverSound.kind, "drone");
    assert.equal(sound.flyoverSound.sources.length, 3);
    const approaching = sound.flyoverSound.envelope.gain.value;
    sound.setFlyover("drone", 0.5);
    assert.ok(sound.flyoverSound.envelope.gain.value > approaching);
    sound.setFlyover("aircraft", 0.5);
    assert.equal(sound.flyoverSound.kind, "aircraft");
    assert.equal(sound.flyoverSound.sources.length, 3);
    sound.setCategory("effects", false);
    sound.setFlyover("aircraft", 0.6);
    assert.equal(sound.flyoverSound, null);
    sound.setCategory("effects", true);
    sound.setFlyover("aircraft", 0.6);
    assert.equal(sound.flyoverSound.kind, "aircraft");
    sound.setActive(false);
    assert.equal(sound.flyoverSound, null);
  } finally {
    globalThis.AudioContext = old;
  }
});

test("world sounds follow moving sources and the listener; rain flow and tower wind respond", () => {
  const old = globalThis.AudioContext;
  globalThis.AudioContext = Context;
  try {
    const sound = new LabSound();
    sound.unlock();
    sound.setListener({ x: 2, y: 1.6, z: -3 },
      { x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 });
    assert.equal(sound.context.listener.positionX.value, 2);
    assert.equal(sound.context.listener.forwardZ.value, -1);
    sound.setRiverPosition({ x: 12, y: 0, z: -3 });
    assert.equal(sound.riverPanner.positionX.value, 12);
    sound.setRainPosition({ x: -0.4, y: 1, z: -1 });
    assert.equal(sound.rainPanner.positionX.value, -0.4);
    sound.setRunoff(0.8);
    assert.ok(sound.runoff.gain.value > 0);
    sound.setLandscape(true, 1, 0, 1);
    assert.equal(sound.wind.gain.value, 0.4);
    sound.setFlyover("drone", 0.5, { x: -10, y: 30, z: -15 });
    assert.equal(sound.flyoverSound.panner.positionX.value, -10);
    sound.setFlyover("drone", 0.6, { x: 4, y: 30, z: -15 });
    assert.equal(sound.flyoverSound.panner.positionX.value, 4);
    sound.setScanner(true, { x: 5, y: 1.5, z: -4 }, 0.4);
    assert.equal(sound.scannerSound.panner.positionX.value, 5);
    assert.ok(sound.scannerSound.sources[0].frequency.value > 120);
    sound.stationComplete(1200);
    assert.equal(sound.scannerSound, null);
    sound.setActive(false);
    assert.equal(sound.runoff.gain.value, 0);
  } finally {
    globalThis.AudioContext = old;
  }
});

test("GNSS timing cues use the effects bus and respect mute", () => {
  const old = globalThis.AudioContext;
  globalThis.AudioContext = Context;
  try {
    const sound = new LabSound();
    sound.unlock();
    sound.gnssSignal("send");
    sound.gnssSignal("bounce");
    sound.gnssSignal("receive");
    assert.equal(sound.context.tones, 3);
    sound.muted = true;
    sound.gnssSignal("send");
    assert.equal(sound.context.tones, 3);
  } finally {
    globalThis.AudioContext = old;
  }
});

test("sound menu preferences survive a new sound session", () => {
  const previous = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  try {
    const sound = new LabSound();
    sound.setVolume(0.5);
    sound.setCategory("ambience", false);
    sound.setCategory("music", false);
    sound.toggle();
    const reopened = new LabSound();
    assert.equal(reopened.volume, 0.5);
    assert.equal(reopened.ambienceEnabled, false);
    assert.equal(reopened.musicEnabled, false);
    assert.equal(reopened.muted, true);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
