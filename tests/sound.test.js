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
