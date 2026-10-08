import test from "node:test";
import assert from "node:assert/strict";
import { LabSound } from "../src/sound.js";

class Param {
  value = 0;
  setTargetAtTime(v) {
    this.value = v;
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
  start() {}
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
  createGain() {
    return new Node();
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(200) };
  }
  createBufferSource() {
    return new Node();
  }
  createBiquadFilter() {
    return new Node();
  }
  createOscillator() {
    this.tones++;
    return new Node();
  }
}
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
