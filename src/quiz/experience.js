import * as THREE from "three";
import { QuizSession } from "./session.js";
import { makeQuizRound } from "./questions.js";
import { sweptBladeHitFraction } from "./slice-hit.js";
import { initialTilePose, answerBlockPose } from "./layout.js";

const ANSWER_COLORS = [0x236f89, 0x685ea1, 0x9b682f, 0x298270];
const BLADE_SAMPLES = [-0.32, -0.52, -0.72, -0.84];

function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function textCanvas(text, color = "#f3fffc", background = "#123541",
  fontScale = 1, targetAspect = null) {
  const canvas = document.createElement("canvas");
  canvas.width = targetAspect ? text.length === 1 ? 256 : 512 : 1024;
  canvas.height = targetAspect
    ? Math.round(canvas.width / targetAspect) : 384;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#72c7c0";
  ctx.lineWidth = Math.max(3, canvas.width / 128);
  const inset = ctx.lineWidth / 2 + 2;
  ctx.strokeRect(inset, inset, canvas.width - inset * 2,
    canvas.height - inset * 2);
  let size = targetAspect ? canvas.height * 0.25 * fontScale : 96 * fontScale;
  let lines;
  do {
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    lines = wrapLines(ctx, text, canvas.width * 0.91);
    if (lines.length <= 3 && lines.length * size * 1.17 <=
        canvas.height * 0.87) break;
    size -= targetAspect ? 2 : 5;
  } while (size > (targetAspect ? 14 : 45));
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((line, index) =>
    ctx.fillText(line, canvas.width / 2,
      canvas.height / 2 + (index - (lines.length - 1) / 2) * size * 1.17,
      canvas.width * 0.91));
  return canvas;
}

function panel(text, width, height, x, y, options = {}) {
  const canvas = textCanvas(text, options.color, options.background,
    options.fontScale, options.targetAspect ? width / height : null);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide,
      transparent: false }));
  mesh.position.set(x, y, options.z ?? 0.07);
  mesh.userData.canvas = canvas;
  return mesh;
}

function disposeTree(root) {
  root.traverse((child) => {
    child.geometry?.dispose();
    if (child.material) for (const material of Array.isArray(child.material)
      ? child.material : [child.material]) {
      material.map?.dispose();
      material.dispose();
    }
  });
  root.removeFromParent();
}

export class QuizExperience {
  constructor(scene, controllers, sound, onExit, leaderboard = null) {
    this.sound = sound;
    this.onExit = onExit;
    this.leaderboard = leaderboard;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.screen = new THREE.Group();
    this.group.add(this.screen);
    this.letterField = new THREE.Group();
    scene.add(this.letterField);
    this.effects = new THREE.Group();
    scene.add(this.effects);
    this.blades = controllers.map(({ grip, id }) => {
      const blade = new THREE.Group();
      const color = id === 0 ? 0x79eaff : 0xffd184;
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.039, 0.16, 12),
        new THREE.MeshBasicMaterial({ color: 0x19313e }));
      handle.rotation.x = Math.PI / 2;
      handle.position.z = -0.08;
      const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.032, 12),
        new THREE.MeshBasicMaterial({ color: 0x9dc4cc }));
      guard.rotation.x = Math.PI / 2;
      guard.position.z = -0.17;
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.022, 0.66, 12),
        new THREE.MeshBasicMaterial({ color }));
      core.rotation.x = Math.PI / 2;
      core.position.z = -0.51;
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.045, 0.68, 12),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22,
          depthWrite: false }));
      glow.rotation.x = Math.PI / 2;
      glow.position.z = -0.51;
      blade.add(handle, guard, glow, core);
      grip.add(blade);
      return { grip, blade, previous: null };
    });
    this.initials = "";
    this.session = null;
    this.targets = [];
    this.fragments = [];
    this.lastHit = -Infinity;
    this.age = 0;
    this.timerShown = -1;
    this.leaderboardState = "";
    this.leaderboardRows = [];
    this.gisDayRows = [];
    this.submitted = false;
    this.disposed = false;
    this.render();
  }

  place(camera) {
    const eye = camera.getWorldPosition(new THREE.Vector3());
    const forward = camera.getWorldDirection(new THREE.Vector3());
    forward.y = 0;
    if (forward.lengthSq() < 0.01) forward.set(0, 0, -1);
    forward.normalize();
    this.group.position.copy(eye).addScaledVector(forward, 1.32);
    this.group.position.y = eye.y - 0.03;
    this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), forward);
    this.letterField.position.copy(eye);
    this.letterField.rotation.y = Math.atan2(-forward.x, -forward.z);
  }

  addPanel(text, width, height, x, y, options) {
    const mesh = panel(text, width, height, x, y, options);
    this.screen.add(mesh);
    return mesh;
  }

  addTarget(text, x, y, width, height, color, action, parent = this.screen) {
    const group = new THREE.Group();
    group.position.set(x, y, 0);
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.12),
      new THREE.MeshBasicMaterial({ color }));
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry),
      new THREE.LineBasicMaterial({ color: 0xd4f6f1 }));
    const face = panel(text, width - 0.024, height - 0.024, 0, 0,
      { z: 0.064, background: `#${color.toString(16).padStart(6, "0")}`,
        fontScale: text.length === 1 ? 1.6 : 1, targetAspect: true });
    group.add(body, edge, face);
    parent.add(group);
    const target = { group, face, text, width, height, color, action,
      box: { min: { x: -width / 2, y: -height / 2, z: -0.08 },
        max: { x: width / 2, y: height / 2, z: 0.08 } } };
    this.targets.push(target);
    return target;
  }

  render() {
    while (this.screen.children.length) disposeTree(this.screen.children[0]);
    while (this.letterField.children.length)
      disposeTree(this.letterField.children[0]);
    this.targets = [];
    this.timerShown = -1;
    if (!this.session) {
      this.addPanel("GEOSLICE · THE GIS DAY CHALLENGE", 2.15, 0.25,
        0, 0.87, { color: "#a6f5d9" });
      this.addPanel("Turn to collect three initials. Slice Start. Fast correct answers earn more points.", 2.08, 0.22,
        0, 0.60);
      this.addPanel(`Your initials: ${this.initials.padEnd(3, "_").split("").join("  ")}`,
        0.78, 0.19, 0, 0.40, { color: "#ffdc89" });
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      for (let index = 0; index < letters.length; index++) {
        const letter = letters[index];
        const pose = initialTilePose(index, letters.length);
        const tile = this.addTarget(letter, pose.x, pose.y,
          0.215, 0.23, 0x2b7084, () => {
            if (this.initials.length >= 3) return;
            this.initials += letter;
            this.sound.slice(true);
            this.render();
          }, this.letterField);
        tile.group.position.z = pose.z;
        tile.group.rotation.y = pose.yaw;
      }
      this.addTarget("Erase", -0.55, -0.78, 0.48, 0.18, 0x6b5c82, () => {
        this.initials = this.initials.slice(0, -1);
        this.sound.click();
        this.render();
      });
      if (this.initials.length === 3)
        this.addTarget("Start", 0.55, -0.78, 0.48, 0.18, 0x3c9470, () =>
          this.begin());
      else this.addPanel("Slice three letters, then Start", 0.98, 0.15,
        0.55, -0.78, { fontScale: 0.72 });
      return;
    }
    if (this.session.phase === "quit-paused") {
      this.addPanel("LEAVE THE CHALLENGE?", 2.0, 0.32, 0, 0.54,
        { color: "#ffdc89" });
      this.addPanel("This round's score will be discarded.", 1.85, 0.21,
        0, 0.22);
      this.addTarget("Continue", -0.45, -0.31, 0.72, 0.34, 0x2c836d,
        () => { this.session.resume(); this.render(); });
      this.addTarget("Quit", 0.45, -0.31, 0.72, 0.34, 0x945862,
        () => { this.session.quit(); this.onExit(); });
      return;
    }
    if (this.session.phase === "complete") {
      this.addPanel("ROUND COMPLETE", 1.8, 0.28, 0, 0.75,
        { color: "#a6f5d9" });
      this.addPanel(`${this.initials} · ${this.session.score} points · ${this.session.correctCount}/10 correct`,
        2.05, 0.24, 0, 0.47);
      this.addPanel("TODAY'S TOP SCORES · THIS HEADSET", 1.93, 0.17,
        0, 0.22, { color: "#a6f5d9", fontScale: 0.61 });
      const board = this.leaderboardRows.length
        ? this.leaderboardRows.slice(0, 5).map((row, index) =>
          `${index + 1}. ${row.initials} ${row.score}`).join("   ")
        : this.leaderboardState || "Today's board is empty";
      this.addPanel(board, 2.20, 0.29, 0, -0.05);
      this.addPanel(this.gisDayRows.length
        ? `GIS DAY 2026 BEST: ${this.gisDayRows.slice(0, 3).map((row, index) =>
          `${index + 1}. ${row.initials} ${row.score}`).join("   ")}`
        : "Scores stay on this headset; the daily board resets at Chicago midnight.",
        2.14, 0.21, 0, -0.39, { fontScale: 0.73 });
      this.addTarget("Play again", -0.50, -0.75, 0.78, 0.27, 0x2c836d,
        () => { this.session = null; this.initials = ""; this.submitted = false;
          this.leaderboardRows = []; this.gisDayRows = []; this.render(); });
      this.addTarget("Menu", 0.50, -0.75, 0.78, 0.27, 0x685e9b,
        () => this.onExit());
      return;
    }
    const question = this.session.question;
    this.addPanel(`${question.category.toUpperCase()} · ${this.session.index + 1}/10 · ${this.session.score} PTS`,
      2.15, 0.19, 0, 0.89, { color: "#a6f5d9", fontScale: 0.56 });
    this.addPanel(question.prompt, 2.23, 0.51, 0, 0.50,
      { color: "#ffffff", fontScale: 0.95 });
    if (this.session.phase === "prompt") {
      this.statusPanel = this.addPanel("Think first · answers incoming",
        1.78, 0.20, 0, -0.05, { color: "#ffdc89" });
      return;
    }
    if (this.session.phase === "feedback") {
      const result = this.session.results.at(-1);
      const resultText = result.choice === null ? "TIME'S UP" :
        result.correct ? `CORRECT · +${result.gained}` : "NOT QUITE";
      this.addPanel(resultText, 1.6, 0.24, 0, 0.04,
        { color: result.correct ? "#a6f5d9" : "#ffcc96" });
      this.addPanel(`Answer: ${question.choices[question.correct]}`,
        1.9, 0.19, 0, -0.24, { color: "#ffdc89" });
      this.addPanel(result.explanation, 2.17, 0.35, 0, -0.55);
      return;
    }
    this.timerPanel = this.addPanel("18 seconds", 0.95, 0.15, 0, 0.13,
      { color: "#ffdc89", fontScale: 0.9 });
    question.choices.forEach((choice, index) => {
      const pose = answerBlockPose(index);
      this.addTarget(choice, pose.x, pose.y, 0.49, 0.43,
        ANSWER_COLORS[index], () => this.choose(index));
    });
  }

  begin() {
    if (this.initials.length !== 3) return;
    this.session = new QuizSession(makeQuizRound(), this.initials);
    this.session.start();
    this.sound.cue("reveal");
    this.render();
  }

  choose(index) {
    if (this.session?.phase !== "question") return;
    const result = this.session.answer(index);
    if (!result) return;
    this.sound.slice(result.correct);
    this.render();
  }

  requestQuit() {
    if (!this.session || this.session.complete) {
      this.onExit();
      return;
    }
    if (this.session.phase === "quit-paused") {
      this.session.resume();
    } else if (this.session.phase !== "audio-paused") {
      this.session.pause("quit");
    }
    this.render();
  }

  pauseForAudio() {
    this.session?.pause("audio");
    this.clearMotion();
  }

  resumeAudio() {
    if (this.session?.phase === "audio-paused") this.session.resume();
    this.clearMotion();
  }

  clearMotion() {
    for (const blade of this.blades) blade.previous = null;
  }

  split(target) {
    target.group.updateWorldMatrix(true, false);
    const fragmentGroup = new THREE.Group();
    target.group.getWorldPosition(fragmentGroup.position);
    target.group.getWorldQuaternion(fragmentGroup.quaternion);
    for (const side of [-1, 1]) {
      const half = new THREE.Group();
      half.position.x = side * target.width / 4;
      half.add(new THREE.Mesh(
        new THREE.BoxGeometry(target.width / 2 - 0.004, target.height, 0.12),
        new THREE.MeshBasicMaterial({ color: target.color })));
      const texture = new THREE.CanvasTexture(target.face.userData.canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const geometry = new THREE.PlaneGeometry(target.width / 2 - 0.012,
        target.height - 0.024);
      const uv = geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++)
        uv.setX(i, side < 0 ? uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5);
      half.add(new THREE.Mesh(geometry,
        new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })));
      half.children[1].position.z = 0.065;
      fragmentGroup.add(half);
    }
    this.effects.add(fragmentGroup);
    this.fragments.push({ group: fragmentGroup, age: 0 });
  }

  updateBlades(dt, allowHit) {
    for (const hand of this.blades) {
      hand.blade.visible = hand.grip.visible;
      if (!hand.grip.visible) { hand.previous = null; continue; }
      hand.grip.updateWorldMatrix(true, false);
      const current = BLADE_SAMPLES.map((z) =>
        hand.grip.localToWorld(new THREE.Vector3(0, 0, z)));
      if (allowHit && hand.previous && dt > 0) {
        const tip = current.at(-1);
        const oldTip = hand.previous.at(-1);
        const speed = tip.distanceTo(oldTip) / dt;
        if (speed > 1.2 && speed < 15) this.sound.whoosh();
        if (this.age - this.lastHit > 0.35) {
          let target = null;
          let firstContact = Infinity;
          for (const item of this.targets) {
            item.group.updateWorldMatrix(true, false);
            const previousLocal = hand.previous.map((point) =>
              item.group.worldToLocal(point.clone()));
            const currentLocal = current.map((point) =>
              item.group.worldToLocal(point.clone()));
            const fraction = sweptBladeHitFraction(previousLocal, currentLocal,
              item.box, dt);
            if (fraction !== null && fraction < firstContact) {
              firstContact = fraction;
              target = item;
            }
          }
          if (target) {
            this.lastHit = this.age;
            this.split(target);
            target.action();
            if (this.disposed) return;
          }
        }
      }
      hand.previous = current;
    }
  }

  submitScore() {
    if (this.submitted || !this.session?.complete) return;
    this.submitted = true;
    if (!this.leaderboard) {
      this.leaderboardState = "This headset's leaderboard is unavailable";
      this.render();
      return;
    }
    try {
      const board = this.leaderboard.submit(this.session);
      this.leaderboardRows = board.today;
      this.gisDayRows = board.gisDay;
      this.leaderboardState = "This headset's daily leaderboard";
    } catch {
      this.leaderboardState = "Local storage unavailable · score shown above";
    }
    if (!this.disposed) this.render();
  }

  update(dt, active = true) {
    this.age += dt;
    for (const fragment of [...this.fragments]) {
      fragment.age += dt;
      const [left, right] = fragment.group.children;
      for (const [half, side] of [[left, -1], [right, 1]]) {
        half.position.x += side * dt * 0.25;
        half.position.y -= dt * (0.16 + fragment.age * 1.3);
        half.rotation.z += side * dt * 2.4;
      }
      if (fragment.age > 0.8) {
        disposeTree(fragment.group);
        this.fragments.splice(this.fragments.indexOf(fragment), 1);
      }
    }
    if (!active) { this.clearMotion(); return; }
    const oldPhase = this.session?.phase;
    const oldIndex = this.session?.index;
    this.session?.update(dt);
    if (this.session && (this.session.phase !== oldPhase || this.session.index !== oldIndex)) {
      if (this.session.phase === "question") this.sound.cue("reveal");
      this.render();
      if (this.session.complete) this.submitScore();
    }
    if (this.session?.phase === "question") {
      const seconds = Math.ceil(this.session.remaining);
      if (seconds !== this.timerShown) {
        this.timerShown = seconds;
        if (this.timerPanel) {
          const old = this.timerPanel;
          this.timerPanel = panel(`${seconds} seconds`, 0.95, 0.15, 0, 0.13,
            { color: seconds <= 5 ? "#ffb194" : "#ffdc89", fontScale: 0.9 });
          this.screen.add(this.timerPanel);
          disposeTree(old);
        }
      }
    }
    this.updateBlades(dt, true);
  }

  dispose() {
    this.disposed = true;
    this.clearMotion();
    for (const { blade } of this.blades) disposeTree(blade);
    disposeTree(this.group);
    disposeTree(this.letterField);
    disposeTree(this.effects);
    this.targets = [];
    this.fragments = [];
  }
}
