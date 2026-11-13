import * as THREE from "three";
import { QuizSession } from "./session.js";
import { sweptBladeContact, bladeCutAtContact } from "./slice-hit.js";
import { answerBlockPose, QUIZ_SCREEN_DISTANCE } from "./layout.js";
import { splitRectangle, polygonCentroid } from "./slice-shape.js";

const ANSWER_COLORS = [0x236f89, 0x685ea1, 0x9b682f, 0x298270];
const BLADE_SAMPLES = [-0.32, -0.52, -0.72, -0.84];
const ROUND_INFO_Z = -0.58;
const NEXT_ACTION_Z = 0.23;
const BLADE_TIP_Z = -0.84;
const SABER_COLORS = {
  grip: 0x283a32,
  metal: 0x929d8d,
  blade: 0xb4cba5,
  glow: 0x789c73,
};

function makeSaber() {
  const saber = new THREE.Group();
  const cylinder = (top, bottom, length, color, z, options = {}) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(top, bottom, length, 16),
      new THREE.MeshBasicMaterial({ color, ...options }),
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = z;
    saber.add(mesh);
    return mesh;
  };
  // A narrow, matte hilt keeps the blade's purpose clear in either hand.
  cylinder(0.029, 0.033, 0.17, SABER_COLORS.grip, -0.085);
  cylinder(0.034, 0.034, 0.016, SABER_COLORS.metal, -0.006);
  cylinder(0.036, 0.036, 0.024, SABER_COLORS.metal, -0.174);
  cylinder(0.026, 0.031, 0.68, SABER_COLORS.glow, -0.51,
    { transparent: true, opacity: 0.14, depthWrite: false });
  cylinder(0.010, 0.013, 0.66, SABER_COLORS.blade, -0.51);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.010, 12, 8),
    new THREE.MeshBasicMaterial({ color: SABER_COLORS.blade }));
  tip.position.z = -0.84;
  saber.add(tip);
  return saber;
}

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

function textCanvas(text, width, height, color = "#f3fffc",
  background = "#123541", fontScale = 1) {
  const canvas = document.createElement("canvas");
  const pixelsPerMeter = width < 0.3 ? 1100 : 850;
  canvas.width = Math.min(2048, Math.max(256, Math.round(width * pixelsPerMeter)));
  canvas.height = Math.min(1024, Math.max(128,
    Math.round(canvas.width * height / width)));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#72c7c0";
  ctx.lineWidth = Math.max(3, canvas.width / 128);
  const inset = ctx.lineWidth / 2 + 2;
  ctx.strokeRect(inset, inset, canvas.width - inset * 2,
    canvas.height - inset * 2);
  let size = canvas.height * 0.49 * fontScale;
  let lines;
  do {
    ctx.font = `600 ${Math.round(size)}px system-ui, sans-serif`;
    lines = wrapLines(ctx, text, canvas.width * 0.85);
    if (lines.length <= 3 && lines.length * size * 1.17 <=
        canvas.height * 0.84 && lines.every((line) =>
      ctx.measureText(line).width <= canvas.width * 0.85)) break;
    size -= 2;
  } while (size > 18);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((line, index) =>
    ctx.fillText(line, canvas.width / 2,
      canvas.height / 2 + (index - (lines.length - 1) / 2) * size * 1.17));
  return canvas;
}

function panel(text, width, height, x, y, options = {}) {
  const canvas = textCanvas(text, width, height, options.color,
    options.background, options.fontScale);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide,
      transparent: false }));
  mesh.position.set(x, y, options.z ?? 0.07);
  mesh.userData.canvas = canvas;
  return mesh;
}

function cutPieceGeometry(polygon, center, width, height) {
  const depth = 0.12;
  const positions = [];
  const uvs = [];
  const push = (vertex, z) => {
    positions.push(vertex.x - center.x, vertex.y - center.y, z);
    uvs.push(vertex.x / width + 0.5, vertex.y / height + 0.5);
  };
  const triangle = (a, b, c, z) => {
    push(a, z); push(b, z); push(c, z);
  };
  for (let index = 1; index < polygon.length - 1; index++)
    triangle(polygon[0], polygon[index], polygon[index + 1], depth / 2);
  const frontCount = positions.length / 3;
  for (let index = 1; index < polygon.length - 1; index++)
    triangle(polygon[0], polygon[index + 1], polygon[index], -depth / 2);
  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    push(a, -depth / 2); push(b, -depth / 2); push(b, depth / 2);
    push(a, -depth / 2); push(b, depth / 2); push(a, depth / 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.addGroup(0, frontCount, 0);
  geometry.addGroup(frontCount, positions.length / 3 - frontCount, 1);
  geometry.computeVertexNormals();
  return geometry;
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
  constructor(scene, controllers, sound, onExit, leaderboard, demo,
    question, playerName, onReturn) {
    this.sound = sound;
    this.onExit = onExit;
    this.onReturn = onReturn;
    this.leaderboard = leaderboard;
    this.demo = demo;
    this.playerName = playerName;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.screen = new THREE.Group();
    this.group.add(this.screen);
    this.effects = new THREE.Group();
    scene.add(this.effects);
    this.blades = controllers.map(({ grip }) => {
      const blade = makeSaber();
      grip.add(blade);
      return { grip, blade, previous: null };
    });
    this.session = new QuizSession([question], playerName);
    this.session.start();
    this.targets = [];
    this.fragments = [];
    this.pendingBlast = null;
    this.lastHit = -Infinity;
    this.age = 0;
    this.timerShown = -1;
    this.leaderboardState = "";
    this.submitted = false;
    this.feedbackRevealAt = 0;
    this.scoreAction = null;
    this.scoreActionRemaining = 0;
    this.disposed = false;
    this.render();
  }

  place(camera) {
    const eye = camera.getWorldPosition(new THREE.Vector3());
    const forward = camera.getWorldDirection(new THREE.Vector3());
    forward.y = 0;
    if (forward.lengthSq() < 0.01) forward.set(0, 0, -1);
    forward.normalize();
    this.group.position.copy(eye).addScaledVector(forward, QUIZ_SCREEN_DISTANCE);
    this.group.position.y = eye.y - 0.03;
    this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), forward);
  }

  addPanel(text, width, height, x, y, options) {
    const mesh = panel(text, width, height, x, y, options);
    this.screen.add(mesh);
    return mesh;
  }

  addRoundPanel(text, width, height, x, y, options = {}) {
    return this.addPanel(text, width, height, x, y,
      { ...options, z: ROUND_INFO_Z });
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
        fontScale: text.length === 1 ? 1.6 : 1 });
    group.add(body, edge, face);
    parent.add(group);
    const target = { group, body, face, text, width, height, color, action,
      box: { min: { x: -width / 2, y: -height / 2, z: -0.08 },
        max: { x: width / 2, y: height / 2, z: 0.08 } } };
    this.targets.push(target);
    return target;
  }

  render() {
    this.feedbackRevealAt = 0;
    while (this.screen.children.length) disposeTree(this.screen.children[0]);
    this.targets = [];
    this.timerShown = -1;
    if (this.session.phase === "complete") {
      this.addPanel("LESSON QUESTION COMPLETE", 1.8, 0.28, 0, 0.75,
        { color: "#a6f5d9" });
      this.addPanel(`${this.playerName} · ${this.session.score} points`,
        2.05, 0.24, 0, 0.47);
      this.addPanel(this.leaderboardState ||
        "Your best score for each lesson adds to today's total.",
        2.14, 0.27, 0, 0.08, { fontScale: 0.73 });
      const returnTarget = this.addTarget("Return to takeaway", -0.53, -0.50,
        0.95, 0.3, 0x2c836d,
        (method) => this.queueScoreAction(this.onReturn, returnTarget, method));
      const exitTarget = this.addTarget("Exit to Menu", 0.53, -0.50,
        0.86, 0.3, 0x685e9b,
        (method) => this.queueScoreAction(this.onExit, exitTarget, method));
      return;
    }
    const question = this.session.question;
    this.addRoundPanel(`${question.category.toUpperCase()} · ${this.playerName}`,
      2.15, 0.19, 0, 0.89, { color: "#a6f5d9", fontScale: 0.56 });
    this.addRoundPanel(question.prompt, 2.23, 0.51, 0, 0.50,
      { color: "#ffffff", fontScale: 0.95 });
    if (this.session.phase === "prompt") {
      this.statusPanel = this.addRoundPanel("Think first · answers incoming",
        1.78, 0.20, 0, -0.05, { color: "#ffdc89" });
      return;
    }
    if (this.session.phase === "feedback") {
      const result = this.session.results.at(-1);
      const resultText = result.choice === null ? "TIME'S UP" :
        result.correct ? `CORRECT · +${result.gained}` : "NOT QUITE";
      this.addRoundPanel(resultText, 1.6, 0.24, 0, 0.04,
        { color: result.correct ? "#a6f5d9" : "#ffcc96" });
      this.addRoundPanel(`Answer: ${question.choices[question.correct]}`,
        1.9, 0.19, 0, -0.20, { color: "#ffdc89" });
      this.addRoundPanel(result.explanation, 2.17, 0.31, 0, -0.44);
      this.addTarget("See score", 0, -0.76, 0.97, 0.26, 0x2c836d,
      (method = "slice") => {
        if (!this.session.advance()) return;
        if (method === "blast") this.sound.blastImpact(true);
        else this.sound.slice(true);
        if (this.session.complete) this.submitScore();
        else this.render();
      }).group.position.z = NEXT_ACTION_Z;
      return;
    }
    this.timerPanel = this.addRoundPanel("18 seconds", 0.95, 0.15, 0, 0.13,
      { color: "#ffdc89", fontScale: 0.9 });
    this.addRoundPanel("Slice a block or aim your blade and press trigger",
      2.16, 0.16, 0, -0.13, { color: "#a6f5d9", fontScale: 0.7 });
    question.choices.forEach((choice, index) => {
      const pose = answerBlockPose(index, question.choices.length);
      const target = this.addTarget(choice, pose.x, pose.y, 0.44, 0.43,
        ANSWER_COLORS[index], (method) => this.choose(index, method));
      target.group.position.z = pose.z;
      target.group.rotation.y = pose.yaw;
    });
  }

  choose(index, method = "slice") {
    if (this.session?.phase !== "question") return;
    const result = this.session.answer(index);
    if (!result) return;
    if (method === "blast") this.sound.blastImpact(result.correct);
    else this.sound.slice(result.correct);
    // Hold the board briefly so the cut can open before feedback covers it.
    for (const target of this.targets) target.group.visible = false;
    this.targets = [];
    if (this.timerPanel) this.timerPanel.visible = false;
    this.feedbackRevealAt = this.age + 0.82;
  }

  queueScoreAction(action, target, method = "slice") {
    if (this.scoreAction || this.disposed) return;
    if (method === "blast") this.sound.blastImpact(true);
    else this.sound.slice(true);
    target.group.visible = false;
    this.targets = [];
    this.scoreAction = action;
    this.scoreActionRemaining = 1;
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

  split(target, cut = { point: { x: 0, y: 0 },
    direction: { x: 1, y: 1 } }) {
    target.group.updateWorldMatrix(true, false);
    const fragmentGroup = new THREE.Group();
    target.group.getWorldPosition(fragmentGroup.position);
    target.group.getWorldQuaternion(fragmentGroup.quaternion);
    const { polygons, normal } = splitRectangle(target.width,
      target.height, cut.point, cut.direction);
    const pieces = [];
    for (const [index, polygon] of polygons.entries()) {
      const center = polygonCentroid(polygon);
      const texture = new THREE.CanvasTexture(target.face.userData.canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const piece = new THREE.Mesh(
        cutPieceGeometry(polygon, center, target.width, target.height), [
          new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
          new THREE.MeshBasicMaterial({ color: target.color,
            side: THREE.DoubleSide }),
        ]);
      piece.position.set(center.x, center.y, 0);
      fragmentGroup.add(piece);
      pieces.push({ mesh: piece, side: index === 0 ? -1 : 1,
        start: center });
    }
    this.effects.add(fragmentGroup);
    this.fragments.push({ group: fragmentGroup, pieces, normal, age: 0 });
  }

  shatter(target) {
    target.group.updateWorldMatrix(true, false);
    const fragmentGroup = new THREE.Group();
    target.group.getWorldPosition(fragmentGroup.position);
    target.group.getWorldQuaternion(fragmentGroup.quaternion);
    const pieces = [];
    for (let row = 0; row < 2; row++) for (let column = 0; column < 2; column++) {
      const x0 = -target.width / 2 + column * target.width / 2;
      const y0 = -target.height / 2 + row * target.height / 2;
      const polygon = [
        { x: x0, y: y0 }, { x: x0 + target.width / 2, y: y0 },
        { x: x0 + target.width / 2, y: y0 + target.height / 2 },
        { x: x0, y: y0 + target.height / 2 },
      ];
      const center = polygonCentroid(polygon);
      const texture = new THREE.CanvasTexture(target.face.userData.canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(
        cutPieceGeometry(polygon, center, target.width, target.height), [
          new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
          new THREE.MeshBasicMaterial({ color: target.color, side: THREE.DoubleSide }),
        ]);
      mesh.position.set(center.x, center.y, 0);
      fragmentGroup.add(mesh);
      pieces.push({ mesh, start: center, velocity: new THREE.Vector3(
        (column ? 1 : -1) * 0.75, (row ? 1 : -1) * 0.62, 0.42),
        side: column ? 1 : -1 });
    }
    this.effects.add(fragmentGroup);
    this.fragments.push({ group: fragmentGroup, pieces, age: 0, blast: true });
  }

  fireFromGrip(grip) {
    if (this.disposed || this.pendingBlast || !grip?.visible ||
        !["question", "feedback", "complete"].includes(this.session?.phase) ||
        !this.targets.length) return false;
    grip.updateWorldMatrix(true, false);
    const from = grip.localToWorld(new THREE.Vector3(0, 0, BLADE_TIP_Z));
    const direction = new THREE.Vector3(0, 0, -1)
      .transformDirection(grip.matrixWorld);
    const ray = new THREE.Raycaster(from, direction, 0.035, 3.2);
    let target = null;
    let nearest = null;
    for (const item of this.targets) {
      if (!item.group.visible) continue;
      item.group.updateWorldMatrix(true, true);
      // The decorative edge is a LineSegments object. Its generous default
      // raycast tolerance can report a hit well away from the actual block.
      const hit = ray.intersectObject(item.body, false)[0];
      if (hit && (!nearest || hit.distance < nearest.distance)) {
        nearest = hit;
        target = item;
      }
    }
    const to = from.clone().addScaledVector(direction,
      nearest?.distance ?? 2.6);
    const bolt = new THREE.Group();
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xc5ecb8 }));
    const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.015, 1, 8),
      new THREE.MeshBasicMaterial({ color: 0x94dca4, transparent: true,
        opacity: 0.83, depthWrite: false }));
    trail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    bolt.add(tip, trail);
    this.effects.add(bolt);
    this.pendingBlast = { from, to, target, bolt, tip, trail,
      age: 0, duration: Math.max(0.1, from.distanceTo(to) / 17) };
    this.sound.laserFire();
    return true;
  }

  updateBlast(dt) {
    const shot = this.pendingBlast;
    if (!shot) return;
    shot.age += dt;
    const fraction = Math.min(1, shot.age / shot.duration);
    const point = shot.from.clone().lerp(shot.to, fraction);
    shot.tip.position.copy(point);
    shot.trail.position.copy(shot.from).lerp(point, 0.5);
    shot.trail.scale.y = point.distanceTo(shot.from);
    if (fraction < 1) return;
    this.pendingBlast = null;
    disposeTree(shot.bolt);
    if (!shot.target || !this.targets.includes(shot.target)) return;
    this.lastHit = this.age;
    this.shatter(shot.target);
    shot.target.action("blast");
  }

  updateBlades(dt, allowHit) {
    for (const hand of this.blades) {
      hand.blade.visible = hand.grip.visible;
      if (!hand.grip.visible) { hand.previous = null; continue; }
      hand.grip.updateWorldMatrix(true, false);
      const current = BLADE_SAMPLES.map((z) =>
        hand.grip.localToWorld(new THREE.Vector3(0, 0, z)));
      if (allowHit && !this.pendingBlast && hand.previous && dt > 0) {
        const tip = current.at(-1);
        const oldTip = hand.previous.at(-1);
        const speed = tip.distanceTo(oldTip) / dt;
        if (speed > 1.2 && speed < 15) this.sound.whoosh();
        if (this.age - this.lastHit > 0.35) {
          let target = null;
          let firstContact = Infinity;
          let cut = null;
          for (const item of this.targets) {
            item.group.updateWorldMatrix(true, false);
            const previousLocal = hand.previous.map((point) =>
              item.group.worldToLocal(point.clone()));
            const currentLocal = current.map((point) =>
              item.group.worldToLocal(point.clone()));
            const contact = sweptBladeContact(previousLocal, currentLocal,
              item.box, dt);
            if (contact && contact.fraction < firstContact) {
              firstContact = contact.fraction;
              target = item;
              cut = bladeCutAtContact(previousLocal, currentLocal, contact);
            }
          }
          if (target) {
            this.lastHit = this.age;
            this.split(target, cut);
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
      this.leaderboardState = "Score shown above · leaderboard unavailable in this session";
      this.render();
      return;
    }
    try {
      const board = this.leaderboard.submitDemo(this.demo, this.session.finalScore());
      const mine = board.today.find((row) => row.name === this.playerName);
      this.leaderboardState = mine
        ? `Today's total: ${mine.score} points across ${mine.completed} lessons`
        : "Score saved on this headset";
    } catch {
      this.leaderboardState = "Local storage unavailable · score shown above";
    }
    if (!this.disposed) this.render();
  }

  update(dt, active = true) {
    this.age += dt;
    for (const fragment of [...this.fragments]) {
      fragment.age += dt;
      for (const { mesh, side, start, velocity } of fragment.pieces) {
        if (fragment.blast) {
          mesh.position.copy(velocity).multiplyScalar(fragment.age)
            .add(new THREE.Vector3(start.x, start.y - fragment.age ** 2 * 0.55, 0));
          mesh.rotation.set(side * fragment.age * 1.7,
            fragment.age * 2.1, side * fragment.age * 1.35);
        } else {
          mesh.position.x = start.x + side * fragment.normal.x * fragment.age * 0.34;
          mesh.position.y = start.y + side * fragment.normal.y * fragment.age * 0.34 -
            fragment.age * fragment.age * 0.55;
          mesh.rotation.z = side * fragment.age * 1.35;
        }
      }
      if (fragment.age > 1.18) {
        disposeTree(fragment.group);
        this.fragments.splice(this.fragments.indexOf(fragment), 1);
      }
    }
    if (!active) { this.clearMotion(); return; }
    const answerInFlight = Boolean(this.pendingBlast?.target);
    this.updateBlast(dt);
    if (this.scoreAction) {
      this.scoreActionRemaining -= dt;
      if (this.scoreActionRemaining <= 0) {
        const action = this.scoreAction;
        this.scoreAction = null;
        action();
        return;
      }
      this.updateBlades(dt, false);
      return;
    }
    if (this.feedbackRevealAt) {
      if (this.age < this.feedbackRevealAt) {
        this.updateBlades(dt, false);
        return;
      }
      this.render();
    }
    const oldPhase = this.session?.phase;
    const oldIndex = this.session?.index;
    if (!answerInFlight) this.session?.update(dt);
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
            { color: seconds <= 5 ? "#ffb194" : "#ffdc89", fontScale: 0.9,
              z: ROUND_INFO_Z });
          this.screen.add(this.timerPanel);
          disposeTree(old);
        }
      }
    }
    this.updateBlades(dt, true);
  }

  dispose() {
    this.disposed = true;
    this.pendingBlast = null;
    this.clearMotion();
    for (const { blade } of this.blades) disposeTree(blade);
    disposeTree(this.group);
    disposeTree(this.effects);
    this.targets = [];
    this.fragments = [];
  }
}
